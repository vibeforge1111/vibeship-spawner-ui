import { writable, derived } from 'svelte/store';

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

// State
export const skills = writable<Skill[]>([]);
export const loading = writable(false);
export const error = writable<string | null>(null);

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

// Actions
export async function loadSkills() {
	loading.set(true);
	error.set(null);

	try {
		// TODO: Replace with actual API call to MCP or skills endpoint
		// For now, load mock data
		const mockSkills: Skill[] = [
			{
				id: 'nextjs-app-router',
				name: 'Next.js App Router',
				description: 'Expert patterns for Next.js 14+ App Router with RSC, streaming, and layouts',
				category: 'frameworks',
				tier: 'free',
				tags: ['nextjs', 'react', 'frontend', 'ssr'],
				triggers: ['nextjs', 'app router', 'next.js'],
				tokenEstimate: 8500
			},
			{
				id: 'nextjs-app-router-pro',
				name: 'Next.js App Router Pro',
				description: 'Token-optimized Next.js expertise with condensed patterns and faster responses',
				category: 'frameworks',
				tier: 'premium',
				tags: ['nextjs', 'react', 'frontend', 'ssr'],
				triggers: ['nextjs', 'app router', 'next.js'],
				tokenEstimate: 3200
			},
			{
				id: 'supabase-backend',
				name: 'Supabase Backend',
				description: 'Complete Supabase integration including Auth, RLS, Edge Functions, and Realtime',
				category: 'integrations',
				tier: 'free',
				tags: ['supabase', 'postgres', 'auth', 'backend'],
				triggers: ['supabase', 'database', 'auth'],
				tokenEstimate: 9200
			},
			{
				id: 'autonomous-agents',
				name: 'Autonomous Agents',
				description: 'Build multi-agent systems with tool use, memory, and coordination patterns',
				category: 'agents',
				tier: 'free',
				tags: ['agents', 'ai', 'automation', 'langchain'],
				triggers: ['agent', 'autonomous', 'multi-agent'],
				tokenEstimate: 11000
			},
			{
				id: 'autonomous-agents-pro',
				name: 'Autonomous Agents Pro',
				description: 'Streamlined agent patterns with reduced token overhead and faster execution',
				category: 'agents',
				tier: 'premium',
				tags: ['agents', 'ai', 'automation', 'langchain'],
				triggers: ['agent', 'autonomous', 'multi-agent'],
				tokenEstimate: 4100
			},
			{
				id: 'stripe-payments',
				name: 'Stripe Payments',
				description: 'Complete Stripe integration for subscriptions, one-time payments, and webhooks',
				category: 'integrations',
				tier: 'free',
				tags: ['stripe', 'payments', 'subscriptions', 'webhooks'],
				triggers: ['stripe', 'payments', 'billing'],
				tokenEstimate: 7800
			},
			{
				id: 'tailwind-ui',
				name: 'Tailwind UI',
				description: 'Expert Tailwind CSS patterns for responsive, accessible component design',
				category: 'design',
				tier: 'free',
				tags: ['tailwind', 'css', 'ui', 'design'],
				triggers: ['tailwind', 'styling', 'css'],
				tokenEstimate: 6500
			},
			{
				id: 'postgres-wizard',
				name: 'Postgres Wizard',
				description: 'Advanced PostgreSQL patterns including migrations, indexes, and query optimization',
				category: 'data',
				tier: 'free',
				tags: ['postgres', 'sql', 'database', 'optimization'],
				triggers: ['postgres', 'sql', 'database'],
				tokenEstimate: 8900
			}
		];

		skills.set(mockSkills);
	} catch (e) {
		error.set(e instanceof Error ? e.message : 'Failed to load skills');
	} finally {
		loading.set(false);
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
