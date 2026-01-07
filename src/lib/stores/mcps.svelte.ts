/**
 * MCP Store - State management for MCPs in Spawner UI
 *
 * Manages:
 * - Available MCP definitions
 * - Connected MCP instances
 * - MCP feedback to Mind
 * - Skill/Team MCP bindings
 */

import { writable, derived, get } from 'svelte/store';
import type {
	MCPDefinition,
	MCPInstance,
	MCPFeedback,
	MCPCategory,
	MCPCapability,
	MCPConfig,
	SkillMCPBinding,
	TeamMCPBinding,
	MCPConnectionStatus,
	BUILTIN_MCPS
} from '$lib/types/mcp';
import { BUILTIN_MCPS as builtinMCPs } from '$lib/types/mcp';

// ============================================
// State Interface
// ============================================

export interface MCPState {
	// Available MCPs
	definitions: MCPDefinition[];
	loadingDefinitions: boolean;

	// Connected instances
	instances: MCPInstance[];
	loadingInstances: boolean;

	// Feedback queue
	pendingFeedback: MCPFeedback[];
	processedFeedback: MCPFeedback[];
	feedbackLoading: boolean;

	// Bindings
	skillBindings: SkillMCPBinding[];
	teamBindings: TeamMCPBinding[];

	// UI state
	selectedMCPId: string | null;
	filterCategory: MCPCategory | 'all';
	searchQuery: string;

	// Errors
	error: string | null;
}

const initialState: MCPState = {
	definitions: builtinMCPs,
	loadingDefinitions: false,
	instances: [],
	loadingInstances: false,
	pendingFeedback: [],
	processedFeedback: [],
	feedbackLoading: false,
	skillBindings: [],
	teamBindings: [],
	selectedMCPId: null,
	filterCategory: 'all',
	searchQuery: '',
	error: null
};

// ============================================
// Main Store
// ============================================

export const mcpStore = writable<MCPState>(initialState);

// ============================================
// Derived Stores
// ============================================

// Filtered definitions based on category and search
export const filteredDefinitions = derived(mcpStore, ($state) => {
	let filtered = $state.definitions;

	// Filter by category
	if ($state.filterCategory !== 'all') {
		filtered = filtered.filter((d) => d.category === $state.filterCategory);
	}

	// Filter by search query
	if ($state.searchQuery.trim()) {
		const query = $state.searchQuery.toLowerCase();
		filtered = filtered.filter(
			(d) =>
				d.name.toLowerCase().includes(query) ||
				d.description.toLowerCase().includes(query) ||
				d.tags.some((t) => t.toLowerCase().includes(query))
		);
	}

	return filtered;
});

// Connected instances
export const connectedInstances = derived(mcpStore, ($state) =>
	$state.instances.filter((i) => i.status === 'connected')
);

// Instances by status
export const instancesByStatus = derived(mcpStore, ($state) => {
	const byStatus: Record<MCPConnectionStatus, MCPInstance[]> = {
		connected: [],
		connecting: [],
		disconnected: [],
		error: []
	};

	for (const instance of $state.instances) {
		byStatus[instance.status].push(instance);
	}

	return byStatus;
});

// Feedback MCPs (ones that can provide feedback to Mind)
export const feedbackMCPs = derived(mcpStore, ($state) =>
	$state.definitions.filter((d) => d.feedbackTypes && d.feedbackTypes.length > 0)
);

// Pending feedback count
export const pendingFeedbackCount = derived(mcpStore, ($state) => $state.pendingFeedback.length);

// MCPs attached to a specific skill
export const getMCPsForSkill = (skillId: string) =>
	derived(mcpStore, ($state) => {
		const bindingIds = $state.skillBindings
			.filter((b) => b.skillId === skillId)
			.map((b) => b.mcpId);

		return $state.instances.filter((i) => bindingIds.includes(i.id));
	});

// MCPs attached to a specific team
export const getMCPsForTeam = (teamId: string) =>
	derived(mcpStore, ($state) => {
		const bindingIds = $state.teamBindings.filter((b) => b.teamId === teamId).map((b) => b.mcpId);

		return $state.instances.filter((i) => bindingIds.includes(i.id));
	});

// ============================================
// Actions
// ============================================

/**
 * Load MCP definitions (built-in + custom)
 */
export function loadDefinitions() {
	mcpStore.update((s) => ({
		...s,
		loadingDefinitions: true,
		error: null
	}));

	// For now, just use built-in MCPs
	// Later: fetch from registry or local storage
	mcpStore.update((s) => ({
		...s,
		definitions: builtinMCPs,
		loadingDefinitions: false
	}));
}

/**
 * Add a custom MCP definition
 */
