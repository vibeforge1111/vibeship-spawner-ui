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
import { loadSkillsForMission, type H70SkillContent } from './h70-skills';
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
 * Check if a node represents a question/decision rather than an executable task
 */
function isQuestionNode(node: CanvasNode): boolean {
	const name = node.skill.name.toLowerCase();
	const desc = (node.skill.description || '').toLowerCase();
	return (
		name.endsWith('?') ||
		desc.endsWith('?') ||
		name.startsWith('should we') ||
		name.startsWith('do we') ||
		name.startsWith('can we') ||
		name.startsWith('would') ||
		/^(what|how|why|when|where|which)\s/i.test(name)
	);
}

/**
 * Filter out non-executable nodes (questions, empty descriptions)
 * Returns filtered nodes and list of removed nodes
 */
function filterExecutableNodes(
	nodes: CanvasNode[],
	connections: Connection[]
): { nodes: CanvasNode[]; connections: Connection[]; removed: CanvasNode[] } {
	const removed: CanvasNode[] = [];
	const removedIds = new Set<string>();

	// Filter out question nodes
	const executableNodes = nodes.filter((node) => {
		if (isQuestionNode(node)) {
			removed.push(node);
			removedIds.add(node.id);
			return false;
		}
		return true;
	});

	// Remove connections to/from removed nodes
	const validConnections = connections.filter(
		(conn) => !removedIds.has(conn.sourceNodeId) && !removedIds.has(conn.targetNodeId)
	);

	if (removed.length > 0) {
		console.log(
			`[MissionBuilder] Filtered out ${removed.length} non-executable node(s): ${removed.map((n) => n.skill.name).join(', ')}`
		);
	}

	return { nodes: executableNodes, connections: validConnections, removed };
}

/**
 * Deduplicate nodes by skill ID
 * When multiple nodes have the same skill, keep the first one
 * and merge their connections
 */
