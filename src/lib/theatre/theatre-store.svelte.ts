/**
 * Theatre Store
 *
 * Svelte 5 runes-based state management for the Theatre visualization.
 * Connects to the mission executor to receive real-time updates.
 */

import type { AgentCharacter, TheatreState, TheatreLog, Handoff, TheatreConfig } from './types';
import { ROLE_COLORS, ROLE_NAMES, DEFAULT_POSITIONS } from './types';

// Default characters for common agent roles
const DEFAULT_CHARACTERS: AgentCharacter[] = [
	{
		id: 'planner',
		name: ROLE_NAMES.planner,
		role: 'planner',
		color: ROLE_COLORS.planner,
		position: DEFAULT_POSITIONS.planner,
		status: 'idle',
		progress: 0
	},
	{
		id: 'frontend',
		name: ROLE_NAMES.frontend,
		role: 'frontend',
		color: ROLE_COLORS.frontend,
		position: DEFAULT_POSITIONS.frontend,
		status: 'idle',
		progress: 0
	},
	{
		id: 'backend',
		name: ROLE_NAMES.backend,
		role: 'backend',
		color: ROLE_COLORS.backend,
		position: DEFAULT_POSITIONS.backend,
		status: 'idle',
		progress: 0
	},
	{
		id: 'database',
		name: ROLE_NAMES.database,
		role: 'database',
		color: ROLE_COLORS.database,
		position: DEFAULT_POSITIONS.database,
		status: 'idle',
		progress: 0
	},
	{
		id: 'testing',
		name: ROLE_NAMES.testing,
		role: 'testing',
		color: ROLE_COLORS.testing,
		position: DEFAULT_POSITIONS.testing,
		status: 'idle',
		progress: 0
	},
	{
		id: 'devops',
		name: ROLE_NAMES.devops,
		role: 'devops',
		color: ROLE_COLORS.devops,
		position: DEFAULT_POSITIONS.devops,
		status: 'idle',
		progress: 0
	},
	{
		id: 'security',
		name: ROLE_NAMES.security,
		role: 'security',
		color: ROLE_COLORS.security,
		position: DEFAULT_POSITIONS.security,
		status: 'idle',
		progress: 0
	}
];

class TheatreStore {
	// State using Svelte 5 runes
	connected = $state(false);
	missionId = $state<string | null>(null);
	missionName = $state<string | null>(null);
	characters = $state<AgentCharacter[]>([...DEFAULT_CHARACTERS]);
	currentTaskId = $state<string | null>(null);
	progress = $state(0);
	logs = $state<TheatreLog[]>([]);
	handoffs = $state<Handoff[]>([]);

	// Config
	config = $state<TheatreConfig>({
		showGrid: true,
		showParticles: true,
		cameraMode: 'orbit',
		animationSpeed: 1,
		soundEnabled: false
	});

	// Derived state
	activeCharacter = $derived(
		this.characters.find((c) => c.status === 'working') || null
	);

	completedTasks = $derived(
		this.characters.filter((c) => c.status === 'celebrating').length
	);

	hasErrors = $derived(
		this.characters.some((c) => c.status === 'error' || c.status === 'blocked')
	);

	/**
	 * Connect to a mission
	 */
	connectToMission(missionId: string, missionName: string): void {
		this.missionId = missionId;
		this.missionName = missionName;
		this.connected = true;
		this.progress = 0;
		this.logs = [];
		this.handoffs = [];

		// Reset all characters to idle
		this.characters = this.characters.map((c) => ({
			...c,
			status: 'idle' as const,
			progress: 0,
			currentTask: undefined
		}));

		this.addLog('system', `Connected to mission: ${missionName}`, 'info');
	}

	/**
	 * Disconnect from current mission
	 */
	disconnect(): void {
		this.connected = false;
		this.missionId = null;
		this.missionName = null;
		this.currentTaskId = null;

		// Reset all characters
		this.characters = this.characters.map((c) => ({
			...c,
			status: 'idle' as const,
			progress: 0,
			currentTask: undefined
		}));

		this.addLog('system', 'Disconnected from mission', 'info');
	}

	/**
	 * Handle task started event
	 */
	onTaskStarted(taskId: string, taskName: string, agentId?: string): void {
		this.currentTaskId = taskId;

		// Find or assign an agent for this task
		const role = this.inferRoleFromTask(taskName);
		const character = agentId
			? this.characters.find((c) => c.id === agentId)
			: this.characters.find((c) => c.role === role);

		if (character) {
			this.updateCharacter(character.id, {
				status: 'working',
				currentTask: taskName,
				progress: 0
			});
		}

		this.addLog(character?.id || 'system', `Started: ${taskName}`, 'info');
	}

	/**
	 * Handle task progress event
	 */
	onTaskProgress(taskId: string, progress: number, message?: string): void {
		// Update the working character's progress
		const workingChar = this.characters.find((c) => c.status === 'working');
		if (workingChar) {
			this.updateCharacter(workingChar.id, { progress });
		}

		// Update overall progress
		this.progress = progress;

		if (message) {
			this.addLog(workingChar?.id || 'system', message, 'info');
		}
	}

