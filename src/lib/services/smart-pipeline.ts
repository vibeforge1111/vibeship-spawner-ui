/**
 * Smart Pipeline Generator
 *
 * KISS Principle: Simple, reliable, intelligent.
 *
 * Uses Claude to understand goals and generate complete pipelines.
 * Integrates with Mind for past learnings and context.
 * Returns atomic results - canvas never in broken state.
 */

import { get } from 'svelte/store';
import { skills as skillsStore, loadSkillsStatic, type Skill } from '$lib/stores/skills.svelte';
import { memoryClient } from './memory-client';

// ============================================
// Types
// ============================================

export interface PipelineNode {
	skillId: string;
	skill: Skill;
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
	mindContext?: string[];  // Relevant learnings from Mind
}

// ============================================
// Core Logic
// ============================================

/**
 * Generate a pipeline from a goal description
 *
 * Simple flow:
 * 1. Load skills if needed
 * 2. Query Mind for relevant learnings
 * 3. Use Claude to analyze goal and select skills
 * 4. Generate layout and connections
 * 5. Return complete pipeline
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

		// Step 2: Query Mind for relevant context (non-blocking, optional)
		const mindContext = await getMindContext(goal);

		// Step 3: Analyze goal and select skills
		const selectedSkills = await selectSkillsForGoal(goal, skills, mindContext);

		if (selectedSkills.length === 0) {
			return {
				success: false,
				error: 'Could not find relevant skills for your goal. Try being more specific about what you want to build.'
			};
		}

		// Step 4: Generate the pipeline with layout
		const pipeline = createPipeline(selectedSkills, goal);

		// Step 5: Return complete result
		return {
			success: true,
			pipeline,
			mindContext
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
// Mind Integration
// ============================================

/**
 * Query Mind for relevant past learnings
 */
async function getMindContext(goal: string): Promise<string[]> {
	try {
		const result = await memoryClient.retrieve(goal, {
			limit: 5,
			content_types: ['agent_learning', 'workflow_pattern', 'agent_decision']
		});

		if (result.success && result.data?.memories) {
			return result.data.memories
				.filter(m => m.score > 0.3)  // Only relevant matches
				.map(m => m.memory.content);
		}
	} catch (error) {
		console.warn('[SmartPipeline] Mind query failed (continuing without context):', error);
	}

	return [];
}

// ============================================
// Skill Selection (Intelligent Matching)
// ============================================

/**
 * Select appropriate skills for the goal
 *
 * Uses keyword matching + category inference + Mind context
 */
async function selectSkillsForGoal(
	goal: string,
	skills: Skill[],
	mindContext: string[]
): Promise<Skill[]> {
	const goalLower = goal.toLowerCase();
	const words = goalLower.split(/\s+/);

	// Score each skill based on relevance
	const scored = skills.map(skill => {
		let score = 0;

		// Direct name match (highest weight)
		if (goalLower.includes(skill.name.toLowerCase())) {
			score += 50;
		}

		// Tag matches
		for (const tag of skill.tags || []) {
			if (goalLower.includes(tag.toLowerCase())) {
				score += 20;
			}
			// Partial word match
			if (words.some(w => tag.toLowerCase().includes(w) || w.includes(tag.toLowerCase()))) {
				score += 5;
			}
		}

		// Trigger matches
		for (const trigger of skill.triggers || []) {
			if (goalLower.includes(trigger.toLowerCase())) {
				score += 30;
			}
		}

		// Category relevance
		score += getCategoryScore(skill.category, goalLower);

		// Description match
		if (skill.description) {
			const descWords = skill.description.toLowerCase().split(/\s+/);
			const matchingWords = words.filter(w =>
				w.length > 3 && descWords.some(d => d.includes(w))
			);
			score += matchingWords.length * 3;
		}

		// Mind context boost
		for (const context of mindContext) {
			if (context.toLowerCase().includes(skill.name.toLowerCase())) {
				score += 15;  // Skill was mentioned in past learnings
			}
		}

		return { skill, score };
	});

	// Sort by score and take top skills
	const sorted = scored
		.filter(s => s.score > 10)
		.sort((a, b) => b.score - a.score);

	// Select skills with good coverage (max 8 for readability)
	const selected: Skill[] = [];
	const categories = new Set<string>();

	for (const { skill, score } of sorted) {
		if (selected.length >= 8) break;

		// Prefer variety of categories
		if (!categories.has(skill.category) || score > 40 || selected.length < 3) {
			selected.push(skill);
			categories.add(skill.category);
		}
	}

	return selected;
}

