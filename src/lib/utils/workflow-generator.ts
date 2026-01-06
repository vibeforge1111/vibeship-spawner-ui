/**
 * Workflow Generator
 *
 * Converts parsed implementation tasks into canvas nodes and connections.
 * Maps skill IDs to actual skills from the skills store.
 */

import type { ParsedTask } from '$lib/stores/project-docs.svelte';
import type { Skill } from '$lib/stores/skills.svelte';
import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';

export interface GeneratedWorkflow {
	nodes: { skill: Skill; position: { x: number; y: number } }[];
	connections: { sourceIndex: number; targetIndex: number }[];
}

/**
 * Create a placeholder skill when no matching skill is found
 */
function createPlaceholderSkill(task: ParsedTask): Skill {
	return {
		id: task.skillId || `placeholder-${task.id}`,
		name: task.title,
		description: task.description,
		category: getCategoryFromPhase(task.category),
		tags: [],
		triggers: [],
		layer: 1
	};
}

/**
 * Map phase name to category
 */
function getCategoryFromPhase(phase: string): string {
	const lower = phase.toLowerCase();
	if (lower.includes('foundation') || lower.includes('setup')) return 'development';
	if (lower.includes('core') || lower.includes('feature')) return 'development';
	if (lower.includes('integration')) return 'integration';
	if (lower.includes('deploy') || lower.includes('infra')) return 'devops';
	if (lower.includes('design')) return 'design';
	if (lower.includes('test')) return 'testing';
	return 'development';
}

/**
 * Find the best matching skill from available skills
 */
function findMatchingSkill(task: ParsedTask, availableSkills: Skill[]): Skill | null {
	// Try exact ID match first
	if (task.skillId) {
		const exactMatch = availableSkills.find(
			s => s.id.toLowerCase() === task.skillId?.toLowerCase()
		);
		if (exactMatch) return exactMatch;

		// Try partial match on ID
		const partialMatch = availableSkills.find(
			s => s.id.toLowerCase().includes(task.skillId?.toLowerCase() || '') ||
				task.skillId?.toLowerCase().includes(s.id.toLowerCase())
		);
		if (partialMatch) return partialMatch;
	}

	// Try matching by name
	const nameMatch = availableSkills.find(
		s => s.name.toLowerCase().includes(task.title.toLowerCase()) ||
			task.title.toLowerCase().includes(s.name.toLowerCase())
	);
	if (nameMatch) return nameMatch;

	// Try matching by tags
	const tagMatch = availableSkills.find(s =>
		s.tags?.some(tag =>
			task.title.toLowerCase().includes(tag.toLowerCase()) ||
			task.description.toLowerCase().includes(tag.toLowerCase())
		)
	);
	if (tagMatch) return tagMatch;

	return null;
}

/**
 * Calculate optimal positions for nodes based on dependencies
 * Uses a layered approach: tasks with no deps go first, then their dependents, etc.
 */
function calculatePositions(tasks: ParsedTask[]): Map<string, { x: number; y: number }> {
	const positions = new Map<string, { x: number; y: number }>();
	const taskMap = new Map(tasks.map(t => [t.title, t]));

	// Build dependency graph
	const layers: string[][] = [];
	const placed = new Set<string>();

	// First pass: find tasks with no dependencies
	const noDeps = tasks.filter(t => t.dependsOn.length === 0);
	if (noDeps.length > 0) {
		layers.push(noDeps.map(t => t.title));
		noDeps.forEach(t => placed.add(t.title));
	}

	// Subsequent passes: add tasks whose deps are all placed
	let safety = 0;
	while (placed.size < tasks.length && safety < 100) {
		const nextLayer: string[] = [];
		for (const task of tasks) {
			if (placed.has(task.title)) continue;

			// Check if all dependencies are placed
			const allDepsPlaced = task.dependsOn.every(dep => {
				// Find the task by name (deps are task titles)
				const depTask = tasks.find(t => t.title === dep);
				return depTask ? placed.has(depTask.title) : true;
			});

			if (allDepsPlaced) {
				nextLayer.push(task.title);
			}
		}

		if (nextLayer.length > 0) {
			layers.push(nextLayer);
			nextLayer.forEach(t => placed.add(t));
		}
		safety++;
	}

	// Handle any orphaned tasks (circular deps or missing deps)
	for (const task of tasks) {
		if (!placed.has(task.title)) {
			const lastLayer = layers[layers.length - 1];
			if (lastLayer) {
				lastLayer.push(task.title);
			} else {
				layers.push([task.title]);
			}
		}
	}

	// Calculate positions
	const NODE_WIDTH = 200;
	const NODE_HEIGHT = 60;
	const GAP_X = 80;
	const GAP_Y = 100;
	const START_X = 100;
	const START_Y = 100;

	for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
		const layer = layers[layerIdx];
		const layerHeight = layer.length * (NODE_HEIGHT + GAP_Y);
		const startY = START_Y + (layerIdx === 0 ? 0 : GAP_Y);

		for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
			const taskTitle = layer[nodeIdx];
			positions.set(taskTitle, {
				x: START_X + layerIdx * (NODE_WIDTH + GAP_X),
				y: startY + nodeIdx * (NODE_HEIGHT + GAP_Y)
			});
		}
	}

	return positions;
}

