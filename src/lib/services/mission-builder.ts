/**
 * Mission Builder Service
 *
 * Converts canvas workflows to Mission format for execution.
 * Maps nodes to tasks, connections to handoffs, and generates agent assignments.
 *
 * NEW: Automatically loads H70 skills based on task types and includes
 * them in the execution prompt for Claude Code guidance.
 */

import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';
import type { MissionAgent, MissionTask, MissionContext, Mission } from '$lib/services/mcp-client';
import { mcpClient } from '$lib/services/mcp-client';
import { getAllRequiredSkills, getSkillPriorities, matchTaskToSkills } from './h70-skill-matcher';
import { loadCondensedSkillsForMission, type H70SkillContent } from './h70-skills';
import { browser } from '$app/environment';

export interface MissionBuildOptions {
	name: string;
	description?: string;
	mode?: Mission['mode'];
	projectPath?: string;
	projectType?: string;
	techStack?: string[];
	goals?: string[];
	/** Enable H70 skill auto-loading (default: true) */
	loadH70Skills?: boolean;
	/** Maximum skills to load per task (default: 3) */
	maxSkillsPerTask?: number;
	/** Maximum total skills to load (default: 10) */
	maxTotalSkills?: number;
}

export interface MissionBuildResult {
	success: boolean;
	mission?: Mission;
	error?: string;
	/** H70 skills loaded for this mission */
	loadedSkills?: Map<string, H70SkillContent>;
	/** Skill IDs matched per task */
	taskSkillMap?: Map<string, string[]>;
}

/**
 * Topologically sort nodes to determine execution order
 */
function topologicalSort(nodes: CanvasNode[], connections: Connection[]): CanvasNode[] {
	const adjacency = new Map<string, string[]>();
	const inDegree = new Map<string, number>();

	// Initialize
	for (const node of nodes) {
		adjacency.set(node.id, []);
		inDegree.set(node.id, 0);
	}

	// Build graph
	for (const conn of connections) {
		const targets = adjacency.get(conn.sourceNodeId) || [];
		targets.push(conn.targetNodeId);
		adjacency.set(conn.sourceNodeId, targets);
		inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) || 0) + 1);
	}

	// Kahn's algorithm
	const queue: string[] = [];
	for (const [nodeId, degree] of inDegree) {
		if (degree === 0) queue.push(nodeId);
	}

	const sorted: CanvasNode[] = [];
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	while (queue.length > 0) {
		const nodeId = queue.shift()!;
		const node = nodeMap.get(nodeId);
		if (node) sorted.push(node);

		const neighbors = adjacency.get(nodeId) || [];
		for (const neighbor of neighbors) {
			const newDegree = (inDegree.get(neighbor) || 1) - 1;
			inDegree.set(neighbor, newDegree);
			if (newDegree === 0) queue.push(neighbor);
		}
	}

	// Add unconnected nodes at the end
	for (const node of nodes) {
		if (!sorted.includes(node)) sorted.push(node);
	}

	return sorted;
}

/**
 * Generate agents from nodes based on skill categories
 */
function generateAgents(nodes: CanvasNode[]): MissionAgent[] {
	// Group nodes by category to create specialized agents
	const categoryGroups = new Map<string, CanvasNode[]>();

	for (const node of nodes) {
		const category = node.skill.category || 'general';
		const existing = categoryGroups.get(category) || [];
		existing.push(node);
		categoryGroups.set(category, existing);
	}

	const agents: MissionAgent[] = [];

	for (const [category, categoryNodes] of categoryGroups) {
		// Collect unique skills for this category
		const skills = [...new Set(categoryNodes.map((n) => n.skill.id))];

		// Create an agent for each category
		agents.push({
			id: `agent-${category.toLowerCase().replace(/\s+/g, '-')}`,
			name: `${capitalize(category)} Agent`,
			role: `Handles ${category.toLowerCase()} tasks`,
			skills,
			model: 'sonnet' // Default model
		});
	}

	// If only one agent, give it a better name
	if (agents.length === 1) {
		agents[0].name = 'Primary Agent';
		agents[0].role = 'Executes all workflow tasks';
	}

	return agents;
}

/**
 * Generate tasks from nodes with proper dependencies
 */
