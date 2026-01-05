/**
 * Spawner Live - Event Router
 * Central hub for all agent events
 */

import { writable, get } from 'svelte/store';
import type { AgentEvent, AgentEventType, EventSubscription } from '../types/events';

// Configuration
const MAX_HISTORY = 1000;
const THROTTLE_MS = 100;

// Event router class
class EventRouter {
	private subscriptions = new Map<string, EventSubscription>();
	private eventHistory: AgentEvent[] = [];
	private lastEventTime = new Map<string, number>();

	// Svelte stores for reactive UI
	public events = writable<AgentEvent[]>([]);
	public latestEvent = writable<AgentEvent | null>(null);
	public eventCount = writable<number>(0);
	public isProcessing = writable<boolean>(false);

	/**
	 * Subscribe to events with optional filtering
	 */
	subscribe(subscription: EventSubscription): () => void {
		// Warn if replacing existing subscription
		if (this.subscriptions.has(subscription.id)) {
			console.warn(`[EventRouter] Replacing existing subscription: ${subscription.id}`);
		}

		this.subscriptions.set(subscription.id, subscription);

		// Return unsubscribe function
		return () => {
			this.subscriptions.delete(subscription.id);
		};
	}

	/**
	 * Unsubscribe by ID
	 */
	unsubscribe(id: string): boolean {
		return this.subscriptions.delete(id);
	}

	/**
	 * Dispatch an event to all subscribers
	 */
	dispatch(event: AgentEvent): void {
		// Throttle rapid events for same node
		if (event.nodeId) {
			const key = `${event.nodeId}-${event.type}`;
			const lastTime = this.lastEventTime.get(key) || 0;
			const now = Date.now();

			if (now - lastTime < THROTTLE_MS && event.type === 'agent_progress') {
				// Skip throttled progress events
				return;
			}
			this.lastEventTime.set(key, now);
		}

		// Add to history
		this.eventHistory.push(event);
		if (this.eventHistory.length > MAX_HISTORY) {
			this.eventHistory.shift();
		}

		// Update stores
		this.events.update((events) => {
			const newEvents = [...events, event];
			return newEvents.slice(-MAX_HISTORY);
		});
		this.latestEvent.set(event);
		this.eventCount.update((n) => n + 1);
		this.isProcessing.set(true);

		// Notify subscribers
		this.subscriptions.forEach((sub) => {
			try {
				const typeMatch = !sub.types || sub.types.includes(event.type);
				const nodeMatch = !sub.nodeId || sub.nodeId === event.nodeId;
				const pipelineMatch = !sub.pipelineId || sub.pipelineId === event.pipelineId;

				if (typeMatch && nodeMatch && pipelineMatch) {
					sub.callback(event);
				}
			} catch (error) {
				console.error(`[EventRouter] Subscriber ${sub.id} threw error:`, error);
				// Continue to other subscribers - don't let one bad subscriber break the system
			}
		});

		// Reset processing flag after a delay
		setTimeout(() => {
			this.isProcessing.set(false);
		}, 100);
	}

	/**
	 * Dispatch multiple events in order
	 */
	dispatchBatch(events: AgentEvent[]): void {
		events.forEach((event) => this.dispatch(event));
	}

	/**
	 * Get event history with optional filtering
	 */
	getHistory(filter?: {
		types?: AgentEventType[];
		nodeId?: string;
		pipelineId?: string;
		since?: string;
		limit?: number;
	}): AgentEvent[] {
		let result = [...this.eventHistory];

		if (filter?.types) {
			result = result.filter((e) => filter.types!.includes(e.type));
		}

		if (filter?.nodeId) {
			result = result.filter((e) => e.nodeId === filter.nodeId);
		}

		if (filter?.pipelineId) {
			result = result.filter((e) => e.pipelineId === filter.pipelineId);
		}

		if (filter?.since) {
			const sinceDate = new Date(filter.since).getTime();
			result = result.filter((e) => new Date(e.timestamp).getTime() >= sinceDate);
		}

		if (filter?.limit) {
			result = result.slice(-filter.limit);
		}

		return result;
	}

	/**
	 * Get the last event for a specific node
	 */
	getLastEventForNode(nodeId: string): AgentEvent | null {
		for (let i = this.eventHistory.length - 1; i >= 0; i--) {
			if (this.eventHistory[i].nodeId === nodeId) {
				return this.eventHistory[i];
			}
		}
		return null;
	}

	/**
	 * Get all events for a specific node
	 */
	getEventsForNode(nodeId: string): AgentEvent[] {
		return this.eventHistory.filter((e) => e.nodeId === nodeId);
	}

	/**
	 * Check if there are any active agents (recent agent_enter without agent_exit)
	 */
	getActiveNodes(): string[] {
		const activeNodes = new Set<string>();

		this.eventHistory.forEach((event) => {
			if (!event.nodeId) return;

			if (event.type === 'agent_enter') {
				activeNodes.add(event.nodeId);
			} else if (event.type === 'agent_exit' || event.type === 'agent_error') {
				activeNodes.delete(event.nodeId);
			}
		});

		return Array.from(activeNodes);
	}

	/**
	 * Clear all event history
	 */
	clear(): void {
		this.eventHistory = [];
		this.lastEventTime.clear();
		this.events.set([]);
		this.latestEvent.set(null);
		this.eventCount.set(0);
		this.isProcessing.set(false);
	}

	/**
	 * Clear events for a specific pipeline
	 */
	clearPipeline(pipelineId: string): void {
		this.eventHistory = this.eventHistory.filter((e) => e.pipelineId !== pipelineId);
		this.events.set([...this.eventHistory]);
	}

	/**
	 * Get subscription count
	 */
	getSubscriptionCount(): number {
		return this.subscriptions.size;
	}

	/**
	 * Get subscription IDs (for debugging)
	 */
	getSubscriptionIds(): string[] {
		return Array.from(this.subscriptions.keys());
	}

	/**
	 * Export events for debugging/logging
	 */
	exportHistory(): string {
		return JSON.stringify(this.eventHistory, null, 2);
	}

	/**
	 * Import events (for replay/testing)
	 */
	importHistory(json: string): void {
		try {
			const events = JSON.parse(json) as AgentEvent[];
			events.forEach((event) => this.dispatch(event));
		} catch (error) {
			console.error('[EventRouter] Failed to import history:', error);
		}
	}
}

// Export singleton instance
export const eventRouter = new EventRouter();

// Export class for testing
export { EventRouter };
