/**
 * Pipeline Manager Store
 *
 * Manages multiple named canvas pipelines with save/load/switch functionality.
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

const PIPELINES_KEY = 'spawner-pipelines';
const PIPELINE_PREFIX = 'spawner-pipeline-';

export interface PipelineMetadata {
	id: string;
	name: string;
	description?: string;
	nodeCount: number;
	connectionCount: number;
	createdAt: string;
	updatedAt: string;
	thumbnail?: string; // Could store a mini-preview later
}

export interface PipelineData {
	nodes: any[];
	connections: any[];
	zoom: number;
	pan: { x: number; y: number };
}

interface PipelinesState {
	pipelines: PipelineMetadata[];
	activePipelineId: string | null;
	isLoading: boolean;
}

const initialState: PipelinesState = {
	pipelines: [],
	activePipelineId: null,
	isLoading: true
};

// Create the store
export const pipelinesState = writable<PipelinesState>(initialState);

// Derived stores for convenience
export const pipelines = derived(pipelinesState, $state => $state.pipelines);
export const activePipelineId = derived(pipelinesState, $state => $state.activePipelineId);
export const activePipeline = derived(pipelinesState, $state =>
	$state.pipelines.find(p => p.id === $state.activePipelineId) || null
);
export const isLoading = derived(pipelinesState, $state => $state.isLoading);

/**
 * Generate a unique pipeline ID
 */
