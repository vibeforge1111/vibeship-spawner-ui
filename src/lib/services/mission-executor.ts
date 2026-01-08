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
import type { Mission, MissionLog, MissionTask } from '$lib/services/mcp-client';
import { mcpClient } from '$lib/services/mcp-client';
import { buildMissionFromCanvas, validateForMission, generateExecutionPrompt, type MissionBuildOptions } from './mission-builder';
import { syncClient, broadcastMissionEvent, broadcastLearningEvent, broadcastTaskEvent, broadcastExecutionControl, isConnected, type SyncEvent } from './sync-client';
import { clientEventBridge, type BridgeEvent } from './event-bridge';
import { memoryClient } from './memory-client';
import { get } from 'svelte/store';
import { browser } from '$app/environment';
import { memorySettings, isMemoryConnected, shouldRecordDecision } from '$lib/stores/memory-settings.svelte';
import {
	saveMissionState,
	getActiveMissionState,
	clearMissionState,
	addToMissionHistory,
	type PersistedMissionState
} from './persistence';

export type ExecutionMode = 'preview' | 'live';
export type ExecutionStatus = 'idle' | 'creating' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface TaskProgress {
	taskId: string;
	taskName: string;
	progress: number;        // 0-100 within this task
	message?: string;        // Current activity
	startedAt: number;
}

export interface ExecutionProgress {
	status: ExecutionStatus;
	missionId: string | null;
	mission: Mission | null;
	executionPrompt: string | null;  // Copy-pasteable prompt for Claude Code
	progress: number;              // Overall mission progress 0-100
	currentTaskId: string | null;
	currentTaskName: string | null;
	currentTaskProgress: number;   // Progress within current task 0-100
	currentTaskMessage: string | null;  // Current activity description
	taskProgressMap: Map<string, TaskProgress>;  // Track all task progress
	logs: MissionLog[];
	startTime: Date | null;
	endTime: Date | null;
	error: string | null;
}

export interface ExecutionCallbacks {
	onStatusChange?: (status: ExecutionStatus) => void;
	onProgress?: (progress: number) => void;
	onTaskProgress?: (taskId: string, progress: number, message?: string) => void;  // NEW
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
	private eventBridgeUnsubscribe: (() => void) | null = null;
	private useWebSocket = false;

	// Learning tracking
	private taskStartTimes: Map<string, Date> = new Map();
	private taskDecisionIds: Map<string, string> = new Map();  // taskId -> memory_id
	private completedSkillSequence: string[] = [];

	constructor() {
		this.progress = this.createInitialProgress();
		this.setupSyncSubscription();
		this.setupEventBridgeSubscription();
		// Try to restore from saved state on initialization
		this.tryRestoreState();
	}

	// ============================================
	// Persistence Methods
	// ============================================

	/**
	 * Serialize current progress to persistable format
	 */
	private serializeProgress(): PersistedMissionState {
		return {
			status: this.progress.status,
			missionId: this.progress.missionId,
			mission: this.progress.mission,
			executionPrompt: this.progress.executionPrompt,
			progress: this.progress.progress,
			currentTaskId: this.progress.currentTaskId,
			currentTaskName: this.progress.currentTaskName,
			currentTaskProgress: this.progress.currentTaskProgress,
			currentTaskMessage: this.progress.currentTaskMessage,
			// Convert Map to Object for JSON serialization
			taskProgressMap: Object.fromEntries(this.progress.taskProgressMap),
			logs: this.progress.logs,
			startTime: this.progress.startTime?.toISOString() || null,
			endTime: this.progress.endTime?.toISOString() || null,
			error: this.progress.error,
			savedAt: new Date().toISOString(),
			version: 1
		};
	}

	/**
	 * Restore progress from persisted state
	 */
	private deserializeProgress(saved: PersistedMissionState): void {
		this.progress.status = saved.status;
		this.progress.missionId = saved.missionId;
		this.progress.mission = saved.mission;
		this.progress.executionPrompt = saved.executionPrompt;
		this.progress.progress = saved.progress;
		this.progress.currentTaskId = saved.currentTaskId;
		this.progress.currentTaskName = saved.currentTaskName;
		this.progress.currentTaskProgress = saved.currentTaskProgress;
		this.progress.currentTaskMessage = saved.currentTaskMessage;
		// Convert Object back to Map
		this.progress.taskProgressMap = new Map(Object.entries(saved.taskProgressMap || {}));
		this.progress.logs = saved.logs || [];
		this.progress.startTime = saved.startTime ? new Date(saved.startTime) : null;
		this.progress.endTime = saved.endTime ? new Date(saved.endTime) : null;
		this.progress.error = saved.error;
	}

