/**
 * ContentForge Queue Service
 *
 * Manages a queue of content items for sequential analysis.
 * Allows users to add multiple items while processing continues.
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { requestContentForgeAnalysis, type ContentForgeResult } from './contentforge-bridge';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Timeout for queue items (60 seconds - shorter than manual analysis) */
const QUEUE_ITEM_TIMEOUT_MS = 60000;

/** Maximum retries for failed items */
const MAX_RETRIES = 2;

/** Track retries per item */
const itemRetries = new Map<string, number>();

/** Track if processing was cancelled */
let processingCancelled = false;

// =============================================================================
// TYPES
// =============================================================================

export type QueueItemStatus = 'queued' | 'processing' | 'complete' | 'error';

export interface QueueItem {
	id: string;
	content: string;
	label: string; // Short display label (e.g., first 50 chars or tweet ID)
	status: QueueItemStatus;
	addedAt: string;
	startedAt?: string;
	completedAt?: string;
	result?: ContentForgeResult;
	error?: string;
	position: number; // Queue position (1-based for display)
	// Worker tracking
	workerAcknowledged?: boolean;
	workerProgress?: string;
}

export interface QueueState {
	items: QueueItem[];
	isProcessing: boolean;
	currentItemId: string | null;
	totalProcessed: number;
	totalErrors: number;
}

// =============================================================================
// STORES
// =============================================================================

const initialState: QueueState = {
	items: [],
	isProcessing: false,
	currentItemId: null,
	totalProcessed: 0,
	totalErrors: 0
};

const STORAGE_KEY = 'contentforge-queue';

/**
 * Load queue state from localStorage
 */
function loadFromStorage(): QueueState {
	if (!browser) return initialState;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return initialState;

		const parsed = JSON.parse(stored) as QueueState;

		// Reset processing state on load (can't resume in-progress items)
		// Mark any "processing" items as "queued" so they can be retried
		const items = parsed.items.map(item =>
			item.status === 'processing' ? { ...item, status: 'queued' as QueueItemStatus } : item
		);

		return {
			...parsed,
			items,
			isProcessing: false,
			currentItemId: null
		};
	} catch (e) {
		console.error('[ContentForgeQueue] Failed to load from storage:', e);
		return initialState;
	}
}

/**
 * Save queue state to localStorage
 */
function saveToStorage(state: QueueState): void {
	if (!browser) return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		console.error('[ContentForgeQueue] Failed to save to storage:', e);
	}
}

export const queueState = writable<QueueState>(loadFromStorage());

// Auto-save to localStorage on any change
if (browser) {
	queueState.subscribe(state => {
		saveToStorage(state);
	});
}

// Derived stores for convenience
export const queueItems = derived(queueState, $state => $state.items);
export const isQueueProcessing = derived(queueState, $state => $state.isProcessing);
export const currentQueueItem = derived(queueState, $state =>
	$state.items.find(item => item.id === $state.currentItemId) || null
);
export const pendingQueueItems = derived(queueState, $state =>
	$state.items.filter(item => item.status === 'queued')
);
export const completedQueueItems = derived(queueState, $state =>
	$state.items.filter(item => item.status === 'complete')
);
export const queueLength = derived(queueState, $state =>
	$state.items.filter(item => item.status === 'queued' || item.status === 'processing').length
);

// =============================================================================
// QUEUE FUNCTIONS
// =============================================================================

/**
 * Generate a unique ID for queue items
 */
