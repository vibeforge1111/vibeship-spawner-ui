/**
 * Workflow Generator Service
 *
 * Creates canvas nodes and connections from matched skills.
 */

import type { AnalyzedGoal, MatchedSkill, GeneratedWorkflow } from '$lib/types/goal';

// Layout configuration
const LAYOUT = {
	NODE_WIDTH: 200,
	NODE_HEIGHT: 80,
	HORIZONTAL_GAP: 80,
	VERTICAL_GAP: 60,
	START_X: 100,
	START_Y: 100,
	MAX_NODES_PER_ROW: 4
};

// Skill relationship mappings (which skills connect to which)
const SKILL_RELATIONSHIPS: Record<string, string[]> = {
	// Auth flows
	'authentication-oauth': ['supabase-auth', 'nextjs-app-router', 'api-design'],
	'supabase-auth': ['supabase-backend', 'api-design'],

	// Backend flows
	'supabase-backend': ['api-design', 'error-handling-patterns'],
	'api-design': ['error-handling-patterns', 'integration-testing'],

	// Frontend flows
	'nextjs-app-router': ['react-patterns', 'tailwind-patterns'],
	'react-patterns': ['frontend-design', 'state-management'],

	// Payment flows
	'stripe-payments': ['api-design', 'webhook-patterns', 'error-handling-patterns'],
	'fintech-integration': ['stripe-payments', 'compliance-automation'],

	// Data flows
	'data-pipeline': ['supabase-backend', 'analytics-patterns'],
	'elasticsearch-search': ['api-design', 'supabase-backend'],

	// AI flows
	'llm-integration': ['api-design', 'streaming-responses'],
	'ai-patterns': ['llm-integration', 'error-handling-patterns'],

	// Real-time flows
	'realtime-patterns': ['supabase-backend', 'websocket-patterns'],
	'chat-patterns': ['realtime-patterns', 'notification-patterns'],

	// Integration flows
	'webhook-patterns': ['api-design', 'error-handling-patterns'],
	'integration-patterns': ['api-design', 'webhook-patterns']
};

// Category groupings for layout
const CATEGORY_ROWS: Record<string, number> = {
	'frameworks': 0,
	'development': 1,
	'integrations': 2,
	'ai-ml': 2,
	'data': 3,
	'design': 4,
	'marketing': 5,
	'enterprise': 3,
	'finance': 3,
	'agents': 2
};

/**
 * Determine node position based on tier and index
 */
function calculateNodePosition(
	tier: 1 | 2 | 3,
	indexInTier: number,
	totalInTier: number
): { x: number; y: number } {
	// Tier determines the row
	const row = tier - 1;

	// Center nodes in their row
	const totalWidth = totalInTier * (LAYOUT.NODE_WIDTH + LAYOUT.HORIZONTAL_GAP) - LAYOUT.HORIZONTAL_GAP;
	const startX = LAYOUT.START_X + (LAYOUT.MAX_NODES_PER_ROW * (LAYOUT.NODE_WIDTH + LAYOUT.HORIZONTAL_GAP) - totalWidth) / 2;

	const x = startX + indexInTier * (LAYOUT.NODE_WIDTH + LAYOUT.HORIZONTAL_GAP);
	const y = LAYOUT.START_Y + row * (LAYOUT.NODE_HEIGHT + LAYOUT.VERTICAL_GAP);

	return { x, y };
}

/**
 * Calculate position using category-based layout
 */
function calculateCategoryPosition(
	skill: MatchedSkill,
	indexInCategory: number
): { x: number; y: number } {
	const row = CATEGORY_ROWS[skill.category] ?? 2;
	const x = LAYOUT.START_X + indexInCategory * (LAYOUT.NODE_WIDTH + LAYOUT.HORIZONTAL_GAP);
	const y = LAYOUT.START_Y + row * (LAYOUT.NODE_HEIGHT + LAYOUT.VERTICAL_GAP);

	return { x, y };
}

/**
 * Infer connections between skills based on relationships
 */
function inferConnections(skills: MatchedSkill[]): Array<{ sourceId: string; targetId: string }> {
	const skillIds = new Set(skills.map(s => s.skillId));
	const connections: Array<{ sourceId: string; targetId: string }> = [];
	const addedConnections = new Set<string>();

	for (const skill of skills) {
		const relatedSkills = SKILL_RELATIONSHIPS[skill.skillId] || [];

		for (const targetId of relatedSkills) {
			if (skillIds.has(targetId)) {
				const connectionKey = `${skill.skillId}->${targetId}`;
				if (!addedConnections.has(connectionKey)) {
					connections.push({
						sourceId: skill.skillId,
						targetId
					});
					addedConnections.add(connectionKey);
				}
			}
		}
	}

	// If no relationships found, connect by tier (essential → recommended → optional)
	if (connections.length === 0 && skills.length > 1) {
		const tierGroups: Record<number, MatchedSkill[]> = { 1: [], 2: [], 3: [] };
		for (const skill of skills) {
			tierGroups[skill.tier].push(skill);
		}

		// Connect tier 1 to tier 2
		if (tierGroups[1].length > 0 && tierGroups[2].length > 0) {
			connections.push({
				sourceId: tierGroups[1][0].skillId,
				targetId: tierGroups[2][0].skillId
			});
		}

		// Connect tier 2 to tier 3
		if (tierGroups[2].length > 0 && tierGroups[3].length > 0) {
			connections.push({
				sourceId: tierGroups[2][0].skillId,
				targetId: tierGroups[3][0].skillId
			});
		}

		// Connect within tiers horizontally
		for (const tier of [1, 2, 3]) {
			const group = tierGroups[tier];
			for (let i = 0; i < group.length - 1; i++) {
				connections.push({
					sourceId: group[i].skillId,
					targetId: group[i + 1].skillId
				});
			}
		}
	}

	return connections;
}

