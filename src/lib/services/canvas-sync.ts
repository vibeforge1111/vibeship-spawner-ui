/**
 * Canvas Sync Service
 *
 * Enables bidirectional sync between Claude Code and Spawner Canvas:
 *
 * Claude Code → Canvas:
 * - Add nodes (skills) to the canvas
 * - Create connections between nodes
 * - Clear or reset the canvas
 * - Update node positions
 *
 * Canvas → Claude Code:
 * - Report canvas state changes
 * - Notify when nodes are added/removed
 * - Share workflow validation results
 *
 * Usage from Claude Code:
 * 1. Connect to the sync server WebSocket
 * 2. Send canvas commands as events
 * 3. Receive state updates
 */

import { syncClient, type SyncEvent } from './sync-client';
import {
	addNode,
	removeNode,
	clearCanvas,
	updateNodePosition,
	nodes,
	connections,
	type CanvasNode,
	type Connection
} from '$lib/stores/canvas.svelte';
import { skills as skillsStore, loadSkillsStatic } from '$lib/stores/skills.svelte';
import type { Skill } from '$lib/stores/skills.svelte';
import { get } from 'svelte/store';

// Canvas-specific event types
export type CanvasEventType =
	| 'canvas_add_skill'      // Add a skill by ID or name
	| 'canvas_add_skills'     // Add multiple skills
	| 'canvas_remove_node'    // Remove a node by ID
	| 'canvas_clear'          // Clear the entire canvas
	| 'canvas_update_position'// Update node position
	| 'canvas_get_state'      // Request current canvas state
	| 'canvas_state'          // Response with canvas state
	| 'canvas_workflow_ready' // Notify that workflow is ready
	| 'canvas_error';         // Error response

export interface CanvasCommand {
	type: CanvasEventType;
	data: Record<string, unknown>;
}

export interface AddSkillData {
	skillId?: string;
	skillName?: string;
	position?: { x: number; y: number };
}

export interface AddSkillsData {
	skills: Array<{
		skillId?: string;
		skillName?: string;
		position?: { x: number; y: number };
	}>;
	autoConnect?: boolean; // Automatically connect in sequence
	autoLayout?: 'horizontal' | 'vertical' | 'grid';
}

// Track initialization
let isInitialized = false;
let unsubscribe: (() => void) | null = null;

/**
 * Initialize canvas sync - call this from the canvas page
 */
export function initCanvasSync(): () => void {
	if (isInitialized) {
		console.log('[CanvasSync] Already initialized');
		return () => {};
	}

	console.log('[CanvasSync] Initializing...');
	isInitialized = true;

	// Subscribe to canvas-related events from Claude Code
	unsubscribe = syncClient.subscribeAll(handleSyncEvent);

	// Return cleanup function
	return () => {
		console.log('[CanvasSync] Cleaning up...');
		if (unsubscribe) {
			unsubscribe();
			unsubscribe = null;
		}
		isInitialized = false;
	};
}

/**
 * Handle incoming sync events
 */
async function handleSyncEvent(event: SyncEvent): Promise<void> {
	// Only process events from Claude Code
	if (event.source === 'spawner-ui') return;

	const eventType = event.type as string;

	// Handle canvas-specific events
	if (!eventType.startsWith('canvas_')) return;

	console.log('[CanvasSync] Received event:', eventType, event.data);

	try {
		switch (eventType) {
			case 'canvas_add_skill':
				await handleAddSkill(event.data as AddSkillData);
				break;

			case 'canvas_add_skills':
				await handleAddSkills(event.data as AddSkillsData);
				break;

			case 'canvas_remove_node':
				handleRemoveNode(event.data.nodeId as string);
				break;

			case 'canvas_clear':
				handleClearCanvas();
				break;

			case 'canvas_update_position':
				handleUpdatePosition(
					event.data.nodeId as string,
					event.data.position as { x: number; y: number }
				);
				break;

			case 'canvas_get_state':
				broadcastCanvasState();
				break;

			default:
				console.log('[CanvasSync] Unknown event type:', eventType);
		}
	} catch (error) {
		console.error('[CanvasSync] Error handling event:', error);
		broadcastError(error instanceof Error ? error.message : 'Unknown error');
	}
}

/**
 * Find a skill by ID or name
 */
async function findSkill(skillId?: string, skillName?: string): Promise<Skill | null> {
	// Ensure skills are loaded
	let skills = get(skillsStore);
	if (skills.length === 0) {
		await loadSkillsStatic();
		skills = get(skillsStore);
	}

	if (skillId) {
		return skills.find(s => s.id === skillId) || null;
	}

	if (skillName) {
		// Try exact match first, then case-insensitive
		const exact = skills.find(s => s.name === skillName);
		if (exact) return exact;

		const lower = skillName.toLowerCase();
		return skills.find(s => s.name.toLowerCase() === lower) || null;
	}

	return null;
}

/**
 * Handle adding a single skill to the canvas
 */
async function handleAddSkill(data: AddSkillData): Promise<void> {
	const skill = await findSkill(data.skillId, data.skillName);

	if (!skill) {
		broadcastError(`Skill not found: ${data.skillId || data.skillName}`);
		return;
	}

	// Calculate position - use provided or auto-calculate
	const currentNodes = get(nodes);
	const position = data.position || calculateNextPosition(currentNodes);

	addNode(skill, position);

	console.log('[CanvasSync] Added skill:', skill.name, 'at', position);
	broadcastCanvasState();
}

