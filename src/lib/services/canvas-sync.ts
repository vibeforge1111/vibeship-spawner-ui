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
	addConnection,
	nodes,
	connections,
	type CanvasNode,
	type Connection
} from '$lib/stores/canvas.svelte';
import { validateForMission } from './mission-builder';
import { missionExecutor } from './mission-executor';
import { skills as skillsStore, loadSkillsStatic } from '$lib/stores/skills.svelte';
import { mcpClient } from './mcp-client';
import { mcpState } from '$lib/stores/mcp.svelte';
import { toasts } from '$lib/stores/toast.svelte';
import { generatePorts } from '$lib/utils/ports';
import type { Skill } from '$lib/stores/skills.svelte';
import { get } from 'svelte/store';
import { activePipeline, pipelines } from '$lib/stores/pipelines.svelte';

// Canvas-specific event types
export type CanvasEventType =
	| 'canvas_add_skill'      // Add a skill by ID or name
	| 'canvas_add_skills'     // Add multiple skills
	| 'canvas_remove_node'    // Remove a node by ID
	| 'canvas_clear'          // Clear the entire canvas
	| 'canvas_connect'        // Create connection between nodes
	| 'canvas_update_position'// Update node position
	| 'canvas_get_state'      // Request current canvas state
	| 'canvas_get_skill'      // Get skill content/instructions
	| 'canvas_validate'       // Request workflow validation
	| 'canvas_execute'        // Execute the workflow
	| 'canvas_load_template'  // Load a workflow template
	| 'canvas_export_prompt'  // Export workflow as combined prompt
	| 'canvas_state'          // Response with canvas state
	| 'canvas_skill_content'  // Response with skill content
	| 'canvas_validation'     // Response with validation results
	| 'canvas_prompt'         // Response with exported prompt
	| 'canvas_execution'      // Response with execution status
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

export interface ExecuteWorkflowData {
	name?: string;
	description?: string;
	mode?: 'preview' | 'live';
}

export interface WorkflowTemplate {
	id: string;
	name: string;
	description: string;
	skills: Array<{ skillId: string; position?: { x: number; y: number } }>;
	connections: Array<{ sourceIndex: number; targetIndex: number }>;
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

	// Connect to the sync server first!
	syncClient.connect().then((connected) => {
		if (connected) {
			console.log('[CanvasSync] Connected to sync server');
			// Broadcast initial canvas state once connected
			setTimeout(() => {
				broadcastCanvasState();
			}, 500);
		} else {
			console.warn('[CanvasSync] Failed to connect to sync server');
		}
	});

	// Subscribe to canvas-related events from Claude Code
	unsubscribe = syncClient.subscribeAll(handleSyncEvent);

	// Return cleanup function
	return () => {
		console.log('[CanvasSync] Cleaning up...');
		if (unsubscribe) {
			unsubscribe();
			unsubscribe = null;
		}
		syncClient.disconnect();
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
				await handleAddSkills(event.data as unknown as AddSkillsData);
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

			case 'canvas_connect':
				handleCreateConnection(
					event.data.sourceNodeId as string,
					event.data.targetNodeId as string
				);
				break;

			case 'canvas_get_skill':
				await handleGetSkillContent(event.data.skillId as string);
				break;

			case 'canvas_execute':
				await handleExecuteWorkflow(event.data as unknown as ExecuteWorkflowData);
				break;

			case 'canvas_load_template':
				await handleLoadTemplate(event.data.templateId as string);
				break;

			case 'canvas_export_prompt':
				await handleExportPrompt();
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
	const addedSkills: Array<{ nodeId: string; skill: Skill }> = [];

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

		const nodeId = addNode(skill, position);
		addedSkills.push({ nodeId, skill });
		addedCount++;
	}