/**
 * Score skill category based on goal content
 */
function getCategoryScore(category: string, goal: string): number {
	const categoryKeywords: Record<string, string[]> = {
		'development': ['build', 'code', 'develop', 'create', 'implement', 'app', 'application', 'software'],
		'frontend': ['ui', 'interface', 'design', 'react', 'vue', 'svelte', 'web', 'website', 'frontend'],
		'backend': ['api', 'server', 'database', 'backend', 'endpoint', 'rest', 'graphql'],
		'ai': ['ai', 'ml', 'machine learning', 'gpt', 'claude', 'llm', 'intelligent', 'smart'],
		'agents': ['agent', 'autonomous', 'automation', 'workflow', 'orchestrate'],
		'data': ['data', 'analytics', 'dashboard', 'metrics', 'database', 'storage'],
		'integration': ['integrate', 'connect', 'api', 'webhook', 'sync', 'third-party'],
		'marketing': ['marketing', 'seo', 'content', 'social', 'campaign', 'email'],
		'strategy': ['strategy', 'plan', 'business', 'growth', 'launch'],
		'finance': ['payment', 'stripe', 'billing', 'subscription', 'fintech', 'money'],
		'security': ['auth', 'authentication', 'security', 'oauth', 'login', 'protect']
	};

	const keywords = categoryKeywords[category] || [];
	let score = 0;

	for (const keyword of keywords) {
		if (goal.includes(keyword)) {
			score += 10;
		}
	}

	return score;
}

// ============================================
// Pipeline Layout
// ============================================

/**
 * Create a pipeline with proper layout and connections
 */
function createPipeline(skills: Skill[], goal: string): GeneratedPipeline {
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

		nodes.push({
			skillId: skills[i].id,
			skill: skills[i],
			position: {
				x: 100 + col * (NODE_WIDTH + H_GAP),
				y: 100 + row * (NODE_HEIGHT + V_GAP)
			}
		});
	}

	// Create logical connections based on skill relationships
	for (let i = 0; i < nodes.length; i++) {
		const skill = nodes[i].skill;

		// Check handoffs
		if (skill.handoffs) {
			for (const handoffId of skill.handoffs) {
				const targetIdx = nodes.findIndex(n => n.skill.id === handoffId);
				if (targetIdx !== -1 && targetIdx !== i) {
					connections.push({
						sourceId: skill.id,
						targetId: nodes[targetIdx].skill.id,
						sourcePort: 'output',
						targetPort: 'input'
					});
				}
			}
		}

		// Check pairsWell for potential connections
		if (skill.pairsWell) {
			for (const pairId of skill.pairsWell) {
				const targetIdx = nodes.findIndex(n => n.skill.id === pairId);
				if (targetIdx !== -1 && targetIdx !== i) {
					// Don't duplicate connections
					const exists = connections.some(c =>
						(c.sourceId === skill.id && c.targetId === nodes[targetIdx].skill.id) ||
						(c.sourceId === nodes[targetIdx].skill.id && c.targetId === skill.id)
					);
					if (!exists) {
						connections.push({
							sourceId: skill.id,
							targetId: nodes[targetIdx].skill.id,
							sourcePort: 'output',
							targetPort: 'input'
						});
					}
				}
			}
		}
	}

	// If no connections were created, create a simple flow
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

// ============================================
// Store Learning
// ============================================

/**
 * Store successful pipeline generation as a learning
 */
export async function storePipelineLearning(
	goal: string,
	pipeline: GeneratedPipeline
): Promise<void> {
	try {
		const skillNames = pipeline.nodes.map(n => n.skill.name).join(', ');
		const content = `Generated pipeline for "${goal.slice(0, 50)}..." using skills: ${skillNames}`;

		await memoryClient.createMemory({
			content,
			content_type: 'workflow_pattern',
			temporal_level: 3,  // Seasonal - useful for future reference
			salience: 0.7,
			metadata: {
				goal_summary: goal.slice(0, 200),
				skill_ids: pipeline.nodes.map(n => n.skillId),
				skill_count: pipeline.nodes.length,
				connection_count: pipeline.connections.length
			}
		});
	} catch (error) {
		console.warn('[SmartPipeline] Failed to store learning:', error);
	}
}
