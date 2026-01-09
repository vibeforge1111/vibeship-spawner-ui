/**
 * Skill Matcher Service
 *
 * Matches analyzed goals to relevant skills using a hybrid approach:
 * 1. MCP Server: When connected, uses intelligent AI-powered skill matching
 * 2. Local Fallback: Pattern matching with skills loaded from static JSON
 * 3. H70 Keyword Matching: Uses 391 keyword mappings from h70-skill-matcher
 *
 * This ensures the best possible matches when MCP is available,
 * while maintaining instant operation even when offline.
 */

import type { AnalyzedGoal, MatchedSkill, MatchResult } from '$lib/types/goal';
import { GOAL_VALIDATION } from '$lib/types/goal';
import { get } from 'svelte/store';
import { skills as skillsStore } from '$lib/stores/skills.svelte';
import type { Skill } from '$lib/stores/skills.svelte';
import { mcpClient } from './mcp-client';
import { mcpState } from '$lib/stores/mcp.svelte';
import { KEYWORD_TO_SKILLS } from './h70-skill-matcher';

// Skill category priorities (which categories are more "core")
const CATEGORY_PRIORITY: Record<string, number> = {
	'frameworks': 1,
	'development': 2,
	'integrations': 3,
	'ai-ml': 4,
	'agents': 5,
	'data': 6,
	'design': 7,
	'marketing': 8,
	'strategy': 9,
	'enterprise': 10,
	'finance': 11,
	'legal': 12,
	'science': 13,
	'startup': 14
};

// Technology to skill ID mappings (for common techs)
const TECH_TO_SKILLS: Record<string, string[]> = {
	'nextjs': ['nextjs-app-router', 'react-patterns'],
	'react': ['react-patterns', 'react-hooks'],
	'vue': ['vue-patterns'],
	'svelte': ['svelte-patterns'],
	'supabase': ['supabase-backend', 'supabase-auth'],
	'firebase': ['firebase-patterns'],
	'stripe': ['stripe-payments', 'fintech-integration'],
	'auth': ['authentication-oauth', 'supabase-auth'],
	'graphql': ['graphql-schema', 'api-design'],
	'rest': ['api-design', 'error-handling-patterns'],
	'tailwind': ['frontend-design'],
	'docker': ['docker-patterns', 'devops-patterns'],
	'aws': ['aws-services'],
	'gcp': ['gcp-services'],
	'ai': ['llm-integration', 'ai-patterns'],
	'realtime': ['realtime-patterns', 'websocket-patterns'],
	'mobile': ['flutter-mobile', 'react-native-patterns'],
	'testing': ['integration-testing', 'tdd-patterns']
};

// Feature to skill ID mappings
const FEATURE_TO_SKILLS: Record<string, string[]> = {
	'authentication': ['authentication-oauth', 'supabase-auth'],
	'payments': ['stripe-payments', 'fintech-integration'],
	'dashboard': ['react-patterns', 'data-visualization'],
	'api': ['api-design', 'error-handling-patterns'],
	'database': ['supabase-backend', 'data-modeling'],
	'search': ['elasticsearch-search', 'search-patterns'],
	'notifications': ['notification-patterns', 'email-templating'],
	'file-upload': ['file-upload-patterns', 'storage-patterns'],
	'chat': ['realtime-patterns', 'chat-patterns'],
	'collaboration': ['collaboration-patterns', 'realtime-patterns'],
	'integration': ['integration-patterns', 'webhook-patterns']
};

// Domain to skill ID mappings
const DOMAIN_TO_SKILLS: Record<string, string[]> = {
	'saas': ['multi-tenancy', 'subscription-patterns', 'authentication-oauth'],
	'e-commerce': ['stripe-payments', 'inventory-patterns', 'cart-patterns'],
	'marketplace': ['marketplace-patterns', 'payment-split', 'escrow-patterns'],
	'social': ['social-patterns', 'feed-algorithms', 'graph-database'],
	'fintech': ['fintech-integration', 'compliance-automation', 'derivatives-pricing'],
	'healthcare': ['hipaa-compliance', 'healthcare-patterns'],
	'education': ['lms-patterns', 'gamification'],
	'productivity': ['project-management', 'task-patterns'],
	'content': ['cms-patterns', 'seo-patterns'],
	'analytics': ['analytics-patterns', 'data-pipeline']
};

