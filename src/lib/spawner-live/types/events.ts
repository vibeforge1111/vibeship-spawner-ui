/**
 * Spawner Live - Event Types
 * Core event definitions for real-time agent orchestration
 */

// Agent event types for pipeline execution
export type AgentEventType =
	| 'agent_enter' // Agent starts working on a node
	| 'agent_progress' // Progress update (0-100)
	| 'agent_thinking' // Agent is processing/thinking
	| 'agent_output' // Agent produced output
	| 'agent_exit' // Agent finished with node
	| 'agent_error' // Agent encountered error
	| 'agent_skip' // Agent decided to skip node
	| 'handoff_start' // Beginning handoff to another agent
	| 'handoff_complete' // Handoff finished
	| 'pipeline_start' // Pipeline execution began
	| 'pipeline_complete' // Pipeline finished successfully
	| 'pipeline_failed' // Pipeline failed
	| 'deviation_warn'; // Agent deviated from pipeline

// Core agent event structure
export interface AgentEvent {
	id: string;
	type: AgentEventType;
	nodeId: string | null;
	agentId: string;
	timestamp: string;
	pipelineId?: string;
	data?: AgentEventData;
}

// Event data payloads by type
export interface AgentEventData {
	// Progress data
	progress?: number;
	message?: string;

	// Error data
	error?: string;
	errorCode?: string;

	// Handoff data
	targetNodeId?: string;
	targetAgentId?: string;
	payload?: Record<string, unknown>;

	// Output data
	output?: unknown;
	outputType?: string;

	// Skip data
	reason?: string;

	// Pipeline completion data
	totalDuration?: number;
	nodesCompleted?: number;
	nodesSkipped?: number;
	nodesFailed?: number;

	// Deviation data
	severity?: 'info' | 'warning' | 'error';
	expectedAction?: string;
	actualAction?: string;

	// Generic additional data
	[key: string]: unknown;
}

// Event subscription for filtering
export interface EventSubscription {
	id: string;
	types?: AgentEventType[];
	nodeId?: string;
	pipelineId?: string;
	callback: (event: AgentEvent) => void;
}

// Event validation result
export interface EventValidationResult {
	valid: boolean;
	errors: string[];
	warnings: string[];
}

// Event queue item for buffering
export interface QueuedEvent {
	event: AgentEvent;
	retryCount: number;
	firstAttempt: string;
	lastAttempt: string;
}

// Event acknowledgment from server
export interface EventAck {
	eventId: string;
	success: boolean;
	error?: string;
	serverTimestamp: string;
}

// Helper type guards
export function isAgentEvent(obj: unknown): obj is AgentEvent {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'id' in obj &&
		'type' in obj &&
		'agentId' in obj &&
		'timestamp' in obj
	);
}

export function isProgressEvent(event: AgentEvent): boolean {
	return event.type === 'agent_progress' && typeof event.data?.progress === 'number';
}

export function isHandoffEvent(event: AgentEvent): boolean {
	return event.type === 'handoff_start' && typeof event.data?.targetNodeId === 'string';
}

export function isPipelineEvent(event: AgentEvent): boolean {
	return ['pipeline_start', 'pipeline_complete', 'pipeline_failed'].includes(event.type);
}

// Event factory helpers
export function createEventId(): string {
	return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function createAgentEvent(
	type: AgentEventType,
	agentId: string,
	nodeId: string | null = null,
	data?: AgentEventData
): AgentEvent {
	return {
		id: createEventId(),
		type,
		nodeId,
		agentId,
		timestamp: new Date().toISOString(),
		data
	};
}