function deduplicateNodes(
	nodes: CanvasNode[],
	connections: Connection[]
): { nodes: CanvasNode[]; connections: Connection[]; merged: Map<string, string[]> } {
	const seenSkillIds = new Map<string, string>(); // skillId -> first nodeId
	const merged = new Map<string, string[]>(); // kept nodeId -> merged nodeIds
	const nodeIdMap = new Map<string, string>(); // old nodeId -> new nodeId (for remapping connections)

	const dedupedNodes: CanvasNode[] = [];

	for (const node of nodes) {
		const skillId = node.skill.id;

		if (seenSkillIds.has(skillId)) {
			// Duplicate - map to the original node
			const originalNodeId = seenSkillIds.get(skillId)!;
			nodeIdMap.set(node.id, originalNodeId);

			// Track what was merged
			const mergedList = merged.get(originalNodeId) || [];
			mergedList.push(node.id);
			merged.set(originalNodeId, mergedList);
		} else {
			// First occurrence - keep it
			seenSkillIds.set(skillId, node.id);
			nodeIdMap.set(node.id, node.id); // Maps to itself
			dedupedNodes.push(node);
		}
	}

	// Remap connections to use deduplicated node IDs
	const dedupedConnections: Connection[] = [];
	const connectionSet = new Set<string>(); // Prevent duplicate connections

	for (const conn of connections) {
		const newSourceId = nodeIdMap.get(conn.sourceNodeId) || conn.sourceNodeId;
		const newTargetId = nodeIdMap.get(conn.targetNodeId) || conn.targetNodeId;

		// Skip self-loops created by merging
		if (newSourceId === newTargetId) continue;

		const connectionKey = `${newSourceId}->${newTargetId}`;
		if (connectionSet.has(connectionKey)) continue;

		connectionSet.add(connectionKey);
		dedupedConnections.push({
			...conn,
			sourceNodeId: newSourceId,
			targetNodeId: newTargetId
		});
	}

	if (merged.size > 0) {
		const mergeInfo = [...merged.entries()].map(([kept, removed]) =>
			`${nodes.find(n => n.id === kept)?.skill.name}: merged ${removed.length} duplicates`
		);
		console.log(`[MissionBuilder] Deduplicated nodes: ${mergeInfo.join(', ')}`);
	}

	return { nodes: dedupedNodes, connections: dedupedConnections, merged };
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
		// STEP 1: Filter out non-executable nodes (questions, decisions)
		const { nodes: executableNodes, connections: executableConns, removed } = filterExecutableNodes(nodes, connections);

		if (removed.length > 0) {
			console.log(`[MissionBuilder] Removed ${removed.length} non-executable node(s)`);
		}

		// STEP 2: Deduplicate nodes with same skill ID
		// This prevents the same skill appearing multiple times as separate tasks
		const { nodes: dedupedNodes, connections: dedupedConnections, merged } = deduplicateNodes(executableNodes, executableConns);

		if (merged.size > 0) {
			console.log(`[MissionBuilder] Reduced ${executableNodes.length} nodes to ${dedupedNodes.length} (merged ${executableNodes.length - dedupedNodes.length} duplicates)`);
		}

		// Generate agents based on skill categories
		const agents = generateAgents(dedupedNodes);

		// Generate tasks with dependencies
		const tasks = generateTasks(dedupedNodes, dedupedConnections, agents);

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
			user_id: 'local',
			name: options.name,
			description: options.description || '',
			status: 'ready',
			mode: options.mode || 'claude-code',
			agents,
			tasks,
			context,
			current_task_id: null,
			outputs: {},
			error: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			started_at: null,
			completed_at: null
		};

		// Auto-load H70 skills for the mission (browser only)
		let loadedSkills: Map<string, H70SkillContent> | undefined;
		let taskSkillMap: Map<string, string[]> | undefined;

		const shouldLoadSkills = browser && (options.loadH70Skills !== false);

		if (shouldLoadSkills) {
			// Dynamic limits based on task complexity
			// More tasks = more skills needed (cap at 50 for full H70 skill content)
			const taskCount = tasks.length;
			const defaultMaxPerTask = Math.min(5, Math.max(3, Math.ceil(taskCount / 3))); // 3-5 skills per task
			// Scale: 15 base + 2 per task, cap at 50 (full skills loaded, not condensed)
			const defaultMaxTotal = Math.min(50, Math.max(15, 15 + taskCount * 2)); // 15-50 based on complexity

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
				const { skills } = await loadSkillsForMission(skillsToLoad);
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
	/** Loaded H70 skills (used for UI display, not included in prompt) */
	loadedSkills?: Map<string, H70SkillContent>;
	/** Mapping of task ID to skill IDs - these are listed in the prompt for just-in-time loading */
	taskSkillMap?: Map<string, string[]>;
	/** Base URL for event reporting (defaults to window.location.origin in browser) */
	baseUrl?: string;
}

/**
 * Generate a copy-pasteable execution prompt for Claude Code
 *
 * ARCHITECTURE: Just-in-time skill loading
 * - This prompt does NOT include skill content (would be 20,000+ lines)
 * - Instead, it lists which H70 skills to load for each task
 * - Claude Code fetches FULL skill content when starting each task
 * - Skills are loaded from local files via MCP or direct read
 */