function generateId(): string {
	return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Create a short label from content
 */
function createLabel(content: string): string {
	// Check if it's a tweet URL
	const tweetMatch = content.match(/twitter\.com\/\w+\/status\/(\d+)|x\.com\/\w+\/status\/(\d+)/);
	if (tweetMatch) {
		const tweetId = tweetMatch[1] || tweetMatch[2];
		return `Tweet ${tweetId.slice(-6)}`;
	}

	// Otherwise use first 40 chars
	const cleaned = content.replace(/\s+/g, ' ').trim();
	if (cleaned.length <= 40) return cleaned;
	return cleaned.slice(0, 37) + '...';
}

/**
 * Add item to queue
 */
export function addToQueue(content: string): QueueItem {
	const state = get(queueState);
	const pendingCount = state.items.filter(i => i.status === 'queued' || i.status === 'processing').length;

	const item: QueueItem = {
		id: generateId(),
		content,
		label: createLabel(content),
		status: 'queued',
		addedAt: new Date().toISOString(),
		position: pendingCount + 1
	};

	queueState.update(s => ({
		...s,
		items: [...s.items, item]
	}));

	console.log('[ContentForgeQueue] Added item to queue:', item.id, 'position:', item.position);

	// Start processing if not already running
	if (!state.isProcessing) {
		processQueue();
	}

	return item;
}

/**
 * Add multiple items to queue
 */
export function addBatchToQueue(contents: string[]): QueueItem[] {
	return contents.map(content => addToQueue(content));
}

/**
 * Remove item from queue (only if queued, not processing)
 */
export function removeFromQueue(itemId: string): boolean {
	const state = get(queueState);
	const item = state.items.find(i => i.id === itemId);

	if (!item || item.status === 'processing') {
		return false;
	}

	queueState.update(s => ({
		...s,
		items: s.items.filter(i => i.id !== itemId)
	}));

	// Update positions
	updatePositions();

	console.log('[ContentForgeQueue] Removed item from queue:', itemId);
	return true;
}

/**
 * Clear all completed/error items from queue
 */
export function clearCompleted(): void {
	queueState.update(s => ({
		...s,
		items: s.items.filter(i => i.status === 'queued' || i.status === 'processing')
	}));
	updatePositions();
}

/**
 * Clear entire queue (stops processing)
 */
export function clearQueue(): void {
	queueState.set(initialState);
	console.log('[ContentForgeQueue] Queue cleared');
}

/**
 * Update queue positions for display
 */
function updatePositions(): void {
	queueState.update(s => {
		let pos = 1;
		const items = s.items.map(item => {
			if (item.status === 'queued' || item.status === 'processing') {
				return { ...item, position: pos++ };
			}
			return { ...item, position: 0 };
		});
		return { ...s, items };
	});
}

/**
 * Update a specific item in the queue
 */
function updateItem(itemId: string, updates: Partial<QueueItem>): void {
	queueState.update(s => ({
		...s,
		items: s.items.map(item =>
			item.id === itemId ? { ...item, ...updates } : item
		)
	}));
}

// =============================================================================
// QUEUE PROCESSOR
// =============================================================================

let processingPromise: Promise<void> | null = null;

/**
 * Start processing the queue
 */
async function processQueue(): Promise<void> {
	// Prevent multiple processors
	if (processingPromise) {
		return processingPromise;
	}

	processingPromise = (async () => {
		queueState.update(s => ({ ...s, isProcessing: true }));

		try {
			while (true) {
				const state = get(queueState);
				const nextItem = state.items.find(item => item.status === 'queued');

				if (!nextItem) {
					console.log('[ContentForgeQueue] No more items to process');
					break;
				}

				await processItem(nextItem);
			}
		} finally {
			queueState.update(s => ({
				...s,
				isProcessing: false,
				currentItemId: null
			}));
			processingPromise = null;
			updatePositions();
		}
	})();

	return processingPromise;
}

/**
 * Poll worker status and update queue item
 */
async function pollWorkerStatus(itemId: string): Promise<{ acknowledged: boolean; progress?: string }> {
	try {
		const response = await fetch('/api/contentforge/bridge/pending');
		if (!response.ok) return { acknowledged: false };

		const data = await response.json();
		if (!data.pending) return { acknowledged: false };

		const acknowledged = data.status === 'acknowledged' || data.status === 'processing';
		const progress = data.progress?.length > 0
			? data.progress[data.progress.length - 1]?.step
			: undefined;

		return { acknowledged, progress };
	} catch {
		return { acknowledged: false };
	}
}

/**
 * Process a single queue item
 */
async function processItem(item: QueueItem): Promise<void> {
	console.log('[ContentForgeQueue] Processing item:', item.id);

	// Check if cancelled
	if (processingCancelled) {
		console.log('[ContentForgeQueue] Processing cancelled, skipping item:', item.id);
		return;
	}

	// Mark as processing
	queueState.update(s => ({
		...s,
		currentItemId: item.id
	}));

	updateItem(item.id, {
		status: 'processing',
		startedAt: new Date().toISOString(),
		workerAcknowledged: false,
		workerProgress: 'Waiting for worker...'
	});

	// Start worker status polling (every 3 seconds)
	let statusPollInterval: ReturnType<typeof setInterval> | null = null;
	statusPollInterval = setInterval(async () => {
		if (processingCancelled) {
			if (statusPollInterval) clearInterval(statusPollInterval);
			return;
		}

		const { acknowledged, progress } = await pollWorkerStatus(item.id);

		updateItem(item.id, {
			workerAcknowledged: acknowledged,
			workerProgress: acknowledged
				? (progress || 'Worker processing...')
				: 'Waiting for worker...'
		});
	}, 3000);

	try {
		// Call the actual analysis with shorter timeout for queue items
		const result = await requestContentForgeAnalysis(item.content, QUEUE_ITEM_TIMEOUT_MS);

		// Stop status polling
		if (statusPollInterval) clearInterval(statusPollInterval);

		// Check if cancelled during analysis
		if (processingCancelled) {
			console.log('[ContentForgeQueue] Processing cancelled after analysis:', item.id);
			return;
		}

		// Mark as complete
		updateItem(item.id, {
			status: 'complete',
			completedAt: new Date().toISOString(),
			result,
			workerAcknowledged: true,
			workerProgress: 'Complete'
		});

		queueState.update(s => ({
			...s,
			totalProcessed: s.totalProcessed + 1
		}));

		// Clear retry count on success
		itemRetries.delete(item.id);

		console.log('[ContentForgeQueue] Item completed:', item.id, 'score:', result.synthesis?.viralityScore);

	} catch (error) {
		// Stop status polling
		if (statusPollInterval) clearInterval(statusPollInterval);

		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		const retryCount = itemRetries.get(item.id) || 0;

		// Check if we should retry
		if (retryCount < MAX_RETRIES && !processingCancelled) {
			itemRetries.set(item.id, retryCount + 1);
			console.log('[ContentForgeQueue] Item failed, retrying:', item.id, 'attempt:', retryCount + 1);

			// Reset to queued for retry (will be picked up in next loop iteration)
			updateItem(item.id, {
				status: 'queued',
				startedAt: undefined,
				workerAcknowledged: false,
				workerProgress: undefined,
				error: `Retry ${retryCount + 1}/${MAX_RETRIES}: ${errorMessage}`
			});

			// Small delay before retry
			await new Promise(resolve => setTimeout(resolve, 2000));
			return;
		}

		// Max retries exceeded or cancelled
		updateItem(item.id, {
			status: 'error',
			completedAt: new Date().toISOString(),
			workerProgress: 'Failed',
			error: retryCount > 0 ? `Failed after ${retryCount} retries: ${errorMessage}` : errorMessage
		});

		queueState.update(s => ({
			...s,
			totalErrors: s.totalErrors + 1
		}));

		// Clear retry count
		itemRetries.delete(item.id);

		console.error('[ContentForgeQueue] Item failed:', item.id, errorMessage);

		// Clean up any pending files
		cleanupPendingFiles();
	}

	// Update positions after completion
	updatePositions();
}

/**
 * Clean up pending analysis files
 */
async function cleanupPendingFiles(): Promise<void> {
	try {
		await fetch('/api/contentforge/bridge/cleanup', { method: 'POST' });
	} catch (e) {
		console.warn('[ContentForgeQueue] Cleanup failed:', e);
	}
}

/**
 * Cancel the currently processing item
 */
export function cancelCurrentItem(): boolean {
	const state = get(queueState);

	if (!state.currentItemId || !state.isProcessing) {
		return false;
	}

	console.log('[ContentForgeQueue] Cancelling current item:', state.currentItemId);

	// Set cancelled flag
	processingCancelled = true;

	// Mark current item as error
	updateItem(state.currentItemId, {
		status: 'error',
		completedAt: new Date().toISOString(),
		error: 'Cancelled by user'
	});

	// Clear current item
	queueState.update(s => ({
		...s,
		currentItemId: null,
		isProcessing: false
	}));

	// Clean up pending files
	cleanupPendingFiles();

	// Reset cancelled flag after a short delay
	setTimeout(() => {
		processingCancelled = false;
	}, 1000);

	return true;
}

/**
 * Skip the current item and move to next
 */
export function skipCurrentItem(): boolean {
	const state = get(queueState);

	if (!state.currentItemId || !state.isProcessing) {
		return false;
	}

	console.log('[ContentForgeQueue] Skipping current item:', state.currentItemId);

	// Mark as error (skipped)
	updateItem(state.currentItemId, {
		status: 'error',
		completedAt: new Date().toISOString(),
		error: 'Skipped'
	});

	// Clean up pending files
	cleanupPendingFiles();

	// Continue processing will happen in the processQueue loop
	return true;
}

/**
 * Retry a failed item
 */
export function retryItem(itemId: string): boolean {
	const state = get(queueState);
	const item = state.items.find(i => i.id === itemId);

	if (!item || item.status !== 'error') {
		return false;
	}

	// Reset to queued
	updateItem(itemId, {
		status: 'queued',
		startedAt: undefined,
		completedAt: undefined,
		result: undefined,
		error: undefined
	});

	updatePositions();

	// Start processing if not already
	if (!get(queueState).isProcessing) {
		processQueue();
	}

	return true;
}

/**
 * Get queue statistics
 */
export function getQueueStats(): {
	total: number;
	queued: number;
	processing: number;
	completed: number;
	errors: number;
	avgScore: number;
} {
	const state = get(queueState);
	const completed = state.items.filter(i => i.status === 'complete');
	const scores = completed
		.map(i => i.result?.synthesis?.viralityScore)
		.filter((s): s is number => typeof s === 'number');

	return {
		total: state.items.length,
		queued: state.items.filter(i => i.status === 'queued').length,
		processing: state.items.filter(i => i.status === 'processing').length,
		completed: completed.length,
		errors: state.items.filter(i => i.status === 'error').length,
		avgScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
	};
}

/**
 * Resume processing if there are queued items (call on page load)
 */
export function resumeQueueProcessing(): void {
	const state = get(queueState);
	const hasQueued = state.items.some(i => i.status === 'queued');

	if (hasQueued && !state.isProcessing) {
		console.log('[ContentForgeQueue] Resuming queue processing...');
		processQueue();
	}
}

/**
 * Smart analyze: If queue is empty, analyze directly. If queue has items, add to queue.
 * Returns the item (if queued) or null (if analyzing directly)
 */
export function smartAnalyze(content: string): { queued: boolean; item?: QueueItem } {
	const state = get(queueState);
	const hasPendingItems = state.items.some(i => i.status === 'queued' || i.status === 'processing');

	if (hasPendingItems) {
		// Add to queue
		const item = addToQueue(content);
		return { queued: true, item };
	} else {
		// Add to queue and start (will process immediately since queue is empty)
		const item = addToQueue(content);
		return { queued: false, item };
	}
}