/**
 * Calculate match score for a skill against the goal
 * Uses H70 keyword mappings (391 keywords) for comprehensive matching
 */
function calculateMatchScore(skill: Skill, goal: AnalyzedGoal): number {
	let score = 0;
	const skillNameLower = skill.name.toLowerCase();
	const skillDescLower = skill.description.toLowerCase();
	const skillTags = skill.tags.map(t => t.toLowerCase());

	// H70 Keyword matching (PRIMARY - 391 mappings, highest weight)
	// Check if any keyword from the PRD maps to this skill via H70
	for (const keyword of goal.keywords) {
		const h70Skills = KEYWORD_TO_SKILLS[keyword] || [];
		if (h70Skills.includes(skill.id)) {
			// Primary match (first in array) gets higher score
			const position = h70Skills.indexOf(skill.id);
			score += position === 0 ? 0.6 : 0.4;
		}
	}

	// Also check multi-word phrases in the sanitized input
	const inputLower = goal.sanitized.toLowerCase();
	for (const [phrase, h70Skills] of Object.entries(KEYWORD_TO_SKILLS)) {
		if (phrase.includes(' ') && inputLower.includes(phrase)) {
			if (h70Skills.includes(skill.id)) {
				const position = h70Skills.indexOf(skill.id);
				score += position === 0 ? 0.5 : 0.3;
			}
		}
	}

	// Direct technology match (from goal-analyzer detected techs)
	for (const tech of goal.technologies) {
		const skillsForTech = TECH_TO_SKILLS[tech] || [];
		if (skillsForTech.includes(skill.id)) {
			score += 0.4;
		}
		// Also check H70 mappings for the tech
		const h70Skills = KEYWORD_TO_SKILLS[tech] || [];
		if (h70Skills.includes(skill.id)) {
			score += 0.3;
		}
		// Partial match in name/tags
		if (skillNameLower.includes(tech) || skillTags.some(t => t.includes(tech))) {
			score += 0.2;
		}
	}

	// Feature match
	for (const feature of goal.features) {
		const skillsForFeature = FEATURE_TO_SKILLS[feature] || [];
		if (skillsForFeature.includes(skill.id)) {
			score += 0.3;
		}
		// Also check H70 mappings for the feature
		const h70Skills = KEYWORD_TO_SKILLS[feature] || [];
		if (h70Skills.includes(skill.id)) {
			score += 0.25;
		}
		if (skillNameLower.includes(feature) || skillTags.some(t => t.includes(feature))) {
			score += 0.15;
		}
	}

	// Domain match
	for (const domain of goal.domains) {
		const skillsForDomain = DOMAIN_TO_SKILLS[domain] || [];
		if (skillsForDomain.includes(skill.id)) {
			score += 0.2;
		}
		// Also check H70 mappings for the domain
		const h70Skills = KEYWORD_TO_SKILLS[domain] || [];
		if (h70Skills.includes(skill.id)) {
			score += 0.2;
		}
	}

	// Fuzzy keyword match (name/description/tags)
	for (const keyword of goal.keywords) {
		if (skillNameLower.includes(keyword)) {
			score += 0.1;
		} else if (skillDescLower.includes(keyword)) {
			score += 0.05;
		} else if (skillTags.some(t => t.includes(keyword))) {
			score += 0.05;
		}
	}

	// Cap at 1.0
	return Math.min(1, score);
}

/**
 * Determine tier based on match score and category
 */
function determineTier(score: number, category: string): 1 | 2 | 3 {
	// High score = essential
	if (score >= 0.6) return 1;
	// Medium score = recommended
	if (score >= 0.3) return 2;
	// Low score = optional
	return 3;
}

/**
 * Generate match reason for display
 */
