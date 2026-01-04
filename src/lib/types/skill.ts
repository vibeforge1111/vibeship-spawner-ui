export type PortType = 'text' | 'number' | 'boolean' | 'object' | 'array' | 'any' | 'skill';

export interface Port {
	id: string;
	label: string;
	type: PortType;
	required?: boolean;
	skillId?: string; // For handoff ports - the full skill ID to spawn
}

export interface SharpEdge {
	id: string;
	message: string;
	severity: 'warning' | 'error' | 'info';
	autofix?: string;
}

export interface SkillNodeData {
	id: string;
	name: string;
	description?: string;
	icon?: string;
	category: string;
	inputs?: Port[];
	outputs?: Port[];
	sharpEdges?: SharpEdge[];
	config?: Record<string, unknown>;
}

export interface Connection {
	id: string;
	sourceNodeId: string;
	sourcePortId: string;
	targetNodeId: string;
	targetPortId: string;
	type: 'data' | 'control' | 'skill' | 'error' | 'ghost';
}

export interface CanvasState {
	nodes: SkillNodeData[];
	connections: Connection[];
	selectedNodeId: string | null;
	zoom: number;
	pan: { x: number; y: number };
}

export interface Project {
	id: string;
	name: string;
	description?: string;
	canvas: CanvasState;
	createdAt: string;
	updatedAt: string;
}
