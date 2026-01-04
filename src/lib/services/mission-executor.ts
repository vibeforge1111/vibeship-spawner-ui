/**
 * Mission Executor Service
 *
 * Unified execution system that:
 * 1. Converts canvas to mission
 * 2. Creates mission in MCP
 * 3. Starts execution
 * 4. Uses WebSocket for real-time updates (falls back to polling)
 * 5. Supports pause/resume/cancel
 * 6. Broadcasts events for bidirectional sync with Claude Code
 */

import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';
import type { Mission, MissionLog } from '$lib/services/mcp-client';
import { mcpClient } from '$lib/services/mcp-client';
import { buildMissionFromCanvas, validateForMission, type MissionBuildOptions } from './mission-builder';
import { syncClient, broadcastMissionEvent, isConnected, type SyncEvent } from './sync-client';
import { get } from 'svelte/store';

export type ExecutionMode = 'preview' | 'live';
export type ExecutionStatus = 'idle' | 'creating' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ExecutionProgress {
	status: ExecutionStatus;
	missionId: string | null;
	mission: Mission | null;
	progress: number;
	currentTaskId: string | null;
	currentTaskName: string | null;
	logs: MissionLog[];
	startTime: Date | null;
	endTime: Date | null;
	error: string | null;
}

export interface ExecutionCallbacks {
	onStatusChange?: (status: ExecutionStatus) => void;
	onProgress?: (progress: number) => void;
	onLog?: (log: MissionLog) => void;
	onTaskStart?: (taskId: string, taskName: string) => void;
	onTaskComplete?: (taskId: string, success: boolean) => void;
	onComplete?: (mission: Mission) => void;
	onError?: (error: string) => void;
}

class MissionExecutor {
	private pollingInterval: ReturnType<typeof setInterval> | null = null;
	private progress: ExecutionProgress;
	private callbacks: ExecutionCallbacks = {};
	private lastLogId: string | null = null;
	private syncUnsubscribe: (() => void) | null = null;
	private useWebSocket = false;

	constructor() {
		this.progress = this.createInitialProgress();
		this.setupSyncSubscription();
	}

	/**
	 * Setup WebSocket subscription for real-time updates
	 */
	private setupSyncSubscription(): void {
		// Subscribe to mission events from other clients (e.g., Claude Code)
		this.syncUnsubscribe = syncClient.subscribeAll((event: SyncEvent) => {
			// Only process events for our current mission
			if (event.missionId !== this.progress.missionId) return;

			// Skip events we sent ourselves
			if (event.source === 'spawner-ui') return;

			console.log('[MissionExecutor] Received sync event:', event.type);

			switch (event.type) {
				case 'mission_updated':
					// Another client updated the mission - refresh our state
					this.handleRemoteUpdate(event.data as Partial<Mission>);
					break;

				case 'mission_started':
					if (this.progress.status !== 'running') {
						this.progress.status = 'running';
						this.callbacks.onStatusChange?.('running');
					}
					break;

				case 'mission_completed':
					this.progress.status = 'completed';
					this.progress.endTime = new Date();
					this.stopPolling();
					this.callbacks.onStatusChange?.('completed');
					if (event.data.mission) {
						this.callbacks.onComplete?.(event.data.mission as Mission);
					}
					break;

				case 'mission_failed':
					this.progress.status = 'failed';
					this.progress.error = (event.data.error as string) || 'Mission failed';
					this.progress.endTime = new Date();
					this.stopPolling();
					this.callbacks.onStatusChange?.('failed');
					this.callbacks.onError?.(this.progress.error);
					break;

				case 'mission_log':
					const log = event.data.log as MissionLog;
					if (log && !this.progress.logs.find(l => l.id === log.id)) {
						this.progress.logs.push(log);
						this.callbacks.onLog?.(log);
					}
					break;

				case 'agent_handoff':
					this.addLocalLog('info', `Agent handoff: ${event.data.from} → ${event.data.to}`);
					break;
			}
		});
	}

	/**
	 * Handle remote mission update
	 */
	private handleRemoteUpdate(missionData: Partial<Mission>): void {
		if (missionData.current_task_id && missionData.current_task_id !== this.progress.currentTaskId) {
			this.progress.currentTaskId = missionData.current_task_id;
			// Find task name from tasks array
			const task = missionData.tasks?.find(t => t.id === missionData.current_task_id);
			if (task) {
				this.progress.currentTaskName = task.title;
				this.callbacks.onTaskStart?.(task.id, task.title);
			}
		}

		// Update progress based on completed tasks
		if (missionData.tasks) {
			const completedTasks = missionData.tasks.filter(
				t => t.status === 'completed' || t.status === 'failed'
			).length;
			this.progress.progress = Math.round((completedTasks / missionData.tasks.length) * 100);
			this.callbacks.onProgress?.(this.progress.progress);
		}
	}

