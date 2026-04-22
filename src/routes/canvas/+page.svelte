<script lang="ts">
	import DraggableNode from '$lib/components/nodes/DraggableNode.svelte';
	import SkillsPanel from '$lib/components/SkillsPanel.svelte';
	import BrandLogo from '$lib/components/BrandLogo.svelte';
	import ConnectionLine from '$lib/components/ConnectionLine.svelte';
	import ExecutionPanel from '$lib/components/ExecutionPanel.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import Minimap from '$lib/components/Minimap.svelte';
	import NodeConfigPanel from '$lib/components/NodeConfigPanel.svelte';
	import { canvasState, nodes, connections, selectedNodeId, selectedNodeIds, selectedConnectionId, selectedNode, draggingConnection, cuttingLine, selectionBox, snapToGrid, gridSize, addNode, addConnection, addNodesWithConnections, selectNode, selectConnection, selectAllNodes, clearSelection, deleteSelected, duplicateSelected, copySelected, pasteFromClipboard, removeConnection, removeNode, setZoom, setPan, zoomToFit, frameSelected, clearCanvas, loadCanvas, enableAutoSave, deleteSavedCanvas, getSavedCanvasInfo, undo, redo, canUndo, canRedo, clearHistory, startConnectionCut, updateConnectionCut, endConnectionCut, cancelConnectionCut, startSelectionBox, updateSelectionBox, endSelectionBox, cancelSelectionBox, toggleSnapToGrid, snapPosition, autoLayout, endConnectionDrag, resetTransientState } from '$lib/stores/canvas.svelte';
