import { writable, derived, get } from 'svelte/store';
import { mcpClient, type McpSkill } from '$lib/services/mcp-client';
import { mcpState } from './mcp.svelte';

export type SkillTier = 'free' | 'premium';

export type SkillCategory =
	| 'development'
	| 'frameworks'
	| 'integrations'
	| 'ai-ml'
	| 'agents'
	| 'data'
	| 'design'
	| 'marketing'
	| 'strategy'
	| 'enterprise'
	| 'finance'
	| 'legal'
	| 'science'
	| 'startup';

export interface Skill {
	id: string;
	name: string;
	description: string;
	category: SkillCategory;
	tier: SkillTier;
	tags: string[];
	triggers: string[];
	tokenEstimate?: number;
	version?: string;
	handoffs?: { trigger: string; to: string }[];
	pairsWell?: string[];
}

export interface SkillFilters {
	search: string;
	category: SkillCategory | 'all';
	tier: SkillTier | 'all';
	tags: string[];
}

export type SkillSource = 'static' | 'mcp';

// State
export const skills = writable<Skill[]>([]);
export const loading = writable(false);
export const error = writable<string | null>(null);
export const skillSource = writable<SkillSource>('static');

export const filters = writable<SkillFilters>({
	search: '',
	category: 'all',
	tier: 'all',
	tags: []
});

// Derived stores
export const filteredSkills = derived([skills, filters], ([$skills, $filters]) => {
	return $skills.filter((skill) => {
		// Search filter
		if ($filters.search) {
			const searchLower = $filters.search.toLowerCase();
			const matchesSearch =
				skill.name.toLowerCase().includes(searchLower) ||
				skill.description.toLowerCase().includes(searchLower) ||
				skill.tags.some((tag) => tag.toLowerCase().includes(searchLower));
			if (!matchesSearch) return false;
		}

		// Category filter
		if ($filters.category !== 'all' && skill.category !== $filters.category) {
			return false;
		}

		// Tier filter
		if ($filters.tier !== 'all' && skill.tier !== $filters.tier) {
			return false;
		}

		// Tags filter
		if ($filters.tags.length > 0) {
			const hasAllTags = $filters.tags.every((tag) => skill.tags.includes(tag));
			if (!hasAllTags) return false;
		}

		return true;
	});
});

export const skillsByCategory = derived(skills, ($skills) => {
	const grouped: Record<string, Skill[]> = {};
	for (const skill of $skills) {
		if (!grouped[skill.category]) {
			grouped[skill.category] = [];
		}
		grouped[skill.category].push(skill);
	}
	return grouped;
});

export const allTags = derived(skills, ($skills) => {
	const tagSet = new Set<string>();
	for (const skill of $skills) {
		for (const tag of skill.tags) {
			tagSet.add(tag);
		}
	}
	return Array.from(tagSet).sort();
});

export const skillCounts = derived(skills, ($skills) => {
	return {
		total: $skills.length,
		free: $skills.filter((s) => s.tier === 'free').length,
		premium: $skills.filter((s) => s.tier === 'premium').length
	};
});

// Helper to convert MCP skill to our Skill interface
function mapMcpSkill(s: McpSkill): Skill {
	return {
		id: s.id,
		name: s.name,
		description: s.description || '',
		category: s.category as SkillCategory,
		tier: (s.layer === 1 ? 'free' : 'premium') as SkillTier,
		tags: s.tags || [],
		triggers: s.triggers || [],
		handoffs: s.handoffs || [],
		pairsWell: s.pairs_with || []
	};
}

// Actions

/**
 * Load skills from static JSON (fallback)
 */
