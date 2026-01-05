/**
 * Spawner Live - State Types
 * Node state definitions and state machine types
 */

// Possible states for a node during execution
export type NodeState =
	| 'idle' // Not started, waiting
	| 'waiting' // Dependencies not met
	| 'active' // Agent has entered, starting work
	| 'processing' // Work in progress
	| 'success' // Completed successfully
	| 'error' // Failed with error
	| 'skipped' // Intentionally skipped
	| 'cancelled'; // Cancelled (e.g., node deleted during execution)

// Full state data for a node
export interface NodeStateData {
	state: NodeState;
	agentId: string | null;
	agentName?: string;
	progress: number; // 0-100
	message: string | null;
	error: string | null;
	enteredAt: string | null;
	exitedAt: string | null;
	duration: number | null; // milliseconds
	outputs?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
}

// Valid state transitions
export const validTransitions: Record<NodeState, NodeState[]> = {
	idle: ['waiting', 'active', 'skipped'],
	waiting: ['active', 'skipped', 'cancelled'],
	active: ['processing', 'success', 'error', 'skipped', 'cancelled'],
	processing: ['success', 'error', 'cancelled'],
	success: ['idle'], // Reset for re-execution
	error: ['idle', 'active'], // Retry
	skipped: ['idle', 'active'],
	cancelled: ['idle']
};

// Check if a transition is valid
export function isValidTransition(from: NodeState, to: NodeState): boolean {
	return validTransitions[from]?.includes(to) ?? false;
}

// State machine transition result
export interface TransitionResult {
	success: boolean;
	previousState: NodeState;
	newState: NodeState;
	error?: string;
}

// Pipeline execution state
export type PipelineState =
	| 'idle' // Not running
	| 'running' // In progress
	| 'paused' // Temporarily paused
	| 'completed' // Finished successfully
	| 'failed' // Finished with error
	| 'cancelled'; // Manually stopped

// Pipeline execution data
export interface PipelineStateData {
	state: PipelineState;
	pipelineId: string;
	startedAt: string | null;
	completedAt: string | null;
	totalNodes: number;
	completedNodes: number;
	failedNodes: number;
	skippedNodes: number;
	currentNodes: string[]; // Currently active node IDs
	error?: string;
}

// State change event for subscribers
export interface StateChangeEvent {
	nodeId: string;
	previousState: NodeStateData;
	newState: NodeStateData;
	trigger: string; // Event type that caused the change
	timestamp: string;
}

// Default state factory
export function createDefaultNodeState(): NodeStateData {
	return {
		state: 'idle',
		agentId: null,
		progress: 0,
		message: null,
		error: null,
		enteredAt: null,
		exitedAt: null,
		duration: null
	};
}

// Default pipeline state factory
export function createDefaultPipelineState(pipelineId: string, totalNodes: number): PipelineStateData {
	return {
		state: 'idle',
		pipelineId,
		startedAt: null,
		completedAt: null,
		totalNodes,
		completedNodes: 0,
		failedNodes: 0,
		skippedNodes: 0,
		currentNodes: []
	};
}

// State color mapping for UI
export const stateColors: Record<NodeState, string> = {
	idle: '#6b7280', // gray-500
	waiting: '#f59e0b', // amber-500
	active: '#3b82f6', // blue-500
	processing: '#8b5cf6', // violet-500
	success: '#22c55e', // green-500
	error: '#ef4444', // red-500
	skipped: '#9ca3af', // gray-400
	cancelled: '#6b7280' // gray-500
};

// State label mapping for UI
export const stateLabels: Record<NodeState, string> = {
	idle: 'Idle',
	waiting: 'Waiting',
	active: 'Active',
	processing: 'Processing',
	success: 'Complete',
	error: 'Error',
	skipped: 'Skipped',
	cancelled: 'Cancelled'
};