function generateMatchReason(skill: Skill, goal: AnalyzedGoal): string {
	const reasons: string[] = [];

	// Check H70 keyword matches (primary source)
	for (const keyword of goal.keywords) {
		const h70Skills = KEYWORD_TO_SKILLS[keyword] || [];
		if (h70Skills.includes(skill.id)) {
			reasons.push(`matches "${keyword}"`);
			break; // One keyword reason is enough
		}
	}

	// Check technology matches
	for (const tech of goal.technologies) {
		const skillsForTech = TECH_TO_SKILLS[tech] || [];
		const h70Skills = KEYWORD_TO_SKILLS[tech] || [];
		if (skillsForTech.includes(skill.id) || h70Skills.includes(skill.id)) {
			reasons.push(`${tech} expertise`);
		}
	}

	// Check feature matches
	for (const feature of goal.features) {
		const skillsForFeature = FEATURE_TO_SKILLS[feature] || [];
		const h70Skills = KEYWORD_TO_SKILLS[feature] || [];
		if (skillsForFeature.includes(skill.id) || h70Skills.includes(skill.id)) {
			reasons.push(`provides ${feature}`);
		}
	}

	// Check domain matches
	for (const domain of goal.domains) {
		const skillsForDomain = DOMAIN_TO_SKILLS[domain] || [];
		const h70Skills = KEYWORD_TO_SKILLS[domain] || [];
		if (skillsForDomain.includes(skill.id) || h70Skills.includes(skill.id)) {
			reasons.push(`${domain} domain`);
		}
	}

	// Default reason
	if (reasons.length === 0) {
		reasons.push('related to your project');
	}

	return reasons.slice(0, 2).join(', ');
}

/**
 * Match skills locally using the skills store
 */
function matchSkillsLocal(goal: AnalyzedGoal, maxResults: number): MatchedSkill[] {
	const allSkills = get(skillsStore);
	if (allSkills.length === 0) {
		return [];
	}

	// Score all skills
	const scored: { skill: Skill; score: number }[] = allSkills
		.map(skill => ({
			skill,
			score: calculateMatchScore(skill, goal)
		}))
		.filter(item => item.score >= GOAL_VALIDATION.MIN_CONFIDENCE_SCORE);

	// Sort by score (desc), then by category priority
	scored.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		const priorityA = CATEGORY_PRIORITY[a.skill.category] || 99;
		const priorityB = CATEGORY_PRIORITY[b.skill.category] || 99;
		return priorityA - priorityB;
	});

	// Take top N and convert to MatchedSkill
	return scored.slice(0, maxResults).map(({ skill, score }) => ({
		skillId: skill.id,
		name: skill.name,
		description: skill.description,
		category: skill.category,
		score,
		matchReason: generateMatchReason(skill, goal),
		tier: determineTier(score, skill.category),
		tags: skill.tags
	}));
}

/**
 * Match skills using MCP server's intelligent search
 */
async function matchSkillsMCP(goal: AnalyzedGoal, maxResults: number): Promise<MatchedSkill[]> {
	try {
		// Build search query from goal analysis
		const searchQuery = [
			...goal.technologies,
			...goal.features.slice(0, 3),
			...goal.keywords.slice(0, 5)
		].join(' ');

		console.log('[SkillMatcher] Searching MCP with query:', searchQuery);

		// Call MCP server to search for skills
		const result = await mcpClient.searchSkills(searchQuery, {
			limit: maxResults * 2, // Get extra to filter later
			category: goal.domains[0] // Use primary domain as category hint
		});

		if (!result.success || !result.data?.skills) {
			console.warn('[SkillMatcher] MCP search failed:', result.error);
			return [];
		}

		// Convert MCP skills to MatchedSkill format
		const mcpSkills = result.data.skills;
		const matched: MatchedSkill[] = [];

		for (const mcpSkill of mcpSkills) {
			// Find the full skill data from our store
			const fullSkill = get(skillsStore).find(s => s.id === mcpSkill.id);
			if (!fullSkill) continue;

			// Calculate a relevance score based on position and goal match
			const positionScore = 1 - (matched.length / mcpSkills.length) * 0.3; // Higher position = higher score
			const goalScore = calculateMatchScore(fullSkill, goal);
			const finalScore = (positionScore * 0.4) + (goalScore * 0.6);

			matched.push({
				skillId: mcpSkill.id,
				name: mcpSkill.name,
				description: mcpSkill.description || fullSkill.description,
				category: mcpSkill.category,
				score: finalScore,
				matchReason: `MCP recommendation for "${searchQuery.slice(0, 30)}..."`,
				tier: determineTier(finalScore, mcpSkill.category),
				tags: mcpSkill.tags || fullSkill.tags
			});
		}

		// Sort by score and return top N
		matched.sort((a, b) => b.score - a.score);
		return matched.slice(0, maxResults);
	} catch (error) {
		console.error('[SkillMatcher] MCP matching error:', error);
		return [];
	}
}

