/**
 * Mission Builder Service
 *
 * Converts canvas workflows to Mission format for execution.
 * Maps nodes to tasks, connections to handoffs, and generates agent assignments.
 */

import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';
import type { MissionAgent, MissionTask, MissionContext, Mission } from '$lib/services/mcp-client';
import { mcpClient } from '$lib/services/mcp-client';

export interface MissionBuildOptions {
	name: string;
	description?: string;
	mode?: Mission['mode'];
	projectPath?: string;
	projectType?: string;
	techStack?: string[];
	goals?: string[];
}

export interface MissionBuildResult {
	success: boolean;
	mission?: Mission;
	error?: string;
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
		const context: Partial<MissionContext> = {
			projectPath: options.projectPath || '.',
			projectType: options.projectType || 'general',
			techStack: options.techStack,
			goals: options.goals || [options.description || `Complete ${options.name}`]
		};

		// Create mission via MCP
		const result = await mcpClient.createMission({
			name: options.name,
			description: options.description,
			mode: options.mode || 'claude-code',
			agents,
			tasks,
			context
		});

		if (result.success && result.data) {
			return { success: true, mission: result.data.mission };
		} else {
			return { success: false, error: result.error || 'Failed to create mission' };
		}
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : 'Unknown error building mission'
		};
	}
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
 */
export function validateForMission(
	nodes: CanvasNode[],
	connections: Connection[]
): { valid: boolean; issues: string[] } {
	const issues: string[] = [];

	if (nodes.length === 0) {
		issues.push('Canvas is empty');
	}

	// Check for circular dependencies
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
			issues.push('Circular dependency detected - missions must have linear flow');
			break;
		}
	}

	// Check for orphaned nodes (warning, not error)
	const connectedNodes = new Set<string>();
	for (const conn of connections) {
		connectedNodes.add(conn.sourceNodeId);
		connectedNodes.add(conn.targetNodeId);
	}

	const orphans = nodes.filter((n) => !connectedNodes.has(n.id));
	if (orphans.length > 0 && nodes.length > 1) {
		issues.push(
			`${orphans.length} node(s) not connected to workflow: ${orphans.map((n) => n.skill.name).join(', ')}`
		);
	}

	return { valid: issues.length === 0, issues };
}

// Helper
function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}