/**
 * Generate a summary of the goal for display
 */
function generateGoalSummary(goal: AnalyzedGoal): string {
	const parts: string[] = [];

	if (goal.domains.length > 0) {
		parts.push(goal.domains[0]);
	}

	if (goal.technologies.length > 0) {
		parts.push(`using ${goal.technologies.slice(0, 2).join(', ')}`);
	}

	if (goal.features.length > 0) {
		parts.push(`with ${goal.features.slice(0, 2).join(', ')}`);
	}

	if (parts.length === 0) {
		// Fall back to first few keywords
		return goal.keywords.slice(0, 3).join(', ') || 'Custom project';
	}

	// Capitalize first letter
	const summary = parts.join(' ');
	return summary.charAt(0).toUpperCase() + summary.slice(1);
}

/**
 * Main function: Generate workflow from matched skills
 */
export function generateWorkflow(
	skills: MatchedSkill[],
	goal: AnalyzedGoal
): GeneratedWorkflow {
	// Group skills by tier for positioning
	const tierGroups: Record<number, MatchedSkill[]> = { 1: [], 2: [], 3: [] };
	for (const skill of skills) {
		tierGroups[skill.tier].push(skill);
	}

	// Create nodes with positions
	const nodes: GeneratedWorkflow['nodes'] = [];

	for (const tier of [1, 2, 3] as const) {
		const group = tierGroups[tier];
		const totalInTier = group.length;

		group.forEach((skill, index) => {
			const position = calculateNodePosition(tier, index, totalInTier);
			nodes.push({
				skillId: skill.skillId,
				name: skill.name,
				position,
				tier
			});
		});
	}

	// Infer connections
	const connections = inferConnections(skills);

	// Generate goal context
	const goalContext = {
		original: goal.original,
		summary: generateGoalSummary(goal)
	};

	return {
		nodes,
		connections,
		goalContext
	};
}

/**
 * Alternative layout: Grid-based for many skills
 */
export function generateGridLayout(
	skills: MatchedSkill[],
	goal: AnalyzedGoal
): GeneratedWorkflow {
	const nodes: GeneratedWorkflow['nodes'] = [];
	const nodesPerRow = Math.ceil(Math.sqrt(skills.length));

	skills.forEach((skill, index) => {
		const row = Math.floor(index / nodesPerRow);
		const col = index % nodesPerRow;

		nodes.push({
			skillId: skill.skillId,
			name: skill.name,
			position: {
				x: LAYOUT.START_X + col * (LAYOUT.NODE_WIDTH + LAYOUT.HORIZONTAL_GAP),
				y: LAYOUT.START_Y + row * (LAYOUT.NODE_HEIGHT + LAYOUT.VERTICAL_GAP)
			},
			tier: skill.tier
		});
	});

	return {
		nodes,
		connections: inferConnections(skills),
		goalContext: {
			original: goal.original,
			summary: generateGoalSummary(goal)
		}
	};
}

/**
 * Alternative layout: Category-based grouping
 */
export function generateCategoryLayout(
	skills: MatchedSkill[],
	goal: AnalyzedGoal
): GeneratedWorkflow {
	// Group by category
	const categoryGroups: Record<string, MatchedSkill[]> = {};
	for (const skill of skills) {
		if (!categoryGroups[skill.category]) {
			categoryGroups[skill.category] = [];
		}
		categoryGroups[skill.category].push(skill);
	}

	const nodes: GeneratedWorkflow['nodes'] = [];

	for (const [category, group] of Object.entries(categoryGroups)) {
		group.forEach((skill, index) => {
			const position = calculateCategoryPosition(skill, index);
			nodes.push({
				skillId: skill.skillId,
				name: skill.name,
				position,
				tier: skill.tier
			});
		});
	}

	return {
		nodes,
		connections: inferConnections(skills),
		goalContext: {
			original: goal.original,
			summary: generateGoalSummary(goal)
		}
	};
}

/**
 * Choose best layout based on skill count and types
 */
export function generateOptimalWorkflow(
	skills: MatchedSkill[],
	goal: AnalyzedGoal
): GeneratedWorkflow {
	// Few skills: tier-based layout works best
	if (skills.length <= 6) {
		return generateWorkflow(skills, goal);
	}

	// Many skills with varied categories: category-based
	const categories = new Set(skills.map(s => s.category));
	if (categories.size >= 3) {
		return generateCategoryLayout(skills, goal);
	}

	// Many skills, few categories: grid layout
	return generateGridLayout(skills, goal);
}
