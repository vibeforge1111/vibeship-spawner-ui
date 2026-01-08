/**
 * Event Bridge Service
 *
 * Provides bidirectional communication between Claude Code and spawner-ui.
 * Claude Code POSTs events to /api/events, which broadcasts them to all UI clients.
 *
 * Server-side: Receives events and broadcasts via SSE
 * Client-side: Connects to SSE stream and notifies subscribers
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface BridgeEvent {
	id?: string;
	type: string;
	missionId?: string;
	taskId?: string;
	taskName?: string;
	progress?: number;
	message?: string;
	data?: Record<string, unknown>;
	timestamp: string;
	source: 'claude-code' | 'spawner-ui' | 'server';
}

type EventCallback = (event: BridgeEvent) => void;

/**
 * Server-side event bridge (used in +server.ts)
 */
class ServerEventBridge {
	private subscribers: Set<EventCallback> = new Set();

	emit(event: BridgeEvent): void {
		this.subscribers.forEach((callback) => {
			try {
				callback(event);
			} catch (e) {
				console.error('[EventBridge] Subscriber error:', e);
			}
		});
	}

	subscribe(callback: EventCallback): () => void {
		this.subscribers.add(callback);
		return () => {
			this.subscribers.delete(callback);
		};
	}

	get subscriberCount(): number {
		return this.subscribers.size;
	}
}

/**
 * Client-side event bridge (used in browser)
 */
class ClientEventBridge {
	private eventSource: EventSource | null = null;
	private subscribers: Set<EventCallback> = new Set();
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private connectionStatus = writable<'disconnected' | 'connecting' | 'connected'>('disconnected');

	constructor() {
		if (browser) {
			this.connect();
		}
	}

	get status() {
		return this.connectionStatus;
	}

	connect(): void {
		if (!browser) return;

		// Don't reconnect if already connected
		if (this.eventSource?.readyState === EventSource.OPEN) {
			return;
		}

		this.connectionStatus.set('connecting');

		try {
			this.eventSource = new EventSource('/api/events');

			this.eventSource.onopen = () => {
				console.log('[EventBridge] Connected to event stream');
				this.connectionStatus.set('connected');
			};

			this.eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data) as BridgeEvent;
					this.notifySubscribers(data);
				} catch (e) {
					console.error('[EventBridge] Failed to parse event:', e);
				}
			};

			this.eventSource.onerror = (error) => {
				console.error('[EventBridge] Connection error:', error);
				this.connectionStatus.set('disconnected');
				this.eventSource?.close();
				this.eventSource = null;
				this.scheduleReconnect();
			};
		} catch (e) {
			console.error('[EventBridge] Failed to connect:', e);
			this.connectionStatus.set('disconnected');
			this.scheduleReconnect();
		}
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer) return;

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect();
		}, 3000);
	}

	disconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
		this.connectionStatus.set('disconnected');
	}

	subscribe(callback: EventCallback): () => void {
		this.subscribers.add(callback);
		return () => {
			this.subscribers.delete(callback);
		};
	}

	private notifySubscribers(event: BridgeEvent): void {
		this.subscribers.forEach((callback) => {
			try {
				callback(event);
			} catch (e) {
				console.error('[EventBridge] Subscriber error:', e);
			}
		});
	}

	/**
	 * Send an event to the server (from UI to Claude Code)
	 */
	async send(event: Omit<BridgeEvent, 'timestamp' | 'source'>): Promise<boolean> {
		try {
			const response = await fetch('/api/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...event,
					source: 'spawner-ui',
					timestamp: new Date().toISOString()
				})
			});
			return response.ok;
		} catch (e) {
			console.error('[EventBridge] Failed to send event:', e);
			return false;
		}
	}
}

// Export server-side bridge singleton
export const eventBridge = new ServerEventBridge();

// Export client-side bridge singleton (only created in browser)
export const clientEventBridge = browser ? new ClientEventBridge() : null;

// Export stores for UI
export const eventBridgeStatus = browser
	? clientEventBridge!.status
	: writable<'disconnected' | 'connecting' | 'connected'>('disconnected');
