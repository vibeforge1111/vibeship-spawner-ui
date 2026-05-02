/**
 * Workflow Generator Service
 *
 * Creates canvas nodes and connections from matched skills.
 */

import type { AnalyzedGoal, MatchedSkill, GeneratedWorkflow } from '$lib/types/goal';
import skillDetails from '$lib/data/skill-details.json';

type SkillRelationshipRecord = {
	delegates?: Array<{ skill?: string }>;
	pairsWell?: string[];
};

const RELATIONSHIP_DETAILS = skillDetails as Record<string, SkillRelationshipRecord>;

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

// Category groupings for layout
const CATEGORY_ROWS: Record<string, number> = {
	frontend: 0,
	frameworks: 0,
	development: 1,
	backend: 1,
	'ai': 2,
	'ai-agents': 2,
	'ai-ml': 2,
	agents: 2,
	integrations: 2,
	data: 3,
	enterprise: 3,
	finance: 3,
	trading: 3,
	design: 4,
	creative: 4,
	'game-dev': 4,
	marketing: 5,
	devops: 5,
	security: 5,
	testing: 5
};

function getRelatedSkillIds(skillId: string): string[] {
	const details = RELATIONSHIP_DETAILS[skillId];
	if (!details) return [];

	return [
		...(details.delegates || [])
			.map((delegate) => delegate.skill)
			.filter((id): id is string => Boolean(id)),
		...(details.pairsWell || [])
	].filter((id, index, all) => all.indexOf(id) === index && Boolean(RELATIONSHIP_DETAILS[id]));
}

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

	for (let sourceIndex = 0; sourceIndex < skills.length; sourceIndex++) {
		for (let targetIndex = sourceIndex + 1; targetIndex < skills.length; targetIndex++) {
			const sourceSkill = skills[sourceIndex];
			const targetSkill = skills[targetIndex];
			const sourceRelatedSkills = getRelatedSkillIds(sourceSkill.skillId);
			const targetRelatedSkills = getRelatedSkillIds(targetSkill.skillId);
			const hasForwardRelation = sourceRelatedSkills.includes(targetSkill.skillId);
			const hasReverseRelation = targetRelatedSkills.includes(sourceSkill.skillId);

			if (!skillIds.has(sourceSkill.skillId) || !skillIds.has(targetSkill.skillId)) continue;
			if (!hasForwardRelation && !hasReverseRelation) continue;

			const connectionKey = `${sourceSkill.skillId}->${targetSkill.skillId}`;
			if (addedConnections.has(connectionKey)) continue;

			connections.push({
				sourceId: sourceSkill.skillId,
				targetId: targetSkill.skillId
			});
			addedConnections.add(connectionKey);
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
