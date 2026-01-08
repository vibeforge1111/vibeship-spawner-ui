/**
 * Theatre Types
 *
 * Type definitions for the Spawner Theatre visualization system.
 */

export interface AgentCharacter {
	id: string;
	name: string;
	role: 'planner' | 'frontend' | 'backend' | 'database' | 'testing' | 'devops' | 'security' | 'general';
	color: string;
	position: { x: number; y: number; z: number };
	status: 'idle' | 'working' | 'celebrating' | 'error' | 'blocked' | 'handoff';
	progress: number;
	currentTask?: string;
	skillId?: string;
}

export interface TheatreState {
	connected: boolean;
	missionId: string | null;
	missionName: string | null;
	characters: AgentCharacter[];
	currentTaskId: string | null;
	progress: number;
	logs: TheatreLog[];
	handoffs: Handoff[];
}

export interface TheatreLog {
	id: string;
	timestamp: Date;
	agentId: string;
	message: string;
	type: 'info' | 'success' | 'error' | 'handoff';
}

export interface Handoff {
	id: string;
	fromAgent: string;
	toAgent: string;
	payload: string;
	timestamp: Date;
	status: 'pending' | 'complete';
}

export interface TheatreConfig {
	showGrid: boolean;
	showParticles: boolean;
	cameraMode: 'orbit' | 'follow' | 'overview';
	animationSpeed: number;
	soundEnabled: boolean;
}

// Role to color mapping (cyberpunk palette)
export const ROLE_COLORS: Record<AgentCharacter['role'], string> = {
	planner: '#6366F1',    // Indigo - The Architect
	frontend: '#EC4899',   // Pink - The Artist
	backend: '#10B981',    // Emerald - The Engineer
	database: '#8B5CF6',   // Purple - The Keeper
	testing: '#F59E0B',    // Amber - The Detective
	devops: '#06B6D4',     // Cyan - The Operator
	security: '#EF4444',   // Red - The Guardian
	general: '#6B7280'     // Gray - General Agent
};

// Role to display name mapping
export const ROLE_NAMES: Record<AgentCharacter['role'], string> = {
	planner: 'The Architect',
	frontend: 'The Artist',
	backend: 'The Engineer',
	database: 'The Keeper',
	testing: 'The Detective',
	devops: 'The Operator',
	security: 'The Guardian',
	general: 'Agent'
};

// Default character positions in the theatre
export const DEFAULT_POSITIONS: Record<AgentCharacter['role'], { x: number; y: number; z: number }> = {
	planner: { x: 0, y: 0, z: 0 },
	frontend: { x: -3, y: 0, z: 2 },
	backend: { x: 3, y: 0, z: 2 },
	database: { x: 0, y: 0, z: 4 },
	testing: { x: -3, y: 0, z: 4 },
	devops: { x: 3, y: 0, z: 4 },
	security: { x: 0, y: 0, z: 6 },
	general: { x: 0, y: 0, z: 8 }
};
