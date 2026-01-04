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
import { validateForMission } from './mission-builder';
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
	| 'canvas_validate'       // Request workflow validation
	| 'canvas_state'          // Response with canvas state
	| 'canvas_validation'     // Response with validation results
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
let isProcessing = false; // Prevent duplicate event processing

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

	// Prevent duplicate processing (multiple HMR clients)
	if (isProcessing) {
		console.log('[CanvasSync] Already processing, skipping duplicate');
		return;
	}

	console.log('[CanvasSync] Processing event:', eventType);
	isProcessing = true;

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

			case 'canvas_validate':
				broadcastValidation();
				break;

			default:
				console.log('[CanvasSync] Unknown event type:', eventType);
		}
	} catch (error) {
		console.error('[CanvasSync] Error handling event:', error);
		broadcastError(error instanceof Error ? error.message : 'Unknown error');
	} finally {
		// Reset processing flag after a short delay to debounce duplicate events
		setTimeout(() => { isProcessing = false; }, 100);
	}
}

/**
 * Calculate match score for fuzzy skill matching
 * Higher score = better match
 */
function calculateMatchScore(skill: Skill, query: string): number {
	const q = query.toLowerCase().trim();
	const name = (skill.name || '').toLowerCase();
	const id = (skill.id || '').toLowerCase();
	const desc = (skill.description || '').toLowerCase();
	const tags = (skill.tags || []).map(t => t.toLowerCase());
	const triggers = (skill.triggers || []).map(t => t.toLowerCase());

	let score = 0;

	// Exact matches (highest priority)
	if (id === q) return 1000;
	if (name === q) return 900;

	// ID starts with query
	if (id.startsWith(q)) score += 100;
	// Name starts with query
	if (name.startsWith(q)) score += 90;

	// ID contains query
	if (id.includes(q)) score += 50;
	// Name contains query
	if (name.includes(q)) score += 45;

	// Query words match (for multi-word queries like "next js")
	const queryWords = q.split(/[\s\-_]+/).filter(w => w.length > 1);
	for (const word of queryWords) {
		if (id.includes(word)) score += 20;
		if (name.includes(word)) score += 18;
		if (tags.some(t => t.includes(word))) score += 15;
		if (triggers.some(t => t.includes(word))) score += 12;
		if (desc.includes(word)) score += 5;
	}

	// Tag exact match
	if (tags.includes(q)) score += 40;
	// Trigger exact match
	if (triggers.includes(q)) score += 35;

	// Abbreviation matching (e.g., "RAG" matches "rag-engineer")
	if (q.length <= 4 && q.length > 1) {
		// Check if query could be an abbreviation
		const idWords = id.split('-');
		const nameWords = name.split(/\s+/);

		// Check if first letters match
		const idAbbrev = idWords.map(w => w[0]).join('');
		const nameAbbrev = nameWords.map(w => w[0]).join('').toLowerCase();

		if (idAbbrev.startsWith(q) || q.startsWith(idAbbrev)) score += 30;
		if (nameAbbrev.startsWith(q) || q.startsWith(nameAbbrev)) score += 28;
	}

	return score;
}

/**
 * Find a skill by ID, name, or fuzzy match
 */