function generateTasks(
	nodes: CanvasNode[],
	connections: Connection[],
	agents: MissionAgent[]
): MissionTask[] {
	const sortedNodes = topologicalSort(nodes, connections);
	const tasks: MissionTask[] = [];

	// Build dependency map (which nodes lead to which)
	const dependencyMap = new Map<string, string[]>();
	for (const conn of connections) {
		const deps = dependencyMap.get(conn.targetNodeId) || [];
		deps.push(conn.sourceNodeId);
		dependencyMap.set(conn.targetNodeId, deps);
	}

	// Build handoff map (which nodes this leads to)
	const handoffMap = new Map<string, string[]>();
	for (const conn of connections) {
		const targets = handoffMap.get(conn.sourceNodeId) || [];
		targets.push(conn.targetNodeId);
		handoffMap.set(conn.sourceNodeId, targets);
	}

	for (const node of sortedNodes) {
		const skill = node.skill;

		// Find the appropriate agent based on skill category
		const category = skill.category || 'general';
		const agent = agents.find(
			(a) => a.id === `agent-${category.toLowerCase().replace(/\s+/g, '-')}`
		) || agents[0];

		// Get dependencies (tasks that must complete before this one)
		const dependsOn = dependencyMap.get(node.id) || [];

		// Get handoffs (tasks that follow this one)
		const handoffTo = handoffMap.get(node.id) || [];

		// Determine handoff type
		let handoffType: MissionTask['handoffType'] = 'sequential';
		if (handoffTo.length > 1) {
			handoffType = 'parallel';
		} else if (handoffTo.length === 0) {
			handoffType = 'sequential'; // Terminal node
		}

		tasks.push({
			id: node.id,
			title: skill.name,
			description: skill.description || `Execute ${skill.name} skill`,
			assignedTo: agent.id,
			dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
			status: 'pending',
			handoffType,
			handoffTo: handoffTo.length > 0 ? handoffTo : undefined
		});
	}

	return tasks;
}

/**
 * Build a Mission from canvas nodes and connections
 * NOTE: This builds the mission locally - no MCP call needed
 *
 * NEW: Automatically loads relevant H70 skills based on task types
 */
export async function buildMissionFromCanvas(
	nodes: CanvasNode[],
	connections: Connection[],
	options: MissionBuildOptions
): Promise<MissionBuildResult> {
	if (nodes.length === 0) {
		return { success: false, error: 'Cannot create mission from empty canvas' };
	}

	try {
		// Generate agents based on skill categories
		const agents = generateAgents(nodes);

		// Generate tasks with dependencies
		const tasks = generateTasks(nodes, connections, agents);

		// Build context
		const context: MissionContext = {
			projectPath: options.projectPath || '.',
			projectType: options.projectType || 'general',
			techStack: options.techStack || [],
			goals: options.goals || [options.description || `Complete ${options.name}`]
		};

		// Build mission locally (no MCP call - spawner_mission doesn't exist)
		const mission: Mission = {
			id: `mission-${Date.now()}`,
			name: options.name,
			description: options.description || '',
			status: 'ready',
			mode: options.mode || 'claude-code',
			agents,
			tasks,
			context,
			outputs: {},
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};

		// Auto-load H70 skills for the mission (browser only)
		let loadedSkills: Map<string, H70SkillContent> | undefined;
		let taskSkillMap: Map<string, string[]> | undefined;

		const shouldLoadSkills = browser && (options.loadH70Skills !== false);

		if (shouldLoadSkills) {
			// Dynamic limits based on task complexity
			// More tasks = more skills needed (but with reasonable caps)
			const taskCount = tasks.length;
			const defaultMaxPerTask = Math.min(5, Math.max(3, Math.ceil(taskCount / 3))); // 3-5 skills per task
			const defaultMaxTotal = Math.min(50, Math.max(15, taskCount * 2)); // Scale with tasks, cap at 50

			const maxPerTask = options.maxSkillsPerTask ?? defaultMaxPerTask;
			const maxTotal = options.maxTotalSkills ?? defaultMaxTotal;

			// Match tasks to skills
			taskSkillMap = new Map();
			const taskInfos = tasks.map(t => ({ name: t.title, description: t.description }));

			for (const task of tasks) {
				const matchedSkills = matchTaskToSkills(task.title, task.description, maxPerTask);
				taskSkillMap.set(task.id, matchedSkills);
			}

			// Get prioritized skills (most relevant across all tasks)
			const priorities = getSkillPriorities(taskInfos);
			const skillsToLoad = priorities.slice(0, maxTotal).map(p => p.skillId);

			console.log(`[MissionBuilder] Loading ${skillsToLoad.length} H70 skills (${taskCount} tasks, max ${maxTotal}):`, skillsToLoad);

			// Load the skills
			try {
				const { skills } = await loadCondensedSkillsForMission(skillsToLoad);
				loadedSkills = skills;
				console.log(`[MissionBuilder] Successfully loaded ${skills.size} H70 skills`);
			} catch (e) {
				console.warn('[MissionBuilder] Failed to load H70 skills:', e);
				// Continue without skills - don't fail the mission build
			}
		}

		return {
			success: true,
			mission,
			loadedSkills,
			taskSkillMap
		};
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : 'Unknown error building mission'
		};
	}
}

