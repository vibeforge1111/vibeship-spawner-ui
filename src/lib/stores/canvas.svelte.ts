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

export interface CanvasState {
	nodes: CanvasNode[];
	connections: Connection[];
	selectedNodeId: string | null;
	zoom: number;
	pan: { x: number; y: number };
}

const initialState: CanvasState = {
	nodes: [],
	connections: [],
	selectedNodeId: null,
	zoom: 1,
	pan: { x: 0, y: 0 }
};

export const canvasState = writable<CanvasState>(initialState);
export const nodes = derived(canvasState, ($state) => $state.nodes);
export const connections = derived(canvasState, ($state) => $state.connections);
export const selectedNodeId = derived(canvasState, ($state) => $state.selectedNodeId);

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
