import { writable, derived, get } from 'svelte/store';
import type { Skill } from './skills.svelte';

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
