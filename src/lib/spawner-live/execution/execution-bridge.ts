/**
 * Execution Bridge - Connects real execution events to Spawner Live visualization
 *
 * This bridge listens to the missionExecutor events and dispatches them
 * to the Spawner Live event system for visualization.
 */

import { eventRouter } from '../orchestrator';
import { timelineRecorder } from '../timeline';
import { soundManager } from '../audio';
import { liveModeStore } from '../stores';
import { get } from 'svelte/store';

export interface ExecutionBridgeCallbacks {
	onStatusChange?: (status: string) => void;
	onProgress?: (progress: number) => void;
	onLog?: (log: any) => void;
	onTaskStart?: (taskId: string, taskName: string) => void;
	onTaskComplete?: (taskId: string, success: boolean) => void;
	onComplete?: (mission: any) => void;
	onError?: (error: string) => void;
}

class ExecutionBridge {
	private isActive = false;
	private currentMissionId: string | null = null;
	private nodeIdByTaskName = new Map<string, string>();

	/**
	 * Create wrapper callbacks that bridge to Spawner Live
	 */
	wrapCallbacks(
		originalCallbacks: ExecutionBridgeCallbacks,
		nodeMap: Map<string, { id: string; name: string }>
	): ExecutionBridgeCallbacks {
		// Build node ID lookup by name
		this.nodeIdByTaskName.clear();
		for (const [id, node] of nodeMap) {
			this.nodeIdByTaskName.set(node.name, id);
		}

		const liveState = get(liveModeStore);
		this.isActive = liveState.enabled;

		if (!this.isActive) {
			return originalCallbacks;
		}

		return {
			onStatusChange: (status) => {
				this.handleStatusChange(status);
				originalCallbacks.onStatusChange?.(status);
			},

			onProgress: (progress) => {
				this.handleProgress(progress);
				originalCallbacks.onProgress?.(progress);
			},

			onLog: (log) => {
				this.handleLog(log);
				originalCallbacks.onLog?.(log);
			},

			onTaskStart: (taskId, taskName) => {
				this.handleTaskStart(taskId, taskName);
				originalCallbacks.onTaskStart?.(taskId, taskName);
			},

			onTaskComplete: (taskId, success) => {
				this.handleTaskComplete(taskId, success);
				originalCallbacks.onTaskComplete?.(taskId, success);
			},

			onComplete: (mission) => {
				this.handleComplete(mission);
				originalCallbacks.onComplete?.(mission);
			},

			onError: (error) => {
				this.handleError(error);
				originalCallbacks.onError?.(error);
			}
		};
	}

	/**
	 * Activate the bridge for a new execution
	 */
	activate(missionId: string): void {
		const liveState = get(liveModeStore);
		this.isActive = liveState.enabled;
		this.currentMissionId = missionId;

		if (this.isActive) {
			// Start timeline recording
			timelineRecorder.startRecording();

			// Dispatch pipeline start
			eventRouter.dispatch({
				type: 'pipeline_start',
				nodeId: 'pipeline',
				timestamp: Date.now(),
				metadata: { missionId }
			});

			// Play start sound
			soundManager.play('start');

			console.log('[ExecutionBridge] Activated for mission:', missionId);
		}
	}

	/**
	 * Deactivate the bridge
	 */
	deactivate(): void {
		if (this.isActive) {
			// Stop timeline recording
			timelineRecorder.stopRecording();
			console.log('[ExecutionBridge] Deactivated');
		}

		this.isActive = false;
		this.currentMissionId = null;
		this.nodeIdByTaskName.clear();
	}

