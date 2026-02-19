/**
 * Project Goal Store
 *
 * Stores the current project goal/description across navigation.
 * Persists to sessionStorage to survive page reloads.
 */

import type { AnalyzedGoal, MatchResult, GeneratedWorkflow, GoalProcessingState } from '$lib/types/goal';
import { browser } from '$app/environment';

const STORAGE_KEY = 'spawner-pending-goal';
const OPTIONS_KEY = 'spawner-pipeline-options';

export interface PipelineOptions {
	includeSkills: boolean;
	includeMCPs: boolean;
}

const DEFAULT_PIPELINE_OPTIONS: PipelineOptions = { includeSkills: true, includeMCPs: true };

// Load from sessionStorage on init (browser only)
function loadFromStorage(): string {
	if (browser) {
		return sessionStorage.getItem(STORAGE_KEY) || '';
	}
	return '';
}

function loadOptionsFromStorage(): PipelineOptions {
	if (browser) {
		try {
			const raw = sessionStorage.getItem(OPTIONS_KEY);
			if (raw) return JSON.parse(raw);
		} catch { /* ignore */ }
	}
	return DEFAULT_PIPELINE_OPTIONS;
}

// State for goal processing
let goalState = $state<{
	input: string;
	analyzedGoal: AnalyzedGoal | null;
	matchResult: MatchResult | null;
	workflow: GeneratedWorkflow | null;
	processing: GoalProcessingState;
	pipelineOptions: PipelineOptions;
}>({
	input: loadFromStorage(),
	analyzedGoal: null,
	matchResult: null,
	workflow: null,
	processing: {
		status: 'idle',
		progress: 0,
		message: ''
	},
	pipelineOptions: loadOptionsFromStorage()
});

/**
 * Set the initial goal input
 */
export function setGoalInput(input: string): void {
	goalState.input = input;
	goalState.analyzedGoal = null;
	goalState.matchResult = null;
	goalState.workflow = null;
	goalState.processing = {
		status: 'idle',
		progress: 0,
		message: ''
	};
	// Persist to sessionStorage for page reload survival
	if (browser) {
		sessionStorage.setItem(STORAGE_KEY, input);
	}
}

/**
 * Update processing state
 */
export function setProcessingState(state: Partial<GoalProcessingState>): void {
	goalState.processing = { ...goalState.processing, ...state };
}

/**
 * Set analyzed goal
 */
export function setAnalyzedGoal(goal: AnalyzedGoal): void {
	goalState.analyzedGoal = goal;
}

/**
 * Set match result
 */
export function setMatchResult(result: MatchResult): void {
	goalState.matchResult = result;
}

/**
 * Set generated workflow
 */
export function setWorkflow(workflow: GeneratedWorkflow): void {
	goalState.workflow = workflow;
}

/**
 * Clear all goal state
 */
export function clearGoal(): void {
	goalState.input = '';
	goalState.analyzedGoal = null;
	goalState.matchResult = null;
	goalState.workflow = null;
	goalState.processing = {
		status: 'idle',
		progress: 0,
		message: ''
	};
	// Clear from sessionStorage
	if (browser) {
		sessionStorage.removeItem(STORAGE_KEY);
	}
}

/**
 * Get current goal state (reactive)
 */
export function getGoalState() {
	return goalState;
}

/**
 * Check if there's a pending goal to process
 */
export function hasPendingGoal(): boolean {
	return goalState.input.trim().length > 0 && goalState.processing.status === 'idle';
}

/**
 * Check if goal processing completed successfully
 */
export function isGoalComplete(): boolean {
	return goalState.processing.status === 'complete' && goalState.workflow !== null;
}

/**
 * Set pipeline options (skills/MCPs toggles)
 */
export function setPipelineOptions(options: Partial<PipelineOptions>): void {
	goalState.pipelineOptions = { ...goalState.pipelineOptions, ...options };
	if (browser) {
		sessionStorage.setItem(OPTIONS_KEY, JSON.stringify(goalState.pipelineOptions));
	}
}

/**
 * Get current pipeline options
 */
export function getPipelineOptions(): PipelineOptions {
	return goalState.pipelineOptions;
}

/**
 * Check if there was an error
 */
export function hasGoalError(): boolean {
	return goalState.processing.status === 'error';
}
