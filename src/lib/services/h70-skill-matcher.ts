/**
 * Spark skill matcher
 *
 * Uses the generated spark-skill-graphs catalog as the source of truth.
 * The matcher is deliberately lexical and deterministic: exact ids, names,
 * triggers, tags, owns, categories, delegates, and pairs drive ranking.
 */

import skillDetails from '../data/skill-matcher-catalog.json';

type RawDelegate = { skill?: string; when?: string };
type RawSelectionHints = {
	aliases?: string[];
	boost_terms?: string[];
	boostTerms?: string[];
	boost?: number;
	negative_terms?: string[];
	negativeTerms?: string[];
	penalty?: number;
};
type RawSkill = {
	id?: string;
	name?: string;
	description?: string;
	category?: string;
	owns?: string[];
	tags?: string[];
	triggers?: string[];
	delegates?: RawDelegate[];
	pairsWell?: string[];
	selectionHints?: RawSelectionHints;
};

type SkillDoc = Required<Pick<RawSkill, 'id' | 'name' | 'description' | 'category'>> & {
	owns: string[];
	tags: string[];
	triggers: string[];
	delegates: RawDelegate[];
	pairsWell: string[];
	selectionHints: {
		aliases: string[];
		boostTerms: string[];
		boost: number;
		negativeTerms: string[];
		penalty: number;
	};
	text: string;
	tokens: Set<string>;
};

export interface SkillRank {
	skillId: string;
	score: number;
	reason: string;
	category: string;
}

const STOP_WORDS = new Set([
	'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
	'by', 'from', 'as', 'is', 'are', 'be', 'build', 'create', 'make', 'implement',
	'app', 'application', 'system', 'feature', 'project', 'user', 'users', 'need',
	'needs', 'using', 'use', 'into', 'all', 'new', 'simple', 'custom'
]);

const CATEGORY_HINTS: Record<string, string[]> = {
	'ai': ['ai', 'llm', 'rag', 'chatbot', 'agent', 'prompt', 'embedding', 'vector', 'model', 'openai', 'claude'],
	'ai-agents': ['agent', 'agents', 'tool', 'tools', 'orchestration', 'memory'],
	'backend': ['api', 'server', 'backend', 'endpoint', 'auth', 'database', 'websocket', 'notification'],
	'frontend': ['ui', 'frontend', 'react', 'svelte', 'vue', 'website', 'responsive', 'mobile'],
	'game-dev': ['game', 'roguelike', 'dungeon', 'combat', 'inventory', 'sprite', 'multiplayer', 'procedural'],
	'ecommerce': ['ecommerce', 'shop', 'cart', 'checkout', 'inventory', 'order', 'catalog'],
	'finance': ['payment', 'stripe', 'billing', 'subscription', 'portfolio', 'fintech'],
	'trading': ['trading', 'backtesting', 'technical', 'sentiment', 'risk', 'alpha'],
	'creative': ['image', 'video', 'art', 'character', 'style', 'animation', 'visual'],
	'design': ['design', 'brand', 'typography', 'accessibility', 'ui'],
	'data': ['data', 'analytics', 'pipeline', 'metrics', 'dashboard'],
	'devops': ['deploy', 'ci', 'cd', 'docker', 'kubernetes', 'infrastructure'],
	'security': ['security', 'privacy', 'gdpr', 'oauth', 'auth', 'encryption']
};

function normalize(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9+#.-]+/g, ' ').trim();
}

