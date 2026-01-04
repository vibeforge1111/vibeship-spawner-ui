/**
 * Canvas Workflow Validation Service
 *
 * Validates the canvas workflow for:
 * - Connection completeness
 * - Circular dependencies
 * - Orphaned nodes
 * - Skill compatibility
 * - Entry/exit points
 */

import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';
import type { Skill } from '$lib/stores/skills.svelte';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
	id: string;
	severity: ValidationSeverity;
	message: string;
	nodeId?: string;
	connectionId?: string;
	suggestion?: string;
}

export interface ValidationResult {
	valid: boolean;
	score: number; // 0-100
	issues: ValidationIssue[];
	stats: {
		totalNodes: number;
		connectedNodes: number;
		totalConnections: number;
		entryPoints: number;
		exitPoints: number;
	};
}

/**
 * Find nodes with no incoming connections (entry points)
 */
function findEntryPoints(nodes: CanvasNode[], connections: Connection[]): CanvasNode[] {
	const nodesWithIncoming = new Set(connections.map((c) => c.targetNodeId));
	return nodes.filter((n) => !nodesWithIncoming.has(n.id));
}

/**
 * Find nodes with no outgoing connections (exit points)
 */
function findExitPoints(nodes: CanvasNode[], connections: Connection[]): CanvasNode[] {
	const nodesWithOutgoing = new Set(connections.map((c) => c.sourceNodeId));
	return nodes.filter((n) => !nodesWithOutgoing.has(n.id));
}

/**
 * Find orphaned nodes (no connections at all)
 */
function findOrphanedNodes(nodes: CanvasNode[], connections: Connection[]): CanvasNode[] {
	const connectedNodes = new Set<string>();
	for (const conn of connections) {
		connectedNodes.add(conn.sourceNodeId);
		connectedNodes.add(conn.targetNodeId);
	}
	return nodes.filter((n) => !connectedNodes.has(n.id));
}

/**
 * Detect circular dependencies using DFS
 */
function detectCircularDependencies(
	nodes: CanvasNode[],
	connections: Connection[]
): { hasCircle: boolean; path: string[] } {
	const adjacency = new Map<string, string[]>();

	// Build adjacency list
	for (const node of nodes) {
		adjacency.set(node.id, []);
	}
	for (const conn of connections) {
		const targets = adjacency.get(conn.sourceNodeId) || [];
		targets.push(conn.targetNodeId);
		adjacency.set(conn.sourceNodeId, targets);
	}

	const visited = new Set<string>();
	const recursionStack = new Set<string>();
	const path: string[] = [];

	function dfs(nodeId: string): boolean {
		visited.add(nodeId);
		recursionStack.add(nodeId);
		path.push(nodeId);

		const neighbors = adjacency.get(nodeId) || [];
		for (const neighbor of neighbors) {
			if (!visited.has(neighbor)) {
				if (dfs(neighbor)) {
					return true;
				}
			} else if (recursionStack.has(neighbor)) {
				path.push(neighbor);
				return true;
			}
		}

		path.pop();
		recursionStack.delete(nodeId);
		return false;
	}

	for (const node of nodes) {
		if (!visited.has(node.id)) {
			if (dfs(node.id)) {
				return { hasCircle: true, path };
			}
		}
	}

	return { hasCircle: false, path: [] };
}

/**
 * Check skill compatibility based on pairsWell property
 */
function checkSkillCompatibility(
	nodes: CanvasNode[],
	connections: Connection[]
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	for (const conn of connections) {
		const sourceNode = nodeMap.get(conn.sourceNodeId);
		const targetNode = nodeMap.get(conn.targetNodeId);

		if (!sourceNode || !targetNode) continue;

		const sourceSkill = sourceNode.skill;
		const targetSkill = targetNode.skill;

		// Check if skills pair well
		const pairsWell = sourceSkill.pairsWell || [];
		const targetPairsWell = targetSkill.pairsWell || [];

		// If source has pairsWell defined, check if target is compatible
		if (pairsWell.length > 0) {
			const isCompatible =
				pairsWell.includes(targetSkill.id) ||
				pairsWell.includes(targetSkill.name.toLowerCase().replace(/\s+/g, '-')) ||
				pairsWell.some((p) => targetSkill.tags.includes(p));

			if (!isCompatible) {
				issues.push({
					id: `compat-${conn.id}`,
					severity: 'warning',
					message: `${sourceSkill.name} may not pair well with ${targetSkill.name}`,
					connectionId: conn.id,
					suggestion: `Consider skills that pair with: ${pairsWell.slice(0, 3).join(', ')}`
				});
			}
		}
	}

	return issues;
}

/**
 * Check for handoff triggers
 */