export async function loadSkillsStatic() {
	loading.set(true);
	error.set(null);
	skillSource.set('static');

	try {
		const response = await fetch('/skills.json');
		if (!response.ok) {
			throw new Error('Failed to load skills.json');
		}
		const data = await response.json();

		const loadedSkills: Skill[] = data.map((s: any) => ({
			id: s.id,
			name: s.name,
			description: s.description || '',
			category: s.category as SkillCategory,
			tier: (s.tier as SkillTier) || 'free',
			tags: s.tags || [],
			triggers: s.triggers || [],
			handoffs: s.handoffs || [],
			pairsWell: s.pairsWell || []
		}));

		// Preserve generated/custom skills (from PRD analysis) when reloading
		const existingSkills = get(skills);
		const generatedSkills = existingSkills.filter(s => s.id.startsWith('generated-'));
		const loadedIds = new Set(loadedSkills.map(s => s.id));
		const toPreserve = generatedSkills.filter(s => !loadedIds.has(s.id));

		skills.set([...loadedSkills, ...toPreserve]);
	} catch (e) {
		error.set(e instanceof Error ? e.message : 'Failed to load skills');
		console.error('Error loading skills:', e);
	} finally {
		loading.set(false);
	}
}

/**
 * Load skills from MCP server
 */
export async function loadSkillsMcp() {
	loading.set(true);
	error.set(null);
	skillSource.set('mcp');

	try {
		const result = await mcpClient.listSkills();

		if (!result.success) {
			throw new Error(result.error || 'Failed to load skills from MCP');
		}

		const mcpSkills = result.data?.skills || [];
		const loadedSkills: Skill[] = mcpSkills.map(mapMcpSkill);

		// Preserve generated/custom skills (from PRD analysis) when reloading
		const existingSkills = get(skills);
		const generatedSkills = existingSkills.filter(s => s.id.startsWith('generated-'));
		const loadedIds = new Set(loadedSkills.map(s => s.id));
		const toPreserve = generatedSkills.filter(s => !loadedIds.has(s.id));

		skills.set([...loadedSkills, ...toPreserve]);
	} catch (e) {
		error.set(e instanceof Error ? e.message : 'Failed to load skills from MCP');
		console.error('Error loading skills from MCP:', e);
		// Fall back to static
		await loadSkillsStatic();
	} finally {
		loading.set(false);
	}
}

/**
 * Search skills via MCP
 */
export async function searchSkillsMcp(query: string) {
	loading.set(true);
	error.set(null);

	try {
		const result = await mcpClient.searchSkills(query);

		if (!result.success) {
			throw new Error(result.error || 'Failed to search skills');
		}

		const mcpSkills = result.data?.skills || [];
		const loadedSkills: Skill[] = mcpSkills.map(mapMcpSkill);

		// Preserve generated/custom skills (from PRD analysis) when searching
		const existingSkills = get(skills);
		const generatedSkills = existingSkills.filter(s => s.id.startsWith('generated-'));
		const loadedIds = new Set(loadedSkills.map(s => s.id));
		const toPreserve = generatedSkills.filter(s => !loadedIds.has(s.id));

		skills.set([...loadedSkills, ...toPreserve]);
		skillSource.set('mcp');
	} catch (e) {
		error.set(e instanceof Error ? e.message : 'Failed to search skills');
		console.error('Error searching skills:', e);
	} finally {
		loading.set(false);
	}
}

/**
 * Load skills - automatically uses MCP if connected, otherwise static
 */
export async function loadSkills() {
	const state = get(mcpState);
	if (state.status === 'connected') {
		await loadSkillsMcp();
	} else {
		await loadSkillsStatic();
	}
}

export function setFilter<K extends keyof SkillFilters>(key: K, value: SkillFilters[K]) {
	filters.update((f) => ({ ...f, [key]: value }));
}

export function resetFilters() {
	filters.set({
		search: '',
		category: 'all',
		tier: 'all',
		tags: []
	});
}

export function getSkillById(id: string): Skill | undefined {
	let found: Skill | undefined;
	skills.subscribe((s) => {
		found = s.find((skill) => skill.id === id);
	})();
	return found;
}

/**
 * Add skills to the store (used for generated/placeholder skills from PRD)
 * Only adds skills that don't already exist (by ID)
 */
export function addSkills(newSkills: Skill[]) {
	skills.update((existing) => {
		const existingIds = new Set(existing.map(s => s.id));
		const toAdd = newSkills.filter(s => !existingIds.has(s.id));
		return [...existing, ...toAdd];
	});
}