function tokenize(value: string): string[] {
	return normalize(value)
		.split(/\s+/)
		.filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function hasPhrase(haystack: string, phrase: string): boolean {
	const normalizedPhrase = normalize(phrase);
	if (!normalizedPhrase) return false;
	return new RegExp(`(^|\\s)${normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(haystack);
}

function stringList(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
}

function coerceSkill(id: string, raw: RawSkill): SkillDoc {
	const owns = Array.isArray(raw.owns) ? raw.owns.filter(Boolean) : [];
	const tags = Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : [];
	const triggers = Array.isArray(raw.triggers) ? raw.triggers.filter(Boolean) : [];
	const delegates = Array.isArray(raw.delegates) ? raw.delegates : [];
	const pairsWell = Array.isArray(raw.pairsWell) ? raw.pairsWell.filter(Boolean) : [];
	const rawSelectionHints = raw.selectionHints || {};
	const selectionHints = {
		aliases: stringList(rawSelectionHints.aliases),
		boostTerms: [
			...stringList(rawSelectionHints.boostTerms),
			...stringList(rawSelectionHints.boost_terms)
		],
		boost: typeof rawSelectionHints.boost === 'number' ? rawSelectionHints.boost : 36,
		negativeTerms: [
			...stringList(rawSelectionHints.negativeTerms),
			...stringList(rawSelectionHints.negative_terms)
		],
		penalty: typeof rawSelectionHints.penalty === 'number' ? rawSelectionHints.penalty : 32
	};
	const name = raw.name || id;
	const description = raw.description || '';
	const category = raw.category || 'development';
	const text = [
		id.replace(/-/g, ' '),
		name,
		description,
		category,
		...owns,
		...tags,
		...triggers,
		...selectionHints.aliases,
		...selectionHints.boostTerms
	].join(' ');

	return {
		id,
		name,
		description,
		category,
		owns,
		tags,
		triggers,
		delegates,
		pairsWell,
		selectionHints,
		text: normalize(text),
		tokens: new Set(tokenize(text))
	};
}

const SKILLS: SkillDoc[] = Object.entries(skillDetails as Record<string, RawSkill>)
	.map(([id, raw]) => coerceSkill(id, raw))
	.sort((a, b) => a.id.localeCompare(b.id));

const SKILL_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill]));

function categoryBoost(queryTokens: Set<string>, category: string): number {
	const hints = CATEGORY_HINTS[category] || [];
	return hints.reduce((score, hint) => score + (queryTokens.has(hint) ? 6 : 0), 0);
}

function termMatches(term: string, normalizedQuery: string, queryTokens: Set<string>): boolean {
	const normalizedTerm = normalize(term);
	if (!normalizedTerm) return false;
	if (normalizedTerm.includes(' ')) return hasPhrase(normalizedQuery, normalizedTerm);
	return queryTokens.has(normalizedTerm);
}

function selectionHintScore(skill: SkillDoc, normalizedQuery: string, queryTokens: Set<string>): number {
	let score = 0;
	const boostTerms = [...skill.selectionHints.aliases, ...skill.selectionHints.boostTerms];
	if (boostTerms.some((term) => termMatches(term, normalizedQuery, queryTokens))) {
		score += skill.selectionHints.boost;
	}
	if (skill.selectionHints.negativeTerms.some((term) => termMatches(term, normalizedQuery, queryTokens))) {
		score -= skill.selectionHints.penalty;
	}
	return score;
}

function scoreSkill(skill: SkillDoc, query: string, queryTokens: string[]): SkillRank | null {
	const normalizedQuery = normalize(query);
	const queryTokenSet = new Set(queryTokens);
	let score = 0;
	const reasons: string[] = [];

	if (hasPhrase(normalizedQuery, skill.id.replace(/-/g, ' ')) || hasPhrase(normalizedQuery, skill.id)) {
		score += 80;
		reasons.push('id');
	}

	if (hasPhrase(normalizedQuery, skill.name)) {
		score += 70;
		reasons.push('name');
	}

	for (const trigger of skill.triggers) {
		if (hasPhrase(normalizedQuery, trigger)) {
			const triggerTokenCount = tokenize(trigger).length;
			if (triggerTokenCount === 0) continue;
			score += triggerTokenCount > 1 ? 42 : 14;
			reasons.push(`trigger:${trigger}`);
		}
	}

	for (const tag of skill.tags) {
		if (hasPhrase(normalizedQuery, tag)) {
			score += 28;
			reasons.push(`tag:${tag}`);
		}
	}

	for (const own of skill.owns) {
		if (hasPhrase(normalizedQuery, own)) {
			score += 34;
			reasons.push(`owns:${own}`);
		}
	}

	let overlap = 0;
	for (const token of queryTokens) {
		if (!skill.tokens.has(token)) continue;
		overlap++;
		if (skill.id.includes(token)) score += 16;
		else if (normalize(skill.name).includes(token)) score += 13;
		else if (skill.tags.some((tag) => normalize(tag).split(/\s+/).includes(token))) score += 10;
		else if (skill.triggers.some((trigger) => normalize(trigger).split(/\s+/).includes(token))) score += 9;
		else if (skill.owns.some((own) => normalize(own).includes(token))) score += 8;
		else score += 2;
	}
	if (overlap > 0) reasons.push(`${overlap} term${overlap === 1 ? '' : 's'}`);

	score += categoryBoost(queryTokenSet, skill.category);
	score += selectionHintScore(skill, normalizedQuery, queryTokenSet);

	if (score < 18) return null;
	return {
		skillId: skill.id,
		score,
		reason: reasons.slice(0, 3).join(', ') || 'catalog match',
		category: skill.category
	};
}

function addRelationshipContext(
	ranks: SkillRank[],
	maxResults: number,
	normalizedQuery: string,
	queryTokenSet: Set<string>
): SkillRank[] {
	const rankById = new Map(ranks.map((rank) => [rank.skillId, rank]));
	const additions = new Map<string, SkillRank>();

	for (const rank of ranks.slice(0, Math.min(8, ranks.length))) {
		const skill = SKILL_BY_ID.get(rank.skillId);
		if (!skill) continue;
		const relatedTargets = [
			...skill.delegates
				.map((delegate) => ({ id: delegate.skill, multiplier: 0.24 }))
				.filter((target): target is { id: string; multiplier: number } => Boolean(target.id)),
			...skill.pairsWell.map((id) => ({ id, multiplier: 0.5 }))
		];

		for (const { id: targetId, multiplier } of relatedTargets) {
			const targetSkill = SKILL_BY_ID.get(targetId);
			if (!targetSkill) continue;
			const relationshipScore = Math.max(20, rank.score * multiplier);
			const existingRank = rankById.get(targetId);
			if (existingRank) {
				if (relationshipScore > existingRank.score) {
					existingRank.score = relationshipScore;
					existingRank.reason = `${existingRank.reason}, related to ${rank.skillId}`;
				}
				continue;
			}
			const isCuratedPair = multiplier >= 0.5;
			if (
				!isCuratedPair &&
				categoryBoost(queryTokenSet, targetSkill.category) === 0 &&
				selectionHintScore(targetSkill, normalizedQuery, queryTokenSet) <= 0
			) {
				continue;
			}
			if (additions.has(targetId)) continue;
			additions.set(targetId, {
				skillId: targetId,
				score: relationshipScore,
				reason: `related to ${rank.skillId}`,
				category: targetSkill.category
			});
		}
	}

	return [...ranks, ...additions.values()]
		.sort((a, b) => b.score - a.score || a.skillId.localeCompare(b.skillId))
		.slice(0, maxResults);
}

export function rankSkillsForText(text: string, maxResults = 10): SkillRank[] {
	const queryTokens = tokenize(text);
	if (queryTokens.length === 0) return [];
	const normalizedQuery = normalize(text);

	const ranks = SKILLS
		.map((skill) => scoreSkill(skill, text, queryTokens))
		.filter((rank): rank is SkillRank => Boolean(rank))
		.sort((a, b) => b.score - a.score || a.skillId.localeCompare(b.skillId));

	return addRelationshipContext(ranks, maxResults, normalizedQuery, new Set(queryTokens));
}

export function matchTaskToSkills(
	taskName: string,
	taskDescription?: string,
	maxSkills = 5
): string[] {
	return rankSkillsForText(`${taskName}\n${taskDescription || ''}`, maxSkills).map((rank) => rank.skillId);
}

export function matchTasksToSkills(
	tasks: Array<{ name: string; description?: string }>,
	maxSkillsPerTask = 3
): Map<string, string[]> {
	const result = new Map<string, string[]>();
	for (const task of tasks) {
		result.set(task.name, matchTaskToSkills(task.name, task.description, maxSkillsPerTask));
	}
	return result;
}

export function getAllRequiredSkills(
	tasks: Array<{ name: string; description?: string }>,
	maxSkillsPerTask = 3
): string[] {
	const allSkills = new Set<string>();
	for (const skills of matchTasksToSkills(tasks, maxSkillsPerTask).values()) {
		skills.forEach((skill) => allSkills.add(skill));
	}
	return [...allSkills];
}

export function getSkillPriorities(
	tasks: Array<{ name: string; description?: string }>
): Array<{ skillId: string; score: number; usedInTasks: string[] }> {
	const scores = new Map<string, { score: number; usedInTasks: string[] }>();
	for (const task of tasks) {
		for (const rank of rankSkillsForText(`${task.name}\n${task.description || ''}`, 8)) {
			const existing = scores.get(rank.skillId) || { score: 0, usedInTasks: [] };
			existing.score += rank.score;
			existing.usedInTasks.push(task.name);
			scores.set(rank.skillId, existing);
		}
	}
	return [...scores.entries()]
		.map(([skillId, value]) => ({ skillId, ...value }))
		.sort((a, b) => b.score - a.score || a.skillId.localeCompare(b.skillId));
}

export const KEYWORD_TO_SKILLS: Record<string, string[]> = Object.fromEntries(
	SKILLS.flatMap((skill) => {
		const keys = new Set([
			skill.id,
			skill.id.replace(/-/g, ' '),
			skill.name,
			skill.category,
			...skill.tags,
			...skill.triggers
		]);
		return [...keys].map((key) => [normalize(key), [skill.id]] as const);
	})
);

export const TASK_TYPE_TO_SKILLS: Record<string, string[]> = {
	'Project Setup': matchTaskToSkills('project setup scaffold initialize repository', undefined, 5),
	'Design System': matchTaskToSkills('design system ui components accessibility typography', undefined, 5),
	Authentication: matchTaskToSkills('authentication oauth login session security', undefined, 5),
	Database: matchTaskToSkills('database schema postgres migrations data model', undefined, 5),
	API: matchTaskToSkills('api endpoint rest graphql backend', undefined, 5),
	Frontend: matchTaskToSkills('frontend ui react svelte responsive', undefined, 5),
	Backend: matchTaskToSkills('backend server api database', undefined, 5),
	Testing: matchTaskToSkills('testing unit integration e2e qa', undefined, 5),
	Deployment: matchTaskToSkills('deployment ci cd docker vercel', undefined, 5),
	Security: matchTaskToSkills('security hardening owasp privacy', undefined, 5)
};