	private createInitialProgress(): ExecutionProgress {
		return {
			status: 'idle',
			missionId: null,
			mission: null,
			progress: 0,
			currentTaskId: null,
			currentTaskName: null,
			logs: [],
			startTime: null,
			endTime: null,
			error: null
		};
	}

	/**
	 * Get current execution progress
	 */
	getProgress(): ExecutionProgress {
		return { ...this.progress };
	}

	/**
	 * Set callbacks for execution events
	 */
	setCallbacks(callbacks: ExecutionCallbacks): void {
		this.callbacks = callbacks;
	}

	/**
	 * Validate canvas before execution
	 */
	validate(nodes: CanvasNode[], connections: Connection[]): { valid: boolean; issues: string[] } {
		return validateForMission(nodes, connections);
	}

	/**
	 * Execute workflow by creating and starting a mission
	 */
	async execute(
		nodes: CanvasNode[],
		connections: Connection[],
		options: MissionBuildOptions
	): Promise<ExecutionProgress> {
		// Reset state
		this.progress = this.createInitialProgress();
		this.progress.status = 'creating';
		this.progress.startTime = new Date();
		this.callbacks.onStatusChange?.('creating');

		try {
			// Step 1: Validate
			const validation = this.validate(nodes, connections);
			if (!validation.valid) {
				throw new Error(`Validation failed: ${validation.issues.join(', ')}`);
			}

			// Step 2: Build mission from canvas
			this.addLocalLog('info', 'Creating mission from workflow...');
			const buildResult = await buildMissionFromCanvas(nodes, connections, options);

			if (!buildResult.success || !buildResult.mission) {
				throw new Error(buildResult.error || 'Failed to create mission');
			}

			this.progress.missionId = buildResult.mission.id;
			this.progress.mission = buildResult.mission;
			this.addLocalLog('info', `Mission created: ${buildResult.mission.id}`);

			// Broadcast mission created event for sync
			broadcastMissionEvent('mission_created', buildResult.mission.id, {
				mission: buildResult.mission
			});

			// Step 3: Start the mission
			this.progress.status = 'running';
			this.callbacks.onStatusChange?.('running');
			this.addLocalLog('info', 'Starting mission execution...');

			const startResult = await mcpClient.startMission(buildResult.mission.id);
			if (!startResult.success) {
				throw new Error(startResult.error || 'Failed to start mission');
			}

			this.progress.mission = startResult.data?.mission || this.progress.mission;
			this.addLocalLog('info', 'Mission started successfully');

			// Broadcast mission started event
			broadcastMissionEvent('mission_started', this.progress.missionId!, {
				mission: this.progress.mission
			});

			// Step 4: Start updates (WebSocket + reduced polling as fallback)
			this.useWebSocket = get(isConnected);
			this.startPolling();

			return this.progress;

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			this.progress.status = 'failed';
			this.progress.error = errorMsg;
			this.progress.endTime = new Date();
			this.callbacks.onStatusChange?.('failed');
			this.callbacks.onError?.(errorMsg);
			this.addLocalLog('error', `Execution failed: ${errorMsg}`);
			return this.progress;
		}
	}

	/**
	 * Pause execution
	 */
	async pause(): Promise<boolean> {
		if (!this.progress.missionId || this.progress.status !== 'running') {
			return false;
		}

		try {
			// MCP doesn't have a direct pause, but we can update status
			const result = await mcpClient.updateMission(this.progress.missionId, {
				// Signal pause by updating mission
			});

			if (result.success) {
				this.progress.status = 'paused';
				this.stopPolling();
				this.callbacks.onStatusChange?.('paused');
				this.addLocalLog('info', 'Execution paused');
				return true;
			}
		} catch (error) {
			console.error('Failed to pause:', error);
		}

		return false;
	}

	/**
	 * Resume execution
	 */
	async resume(): Promise<boolean> {
		if (!this.progress.missionId || this.progress.status !== 'paused') {
			return false;
		}

		try {
			this.progress.status = 'running';
			this.startPolling();
			this.callbacks.onStatusChange?.('running');
			this.addLocalLog('info', 'Execution resumed');
			return true;
		} catch (error) {
			console.error('Failed to resume:', error);
		}

		return false;
	}

