/**
 * Spawner Live - Event Buffer
 * Offline event storage with IndexedDB fallback to memory
 */

import { writable, get } from 'svelte/store';
import type { AgentEvent, QueuedEvent } from '../types/events';

const DB_NAME = 'spawner-live-events';
const STORE_NAME = 'event-buffer';
const MAX_BUFFER_SIZE = 1000;

class EventBuffer {
	private db: IDBDatabase | null = null;
	private memoryBuffer: QueuedEvent[] = [];
	private isIndexedDBAvailable = true;

	// Stores
	public bufferSize = writable<number>(0);
	public isOffline = writable<boolean>(false);
	public hasBufferedEvents = writable<boolean>(false);

	constructor() {
		this.initIndexedDB();
	}

	/**
	 * Initialize IndexedDB
	 */
	private async initIndexedDB(): Promise<void> {
		try {
			const request = indexedDB.open(DB_NAME, 1);

			request.onerror = () => {
				console.warn('[EventBuffer] IndexedDB not available, using memory buffer');
				this.isIndexedDBAvailable = false;
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					const store = db.createObjectStore(STORE_NAME, { keyPath: 'event.id' });
					store.createIndex('timestamp', 'event.timestamp', { unique: false });
					store.createIndex('retryCount', 'retryCount', { unique: false });
				}
			};

			request.onsuccess = (event) => {
				this.db = (event.target as IDBOpenDBRequest).result;
				this.updateBufferSize();
			};
		} catch (error) {
			console.warn('[EventBuffer] IndexedDB initialization failed:', error);
			this.isIndexedDBAvailable = false;
		}
	}

	/**
	 * Add event to buffer
	 */
	async add(event: AgentEvent): Promise<void> {
		const queuedEvent: QueuedEvent = {
			event,
			retryCount: 0,
			firstAttempt: new Date().toISOString(),
			lastAttempt: new Date().toISOString()
		};

		if (this.isIndexedDBAvailable && this.db) {
			try {
				await this.addToIndexedDB(queuedEvent);
			} catch (error) {
				console.error('[EventBuffer] Failed to add to IndexedDB:', error);
				this.addToMemory(queuedEvent);
			}
		} else {
			this.addToMemory(queuedEvent);
		}

		this.updateBufferSize();
		this.hasBufferedEvents.set(true);
	}

	/**
	 * Add event to IndexedDB
	 */
	private addToIndexedDB(queuedEvent: QueuedEvent): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error('Database not initialized'));
				return;
			}

			const transaction = this.db.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.add(queuedEvent);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Add event to memory buffer
	 */
	private addToMemory(queuedEvent: QueuedEvent): void {
		this.memoryBuffer.push(queuedEvent);

		// Enforce max size
		if (this.memoryBuffer.length > MAX_BUFFER_SIZE) {
			this.memoryBuffer.shift();
			console.warn('[EventBuffer] Buffer overflow, oldest event dropped');
		}
	}

	/**
	 * Get all buffered events (oldest first)
	 */
	async getAll(): Promise<QueuedEvent[]> {
		if (this.isIndexedDBAvailable && this.db) {
			try {
				return await this.getAllFromIndexedDB();
			} catch (error) {
				console.error('[EventBuffer] Failed to get from IndexedDB:', error);
				return [...this.memoryBuffer];
			}
		}
		return [...this.memoryBuffer];
	}

	/**
	 * Get all events from IndexedDB
	 */
	private getAllFromIndexedDB(): Promise<QueuedEvent[]> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error('Database not initialized'));
				return;
			}

			const transaction = this.db.transaction([STORE_NAME], 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const index = store.index('timestamp');
			const request = index.getAll();

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Remove event from buffer
	 */
	async remove(eventId: string): Promise<void> {
		if (this.isIndexedDBAvailable && this.db) {
			try {
				await this.removeFromIndexedDB(eventId);
			} catch (error) {
				console.error('[EventBuffer] Failed to remove from IndexedDB:', error);
				this.removeFromMemory(eventId);
			}
		} else {
			this.removeFromMemory(eventId);
		}

		this.updateBufferSize();
	}

	/**
	 * Remove event from IndexedDB
	 */
	private removeFromIndexedDB(eventId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error('Database not initialized'));
				return;
			}

			const transaction = this.db.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.delete(eventId);

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Remove event from memory buffer
	 */
	private removeFromMemory(eventId: string): void {
		const index = this.memoryBuffer.findIndex((q) => q.event.id === eventId);
		if (index >= 0) {
			this.memoryBuffer.splice(index, 1);
		}
	}

	/**
	 * Update retry count for an event
	 */
	async updateRetry(eventId: string): Promise<void> {
		if (this.isIndexedDBAvailable && this.db) {
			try {
				await this.updateRetryInIndexedDB(eventId);
			} catch (error) {
				console.error('[EventBuffer] Failed to update retry in IndexedDB:', error);
				this.updateRetryInMemory(eventId);
			}
		} else {
			this.updateRetryInMemory(eventId);
		}
	}

	/**
	 * Update retry count in IndexedDB
	 */
	private updateRetryInIndexedDB(eventId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error('Database not initialized'));
				return;
			}

			const transaction = this.db.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.get(eventId);

			request.onsuccess = () => {
				const queuedEvent = request.result as QueuedEvent;
				if (queuedEvent) {
					queuedEvent.retryCount++;
					queuedEvent.lastAttempt = new Date().toISOString();
					store.put(queuedEvent);
				}
				resolve();
			};
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Update retry count in memory
	 */
	private updateRetryInMemory(eventId: string): void {
		const queuedEvent = this.memoryBuffer.find((q) => q.event.id === eventId);
		if (queuedEvent) {
			queuedEvent.retryCount++;
			queuedEvent.lastAttempt = new Date().toISOString();
		}
	}

	/**
	 * Clear all buffered events
	 */
	async clear(): Promise<void> {
		if (this.isIndexedDBAvailable && this.db) {
			try {
				await this.clearIndexedDB();
			} catch (error) {
				console.error('[EventBuffer] Failed to clear IndexedDB:', error);
			}
		}
		this.memoryBuffer = [];
		this.updateBufferSize();
		this.hasBufferedEvents.set(false);
	}

	/**
	 * Clear IndexedDB store
	 */
	private clearIndexedDB(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error('Database not initialized'));
				return;
			}

			const transaction = this.db.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.clear();

			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Update buffer size store
	 */
	private async updateBufferSize(): Promise<void> {
		let size = 0;

		if (this.isIndexedDBAvailable && this.db) {
			try {
				size = await this.getIndexedDBCount();
			} catch {
				size = this.memoryBuffer.length;
			}
		} else {
			size = this.memoryBuffer.length;
		}

		this.bufferSize.set(size);
		this.hasBufferedEvents.set(size > 0);
	}

	/**
	 * Get count from IndexedDB
	 */
	private getIndexedDBCount(): Promise<number> {
		return new Promise((resolve, reject) => {
			if (!this.db) {
				reject(new Error('Database not initialized'));
				return;
			}

			const transaction = this.db.transaction([STORE_NAME], 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.count();

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get events that should be retried (retryCount < 3)
	 */
	async getRetryable(): Promise<QueuedEvent[]> {
		const all = await this.getAll();
		return all.filter((q) => q.retryCount < 3);
	}

	/**
	 * Remove events that have exceeded retry limit
	 */
	async pruneExpired(): Promise<number> {
		const all = await this.getAll();
		const expired = all.filter((q) => q.retryCount >= 3);

		for (const q of expired) {
			await this.remove(q.event.id);
		}

		return expired.length;
	}

	/**
	 * Set offline mode
	 */
	setOffline(offline: boolean): void {
		this.isOffline.set(offline);
	}
}

// Export singleton instance
export const eventBuffer = new EventBuffer();

// Export class for testing
export { EventBuffer };
