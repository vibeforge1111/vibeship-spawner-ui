import { logger } from '$lib/utils/logger';
/**
 * Skill Matcher Service v2
 *
 * INTELLIGENT PRD-TO-SKILL MATCHING
 *
 * Primary: Claude API analyzes PRDs with the current local skill context
 * Fallback: Local keyword matching for offline operation
 *
 * Claude sees all skills organized by domain and selects with reasoning.
 * This ensures game PRDs get game skills, AI PRDs get AI skills, etc.
 */

import type { AnalyzedGoal, MatchedSkill, MatchResult } from '$lib/types/goal';
import { GOAL_VALIDATION } from '$lib/types/goal';
import { get } from 'svelte/store';
import { skills as skillsStore } from '$lib/stores/skills.svelte';
import type { Skill } from '$lib/stores/skills.svelte';
import { claudeClient, type ClaudeAnalysis } from './claude-api';
import { rankSkillsForText } from './h70-skill-matcher';

/**
 * Convert Claude's skill selections to MatchedSkill format
 */
function convertClaudeSkills(
	analysis: ClaudeAnalysis,
	allSkills: Skill[]
): MatchedSkill[] {
	const matched: MatchedSkill[] = [];

	// Handle new format (array of {id, reason, tier})
	const suggestions = analysis.suggestedSkills || [];

	for (const suggestion of suggestions) {
		// Handle both old string format and new object format
		const skillId = typeof suggestion === 'string' ? suggestion : suggestion.id;
		const reason = typeof suggestion === 'string' ? 'Selected by Claude' : suggestion.reason;
		const tier = typeof suggestion === 'string' ? 2 : (suggestion.tier || 2);

		// Find full skill data from store
		const fullSkill = allSkills.find(s => s.id === skillId);

		matched.push({
			skillId,
			name: fullSkill?.name || skillId.replace(/-/g, ' '),
			description: fullSkill?.description || reason,
			category: fullSkill?.category || 'general',
			score: tier === 1 ? 0.9 : tier === 2 ? 0.7 : 0.5,
			matchReason: reason,
			tier: tier as 1 | 2 | 3,
			tags: fullSkill?.tags || []
		});
	}

	return matched;
}

/**
 * Local fallback: deterministic ranking against the generated Spark catalog
 * Only used when Claude API is unavailable
 */
function matchSkillsLocal(goal: AnalyzedGoal, maxResults: number): MatchedSkill[] {
	const allSkills = get(skillsStore);
	if (allSkills.length === 0) {
		return [];
	}

	const skillById = new Map(allSkills.map((skill) => [skill.id, skill]));
	const searchText = [
		goal.sanitized,
		...goal.keywords,
		...goal.features,
		...goal.technologies,
		...goal.domains
	].join('\n');

	return rankSkillsForText(searchText, maxResults)
		.map((rank): MatchedSkill | null => {
			const skill = skillById.get(rank.skillId);
			if (!skill) return null;
			const score = Math.min(1, rank.score / 120);
			return {
			skillId: skill.id,
			name: skill.name,
			description: skill.description,
			category: skill.category,
				score,
				matchReason: rank.reason,
				tier: score >= 0.7 ? 1 : score >= 0.45 ? 2 : 3,
			tags: skill.tags
			};
		})
		.filter((skill): skill is MatchedSkill => Boolean(skill));
}

/**
 * Main function: Match skills to a goal
 *
 * 1. Try Claude API for intelligent matching against the current local skill index
 * 2. Fall back to local keyword matching if Claude unavailable
 */