/**
 * Handle adding multiple skills to the canvas
 */
async function handleAddSkills(data: AddSkillsData): Promise<void> {
	const currentNodes = get(nodes);
	const addedNodes: CanvasNode[] = [];

	for (let i = 0; i < data.skills.length; i++) {
		const skillData = data.skills[i];
		const skill = await findSkill(skillData.skillId, skillData.skillName);

		if (!skill) {
			console.warn('[CanvasSync] Skill not found:', skillData.skillId || skillData.skillName);
			continue;
		}

		// Calculate position based on layout mode
		let position: { x: number; y: number };
		if (skillData.position) {
			position = skillData.position;
		} else {
			position = calculateLayoutPosition(
				i,
				data.skills.length,
				currentNodes.length,
				data.autoLayout || 'horizontal'
			);
		}

		addNode(skill, position);
	}

	console.log('[CanvasSync] Added', data.skills.length, 'skills');
	broadcastCanvasState();
}

/**
 * Handle removing a node
 */
function handleRemoveNode(nodeId: string): void {
	removeNode(nodeId);
	console.log('[CanvasSync] Removed node:', nodeId);
	broadcastCanvasState();
}

/**
 * Handle clearing the canvas
 */
function handleClearCanvas(): void {
	clearCanvas();
	console.log('[CanvasSync] Canvas cleared');
	broadcastCanvasState();
}

/**
 * Handle updating node position
 */
function handleUpdatePosition(nodeId: string, position: { x: number; y: number }): void {
	updateNodePosition(nodeId, position);
	console.log('[CanvasSync] Updated position for:', nodeId);
}

/**
 * Calculate next position for a new node
 */
function calculateNextPosition(existingNodes: CanvasNode[]): { x: number; y: number } {
	if (existingNodes.length === 0) {
		return { x: 100, y: 100 };
	}

	// Find the rightmost node and place new node to its right
	const maxX = Math.max(...existingNodes.map(n => n.position.x));
	const avgY = existingNodes.reduce((sum, n) => sum + n.position.y, 0) / existingNodes.length;

	return {
		x: maxX + 250, // Node width + gap
		y: avgY
	};
}

/**
 * Calculate position based on layout mode
 */
function calculateLayoutPosition(
	index: number,
	total: number,
	offset: number,
	layout: 'horizontal' | 'vertical' | 'grid'
): { x: number; y: number } {
	const NODE_WIDTH = 200;
	const NODE_HEIGHT = 80;
	const GAP_X = 50;
	const GAP_Y = 40;
	const START_X = 100;
	const START_Y = 100;

	const adjustedIndex = index + offset;

	switch (layout) {
		case 'horizontal':
			return {
				x: START_X + adjustedIndex * (NODE_WIDTH + GAP_X),
				y: START_Y
			};

		case 'vertical':
			return {
				x: START_X,
				y: START_Y + adjustedIndex * (NODE_HEIGHT + GAP_Y)
			};

		case 'grid':
			const cols = Math.ceil(Math.sqrt(total + offset));
			const row = Math.floor(adjustedIndex / cols);
			const col = adjustedIndex % cols;
			return {
				x: START_X + col * (NODE_WIDTH + GAP_X),
				y: START_Y + row * (NODE_HEIGHT + GAP_Y)
			};

		default:
			return { x: START_X, y: START_Y };
	}
}

/**
 * Broadcast current canvas state
 */
export function broadcastCanvasState(): void {
	const currentNodes = get(nodes);
	const currentConnections = get(connections);

	syncClient.broadcast({
		type: 'canvas_state' as SyncEvent['type'],
		data: {
			nodes: currentNodes.map(n => ({
				id: n.id,
				skillId: n.skill.id,
				skillName: n.skill.name,
				category: n.skill.category,
				position: n.position
			})),
			connections: currentConnections.map(c => ({
				id: c.id,
				sourceId: c.sourceNodeId,
				targetId: c.targetNodeId
			})),
			nodeCount: currentNodes.length,
			connectionCount: currentConnections.length
		}
	});
}

/**
 * Broadcast an error
 */
function broadcastError(message: string): void {
	syncClient.broadcast({
		type: 'canvas_error' as SyncEvent['type'],
		data: { error: message }
	});
}

/**
 * Send a command to add skills from Claude Code
 * This is a helper for testing - normally Claude Code sends these via WebSocket
 */
export async function addSkillsFromClaude(
	skillNames: string[],
	options?: { autoLayout?: 'horizontal' | 'vertical' | 'grid' }
): Promise<void> {
	await handleAddSkills({
		skills: skillNames.map(name => ({ skillName: name })),
		autoLayout: options?.autoLayout || 'horizontal'
	});
}

/**
 * Get available skill names for autocomplete
 */
export async function getAvailableSkills(): Promise<string[]> {
	let skills = get(skillsStore);
	if (skills.length === 0) {
		await loadSkillsStatic();
		skills = get(skillsStore);
	}
	return skills.map(s => s.name);
}