/**
 * Options for generating execution prompts
 */
export interface ExecutionPromptOptions {
	/** Loaded H70 skills to include in prompt */
	loadedSkills?: Map<string, H70SkillContent>;
	/** Mapping of task ID to recommended skill IDs */
	taskSkillMap?: Map<string, string[]>;
	/** Include full skill content (default: false, uses condensed) */
	fullSkillContent?: boolean;
}

/**
 * Generate a copy-pasteable execution prompt for Claude Code
 * Now includes H70 skill content automatically
 */
export function generateExecutionPrompt(
	mission: Mission,
	options?: ExecutionPromptOptions
): string {
	const { loadedSkills, taskSkillMap } = options || {};

	// Build task list with skill recommendations
	const taskList = mission.tasks
		.map((t, i) => {
			const deps = t.dependsOn?.length ? ` (after: ${t.dependsOn.join(', ')})` : '';
			const recommendedSkills = taskSkillMap?.get(t.id);
			const skillsLine = recommendedSkills?.length
				? `\n   **Recommended H70 Skills**: ${recommendedSkills.join(', ')}`
				: '';
			return `${i + 1}. **${t.title}** (id: ${t.id})${deps}\n   ${t.description}${skillsLine}`;
		})
		.join('\n\n');

	const skillList = [...new Set(mission.agents.flatMap(a => a.skills))].join(', ');

	// Build H70 skills section
	let h70SkillsSection = '';
	if (loadedSkills && loadedSkills.size > 0) {
		const skillEntries: string[] = [];
		skillEntries.push('## H70 Skills Reference\n');
		skillEntries.push('The following expert skills have been automatically loaded to guide this mission.');
		skillEntries.push('Follow their patterns and avoid their anti-patterns.\n');

		for (const [skillId, skillContent] of loadedSkills) {
			skillEntries.push(`### ${skillContent.skill.name}`);
			skillEntries.push('');

			// Include identity (first paragraph)
			if (skillContent.skill.identity) {
				const firstPara = skillContent.skill.identity.trim().split('\n\n')[0];
				skillEntries.push(firstPara);
				skillEntries.push('');
			}

			// Key patterns
			if (skillContent.skill.patterns && skillContent.skill.patterns.length > 0) {
				skillEntries.push('**Key Patterns:**');
				skillContent.skill.patterns.slice(0, 3).forEach(p => {
					skillEntries.push(`- **${p.name}**: ${p.when}`);
				});
				skillEntries.push('');
			}

			// Key anti-patterns
			if (skillContent.skill.anti_patterns && skillContent.skill.anti_patterns.length > 0) {
				skillEntries.push('**Avoid:**');
				skillContent.skill.anti_patterns.slice(0, 3).forEach(ap => {
					const firstLine = ap.why_bad.split('\n')[0];
					skillEntries.push(`- **${ap.name}**: ${firstLine}`);
				});
				skillEntries.push('');
			}

			// Critical lessons from disasters
			if (skillContent.skill.disasters && skillContent.skill.disasters.length > 0) {
				skillEntries.push('**Critical Lessons:**');
				skillContent.skill.disasters.slice(0, 2).forEach(d => {
					skillEntries.push(`- **${d.title}**: ${d.lesson.split('\n')[0]}`);
				});
				skillEntries.push('');
			}

			skillEntries.push('---\n');
		}

		h70SkillsSection = skillEntries.join('\n');
	}

	return `# Mission: ${mission.name}

${mission.description || ''}

## Context
- **Mission ID**: ${mission.id}
- **Project Path**: ${mission.context.projectPath}
- **Project Type**: ${mission.context.projectType}
- **Tech Stack**: ${mission.context.techStack?.join(', ') || 'Not specified'}
- **Goals**: ${mission.context.goals?.join('; ') || mission.description}

## Skills to Use
${skillList}

## Tasks (Execute in Order)

${taskList}

${h70SkillsSection}

## Progress Reporting (IMPORTANT)

Report progress to the Spawner UI by using the Bash tool to POST events:

\`\`\`bash
# When starting a task:
curl -X POST http://localhost:5173/api/events -H "Content-Type: application/json" -d '{"type":"task_started","missionId":"${mission.id}","taskId":"TASK_ID","taskName":"TASK_NAME"}'

# During task progress (0-100):
curl -X POST http://localhost:5173/api/events -H "Content-Type: application/json" -d '{"type":"progress","missionId":"${mission.id}","taskId":"TASK_ID","progress":50,"message":"Working on..."}'

# When completing a task:
curl -X POST http://localhost:5173/api/events -H "Content-Type: application/json" -d '{"type":"task_completed","missionId":"${mission.id}","taskId":"TASK_ID","taskName":"TASK_NAME","data":{"success":true}}'

# When mission completes:
curl -X POST http://localhost:5173/api/events -H "Content-Type: application/json" -d '{"type":"mission_completed","missionId":"${mission.id}"}'
\`\`\`

## Instructions

Execute each task in sequence. For each task:
1. POST a \`task_started\` event with the task ID and name
2. Apply the H70 skill guidance above (patterns, anti-patterns, lessons)
3. Complete the task following best practices
4. POST \`progress\` events periodically during long tasks
5. POST a \`task_completed\` event when done

**IMPORTANT**: The H70 skills above contain expert knowledge - follow their patterns and avoid their anti-patterns.

Start with Task 1 and proceed through all tasks.`;
}

