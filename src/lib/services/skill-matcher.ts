/**
 * Skill Matcher Service
 *
 * Matches analyzed goals to relevant skills using LOCAL pattern matching.
 * No network dependencies - works instantly with skills loaded from static JSON.
 *
 * The MCP and Claude API integrations are kept for future use but not called
 * during normal goal processing to ensure fast, reliable operation.
 */

import type { AnalyzedGoal, MatchedSkill, MatchResult } from '$lib/types/goal';
import { GOAL_VALIDATION } from '$lib/types/goal';
import { get } from 'svelte/store';
import { skills as skillsStore } from '$lib/stores/skills.svelte';
import type { ClaudeAnalysis } from '$lib/services/claude-api';
import type { Skill } from '$lib/stores/skills.svelte';

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
 */
function calculateMatchScore(skill: Skill, goal: AnalyzedGoal): number {
	let score = 0;
	const skillNameLower = skill.name.toLowerCase();
	const skillDescLower = skill.description.toLowerCase();
	const skillTags = skill.tags.map(t => t.toLowerCase());

	// Direct technology match (highest weight)
	for (const tech of goal.technologies) {
		const skillsForTech = TECH_TO_SKILLS[tech] || [];
		if (skillsForTech.includes(skill.id)) {
			score += 0.5;
		}
		// Partial match in name/tags
		if (skillNameLower.includes(tech) || skillTags.some(t => t.includes(tech))) {
			score += 0.3;
		}
	}

	// Feature match
	for (const feature of goal.features) {
		const skillsForFeature = FEATURE_TO_SKILLS[feature] || [];
		if (skillsForFeature.includes(skill.id)) {
			score += 0.3;
		}
		if (skillNameLower.includes(feature) || skillTags.some(t => t.includes(feature))) {
			score += 0.2;
		}
	}

	// Domain match
	for (const domain of goal.domains) {
		const skillsForDomain = DOMAIN_TO_SKILLS[domain] || [];
		if (skillsForDomain.includes(skill.id)) {
			score += 0.2;
		}
	}

	// Keyword match
	for (const keyword of goal.keywords) {
		if (skillNameLower.includes(keyword)) {
			score += 0.15;
		} else if (skillDescLower.includes(keyword)) {
			score += 0.1;
		} else if (skillTags.some(t => t.includes(keyword))) {
			score += 0.1;
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

	// Check technology matches
	for (const tech of goal.technologies) {
		const skillsForTech = TECH_TO_SKILLS[tech] || [];
		if (skillsForTech.includes(skill.id)) {
			reasons.push(`matches ${tech}`);
		}
	}

	// Check feature matches
	for (const feature of goal.features) {
		const skillsForFeature = FEATURE_TO_SKILLS[feature] || [];
		if (skillsForFeature.includes(skill.id)) {
			reasons.push(`provides ${feature}`);
		}
	}

	// Check domain matches
	for (const domain of goal.domains) {
		const skillsForDomain = DOMAIN_TO_SKILLS[domain] || [];
		if (skillsForDomain.includes(skill.id)) {
			reasons.push(`${domain} expertise`);
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
 * Match skills using Claude API analysis
 */
async function matchSkillsClaude(goal: AnalyzedGoal, maxResults: number): Promise<{ skills: MatchedSkill[]; analysis?: ClaudeAnalysis }> {
	try {
		// Set available skills for context
		const allSkills = get(skillsStore);
		claudeClient.setAvailableSkills(allSkills.map(s => s.id));

		// Get Claude analysis
		const result = await claudeClient.analyzeGoal(goal.original);

		if (!result.success || !result.analysis) {
			return { skills: [] };
		}

		const analysis = result.analysis;

		// Convert suggested skill IDs to MatchedSkill objects
		const matchedSkills: MatchedSkill[] = [];

		for (let i = 0; i < analysis.suggestedSkills.length && matchedSkills.length < maxResults; i++) {
			const skillId = analysis.suggestedSkills[i];
			const skill = allSkills.find(s => s.id === skillId);

			if (skill) {
				matchedSkills.push({
					skillId: skill.id,
					name: skill.name,
					description: skill.description,
					category: skill.category,
					score: 1 - (i * 0.1), // Decay score by position
					matchReason: 'recommended by Claude',
					tier: (i < 3 ? 1 : i < 6 ? 2 : 3) as 1 | 2 | 3,
					tags: skill.tags
				});
			} else {
				// Skill suggested by Claude but not in our store - create a basic entry
				matchedSkills.push({
					skillId,
					name: skillId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
					description: `Suggested by Claude for ${goal.domains[0] || 'your project'}`,
					category: 'development',
					score: 1 - (i * 0.1),
					matchReason: 'recommended by Claude',
					tier: (i < 3 ? 1 : i < 6 ? 2 : 3) as 1 | 2 | 3,
					tags: []
				});
			}
		}

		return { skills: matchedSkills, analysis };
	} catch (error) {
		console.warn('Claude skill matching failed:', error);
		return { skills: [] };
	}
}

/**
 * Match skills via MCP (when connected)
 */
async function matchSkillsMcp(goal: AnalyzedGoal, maxResults: number): Promise<MatchedSkill[]> {
	try {
		// Build search query from goal
		const searchTerms = [
			...goal.technologies,
			...goal.features,
			...goal.domains,
			...goal.keywords.slice(0, 5)
		].join(' ');

		// Query MCP for skills
		const result = await mcpClient.searchSkills(searchTerms);

		if (!result || !result.skills || result.skills.length === 0) {
			// Fall back to local matching
			return matchSkillsLocal(goal, maxResults);
		}

		// Convert MCP skills to MatchedSkill format
		const matched: MatchedSkill[] = result.skills.slice(0, maxResults).map((mcpSkill: any, index: number) => ({
			skillId: mcpSkill.id || mcpSkill.name?.toLowerCase().replace(/\s+/g, '-'),
			name: mcpSkill.name,
			description: mcpSkill.description || '',
			category: mcpSkill.category || 'development',
			score: 1 - (index * 0.1), // Decay score by position
			matchReason: 'recommended by AI',
			tier: (index < 3 ? 1 : index < 6 ? 2 : 3) as 1 | 2 | 3,
			tags: mcpSkill.tags || []
		}));

		return matched;
	} catch (error) {
		console.error('MCP skill search failed, falling back to local:', error);
		return matchSkillsLocal(goal, maxResults);
	}
}

/**
 * Main function: Match skills to a goal
 *
 * Uses LOCAL pattern matching - no external dependencies.
 * Skills are already loaded from static JSON.
 *
 * This ensures goal processing works instantly without network calls.
 */
export async function matchSkills(
	goal: AnalyzedGoal,
	options: { maxResults?: number; minScore?: number } = {}
): Promise<MatchResult> {
	const startTime = Date.now();
	const maxResults = options.maxResults || GOAL_VALIDATION.MAX_SKILLS_TO_SUGGEST;

	// Use local matching - fast, reliable, no network dependencies
	console.log('[SkillMatcher] Using local pattern matching (no network calls)');
	let skills = matchSkillsLocal(goal, maxResults);
	const source: 'claude' | 'mcp' | 'local' | 'hybrid' = 'local';
	const claudeAnalysis: ClaudeAnalysis | undefined = undefined;

	console.log(`[SkillMatcher] Matched ${skills.length} skills locally`);

	// Apply minimum score filter if specified
	if (options.minScore) {
		skills = skills.filter(s => s.score >= options.minScore!);
	}

	// Ensure we have at least some skills for non-vague inputs
	if (skills.length === 0 && goal.confidence > 0.3) {
		// Add some default starter skills based on common patterns
		skills = getDefaultSkills(goal, maxResults);
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