export async function matchSkills(
	goal: AnalyzedGoal,
	options: { maxResults?: number; minScore?: number; preferLocal?: boolean } = {}
): Promise<MatchResult> {
	const startTime = Date.now();
	const maxResults = options.maxResults || GOAL_VALIDATION.MAX_SKILLS_TO_SUGGEST;
	const allSkills = get(skillsStore);

	let skills: MatchedSkill[] = [];
	let source: 'claude' | 'mcp' | 'local' | 'hybrid' = 'local';
	let claudeAnalysis: ClaudeAnalysis | undefined;

	// Try Claude API for intelligent matching (unless local preferred)
	if (!options.preferLocal && claudeClient.isEnabled()) {
		logger.info('[SkillMatcher] Attempting Claude-powered intelligent matching...');

		const result = await claudeClient.analyzeGoal(goal.sanitized);

		if (result.success && result.analysis) {
			claudeAnalysis = result.analysis;
			skills = convertClaudeSkills(result.analysis, allSkills);
			source = 'claude';
			logger.info(`[SkillMatcher] Claude selected ${skills.length} skills with reasoning`);
		} else {
			logger.info('[SkillMatcher] Claude API unavailable, falling back to local');
		}
	}

	// Fall back to local matching if Claude didn't work
	if (skills.length === 0) {
		logger.info('[SkillMatcher] Using local Spark catalog matching');
		skills = matchSkillsLocal(goal, maxResults);
		logger.info(`[SkillMatcher] Matched ${skills.length} skills locally`);
	}

	// Apply minimum score filter if specified
	if (options.minScore) {
		skills = skills.filter(s => s.score >= options.minScore!);
	}

	// Ensure we don't exceed max results
	skills = skills.slice(0, maxResults);

	// Fallback if no skills found
	if (skills.length === 0 && goal.confidence > 0.3) {
		skills = getDefaultSkills(goal.domains, maxResults);
		logger.info('[SkillMatcher] Added default skills as fallback');
	}

	return {
		skills,
		totalMatches: skills.length,
		processingTime: Date.now() - startTime,
		source,
		goal,
		claudeAnalysis
	};
}

/**
 * Get default skills based on detected domains
 */
function getDefaultSkills(domains: string[], maxResults: number): MatchedSkill[] {
	const defaults: MatchedSkill[] = [];

	// Domain-specific defaults
	if (domains.includes('game') || domains.includes('gaming')) {
		defaults.push({
			skillId: 'game-development',
			name: 'Game Development',
			description: 'Core game architecture and patterns',
			category: 'game',
			score: 0.6,
			matchReason: 'game project detected',
			tier: 1,
			tags: ['game', 'development']
		});
		defaults.push({
			skillId: 'game-design',
			name: 'Game Design',
			description: 'Game mechanics and player experience',
			category: 'game',
			score: 0.5,
			matchReason: 'game project detected',
			tier: 2,
			tags: ['game', 'design']
		});
	} else if (domains.includes('ai') || domains.includes('ml')) {
		defaults.push({
			skillId: 'llm-architect',
			name: 'LLM Architect',
			description: 'Building production LLM applications',
			category: 'ai',
			score: 0.6,
			matchReason: 'AI project detected',
			tier: 1,
			tags: ['ai', 'llm']
		});
	} else {
		// Default web app skills
		defaults.push({
			skillId: 'nextjs-app-router',
			name: 'Next.js App Router',
			description: 'Modern React framework',
			category: 'frameworks',
			score: 0.5,
			matchReason: 'recommended starting point',
			tier: 1,
			tags: ['nextjs', 'react']
		});
		defaults.push({
			skillId: 'api-design',
			name: 'API Design',
			description: 'REST API patterns',
			category: 'development',
			score: 0.4,
			matchReason: 'common requirement',
			tier: 2,
			tags: ['api', 'rest']
		});
	}

	return defaults.slice(0, maxResults);
}

/**
 * Get skill by ID from the store
 */
export function getSkillById(skillId: string): Skill | undefined {
	const allSkills = get(skillsStore);
	return allSkills.find(s => s.id === skillId);
}

/**
 * Ensure we have full skill data for matched skills
 */
export function hydrateMatchedSkills(matched: MatchedSkill[]): (MatchedSkill & { fullSkill?: Skill })[] {
	return matched.map(m => ({
		...m,
		fullSkill: getSkillById(m.skillId)
	}));
}