	/**
	 * Handle task completed event
	 */
	onTaskCompleted(taskId: string, success: boolean): void {
		const workingChar = this.characters.find((c) => c.status === 'working');

		if (workingChar) {
			this.updateCharacter(workingChar.id, {
				status: success ? 'celebrating' : 'error',
				progress: 100
			});

			// Return to idle after celebration
			if (success) {
				setTimeout(() => {
					this.updateCharacter(workingChar.id, {
						status: 'idle',
						currentTask: undefined
					});
				}, 2000);
			}
		}

		this.addLog(
			workingChar?.id || 'system',
			success ? `Task completed successfully` : `Task failed`,
			success ? 'success' : 'error'
		);
	}

	/**
	 * Handle handoff between agents
	 */
	onHandoff(fromAgentId: string, toAgentId: string, payload: string): void {
		const handoff: Handoff = {
			id: `handoff-${Date.now()}`,
			fromAgent: fromAgentId,
			toAgent: toAgentId,
			payload,
			timestamp: new Date(),
			status: 'pending'
		};

		this.handoffs = [...this.handoffs, handoff];

		// Update agent statuses
		this.updateCharacter(fromAgentId, { status: 'handoff' });
		this.updateCharacter(toAgentId, { status: 'handoff' });

		this.addLog(fromAgentId, `Handoff to ${toAgentId}: ${payload}`, 'handoff');

		// Complete handoff after animation
		setTimeout(() => {
			this.handoffs = this.handoffs.map((h) =>
				h.id === handoff.id ? { ...h, status: 'complete' as const } : h
			);
			this.updateCharacter(fromAgentId, { status: 'idle' });
			this.updateCharacter(toAgentId, { status: 'working' });
		}, 1500);
	}

	/**
	 * Handle mission completed
	 */
	onMissionCompleted(): void {
		// All characters celebrate
		this.characters = this.characters.map((c) => ({
			...c,
			status: 'celebrating' as const,
			progress: 100
		}));

		this.progress = 100;
		this.addLog('system', 'Mission completed successfully!', 'success');

		// Return to idle after celebration
		setTimeout(() => {
			this.characters = this.characters.map((c) => ({
				...c,
				status: 'idle' as const,
				currentTask: undefined
			}));
		}, 5000);
	}

	/**
	 * Handle mission failed
	 */
	onMissionFailed(error: string): void {
		// Working character shows error
		const workingChar = this.characters.find((c) => c.status === 'working');
		if (workingChar) {
			this.updateCharacter(workingChar.id, { status: 'error' });
		}

		this.addLog('system', `Mission failed: ${error}`, 'error');
	}

	/**
	 * Update a specific character
	 */
	updateCharacter(characterId: string, updates: Partial<AgentCharacter>): void {
		this.characters = this.characters.map((c) =>
			c.id === characterId ? { ...c, ...updates } : c
		);
	}

	/**
	 * Add a log entry
	 */
	addLog(agentId: string, message: string, type: TheatreLog['type']): void {
		const log: TheatreLog = {
			id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			timestamp: new Date(),
			agentId,
			message,
			type
		};

		// Keep last 100 logs
		this.logs = [...this.logs.slice(-99), log];
	}

	/**
	 * Infer agent role from task name
	 */
	private inferRoleFromTask(taskName: string): AgentCharacter['role'] {
		const name = taskName.toLowerCase();

		if (name.includes('setup') || name.includes('plan') || name.includes('architect')) {
			return 'planner';
		}
		if (name.includes('frontend') || name.includes('ui') || name.includes('design') || name.includes('component')) {
			return 'frontend';
		}
		if (name.includes('backend') || name.includes('api') || name.includes('server')) {
			return 'backend';
		}
		if (name.includes('database') || name.includes('schema') || name.includes('data')) {
			return 'database';
		}
		if (name.includes('test') || name.includes('qa') || name.includes('quality')) {
			return 'testing';
		}
		if (name.includes('deploy') || name.includes('ci') || name.includes('cd') || name.includes('pipeline')) {
			return 'devops';
		}
		if (name.includes('security') || name.includes('auth') || name.includes('permission')) {
			return 'security';
		}

		return 'general';
	}

	/**
	 * Update config
	 */
	setConfig(updates: Partial<TheatreConfig>): void {
		this.config = { ...this.config, ...updates };
	}

	/**
	 * Get current state snapshot
	 */
	getState(): TheatreState {
		return {
			connected: this.connected,
			missionId: this.missionId,
			missionName: this.missionName,
			characters: this.characters,
			currentTaskId: this.currentTaskId,
			progress: this.progress,
			logs: this.logs,
			handoffs: this.handoffs
		};
	}

	/**
	 * Reset to initial state
	 */
	reset(): void {
		this.connected = false;
		this.missionId = null;
		this.missionName = null;
		this.characters = [...DEFAULT_CHARACTERS];
		this.currentTaskId = null;
		this.progress = 0;
		this.logs = [];
		this.handoffs = [];
	}
}

// Export singleton instance
export const theatreStore = new TheatreStore();