import { get } from 'svelte/store';
	import type { CuttingLine, CanvasNode, Connection, DraggingConnection, SelectionBox } from '$lib/stores/canvas.svelte';
	import { onMount, tick } from 'svelte';
	import { goto, beforeNavigate, afterNavigate } from '$app/navigation';
	import { type Skill, getSkillById } from '$lib/stores/skills.svelte';
	import { validateForMission, buildMissionFromCanvas } from '$lib/services/mission-builder';
	import { mcpState } from '$lib/stores/mcp.svelte';
	import { reconnectAll as reconnectMCPs, connectedInstances } from '$lib/stores/mcps.svelte';
	import { getGoalState, hasPendingGoal, clearGoal } from '$lib/stores/project-goal.svelte';
	import { generatePipeline } from '$lib/services/smart-pipeline';
	import { initCanvasSync } from '$lib/services/canvas-sync';
	import PipelineSelector from '$lib/components/PipelineSelector.svelte';
	import SessionStateBar from '$lib/components/SessionStateBar.svelte';
	import { initPipelines, saveCurrentPipeline, getActivePipelineData, ensurePipeline, type PipelineData } from '$lib/stores/pipelines.svelte';
	import { hasResumableMission } from '$lib/services/persistence';
	import { DroppedSkillSchema, safeJsonParse } from '$lib/types/schemas';
	import { getPendingLoad } from '$lib/services/pipeline-loader';
	import { loadSkills, skills as skillsStore } from '$lib/stores/skills.svelte';
	import { workflowTemplates } from '$lib/data/templates';
	import type { OpenclawCanvasSnapshot } from '$lib/services/openclaw-bridge';

	let showExecution = $state(false);
	let executionMinimized = $state(false);
	let executionAutoRunToken = $state<number | null>(null);
	let showNodeDetails = $state(false);
	let showMissionExport = $state(false);
	let missionName = $state('');
	let missionDescription = $state('');
	let missionExporting = $state(false);
	let missionExportError = $state<string | null>(null);
	let isMcpConnected = $state(false);
	let mcpConnectedCount = $state(0);
	let canvasEl: HTMLDivElement;
	let lastSaved = $state<Date | null>(null);

	// Context menu state
	let contextMenu = $state<{ x: number; y: number; type: 'node' | 'connection' | 'canvas'; targetId?: string } | null>(null);

	// Confirmation modal state
	let showClearConfirm = $state(false);

	// Goal processing state
	let goalProcessing = $state(false);
	let goalProcessingMessage = $state('');
	let goalProcessingError = $state<string | null>(null);
	let goalSummary = $state<string | null>(null);

	// Fix 1 & 3: Track mount state to ensure goal processing waits for full initialization
	let isMounted = $state(false);
	let pendingGoalProcess = $state(false);
	let lastOpenclawSyncAt: string | null = null;
	let isApplyingOpenclawUpdate = false;

	type OpenclawCanvasSkillNode = {
		id: string;
		skillId: string;
		skillName: string;
		description: string;
		position: { x: number; y: number };
	};

	type OpenclawCanvasLink = {
		id: string;
		sourceNodeId: string;
		targetNodeId: string;
	};

	// Force sync local state from stores
	// This ensures local variables are in sync after async operations
	function forceStoreSync() {
		const state = get(canvasState);
		zoom = state.zoom;
		pan = state.pan;
		currentNodes = get(nodes);
		currentConnections = get(connections);
		currentSelectedNodeId = get(selectedNodeId);
		currentSelectedNodeIds = get(selectedNodeIds);
		currentSelectedConnectionId = get(selectedConnectionId);
		currentSelectedNode = get(selectedNode);
		currentDraggingConnection = get(draggingConnection);
		currentCuttingLine = get(cuttingLine);
		currentSelectionBox = get(selectionBox);
		currentSnapToGrid = get(snapToGrid);
		currentGridSize = get(gridSize);
		currentCanUndo = get(canUndo);
		currentCanRedo = get(canRedo);
	}

	// Clean up when navigating away from the canvas page
	beforeNavigate(() => {
		// Reset all transient state before leaving
		resetTransientState();
		// Reset local states
		isPanning = false;
		isCutting = false;
		isSelecting = false;
	});

	// Reset state when arriving at canvas page (handles client-side navigation)
	afterNavigate(() => {
		// Reset transient state after navigation completes
		resetTransientState();
		isPanning = false;
		isCutting = false;
		isSelecting = false;

		// Fix 6: Force sync local state from stores after navigation
		forceStoreSync();

		// Note: pendingGoalProcess is now set in onMount when a goal is detected
		// This ensures a new pipeline is created BEFORE loading old data
	});

	/**
	 * Process pending goal using new atomic pipeline generation
	 *
	 * KISS principle: Simple, reliable, atomic.
	 * Uses smart-pipeline.ts to generate complete pipeline, then loads it atomically.
	 */
	async function processGoalIfPending() {
		if (!pendingGoalProcess || !isMounted) return;

		pendingGoalProcess = false;
		const goalState = getGoalState();

		if (!goalState.input) {
			clearGoal();
			return;
		}

		goalProcessing = true;
		goalProcessingMessage = 'Analyzing your project with AI...';
		goalProcessingError = null;

		try {
			// Generate pipeline atomically using smart-pipeline
			const result = await generatePipeline(goalState.input);

			if (!result.success || !result.pipeline) {
				goalProcessingError = result.error || 'Failed to generate pipeline';
				return;
			}

			const { pipeline } = result;

			// Create nodes with proper IDs, keeping track of skill-to-node mapping
			const skillToNodeId = new Map<string, string>();
			const canvasNodes = pipeline.nodes.map(node => {
				const nodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
				skillToNodeId.set(node.skillId, nodeId);
				return {
					id: nodeId,
					skillId: node.skillId,
					skill: node.skill,
					position: node.position,
					status: 'idle' as const
				};
			});

			// Convert pipeline connections to canvas connections
			const canvasConnections = pipeline.connections
				.map(conn => {
					const sourceNodeId = skillToNodeId.get(conn.sourceId);
					const targetNodeId = skillToNodeId.get(conn.targetId);
					if (!sourceNodeId || !targetNodeId) return null;
					return {
						id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
						sourceNodeId,
						sourcePortId: conn.sourcePort,
						targetNodeId,
						targetPortId: conn.targetPort
					};
				})
				.filter((c): c is NonNullable<typeof c> => c !== null);

			// Load pipeline atomically - one state update, no intermediate states
			canvasState.update(state => ({
				...state,
				nodes: canvasNodes,
				connections: canvasConnections,
				zoom: 1,
				pan: { x: 0, y: 0 }
			}));

			goalSummary = pipeline.summary;
			goalProcessingMessage = `Added ${pipeline.nodes.length} skills`;

			// CRITICAL: Sync local state from stores after atomic update
			// Without this, local variables are stale and canvas becomes unresponsive
			await tick();
			forceStoreSync();

			// Reset all interaction states to ensure clean canvas
			isPanning = false;
			isCutting = false;
			isSelecting = false;
			resetTransientState();

			// Zoom to fit after DOM update
			await tick();
			if (canvasEl) {
				const rect = canvasEl.getBoundingClientRect();
				zoomToFit(rect.width, rect.height);
			}

		} catch (error) {
			console.error('[Canvas] Goal processing error:', error);
			goalProcessingError = error instanceof Error ? error.message : 'An error occurred';
		} finally {
			goalProcessing = false;
			// Final state sync to ensure everything is clean
			forceStoreSync();
			resetTransientState();
			clearGoal();
		}
	}

	// Watch for when both mount is complete and there's a pending goal
	$effect(() => {
		if (isMounted && pendingGoalProcess) {
			processGoalIfPending();
		}
	});

	function resolveOpenclawSkill(node: OpenclawCanvasSkillNode): Skill {
		const availableSkills = get(skillsStore);
		const existing =
			availableSkills.find((skill) => skill.id === node.skillId) ||
			availableSkills.find((skill) => skill.name === node.skillName);
		if (existing) return existing;

		return {
			id: node.skillId,
			name: node.skillName || node.skillId,
			description: node.description || `OpenClaw skill ${node.skillName || node.skillId}`,
			category: 'development',
			tier: 'free',
			tags: [],
			triggers: [],
			handoffs: [],
			pairsWell: []
		};
	}

	async function applyOpenclawSnapshot(snapshot: OpenclawCanvasSnapshot): Promise<void> {
		if (isApplyingOpenclawUpdate) return;
		isApplyingOpenclawUpdate = true;

		try {
			const incomingNodes = snapshot.nodes as OpenclawCanvasSkillNode[];
			const incomingConnections = snapshot.connections as OpenclawCanvasLink[];
			const nodeIds = new Set(incomingNodes.map((node) => node.id));

			const canvasNodes: CanvasNode[] = incomingNodes.map((node) => ({
				id: node.id,
				skillId: node.skillId,
				skill: resolveOpenclawSkill(node),
				position: node.position,
				status: 'idle'
			}));

			const canvasConnections: Connection[] = incomingConnections
				.filter((connection) => nodeIds.has(connection.sourceNodeId) && nodeIds.has(connection.targetNodeId))
				.map((connection) => ({
					id: connection.id,
					sourceNodeId: connection.sourceNodeId,
					sourcePortId: 'output',
					targetNodeId: connection.targetNodeId,
					targetPortId: 'input'
				}));

			ensurePipeline(snapshot.pipelineId, snapshot.pipelineName);
			canvasState.update((state) => ({
				...state,
				nodes: canvasNodes,
				connections: canvasConnections,
				selectedNodeId: null,
				selectedNodeIds: [],
				selectedConnectionId: null
			}));

			saveCurrentPipeline({
				nodes: canvasNodes,
				connections: canvasConnections,
				zoom: get(canvasState).zoom,
				pan: get(canvasState).pan
			});
			lastSaved = new Date();
			clearHistory();
			await tick();
			forceStoreSync();
		} finally {
			isApplyingOpenclawUpdate = false;
		}
	}

	async function syncOpenclawCanvasState(): Promise<void> {
		if (goalProcessing) return;

		const query = lastOpenclawSyncAt ? `?since=${encodeURIComponent(lastOpenclawSyncAt)}` : '';
		const response = await fetch(`/api/openclaw/canvas-state${query}`);
		if (!response.ok) return;

		const payload = (await response.json()) as {
			hasUpdate?: boolean;
			snapshot?: OpenclawCanvasSnapshot | null;
		};

		if (!payload?.hasUpdate || !payload.snapshot) return;
		lastOpenclawSyncAt = payload.snapshot.updatedAt;
		await applyOpenclawSnapshot(payload.snapshot);
	}

	onMount(() => {
		// Reset all transient store state first (handles client-side navigation)
		resetTransientState();
		// Reset local states
		isPanning = false;
		isCutting = false;
		isSelecting = false;

		// Initialize pipeline system
		initPipelines();
		let disposed = false;
		let disableAutoSave: (() => void) | null = null;
		let pipelineAutoSaveInterval: ReturnType<typeof setInterval> | null = null;
		let cleanupCanvasSync: (() => void) | null = null;
		let stuckStateInterval: ReturnType<typeof setInterval> | null = null;
		let openclawSyncInterval: ReturnType<typeof setInterval> | null = null;
		let resizeObserver: ResizeObserver | null = null;

		// Global mouseup handler to reset stuck states (catches mouseup outside canvas)
		function handleGlobalMouseUp() {
			if (isPanning || isCutting || isSelecting) {
				handleMouseUp();
			}
		}

		// Builder panel requests to frame newly added nodes
		function handleBuilderFrameSelected() {
			if (canvasEl) {
				const rect = canvasEl.getBoundingClientRect();
				frameSelected(rect.width, rect.height);
			}
		}

		void (async () => {
		try {
			await loadSkills();
			if (disposed) return;

			// Reconnect any previously-connected MCPs so tools are available for missions
			reconnectMCPs().catch((e) => console.warn('[Canvas] MCP reconnect error:', e));

		// Auto-show execution panel if there's an active/resumable mission
		const hasResumable = hasResumableMission();
		console.log('[Canvas] hasResumableMission:', hasResumable);
		if (hasResumable) {
			showExecution = true;
			console.log('[Canvas] Auto-showing execution panel');
		}

		// =====================================================================
		// SINGLE LOADING PATH - No more race conditions!
		// =====================================================================
		// Priority: 1. Pending load (from PRD/goal) → 2. Active pipeline
		// =====================================================================

		const pendingLoad = await getPendingLoad();
		if (disposed) return;

		if (pendingLoad) {
			// PENDING LOAD: PRD analysis or goal processing queued a pipeline
			console.log('[Canvas] Loading queued pipeline:', pendingLoad.pipelineName);
			console.log('[Canvas] Source:', pendingLoad.source, '| Nodes:', pendingLoad.nodes.length, '| Connections:', pendingLoad.connections.length);

			// Ensure the exact queued pipeline ID exists and is active
			const targetPipeline = ensurePipeline(pendingLoad.pipelineId, pendingLoad.pipelineName);

			// Clear and load the exact nodes/connections
			clearCanvas();
			if (pendingLoad.nodes.length > 0) {
				addNodesWithConnections(pendingLoad.nodes, pendingLoad.connections);
			}

			// Save immediately
			saveCurrentPipeline({
				nodes: get(nodes),
				connections: get(connections),
				zoom: 1,
				pan: { x: 0, y: 0 }
			});

			lastSaved = new Date();
			console.log(
				'[Canvas] Loaded pipeline:',
				targetPipeline.name,
				`(${targetPipeline.id})`,
				'with',
				get(nodes).length,
				'nodes and',
				get(connections).length,
				'connections'
			);
		} else {
			// NO PENDING LOAD: Load active pipeline from localStorage
			const pipelineData = getActivePipelineData();
			if (pipelineData) {
				loadPipelineToCanvas(pipelineData);
				lastSaved = new Date();
				console.log('[Canvas] Loaded active pipeline with', pipelineData.nodes?.length || 0, 'nodes');
			} else {
				// Fallback: try old format for migration
				const loaded = loadCanvas();
				if (loaded) {
					const info = getSavedCanvasInfo();
					if (info) {
						lastSaved = info.savedAt;
					}
				}
			}
		}

		// Initialize history with current state
		clearHistory();

		// Enable auto-save with pipeline support
		disableAutoSave = enableAutoSave(1000);

		// Set up pipeline auto-save (syncs to pipeline storage)
		pipelineAutoSaveInterval = setInterval(() => {
			saveCurrentPipelineData();
		}, 2000);

		// Initialize canvas sync for Claude Code integration
		cleanupCanvasSync = initCanvasSync();

		// Keep /canvas in sync with external OpenClaw command API updates
		await syncOpenclawCanvasState().catch((error) => {
			console.warn('[Canvas] Initial OpenClaw sync failed:', error);
		});
		openclawSyncInterval = setInterval(() => {
			void syncOpenclawCanvasState().catch((error) => {
				console.warn('[Canvas] OpenClaw sync poll failed:', error);
			});
		}, 1200);

		window.addEventListener('mouseup', handleGlobalMouseUp);

		// FIX 15: Safety valve - detect and reset stuck interaction states
		// This runs periodically to catch any states that got stuck due to edge cases
		let lastInteractionCheck = Date.now();
		let wasInteracting = false;
		stuckStateInterval = setInterval(() => {
			const isInteracting = isPanning || isCutting || isSelecting || currentDraggingConnection !== null;
			const now = Date.now();

			if (isInteracting && wasInteracting) {
				// Been interacting for the whole interval - check if stuck
				const timeSinceCheck = now - lastInteractionCheck;
				if (timeSinceCheck > 3000) { // 3 seconds without mouseup = probably stuck
					console.warn('Resetting stuck canvas interaction states');
					isPanning = false;
					isCutting = false;
					isSelecting = false;
					resetTransientState();
					endConnectionDrag(); // Also reset any stuck connection drag
					forceStoreSync();
				}
			}

			if (isInteracting) {
				wasInteracting = true;
			} else {
				wasInteracting = false;
				lastInteractionCheck = now;
			}
		}, 1000);

		window.addEventListener('builder:frame-selected', handleBuilderFrameSelected);

		// Track canvas dimensions for minimap
		resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				canvasWidth = entry.contentRect.width;
				canvasHeight = entry.contentRect.height;
			}
		});

		// Use requestAnimationFrame to ensure canvasEl is bound after render
		requestAnimationFrame(() => {
			if (disposed || !resizeObserver) return;
			if (canvasEl) {
				resizeObserver.observe(canvasEl);
				// Get initial dimensions
				const rect = canvasEl.getBoundingClientRect();
				canvasWidth = rect.width;
				canvasHeight = rect.height;
			}
			// Fix 6: Force sync local state from stores after mount
			forceStoreSync();
			// Fix 3: Mark as fully mounted after all initialization is complete
			// This triggers goal processing if there's a pending goal
			isMounted = true;
		});
		} catch (mountError) {
			console.error('[Canvas] Mount initialization failed:', mountError);
		}
		})();

		return () => {
			disposed = true;
			// Fix 3: Mark as unmounted before cleanup
			isMounted = false;
			pendingGoalProcess = false;
			disableAutoSave?.();
			if (pipelineAutoSaveInterval) clearInterval(pipelineAutoSaveInterval);
			if (stuckStateInterval) clearInterval(stuckStateInterval); // FIX 15: Clean up stuck state detector
			if (openclawSyncInterval) clearInterval(openclawSyncInterval);
			cleanupCanvasSync?.();
			resizeObserver?.disconnect();
			window.removeEventListener('mouseup', handleGlobalMouseUp);
			window.removeEventListener('builder:frame-selected', handleBuilderFrameSelected);
			// Save current pipeline before unmount
			saveCurrentPipelineData();
			// Reset all transient state on unmount (catches HMR and other edge cases)
			resetTransientState();
			isPanning = false;
			isCutting = false;
			isSelecting = false;
		};
	});

	function handleMinimapPan(x: number, y: number) {
		setPan({ x, y });
	}

	function handleClear() {
		if (currentNodes.length > 0) {
			showClearConfirm = true;
			return;
		}
		clearCanvas();
		deleteSavedCanvas();
		lastSaved = null;
	}

	function confirmClear() {
		clearCanvas();
		deleteSavedCanvas();
		lastSaved = null;
		showClearConfirm = false;
	}

	function cancelClear() {
		showClearConfirm = false;
	}

	// Pipeline management functions
	function loadPipelineToCanvas(data: PipelineData) {
		// Clear current canvas first
		clearCanvas();

		// Set zoom and pan
		setZoom(data.zoom || 1);
		setPan(data.pan || { x: 0, y: 0 });

		// Add nodes
		if (data.nodes && data.nodes.length > 0) {
			// We need to restore the full node structure
			canvasState.update(state => ({
				...state,
				nodes: data.nodes,
				connections: data.connections || []
			}));
		}

		// Clear history after loading
		clearHistory();
		forceStoreSync();
	}

	function saveCurrentPipelineData() {
		const state = get(canvasState);
		saveCurrentPipeline({
			nodes: state.nodes,
			connections: state.connections,
			zoom: state.zoom,
			pan: state.pan
		});
	}

	function getCurrentCanvasData() {
		const state = get(canvasState);
		return {
			nodes: state.nodes,
			connections: state.connections,
			zoom: state.zoom,
			pan: state.pan
		};
	}

	function handlePipelineSwitch(data: PipelineData | null) {
		if (data) {
			loadPipelineToCanvas(data);
		} else {
			// New empty pipeline
			clearCanvas();
			clearHistory();
		}
		lastSaved = new Date();
	}

	// Subscribe to connection states
	$effect(() => {
		const unsub1 = mcpState.subscribe((s) => (isMcpConnected = s.status === 'connected'));
		const unsub2 = connectedInstances.subscribe((instances) => (mcpConnectedCount = instances.length));
		return () => { unsub1(); unsub2(); };
	});

	// Mission export handlers
	function openMissionExport() {
		// Validate first
		const validation = validateForMission(currentNodes, currentConnections);
		if (!validation.valid) {
			missionExportError = validation.issues.join('\n');
		} else {
			missionExportError = null;
		}
		// Generate default name from first node or timestamp
		if (!missionName) {
			const timestamp = new Date().toISOString().slice(0, 10);
			missionName = currentNodes.length > 0
				? `${currentNodes[0].skill.name} Workflow`
				: `Workflow ${timestamp}`;
		}
		showMissionExport = true;
	}

	async function handleMissionExport() {
		if (!missionName.trim()) {
			missionExportError = 'Mission name is required';
			return;
		}

		missionExporting = true;
		missionExportError = null;

		try {
			const result = await buildMissionFromCanvas(currentNodes, currentConnections, {
				name: missionName.trim(),
				description: missionDescription.trim() || undefined
			});

			if (result.success && result.mission) {
				showMissionExport = false;
				missionName = '';
				missionDescription = '';
				// Navigate to the new mission
				goto(`/missions/${result.mission.id}`);
			} else {
				missionExportError = result.error || 'Failed to create mission';
			}
		} catch (e) {
			missionExportError = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			missionExporting = false;
		}
	}

	function closeMissionExport() {
		showMissionExport = false;
		missionExportError = null;
	}

	let zoom = $state(1);
	let pan = $state({ x: 0, y: 0 });
	let isPanning = $state(false);
	let panStart = $state({ x: 0, y: 0 });

	$effect(() => {
		const unsubscribe = canvasState.subscribe((state) => { zoom = state.zoom; pan = state.pan; });
		return unsubscribe;
	});

	let currentNodes = $state<CanvasNode[]>([]);
	let currentConnections = $state<Connection[]>([]);
	let currentSelectedNodeId = $state<string | null>(null);
	let currentSelectedNodeIds = $state<string[]>([]);
	let currentSelectedConnectionId = $state<string | null>(null);
	let currentSelectedNode = $state<CanvasNode | null>(null);
	let currentDraggingConnection = $state<DraggingConnection | null>(null);
	let currentCuttingLine = $state<CuttingLine | null>(null);
	let currentSelectionBox = $state<SelectionBox | null>(null);
	let currentSnapToGrid = $state(true);
	let currentGridSize = $state(24);
	let isCutting = $state(false);
	let isSelecting = $state(false);
	let currentCanUndo = $state(false);
	let currentCanRedo = $state(false);

	// Node search
	let searchQuery = $state('');
	let showSearch = $state(false);
	let searchInputEl: HTMLInputElement;

	// Minimap
	let showMinimap = $state(true);
	let canvasWidth = $state(800);
	let canvasHeight = $state(600);

	// Auto-layout
	let showLayoutMenu = $state(false);

	function handleAutoLayout(mode: 'grid' | 'horizontal' | 'vertical' | 'category') {
		autoLayout(canvasWidth, canvasHeight, mode);
		showLayoutMenu = false;
	}

	function addAdventureJoyPreset() {
		const template = workflowTemplates.find((entry) => entry.id === 'adventure-joy');
		if (!template) return;

		const state = get(canvasState);
		const baseX = 120 - state.pan.x / state.zoom;
		const baseY = 120 - state.pan.y / state.zoom;

		const nodeDefs: { skill: Skill; position: { x: number; y: number } }[] = [];
		for (const templateNode of template.nodes) {
			const skill = getSkillById(templateNode.skillId);
			if (!skill) continue;
			nodeDefs.push({
				skill,
				position: snapPosition(baseX + templateNode.offsetX, baseY + templateNode.offsetY)
			});
		}

		if (nodeDefs.length === 0) return;
		addNodesWithConnections(nodeDefs, template.connections);
		if (canvasEl) {
			const rect = canvasEl.getBoundingClientRect();
			frameSelected(rect.width, rect.height);
		}
	}

	// Filter nodes matching search query
	const matchingNodes = $derived(() => {
		if (!searchQuery.trim()) return [];
		const query = searchQuery.toLowerCase();
		return currentNodes.filter(node =>
			node.skill.name.toLowerCase().includes(query) ||
			node.skill.description?.toLowerCase().includes(query) ||
			node.skill.category.toLowerCase().includes(query) ||
			node.skill.tags?.some(tag => tag.toLowerCase().includes(query))
		);
	});

	function toggleSearch() {
		showSearch = !showSearch;
		if (showSearch) {
			setTimeout(() => searchInputEl?.focus(), 0);
		} else {
			searchQuery = '';
		}
	}

	function focusNode(nodeId: string) {
		const node = currentNodes.find(n => n.id === nodeId);
		if (!node || !canvasEl) return;

		selectNode(nodeId);

		// Center viewport on node
		const rect = canvasEl.getBoundingClientRect();
		const NODE_WIDTH = 192;
		const NODE_HEIGHT = 48;
		const centerX = node.position.x + NODE_WIDTH / 2;
		const centerY = node.position.y + NODE_HEIGHT / 2;
		const panX = rect.width / 2 - centerX * zoom;
		const panY = rect.height / 2 - centerY * zoom;

		setPan({ x: panX, y: panY });
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			toggleSearch();
		} else if (e.key === 'Enter') {
			const matches = matchingNodes();
			if (matches.length > 0) {
				focusNode(matches[0].id);
			}
		}
	}

	$effect(() => {
		const unsub1 = nodes.subscribe((n) => (currentNodes = n));
		const unsub2 = connections.subscribe((c) => (currentConnections = c));
		const unsub3 = selectedNodeId.subscribe((id) => (currentSelectedNodeId = id));
		const unsub4 = selectedNodeIds.subscribe((ids) => (currentSelectedNodeIds = ids));
		const unsub5 = selectedConnectionId.subscribe((id) => (currentSelectedConnectionId = id));
		const unsub6 = selectedNode.subscribe((node) => (currentSelectedNode = node));
		const unsub7 = draggingConnection.subscribe((dc) => (currentDraggingConnection = dc));
		const unsub8 = canUndo.subscribe((v) => (currentCanUndo = v));
		const unsub9 = canRedo.subscribe((v) => (currentCanRedo = v));
		const unsub10 = cuttingLine.subscribe((cl) => (currentCuttingLine = cl));
		const unsub11 = selectionBox.subscribe((sb) => (currentSelectionBox = sb));
		const unsub12 = snapToGrid.subscribe((s) => (currentSnapToGrid = s));
		const unsub13 = gridSize.subscribe((g) => (currentGridSize = g));
		return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); unsub8(); unsub9(); unsub10(); unsub11(); unsub12(); unsub13(); };
	});

	function handleKeydown(e: KeyboardEvent) {
		// Don't handle shortcuts if typing in an input
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
			return;
		}

		// Delete: Remove selected nodes or connection
		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			deleteSelected();
		}
		// Undo: Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
		if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
			e.preventDefault();
			undo();
		}
		// Redo: Ctrl+Shift+Z or Ctrl+Y (Windows/Linux) or Cmd+Shift+Z (Mac)
		if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
			e.preventDefault();
			redo();
		}
		// Select All: Ctrl+A
		if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
			e.preventDefault();
			selectAllNodes();
		}
		// Duplicate: Ctrl+D
		if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
			e.preventDefault();
			duplicateSelected();
		}
		// Copy: Ctrl+C
		if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
			e.preventDefault();
			copySelected();
		}
		// Paste: Ctrl+V
		if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
			e.preventDefault();
			pasteFromClipboard();
		}
		// Escape: Clear selection
		if (e.key === 'Escape') {
			clearSelection();
			showNodeDetails = false;
		}
		// Frame selected: F key
		if (e.key === 'f' && !e.ctrlKey && !e.metaKey && currentSelectedNodeIds.length > 0) {
			e.preventDefault();
			if (canvasEl) {
				const rect = canvasEl.getBoundingClientRect();
				frameSelected(rect.width, rect.height);
			}
		}
		// Search: Ctrl+F
		if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
			e.preventDefault();
			toggleSearch();
		}
	}

	function getTempConnectionPath(dc: DraggingConnection): string {
		if (!dc) return '';
		const { startX, startY, currentX, currentY, sourcePortType } = dc;
		let fromX: number, fromY: number, toX: number, toY: number;
		if (sourcePortType === 'output') {
			fromX = startX; fromY = startY;
			toX = currentX; toY = currentY;
		} else {
			fromX = currentX; fromY = currentY;
			toX = startX; toY = startY;
		}
		const midX = (fromX + toX) / 2;
		return 'M ' + fromX + ' ' + fromY + ' C ' + midX + ' ' + fromY + ', ' + midX + ' ' + toY + ', ' + toX + ' ' + toY;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		if (!e.dataTransfer) return;
		const skillJson = e.dataTransfer.getData('application/json');
		if (!skillJson) return;
		// SECURITY: Validate JSON with Zod schema
		const skill = safeJsonParse(skillJson, DroppedSkillSchema, 'canvas-drop');
		if (!skill) {
			console.error('Invalid skill data dropped on canvas');
			return;
		}

		const normalizedTier = typeof skill.tier === 'number' ? (skill.tier > 1 ? 'premium' : 'free') : (skill.tier || 'free');
		const normalizedSkill: Skill = {
			id: skill.id,
			name: skill.name || skill.id,
			description: skill.description || '',
			category: (skill.category as Skill['category']) || 'development',
			tier: normalizedTier,
			tags: skill.tags || [],
			triggers: skill.triggers || [],
			handoffs: skill.handoffs || [],
			pairsWell: skill.pairsWell || []
		};

		const rect = canvasEl.getBoundingClientRect();
		const rawX = (e.clientX - rect.left - pan.x) / zoom;
		const rawY = (e.clientY - rect.top - pan.y) / zoom;
		const snapped = snapPosition(rawX, rawY);
		addNode(normalizedSkill, snapped);
	}

	function handleDragOver(e: DragEvent) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }

	// Handle click on handoff port - spawn the recommended skill and auto-connect
	function handleHandoffClick(skillId: string, sourceNodeId: string, sourcePortId: string) {
		const skill = getSkillById(skillId);
		if (!skill) {
			console.warn(`Skill not found: ${skillId}`);
			return;
		}

		// Find the source node to position the new node relative to it
		const sourceNode = currentNodes.find(n => n.id === sourceNodeId);
		if (!sourceNode) return;

		// Position the new node to the right of the source node
		const newPosition = snapPosition(
			sourceNode.position.x + 250, // 250px to the right
			sourceNode.position.y
		);

		// Add the new node
		const newNodeId = addNode(skill, newPosition);

		// Auto-connect from the handoff port to the new node's input
		if (newNodeId) {
			addConnection(sourceNodeId, sourcePortId, newNodeId, 'input');
			// Select the new node
			selectNode(newNodeId);
		}
	}

	function handleCanvasClick(e: MouseEvent) { if (e.target === e.currentTarget) { clearSelection(); showLayoutMenu = false; } }
	function handleZoomIn() { setZoom(zoom + 0.1); }
	function handleZoomOut() { setZoom(zoom - 0.1); }
	function handleZoomReset() { setZoom(1); }
	function handleZoomToFit() {
		if (canvasEl) {
			const rect = canvasEl.getBoundingClientRect();
			zoomToFit(rect.width, rect.height);
		}
	}
	function handleMouseDown(e: MouseEvent) {
		// Safety: ensure canvasEl exists
		if (!canvasEl) return;

		// Only handle canvas interactions if clicking directly on canvas or its background layers
		// Node elements handle their own mousedown with stopPropagation
		const target = e.target as HTMLElement;
		const isCanvasBackground = target === canvasEl ||
			target.classList.contains('canvas-area') ||
			target.tagName === 'svg' ||
			target.closest('svg.absolute');

		// FIX 14: More robust node detection - check for ANY element inside a node
		// This catches cases where click is on inner elements like SkillNode content
		const isInsideNode = target.closest('.draggable-node') ||
			target.closest('.node') ||
			target.closest('.port-handle');

		// If clicking inside a node, let the node handle it
		if (isInsideNode) {
			return;
		}

		// If not on canvas background and not inside a node, still don't start panning
		// This prevents accidental panning from unexpected elements
		if (!isCanvasBackground) {
			return;
		}

		// Ctrl+left-click to start cutting connections (Blender-style)
		if (e.button === 0 && e.ctrlKey && !e.altKey) {
			e.preventDefault();
			isCutting = true;
			const rect = canvasEl.getBoundingClientRect();
			const x = (e.clientX - rect.left - pan.x) / zoom;
			const y = (e.clientY - rect.top - pan.y) / zoom;
			startConnectionCut(x, y);
			return;
		}
		// Shift+left-click on empty canvas to start selection box
		if (e.button === 0 && e.shiftKey && !e.ctrlKey) {
			e.preventDefault();
			isSelecting = true;
			const rect = canvasEl.getBoundingClientRect();
			const x = (e.clientX - rect.left - pan.x) / zoom;
			const y = (e.clientY - rect.top - pan.y) / zoom;
			startSelectionBox(x, y);
			return;
		}
		// Left-click on empty canvas OR middle-click OR Alt+left-click for panning
		if (e.button === 1 || (e.button === 0 && e.altKey) || (e.button === 0 && !e.ctrlKey && !e.shiftKey)) {
			isPanning = true;
			panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
			e.preventDefault();
			return;
		}
	}
	function handleMouseMove(e: MouseEvent) {
		// Safety check
		if (!canvasEl) return;

		if (isPanning) {
			setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
		}
		if (isCutting) {
			const rect = canvasEl.getBoundingClientRect();
			const x = (e.clientX - rect.left - pan.x) / zoom;
			const y = (e.clientY - rect.top - pan.y) / zoom;
			updateConnectionCut(x, y);
		}
		if (isSelecting) {
			const rect = canvasEl.getBoundingClientRect();
			const x = (e.clientX - rect.left - pan.x) / zoom;
			const y = (e.clientY - rect.top - pan.y) / zoom;
			updateSelectionBox(x, y);
		}
	}
	function handleMouseUp() {
		isPanning = false;
		if (isCutting) {
			isCutting = false;
			endConnectionCut();
		}
		if (isSelecting) {
			isSelecting = false;
			endSelectionBox();
		}
	}

	function handleCanvasContextMenu(e: MouseEvent) {
		e.preventDefault();
		contextMenu = { x: e.clientX, y: e.clientY, type: 'canvas' };
	}

	function handleNodeContextMenu(nodeId: string, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		// Select the node if not already selected
		if (!currentSelectedNodeIds.includes(nodeId)) {
			selectNode(nodeId);
		}
		contextMenu = { x: e.clientX, y: e.clientY, type: 'node', targetId: nodeId };
	}

	function handleConnectionContextMenu(connectionId: string, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		selectConnection(connectionId);
		contextMenu = { x: e.clientX, y: e.clientY, type: 'connection', targetId: connectionId };
	}

	function closeContextMenu() {
		contextMenu = null;
	}

	function getContextMenuItems() {
		if (!contextMenu) return [];

		if (contextMenu.type === 'canvas') {
			return [
				{ label: 'Paste', icon: '📋', action: pasteFromClipboard, shortcut: 'Ctrl+V' },
				{ label: 'Select All', icon: '☑', action: selectAllNodes, shortcut: 'Ctrl+A' },
				{ divider: true as const },
				{ label: 'Zoom to Fit', icon: '🔍', action: handleZoomToFit },
				{ label: 'Reset Zoom', icon: '↺', action: handleZoomReset }
			];
		}

		if (contextMenu.type === 'node') {
			const hasMultipleSelected = currentSelectedNodeIds.length > 1;
			return [
				{ label: 'Open Details', icon: '📄', action: () => (showNodeDetails = true) },
				{ divider: true as const },
				{ label: 'Copy', icon: '📋', action: copySelected, shortcut: 'Ctrl+C' },
				{ label: 'Duplicate', icon: '⧉', action: duplicateSelected, shortcut: 'Ctrl+D' },
				{ divider: true as const },
				{ label: hasMultipleSelected ? `Delete ${currentSelectedNodeIds.length} nodes` : 'Delete', icon: '🗑', action: deleteSelected, shortcut: 'Del', danger: true }
			];
		}

		if (contextMenu.type === 'connection') {
			return [
				{ label: 'Delete Connection', icon: '🗑', action: () => contextMenu?.targetId && removeConnection(contextMenu.targetId), shortcut: 'Del', danger: true }
			];
		}

		return [];
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="h-screen flex bg-bg-primary relative">
	<aside class="w-64 border-r border-surface-border bg-bg-secondary flex flex-col z-10">
		<div class="p-4 border-b border-surface-border"><BrandLogo size="sm" /></div>
		<div class="flex-1 overflow-hidden"><SkillsPanel /></div>
		<div class="p-3 border-t border-surface-border">
			<div class="flex items-center justify-between">
				<div class="text-xs text-text-tertiary font-mono">{currentNodes.length} nodes</div>
				<div class="flex items-center gap-2">
					<span class="flex items-center gap-1 text-xs font-mono {mcpConnectedCount > 0 ? 'text-accent-primary' : 'text-text-tertiary'}" title="{mcpConnectedCount} MCP{mcpConnectedCount !== 1 ? 's' : ''} connected">
						<span class="w-1.5 h-1.5 rounded-full {mcpConnectedCount > 0 ? 'bg-accent-primary' : 'bg-text-tertiary'}"></span>
						{mcpConnectedCount} MCP{mcpConnectedCount !== 1 ? 's' : ''}
					</span>
				</div>
			</div>
		</div>
	</aside>
	<main class="flex-1 flex flex-col">
		<!-- Session State Bar - shows when returning to an active mission -->
		<SessionStateBar onOpenExecution={() => showExecution = true} />

		<!-- Two-row toolbar -->
		<header class="h-11 flex items-center px-3 gap-3 border-b border-surface-border bg-bg-secondary">
			<!-- Pipeline selector -->
			<PipelineSelector
				onSwitch={handlePipelineSwitch}
				onBeforeSwitch={getCurrentCanvasData}
			/>

			<div class="w-px h-5 bg-surface-border"></div>

			<!-- Undo/Redo -->
			<div class="flex items-center gap-1">
				<button class="toolbar-btn" onclick={() => undo()} disabled={!currentCanUndo} title="Undo (Ctrl+Z)">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
					</svg>
				</button>
				<button class="toolbar-btn" onclick={() => redo()} disabled={!currentCanRedo} title="Redo (Ctrl+Y)">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"/>
					</svg>
				</button>
			</div>

			<div class="w-px h-5 bg-surface-border"></div>

			<!-- Zoom controls -->
			<div class="flex items-center gap-1">
				<button class="toolbar-btn" onclick={handleZoomOut} title="Zoom out">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
					</svg>
				</button>
				<button class="toolbar-btn min-w-[3.25rem] font-mono text-xs" onclick={handleZoomReset} title="Reset zoom">
					{Math.round(zoom * 100)}%
				</button>
				<button class="toolbar-btn" onclick={handleZoomIn} title="Zoom in">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
					</svg>
				</button>
			</div>

			<div class="flex-1"></div>

			<!-- Primary actions -->
			<div class="flex items-center gap-2">
				<button
					onclick={handleClear}
					disabled={currentNodes.length === 0}
					class="px-2.5 py-1 text-xs font-mono text-text-secondary border border-surface-border rounded-md hover:border-text-tertiary hover:text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					title="Clear all nodes from canvas"
				>
					Clear All
				</button>
				<button
					onclick={openMissionExport}
					class="px-2.5 py-1 text-xs font-mono text-text-secondary border border-surface-border rounded-md hover:border-text-tertiary hover:text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={currentNodes.length === 0 || !isMcpConnected}
					title={!isMcpConnected ? 'Connect to MCP to export missions' : 'Export workflow as mission'}
				>
					Export
				</button>
				<button
					onclick={() => {
						executionAutoRunToken = null;
						showExecution = true;
						executionMinimized = false;
					}}
					class="px-2.5 py-1 text-xs font-mono bg-accent-primary text-bg-primary rounded-md hover:bg-accent-primary-hover transition-all disabled:opacity-50"
					disabled={currentNodes.length === 0}
				>
					Run
				</button>
			</div>
		</header>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div bind:this={canvasEl} class="canvas-area flex-1 relative overflow-hidden bg-bg-primary" class:panning={isPanning} class:cutting={isCutting} class:selecting={isSelecting} ondrop={handleDrop} ondragover={handleDragOver} onclick={handleCanvasClick} oncontextmenu={handleCanvasContextMenu} onmousedown={handleMouseDown} onmousemove={handleMouseMove} onmouseup={handleMouseUp} onmouseleave={handleMouseUp} role="application">
			<div class="absolute inset-0 opacity-20 pointer-events-none" style="background-image: radial-gradient(circle, #2a2a38 1px, transparent 1px); background-size: {24 * zoom}px {24 * zoom}px; background-position: {pan.x}px {pan.y}px;"></div>
			<div class="absolute pointer-events-none" style="transform: translate({pan.x}px, {pan.y}px);"><div class="pointer-events-none" style="transform: scale({zoom}); transform-origin: 0 0;">
				<svg class="absolute inset-0 pointer-events-none overflow-visible" style="z-index: 1;"><defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#00C49A" /></marker></defs>{#each currentConnections as connection}{@const sourceNode = currentNodes.find((node) => node.id === connection.sourceNodeId)}{@const targetNode = currentNodes.find((node) => node.id === connection.targetNodeId)}<ConnectionLine {connection} nodes={currentNodes} selected={currentSelectedConnectionId === connection.id} isActive={sourceNode?.status === 'running' || targetNode?.status === 'running'} isCompleted={sourceNode?.status === 'success' && targetNode?.status === 'success'} hasError={sourceNode?.status === 'error' || targetNode?.status === 'error'} />{/each}{#if currentDraggingConnection}<path d={getTempConnectionPath(currentDraggingConnection)} fill="none" stroke="#00C49A" stroke-width="2" stroke-dasharray="4 4" class="temp-connection" />{/if}{#if currentCuttingLine}<line x1={currentCuttingLine.startX} y1={currentCuttingLine.startY} x2={currentCuttingLine.currentX} y2={currentCuttingLine.currentY} stroke="#ef4444" stroke-width="2" stroke-dasharray="6 3" class="cutting-line" /><circle cx={currentCuttingLine.startX} cy={currentCuttingLine.startY} r="4" fill="#ef4444" /><circle cx={currentCuttingLine.currentX} cy={currentCuttingLine.currentY} r="4" fill="#ef4444" />{/if}{#if currentSelectionBox}{@const x = Math.min(currentSelectionBox.startX, currentSelectionBox.currentX)}{@const y = Math.min(currentSelectionBox.startY, currentSelectionBox.currentY)}{@const w = Math.abs(currentSelectionBox.currentX - currentSelectionBox.startX)}{@const h = Math.abs(currentSelectionBox.currentY - currentSelectionBox.startY)}<rect {x} {y} width={w} height={h} fill="rgba(0, 196, 154, 0.1)" stroke="#00C49A" stroke-width="1" stroke-dasharray="4 2" class="selection-box" />{/if}</svg>
				{#each currentNodes as node (node.id)}<DraggableNode {node} selected={currentSelectedNodeIds.includes(node.id)} {zoom} {pan} onOpenDetails={() => (showNodeDetails = true)} onContextMenu={(e) => handleNodeContextMenu(node.id, e)} onHandoffClick={handleHandoffClick} />{/each}
			</div></div>
			{#if currentNodes.length === 0}<div class="absolute inset-0 flex items-center justify-center pointer-events-none"><div class="text-center"><h3 class="text-lg font-medium text-text-primary mb-2">No skills on canvas</h3><p class="text-sm text-text-secondary">Drag skills from the sidebar</p></div></div>{/if}
			<!-- Search overlay -->
			{#if showSearch}
				<div class="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-80 bg-bg-secondary border border-surface-border rounded-lg shadow-lg overflow-hidden">
					<div class="flex items-center gap-2 p-2 border-b border-surface-border">
						<svg class="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
						<input
							bind:this={searchInputEl}
							bind:value={searchQuery}
							onkeydown={handleSearchKeydown}
							type="text"
							placeholder="Search nodes..."
							class="flex-1 bg-transparent border-none outline-none text-sm font-mono text-text-primary placeholder:text-text-tertiary"
						/>
						<button onclick={toggleSearch} class="text-text-tertiary hover:text-text-secondary" aria-label="Close search">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
						</button>
					</div>
					{#if searchQuery.trim()}
						<div class="max-h-48 overflow-y-auto">
							{#each matchingNodes() as node}
								<button
									onclick={() => { focusNode(node.id); toggleSearch(); }}
									class="w-full px-3 py-2 text-left hover:bg-surface-active flex items-center gap-2"
								>
									<span class="w-2 h-2 bg-accent-primary"></span>
									<span class="text-sm font-mono text-text-primary truncate">{node.skill.name}</span>
									<span class="text-xs text-text-tertiary ml-auto">{node.skill.category}</span>
								</button>
							{:else}
								<div class="px-3 py-2 text-sm text-text-tertiary">No matching nodes</div>
							{/each}
						</div>
					{:else}
						<div class="px-3 py-2 text-xs text-text-tertiary">Type to search by name, description, category, or tags</div>
					{/if}
				</div>
			{/if}
			<!-- Goal processing overlay -->
			{#if goalProcessing}
				<div class="absolute inset-0 z-40 flex items-center justify-center bg-bg-primary/80 backdrop-blur-sm pointer-events-none">
					<div class="bg-bg-secondary border border-surface-border rounded-lg p-6 max-w-sm text-center">
						<div class="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto mb-4"></div>
						<p class="text-text-primary font-mono text-sm">{goalProcessingMessage}</p>
						<p class="text-text-tertiary text-xs mt-2">Matching skills to your project...</p>
					</div>
				</div>
			{/if}
			<!-- Goal summary banner -->
			{#if goalSummary && !goalProcessing}
				<div class="absolute top-4 left-4 z-30 bg-bg-secondary border border-accent-primary/30 rounded-md px-3 py-2 max-w-xs">
					<p class="text-xs font-mono text-accent-primary mb-0.5">Project Goal</p>
					<p class="text-sm text-text-primary truncate">{goalSummary}</p>
					<button
						onclick={() => goalSummary = null}
						class="absolute top-1 right-1 text-text-tertiary hover:text-text-secondary p-1"
						aria-label="Dismiss goal summary"
					>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
					</button>
				</div>
			{/if}
			<!-- Goal error toast -->
			{#if goalProcessingError}
				<div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3 max-w-md">
					<div class="flex items-start gap-3">
						<svg class="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
						</svg>
						<div>
							<p class="text-sm text-red-400 font-mono">{goalProcessingError}</p>
							<p class="text-xs text-text-tertiary mt-1">Try adding more details about your project</p>
						</div>
						<button
							onclick={() => goalProcessingError = null}
							class="text-text-tertiary hover:text-text-secondary p-1 ml-auto"
							aria-label="Dismiss error"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
						</button>
					</div>
				</div>
			{/if}
			<!-- Minimap -->
			{#if showMinimap}
				<Minimap
					nodes={currentNodes}
					{zoom}
					{pan}
					viewportWidth={canvasWidth}
					viewportHeight={canvasHeight}
					onPanTo={handleMinimapPan}
				/>
			{/if}
		</div>
	</main>
</div>

<!-- Node Details Panel - absolute positioned overlay with slide animation -->
{#if showNodeDetails && currentSelectedNode}
	<div class="fixed top-0 right-0 h-screen z-50 shadow-xl slide-in">
		<NodeConfigPanel
			node={currentSelectedNode}
			onClose={() => (showNodeDetails = false)}
			onDelete={() => { removeNode(currentSelectedNode!.id); showNodeDetails = false; }}
		/>
	</div>
{/if}

{#if showExecution}
	<ExecutionPanel
		onClose={() => (showExecution = false)}
		minimized={executionMinimized}
		onToggleMinimize={() => (executionMinimized = !executionMinimized)}
		autoRunToken={executionAutoRunToken || undefined}
	/>
{/if}

{#if contextMenu}
	<ContextMenu x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={closeContextMenu} />
{/if}

{#if showMissionExport}
	<!-- Mission Export Modal -->
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0 bg-black/60" onclick={closeMissionExport} role="presentation"></div>

		<!-- Modal -->
		<div class="relative w-full max-w-md bg-bg-secondary border border-surface-border rounded-lg shadow-xl overflow-hidden">
			<div class="p-4 border-b border-surface-border flex items-center justify-between">
				<h2 class="text-lg font-medium text-text-primary">Export to Mission</h2>
				<button onclick={closeMissionExport} class="text-text-tertiary hover:text-text-secondary" aria-label="Close export dialog">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				</button>
			</div>

			<div class="p-4 space-y-4">
				{#if missionExportError}
					<div class="p-3 border border-red-500/30 bg-red-500/10 text-sm text-red-400 font-mono whitespace-pre-wrap">
						{missionExportError}
					</div>
				{/if}

				<div>
					<label for="mission-name" class="block text-sm font-mono text-text-tertiary mb-1.5">
						Mission Name *
					</label>
					<input
						id="mission-name"
						type="text"
						bind:value={missionName}
						placeholder="My Workflow"
						class="w-full px-3 py-2 bg-bg-primary border border-surface-border rounded-md text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
					/>
				</div>

				<div>
					<label for="mission-desc" class="block text-sm font-mono text-text-tertiary mb-1.5">
						Description
					</label>
					<textarea
						id="mission-desc"
						bind:value={missionDescription}
						placeholder="What does this workflow accomplish?"
						rows="3"
						class="w-full px-3 py-2 bg-bg-primary border border-surface-border rounded-md text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none"
					></textarea>
				</div>

				<div class="pt-2 text-xs font-mono text-text-tertiary">
					This will create a mission with {currentNodes.length} task{currentNodes.length !== 1 ? 's' : ''} and {currentConnections.length} connection{currentConnections.length !== 1 ? 's' : ''}.
				</div>
			</div>

			<div class="p-4 border-t border-surface-border flex items-center justify-end gap-2">
				<button
					onclick={closeMissionExport}
					class="px-4 py-2 text-sm font-mono text-text-secondary border border-surface-border rounded-md hover:border-text-tertiary hover:text-text-primary transition-all"
				>
					Cancel
				</button>
				<button
					onclick={handleMissionExport}
					disabled={missionExporting || !missionName.trim()}
					class="px-4 py-2 text-sm font-mono bg-accent-primary text-bg-primary rounded-md hover:bg-accent-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{missionExporting ? 'Creating...' : 'Create Mission'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showClearConfirm}
	<!-- Clear Canvas Confirmation Modal -->
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0 bg-black/60" onclick={cancelClear} role="presentation"></div>

		<!-- Modal -->
		<div class="relative w-full max-w-sm bg-bg-secondary border border-red-500/30 rounded-lg shadow-xl overflow-hidden">
			<div class="p-4 border-b border-surface-border flex items-center gap-3">
				<div class="w-10 h-10 flex items-center justify-center bg-red-500/10 border border-red-500/30 rounded-md">
					<svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
					</svg>
				</div>
				<div>
					<h2 class="text-lg font-medium text-text-primary">Clear Canvas</h2>
					<p class="text-xs text-text-tertiary font-mono">This action cannot be undone</p>
				</div>
			</div>

			<div class="p-4">
				<p class="text-sm text-text-secondary">
					You are about to delete <span class="text-red-400 font-mono">{currentNodes.length} node{currentNodes.length !== 1 ? 's' : ''}</span> and <span class="text-red-400 font-mono">{currentConnections.length} connection{currentConnections.length !== 1 ? 's' : ''}</span> from the canvas.
				</p>
				<p class="text-sm text-text-tertiary mt-2">
					This will permanently remove all your work. Consider exporting first.
				</p>
			</div>

			<div class="p-4 border-t border-surface-border flex items-center justify-end gap-2">
				<button
					onclick={cancelClear}
					class="px-4 py-2 text-sm font-mono text-text-secondary border border-surface-border rounded-md hover:border-text-tertiary hover:text-text-primary transition-all"
				>
					Cancel
				</button>
				<button
					onclick={confirmClear}
					class="px-4 py-2 text-sm font-mono bg-red-500 text-white rounded-md hover:bg-red-600 transition-all"
				>
					Clear All
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.canvas-area { cursor: grab; }
	.canvas-area.panning { cursor: grabbing; }
	.canvas-area.cutting { cursor: crosshair; }
	.canvas-area.selecting { cursor: crosshair; }
	.selection-box { pointer-events: none; }
	.temp-connection {
		opacity: 0.7;
		animation: dash 0.5s linear infinite;
	}
	.cutting-line {
		filter: drop-shadow(0 0 4px #ef4444);
		animation: cut-dash 0.3s linear infinite;
	}
	@keyframes dash {
		to { stroke-dashoffset: -8; }
	}
	@keyframes cut-dash {
		to { stroke-dashoffset: -9; }
	}
	
	.slide-in {
		animation: slideInFromRight 0.2s ease-out;
	}
	
	@keyframes slideInFromRight {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}

	/* Toolbar button styles */
	:global(.toolbar-btn) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		transition: all 0.15s;
	}
	:global(.toolbar-btn:hover) {
		color: var(--text-primary);
		background: var(--surface-active);
	}
	:global(.toolbar-btn:disabled) {
		opacity: 0.4;
		cursor: not-allowed;
	}
	:global(.toolbar-btn:disabled:hover) {
		background: transparent;
		color: var(--text-secondary);
	}

	/* Smaller toolbar buttons for row 2 */
	:global(.toolbar-btn-sm) {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		height: 24px;
		font-size: 11px;
		font-family: var(--font-mono);
		color: var(--text-tertiary);
		background: transparent;
		border: none;
		border-radius: 5px;
		cursor: pointer;
		transition: all 0.15s;
	}
	:global(.toolbar-btn-sm:hover) {
		color: var(--text-secondary);
		background: var(--surface-active);
	}
	:global(.toolbar-btn-sm.active) {
		color: var(--accent);
		background: var(--accent-subtle);
	}
	:global(.toolbar-btn-sm.active:hover) {
		background: var(--accent-mid);
	}
</style>
