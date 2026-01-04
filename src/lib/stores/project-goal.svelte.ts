/**
 * Project Goal Store
 *
 * Stores the current project goal/description across navigation.
 * Persists the goal while user works on their workflow.
 */

import type { AnalyzedGoal, MatchResult, GeneratedWorkflow, GoalProcessingState } from '$lib/types/goal';

// State for goal processing
let goalState = $state<{
	input: string;
	analyzedGoal: AnalyzedGoal | null;
	matchResult: MatchResult | null;
	workflow: GeneratedWorkflow | null;
	processing: GoalProcessingState;
}>({
	input: '',
	analyzedGoal: null,
	matchResult: null,
	workflow: null,
	processing: {
		status: 'idle',
		progress: 0,
		message: ''
	}
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
 * Check if there was an error
 */
export function hasGoalError(): boolean {
	return goalState.processing.status === 'error';
}
