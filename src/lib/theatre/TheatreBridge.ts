/**
 * Theatre Bridge
 *
 * Connects the Theatre visualization to the mission executor.
 * Subscribes to execution events and updates the theatre store.
 */

import { theatreStore } from './theatre-store.svelte';
import { clientEventBridge, type BridgeEvent } from '$lib/services/event-bridge';
import { missionExecutor, type ExecutionProgress } from '$lib/services/mission-executor';
import { browser } from '$app/environment';

class TheatreBridge {
	private unsubscribe: (() => void) | null = null;
	private pollInterval: ReturnType<typeof setInterval> | null = null;

	/**
	 * Start listening for mission events
	 */
	connect(): void {
		if (!browser) return;

		// Subscribe to event bridge for real-time updates
		this.unsubscribe = clientEventBridge.subscribe(this.handleEvent.bind(this));

		// Also poll executor state for initial sync
		this.syncWithExecutor();

		console.log('[TheatreBridge] Connected');
	}

	/**
	 * Stop listening for mission events
	 */
	disconnect(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}

		if (this.pollInterval) {
			clearInterval(this.pollInterval);
			this.pollInterval = null;
		}

		theatreStore.disconnect();
		console.log('[TheatreBridge] Disconnected');
	}

	/**
	 * Sync with current executor state
	 */
	syncWithExecutor(): void {
		const progress = missionExecutor.getProgress();

		if (progress.missionId && progress.mission) {
			theatreStore.connectToMission(
				progress.missionId,
				progress.mission.name
			);

			// Update progress
			theatreStore.progress = progress.progress;

			// If there's a current task, mark it as working
			if (progress.currentTaskId && progress.currentTaskName) {
				theatreStore.onTaskStarted(
					progress.currentTaskId,
					progress.currentTaskName
				);
			}
		}
	}

	/**
	 * Handle incoming events
	 */
	private handleEvent(event: BridgeEvent): void {
		// Skip events from spawner-ui itself
		if (event.source === 'spawner-ui') return;

		console.log('[TheatreBridge] Event:', event.type, event);

		switch (event.type) {
			case 'task_started':
				this.handleTaskStarted(event);
				break;

			case 'task_progress':
			case 'progress':
				this.handleTaskProgress(event);
				break;

			case 'task_completed':
				this.handleTaskCompleted(event);
				break;

			case 'handoff':
				this.handleHandoff(event);
				break;

			case 'mission_completed':
				theatreStore.onMissionCompleted();
				break;

			case 'mission_failed':
			case 'error':
				theatreStore.onMissionFailed(
					event.message || event.data?.error as string || 'Unknown error'
				);
				break;

			case 'log':
				if (event.message) {
					theatreStore.addLog('system', event.message, 'info');
				}
				break;
		}
	}

	/**
	 * Handle task started event
	 */
	private handleTaskStarted(event: BridgeEvent): void {
		const taskId = event.taskId || event.data?.taskId as string;
		const taskName = event.taskName || event.data?.taskName as string;
		const agentId = event.data?.agentId as string | undefined;

		if (taskId) {
			// If not connected yet, try to sync
			if (!theatreStore.connected && event.missionId) {
				theatreStore.connectToMission(event.missionId, 'Mission');
			}

			theatreStore.onTaskStarted(taskId, taskName || taskId, agentId);
		}
	}

	/**
	 * Handle task progress event
	 */
	private handleTaskProgress(event: BridgeEvent): void {
		const taskId = event.taskId || event.data?.taskId as string;
		const progress = event.progress ?? event.data?.percent as number ?? 0;
		const message = event.message || event.data?.message as string;

		theatreStore.onTaskProgress(taskId || '', progress, message);
	}

	/**
	 * Handle task completed event
	 */
	private handleTaskCompleted(event: BridgeEvent): void {
		const taskId = event.taskId || event.data?.taskId as string;
		const success = event.data?.success !== false;

		if (taskId) {
			theatreStore.onTaskCompleted(taskId, success);
		}
	}

	/**
	 * Handle handoff event
	 */
	private handleHandoff(event: BridgeEvent): void {
		const fromAgent = event.data?.from as string || 'unknown';
		const toAgent = event.data?.to as string || 'unknown';
		const payload = event.data?.payload as string || '';

		theatreStore.onHandoff(fromAgent, toAgent, payload);
	}

	/**
	 * Manually trigger a test event (for development)
	 */
	simulateEvent(type: string, data: Record<string, unknown> = {}): void {
		const event: BridgeEvent = {
			type: type as BridgeEvent['type'],
			missionId: theatreStore.missionId || 'test-mission',
			source: 'test',
			timestamp: Date.now(),
			...data
		};

		this.handleEvent(event);
	}
}

// Export singleton
export const theatreBridge = new TheatreBridge();
