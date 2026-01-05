/**
 * Spawner Live - Event Validator
 * Validates events for schema, sequence, and deduplication
 */

import type { AgentEvent, AgentEventType, EventValidationResult } from '../types/events';
import { isValidTransition } from '../types/states';
import { stateMachine } from './state-machine';

// Valid event types
const VALID_EVENT_TYPES: AgentEventType[] = [
	'agent_enter',
	'agent_progress',
	'agent_thinking',
	'agent_output',
	'agent_exit',
	'agent_error',
	'agent_skip',
	'handoff_start',
	'handoff_complete',
	'pipeline_start',
	'pipeline_complete',
	'pipeline_failed',
	'deviation_warn'
];

// Events that require a nodeId
const NODE_REQUIRED_EVENTS: AgentEventType[] = [
	'agent_enter',
	'agent_progress',
	'agent_thinking',
	'agent_output',
	'agent_exit',
	'agent_error',
	'agent_skip'
];

// Events that require specific data fields
const DATA_REQUIREMENTS: Partial<Record<AgentEventType, string[]>> = {
	agent_progress: ['progress'],
	handoff_start: ['targetNodeId'],
	agent_error: ['error'],
	agent_skip: ['reason']
};

// Deduplication tracking
const recentEvents = new Map<string, number>();
const DEDUP_WINDOW_MS = 1000; // 1 second window for deduplication

class EventValidator {
	/**
	 * Validate an event against all rules
	 */
	validate(event: AgentEvent): EventValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Schema validation
		this.validateSchema(event, errors, warnings);

		// Sequence validation (state machine transitions)
		this.validateSequence(event, errors, warnings);

		// Deduplication check
		this.checkDuplication(event, warnings);

		// Timestamp validation
		this.validateTimestamp(event, warnings);

		return {
			valid: errors.length === 0,
			errors,
			warnings
		};
	}

	/**
	 * Validate event schema
	 */
	private validateSchema(
		event: AgentEvent,
		errors: string[],
		warnings: string[]
	): void {
		// Required fields
		if (!event.id) {
			errors.push('Missing required field: id');
		}
		if (!event.type) {
			errors.push('Missing required field: type');
		}
		if (!event.agentId) {
			errors.push('Missing required field: agentId');
		}
		if (!event.timestamp) {
			errors.push('Missing required field: timestamp');
		}

		// Valid event type
		if (event.type && !VALID_EVENT_TYPES.includes(event.type)) {
			warnings.push(`Unknown event type: ${event.type}`);
		}

		// NodeId requirement
		if (NODE_REQUIRED_EVENTS.includes(event.type) && !event.nodeId) {
			errors.push(`Event type ${event.type} requires a nodeId`);
		}

		// Data field requirements
		const requiredData = DATA_REQUIREMENTS[event.type];
		if (requiredData) {
			requiredData.forEach((field) => {
				if (!event.data || event.data[field] === undefined) {
					warnings.push(`Event type ${event.type} should have data.${field}`);
				}
			});
		}

		// Progress range validation
		if (event.type === 'agent_progress' && event.data?.progress !== undefined) {
			const progress = event.data.progress as number;
			if (progress < 0 || progress > 100) {
				warnings.push(`Progress value ${progress} is outside valid range (0-100)`);
			}
		}
	}

	/**
	 * Validate event sequence against state machine
	 */
	private validateSequence(
		event: AgentEvent,
		errors: string[],
		warnings: string[]
	): void {
		if (!event.nodeId) return;

		const currentState = stateMachine.getState(event.nodeId);
		const eventToState: Record<string, string> = {
			agent_enter: 'active',
			agent_progress: 'processing',
			agent_thinking: 'processing',
			agent_exit: 'success',
			agent_output: 'success',
			agent_error: 'error',
			agent_skip: 'skipped'
		};

		const targetState = eventToState[event.type];
		if (targetState && !isValidTransition(currentState.state, targetState as any)) {
			warnings.push(
				`Invalid state transition: ${currentState.state} -> ${targetState} for node ${event.nodeId}`
			);
		}
	}

	/**
	 * Check for duplicate events
	 */
	private checkDuplication(event: AgentEvent, warnings: string[]): void {
		// Create dedup key
		const key = `${event.nodeId || 'global'}-${event.type}-${event.timestamp}`;
		const now = Date.now();

		// Clean old entries
		recentEvents.forEach((time, k) => {
			if (now - time > DEDUP_WINDOW_MS) {
				recentEvents.delete(k);
			}
		});

		// Check for duplicate
		if (recentEvents.has(key)) {
			warnings.push('Potential duplicate event detected');
		} else {
			recentEvents.set(key, now);
		}

		// Also check by event ID
		const idKey = `id-${event.id}`;
		if (recentEvents.has(idKey)) {
			warnings.push('Duplicate event ID detected');
		} else {
			recentEvents.set(idKey, now);
		}
	}

	/**
	 * Validate timestamp
	 */
	private validateTimestamp(event: AgentEvent, warnings: string[]): void {
		try {
			const eventTime = new Date(event.timestamp).getTime();
			const now = Date.now();

			// Check for future timestamp (with 5 second tolerance for clock skew)
			if (eventTime > now + 5000) {
				warnings.push('Event timestamp is in the future (possible clock skew)');
			}

			// Check for very old timestamp (more than 1 hour)
			if (now - eventTime > 60 * 60 * 1000) {
				warnings.push('Event timestamp is more than 1 hour old (stale event)');
			}
		} catch {
			warnings.push('Invalid timestamp format');
		}
	}

	/**
	 * Sanitize event data for display (prevent XSS, etc.)
	 */
	sanitize(event: AgentEvent): AgentEvent {
		const sanitized = { ...event };

		// Sanitize string fields
		if (sanitized.data) {
			sanitized.data = { ...sanitized.data };

			Object.keys(sanitized.data).forEach((key) => {
				const value = sanitized.data![key];
				if (typeof value === 'string') {
					// Basic HTML entity encoding
					sanitized.data![key] = value
						.replace(/&/g, '&amp;')
						.replace(/</g, '&lt;')
						.replace(/>/g, '&gt;')
						.replace(/"/g, '&quot;')
						.replace(/'/g, '&#039;');
				}
			});
		}

		return sanitized;
	}

	/**
	 * Check if event should be processed (not a duplicate, valid, etc.)
	 */
	shouldProcess(event: AgentEvent): boolean {
		const result = this.validate(event);

		// Block on errors
		if (!result.valid) {
			console.warn('[EventValidator] Event blocked:', result.errors);
			return false;
		}

		// Log warnings but still process
		if (result.warnings.length > 0) {
			console.debug('[EventValidator] Event warnings:', result.warnings);
		}

		return true;
	}

	/**
	 * Clear deduplication cache
	 */
	clearCache(): void {
		recentEvents.clear();
	}
}

// Export singleton instance
export const eventValidator = new EventValidator();

// Export class for testing
export { EventValidator };
