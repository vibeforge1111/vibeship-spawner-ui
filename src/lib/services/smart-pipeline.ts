/**
 * Smart Pipeline Generator
 *
 * KISS Principle: Simple, reliable, intelligent.
 *
 * Uses Claude to understand goals and generate complete pipelines.
 * Returns atomic results - canvas never in broken state.
 */

import { get } from 'svelte/store';
import { skills as skillsStore, loadSkillsStatic, type Skill } from '$lib/stores/skills.svelte';
import { rankSkillsForText, type SkillRecommendationTier } from './h70-skill-matcher';

const MAX_PIPELINE_SKILLS = 10;

// ============================================
// Types
// ============================================

export interface PipelineNode {
	skillId: string;
	skill: Skill;
	recommendationTier: SkillRecommendationTier;
	position: { x: number; y: number };
}

export interface PipelineConnection {
	sourceId: string;
	targetId: string;
	sourcePort: string;
	targetPort: string;
}

export interface GeneratedPipeline {
	nodes: PipelineNode[];
	connections: PipelineConnection[];
	summary: string;
	reasoning: string;
}

export interface PipelineResult {
	success: boolean;
	pipeline?: GeneratedPipeline;
	error?: string;
}

// ============================================
// Core Logic
// ============================================

/**
 * Generate a pipeline from a goal description
 *
 * Simple flow:
 * 1. Load skills if needed
 * 2. Analyze goal and select skills
 * 3. Generate layout and connections
 * 4. Return complete pipeline
 */
export async function generatePipeline(goal: string): Promise<PipelineResult> {
	try {
		// Step 1: Ensure skills are loaded
		let skills = get(skillsStore);
		if (skills.length === 0) {
			await loadSkillsStatic();
			skills = get(skillsStore);
		}

		if (skills.length === 0) {
			return { success: false, error: 'No skills available' };
		}

		// Step 2: Analyze goal and select skills
		const selectedSkills = await selectSkillsForGoal(goal, skills);

		if (selectedSkills.length === 0) {
			return {
				success: false,
				error: 'Could not find relevant skills for your goal. Try being more specific about what you want to build.'
			};
		}

		// Step 3: Generate the pipeline with layout
		const pipeline = createPipeline(selectedSkills, goal);

		// Step 4: Return complete result
		return {
			success: true,
			pipeline
		};

	} catch (error) {
		console.error('[SmartPipeline] Error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Failed to generate pipeline'
		};
	}
}

// ============================================
// Skill Selection (Intelligent Matching)
// ============================================

/**
 * Select appropriate skills for the goal
 *
 * Uses keyword matching + category inference
 */
async function selectSkillsForGoal(
	goal: string,
	skills: Skill[]
): Promise<Array<{ skill: Skill; recommendationTier: SkillRecommendationTier }>> {
	const skillById = new Map(skills.map((skill) => [skill.id, skill]));
	return rankSkillsForText(goal, MAX_PIPELINE_SKILLS)
		.map((rank) => {
			const skill = skillById.get(rank.skillId);
			return skill ? { skill, recommendationTier: rank.recommendationTier } : null;
		})
		.filter((entry): entry is { skill: Skill; recommendationTier: SkillRecommendationTier } => Boolean(entry));
}

// ============================================
// Pipeline Layout
// ============================================

/**
 * Create a pipeline with proper layout and connections
 */
function createPipeline(
	skills: Array<{ skill: Skill; recommendationTier: SkillRecommendationTier }>,
	goal: string
): GeneratedPipeline {
	const nodes: PipelineNode[] = [];
	const connections: PipelineConnection[] = [];

	// Layout constants
	const NODE_WIDTH = 200;
	const NODE_HEIGHT = 60;
	const H_GAP = 80;
	const V_GAP = 40;
	const COLS = 3;

	// Create nodes in a grid layout
	for (let i = 0; i < skills.length; i++) {
		const col = i % COLS;
		const row = Math.floor(i / COLS);
		const { skill, recommendationTier } = skills[i];

		nodes.push({
			skillId: skill.id,
			skill,
			recommendationTier,
			position: {
				x: 100 + col * (NODE_WIDTH + H_GAP),
				y: 100 + row * (NODE_HEIGHT + V_GAP)
			}
		});
	}

	// Create logical connections based on skill relationships
	// IMPORTANT: Only create forward connections (to later nodes) to prevent cycles
	const connectedPairs = new Set<string>();

	for (let i = 0; i < nodes.length; i++) {
		const skill = nodes[i].skill;

		// Check handoffs - only connect to nodes that come AFTER this one
		if (skill.handoffs) {
			for (const handoff of skill.handoffs) {
				const targetIdx = nodes.findIndex(n => n.skill.id === handoff.to);
				// Only connect to later nodes to prevent cycles
				if (targetIdx !== -1 && targetIdx > i) {
					const pairKey = `${skill.id}->${nodes[targetIdx].skill.id}`;
					if (!connectedPairs.has(pairKey)) {
						connections.push({
							sourceId: skill.id,
							targetId: nodes[targetIdx].skill.id,
							sourcePort: 'output',
							targetPort: 'input'
						});
						connectedPairs.add(pairKey);
					}
				}
			}
		}

		// Check pairsWell - only connect to later nodes to prevent cycles
		if (skill.pairsWell) {
			for (const pairId of skill.pairsWell) {
				const targetIdx = nodes.findIndex(n => n.skill.id === pairId);
				// Only connect to later nodes to prevent cycles
				if (targetIdx !== -1 && targetIdx > i) {
					const pairKey = `${skill.id}->${nodes[targetIdx].skill.id}`;
					if (!connectedPairs.has(pairKey)) {
						connections.push({
							sourceId: skill.id,
							targetId: nodes[targetIdx].skill.id,
							sourcePort: 'output',
							targetPort: 'input'
						});
						connectedPairs.add(pairKey);
					}
				}
			}
		}
	}

	// If no connections were created, create a simple sequential flow
	if (connections.length === 0 && nodes.length > 1) {
		for (let i = 0; i < nodes.length - 1; i++) {
			connections.push({
				sourceId: nodes[i].skill.id,
				targetId: nodes[i + 1].skill.id,
				sourcePort: 'output',
				targetPort: 'input'
			});
		}
	}

	return {
		nodes,
		connections,
		summary: goal.slice(0, 100) + (goal.length > 100 ? '...' : ''),
		reasoning: `Selected ${nodes.length} skills based on goal analysis. Created ${connections.length} connections based on skill relationships.`
	};
}