function checkHandoffs(nodes: CanvasNode[], connections: Connection[]): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	for (const node of nodes) {
		const skill = node.skill;
		const handoffs = skill.handoffs || [];

		if (handoffs.length > 0) {
			// Check if the node has outgoing connections
			const outgoing = connections.filter((c) => c.sourceNodeId === node.id);

			if (outgoing.length === 0) {
				issues.push({
					id: `handoff-${node.id}`,
					severity: 'info',
					message: `${skill.name} has handoff triggers but no outgoing connections`,
					nodeId: node.id,
					suggestion: `Consider connecting to: ${handoffs.map((h) => h.to).slice(0, 3).join(', ')}`
				});
			}
		}
	}

	return issues;
}

/**
 * Main validation function
 */
export function validateCanvas(nodes: CanvasNode[], connections: Connection[]): ValidationResult {
	const issues: ValidationIssue[] = [];

	// Empty canvas
	if (nodes.length === 0) {
		return {
			valid: false,
			score: 0,
			issues: [
				{
					id: 'empty',
					severity: 'error',
					message: 'Canvas is empty',
					suggestion: 'Drag skills from the sidebar to create a workflow'
				}
			],
			stats: {
				totalNodes: 0,
				connectedNodes: 0,
				totalConnections: 0,
				entryPoints: 0,
				exitPoints: 0
			}
		};
	}

	// Single node - valid but with info
	if (nodes.length === 1) {
		return {
			valid: true,
			score: 50,
			issues: [
				{
					id: 'single',
					severity: 'info',
					message: 'Single node workflow',
					suggestion: 'Add more skills to create a complete workflow'
				}
			],
			stats: {
				totalNodes: 1,
				connectedNodes: 0,
				totalConnections: 0,
				entryPoints: 1,
				exitPoints: 1
			}
		};
	}

	// Find entry and exit points
	const entryPoints = findEntryPoints(nodes, connections);
	const exitPoints = findExitPoints(nodes, connections);
	const orphanedNodes = findOrphanedNodes(nodes, connections);

	// Check for orphaned nodes
	for (const node of orphanedNodes) {
		issues.push({
			id: `orphan-${node.id}`,
			severity: 'warning',
			message: `${node.skill.name} is not connected to the workflow`,
			nodeId: node.id,
			suggestion: 'Connect this node or remove it from the canvas'
		});
	}

	// Check for circular dependencies
	const circularCheck = detectCircularDependencies(nodes, connections);
	if (circularCheck.hasCircle) {
		issues.push({
			id: 'circular',
			severity: 'error',
			message: 'Circular dependency detected in workflow',
			suggestion: `Check connections involving: ${circularCheck.path.slice(-3).join(' -> ')}`
		});
	}

	// Check entry points
	if (entryPoints.length === 0 && connections.length > 0) {
		issues.push({
			id: 'no-entry',
			severity: 'warning',
			message: 'No clear entry point in workflow',
			suggestion: 'Ensure at least one node has no incoming connections'
		});
	}

	if (entryPoints.length > 1) {
		issues.push({
			id: 'multi-entry',
			severity: 'info',
			message: `Multiple entry points: ${entryPoints.map((n) => n.skill.name).join(', ')}`,
			suggestion: 'Consider if parallel starts are intentional'
		});
	}

	// Check exit points
	if (exitPoints.length === 0 && connections.length > 0) {
		issues.push({
			id: 'no-exit',
			severity: 'warning',
			message: 'No clear exit point in workflow',
			suggestion: 'Ensure at least one node has no outgoing connections'
		});
	}

	// Check skill compatibility
	const compatibilityIssues = checkSkillCompatibility(nodes, connections);
	issues.push(...compatibilityIssues);

	// Check handoffs
	const handoffIssues = checkHandoffs(nodes, connections);
	issues.push(...handoffIssues);

	// Calculate score
	let score = 100;
	const errorCount = issues.filter((i) => i.severity === 'error').length;
	const warningCount = issues.filter((i) => i.severity === 'warning').length;
	const infoCount = issues.filter((i) => i.severity === 'info').length;

	score -= errorCount * 30;
	score -= warningCount * 10;
	score -= infoCount * 2;
	score = Math.max(0, Math.min(100, score));

	// Calculate connected nodes
	const connectedNodeIds = new Set<string>();
	for (const conn of connections) {
		connectedNodeIds.add(conn.sourceNodeId);
		connectedNodeIds.add(conn.targetNodeId);
	}

	return {
		valid: errorCount === 0,
		score,
		issues,
		stats: {
			totalNodes: nodes.length,
			connectedNodes: connectedNodeIds.size,
			totalConnections: connections.length,
			entryPoints: entryPoints.length,
			exitPoints: exitPoints.length
		}
	};
}

/**
 * Get a summary message for the validation result
 */
export function getValidationSummary(result: ValidationResult): string {
	if (result.score === 100) {
		return 'Workflow is valid and ready to run';
	}

	if (result.score >= 80) {
		return 'Workflow looks good with minor suggestions';
	}

	if (result.score >= 50) {
		return 'Workflow has some issues to address';
	}

	if (!result.valid) {
		return 'Workflow has critical issues that must be fixed';
	}

	return 'Workflow needs attention';
}