	/**
	 * Cancel execution
	 */
	async cancel(): Promise<boolean> {
		if (!this.progress.missionId) {
			return false;
		}

		try {
			const result = await mcpClient.failMission(
				this.progress.missionId,
				'Cancelled by user'
			);

			if (result.success) {
				this.progress.status = 'cancelled';
				this.progress.endTime = new Date();
				this.stopPolling();
				this.callbacks.onStatusChange?.('cancelled');
				this.addLocalLog('info', 'Execution cancelled');
				return true;
			}
		} catch (error) {
			console.error('Failed to cancel:', error);
		}

		return false;
	}

	/**
	 * Stop and cleanup
	 */
	stop(): void {
		this.stopPolling();
		this.progress = this.createInitialProgress();
	}

	/**
	 * Full cleanup including sync subscription
	 */
	destroy(): void {
		this.stop();
		if (this.syncUnsubscribe) {
			this.syncUnsubscribe();
			this.syncUnsubscribe = null;
		}
	}

	/**
	 * Start polling for mission updates
	 * Uses faster polling when WebSocket not available
	 */
	private startPolling(): void {
		this.stopPolling();

		// When WebSocket is connected, poll less frequently (backup only)
		// When no WebSocket, poll every 2 seconds for near-real-time updates
		const pollInterval = this.useWebSocket ? 10000 : 2000;

		this.pollingInterval = setInterval(async () => {
			await this.pollMissionStatus();
		}, pollInterval);

		// Immediately poll once
		this.pollMissionStatus();

		console.log(`[MissionExecutor] Polling started (${pollInterval}ms interval, WebSocket: ${this.useWebSocket})`);
	}

	/**
	 * Stop polling
	 */
	private stopPolling(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = null;
		}
	}

	/**
	 * Poll mission status and logs
	 */
	private async pollMissionStatus(): Promise<void> {
		if (!this.progress.missionId) return;

		try {
			// Get mission status
			const missionResult = await mcpClient.getMission(this.progress.missionId);
			if (missionResult.success && missionResult.data?.mission) {
				const mission = missionResult.data.mission;
				this.progress.mission = mission;

				// Update current task
				if (mission.current_task_id) {
					const task = mission.tasks.find(t => t.id === mission.current_task_id);
					if (task && task.id !== this.progress.currentTaskId) {
						this.progress.currentTaskId = task.id;
						this.progress.currentTaskName = task.title;
						this.callbacks.onTaskStart?.(task.id, task.title);
					}
				}

				// Calculate progress
				const completedTasks = mission.tasks.filter(
					t => t.status === 'completed' || t.status === 'failed'
				).length;
				this.progress.progress = Math.round((completedTasks / mission.tasks.length) * 100);
				this.callbacks.onProgress?.(this.progress.progress);

				// Check for completion
				if (mission.status === 'completed') {
					this.progress.status = 'completed';
					this.progress.endTime = new Date();
					this.stopPolling();
					this.callbacks.onStatusChange?.('completed');
					this.callbacks.onComplete?.(mission);
				} else if (mission.status === 'failed') {
					this.progress.status = 'failed';
					this.progress.error = mission.error || 'Mission failed';
					this.progress.endTime = new Date();
					this.stopPolling();
					this.callbacks.onStatusChange?.('failed');
					this.callbacks.onError?.(this.progress.error);
				}
			}

			// Get new logs
			const logsResult = await mcpClient.getMissionLogs(this.progress.missionId, {
				since: this.lastLogId ? undefined : undefined,
				limit: 50
			});

			if (logsResult.success && logsResult.data?.logs) {
				const newLogs = logsResult.data.logs.filter(
					log => !this.progress.logs.find(l => l.id === log.id)
				);

				for (const log of newLogs) {
					this.progress.logs.push(log);
					this.callbacks.onLog?.(log);

					// Track task completions
					if (log.type === 'complete' && log.task_id) {
						this.callbacks.onTaskComplete?.(log.task_id, true);
					} else if (log.type === 'error' && log.task_id) {
						this.callbacks.onTaskComplete?.(log.task_id, false);
					}
				}

				if (newLogs.length > 0) {
					this.lastLogId = newLogs[newLogs.length - 1].id;
				}
			}

		} catch (error) {
			console.error('Polling error:', error);
		}
	}

	/**
	 * Add a local log entry (for UI events, not from MCP)
	 */
	private addLocalLog(type: 'info' | 'error', message: string): void {
		const log: MissionLog = {
			id: `local-${Date.now()}`,
			mission_id: this.progress.missionId || '',
			agent_id: null,
			task_id: null,
			type: type === 'info' ? 'progress' : 'error',
			message,
			data: {},
			created_at: new Date().toISOString()
		};

		this.progress.logs.push(log);
		this.callbacks.onLog?.(log);
	}
}

// Singleton instance
export const missionExecutor = new MissionExecutor();

// Export class for testing
export { MissionExecutor };
