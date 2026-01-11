/**
 * ContentForge Queue Service
 *
 * Manages a queue of content items for sequential analysis.
 * Allows users to add multiple items while processing continues.
 */

import { writable, derived, get } from 'svelte/store';
import { requestContentForgeAnalysis, type ContentForgeResult } from './contentforge-bridge';

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

export const queueState = writable<QueueState>(initialState);

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
 * Process a single queue item
 */
async function processItem(item: QueueItem): Promise<void> {
	console.log('[ContentForgeQueue] Processing item:', item.id);

	// Mark as processing
	queueState.update(s => ({
		...s,
		currentItemId: item.id
	}));

	updateItem(item.id, {
		status: 'processing',
		startedAt: new Date().toISOString()
	});

	try {
		// Call the actual analysis
		const result = await requestContentForgeAnalysis(item.content);

		// Mark as complete
		updateItem(item.id, {
			status: 'complete',
			completedAt: new Date().toISOString(),
			result
		});

		queueState.update(s => ({
			...s,
			totalProcessed: s.totalProcessed + 1
		}));

		console.log('[ContentForgeQueue] Item completed:', item.id, 'score:', result.synthesis?.viralityScore);

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		updateItem(item.id, {
			status: 'error',
			completedAt: new Date().toISOString(),
			error: errorMessage
		});

		queueState.update(s => ({
			...s,
			totalErrors: s.totalErrors + 1
		}));

		console.error('[ContentForgeQueue] Item failed:', item.id, errorMessage);
	}

	// Update positions after completion
	updatePositions();
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