/**
 * Main function: Match skills to a goal
 *
 * Tries MCP server first for intelligent matching, falls back to local pattern matching.
 * This provides the best of both worlds: AI-powered matching when available,
 * and instant local matching as fallback.
 */
export async function matchSkills(
	goal: AnalyzedGoal,
	options: { maxResults?: number; minScore?: number; preferMcp?: boolean } = {}
): Promise<MatchResult> {
	const startTime = Date.now();
	const maxResults = options.maxResults || GOAL_VALIDATION.MAX_SKILLS_TO_SUGGEST;
	let skills: MatchedSkill[] = [];
	let source: 'claude' | 'mcp' | 'local' | 'hybrid' = 'local';

	// Check if MCP is connected and we should try it
	const mcp = get(mcpState);
	const shouldTryMcp = options.preferMcp !== false && mcp.status === 'connected' && !goal.needsClarification;

	if (shouldTryMcp) {
		console.log('[SkillMatcher] Attempting MCP-powered skill matching...');
		const mcpSkills = await matchSkillsMCP(goal, maxResults);
		
		if (mcpSkills.length > 0) {
			skills = mcpSkills;
			source = 'mcp';
			console.log(`[SkillMatcher] MCP matched ${skills.length} skills`);
		} else {
			console.log('[SkillMatcher] MCP returned no results, falling back to local');
		}
	}

	// Fall back to local matching if MCP didn't work or wasn't available
	if (skills.length === 0) {
		console.log('[SkillMatcher] Using local pattern matching');
		skills = matchSkillsLocal(goal, maxResults);
		source = source === 'mcp' ? 'hybrid' : 'local';
		console.log(`[SkillMatcher] Matched ${skills.length} skills locally`);
	}

	// Apply minimum score filter if specified
	if (options.minScore) {
		skills = skills.filter(s => s.score >= options.minScore!);
	}

	// Ensure we have at least some skills for non-vague inputs
	if (skills.length === 0 && goal.confidence > 0.3) {
		// Add some default starter skills based on common patterns
		skills = getDefaultSkills(goal, maxResults);
		console.log('[SkillMatcher] Added default skills as fallback');
	}

	return {
		skills,
		totalMatches: skills.length,
		processingTime: Date.now() - startTime,
		source,
		goal
	};
}

/**
 * Get default skills when no matches are found
 */
function getDefaultSkills(goal: AnalyzedGoal, maxResults: number): MatchedSkill[] {
	// Default skills for common project types
	const defaults: MatchedSkill[] = [
		{
			skillId: 'nextjs-app-router',
			name: 'Next.js App Router',
			description: 'Modern React framework with App Router patterns',
			category: 'frameworks',
			score: 0.5,
			matchReason: 'recommended starting point',
			tier: 1,
			tags: ['nextjs', 'react', 'frontend']
		},
		{
			skillId: 'api-design',
			name: 'API Design',
			description: 'REST API design patterns and best practices',
			category: 'development',
			score: 0.4,
			matchReason: 'common requirement',
			tier: 2,
			tags: ['api', 'rest', 'backend']
		}
	];

	// Add auth if mentioned anything about users
	if (goal.features.includes('authentication') || goal.keywords.some(k => ['user', 'users', 'account'].includes(k))) {
		defaults.push({
			skillId: 'authentication-oauth',
			name: 'Authentication & OAuth',
			description: 'Secure authentication patterns',
			category: 'integrations',
			score: 0.45,
			matchReason: 'user management',
			tier: 1,
			tags: ['auth', 'oauth', 'security']
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
