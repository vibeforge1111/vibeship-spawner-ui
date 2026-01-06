/**
 * Sync Client - Real-time bidirectional sync between Spawner UI and Claude Code
 *
 * Provides WebSocket connection for instant updates when:
 * 1. Spawner UI creates/updates missions → Claude Code sees immediately
 * 2. Claude Code updates missions → Spawner UI sees immediately
 *
 * Falls back to polling when WebSocket not available.
 *
 * Setup: Run `wrangler dev` in spawner-v2 to enable local sync.
 */

import { writable, derived, get } from 'svelte/store';

export type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface SyncEvent {
	type: 'mission_created' | 'mission_updated' | 'mission_started' | 'mission_completed' | 'mission_failed' | 'mission_log' | 'skill_invoked' | 'agent_handoff';
	missionId?: string;
	data: Record<string, unknown>;
	timestamp: string;
	source: 'spawner-ui' | 'claude-code' | 'server';
}

export interface SyncConfig {
	wsUrl: string;
	httpUrl: string;
	reconnectInterval: number;
	maxReconnectAttempts: number;
	heartbeatInterval: number;
}

// Default config - tries local first, then production
const DEFAULT_CONFIG: SyncConfig = {
	wsUrl: 'ws://localhost:8787/sync',
	httpUrl: 'http://localhost:8787',
	reconnectInterval: 3000,
	maxReconnectAttempts: 10,
	heartbeatInterval: 30000
};

// Stores
const syncStatus = writable<SyncStatus>('disconnected');
const lastEvent = writable<SyncEvent | null>(null);
const eventLog = writable<SyncEvent[]>([]);
const connectionError = writable<string | null>(null);

// Derived stores
export const isConnected = derived(syncStatus, $status => $status === 'connected');
export const isReconnecting = derived(syncStatus, $status => $status === 'reconnecting');

// Event subscribers
type EventCallback = (event: SyncEvent) => void;
const eventSubscribers: Map<string, Set<EventCallback>> = new Map();

class SyncClient {
	private ws: WebSocket | null = null;
	private config: SyncConfig;
	private reconnectAttempts = 0;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private clientId: string;

