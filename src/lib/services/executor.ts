/**
 * Workflow Executor Service
 *
 * Executes canvas workflows by traversing the node graph
 * and calling skills in topological order.
 */

import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';
import { mcpClient } from '$lib/services/mcp-client';
import { validateCanvas } from './validation';

export type ExecutionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
export type NodeExecutionStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

export interface NodeExecutionResult {
	nodeId: string;
	status: NodeExecutionStatus;
	startTime?: Date;
	endTime?: Date;
	output?: unknown;
	error?: string;
}

export interface ExecutionLog {
	timestamp: Date;
	nodeId?: string;
	level: 'info' | 'success' | 'warning' | 'error';
	message: string;
}

export interface ExecutionState {
	status: ExecutionStatus;
	startTime: Date | null;
	endTime: Date | null;
	currentNodeId: string | null;
	nodeResults: Map<string, NodeExecutionResult>;
	logs: ExecutionLog[];
	progress: number; // 0-100
}

export interface ExecutionCallbacks {
	onNodeStart?: (nodeId: string) => void;
	onNodeComplete?: (nodeId: string, result: NodeExecutionResult) => void;
	onLog?: (log: ExecutionLog) => void;
	onProgress?: (progress: number) => void;
	onComplete?: (state: ExecutionState) => void;
}

/**
 * Topologically sort nodes based on connections
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

	// Find nodes with no incoming edges (entry points)
	const queue: string[] = [];
	for (const [nodeId, degree] of inDegree) {
		if (degree === 0) {
			queue.push(nodeId);
		}
	}

	// Process queue
	const sorted: CanvasNode[] = [];
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	while (queue.length > 0) {
		const nodeId = queue.shift()!;
		const node = nodeMap.get(nodeId);
		if (node) {
			sorted.push(node);
		}

		const neighbors = adjacency.get(nodeId) || [];
		for (const neighbor of neighbors) {
			const newDegree = (inDegree.get(neighbor) || 1) - 1;
			inDegree.set(neighbor, newDegree);
			if (newDegree === 0) {
				queue.push(neighbor);
			}
		}
	}

	// Add any unconnected nodes at the end
	for (const node of nodes) {
		if (!sorted.includes(node)) {
			sorted.push(node);
		}
	}

	return sorted;
}

/**
 * Simulate executing a skill node
 * In a real implementation, this would call the MCP server
 */
async function executeNode(
	node: CanvasNode,
	previousResults: Map<string, NodeExecutionResult>
): Promise<{ success: boolean; output?: unknown; error?: string }> {
	// Simulate execution time (200-800ms)
	const delay = 200 + Math.random() * 600;
	await new Promise((resolve) => setTimeout(resolve, delay));

	// Get skill info
	const skill = node.skill;

	// Simulate different outcomes based on skill type
	// In production, this would call mcpClient.callTool() with skill-specific parameters
	try {
		// Simulate calling the skill
		// const result = await mcpClient.callTool('spawner_skills', {
		//   action: 'get',
		//   name: skill.id
		// });

		// For demo purposes, simulate success with skill metadata
		return {
			success: true,
			output: {
				skillId: skill.id,
				skillName: skill.name,
				executedAt: new Date().toISOString(),
				message: `Successfully executed ${skill.name}`
			}
		};
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : 'Unknown error'
		};
	}
}

/**
 * Create a new execution state
 */
export function createExecutionState(): ExecutionState {
	return {
		status: 'idle',
		startTime: null,
		endTime: null,
		currentNodeId: null,
		nodeResults: new Map(),
		logs: [],
		progress: 0
	};
}

/**
 * Execute a workflow
 */
export async function executeWorkflow(
	nodes: CanvasNode[],
	connections: Connection[],
	callbacks?: ExecutionCallbacks
): Promise<ExecutionState> {
	const state = createExecutionState();
	state.status = 'running';
	state.startTime = new Date();

	const log = (level: ExecutionLog['level'], message: string, nodeId?: string) => {
		const entry: ExecutionLog = { timestamp: new Date(), level, message, nodeId };
		state.logs.push(entry);
		callbacks?.onLog?.(entry);
	};

	// Validate first
	const validation = validateCanvas(nodes, connections);
	if (!validation.valid) {
		log('error', 'Workflow validation failed');
		state.status = 'failed';
		state.endTime = new Date();
		callbacks?.onComplete?.(state);
		return state;
	}

	log('info', `Starting workflow execution with ${nodes.length} nodes`);

	// Sort nodes topologically
	const sortedNodes = topologicalSort(nodes, connections);
	log('info', `Execution order: ${sortedNodes.map((n) => n.skill.name).join(' -> ')}`);

	// Execute nodes in order
	let completedCount = 0;
	let hasError = false;

	for (const node of sortedNodes) {
		if (hasError) {
			// Skip remaining nodes if there's an error
			state.nodeResults.set(node.id, {
				nodeId: node.id,
				status: 'skipped'
			});
			continue;
		}

		state.currentNodeId = node.id;
		callbacks?.onNodeStart?.(node.id);
		log('info', `Executing: ${node.skill.name}`, node.id);

		const result: NodeExecutionResult = {
			nodeId: node.id,
			status: 'running',
			startTime: new Date()
		};
		state.nodeResults.set(node.id, result);

		// Execute the node
		const execResult = await executeNode(node, state.nodeResults);

		result.endTime = new Date();
		if (execResult.success) {
			result.status = 'success';
			result.output = execResult.output;
			log('success', `Completed: ${node.skill.name}`, node.id);
		} else {
			result.status = 'error';
			result.error = execResult.error;
			log('error', `Failed: ${node.skill.name} - ${execResult.error}`, node.id);
			hasError = true;
		}

		state.nodeResults.set(node.id, result);
		callbacks?.onNodeComplete?.(node.id, result);

		// Update progress
		completedCount++;
		state.progress = Math.round((completedCount / sortedNodes.length) * 100);
		callbacks?.onProgress?.(state.progress);
	}

	// Complete execution
	state.currentNodeId = null;
	state.endTime = new Date();
	state.status = hasError ? 'failed' : 'completed';

	const duration = state.endTime.getTime() - state.startTime.getTime();
	log(
		hasError ? 'error' : 'success',
		`Workflow ${hasError ? 'failed' : 'completed'} in ${duration}ms`
	);

	callbacks?.onComplete?.(state);
	return state;
}

/**
 * Get execution duration in human-readable format
 */
export function getExecutionDuration(state: ExecutionState): string {
	if (!state.startTime) return '0s';

	const end = state.endTime || new Date();
	const durationMs = end.getTime() - state.startTime.getTime();

	if (durationMs < 1000) {
		return `${durationMs}ms`;
	}

	const seconds = Math.floor(durationMs / 1000);
	if (seconds < 60) {
		return `${seconds}s`;
	}

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}m ${remainingSeconds}s`;
}