	/**
	 * Handle status change
	 */
	private handleStatusChange(status: string): void {
		if (!this.isActive) return;

		switch (status) {
			case 'running':
				eventRouter.dispatch({
					type: 'pipeline_start',
					nodeId: 'pipeline',
					timestamp: Date.now(),
					metadata: { status }
				});
				break;

			case 'paused':
				eventRouter.dispatch({
					type: 'pipeline_pause',
					nodeId: 'pipeline',
					timestamp: Date.now()
				});
				soundManager.play('pause');
				break;

			case 'cancelled':
				eventRouter.dispatch({
					type: 'pipeline_cancel',
					nodeId: 'pipeline',
					timestamp: Date.now()
				});
				this.deactivate();
				break;
		}
	}

	/**
	 * Handle progress update
	 */
	private handleProgress(progress: number): void {
		if (!this.isActive) return;

		eventRouter.dispatch({
			type: 'agent_progress',
			nodeId: 'pipeline',
			timestamp: Date.now(),
			metadata: { progress }
		});
	}

	/**
	 * Handle log message
	 */
	private handleLog(log: any): void {
		if (!this.isActive) return;

		// Map log types to events
		const logType = log.type || 'info';

		if (logType === 'handoff') {
			// Parse handoff message to get source/target
			eventRouter.dispatch({
				type: 'handoff_start',
				nodeId: log.taskId || 'unknown',
				timestamp: Date.now(),
				metadata: { message: log.message }
			});
		}
	}

	/**
	 * Handle task start
	 */
	private handleTaskStart(taskId: string, taskName: string): void {
		if (!this.isActive) return;

		// Resolve node ID from task name if taskId is not a real node ID
		const resolvedNodeId = this.nodeIdByTaskName.get(taskName) || taskId;

		eventRouter.dispatch({
			type: 'agent_enter',
			nodeId: resolvedNodeId,
			agentId: taskName,
			timestamp: Date.now(),
			metadata: { taskName }
		});

		// Play node activation sound
		soundManager.play('nodeActivate');

		console.log('[ExecutionBridge] Task started:', taskName, '-> node:', resolvedNodeId);
	}

	/**
	 * Handle task complete
	 */
	private handleTaskComplete(taskId: string, success: boolean): void {
		if (!this.isActive) return;

		// Try to resolve actual node ID
		let resolvedNodeId = taskId;
		for (const [name, id] of this.nodeIdByTaskName) {
			if (id === taskId || name === taskId) {
				resolvedNodeId = id;
				break;
			}
		}

		eventRouter.dispatch({
			type: 'agent_exit',
			nodeId: resolvedNodeId,
			timestamp: Date.now(),
			metadata: { success }
		});

		if (success) {
			eventRouter.dispatch({
				type: 'node_complete',
				nodeId: resolvedNodeId,
				timestamp: Date.now()
			});
			soundManager.play('nodeComplete');
		} else {
			eventRouter.dispatch({
				type: 'agent_error',
				nodeId: resolvedNodeId,
				timestamp: Date.now(),
				metadata: { error: 'Task failed' }
			});
			soundManager.play('error');
		}

		console.log('[ExecutionBridge] Task completed:', resolvedNodeId, success ? 'SUCCESS' : 'FAILED');
	}

	/**
	 * Handle execution complete
	 */
	private handleComplete(mission: any): void {
		if (!this.isActive) return;

		eventRouter.dispatch({
			type: 'pipeline_complete',
			nodeId: 'pipeline',
			timestamp: Date.now(),
			metadata: { missionId: mission?.id }
		});

		// Play success sound and trigger celebration
		soundManager.play('success');

		this.deactivate();

		console.log('[ExecutionBridge] Execution completed');
	}

	/**
	 * Handle execution error
	 */
	private handleError(error: string): void {
		if (!this.isActive) return;

		eventRouter.dispatch({
			type: 'pipeline_error',
			nodeId: 'pipeline',
			timestamp: Date.now(),
			metadata: { error }
		});

		soundManager.play('error');

		this.deactivate();

		console.log('[ExecutionBridge] Execution failed:', error);
	}
}

export const executionBridge = new ExecutionBridge();
export { ExecutionBridge };