	constructor(config?: Partial<SyncConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.clientId = `spawner-ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}

	/**
	 * Configure the sync client
	 */
	configure(config: Partial<SyncConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Get current config
	 */
	getConfig(): SyncConfig {
		return { ...this.config };
	}

	/**
	 * Connect to the sync server
	 */
	async connect(): Promise<boolean> {
		// Don't reconnect if already connected
		if (this.ws?.readyState === WebSocket.OPEN) {
			return true;
		}

		syncStatus.set('connecting');
		connectionError.set(null);

		try {
			// Try WebSocket connection
			return await this.connectWebSocket();
		} catch (error) {
			console.warn('[SyncClient] WebSocket connection failed:', error);

			// Fall back to checking HTTP availability
			const httpAvailable = await this.checkHttpAvailability();
			if (httpAvailable) {
				syncStatus.set('connected');
				console.log('[SyncClient] Using HTTP polling fallback (WebSocket not available)');
				return true;
			}

			syncStatus.set('error');
			connectionError.set(error instanceof Error ? error.message : 'Connection failed');
			return false;
		}
	}

	/**
	 * Connect via WebSocket
	 */
	private connectWebSocket(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(this.config.wsUrl);

				const timeout = setTimeout(() => {
					if (this.ws?.readyState !== WebSocket.OPEN) {
						this.ws?.close();
						reject(new Error('WebSocket connection timeout'));
					}
				}, 5000);

				this.ws.onopen = () => {
					clearTimeout(timeout);
					console.log('[SyncClient] WebSocket connected');
					syncStatus.set('connected');
					this.reconnectAttempts = 0;
					this.startHeartbeat();

					// Send identify message
					this.send({
						type: 'identify',
						clientId: this.clientId,
						clientType: 'spawner-ui'
					});

					resolve(true);
				};

				this.ws.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data);
						this.handleMessage(data);
					} catch (error) {
						console.error('[SyncClient] Failed to parse message:', error);
					}
				};

				this.ws.onerror = (error) => {
					clearTimeout(timeout);
					console.error('[SyncClient] WebSocket error:', error);
					reject(new Error('WebSocket connection error'));
				};

				this.ws.onclose = (event) => {
					clearTimeout(timeout);
					console.log('[SyncClient] WebSocket closed:', event.code, event.reason);
					this.stopHeartbeat();

					if (get(syncStatus) === 'connected') {
						// Unexpected disconnect - try to reconnect
						this.scheduleReconnect();
					}
				};

			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Check if HTTP endpoint is available
	 */
	private async checkHttpAvailability(): Promise<boolean> {
		try {
			const response = await fetch(this.config.httpUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' })
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Disconnect from the sync server
	 */
	disconnect(): void {
		this.stopHeartbeat();
		this.cancelReconnect();

		if (this.ws) {
			this.ws.close(1000, 'Client disconnect');
			this.ws = null;
		}

		syncStatus.set('disconnected');
	}

	/**
	 * Send a message to the server
	 */
	send(message: Record<string, unknown>): boolean {
		if (this.ws?.readyState !== WebSocket.OPEN) {
			console.warn('[SyncClient] Cannot send - not connected');
			return false;
		}

		try {
			this.ws.send(JSON.stringify({
				...message,
				clientId: this.clientId,
				timestamp: new Date().toISOString()
			}));
			return true;
		} catch (error) {
			console.error('[SyncClient] Send failed:', error);
			return false;
		}
	}

	/**
	 * Broadcast an event to all connected clients
	 */
	broadcast(event: Omit<SyncEvent, 'timestamp' | 'source'>): void {
		const fullEvent: SyncEvent = {
			...event,
			timestamp: new Date().toISOString(),
			source: 'spawner-ui'
		};

		// Record locally
		eventLog.update(log => [...log.slice(-99), fullEvent]);
		lastEvent.set(fullEvent);

		// Send to server for broadcast
		this.send({
			type: 'broadcast',
			event: fullEvent
		});

		// Notify local subscribers
		this.notifySubscribers(fullEvent);
	}

	/**
	 * Subscribe to specific event types
	 */
	subscribe(eventType: string, callback: EventCallback): () => void {
		if (!eventSubscribers.has(eventType)) {
			eventSubscribers.set(eventType, new Set());
		}
		eventSubscribers.get(eventType)!.add(callback);

		// Return unsubscribe function
		return () => {
			eventSubscribers.get(eventType)?.delete(callback);
		};
	}

	/**
	 * Subscribe to all events
	 */
	subscribeAll(callback: EventCallback): () => void {
		return this.subscribe('*', callback);
	}

	/**
	 * Handle incoming message
	 */
	private handleMessage(data: Record<string, unknown>): void {
		const type = data.type as string;

		switch (type) {
			case 'pong':
				// Heartbeat response
				break;

			case 'event':
				// Sync event from another client or server
				const event = data.event as SyncEvent;
				eventLog.update(log => [...log.slice(-99), event]);
				lastEvent.set(event);
				this.notifySubscribers(event);
				break;

			case 'sync_state':
				// Full state sync (on reconnect)
				console.log('[SyncClient] Received state sync');
				break;

			case 'error':
				console.error('[SyncClient] Server error:', data.message);
				connectionError.set(data.message as string);
				break;

			default:
				// Handle canvas events and other direct messages
				if (type && type.startsWith('canvas_')) {
					// Canvas event - treat as sync event
					const event: SyncEvent = {
						type: type as any,
						data: data,
						timestamp: data.timestamp || new Date().toISOString(),
						source: data.source || 'server'
					};
					eventLog.update(log => [...log.slice(-99), event]);
					lastEvent.set(event);
					this.notifySubscribers(event);
				} else if (type && (type === 'test_echo' || type === 'broadcast')) {
					// Test or broadcast message - forward as event
					const event: SyncEvent = {
						type: type as any,
						data: data.data || data,
						timestamp: data.timestamp || new Date().toISOString(),
						source: data.source || 'server'
					};
					this.notifySubscribers(event);
				} else {
					console.log('[SyncClient] Unknown message type:', type);
				}
		}
	}

	/**
	 * Notify subscribers of an event
	 */
	private notifySubscribers(event: SyncEvent): void {
		// Notify specific type subscribers
		eventSubscribers.get(event.type)?.forEach(callback => {
			try {
				callback(event);
			} catch (error) {
				console.error('[SyncClient] Subscriber error:', error);
			}
		});

		// Notify wildcard subscribers
		eventSubscribers.get('*')?.forEach(callback => {
			try {
				callback(event);
			} catch (error) {
				console.error('[SyncClient] Subscriber error:', error);
			}
		});
	}

	/**
	 * Start heartbeat to keep connection alive
	 */
	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatTimer = setInterval(() => {
			this.send({ type: 'ping' });
		}, this.config.heartbeatInterval);
	}

	/**
	 * Stop heartbeat
	 */
	private stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	/**
	 * Schedule a reconnection attempt
	 */
	private scheduleReconnect(): void {
		if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
			console.log('[SyncClient] Max reconnect attempts reached');
			syncStatus.set('error');
			connectionError.set('Max reconnection attempts reached');
			return;
		}

		syncStatus.set('reconnecting');
		this.reconnectAttempts++;

		const delay = this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
		console.log(`[SyncClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

		this.reconnectTimer = setTimeout(() => {
			this.connect();
		}, delay);
	}

	/**
	 * Cancel pending reconnection
	 */
	private cancelReconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
	}
}

// Singleton instance
export const syncClient = new SyncClient();

// Export stores
export { syncStatus, lastEvent, eventLog, connectionError };

// Export class for testing
export { SyncClient };

// Helper to broadcast mission events
export function broadcastMissionEvent(
	type: SyncEvent['type'],
	missionId: string,
	data: Record<string, unknown> = {}
): void {
	syncClient.broadcast({
		type,
		missionId,
		data
	});
}
