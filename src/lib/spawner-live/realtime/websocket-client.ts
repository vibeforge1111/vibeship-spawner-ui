/**
 * Spawner Live - WebSocket Client
 * Real-time connection for receiving agent execution events
 */

import { writable, derived, get } from 'svelte/store';
import { eventRouter } from '../orchestrator/event-router';
import type { AgentEvent } from '../types/events';
import { isAgentEvent } from '../types/events';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

interface WebSocketState {
	status: ConnectionStatus;
	url: string | null;
	lastConnected: number | null;
	lastError: string | null;
	reconnectAttempts: number;
	latency: number | null;
}

interface WebSocketOptions {
	url: string;
	autoReconnect?: boolean;
	reconnectInterval?: number;
	maxReconnectAttempts?: number;
	heartbeatInterval?: number;
	onConnect?: () => void;
	onDisconnect?: (reason: string) => void;
	onError?: (error: Error) => void;
}

class SpawnerWebSocket {
	private ws: WebSocket | null = null;
	private options: WebSocketOptions | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private pingTime: number = 0;

	// Svelte store for connection state
	public state = writable<WebSocketState>({
		status: 'disconnected',
		url: null,
		lastConnected: null,
		lastError: null,
		reconnectAttempts: 0,
		latency: null
	});

	// Derived stores for convenience
	public status = derived(this.state, ($s) => $s.status);
	public isConnected = derived(this.state, ($s) => $s.status === 'connected');
	public latency = derived(this.state, ($s) => $s.latency);

	/**
	 * Connect to WebSocket server
	 */
	connect(options: WebSocketOptions): void {
		this.options = {
			autoReconnect: true,
			reconnectInterval: 3000,
			maxReconnectAttempts: 10,
			heartbeatInterval: 30000,
			...options
		};

		this.updateState({ status: 'connecting', url: options.url });
		this.createConnection();
	}

	/**
	 * Create WebSocket connection
	 */
	private createConnection(): void {
		if (!this.options) return;

		try {
			this.ws = new WebSocket(this.options.url);

			this.ws.onopen = () => this.handleOpen();
			this.ws.onclose = (e) => this.handleClose(e);
			this.ws.onerror = (e) => this.handleError(e);
			this.ws.onmessage = (e) => this.handleMessage(e);
		} catch (error) {
			this.handleError(error as Event);
		}
	}

	/**
	 * Handle connection open
	 */
	private handleOpen(): void {
		console.log('[SpawnerWebSocket] Connected');

		this.updateState({
			status: 'connected',
			lastConnected: Date.now(),
			reconnectAttempts: 0,
			lastError: null
		});

		// Start heartbeat
		this.startHeartbeat();

		// Callback
		this.options?.onConnect?.();
	}

	/**
	 * Handle connection close
	 */
	private handleClose(event: CloseEvent): void {
		console.log('[SpawnerWebSocket] Disconnected:', event.reason || 'Unknown reason');

		this.stopHeartbeat();

		const currentState = get(this.state);
		const shouldReconnect =
			this.options?.autoReconnect &&
			currentState.reconnectAttempts < (this.options?.maxReconnectAttempts || 10);

		if (shouldReconnect) {
			this.updateState({ status: 'reconnecting' });
			this.scheduleReconnect();
		} else {
			this.updateState({ status: 'disconnected' });
		}

		this.options?.onDisconnect?.(event.reason || 'Connection closed');
	}

	/**
	 * Handle connection error
	 */
	private handleError(event: Event): void {
		console.error('[SpawnerWebSocket] Error:', event);

		this.updateState({
			status: 'error',
			lastError: 'Connection error'
		});

		this.options?.onError?.(new Error('WebSocket connection error'));
	}

	/**
	 * Handle incoming message
	 */
	private handleMessage(event: MessageEvent): void {
		try {
			const data = JSON.parse(event.data);

			// Handle pong response
			if (data.type === 'pong') {
				const latency = Date.now() - this.pingTime;
				this.updateState({ latency });
				return;
			}

			// Handle agent events
			if (isAgentEvent(data)) {
				eventRouter.dispatch(data);
				return;
			}

			// Handle batch events
			if (Array.isArray(data) && data.every(isAgentEvent)) {
				data.forEach((event) => eventRouter.dispatch(event));
				return;
			}

			// Handle wrapped events
			if (data.event && isAgentEvent(data.event)) {
				eventRouter.dispatch(data.event);
				return;
			}

			console.warn('[SpawnerWebSocket] Unknown message format:', data);
		} catch (error) {
			console.error('[SpawnerWebSocket] Failed to parse message:', error);
		}
	}

	/**
	 * Send message to server
	 */
	send(data: unknown): boolean {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.warn('[SpawnerWebSocket] Cannot send - not connected');
			return false;
		}

		try {
			this.ws.send(JSON.stringify(data));
			return true;
		} catch (error) {
			console.error('[SpawnerWebSocket] Send error:', error);
			return false;
		}
	}

	/**
	 * Send event to server
	 */
	sendEvent(event: AgentEvent): boolean {
		return this.send({ type: 'event', event });
	}

	/**
	 * Subscribe to specific pipeline
	 */
	subscribeToPipeline(pipelineId: string): boolean {
		return this.send({ type: 'subscribe', pipelineId });
	}

	/**
	 * Unsubscribe from pipeline
	 */
	unsubscribeFromPipeline(pipelineId: string): boolean {
		return this.send({ type: 'unsubscribe', pipelineId });
	}

	/**
	 * Start heartbeat ping
	 */
	private startHeartbeat(): void {
		if (!this.options?.heartbeatInterval) return;

		this.heartbeatTimer = setInterval(() => {
			this.pingTime = Date.now();
			this.send({ type: 'ping', timestamp: this.pingTime });
		}, this.options.heartbeatInterval);
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
	 * Schedule reconnect attempt
	 */
	private scheduleReconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
		}

		const currentState = get(this.state);
		const delay = this.options?.reconnectInterval || 3000;

		console.log(
			`[SpawnerWebSocket] Reconnecting in ${delay}ms (attempt ${currentState.reconnectAttempts + 1})`
		);

		this.reconnectTimer = setTimeout(() => {
			this.updateState({ reconnectAttempts: currentState.reconnectAttempts + 1 });
			this.createConnection();
		}, delay);
	}

	/**
	 * Disconnect from server
	 */
	disconnect(): void {
		console.log('[SpawnerWebSocket] Disconnecting...');

		// Stop timers
		this.stopHeartbeat();
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		// Close connection
		if (this.ws) {
			this.ws.onclose = null; // Prevent reconnect
			this.ws.close(1000, 'Client disconnect');
			this.ws = null;
		}

		this.updateState({
			status: 'disconnected',
			reconnectAttempts: 0
		});
	}

	/**
	 * Update state
	 */
	private updateState(partial: Partial<WebSocketState>): void {
		this.state.update((s) => ({ ...s, ...partial }));
	}

	/**
	 * Get current status
	 */
	getStatus(): ConnectionStatus {
		return get(this.state).status;
	}

	/**
	 * Check if connected
	 */
	isConnectedNow(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}
}

// Export singleton instance
export const spawnerWebSocket = new SpawnerWebSocket();

// Export class for testing
export { SpawnerWebSocket };