export function generateExecutionPrompt(
	mission: Mission,
	options?: ExecutionPromptOptions
): string {
	const { taskSkillMap, baseUrl } = options || {};

	// Use provided baseUrl, or default to localhost:5173 (caller should pass window.location.origin)
	const eventUrl = baseUrl || 'http://localhost:5173';

	// Build task list with skill IDs (not content)
	const taskList = mission.tasks
		.map((t, i) => {
			const deps = t.dependsOn?.length ? ` (after: ${t.dependsOn.join(', ')})` : '';
			const recommendedSkills = taskSkillMap?.get(t.id) || [];
			const skillsLine = recommendedSkills.length
				? `\n   **Load H70 Skills**: ${recommendedSkills.map(s => `\`${s}\``).join(', ')}`
				: '';
			return `${i + 1}. **${t.title}** (id: ${t.id})${deps}\n   ${t.description}${skillsLine}`;
		})
		.join('\n\n');

	// Collect all unique skill IDs across all tasks
	const allSkillIds = new Set<string>();
	if (taskSkillMap) {
		for (const skills of taskSkillMap.values()) {
			skills.forEach(s => allSkillIds.add(s));
		}
	}
	const skillIdList = [...allSkillIds].sort().join(', ');

	return `# Mission: ${mission.name}

${mission.description || ''}

## Context
- **Mission ID**: ${mission.id}
- **Project Path**: ${mission.context.projectPath}
- **Project Type**: ${mission.context.projectType}
- **Tech Stack**: ${mission.context.techStack?.join(', ') || 'Not specified'}
- **Goals**: ${mission.context.goals?.join('; ') || mission.description}

## H70 Skills Required
${skillIdList || 'None specified'}

## Tasks (Execute in Order)

${taskList}

## CRITICAL: How to Load H70 Skills

**Before starting each task**, load its H70 skills using ONE of these methods:

### Method 1: MCP Tool (Preferred)
\`\`\`
Use: mcp__spawner_h70__spawner_h70_skills
With: action="get", name="<skill-id>"
\`\`\`

### Method 2: Direct File Read
\`\`\`
Read: C:/Users/USER/Desktop/vibeship-h70/skill-lab/<skill-id>/skill.yaml
\`\`\`

**IMPORTANT**: Load the FULL skill content. Each H70 skill contains:
- **identity**: Expert persona and deep knowledge
- **owns**: What this skill handles
- **delegates**: When to hand off to other skills
- **disasters**: Real war stories and critical lessons
- **anti_patterns**: Mistakes to avoid (with code smells)
- **patterns**: Recommended implementations

## Workflow Per Task

For each task in order:

1. **Report Start**
   \`\`\`bash
   curl -X POST ${eventUrl}/api/events -H "Content-Type: application/json" -d '{"type":"task_started","missionId":"${mission.id}","taskId":"TASK_ID","taskName":"TASK_NAME"}'
   \`\`\`

2. **Load Skills** - Fetch the H70 skills listed for this task (see "Load H70 Skills" in task)

3. **Execute** - Complete the task following the skill's patterns, avoiding anti-patterns

4. **Report Progress** (for long tasks)
   \`\`\`bash
   curl -X POST ${eventUrl}/api/events -H "Content-Type: application/json" -d '{"type":"progress","missionId":"${mission.id}","taskId":"TASK_ID","progress":50,"message":"Working on..."}'
   \`\`\`

5. **Report Complete**
   \`\`\`bash
   curl -X POST ${eventUrl}/api/events -H "Content-Type: application/json" -d '{"type":"task_completed","missionId":"${mission.id}","taskId":"TASK_ID","taskName":"TASK_NAME","data":{"success":true}}'
   \`\`\`

6. **Move to Next Task** - Load the next task's skills and repeat

## Completion Protocol

### Per-Task Requirements
1. **Load Skills First** - Report: \`curl POST ${eventUrl}/api/events {"type":"skill_loaded","skillId":"..."}\`
2. **Execute Task** - Follow skill patterns, avoid anti-patterns
3. **Report Progress** - At 25%, 50%, 75% for long tasks
4. **Verify Before Complete** - Check artifacts exist, no errors

### DO NOT
- Skip feature tasks after infrastructure is set up
- Mark tasks "complete" without verification
- Ignore listed skills - they contain critical patterns
- Rush to "mission_completed" - complete ALL tasks first

### Task Completion Quality
Each task should produce:
- **Artifacts**: Files created/modified
- **No Errors**: Code compiles, tests pass
- **Skills Applied**: Patterns from loaded skills used

## Mission Complete

Only send \`mission_completed\` after ALL ${mission.tasks.length} tasks are done:
\`\`\`bash
curl -X POST ${eventUrl}/api/events -H "Content-Type: application/json" -d '{"type":"mission_completed","missionId":"${mission.id}"}'
\`\`\`

The system will then run automated tests and generate a checkpoint for human review.

## IMPORTANT: Resume After Interruption

If execution is interrupted (crash, pause, or context loss), you can resume:

### 1. Check Active Mission State
\`\`\`bash
curl ${eventUrl}/api/mission/active
\`\`\`

This returns:
- \`active\`: Whether there's a mission to resume
- \`completedTasks\`: Tasks already finished (don't redo these)
- \`currentTask\`: Task that was in progress when interrupted
- \`resumeInstructions\`: Specific guidance on continuing

### 2. Resume From Checkpoint
- **Skip completed tasks** - Check \`completedTasks\` array
- **Continue current task** - If \`currentTask\` is set, continue from where you left off
- **Don't restart from beginning** - Only work on pending tasks

### 3. If No Active Mission Found
If \`active: false\`, the mission was either completed or needs to be restarted.
Check \`.spawner/active-mission.json\` manually for state.

### AUTONOMOUS EXECUTION RULES
- **Do NOT stop to ask questions** during task execution
- **Do NOT pause for confirmation** between tasks
- **Complete all tasks sequentially** without human intervention
- **Only pause if blocked** by an error you cannot resolve
- If you must pause, report it: \`{"type":"mission_paused","reason":"..."}\`

---

**START**: Begin with Task 1. Load its H70 skills first, then execute.
**RESUME**: If resuming, check \`/api/mission/active\` first to see completed tasks.`;
}