	/**
	 * Persist current state to localStorage
	 */
	private persistState(): void {
		if (!browser) return;

		// Only persist active missions
		if (this.progress.status === 'idle') {
			clearMissionState();
			return;
		}

		const serialized = this.serializeProgress();
		const success = saveMissionState(serialized);

		if (success) {
			console.log('[MissionExecutor] State persisted', {
				status: this.progress.status,
				missionId: this.progress.missionId,
				progress: this.progress.progress
			});
		}

		// If completed/failed/cancelled, move to history
		if (this.progress.status === 'completed' || this.progress.status === 'failed' || this.progress.status === 'cancelled') {
			addToMissionHistory(serialized);
			clearMissionState();
		}
	}

	/**
	 * Try to restore state from localStorage on startup
	 */
	private tryRestoreState(): void {
		if (!browser) return;

		const saved = getActiveMissionState();
		if (!saved) return;

		console.log('[MissionExecutor] Restoring mission state', {
			missionId: saved.missionId,
			status: saved.status,
			progress: saved.progress
		});

		this.deserializeProgress(saved);

		// If mission was running, add a log about recovery
		if (saved.status === 'running' || saved.status === 'paused') {
			this.addLocalLog('info', `Mission restored from previous session (${saved.progress}% complete)`);

			// If was running, resume polling
			if (saved.status === 'running') {
				this.startPolling();
			}
		}
	}

	/**
	 * Check if there's a resumable mission
	 */
	hasResumableMission(): boolean {
		return this.progress.status !== 'idle' && this.progress.missionId !== null;
	}

	/**
	 * Get info about the current/resumable mission
	 */
	getResumableMissionInfo(): { id: string; name: string; progress: number; status: ExecutionStatus } | null {
		if (!this.hasResumableMission()) return null;

		return {
			id: this.progress.missionId || '',
			name: this.progress.mission?.name || 'Unknown Mission',
			progress: this.progress.progress,
			status: this.progress.status
		};
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
						const mission = event.data.mission as Mission;
						this.callbacks.onComplete?.(mission);
						// Record mission completion for learning
						this.recordMissionComplete(mission);
					}
					this.persistState();  // Persist completed state
					break;

				case 'mission_failed':
					this.progress.status = 'failed';
					this.progress.error = (event.data.error as string) || 'Mission failed';
					this.progress.endTime = new Date();
					this.stopPolling();
					this.callbacks.onStatusChange?.('failed');
					this.callbacks.onError?.(this.progress.error);
					// Record mission failure for learning
					if (this.progress.mission) {
						this.recordMissionComplete(this.progress.mission);
					}
					this.persistState();  // Persist failed state
					break;

				case 'mission_paused':
					// Remote client paused the mission
					if (this.progress.status === 'running') {
						this.progress.status = 'paused';
						this.stopPolling();
						this.callbacks.onStatusChange?.('paused');
						this.addLocalLog('info', 'Mission paused (remote)');
						this.persistState();  // Persist paused state
					}
					break;

				case 'mission_resumed':
					// Remote client resumed the mission
					if (this.progress.status === 'paused') {
						this.progress.status = 'running';
						this.startPolling();
						this.callbacks.onStatusChange?.('running');
						this.addLocalLog('info', 'Mission resumed (remote)');
						this.persistState();  // Persist resumed state
					}
					break;

				case 'task_started':
					// Real-time task start notification
					const startData = event.data as { taskId: string; taskName: string };
					if (startData.taskId !== this.progress.currentTaskId) {
						this.progress.currentTaskId = startData.taskId;
						this.progress.currentTaskName = startData.taskName;
						this.callbacks.onTaskStart?.(startData.taskId, startData.taskName);
					}
					break;

				case 'task_progress':
					// Real-time task progress update
					const progressData = event.data as { taskId: string; progress: number; message?: string };
					this.handleTaskProgress(progressData.taskId, progressData.progress, progressData.message);
					break;

