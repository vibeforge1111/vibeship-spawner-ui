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
import { buildMissionFromCanvas, validateForMission, type MissionBuildOptions } from './mission-builder';
import { syncClient, broadcastMissionEvent, broadcastLearningEvent, isConnected, type SyncEvent } from './sync-client';
import { memoryClient } from './memory-client';
import { get } from 'svelte/store';
import { memorySettings, isMemoryConnected, shouldRecordDecision } from '$lib/stores/memory-settings.svelte';

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

	// Learning tracking
	private taskStartTimes: Map<string, Date> = new Map();
	private taskDecisionIds: Map<string, string> = new Map();  // taskId -> memory_id
	private completedSkillSequence: string[] = [];

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
						const mission = event.data.mission as Mission;
						this.callbacks.onComplete?.(mission);
						// Record mission completion for learning
						this.recordMissionComplete(mission);
					}
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

				// Record task start for learning
				this.recordTaskStart(task as MissionTask, task.assignedTo);
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

		// Reset learning tracking for new execution
		this.resetLearningTracking();

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

						// Record task start for learning
						this.recordTaskStart(task, task.assignedTo);
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
	 */
	private async recordTaskComplete(taskId: string, success: boolean): Promise<void> {
		if (!this.shouldRecordLearning()) return;

		try {
			const task = this.progress.mission?.tasks.find(t => t.id === taskId);
			if (!task) return;

			// Calculate duration
			const startTime = this.taskStartTimes.get(taskId);
			const duration = startTime ? Date.now() - startTime.getTime() : 0;

			// Find agent info
			const agentId = task.assignedTo;
			const agent = this.progress.mission?.agents.find(a => a.id === agentId);
			const skillId = agent?.skills?.[0];

			// Record outcome
			await memoryClient.recordTaskOutcome(
				this.progress.missionId || '',
				taskId,
				{
					success,
					details: success
						? `Task "${task.title}" completed successfully in ${Math.round(duration / 1000)}s`
						: `Task "${task.title}" failed`,
					agentId,
					skillId
				}
			);

			// Track skill sequence for pattern extraction
			if (success && skillId) {
				this.completedSkillSequence.push(skillId);
			}

			console.log(`[Learning] Recorded task outcome: ${task.title} - ${success ? 'success' : 'failed'}`);

			// Broadcast outcome event
			broadcastLearningEvent('outcome_recorded', {
				agentId,
				skillId,
				missionId: this.progress.missionId || undefined,
				content: success ? `Task completed: ${task.title}` : `Task failed: ${task.title}`,
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
		} catch (error) {
			console.error('[Learning] Failed to record mission complete:', error);
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