function generateId(): string {
	return `pipe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Get storage key for a pipeline's data
 */
function getPipelineStorageKey(id: string): string {
	return `${PIPELINE_PREFIX}${id}`;
}

/**
 * Save pipelines registry to localStorage
 */
function saveRegistry(): void {
	if (!browser) return;
	const state = get(pipelinesState);
	localStorage.setItem(PIPELINES_KEY, JSON.stringify({
		pipelines: state.pipelines,
		activePipelineId: state.activePipelineId
	}));
}

/**
 * Initialize pipelines from localStorage
 */
export function initPipelines(): void {
	if (!browser) return;

	try {
		const saved = localStorage.getItem(PIPELINES_KEY);

		if (saved) {
			const data = JSON.parse(saved);
			pipelinesState.update(state => ({
				...state,
				pipelines: data.pipelines || [],
				activePipelineId: data.activePipelineId || null,
				isLoading: false
			}));
		} else {
			// First time - migrate from old single canvas if exists
			const oldCanvas = localStorage.getItem('spawner-canvas-state');
			if (oldCanvas) {
				const canvasData = JSON.parse(oldCanvas);
				const newPipeline = createPipelineFromData('My First Pipeline', canvasData);
				pipelinesState.update(state => ({
					...state,
					pipelines: [newPipeline.metadata],
					activePipelineId: newPipeline.metadata.id,
					isLoading: false
				}));
				// Save the pipeline data
				localStorage.setItem(getPipelineStorageKey(newPipeline.metadata.id), JSON.stringify(newPipeline.data));
				saveRegistry();
				// Clean up old format
				localStorage.removeItem('spawner-canvas-state');
			} else {
				// Create a default empty pipeline
				const defaultPipeline = createNewPipeline('Untitled Pipeline');
				pipelinesState.update(state => ({
					...state,
					isLoading: false
				}));
			}
		}
	} catch (e) {
		console.error('Failed to load pipelines:', e);
		pipelinesState.update(state => ({ ...state, isLoading: false }));
	}
}

/**
 * Create a new pipeline from existing canvas data
 */
function createPipelineFromData(name: string, canvasData: any): { metadata: PipelineMetadata; data: PipelineData } {
	const id = generateId();
	const now = new Date().toISOString();

	return {
		metadata: {
			id,
			name,
			nodeCount: canvasData.nodes?.length || 0,
			connectionCount: canvasData.connections?.length || 0,
			createdAt: now,
			updatedAt: now
		},
		data: {
			nodes: canvasData.nodes || [],
			connections: canvasData.connections || [],
			zoom: canvasData.zoom || 1,
			pan: canvasData.pan || { x: 0, y: 0 }
		}
	};
}

/**
 * Create a new empty pipeline
 */
export function createNewPipeline(name: string = 'Untitled Pipeline'): PipelineMetadata {
	if (!browser) throw new Error('Cannot create pipeline on server');

	const id = generateId();
	const now = new Date().toISOString();

	const metadata: PipelineMetadata = {
		id,
		name,
		nodeCount: 0,
		connectionCount: 0,
		createdAt: now,
		updatedAt: now
	};

	const data: PipelineData = {
		nodes: [],
		connections: [],
		zoom: 1,
		pan: { x: 0, y: 0 }
	};

	// Save pipeline data
	localStorage.setItem(getPipelineStorageKey(id), JSON.stringify(data));

	// Update registry
	pipelinesState.update(state => ({
		...state,
		pipelines: [...state.pipelines, metadata],
		activePipelineId: id
	}));
	saveRegistry();

	return metadata;
}

/**
 * Switch to a different pipeline
 */
export function switchPipeline(id: string): PipelineData | null {
	if (!browser) return null;

	const state = get(pipelinesState);
	const pipeline = state.pipelines.find(p => p.id === id);

	if (!pipeline) {
		console.error('Pipeline not found:', id);
		return null;
	}

	// Save current pipeline first
	saveCurrentPipeline();

	// Load the new pipeline data
	try {
		const saved = localStorage.getItem(getPipelineStorageKey(id));
		if (saved) {
			const data: PipelineData = JSON.parse(saved);

			// Update active pipeline
			pipelinesState.update(state => ({
				...state,
				activePipelineId: id
			}));
			saveRegistry();

			return data;
		}
	} catch (e) {
		console.error('Failed to load pipeline:', e);
	}

	return null;
}

/**
 * Save current pipeline data
 */
export function saveCurrentPipeline(canvasData?: { nodes: any[]; connections: any[]; zoom: number; pan: { x: number; y: number } }): void {
	if (!browser) return;

	const state = get(pipelinesState);
	if (!state.activePipelineId) return;

	// If no canvas data provided, we can't save (caller should provide it)
	if (!canvasData) return;

	const data: PipelineData = {
		nodes: canvasData.nodes,
		connections: canvasData.connections,
		zoom: canvasData.zoom,
		pan: canvasData.pan
	};

	// Save pipeline data
	localStorage.setItem(getPipelineStorageKey(state.activePipelineId), JSON.stringify(data));

	// Update metadata
	pipelinesState.update(s => ({
		...s,
		pipelines: s.pipelines.map(p =>
			p.id === state.activePipelineId
				? {
					...p,
					nodeCount: canvasData.nodes.length,
					connectionCount: canvasData.connections.length,
					updatedAt: new Date().toISOString()
				}
				: p
		)
	}));
	saveRegistry();
}

/**
 * Rename a pipeline
 */
export function renamePipeline(id: string, newName: string): void {
	if (!browser) return;

	pipelinesState.update(state => ({
		...state,
		pipelines: state.pipelines.map(p =>
			p.id === id ? { ...p, name: newName, updatedAt: new Date().toISOString() } : p
		)
	}));
	saveRegistry();
}

/**
 * Duplicate a pipeline
 */
export function duplicatePipeline(id: string): PipelineMetadata | null {
	if (!browser) return null;

	const state = get(pipelinesState);
	const original = state.pipelines.find(p => p.id === id);

	if (!original) return null;

	try {
		const originalData = localStorage.getItem(getPipelineStorageKey(id));
		if (!originalData) return null;

		const newId = generateId();
		const now = new Date().toISOString();

		const newMetadata: PipelineMetadata = {
			...original,
			id: newId,
			name: `${original.name} (Copy)`,
			createdAt: now,
			updatedAt: now
		};

		// Save duplicated data
		localStorage.setItem(getPipelineStorageKey(newId), originalData);

		// Update registry
		pipelinesState.update(state => ({
			...state,
			pipelines: [...state.pipelines, newMetadata]
		}));
		saveRegistry();

		return newMetadata;
	} catch (e) {
		console.error('Failed to duplicate pipeline:', e);
		return null;
	}
}

/**
 * Delete a pipeline
 */
export function deletePipeline(id: string): boolean {
	if (!browser) return false;

	const state = get(pipelinesState);

	// Don't delete the last pipeline
	if (state.pipelines.length <= 1) {
		console.warn('Cannot delete the last pipeline');
		return false;
	}

	// Remove pipeline data
	localStorage.removeItem(getPipelineStorageKey(id));

	// Update registry
	pipelinesState.update(s => {
		const newPipelines = s.pipelines.filter(p => p.id !== id);
		const newActiveId = s.activePipelineId === id
			? newPipelines[0]?.id || null
			: s.activePipelineId;

		return {
			...s,
			pipelines: newPipelines,
			activePipelineId: newActiveId
		};
	});
	saveRegistry();

	return true;
}

/**
 * Load a specific pipeline's data
 */
export function loadPipelineData(id: string): PipelineData | null {
	if (!browser) return null;

	try {
		const saved = localStorage.getItem(getPipelineStorageKey(id));
		if (saved) {
			return JSON.parse(saved);
		}
	} catch (e) {
		console.error('Failed to load pipeline data:', e);
	}

	return null;
}

/**
 * Get the active pipeline's data
 */
export function getActivePipelineData(): PipelineData | null {
	const state = get(pipelinesState);
	if (!state.activePipelineId) return null;
	return loadPipelineData(state.activePipelineId);
}

/**
 * Update pipeline description
 */
export function updatePipelineDescription(id: string, description: string): void {
	if (!browser) return;

	pipelinesState.update(state => ({
		...state,
		pipelines: state.pipelines.map(p =>
			p.id === id ? { ...p, description, updatedAt: new Date().toISOString() } : p
		)
	}));
	saveRegistry();
}