				case 'task_completed':
					// Real-time task completion
					const completeData = event.data as { taskId: string; success: boolean };
					this.callbacks.onTaskComplete?.(completeData.taskId, completeData.success);
					// Record for learning
					this.recordTaskComplete(completeData.taskId, completeData.success);
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
	 * Setup Event Bridge subscription for real-time updates from Claude Code
	 * This is the primary mechanism for receiving events via HTTP POST
	 */
	private setupEventBridgeSubscription(): void {
		if (!browser || !clientEventBridge) return;

		this.eventBridgeUnsubscribe = clientEventBridge.subscribe((event: BridgeEvent) => {
			// Only process events for our current mission (or events without missionId)
			if (event.missionId && event.missionId !== this.progress.missionId) return;

			// Skip events we sent ourselves
			if (event.source === 'spawner-ui') return;

			console.log('[MissionExecutor] Received event bridge event:', event.type, event);

			switch (event.type) {
				case 'task_started':
					// Claude Code started a task
					const taskId = event.taskId || event.data?.taskId as string;
					const taskName = event.taskName || event.data?.taskName as string;
					if (taskId && taskId !== this.progress.currentTaskId) {
						this.progress.currentTaskId = taskId;
						this.progress.currentTaskName = taskName || taskId;
						this.progress.currentTaskProgress = 0;
						this.progress.currentTaskMessage = event.message || null;

						// Store in progress map so recordTaskComplete can find it later
						this.progress.taskProgressMap.set(taskId, {
							taskId,
							taskName: taskName || taskId,
							progress: 0,
							message: event.message,
							startedAt: Date.now()
						});

						// Track start time for duration calculation
						this.taskStartTimes.set(taskId, new Date());

						// Update task status in mission to 'in_progress'
						if (this.progress.mission?.tasks) {
							const task = this.progress.mission.tasks.find(t => t.id === taskId);
							if (task) {
								task.status = 'in_progress';
							}
						}

						this.callbacks.onTaskStart?.(taskId, taskName || taskId);
						this.addLocalLog('info', `Started: ${taskName || taskId}`);

						// Persist the updated state
						this.persistState();
					}
					break;

				case 'task_progress':
				case 'progress':
					// Progress update within a task
					const progressTaskId = event.taskId || this.progress.currentTaskId;
					const progressValue = event.progress ?? (event.data?.percent as number) ?? 0;
					const progressMessage = event.message || event.data?.message as string;
					if (progressTaskId) {
						this.handleTaskProgress(progressTaskId, progressValue, progressMessage);
						if (progressMessage) {
							this.addLocalLog('info', progressMessage);
						}
					}
					break;

				case 'task_completed':
					// Claude Code completed a task
					const completedTaskId = event.taskId || event.data?.taskId as string;
					const completedTaskName = event.taskName || event.data?.taskName as string || completedTaskId;
					const success = event.data?.success !== false;
					if (completedTaskId) {
						// Store task name in progress map so recordTaskComplete can find it
						const existingProgress = this.progress.taskProgressMap.get(completedTaskId);
						this.progress.taskProgressMap.set(completedTaskId, {
							taskId: completedTaskId,
							taskName: completedTaskName,
							progress: 100,
							message: success ? 'Completed' : 'Failed',
							startedAt: existingProgress?.startedAt || Date.now()
						});

						// Update task status in mission
						if (this.progress.mission?.tasks) {
							const task = this.progress.mission.tasks.find(t => t.id === completedTaskId);
							if (task) {
								task.status = success ? 'completed' : 'failed';
							}
						}
						// Recalculate overall progress
						this.recalculateOverallProgress();
						this.callbacks.onTaskComplete?.(completedTaskId, success);
						this.recordTaskComplete(completedTaskId, success);
						this.addLocalLog(success ? 'info' : 'info', `${success ? 'Completed' : 'Failed'}: ${completedTaskName}`);
						// Persist the updated state
						this.persistState();
					}
					break;

				case 'handoff':
					// Agent handoff between tasks
					const from = event.data?.from as string || 'previous task';
					const to = event.data?.to as string || 'next task';
					this.addLocalLog('info', `Handoff: ${from} → ${to}`);
					break;

				case 'mission_completed':
					this.progress.status = 'completed';
					this.progress.endTime = new Date();
					this.callbacks.onStatusChange?.('completed');
					if (this.progress.mission) {
						this.callbacks.onComplete?.(this.progress.mission);
						this.recordMissionComplete(this.progress.mission);
					}
					this.addLocalLog('info', 'Mission completed successfully');
					this.persistState();  // Persist completed state
					break;

				case 'mission_failed':
				case 'error':
					const errorMsg = event.message || event.data?.error as string || 'Mission failed';
					this.progress.status = 'failed';
					this.progress.error = errorMsg;
					this.progress.endTime = new Date();
					this.callbacks.onStatusChange?.('failed');
					this.callbacks.onError?.(errorMsg);
					this.addLocalLog('info', `Error: ${errorMsg}`);
					this.persistState();  // Persist failed state
					break;

				case 'log':
					// Generic log message
					const logMessage = event.message || event.data?.message as string;
					if (logMessage) {
						this.addLocalLog('info', logMessage);
					}
					break;

				default:
					// Log unknown event types for debugging
					console.log('[MissionExecutor] Unknown event type:', event.type);
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
				this.progress.currentTaskProgress = 0;  // Reset task progress
				this.progress.currentTaskMessage = null;
				this.callbacks.onTaskStart?.(task.id, task.title);

				// Record task start for learning
				this.recordTaskStart(task as MissionTask, task.assignedTo);
			}
		}

		// Update progress based on completed tasks
		if (missionData.tasks) {
			this.updateOverallProgress(missionData.tasks);
		}
	}

	/**
	 * Handle task progress update (for granular progress within a task)
	 */
	private handleTaskProgress(taskId: string, progress: number, message?: string): void {
		// Update task progress map
		const existing = this.progress.taskProgressMap.get(taskId);
		this.progress.taskProgressMap.set(taskId, {
			taskId,
			taskName: existing?.taskName || this.progress.currentTaskName || taskId,
			progress,
			message,
			startedAt: existing?.startedAt || Date.now()
		});

		// Update current task progress if this is the active task
		if (taskId === this.progress.currentTaskId) {
			this.progress.currentTaskProgress = progress;
			this.progress.currentTaskMessage = message || null;
		}

		// Recalculate overall progress with task-level granularity
		this.recalculateOverallProgress();

		// Notify callback
		this.callbacks.onTaskProgress?.(taskId, progress, message);
	}

	/**
	 * Update overall progress based on task completion ratio
	 */
	private updateOverallProgress(tasks: Array<{ status: string }>): void {
		const completedTasks = tasks.filter(
			t => t.status === 'completed' || t.status === 'failed'
		).length;
		this.progress.progress = Math.round((completedTasks / tasks.length) * 100);
		this.callbacks.onProgress?.(this.progress.progress);
	}

	/**
	 * Recalculate overall progress with task-level granularity
	 * This provides smoother progress updates by including partial task progress
	 */
	private recalculateOverallProgress(): void {
		const mission = this.progress.mission;
		if (!mission || !mission.tasks || mission.tasks.length === 0) return;

		const totalTasks = mission.tasks.length;
		let progressSum = 0;

		for (const task of mission.tasks) {
			if (task.status === 'completed') {
				progressSum += 100;
			} else if (task.status === 'failed') {
				progressSum += 100;  // Failed tasks count as "done" for progress
			} else if (task.status === 'in_progress') {
				// Use tracked progress if available, otherwise estimate at 50%
				const tracked = this.progress.taskProgressMap.get(task.id);
				progressSum += tracked?.progress ?? 50;
			}
			// pending tasks contribute 0
		}

		const newProgress = Math.round(progressSum / totalTasks);
		if (newProgress !== this.progress.progress) {
			this.progress.progress = newProgress;
			this.callbacks.onProgress?.(this.progress.progress);
			// Persist progress updates (throttled by the debounced nature of task progress)
			this.persistState();
		}
	}

	private createInitialProgress(): ExecutionProgress {
		return {
			status: 'idle',
			missionId: null,
			mission: null,
			executionPrompt: null,
			progress: 0,
			currentTaskId: null,
			currentTaskName: null,
			currentTaskProgress: 0,
			currentTaskMessage: null,
			taskProgressMap: new Map(),
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
	 * NOTE: Since spawner_mission MCP tool doesn't exist, this builds locally
	 * and generates a copy-pasteable prompt for Claude Code
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

		// Reset learning tracking for new execution
		this.resetLearningTracking();

		try {
			// Step 1: Validate
			const validation = this.validate(nodes, connections);
			if (!validation.valid) {
				throw new Error(`Validation failed: ${validation.issues.join(', ')}`);
			}

			// Step 2: Build mission from canvas (locally, no MCP call)
			this.addLocalLog('info', 'Creating mission from workflow...');
			const buildResult = await buildMissionFromCanvas(nodes, connections, options);

			if (!buildResult.success || !buildResult.mission) {
				throw new Error(buildResult.error || 'Failed to create mission');
			}

			this.progress.missionId = buildResult.mission.id;
			this.progress.mission = buildResult.mission;
			this.addLocalLog('info', `Mission created: ${buildResult.mission.id}`);

			// Step 3: Generate copy-pasteable execution prompt
			const executionPrompt = generateExecutionPrompt(buildResult.mission);
			this.progress.executionPrompt = executionPrompt;
			this.addLocalLog('info', 'Execution prompt generated - copy to Claude Code to start');

			// Broadcast mission created event for sync
			broadcastMissionEvent('mission_created', buildResult.mission.id, {
				mission: buildResult.mission,
				executionPrompt
			});

			// Set status to running (waiting for Claude Code to pick up)
			this.progress.status = 'running';
			this.callbacks.onStatusChange?.('running');

			// Persist state after mission creation
			this.persistState();

			// Listen for sync events from Claude Code
			this.useWebSocket = get(isConnected);
			if (this.useWebSocket) {
				this.addLocalLog('info', 'Listening for updates from Claude Code...');
			} else {
				this.addLocalLog('info', 'Copy the prompt below and paste it into Claude Code');
			}

			return this.progress;

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			this.progress.status = 'failed';
			this.progress.error = errorMsg;
			this.progress.endTime = new Date();
			this.callbacks.onStatusChange?.('failed');
			this.callbacks.onError?.(errorMsg);
			this.addLocalLog('error', `Execution failed: ${errorMsg}`);
			this.persistState();  // Persist error state
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
			// Update local state immediately for responsive UI
			this.progress.status = 'paused';
			this.stopPolling();
			this.callbacks.onStatusChange?.('paused');
			this.addLocalLog('info', 'Execution paused');
			this.persistState();  // Persist paused state

			// Broadcast pause event for other clients
			broadcastExecutionControl('mission_paused', this.progress.missionId, {
				pausedAt: Date.now(),
				currentTaskId: this.progress.currentTaskId,
				currentTaskName: this.progress.currentTaskName,
				progress: this.progress.progress
			});

			// Try to signal MCP (optional - MCP may not support pause)
			try {
				await mcpClient.updateMission(this.progress.missionId, {
					status: 'paused'
				});
			} catch {
				// MCP pause not supported, but local pause still works
				console.log('[MissionExecutor] MCP pause not supported, using local pause');
			}

			return true;
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
			// Update local state immediately
			this.progress.status = 'running';
			this.startPolling();
			this.callbacks.onStatusChange?.('running');
			this.addLocalLog('info', 'Execution resumed');
			this.persistState();  // Persist resumed state

			// Broadcast resume event for other clients
			broadcastExecutionControl('mission_resumed', this.progress.missionId, {
				resumedAt: Date.now(),
				currentTaskId: this.progress.currentTaskId,
				currentTaskName: this.progress.currentTaskName,
				progress: this.progress.progress
			});

			// Try to signal MCP (optional)
			try {
				await mcpClient.updateMission(this.progress.missionId, {
					status: 'running'
				});
			} catch {
				console.log('[MissionExecutor] MCP resume not supported');
			}

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
				this.persistState();  // Persist cancelled state (will move to history)
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
		clearMissionState();  // Clear persisted state when stopping
	}

	/**
	 * Full cleanup including sync subscription and event bridge
	 */
	destroy(): void {
		this.stop();
		if (this.syncUnsubscribe) {
			this.syncUnsubscribe();
			this.syncUnsubscribe = null;
		}
		if (this.eventBridgeUnsubscribe) {
			this.eventBridgeUnsubscribe();
			this.eventBridgeUnsubscribe = null;
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
				const previousMission = this.progress.mission;
				this.progress.mission = mission;

				// Update current task and broadcast if changed
				if (mission.current_task_id) {
					const task = mission.tasks.find(t => t.id === mission.current_task_id);
					if (task && task.id !== this.progress.currentTaskId) {
						this.progress.currentTaskId = task.id;
						this.progress.currentTaskName = task.title;
						this.progress.currentTaskProgress = 0;
						this.progress.currentTaskMessage = null;
						this.callbacks.onTaskStart?.(task.id, task.title);

						// Broadcast task started event for real-time sync
						broadcastTaskEvent('task_started', this.progress.missionId!, {
							taskId: task.id,
							taskName: task.title,
							agentId: task.assignedTo,
							skillId: this.getSkillIdForAgent(task.assignedTo)
						});

						// Record task start for learning
						this.recordTaskStart(task, task.assignedTo);
					}
				}

				// Detect task completions by comparing with previous state
				if (previousMission) {
					for (const task of mission.tasks) {
						const prevTask = previousMission.tasks.find(t => t.id === task.id);
						if (prevTask && prevTask.status !== task.status) {
							if (task.status === 'completed') {
								// Broadcast task completed
								broadcastTaskEvent('task_completed', this.progress.missionId!, {
									taskId: task.id,
									taskName: task.title,
									success: true,
									agentId: task.assignedTo
								});
							} else if (task.status === 'failed') {
								// Broadcast task failed
								broadcastTaskEvent('task_completed', this.progress.missionId!, {
									taskId: task.id,
									taskName: task.title,
									success: false,
									agentId: task.assignedTo
								});
							}
						}
					}
				}

				// Calculate progress with granularity
				this.recalculateOverallProgress();

				// Check for completion
				if (mission.status === 'completed') {
					this.progress.status = 'completed';
					this.progress.endTime = new Date();
					this.stopPolling();
					this.callbacks.onStatusChange?.('completed');
					this.callbacks.onComplete?.(mission);

					// Record mission completion for learning
					this.recordMissionComplete(mission);
				} else if (mission.status === 'failed') {
					this.progress.status = 'failed';
					this.progress.error = mission.error || 'Mission failed';
					this.progress.endTime = new Date();
					this.stopPolling();
					this.callbacks.onStatusChange?.('failed');
					this.callbacks.onError?.(this.progress.error);

					// Record mission failure for learning
					this.recordMissionComplete(mission);
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
						// Record task completion for learning
						this.recordTaskComplete(log.task_id, true);
					} else if (log.type === 'error' && log.task_id) {
						this.callbacks.onTaskComplete?.(log.task_id, false);
						// Record task failure for learning
						this.recordTaskComplete(log.task_id, false);
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
	 * Get skill ID for an agent
	 */
	private getSkillIdForAgent(agentId: string): string | undefined {
		const agent = this.progress.mission?.agents.find(a => a.id === agentId);
		return agent?.skills?.[0];
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

	// ============================================
	// Learning Integration Methods
	// ============================================

	/**
	 * Check if learning should be recorded
	 */
	private shouldRecordLearning(): boolean {
		const settings = get(memorySettings);
		return settings.enabled && get(isMemoryConnected);
	}

	/**
	 * Record when a task starts - captures the decision to execute this task
	 */
	private async recordTaskStart(task: MissionTask, agentId: string): Promise<void> {
		if (!this.shouldRecordLearning()) return;

		try {
			// Track start time
			this.taskStartTimes.set(task.id, new Date());

			// Find the agent info
			const agent = this.progress.mission?.agents.find(a => a.id === agentId);
			const agentName = agent?.name || agentId;
			const skillId = agent?.skills?.[0];  // Primary skill

			// Only record if granularity setting allows
			if (!shouldRecordDecision(0.7)) return;

			// Record the decision to execute this task
			const result = await memoryClient.recordAgentDecision(
				agentId,
				agentName,
				{
					skillId,
					missionId: this.progress.missionId || undefined,
					taskId: task.id,
					decision: `Execute task: ${task.title}`,
					reasoning: task.description,
					confidence: 0.7,
					context: `Mission: ${this.progress.mission?.name || 'Unknown'}`
				}
			);

			if (result.success && result.data) {
				this.taskDecisionIds.set(task.id, result.data.memory_id);
				console.log(`[Learning] Recorded task start: ${task.title}`);

				// Broadcast decision event
				broadcastLearningEvent('decision_tracked', {
					memoryId: result.data.memory_id,
					agentId,
					skillId,
					missionId: this.progress.missionId || undefined,
					content: `Execute task: ${task.title}`
				});
			}
		} catch (error) {
			console.error('[Learning] Failed to record task start:', error);
		}
	}

	/**
	 * Record when a task completes - captures the outcome
	 * Handles both cases: when task is found in mission.tasks and when only taskId is available
	 */
	private async recordTaskComplete(taskId: string, success: boolean): Promise<void> {
		if (!this.shouldRecordLearning()) return;

		try {
			// Try to find full task info, but continue even if not found
			const task = this.progress.mission?.tasks.find(t => t.id === taskId);

			// Use task info if available, otherwise fall back to tracked progress or current task
			const taskName = task?.title
				|| this.progress.taskProgressMap.get(taskId)?.taskName
				|| (taskId === this.progress.currentTaskId ? this.progress.currentTaskName : null)
				|| taskId;

			const missionName = this.progress.mission?.name || 'Unknown Mission';

			// Calculate duration
			const startTime = this.taskStartTimes.get(taskId);
			const duration = startTime ? Date.now() - startTime.getTime() : 0;

			// Find agent info (may be undefined)
			const agentId = task?.assignedTo;
			const agent = agentId ? this.progress.mission?.agents.find(a => a.id === agentId) : undefined;
			const skillId = agent?.skills?.[0];

			// Record outcome (with whatever info we have)
			await memoryClient.recordTaskOutcome(
				this.progress.missionId || '',
				taskId,
				{
					success,
					details: success
						? `Task "${taskName}" completed successfully in ${Math.round(duration / 1000)}s`
						: `Task "${taskName}" failed`,
					agentId,
					skillId
				}
			);

			// Track skill sequence for pattern extraction
			if (success && skillId) {
				this.completedSkillSequence.push(skillId);
			}

			// Auto-create decision when task succeeds (non-blocking)
			// This runs regardless of whether we found full task info
			if (success) {
				const what = `Completed: ${taskName}`;
				const why = `Task "${taskName}" in mission "${missionName}" completed successfully${skillId ? ` using ${skillId} skill` : ''} in ${Math.round(duration / 1000)}s`;
				memoryClient.createProjectDecision(what, why).then(() => {
					console.log(`[Mind] Auto-created decision for completed task: ${taskName}`);
				}).catch(err => {
					console.warn('[Mind] Failed to create decision:', err);
				});
			}

			// Auto-create issue when task fails (non-blocking)
			// This runs regardless of whether we found full task info
			if (!success) {
				const errorDetails = task?.error || 'Task execution failed';
				memoryClient.createProjectIssue(
					`[${missionName}] Task failed: ${taskName} - ${errorDetails}`,
					'open'
				).then(() => {
					console.log(`[Mind] Auto-created issue for failed task: ${taskName}`);
				}).catch(err => {
					console.warn('[Mind] Failed to create issue:', err);
				});
			}

			console.log(`[Learning] Recorded task outcome: ${taskName} - ${success ? 'success' : 'failed'}`);

			// Broadcast outcome event
			broadcastLearningEvent('outcome_recorded', {
				agentId,
				skillId,
				missionId: this.progress.missionId || undefined,
				content: success ? `Task completed: ${taskName}` : `Task failed: ${taskName}`,
				success,
				duration
			});
		} catch (error) {
			console.error('[Learning] Failed to record task outcome:', error);
		}
	}

	/**
	 * Record mission completion - extracts learnings and patterns
	 */
	private async recordMissionComplete(mission: Mission): Promise<void> {
		if (!this.shouldRecordLearning()) return;

		try {
			const successfulTasks = mission.tasks.filter(t => t.status === 'completed').length;
			const totalTasks = mission.tasks.length;
			const successRate = successfulTasks / totalTasks;

			// Only extract pattern if mission was mostly successful
			if (successRate >= 0.7 && this.completedSkillSequence.length >= 2) {
				const settings = get(memorySettings);

				if (settings.autoExtractPatterns) {
					// Record workflow pattern
					const patternResult = await memoryClient.recordWorkflowPattern({
						name: `${mission.name} workflow`,
						description: `Successful workflow pattern from mission "${mission.name}" with ${successRate * 100}% success rate`,
						skillSequence: this.completedSkillSequence,
						applicableTo: [mission.context?.projectType || 'general'],
						missionId: mission.id
					});

					console.log(`[Learning] Recorded workflow pattern: ${this.completedSkillSequence.join(' → ')}`);

					// Broadcast pattern detected event
					broadcastLearningEvent('pattern_detected', {
						memoryId: patternResult.data?.memory_id,
						missionId: mission.id,
						content: `Workflow pattern: ${this.completedSkillSequence.join(' → ')}`,
						skillSequence: this.completedSkillSequence,
						successRate
					});
				}

				// Record a learning about what worked
				const primaryAgent = mission.agents[0];
				if (primaryAgent) {
					const learningResult = await memoryClient.recordLearning(
						primaryAgent.id,
						{
							content: `Mission "${mission.name}" succeeded with skill sequence: ${this.completedSkillSequence.join(' → ')}`,
							skillId: primaryAgent.skills?.[0],
							missionId: mission.id,
							patternType: 'success',
							confidence: successRate
						}
					);

					// Broadcast learning recorded event
					broadcastLearningEvent('learning_recorded', {
						memoryId: learningResult.data?.memory_id,
						agentId: primaryAgent.id,
						skillId: primaryAgent.skills?.[0],
						missionId: mission.id,
						content: `Mission succeeded: ${mission.name}`,
						patternType: 'success'
					});
				}
			}

			// If mission failed, record the failure pattern
			if (mission.status === 'failed' && mission.error) {
				const failedTask = mission.tasks.find(t => t.status === 'failed');
				const agent = failedTask
					? mission.agents.find(a => a.id === failedTask.assignedTo)
					: mission.agents[0];

				if (agent) {
					const learningResult = await memoryClient.recordLearning(
						agent.id,
						{
							content: `Mission "${mission.name}" failed: ${mission.error}`,
							skillId: agent.skills?.[0],
							missionId: mission.id,
							patternType: 'failure',
							confidence: 0.8
						}
					);

					console.log(`[Learning] Recorded failure learning: ${mission.error}`);

					// Broadcast failure learning event
					broadcastLearningEvent('learning_recorded', {
						memoryId: learningResult.data?.memory_id,
						agentId: agent.id,
						skillId: agent.skills?.[0],
						missionId: mission.id,
						content: `Mission failed: ${mission.name}`,
						patternType: 'failure'
					});
				}
			}

			// Auto-generate session summary (non-blocking)
			const completedTasks = mission.tasks.filter(t => t.status === 'completed');
			const failedTasks = mission.tasks.filter(t => t.status === 'failed');
			const agentNames = mission.agents.map(a => a.name).join(', ');

			const sessionSummary = mission.status === 'completed'
				? `Mission "${mission.name}" completed successfully. ${completedTasks.length}/${totalTasks} tasks done. Agents: ${agentNames}. Skills used: ${this.completedSkillSequence.join(', ') || 'none tracked'}.`
				: `Mission "${mission.name}" ${mission.status}. ${completedTasks.length}/${totalTasks} tasks completed, ${failedTasks.length} failed. ${mission.error || ''}`;

			memoryClient.createSessionSummary(sessionSummary).then(() => {
				console.log(`[Mind] Auto-created session summary for mission: ${mission.name}`);
			}).catch(err => {
				console.warn('[Mind] Failed to create session summary:', err);
			});

			// Auto-generate improvement suggestions (non-blocking)
			this.generateImprovementSuggestions(mission, successRate).catch(err => {
				console.warn('[Mind] Failed to generate improvements:', err);
			});

		} catch (error) {
			console.error('[Learning] Failed to record mission complete:', error);
		}
	}

	/**
	 * Generate improvement suggestions based on mission outcomes
	 */
	private async generateImprovementSuggestions(mission: Mission, successRate: number): Promise<void> {
		try {
			const failedTasks = mission.tasks.filter(t => t.status === 'failed');
			const completedTasks = mission.tasks.filter(t => t.status === 'completed');

			// Suggest agent improvements for agents with failed tasks
			for (const task of failedTasks) {
				const agent = mission.agents.find(a => a.id === task.assignedTo);
				if (agent) {
					await memoryClient.createImprovement({
						type: 'agent',
						targetId: agent.id,
						targetName: agent.name,
						suggestion: `Agent "${agent.name}" failed task "${task.title}". Consider improving error handling or adding retry logic for similar tasks.`,
						impact: 0.15,
						confidence: 0.7,
						evidenceCount: 1,
						sourceMissions: [mission.id]
					});
					console.log(`[Mind] Suggested improvement for agent: ${agent.name}`);
				}

				// Suggest skill improvements if skill info available
				const skillId = agent?.skills?.[0];
				if (skillId) {
					await memoryClient.createImprovement({
						type: 'skill',
						targetId: skillId,
						targetName: skillId,
						suggestion: `Skill "${skillId}" was used in failed task "${task.title}". Review skill implementation for edge cases.`,
						impact: 0.1,
						confidence: 0.6,
						evidenceCount: 1,
						sourceMissions: [mission.id]
					});
				}
			}

			// If overall success rate is low, suggest pipeline improvement
			if (successRate < 0.7 && mission.tasks.length > 2) {
				await memoryClient.createImprovement({
					type: 'pipeline',
					targetId: mission.id,
					targetName: mission.name,
					suggestion: `Mission "${mission.name}" had ${Math.round(successRate * 100)}% success rate. Consider restructuring task dependencies or adding validation steps.`,
					impact: 0.2,
					confidence: 0.75,
					evidenceCount: failedTasks.length,
					sourceMissions: [mission.id]
				});
				console.log(`[Mind] Suggested pipeline improvement for mission: ${mission.name}`);
			}

			// If mission was highly successful, suggest positive reinforcement
			if (successRate >= 0.9 && completedTasks.length >= 3) {
				const primaryAgent = mission.agents[0];
				if (primaryAgent) {
					await memoryClient.createImprovement({
						type: 'team',
						targetId: 'team-composition',
						targetName: `${mission.name} Team`,
						suggestion: `Team composition for "${mission.name}" achieved ${Math.round(successRate * 100)}% success. Consider reusing this agent configuration: ${mission.agents.map(a => a.name).join(', ')}.`,
						impact: 0.25,
						confidence: 0.85,
						evidenceCount: completedTasks.length,
						sourceMissions: [mission.id]
					});
					console.log(`[Mind] Recorded successful team composition`);
				}
			}
		} catch (error) {
			console.error('[Mind] Failed to generate improvement suggestions:', error);
		}
	}

	/**
	 * Reset learning tracking for new execution
	 */
	private resetLearningTracking(): void {
		this.taskStartTimes.clear();
		this.taskDecisionIds.clear();
		this.completedSkillSequence = [];
	}
}

// Singleton instance
export const missionExecutor = new MissionExecutor();

// Export class for testing
export { MissionExecutor };