/**
 * Preview mission structure without creating it
 */
export function previewMission(
	nodes: CanvasNode[],
	connections: Connection[],
	options: MissionBuildOptions
): { agents: MissionAgent[]; tasks: MissionTask[] } {
	const agents = generateAgents(nodes);
	const tasks = generateTasks(nodes, connections, agents);
	return { agents, tasks };
}

/**
 * Validate canvas is suitable for mission conversion
 * Returns errors (blocking) and warnings (non-blocking like orphans)
 */
export function validateForMission(
	nodes: CanvasNode[],
	connections: Connection[]
): { valid: boolean; issues: string[]; errors: string[]; warnings: string[] } {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (nodes.length === 0) {
		errors.push('Canvas is empty');
	}

	// Check for circular dependencies (blocking error)
	const visited = new Set<string>();
	const stack = new Set<string>();

	function hasCycle(nodeId: string): boolean {
		visited.add(nodeId);
		stack.add(nodeId);

		const outgoing = connections.filter((c) => c.sourceNodeId === nodeId);
		for (const conn of outgoing) {
			if (!visited.has(conn.targetNodeId)) {
				if (hasCycle(conn.targetNodeId)) return true;
			} else if (stack.has(conn.targetNodeId)) {
				return true;
			}
		}

		stack.delete(nodeId);
		return false;
	}

	for (const node of nodes) {
		if (!visited.has(node.id) && hasCycle(node.id)) {
			errors.push('Circular dependency detected - missions must have linear flow');
			break;
		}
	}

	// Check for orphaned nodes (warning, not blocking error)
	const connectedNodes = new Set<string>();
	for (const conn of connections) {
		connectedNodes.add(conn.sourceNodeId);
		connectedNodes.add(conn.targetNodeId);
	}

	const orphans = nodes.filter((n) => !connectedNodes.has(n.id));
	if (orphans.length > 0 && nodes.length > 1) {
		warnings.push(
			`${orphans.length} node(s) not connected to workflow: ${orphans.map((n) => n.skill.name).join(', ')}`
		);
	}

	// Combine for backwards compatibility
	const issues = [...errors, ...warnings];

	// Only errors make it invalid - warnings are allowed
	return { valid: errors.length === 0, issues, errors, warnings };
}

// Helper
function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