/**
 * Preview mission structure without creating it
 */
export function previewMission(
	nodes: CanvasNode[],
	connections: Connection[],
	options: MissionBuildOptions
): { agents: MissionAgent[]; tasks: MissionTask[]; duplicatesRemoved: number } {
	// Deduplicate before preview
	const { nodes: dedupedNodes, connections: dedupedConnections } = deduplicateNodes(nodes, connections);
	const duplicatesRemoved = nodes.length - dedupedNodes.length;

	const agents = generateAgents(dedupedNodes);
	const tasks = generateTasks(dedupedNodes, dedupedConnections, agents);
	return { agents, tasks, duplicatesRemoved };
}

/**
 * Validate canvas is suitable for mission conversion
 * Returns errors (blocking) and warnings (non-blocking like orphans)
 */
export function validateForMission(
	nodes: CanvasNode[],
	connections: Connection[]
): { valid: boolean; issues: string[]; errors: string[]; warnings: string[]; duplicateCount: number } {
	const errors: string[] = [];
	const warnings: string[] = [];

	if (nodes.length === 0) {
		errors.push('Canvas is empty');
	}

	// Check for duplicate skills (warning, will be auto-merged)
	const skillIdCounts = new Map<string, number>();
	for (const node of nodes) {
		const count = skillIdCounts.get(node.skill.id) || 0;
		skillIdCounts.set(node.skill.id, count + 1);
	}

	const duplicates = [...skillIdCounts.entries()].filter(([_, count]) => count > 1);
	const duplicateCount = duplicates.reduce((sum, [_, count]) => sum + count - 1, 0);

	if (duplicates.length > 0) {
		const duplicateInfo = duplicates.map(([id, count]) => `${id} (${count}x)`).join(', ');
		warnings.push(`${duplicateCount} duplicate skill(s) will be merged: ${duplicateInfo}`);
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

	// Check for question nodes (not executable tasks)
	const questionNodes = nodes.filter((n) => {
		const name = n.skill.name.toLowerCase();
		const desc = (n.skill.description || '').toLowerCase();
		return (
			name.endsWith('?') ||
			desc.endsWith('?') ||
			name.startsWith('should we') ||
			name.startsWith('do we') ||
			name.startsWith('can we') ||
			name.startsWith('would') ||
			/^(what|how|why|when|where|which)\s/i.test(name)
		);
	});

	if (questionNodes.length > 0) {
		warnings.push(
			`${questionNodes.length} node(s) appear to be questions, not tasks: ${questionNodes.map((n) => n.skill.name).slice(0, 3).join(', ')}${questionNodes.length > 3 ? '...' : ''}`
		);
	}

	// Check for nodes with empty/missing descriptions
	const emptyDescNodes = nodes.filter((n) => {
		const desc = n.skill.description?.trim();
		const name = n.skill.name?.trim();
		return !desc || desc === name || desc.length < 10;
	});

	if (emptyDescNodes.length > 0) {
		warnings.push(
			`${emptyDescNodes.length} node(s) have empty/minimal descriptions: ${emptyDescNodes.map((n) => n.skill.name).slice(0, 3).join(', ')}${emptyDescNodes.length > 3 ? '...' : ''}`
		);
	}

	// Combine for backwards compatibility
	const issues = [...errors, ...warnings];

	// Only errors make it invalid - warnings are allowed
	return { valid: errors.length === 0, issues, errors, warnings, duplicateCount };
}

// Helper
function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