	if (addedCount > 0) {
		console.log('[CanvasSync] Added', addedCount, 'skills');

		// Auto-wire connections based on pairsWell if enabled
		let connectionsCreated = 0;
		if (data.autoConnect && addedSkills.length > 1) {
			connectionsCreated = autoWireConnections(addedSkills);
			console.log('[CanvasSync] Auto-wired', connectionsCreated, 'connections');
		}

		// Show success toast
		const skillNames = addedSkills.map(s => s.skill.name).join(', ');
		if (connectionsCreated > 0) {
			toasts.success(`Added ${addedCount} skills with ${connectionsCreated} connections`);
		} else {
			toasts.success(`Added: ${skillNames}`);
		}

		broadcastCanvasState();
	} else if (notFound.length > 0) {
		// Only broadcast error if ALL skills failed
		console.error('[CanvasSync] No skills added. Not found:', notFound);
		broadcastError(`Skills not found: ${notFound.join(', ')}`);
	}
}

/**
 * Auto-wire connections between skills based on pairsWell and handoffs
 * Priority: handoffs (semantic) > pairsWell (compatibility) > sequential (fallback)
 * Returns the number of connections created
 */
function autoWireConnections(addedSkills: Array<{ nodeId: string; skill: Skill }>, sequential = false): number {
	let connectionsCreated = 0;
	const connectedPairs = new Set<string>();

	// Helper to create unique key for a connection pair
	const pairKey = (a: string, b: string) => [a, b].sort().join('::');

	// Build a map for quick lookup
	const skillIdToNode = new Map<string, { nodeId: string; skill: Skill }>();
	for (const item of addedSkills) {
		skillIdToNode.set(item.skill.id, item);
	}

	// Helper to create a connection if it doesn't exist
	const tryConnect = (source: { nodeId: string; skill: Skill }, target: { nodeId: string; skill: Skill }, reason: string): boolean => {
		const key = pairKey(source.nodeId, target.nodeId);
		if (connectedPairs.has(key)) return false;

		const currentConnections = get(connections);
		const exists = currentConnections.some(
			c => (c.sourceNodeId === source.nodeId && c.targetNodeId === target.nodeId) ||
			     (c.sourceNodeId === target.nodeId && c.targetNodeId === source.nodeId)
		);
		if (exists) return false;

		// Get ports for connection
		const sourcePorts = generatePorts({
			category: source.skill.category,
			handoffs: source.skill.handoffs,
			pairsWell: source.skill.pairsWell,
			tags: source.skill.tags
		});
		const targetPorts = generatePorts({
			category: target.skill.category,
			handoffs: target.skill.handoffs,
			pairsWell: target.skill.pairsWell,
			tags: target.skill.tags
		});

		const sourcePortId = sourcePorts.outputs[0]?.id || 'output-0';
		const targetPortId = targetPorts.inputs[0]?.id || 'input-0';

		addConnection(source.nodeId, sourcePortId, target.nodeId, targetPortId);
		connectedPairs.add(key);
		connectionsCreated++;
		console.log('[CanvasSync] Auto-wired (%s):', reason, source.skill.name, '→', target.skill.name);
		return true;
	};

	// 1. First priority: handoffs (semantic flow - "this skill hands off to that skill")
	for (const source of addedSkills) {
		const handoffs = source.skill.handoffs || [];
		for (const handoff of handoffs) {
			const target = skillIdToNode.get(handoff.to);
			if (target && target.nodeId !== source.nodeId) {
				tryConnect(source, target, 'handoff');
			}
		}
	}

	// 2. Second priority: pairsWell (compatibility - "these skills work well together")
	for (const source of addedSkills) {
		const pairsWell = source.skill.pairsWell || [];
		for (const targetSkillId of pairsWell) {
			const target = skillIdToNode.get(targetSkillId);
			if (target && target.nodeId !== source.nodeId) {
				tryConnect(source, target, 'pairsWell');
			}
		}
	}

	// 3. Fallback: sequential connections if enabled and no semantic connections made
	if (sequential && connectionsCreated === 0 && addedSkills.length > 1) {
		console.log('[CanvasSync] No semantic connections found, using sequential order');
		for (let i = 0; i < addedSkills.length - 1; i++) {
			tryConnect(addedSkills[i], addedSkills[i + 1], 'sequential');
		}
	}

	return connectionsCreated;
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
	const currentPipeline = get(activePipeline);

	syncClient.broadcast({
		type: 'canvas_state' as SyncEvent['type'],
		data: {
			pipeline: currentPipeline ? {
				id: currentPipeline.id,
				name: currentPipeline.name,
				nodeCount: currentPipeline.nodeCount,
				connectionCount: currentPipeline.connectionCount
			} : null,
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
 * Broadcast an error (and show toast to user)
 */
function broadcastError(message: string): void {
	// Show toast to user
	toasts.error(message);

	// Broadcast to Claude Code
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
 * Handle creating a connection between two nodes
 */
function handleCreateConnection(sourceNodeId: string, targetNodeId: string): void {
	const currentNodes = get(nodes);

	// Validate nodes exist
	const sourceNode = currentNodes.find(n => n.id === sourceNodeId);
	const targetNode = currentNodes.find(n => n.id === targetNodeId);

	if (!sourceNode) {
		broadcastError(`Source node not found: ${sourceNodeId}`);
		return;
	}
	if (!targetNode) {
		broadcastError(`Target node not found: ${targetNodeId}`);
		return;
	}

	// Check for existing connection
	const currentConnections = get(connections);
	const exists = currentConnections.some(
		c => c.sourceNodeId === sourceNodeId && c.targetNodeId === targetNodeId
	);
	if (exists) {
		broadcastError('Connection already exists');
		return;
	}

	// Get ports for each node
	const sourcePorts = generatePorts({
		category: sourceNode.skill.category,
		handoffs: sourceNode.skill.handoffs,
		pairsWell: sourceNode.skill.pairsWell,
		tags: sourceNode.skill.tags
	});
	const targetPorts = generatePorts({
		category: targetNode.skill.category,
		handoffs: targetNode.skill.handoffs,
		pairsWell: targetNode.skill.pairsWell,
		tags: targetNode.skill.tags
	});

	// Use the first output port of source and first input port of target
	const sourcePortId = sourcePorts.outputs[0]?.id || 'output-0';
	const targetPortId = targetPorts.inputs[0]?.id || 'input-0';

	// Create the connection
	addConnection(sourceNodeId, sourcePortId, targetNodeId, targetPortId);
	console.log('[CanvasSync] Created connection:', sourceNodeId, '→', targetNodeId);
	broadcastCanvasState();
}

/**
 * Handle getting skill content/instructions
 */
async function handleGetSkillContent(skillId: string): Promise<void> {
	const skill = await findSkill(skillId);

	if (!skill) {
		broadcastError(`Skill not found: ${skillId}`);
		return;
	}

	// Try to get full skill content from MCP server first
	let fullContent: string | null = null;
	const state = get(mcpState);

	if (state.status === 'connected') {
		console.log('[CanvasSync] Fetching skill content from MCP:', skill.id);
		try {
			const result = await mcpClient.getSkill(skill.id);
			if (result.success && result.data?.content) {
				fullContent = result.data.content;
				console.log('[CanvasSync] Got full skill content from MCP:', skill.id, `(${fullContent.length} chars)`);
			}
		} catch (e) {
			console.warn('[CanvasSync] Failed to fetch from MCP, using fallback:', e);
		}
	}

	// Build comprehensive skill content
	const content = {
		id: skill.id,
		name: skill.name,
		description: skill.description,
		category: skill.category,
		tier: skill.tier,
		tags: skill.tags || [],
		triggers: skill.triggers || [],
		// Full content from MCP if available, otherwise build from metadata
		instructions: fullContent || buildSkillInstructions(skill),
		// Indicate if this is full content or just metadata
		hasFullContent: !!fullContent
	};

	syncClient.broadcast({
		type: 'canvas_skill_content' as SyncEvent['type'],
		data: content
	});

	console.log('[CanvasSync] Sent skill content for:', skill.name, fullContent ? '(full)' : '(metadata only)');
}

/**
 * Build skill instructions string for Claude Code
 */
function buildSkillInstructions(skill: Skill): string {
	const lines: string[] = [];

	lines.push(`# ${skill.name}`);
	lines.push('');
	lines.push(skill.description);
	lines.push('');

	if (skill.tags && skill.tags.length > 0) {
		lines.push(`**Tags:** ${skill.tags.join(', ')}`);
	}

	if (skill.triggers && skill.triggers.length > 0) {
		lines.push(`**Triggers:** ${skill.triggers.join(', ')}`);
	}

	lines.push('');
	lines.push(`**Category:** ${skill.category}`);

	return lines.join('\n');
}

/**
 * Handle workflow execution
 */
async function handleExecuteWorkflow(data: ExecuteWorkflowData): Promise<void> {
	const currentNodes = get(nodes);
	const currentConnections = get(connections);

	// Validate first
	const validation = validateForMission(currentNodes, currentConnections);
	if (!validation.valid) {
		syncClient.broadcast({
			type: 'canvas_execution' as SyncEvent['type'],
			data: {
				status: 'failed',
				error: `Validation failed: ${validation.issues.join(', ')}`
			}
		});
		return;
	}

	// Generate a name if not provided
	const workflowName = data.name || `Workflow with ${currentNodes.length} skills`;
	const workflowDescription = data.description ||
		`Workflow: ${currentNodes.map(n => n.skill.name).join(' → ')}`;

	// Broadcast starting
	syncClient.broadcast({
		type: 'canvas_execution' as SyncEvent['type'],
		data: {
			status: 'starting',
			preview: {
				name: workflowName,
				description: workflowDescription,
				taskCount: currentNodes.length,
				skills: currentNodes.map(n => ({ id: n.skill.id, name: n.skill.name }))
			}
		}
	});

	try {
		// Set up execution callbacks to broadcast progress
		missionExecutor.setCallbacks({
			onStatusChange: (status) => {
				syncClient.broadcast({
					type: 'canvas_execution' as SyncEvent['type'],
					data: { status }
				});
			},
			onProgress: (progress) => {
				syncClient.broadcast({
					type: 'canvas_execution' as SyncEvent['type'],
					data: { status: 'running', progress }
				});
			},
			onTaskStart: (taskId, taskName) => {
				syncClient.broadcast({
					type: 'canvas_execution' as SyncEvent['type'],
					data: {
						status: 'running',
						currentTask: { id: taskId, name: taskName }
					}
				});
			},
			onComplete: (mission) => {
				syncClient.broadcast({
					type: 'canvas_execution' as SyncEvent['type'],
					data: {
						status: 'completed',
						missionId: mission.id,
						progress: 100
					}
				});
			},
			onError: (error) => {
				syncClient.broadcast({
					type: 'canvas_execution' as SyncEvent['type'],
					data: {
						status: 'failed',
						error
					}
				});
			}
		});

		// Execute!
		const result = await missionExecutor.execute(
			currentNodes,
			currentConnections,
			{
				name: workflowName,
				description: workflowDescription
			}
		);

		console.log('[CanvasSync] Execution started:', result.missionId);

	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		syncClient.broadcast({
			type: 'canvas_execution' as SyncEvent['type'],
			data: {
				status: 'failed',
				error: errorMsg
			}
		});
	}
}

/**
 * Pre-defined workflow templates
 */
const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
	{
		id: 'saas-starter',
		name: 'SaaS Starter',
		description: 'Next.js + Supabase + Auth + Payments',
		skills: [
			{ skillId: 'nextjs-app-router' },
			{ skillId: 'supabase-backend' },
			{ skillId: 'authentication-oauth' },
			{ skillId: 'stripe-payments' }
		],
		connections: [
			{ sourceIndex: 0, targetIndex: 1 },
			{ sourceIndex: 1, targetIndex: 2 },
			{ sourceIndex: 2, targetIndex: 3 }
		]
	},
	{
		id: 'ai-agent',
		name: 'AI Agent Stack',
		description: 'RAG + LLM Integration + Tool Use',
		skills: [
			{ skillId: 'rag-implementation' },
			{ skillId: 'llm-integration' },
			{ skillId: 'mcp-builder' }
		],
		connections: [
			{ sourceIndex: 0, targetIndex: 1 },
			{ sourceIndex: 1, targetIndex: 2 }
		]
	},
	{
		id: 'api-backend',
		name: 'API Backend',
		description: 'REST API + Database + Auth',
		skills: [
			{ skillId: 'api-design' },
			{ skillId: 'supabase-backend' },
			{ skillId: 'authentication-oauth' },
			{ skillId: 'error-handling-patterns' }
		],
		connections: [
			{ sourceIndex: 0, targetIndex: 1 },
			{ sourceIndex: 1, targetIndex: 2 },
			{ sourceIndex: 0, targetIndex: 3 }
		]
	},
	{
		id: 'fullstack-app',
		name: 'Full Stack App',
		description: 'Complete Next.js application',
		skills: [
			{ skillId: 'nextjs-app-router' },
			{ skillId: 'react-patterns' },
			{ skillId: 'api-design' },
			{ skillId: 'supabase-backend' },
			{ skillId: 'authentication-oauth' }
		],
		connections: [
			{ sourceIndex: 0, targetIndex: 1 },
			{ sourceIndex: 0, targetIndex: 2 },
			{ sourceIndex: 2, targetIndex: 3 },
			{ sourceIndex: 3, targetIndex: 4 }
		]
	},
	{
		id: 'data-pipeline',
		name: 'Data Pipeline',
		description: 'ETL + Analytics + Visualization',
		skills: [
			{ skillId: 'data-pipeline' },
			{ skillId: 'data-modeling' },
			{ skillId: 'data-visualization' }
		],
		connections: [
			{ sourceIndex: 0, targetIndex: 1 },
			{ sourceIndex: 1, targetIndex: 2 }
		]
	}
];

/**
 * Handle loading a workflow template
 */
async function handleLoadTemplate(templateId: string): Promise<void> {
	const template = WORKFLOW_TEMPLATES.find(t => t.id === templateId);

	if (!template) {
		// If not found by ID, try to find by name
		const templateByName = WORKFLOW_TEMPLATES.find(
			t => t.name.toLowerCase() === templateId.toLowerCase()
		);

		if (!templateByName) {
			broadcastError(`Template not found: ${templateId}. Available: ${WORKFLOW_TEMPLATES.map(t => t.id).join(', ')}`);
			return;
		}

		// Found by name, use it
		await loadTemplateToCanvas(templateByName);
		return;
	}

	await loadTemplateToCanvas(template);
}

/**
 * Load a template onto the canvas
 */
async function loadTemplateToCanvas(template: WorkflowTemplate): Promise<void> {
	// Clear existing canvas first
	clearCanvas();

	// Add all skills and track their data for connections
	const nodeData: Array<{ id: string; skill: Skill }> = [];

	for (let i = 0; i < template.skills.length; i++) {
		const skillDef = template.skills[i];
		const skill = await findSkill(skillDef.skillId);

		if (!skill) {
			console.warn('[CanvasSync] Skill not found for template:', skillDef.skillId);
			continue;
		}

		// Calculate position in a nice layout
		const position = skillDef.position || calculateLayoutPosition(
			i,
			template.skills.length,
			0,
			'horizontal'
		);

		const nodeId = addNode(skill, position);
		nodeData.push({ id: nodeId, skill });
	}

	// Create connections based on indices
	for (const conn of template.connections) {
		const sourceData = nodeData[conn.sourceIndex];
		const targetData = nodeData[conn.targetIndex];

		if (sourceData && targetData) {
			// Get ports for each node
			const sourcePorts = generatePorts({
				category: sourceData.skill.category,
				handoffs: sourceData.skill.handoffs,
				pairsWell: sourceData.skill.pairsWell,
				tags: sourceData.skill.tags
			});
			const targetPorts = generatePorts({
				category: targetData.skill.category,
				handoffs: targetData.skill.handoffs,
				pairsWell: targetData.skill.pairsWell,
				tags: targetData.skill.tags
			});

			const sourcePortId = sourcePorts.outputs[0]?.id || 'output-0';
			const targetPortId = targetPorts.inputs[0]?.id || 'input-0';

			addConnection(sourceData.id, sourcePortId, targetData.id, targetPortId);
		}
	}

	console.log('[CanvasSync] Loaded template:', template.name);
	toasts.success(`Loaded template: ${template.name} (${nodeData.length} skills)`);
	broadcastCanvasState();
}

/**
 * Get list of available templates
 */
export function getAvailableTemplates(): Array<{ id: string; name: string; description: string }> {
	return WORKFLOW_TEMPLATES.map(t => ({
		id: t.id,
		name: t.name,
		description: t.description
	}));
}

/**
 * Handle exporting workflow as a combined prompt
 */
async function handleExportPrompt(): Promise<void> {
	const currentNodes = get(nodes);
	const currentConnections = get(connections);

	if (currentNodes.length === 0) {
		broadcastError('No skills on canvas to export');
		return;
	}

	// Build execution order based on connections
	const orderedSkills = getExecutionOrder(currentNodes, currentConnections);

	// Try to fetch full content for each skill from MCP
	const state = get(mcpState);
	const skillContents: Map<string, string> = new Map();

	if (state.status === 'connected') {
		console.log('[CanvasSync] Fetching full skill content for export...');
		for (const skill of orderedSkills) {
			try {
				const result = await mcpClient.getSkill(skill.id);
				if (result.success && result.data?.content) {
					skillContents.set(skill.id, result.data.content);
				}
			} catch (e) {
				// Silently fall back to metadata
			}
		}
		console.log('[CanvasSync] Fetched full content for', skillContents.size, 'of', orderedSkills.length, 'skills');
	}

	// Build the combined prompt
	const promptParts: string[] = [];

	promptParts.push('# Workflow Execution Prompt');
	promptParts.push('');
	promptParts.push(`This workflow contains ${orderedSkills.length} skills that should be applied in order.`);
	promptParts.push('');

	for (let i = 0; i < orderedSkills.length; i++) {
		const skill = orderedSkills[i];
		const fullContent = skillContents.get(skill.id);

		promptParts.push(`## Step ${i + 1}: ${skill.name}`);
		promptParts.push('');

		if (fullContent) {
			// Use full skill content
			promptParts.push(fullContent);
		} else {
			// Fall back to metadata-based content
			promptParts.push(skill.description);
			promptParts.push('');

			if (skill.tags && skill.tags.length > 0) {
				promptParts.push(`**Focus areas:** ${skill.tags.join(', ')}`);
			}
		}
		promptParts.push('');
	}

	promptParts.push('---');
	promptParts.push('');
	promptParts.push('Apply these skills in sequence, using the output of each step as context for the next.');

	const prompt = promptParts.join('\n');

	syncClient.broadcast({
		type: 'canvas_prompt' as SyncEvent['type'],
		data: {
			prompt,
			skillCount: orderedSkills.length,
			skills: orderedSkills.map(s => ({ id: s.id, name: s.name })),
			hasFullContent: skillContents.size > 0,
			fullContentCount: skillContents.size
		}
	});

	toasts.success(`Exported workflow prompt with ${orderedSkills.length} skills`);
	console.log('[CanvasSync] Exported prompt with', orderedSkills.length, 'skills', `(${skillContents.size} with full content)`);
}

/**
 * Get skills in execution order (topological sort based on connections)
 */
function getExecutionOrder(currentNodes: CanvasNode[], currentConnections: Connection[]): Skill[] {
	// Build adjacency list
	const inDegree = new Map<string, number>();
	const adjacency = new Map<string, string[]>();

	// Initialize
	for (const node of currentNodes) {
		inDegree.set(node.id, 0);
		adjacency.set(node.id, []);
	}

	// Build graph
	for (const conn of currentConnections) {
		adjacency.get(conn.sourceNodeId)?.push(conn.targetNodeId);
		inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) || 0) + 1);
	}

	// Kahn's algorithm for topological sort
	const queue: string[] = [];
	for (const [nodeId, degree] of inDegree) {
		if (degree === 0) {
			queue.push(nodeId);
		}
	}

	const orderedIds: string[] = [];
	while (queue.length > 0) {
		const nodeId = queue.shift()!;
		orderedIds.push(nodeId);

		for (const neighbor of adjacency.get(nodeId) || []) {
			inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
			if (inDegree.get(neighbor) === 0) {
				queue.push(neighbor);
			}
		}
	}

	// If we didn't get all nodes, there's a cycle - just use all nodes in any order
	if (orderedIds.length !== currentNodes.length) {
		console.warn('[CanvasSync] Cycle detected in workflow, using arbitrary order');
		return currentNodes.map(n => n.skill);
	}

	// Map back to skills in order
	return orderedIds
		.map(id => currentNodes.find(n => n.id === id)?.skill)
		.filter((s): s is Skill => s !== undefined);
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
