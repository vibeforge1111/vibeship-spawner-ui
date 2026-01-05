/**
 * Spawner Live - State Machine Manager
 * Manages per-node state transitions during pipeline execution
 */

import { writable, derived, get } from 'svelte/store';
import type { AgentEvent } from '../types/events';
import {
	type NodeState,
	type NodeStateData,
	type TransitionResult,
	type StateChangeEvent,
	isValidTransition,
	createDefaultNodeState
} from '../types/states';

// Timeout for orphaned active states (5 minutes)
const ORPHAN_TIMEOUT_MS = 5 * 60 * 1000;

class StateMachineManager {
	private nodeStates = new Map<string, NodeStateData>();
	private stateHistory = new Map<string, NodeStateData[]>();
	private orphanCheckInterval: ReturnType<typeof setInterval> | null = null;

	// Svelte stores
	public states = writable<Map<string, NodeStateData>>(new Map());
	public stateChanges = writable<StateChangeEvent[]>([]);

	// Derived stores
	public activeNodes = derived(this.states, ($states) => {
		const active: string[] = [];
		$states.forEach((state, nodeId) => {
			if (state.state === 'active' || state.state === 'processing') {
				active.push(nodeId);
			}
		});
		return active;
	});

	public completedNodes = derived(this.states, ($states) => {
		const completed: string[] = [];
		$states.forEach((state, nodeId) => {
			if (state.state === 'success') {
				completed.push(nodeId);
			}
		});
		return completed;
	});

	public errorNodes = derived(this.states, ($states) => {
		const errors: string[] = [];
		$states.forEach((state, nodeId) => {
			if (state.state === 'error') {
				errors.push(nodeId);
			}
		});
		return errors;
	});

	constructor() {
		// Start orphan check
		this.startOrphanCheck();
	}

	/**
	 * Get state for a specific node
	 */
	getState(nodeId: string): NodeStateData {
		return this.nodeStates.get(nodeId) || createDefaultNodeState();
	}

	/**
	 * Get all node states
	 */
	getAllStates(): Map<string, NodeStateData> {
		return new Map(this.nodeStates);
	}

	/**
	 * Initialize state for a node
	 */
	initializeNode(nodeId: string): void {
		if (!this.nodeStates.has(nodeId)) {
			this.nodeStates.set(nodeId, createDefaultNodeState());
			this.updateStore();
		}
	}

	/**
	 * Process an event and transition state
	 */
	processEvent(event: AgentEvent): TransitionResult {
		if (!event.nodeId) {
			return {
				success: false,
				previousState: 'idle',
				newState: 'idle',
				error: 'Event has no nodeId'
			};
		}

		const nodeId = event.nodeId;
		const current = this.getState(nodeId);
		const newState = this.eventToState(event);

		// Validate transition
		if (!isValidTransition(current.state, newState)) {
			console.warn(
				`[StateMachine] Invalid transition: ${current.state} -> ${newState} for node ${nodeId}`
			);
			return {
				success: false,
				previousState: current.state,
				newState: current.state,
				error: `Invalid transition from ${current.state} to ${newState}`
			};
		}

		// Build updated state
		const updated: NodeStateData = {
			...current,
			state: newState,
			agentId: event.agentId,
			message: (event.data?.message as string) || null
		};

		// Update specific fields based on event type
		switch (event.type) {
			case 'agent_enter':
				updated.enteredAt = event.timestamp;
				updated.exitedAt = null;
				updated.progress = 0;
				updated.error = null;
				updated.agentName = (event.data?.agentName as string) || event.agentId;
				break;

			case 'agent_progress':
				updated.progress = (event.data?.progress as number) || 0;
				updated.message = (event.data?.message as string) || null;
				break;

			case 'agent_thinking':
				updated.message = (event.data?.message as string) || 'Thinking...';
				break;

			case 'agent_output':
				updated.outputs = {
					...(updated.outputs || {}),
					[(event.data?.outputType as string) || 'default']: event.data?.output
				};
				break;

			case 'agent_exit':
				updated.exitedAt = event.timestamp;
				updated.progress = 100;
				if (updated.enteredAt) {
					updated.duration =
						new Date(event.timestamp).getTime() - new Date(updated.enteredAt).getTime();
				}
				break;

			case 'agent_error':
				updated.error = (event.data?.error as string) || 'Unknown error';
				updated.exitedAt = event.timestamp;
				if (updated.enteredAt) {
					updated.duration =
						new Date(event.timestamp).getTime() - new Date(updated.enteredAt).getTime();
				}
				break;

			case 'agent_skip':
				updated.message = `Skipped: ${(event.data?.reason as string) || 'No reason given'}`;
				break;
		}

		// Save to history
		const history = this.stateHistory.get(nodeId) || [];
		history.push({ ...current });
		this.stateHistory.set(nodeId, history.slice(-50)); // Keep last 50 states

		// Update current state
		this.nodeStates.set(nodeId, updated);
		this.updateStore();

		// Record state change event
		const changeEvent: StateChangeEvent = {
			nodeId,
			previousState: current,
			newState: updated,
			trigger: event.type,
			timestamp: event.timestamp
		};
		this.stateChanges.update((changes) => [...changes.slice(-100), changeEvent]);

		return {
			success: true,
			previousState: current.state,
			newState: updated.state
		};
	}

