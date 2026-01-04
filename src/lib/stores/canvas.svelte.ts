import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { Skill } from './skills.svelte';

const STORAGE_KEY = 'spawner-canvas-state';

export interface CanvasNode {
	id: string;
	skillId: string;
	skill: Skill;
	position: { x: number; y: number };
	status?: 'idle' | 'running' | 'success' | 'error';
}

export interface Connection {
	id: string;
	sourceNodeId: string;
	sourcePortId: string;
	targetNodeId: string;
	targetPortId: string;
}

export interface DraggingConnection {
	sourceNodeId: string;
	sourcePortId: string;
	sourcePortType: 'input' | 'output';
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
}

export interface CanvasState {
	nodes: CanvasNode[];
	connections: Connection[];
	selectedNodeId: string | null;
	zoom: number;
	pan: { x: number; y: number };
	draggingConnection: DraggingConnection | null;
}

const initialState: CanvasState = {
	nodes: [],
	connections: [],
	selectedNodeId: null,
	zoom: 1,
	pan: { x: 0, y: 0 },
	draggingConnection: null
};

export const canvasState = writable<CanvasState>(initialState);
export const nodes = derived(canvasState, ($state) => $state.nodes);
export const connections = derived(canvasState, ($state) => $state.connections);
export const selectedNodeId = derived(canvasState, ($state) => $state.selectedNodeId);
export const draggingConnection = derived(canvasState, ($state) => $state.draggingConnection);

export const selectedNode = derived(canvasState, ($state) => {
	if (!$state.selectedNodeId) return null;
	return $state.nodes.find((n) => n.id === $state.selectedNodeId) || null;
});

let nodeIdCounter = 0;

export function addNode(skill: Skill, position: { x: number; y: number }): string {
	nodeIdCounter++;
	const id = 'node-' + nodeIdCounter + '-' + Math.random().toString(36).slice(2, 8);
	const node: CanvasNode = {
		id,
		skillId: skill.id,
		skill,
		position,
		status: 'idle'
	};

	canvasState.update((state) => ({
		...state,
		nodes: [...state.nodes, node]
	}));

	return id;
}

export function removeNode(nodeId: string) {
	canvasState.update((state) => ({
		...state,
		nodes: state.nodes.filter((n) => n.id !== nodeId),
		connections: state.connections.filter(
			(c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId
		),
		selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
	}));
}

export function updateNodePosition(nodeId: string, position: { x: number; y: number }) {
	canvasState.update((state) => ({
		...state,
		nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n))
	}));
}

export function selectNode(nodeId: string | null) {
	canvasState.update((state) => ({
		...state,
		selectedNodeId: nodeId
	}));
}

export function addConnection(
	sourceNodeId: string,
	sourcePortId: string,
	targetNodeId: string,
	targetPortId: string
): string {
	const id = 'conn-' + Math.random().toString(36).slice(2, 10);
	const connection: Connection = {
		id,
		sourceNodeId,
		sourcePortId,
		targetNodeId,
		targetPortId
	};

	canvasState.update((state) => ({
		...state,
		connections: [...state.connections, connection]
	}));

	return id;
}

export function removeConnection(connectionId: string) {
	canvasState.update((state) => ({
		...state,
		connections: state.connections.filter((c) => c.id !== connectionId)
	}));
}

export function setZoom(zoom: number) {
	canvasState.update((state) => ({
		...state,
		zoom: Math.max(0.25, Math.min(2, zoom))
	}));
}

export function setPan(pan: { x: number; y: number }) {
	canvasState.update((state) => ({
		...state,
		pan
	}));
}

export function startConnectionDrag(
	sourceNodeId: string,
	sourcePortId: string,
	sourcePortType: 'input' | 'output',
	startX: number,
	startY: number
) {
	canvasState.update((state) => ({
		...state,
		draggingConnection: {
			sourceNodeId,
			sourcePortId,
			sourcePortType,
			startX,
			startY,
			currentX: startX,
			currentY: startY
		}
	}));
}

export function updateConnectionDrag(currentX: number, currentY: number) {
	canvasState.update((state) => {
		if (!state.draggingConnection) return state;
		return {
			...state,
			draggingConnection: {
				...state.draggingConnection,
				currentX,
				currentY
			}
		};
	});
}

export function endConnectionDrag() {
	canvasState.update((state) => ({
		...state,
		draggingConnection: null
	}));
}