export function addDefinition(definition: MCPDefinition) {
	mcpStore.update((s) => ({
		...s,
		definitions: [...s.definitions, definition]
	}));
}

/**
 * Create a new MCP instance (connect an MCP)
 */
export function createInstance(
	definitionId: string,
	config: MCPConfig = {},
	name?: string
): MCPInstance {
	const definition = get(mcpStore).definitions.find((d) => d.id === definitionId);
	if (!definition) {
		throw new Error(`MCP definition not found: ${definitionId}`);
	}

	const instance: MCPInstance = {
		id: `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		definitionId,
		name: name || definition.name,
		status: 'disconnected',
		config,
		usageCount: 0,
		feedbackCount: 0,
		attachedToSkills: [],
		attachedToTeams: [],
		attachedToMissions: [],
		autoFeedback: true,
		enabled: true,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};

	mcpStore.update((s) => ({
		...s,
		instances: [...s.instances, instance]
	}));

	return instance;
}

/**
 * Connect an MCP instance
 */
export async function connectInstance(instanceId: string): Promise<boolean> {
	mcpStore.update((s) => ({
		...s,
		instances: s.instances.map((i) =>
			i.id === instanceId ? { ...i, status: 'connecting' as MCPConnectionStatus } : i
		)
	}));

	// Simulate connection (replace with actual MCP connection logic)
	await new Promise((r) => setTimeout(r, 1000));

	// For now, always succeed
	mcpStore.update((s) => ({
		...s,
		instances: s.instances.map((i) =>
			i.id === instanceId
				? {
						...i,
						status: 'connected' as MCPConnectionStatus,
						lastConnected: new Date().toISOString(),
						updatedAt: new Date().toISOString()
					}
				: i
		)
	}));

	return true;
}

/**
 * Disconnect an MCP instance
 */
export function disconnectInstance(instanceId: string) {
	mcpStore.update((s) => ({
		...s,
		instances: s.instances.map((i) =>
			i.id === instanceId
				? {
						...i,
						status: 'disconnected' as MCPConnectionStatus,
						updatedAt: new Date().toISOString()
					}
				: i
		)
	}));
}

/**
 * Remove an MCP instance
 */
export function removeInstance(instanceId: string) {
	mcpStore.update((s) => ({
		...s,
		instances: s.instances.filter((i) => i.id !== instanceId),
		skillBindings: s.skillBindings.filter((b) => b.mcpId !== instanceId),
		teamBindings: s.teamBindings.filter((b) => b.mcpId !== instanceId)
	}));
}

/**
 * Update instance config
 */
export function updateInstanceConfig(instanceId: string, config: Partial<MCPConfig>) {
	mcpStore.update((s) => ({
		...s,
		instances: s.instances.map((i) =>
			i.id === instanceId
				? {
						...i,
						config: { ...i.config, ...config },
						updatedAt: new Date().toISOString()
					}
				: i
		)
	}));
}

/**
 * Attach MCP to a skill
 */
export function attachToSkill(
	mcpId: string,
	skillId: string,
	options: {
		bindingType?: 'required' | 'recommended' | 'optional';
		purpose?: string;
		autoAttach?: boolean;
		toolsUsed?: string[];
	} = {}
) {
	const binding: SkillMCPBinding = {
		mcpId,
		skillId,
		bindingType: options.bindingType || 'optional',
		purpose: options.purpose || '',
		autoAttach: options.autoAttach ?? false,
		toolsUsed: options.toolsUsed || []
	};

	mcpStore.update((s) => ({
		...s,
		skillBindings: [...s.skillBindings.filter((b) => !(b.mcpId === mcpId && b.skillId === skillId)), binding],
		instances: s.instances.map((i) =>
			i.id === mcpId
				? {
						...i,
						attachedToSkills: [...new Set([...i.attachedToSkills, skillId])],
						updatedAt: new Date().toISOString()
					}
				: i
		)
	}));
}

/**
 * Detach MCP from a skill
 */
export function detachFromSkill(mcpId: string, skillId: string) {
	mcpStore.update((s) => ({
		...s,
		skillBindings: s.skillBindings.filter((b) => !(b.mcpId === mcpId && b.skillId === skillId)),
		instances: s.instances.map((i) =>
			i.id === mcpId
				? {
						...i,
						attachedToSkills: i.attachedToSkills.filter((id) => id !== skillId),
						updatedAt: new Date().toISOString()
					}
				: i
		)
	}));
}

/**
 * Attach MCP to a team
 */
export function attachToTeam(
	mcpId: string,
	teamId: string,
	options: {
		sharedAcrossTeam?: boolean;
		purpose?: string;
		feedbackAggregation?: boolean;
	} = {}
) {
	const binding: TeamMCPBinding = {
		mcpId,
		teamId,
		sharedAcrossTeam: options.sharedAcrossTeam ?? true,
		purpose: options.purpose || '',
		feedbackAggregation: options.feedbackAggregation ?? true
	};

	mcpStore.update((s) => ({
		...s,
		teamBindings: [...s.teamBindings.filter((b) => !(b.mcpId === mcpId && b.teamId === teamId)), binding],
		instances: s.instances.map((i) =>
			i.id === mcpId
				? {
						...i,
						attachedToTeams: [...new Set([...i.attachedToTeams, teamId])],
						updatedAt: new Date().toISOString()
					}
				: i
		)
	}));
}

/**
 * Detach MCP from a team
 */
export function detachFromTeam(mcpId: string, teamId: string) {
	mcpStore.update((s) => ({
		...s,
		teamBindings: s.teamBindings.filter((b) => !(b.mcpId === mcpId && b.teamId === teamId)),
		instances: s.instances.map((i) =>
			i.id === mcpId
				? {
						...i,
						attachedToTeams: i.attachedToTeams.filter((id) => id !== teamId),
						updatedAt: new Date().toISOString()
					}
				: i
		)
	}));
}

/**
 * Add feedback to queue
 */
export function addFeedback(feedback: Omit<MCPFeedback, 'id' | 'createdAt' | 'status'>) {
	const newFeedback: MCPFeedback = {
		...feedback,
		id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
		status: 'pending',
		createdAt: new Date().toISOString()
	};

	mcpStore.update((s) => ({
		...s,
		pendingFeedback: [...s.pendingFeedback, newFeedback]
	}));

	return newFeedback;
}

/**
 * Process feedback (send to Mind)
 */
export async function processFeedback(feedbackId: string): Promise<boolean> {
	const state = get(mcpStore);
	const feedback = state.pendingFeedback.find((f) => f.id === feedbackId);

	if (!feedback) return false;

	mcpStore.update((s) => ({
		...s,
		feedbackLoading: true
	}));

	try {
		// TODO: Actually send to Mind API
		// For now, just mark as processed
		const processedFeedback: MCPFeedback = {
			...feedback,
			status: 'processed',
			processedAt: new Date().toISOString()
		};

		mcpStore.update((s) => ({
			...s,
			pendingFeedback: s.pendingFeedback.filter((f) => f.id !== feedbackId),
			processedFeedback: [...s.processedFeedback, processedFeedback],
			feedbackLoading: false,
			instances: s.instances.map((i) =>
				i.id === feedback.mcpId
					? {
							...i,
							feedbackCount: i.feedbackCount + 1,
							updatedAt: new Date().toISOString()
						}
					: i
			)
		}));

		return true;
	} catch (e) {
		mcpStore.update((s) => ({
			...s,
			feedbackLoading: false,
			error: e instanceof Error ? e.message : 'Failed to process feedback'
		}));
		return false;
	}
}

/**
 * Process all pending feedback
 */
export async function processAllFeedback(): Promise<number> {
	const state = get(mcpStore);
	let processed = 0;

	for (const feedback of state.pendingFeedback) {
		const success = await processFeedback(feedback.id);
		if (success) processed++;
	}

	return processed;
}

// ============================================
// UI Actions
// ============================================

export function setSelectedMCP(mcpId: string | null) {
	mcpStore.update((s) => ({ ...s, selectedMCPId: mcpId }));
}

export function setFilterCategory(category: MCPCategory | 'all') {
	mcpStore.update((s) => ({ ...s, filterCategory: category }));
}

export function setSearchQuery(query: string) {
	mcpStore.update((s) => ({ ...s, searchQuery: query }));
}

export function clearError() {
	mcpStore.update((s) => ({ ...s, error: null }));
}

// ============================================
// Persistence
// ============================================

const STORAGE_KEY = 'spawner_mcps';

export function saveToStorage() {
	const state = get(mcpStore);
	const toSave = {
		instances: state.instances,
		skillBindings: state.skillBindings,
		teamBindings: state.teamBindings
	};

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
	} catch (e) {
		console.error('Failed to save MCP state:', e);
	}
}

export function loadFromStorage() {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const data = JSON.parse(saved);
			mcpStore.update((s) => ({
				...s,
				instances: data.instances || [],
				skillBindings: data.skillBindings || [],
				teamBindings: data.teamBindings || []
			}));
		}
	} catch (e) {
		console.error('Failed to load MCP state:', e);
	}
}

// ============================================
// Initialize
// ============================================

export function initializeMCPStore() {
	loadDefinitions();
	loadFromStorage();
}