async function findSkill(skillId?: string, skillName?: string): Promise<Skill | null> {
	const query = skillId || skillName;
	console.log('[CanvasSync] findSkill called - query:', query);

	// Ensure skills are loaded
	let skills = get(skillsStore);
	console.log('[CanvasSync] Skills in store:', skills.length);

	if (skills.length === 0) {
		console.log('[CanvasSync] No skills loaded, fetching from static...');
		try {
			await loadSkillsStatic();
			skills = get(skillsStore);
			console.log('[CanvasSync] After loadSkillsStatic:', skills.length, 'skills');
		} catch (e) {
			console.error('[CanvasSync] Failed to load skills:', e);
			return null;
		}
	}

	if (skills.length === 0) {
		console.error('[CanvasSync] Skills store still empty after loading!');
		return null;
	}

	// Try exact ID match first
	if (skillId) {
		const exactId = skills.find(s => s.id === skillId);
		if (exactId) {
			console.log('[CanvasSync] Found exact ID match:', skillId);
			return exactId;
		}

		// Try fuzzy match on ID
		const scored = skills
			.map(s => ({ skill: s, score: calculateMatchScore(s, skillId) }))
			.filter(x => x.score > 0)
			.sort((a, b) => b.score - a.score);

		if (scored.length > 0 && scored[0].score >= 20) {
			console.log('[CanvasSync] Fuzzy ID match:', skillId, '→', scored[0].skill.id, `(score: ${scored[0].score})`);
			return scored[0].skill;
		}
	}

	// Try name matching with fuzzy fallback
	if (skillName) {
		const searchQuery = skillName.trim();
		console.log('[CanvasSync] Searching by name:', searchQuery);

		// Exact name match
		const exact = skills.find(s => s.name === searchQuery);
		if (exact) {
			console.log('[CanvasSync] Found exact name match:', searchQuery);
			return exact;
		}

		// Case-insensitive name match
		const lower = searchQuery.toLowerCase();
		const caseMatch = skills.find(s => s.name.toLowerCase() === lower);
		if (caseMatch) {
			console.log('[CanvasSync] Found case-insensitive match:', searchQuery);
			return caseMatch;
		}

		// Fuzzy match with scoring
		console.log('[CanvasSync] Trying fuzzy match for:', searchQuery);
		const scored = skills
			.map(s => ({ skill: s, score: calculateMatchScore(s, searchQuery) }))
			.filter(x => x.score > 0)
			.sort((a, b) => b.score - a.score);

		console.log('[CanvasSync] Top 3 fuzzy matches:', scored.slice(0, 3).map(x =>
			`${x.skill.id} (${x.score})`
		).join(', '));

		if (scored.length > 0) {
			const best = scored[0];
			// Require minimum score of 15 to avoid bad matches
			if (best.score >= 15) {
				console.log('[CanvasSync] Fuzzy match SUCCESS:', searchQuery, '→', best.skill.id, `(score: ${best.score})`);
				return best.skill;
			}
			console.log('[CanvasSync] Best match too weak:', searchQuery, '→', best.skill.id, `(score: ${best.score})`);
		} else {
			console.log('[CanvasSync] No fuzzy matches found for:', searchQuery);
		}
	}

	console.log('[CanvasSync] findSkill returning null');
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
	let addedCount = 0;
	const notFound: string[] = [];

	for (let i = 0; i < data.skills.length; i++) {
		const skillData = data.skills[i];
		const skill = await findSkill(skillData.skillId, skillData.skillName);

		if (!skill) {
			const name = skillData.skillId || skillData.skillName || 'unknown';
			console.warn('[CanvasSync] Skill not found:', name);
			notFound.push(name);
			continue;
		}

		// Calculate position based on layout mode
		let position: { x: number; y: number };
		if (skillData.position) {
			position = skillData.position;
		} else {
			position = calculateLayoutPosition(
				addedCount,
				data.skills.length,
				currentNodes.length,
				data.autoLayout || 'horizontal'
			);
		}

		addNode(skill, position);
		addedCount++;
	}

	if (addedCount > 0) {
		console.log('[CanvasSync] Added', addedCount, 'skills');
		broadcastCanvasState();
	} else if (notFound.length > 0) {
		// Only broadcast error if ALL skills failed
		console.error('[CanvasSync] No skills added. Not found:', notFound);
		broadcastError(`Skills not found: ${notFound.join(', ')}`);
	}
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
 * Broadcast validation results
 */
export function broadcastValidation(): void {
	const currentNodes = get(nodes);
	const currentConnections = get(connections);

	const validation = validateForMission(currentNodes, currentConnections);

	syncClient.broadcast({
		type: 'canvas_validation' as SyncEvent['type'],
		data: {
			valid: validation.valid,
			issues: validation.issues,
			nodeCount: currentNodes.length,
			connectionCount: currentConnections.length,
			readyForExecution: validation.valid && currentNodes.length > 0
		}
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

/**
 * Test function - adds sample skills to demonstrate Claude Code integration
 * Call from browser console: window.testCanvasSync()
 */
export async function testCanvasSync(): Promise<void> {
	console.log('[CanvasSync] Testing - adding sample skills...');

	await handleAddSkills({
		skills: [
			{ skillName: 'Next.js App Router' },
			{ skillName: 'Supabase Backend' },
			{ skillName: 'TailwindCSS' },
			{ skillName: 'Authentication' }
		],
		autoLayout: 'horizontal'
	});

	console.log('[CanvasSync] Test complete! Check the canvas.');
}

// Expose test function globally for browser console testing
if (typeof window !== 'undefined') {
	(window as any).testCanvasSync = testCanvasSync;
	(window as any).addSkillsToCanvas = addSkillsFromClaude;
}
