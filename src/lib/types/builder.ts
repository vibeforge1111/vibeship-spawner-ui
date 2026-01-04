// Builder types for workflow templates and agent bundles

export interface TemplateNode {
	skillId: string;
	offsetX: number;
	offsetY: number;
}

export interface TemplateConnection {
	sourceIndex: number;
	targetIndex: number;
	sourcePortId?: string;
	targetPortId?: string;
}

export interface WorkflowTemplate {
	id: string;
	name: string;
	description: string;
	category: 'saas' | 'marketplace' | 'ai-app' | 'web3' | 'tool' | 'general';
	icon: string;
	nodes: TemplateNode[];
	connections: TemplateConnection[];
	suggestedFor?: string[];
}

export interface AgentBundle {
	id: string;
	name: string;
	description: string;
	icon: string;
	skillIds: string[];
	category: string;
	tier: 'free' | 'premium';
}

export type ProjectType = 'saas' | 'marketplace' | 'ai-app' | 'web3' | 'tool' | 'other';

export interface ProjectTypeOption {
	id: ProjectType;
	label: string;
	icon: string;
}