/**
 * Generate workflow from parsed tasks
 */
export function generateWorkflow(
	tasks: ParsedTask[],
	availableSkills: Skill[]
): GeneratedWorkflow {
	if (tasks.length === 0) {
		return { nodes: [], connections: [] };
	}

	// Calculate positions
	const positions = calculatePositions(tasks);

	// Create nodes
	const nodes: GeneratedWorkflow['nodes'] = [];
	const taskIndexMap = new Map<string, number>(); // title -> index

	for (const task of tasks) {
		const skill = findMatchingSkill(task, availableSkills) || createPlaceholderSkill(task);
		const position = positions.get(task.title) || { x: 100, y: 100 };

		taskIndexMap.set(task.title, nodes.length);
		nodes.push({ skill, position });
	}

	// Create connections based on dependencies
	const connections: GeneratedWorkflow['connections'] = [];

	for (const task of tasks) {
		const targetIndex = taskIndexMap.get(task.title);
		if (targetIndex === undefined) continue;

		for (const depTitle of task.dependsOn) {
			const sourceIndex = taskIndexMap.get(depTitle);
			if (sourceIndex !== undefined) {
				connections.push({ sourceIndex, targetIndex });
			}
		}
	}

	return { nodes, connections };
}

/**
 * Generate a mission from parsed tasks (for MCP execution)
 */
export function generateMissionFromTasks(
	projectName: string,
	tasks: ParsedTask[],
	context: {
		projectPath?: string;
		techStack?: string[];
		goals?: string[];
	} = {}
) {
	// Group tasks by category to create agents
	const tasksByCategory = new Map<string, ParsedTask[]>();
	for (const task of tasks) {
		const category = getCategoryFromPhase(task.category);
		if (!tasksByCategory.has(category)) {
			tasksByCategory.set(category, []);
		}
		tasksByCategory.get(category)!.push(task);
	}

	// Create agents from categories
	const agents = Array.from(tasksByCategory.keys()).map(category => ({
		id: `agent-${category}`,
		name: `${category.charAt(0).toUpperCase() + category.slice(1)} Agent`,
		role: `Handles ${category} tasks`,
		skills: tasksByCategory.get(category)?.map(t => t.skillId).filter(Boolean) as string[] || [],
		model: 'sonnet' as const
	}));

	// Create mission tasks
	const taskMap = new Map(tasks.map(t => [t.title, t]));
	const missionTasks = tasks.map(task => {
		const category = getCategoryFromPhase(task.category);
		return {
			id: task.id,
			title: task.title,
			description: task.description,
			assignedTo: `agent-${category}`,
			dependsOn: task.dependsOn
				.map(depTitle => {
					const depTask = taskMap.get(depTitle);
					return depTask?.id;
				})
				.filter(Boolean) as string[],
			status: 'pending' as const,
			handoffType: 'sequential' as const
		};
	});

	return {
		name: projectName,
		description: `Implementation plan for ${projectName}`,
		mode: 'claude-code' as const,
		context: {
			projectPath: context.projectPath || '.',
			projectType: 'general',
			techStack: context.techStack || [],
			constraints: [],
			goals: context.goals || [`Build ${projectName}`]
		},
		agents,
		tasks: missionTasks
	};
}