	/**
	 * Map event type to node state
	 */
	private eventToState(event: AgentEvent): NodeState {
		switch (event.type) {
			case 'agent_enter':
				return 'active';
			case 'agent_progress':
			case 'agent_thinking':
				return 'processing';
			case 'agent_exit':
			case 'agent_output':
				return 'success';
			case 'agent_error':
				return 'error';
			case 'agent_skip':
				return 'skipped';
			default:
				return 'idle';
		}
	}

	/**
	 * Force set state (for manual overrides/testing)
	 */
	setState(nodeId: string, state: Partial<NodeStateData>): void {
		const current = this.getState(nodeId);
		const updated = { ...current, ...state };
		this.nodeStates.set(nodeId, updated);
		this.updateStore();
	}

	/**
	 * Reset a specific node to idle
	 */
	resetNode(nodeId: string): void {
		this.nodeStates.set(nodeId, createDefaultNodeState());
		this.updateStore();
	}

	/**
	 * Reset all nodes
	 */
	resetAll(): void {
		this.nodeStates.clear();
		this.stateHistory.clear();
		this.states.set(new Map());
		this.stateChanges.set([]);
	}

	/**
	 * Get state history for a node
	 */
	getHistory(nodeId: string): NodeStateData[] {
		return this.stateHistory.get(nodeId) || [];
	}

	/**
	 * Check for and handle orphaned active states
	 */
	private startOrphanCheck(): void {
		this.orphanCheckInterval = setInterval(() => {
			const now = Date.now();

			this.nodeStates.forEach((state, nodeId) => {
				if ((state.state === 'active' || state.state === 'processing') && state.enteredAt) {
					const enteredTime = new Date(state.enteredAt).getTime();
					if (now - enteredTime > ORPHAN_TIMEOUT_MS) {
						console.warn(`[StateMachine] Orphaned active state detected for node ${nodeId}`);
						this.setState(nodeId, {
							state: 'error',
							error: 'Timed out (no response for 5 minutes)',
							exitedAt: new Date().toISOString()
						});
					}
				}
			});
		}, 60000); // Check every minute
	}

	/**
	 * Stop orphan check (for cleanup)
	 */
	stopOrphanCheck(): void {
		if (this.orphanCheckInterval) {
			clearInterval(this.orphanCheckInterval);
			this.orphanCheckInterval = null;
		}
	}

	/**
	 * Update the Svelte store
	 */
	private updateStore(): void {
		this.states.set(new Map(this.nodeStates));
	}

	/**
	 * Get summary statistics
	 */
	getSummary(): {
		total: number;
		idle: number;
		active: number;
		success: number;
		error: number;
		skipped: number;
	} {
		const summary = {
			total: this.nodeStates.size,
			idle: 0,
			active: 0,
			success: 0,
			error: 0,
			skipped: 0
		};

		this.nodeStates.forEach((state) => {
			switch (state.state) {
				case 'idle':
				case 'waiting':
					summary.idle++;
					break;
				case 'active':
				case 'processing':
					summary.active++;
					break;
				case 'success':
					summary.success++;
					break;
				case 'error':
					summary.error++;
					break;
				case 'skipped':
				case 'cancelled':
					summary.skipped++;
					break;
			}
		});

		return summary;
	}
}

// Export singleton instance
export const stateMachine = new StateMachineManager();

// Export class for testing
export { StateMachineManager };