export function completeConnection(targetNodeId: string, targetPortId: string): boolean {
	const state = get(canvasState);
	const drag = state.draggingConnection;
	if (!drag) return false;
	
	// Cannot connect to same node
	if (drag.sourceNodeId === targetNodeId) {
		endConnectionDrag();
		return false;
	}
	
	// Check if connection already exists
	const exists = state.connections.some(
		(c) =>
			(c.sourceNodeId === drag.sourceNodeId && c.targetNodeId === targetNodeId) ||
			(c.sourceNodeId === targetNodeId && c.targetNodeId === drag.sourceNodeId)
	);
	if (exists) {
		endConnectionDrag();
		return false;
	}
	
	// Output connects to input
	if (drag.sourcePortType === 'output') {
		addConnection(drag.sourceNodeId, drag.sourcePortId, targetNodeId, targetPortId);
	} else {
		// Input connects from output (reverse)
		addConnection(targetNodeId, targetPortId, drag.sourceNodeId, drag.sourcePortId);
	}
	
	endConnectionDrag();
	return true;
}

export function clearCanvas() {
	canvasState.set(initialState);
	nodeIdCounter = 0;
}

export function getNode(nodeId: string): CanvasNode | undefined {
	return get(canvasState).nodes.find((n) => n.id === nodeId);
}

export function getNodeConnections(nodeId: string): Connection[] {
	return get(canvasState).connections.filter(
		(c) => c.sourceNodeId === nodeId || c.targetNodeId === nodeId
	);
}

export function updateNodeStatus(nodeId: string, status: CanvasNode['status']) {
	canvasState.update((state) => ({
		...state,
		nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, status } : n))
	}));
}

export function resetAllNodeStatus() {
	canvasState.update((state) => ({
		...state,
		nodes: state.nodes.map((n) => ({ ...n, status: 'idle' as const }))
	}));
}

// Persistence functions

interface SavedCanvasState {
	nodes: CanvasNode[];
	connections: Connection[];
	zoom: number;
	pan: { x: number; y: number };
	savedAt: string;
}

/**
 * Save canvas state to localStorage
 */
export function saveCanvas(): boolean {
	if (!browser) return false;

	try {
		const state = get(canvasState);
		const saveData: SavedCanvasState = {
			nodes: state.nodes,
			connections: state.connections,
			zoom: state.zoom,
			pan: state.pan,
			savedAt: new Date().toISOString()
		};

		localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
		return true;
	} catch (e) {
		console.error('Failed to save canvas:', e);
		return false;
	}
}

/**
 * Load canvas state from localStorage
 */
export function loadCanvas(): boolean {
	if (!browser) return false;

	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (!saved) return false;

		const saveData: SavedCanvasState = JSON.parse(saved);

		// Validate the data structure
		if (!saveData.nodes || !Array.isArray(saveData.nodes)) {
			return false;
		}

		// Reset node counter based on loaded nodes
		const maxId = saveData.nodes.reduce((max, node) => {
			const match = node.id.match(/node-(\d+)-/);
			if (match) {
				return Math.max(max, parseInt(match[1], 10));
			}
			return max;
		}, 0);
		nodeIdCounter = maxId;

		canvasState.set({
			nodes: saveData.nodes.map((n) => ({ ...n, status: 'idle' as const })),
			connections: saveData.connections || [],
			selectedNodeId: null,
			zoom: saveData.zoom || 1,
			pan: saveData.pan || { x: 0, y: 0 },
			draggingConnection: null
		});

		return true;
	} catch (e) {
		console.error('Failed to load canvas:', e);
		return false;
	}
}

/**
 * Check if there's saved canvas state
 */
export function hasSavedCanvas(): boolean {
	if (!browser) return false;

	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		return saved !== null;
	} catch {
		return false;
	}
}

/**
 * Get the saved canvas timestamp
 */
export function getSavedCanvasInfo(): { savedAt: Date; nodeCount: number } | null {
	if (!browser) return null;

	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (!saved) return null;

		const saveData: SavedCanvasState = JSON.parse(saved);
		return {
			savedAt: new Date(saveData.savedAt),
			nodeCount: saveData.nodes?.length || 0
		};
	} catch {
		return null;
	}
}

/**
 * Delete saved canvas state
 */
export function deleteSavedCanvas(): void {
	if (!browser) return;

	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch (e) {
		console.error('Failed to delete saved canvas:', e);
	}
}

/**
 * Auto-save: Subscribe to changes and save
 */
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

export function enableAutoSave(debounceMs = 1000): () => void {
	const unsubscribe = canvasState.subscribe(() => {
		if (autoSaveTimeout) {
			clearTimeout(autoSaveTimeout);
		}

		autoSaveTimeout = setTimeout(() => {
			saveCanvas();
		}, debounceMs);
	});

	return () => {
		unsubscribe();
		if (autoSaveTimeout) {
			clearTimeout(autoSaveTimeout);
		}
	};
}
