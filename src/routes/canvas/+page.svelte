<script lang="ts">
	import DraggableNode from '$lib/components/nodes/DraggableNode.svelte';
	import SkillsPanel from '$lib/components/SkillsPanel.svelte';
	import BuilderPanel from '$lib/components/BuilderPanel.svelte';
	import ConnectionLine from '$lib/components/ConnectionLine.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import MindPanel from '$lib/components/MindPanel.svelte';
	import ValidationPanel from '$lib/components/ValidationPanel.svelte';
	import ExecutionPanel from '$lib/components/ExecutionPanel.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import Minimap from '$lib/components/Minimap.svelte';
	import NodeConfigPanel from '$lib/components/NodeConfigPanel.svelte';
	import { canvasState, nodes, connections, selectedNodeId, selectedNodeIds, selectedConnectionId, selectedNode, draggingConnection, cuttingLine, selectionBox, snapToGrid, gridSize, addNode, selectNode, selectConnection, selectAllNodes, clearSelection, deleteSelected, duplicateSelected, copySelected, pasteFromClipboard, removeConnection, removeNode, setZoom, setPan, zoomToFit, frameSelected, clearCanvas, loadCanvas, enableAutoSave, deleteSavedCanvas, getSavedCanvasInfo, undo, redo, canUndo, canRedo, clearHistory, startConnectionCut, updateConnectionCut, endConnectionCut, cancelConnectionCut, startSelectionBox, updateSelectionBox, endSelectionBox, cancelSelectionBox, toggleSnapToGrid, snapPosition, autoLayout, exportCanvasToFile, importCanvasFromFile, endConnectionDrag, resetTransientState } from '$lib/stores/canvas.svelte';
import { get } from 'svelte/store';
	import type { CuttingLine, CanvasNode, Connection, DraggingConnection, SelectionBox } from '$lib/stores/canvas.svelte';
	import { onMount, tick } from 'svelte';
	import { goto, beforeNavigate, afterNavigate } from '$app/navigation';
	import type { Skill } from '$lib/stores/skills.svelte';
	import { validateForMission, buildMissionFromCanvas } from '$lib/services/mission-builder';
	import { mcpState } from '$lib/stores/mcp.svelte';
	import { getGoalState, hasPendingGoal, clearGoal } from '$lib/stores/project-goal.svelte';
	import { processGoalAndAddToCanvas, isProcessing } from '$lib/services/goal-to-workflow';

	let activeTab = $state('skills');
	let chatExpanded = $state(false);
	let bottomTab = $state<'chat' | 'mind'>('chat');
	let showValidation = $state(false);
	let showExecution = $state(false);
	let showNodeDetails = $state(false);
	let showMissionExport = $state(false);
	let missionName = $state('');
	let missionDescription = $state('');
	let missionExporting = $state(false);
	let missionExportError = $state<string | null>(null);
	let mcpConnected = $state(false);
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

	// Fix 8: Render key to force node re-creation after goal processing
	// This ensures all node components are freshly created with current state
	let nodeRenderKey = $state(0);

	// Fix 6: Force sync local state from stores
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

		// Fix 3: Check if there's a pending goal, but defer processing until after mount
		if (hasPendingGoal()) {
			pendingGoalProcess = true;
		}
	});

	// Fix 1, 2, 3: Process goal only after component is fully mounted and initialized
	async function processGoalIfPending() {
		if (!pendingGoalProcess || !isMounted) return;

		// Fix 4: Wait for DOM to be ready and bindings to complete
		await tick();

		// Ensure canvasEl is bound before proceeding
		if (!canvasEl) {
			// If still not bound, wait a frame and try again
			requestAnimationFrame(() => processGoalIfPending());
			return;
		}

		pendingGoalProcess = false;
		const goalState = getGoalState();

		if (!goalState.input) {
			clearGoal();
			return;
		}

		goalProcessing = true;
		goalProcessingMessage = 'Analyzing your project...';
		goalProcessingError = null;

		try {
			const result = await processGoalAndAddToCanvas(goalState.input);

			// Fix 2: Wait for DOM to update after nodes are added
			await tick();

			if (result.success && result.workflow) {
				goalSummary = result.workflow.goalContext.summary;
				goalProcessingMessage = `Added ${result.workflow.nodes.length} skills`;

				// Fix 5: Wait another tick to ensure zoom/pan state is synchronized
				await tick();

				// Zoom to fit the new nodes
				if (canvasEl) {
					const rect = canvasEl.getBoundingClientRect();
					// Use requestAnimationFrame to ensure layout is complete
					requestAnimationFrame(() => {
						zoomToFit(rect.width, rect.height);
					});
				}
			} else if (result.needsClarification) {
				goalProcessingError = result.clarificationPrompt || 'Please provide more details';
			} else {
				goalProcessingError = result.error || 'Failed to process goal';
			}
		} catch (error) {
			goalProcessingError = error instanceof Error ? error.message : 'An error occurred';
		} finally {
			goalProcessing = false;
			// Reset all interaction states to ensure clean state after async processing
			isPanning = false;
			isCutting = false;
			isSelecting = false;

			// Fix 2: Wait for final state reset to propagate
			await tick();
			resetTransientState();

			// Fix 6: Force sync local state from stores
			forceStoreSync();
			await tick();

			// Fix 8: Increment render key to force all nodes to be re-created
			// This ensures fresh event handlers and proper zoom/pan values
			nodeRenderKey++;
			await tick();

			// Clear the goal input after processing
			clearGoal();
		}
	}

	// Watch for when both mount is complete and there's a pending goal
	$effect(() => {
		if (isMounted && pendingGoalProcess) {
			processGoalIfPending();
		}
	});

	// Fix 11: Watch for node count changes and ensure interaction state is clean
	// This catches any edge cases where state becomes corrupted after goal processing
	let lastNodeCount = $state(0);
	$effect(() => {
		const nodeCount = currentNodes.length;
		if (nodeCount !== lastNodeCount && nodeCount > 0 && lastNodeCount === 0) {
			// Nodes were just added - schedule a state verification
			requestAnimationFrame(() => {
				// Double-check that interaction states are clean
				if (isPanning || isCutting || isSelecting) {
					isPanning = false;
					isCutting = false;
					isSelecting = false;
					resetTransientState();
				}
				// Force one more store sync to ensure everything is in sync
				forceStoreSync();
			});
		}
		lastNodeCount = nodeCount;
	});

	onMount(() => {
		// Reset all transient store state first (handles client-side navigation)
		resetTransientState();
		// Reset local states
		isPanning = false;
		isCutting = false;
		isSelecting = false;

		// Try to load saved canvas
		const loaded = loadCanvas();
		if (loaded) {
			const info = getSavedCanvasInfo();
			if (info) {
				lastSaved = info.savedAt;
			}
		}

		// Initialize history with current state
		clearHistory();

		// Enable auto-save
		const disableAutoSave = enableAutoSave(1000);

		// Global mouseup handler to reset stuck states (catches mouseup outside canvas)
		function handleGlobalMouseUp() {
			if (isPanning || isCutting || isSelecting) {
				handleMouseUp();
			}
		}
		window.addEventListener('mouseup', handleGlobalMouseUp);

		// Builder panel requests to frame newly added nodes
		function handleBuilderFrameSelected() {
			if (canvasEl) {
				const rect = canvasEl.getBoundingClientRect();
				frameSelected(rect.width, rect.height);
			}
		}
		window.addEventListener('builder:frame-selected', handleBuilderFrameSelected);

		// Track canvas dimensions for minimap
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				canvasWidth = entry.contentRect.width;
				canvasHeight = entry.contentRect.height;
			}
		});

		// Use requestAnimationFrame to ensure canvasEl is bound after render
		requestAnimationFrame(() => {
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

		return () => {
			// Fix 3: Mark as unmounted before cleanup
			isMounted = false;
			pendingGoalProcess = false;
			disableAutoSave();
			resizeObserver.disconnect();
			window.removeEventListener('mouseup', handleGlobalMouseUp);
			window.removeEventListener('builder:frame-selected', handleBuilderFrameSelected);
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

	// Subscribe to MCP state
	$effect(() => {
		const unsub = mcpState.subscribe((s) => (mcpConnected = s.status === 'connected'));
		return unsub;
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

	// Export/Import
	let fileInputEl: HTMLInputElement;

	function handleExport() {
		const timestamp = new Date().toISOString().slice(0, 10);
		exportCanvasToFile(`canvas-${timestamp}.json`);
	}

	async function handleImport(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const success = await importCanvasFromFile(file);
		if (success) {
			lastSaved = null;
		} else {
			alert('Failed to import canvas. Please check the file format.');
		}
		// Reset input so the same file can be imported again
		input.value = '';
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

	function handleDrop(e) {
		e.preventDefault();
		if (!e.dataTransfer) return;
		const skillJson = e.dataTransfer.getData('application/json');
		if (!skillJson) return;
		try {
			const skill = JSON.parse(skillJson);
			const rect = canvasEl.getBoundingClientRect();
			const rawX = (e.clientX - rect.left - pan.x) / zoom;
			const rawY = (e.clientY - rect.top - pan.y) / zoom;
			const snapped = snapPosition(rawX, rawY);
			addNode(skill, snapped);
		} catch (err) { console.error(err); }
	}

	function handleDragOver(e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }
	function handleCanvasClick(e) { if (e.target === e.currentTarget) { clearSelection(); showLayoutMenu = false; } }
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

		// If not clicking on canvas background, let the event bubble naturally
		// This is a safety measure in case stopPropagation fails
		if (!isCanvasBackground && target.closest('.draggable-node')) {
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

<div class="h-screen flex bg-bg-primary">
	<aside class="w-64 border-r border-surface-border bg-bg-secondary flex flex-col">
		<div class="p-4 border-b border-surface-border"><a href="/" class="flex items-center gap-1.5"><img src="/logo.png" alt="vibeship" class="w-6 h-6" /><span class="font-serif text-[1.36rem] text-text-primary">vibeship</span><span class="font-serif text-[1.36rem] text-accent-primary">spawner</span></a></div>
		<div class="p-3 border-b border-surface-border"><div class="flex p-0.5 border border-surface-border"><button class="flex-1 py-1.5 px-3 text-sm font-mono transition-all" class:bg-accent-primary={activeTab === 'skills'} class:text-bg-primary={activeTab === 'skills'} class:text-text-secondary={activeTab !== 'skills'} onclick={() => (activeTab = 'skills')}>Skills</button><button class="flex-1 py-1.5 px-3 text-sm font-mono transition-all" class:bg-accent-secondary={activeTab === 'builder'} class:text-bg-primary={activeTab === 'builder'} class:text-text-secondary={activeTab !== 'builder'} onclick={() => (activeTab = 'builder')}>Builder</button></div></div>
		<div class="flex-1 overflow-hidden">{#if activeTab === 'skills'}<SkillsPanel />{:else}<BuilderPanel />{/if}</div>
		<div class="p-4 border-t border-surface-border"><div class="text-xs text-text-tertiary">Project • {currentNodes.length} nodes</div></div>
	</aside>
	<main class="flex-1 flex flex-col">
		<!-- Two-row toolbar -->
		<header class="border-b border-surface-border bg-bg-secondary">
			<!-- Row 1: Primary actions -->
			<div class="h-10 flex items-center px-3 gap-3 border-b border-surface-border/50">
				<!-- File operations (non-destructive) -->
				<div class="flex items-center gap-1">
					<button class="toolbar-btn" onclick={handleExport} title="Export canvas">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
						</svg>
					</button>
					<button class="toolbar-btn" onclick={() => fileInputEl?.click()} title="Import canvas">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
						</svg>
					</button>
					<input bind:this={fileInputEl} type="file" accept=".json" class="hidden" onchange={handleImport} />
				</div>

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
					<button class="toolbar-btn min-w-[3.5rem] font-mono text-xs" onclick={handleZoomReset} title="Reset zoom">
						{Math.round(zoom * 100)}%
					</button>
					<button class="toolbar-btn" onclick={handleZoomIn} title="Zoom in">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
						</svg>
					</button>
					<button class="toolbar-btn" onclick={handleZoomToFit} title="Fit all nodes">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
						</svg>
					</button>
				</div>

				<div class="flex-1"></div>

				<!-- Status -->
				<div class="flex items-center gap-2 text-xs font-mono text-text-tertiary">
					<span>{currentNodes.length} nodes</span>
					{#if lastSaved}<span class="text-accent-primary">saved</span>{/if}
				</div>

				<div class="w-px h-5 bg-surface-border"></div>

				<!-- Primary actions -->
				<div class="flex items-center gap-2">
					<button onclick={() => (showValidation = true)} class="px-2.5 py-1 text-xs font-mono text-text-secondary border border-surface-border hover:border-text-tertiary hover:text-text-primary transition-all">
						Validate
					</button>
					<button
						onclick={openMissionExport}
						class="px-2.5 py-1 text-xs font-mono text-text-secondary border border-surface-border hover:border-text-tertiary hover:text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={currentNodes.length === 0 || !mcpConnected}
						title={!mcpConnected ? 'Connect to MCP to export missions' : 'Export workflow as mission'}
					>
						Export
					</button>
					<button onclick={() => (showExecution = true)} class="px-2.5 py-1 text-xs font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all disabled:opacity-50" disabled={currentNodes.length === 0}>
						Run
					</button>
				</div>
			</div>

			<!-- Row 2: View options -->
			<div class="h-8 flex items-center px-3 gap-3">
				<!-- Grid snap -->
				<button
					class="toolbar-btn-sm"
					class:active={currentSnapToGrid}
					onclick={() => toggleSnapToGrid()}
					title="Snap to grid"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
					</svg>
					<span>Grid</span>
				</button>

				<div class="w-px h-4 bg-surface-border"></div>

				<!-- Search -->
				<button
					class="toolbar-btn-sm"
					class:active={showSearch}
					onclick={toggleSearch}
					title="Search nodes (Ctrl+F)"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
					</svg>
					<span>Search</span>
				</button>

				<!-- Minimap -->
				<button
					class="toolbar-btn-sm"
					class:active={showMinimap}
					onclick={() => (showMinimap = !showMinimap)}
					title="Toggle minimap"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
					</svg>
					<span>Minimap</span>
				</button>

				<div class="w-px h-4 bg-surface-border"></div>

				<!-- Auto-layout dropdown -->
				<div class="relative">
					<button
						class="toolbar-btn-sm"
						class:active={showLayoutMenu}
						onclick={() => (showLayoutMenu = !showLayoutMenu)}
						title="Auto-layout nodes"
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
						</svg>
						<span>Layout</span>
						<svg class="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
						</svg>
					</button>
					{#if showLayoutMenu}
						<div class="absolute top-full left-0 mt-1 bg-bg-secondary border border-surface-border shadow-lg z-50 min-w-28">
							<button class="w-full px-3 py-1.5 text-left text-xs font-mono hover:bg-surface-active text-text-secondary hover:text-text-primary" onclick={() => handleAutoLayout('category')}>By Category</button>
							<button class="w-full px-3 py-1.5 text-left text-xs font-mono hover:bg-surface-active text-text-secondary hover:text-text-primary" onclick={() => handleAutoLayout('grid')}>Grid</button>
							<button class="w-full px-3 py-1.5 text-left text-xs font-mono hover:bg-surface-active text-text-secondary hover:text-text-primary" onclick={() => handleAutoLayout('horizontal')}>Horizontal</button>
							<button class="w-full px-3 py-1.5 text-left text-xs font-mono hover:bg-surface-active text-text-secondary hover:text-text-primary" onclick={() => handleAutoLayout('vertical')}>Vertical</button>
						</div>
					{/if}
				</div>

				<div class="flex-1"></div>

				<!-- Danger zone (hidden in menu) -->
				<button
					class="toolbar-btn-sm text-red-400 hover:text-red-300 hover:bg-red-500/10"
					onclick={handleClear}
					disabled={currentNodes.length === 0}
					title="Clear entire canvas"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
					</svg>
					<span>Clear All</span>
				</button>
			</div>
		</header>
		<div bind:this={canvasEl} class="canvas-area flex-1 relative overflow-hidden bg-bg-primary" class:panning={isPanning} class:cutting={isCutting} class:selecting={isSelecting} ondrop={handleDrop} ondragover={handleDragOver} onclick={handleCanvasClick} oncontextmenu={handleCanvasContextMenu} onmousedown={handleMouseDown} onmousemove={handleMouseMove} onmouseup={handleMouseUp} onmouseleave={handleMouseUp} role="application" tabindex="0">
			<div class="absolute inset-0 opacity-20 pointer-events-none" style="background-image: radial-gradient(circle, #2a2a38 1px, transparent 1px); background-size: {24 * zoom}px {24 * zoom}px; background-position: {pan.x}px {pan.y}px;"></div>
			<div class="absolute pointer-events-none" style="transform: translate({pan.x}px, {pan.y}px);"><div class="pointer-events-none" style="transform: scale({zoom}); transform-origin: 0 0;">
				<svg class="absolute inset-0 pointer-events-none overflow-visible" style="z-index: 1;"><defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#00C49A" /></marker></defs>{#each currentConnections as connection}<ConnectionLine {connection} nodes={currentNodes} selected={currentSelectedConnectionId === connection.id} />{/each}{#if currentDraggingConnection}<path d={getTempConnectionPath(currentDraggingConnection)} fill="none" stroke="#00C49A" stroke-width="2" stroke-dasharray="4 4" class="temp-connection" />{/if}{#if currentCuttingLine}<line x1={currentCuttingLine.startX} y1={currentCuttingLine.startY} x2={currentCuttingLine.currentX} y2={currentCuttingLine.currentY} stroke="#ef4444" stroke-width="2" stroke-dasharray="6 3" class="cutting-line" /><circle cx={currentCuttingLine.startX} cy={currentCuttingLine.startY} r="4" fill="#ef4444" /><circle cx={currentCuttingLine.currentX} cy={currentCuttingLine.currentY} r="4" fill="#ef4444" />{/if}{#if currentSelectionBox}{@const x = Math.min(currentSelectionBox.startX, currentSelectionBox.currentX)}{@const y = Math.min(currentSelectionBox.startY, currentSelectionBox.currentY)}{@const w = Math.abs(currentSelectionBox.currentX - currentSelectionBox.startX)}{@const h = Math.abs(currentSelectionBox.currentY - currentSelectionBox.startY)}<rect {x} {y} width={w} height={h} fill="rgba(0, 196, 154, 0.1)" stroke="#00C49A" stroke-width="1" stroke-dasharray="4 2" class="selection-box" />{/if}</svg>
				{#each currentNodes as node (`${nodeRenderKey}-${node.id}`)}<DraggableNode {node} selected={currentSelectedNodeIds.includes(node.id)} {zoom} {pan} onOpenDetails={() => (showNodeDetails = true)} onContextMenu={(e) => handleNodeContextMenu(node.id, e)} />{/each}
			</div></div>
			{#if currentNodes.length === 0}<div class="absolute inset-0 flex items-center justify-center pointer-events-none"><div class="text-center"><h3 class="text-lg font-medium text-text-primary mb-2">No skills on canvas</h3><p class="text-sm text-text-secondary">Drag skills from the sidebar</p></div></div>{/if}
			<!-- Search overlay -->
			{#if showSearch}
				<div class="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-80 bg-bg-secondary border border-surface-border shadow-lg">
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
						<button onclick={toggleSearch} class="text-text-tertiary hover:text-text-secondary">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
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
					<div class="bg-bg-secondary border border-surface-border p-6 max-w-sm text-center">
						<div class="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full mx-auto mb-4"></div>
						<p class="text-text-primary font-mono text-sm">{goalProcessingMessage}</p>
						<p class="text-text-tertiary text-xs mt-2">Matching skills to your project...</p>
					</div>
				</div>
			{/if}
			<!-- Goal summary banner -->
			{#if goalSummary && !goalProcessing}
				<div class="absolute top-4 left-4 z-30 bg-bg-secondary border border-accent-primary/30 px-3 py-2 max-w-xs">
					<p class="text-xs font-mono text-accent-primary mb-0.5">Project Goal</p>
					<p class="text-sm text-text-primary truncate">{goalSummary}</p>
					<button
						onclick={() => goalSummary = null}
						class="absolute top-1 right-1 text-text-tertiary hover:text-text-secondary p-1"
					>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
					</button>
				</div>
			{/if}
			<!-- Goal error toast -->
			{#if goalProcessingError}
				<div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/10 border border-red-500/30 px-4 py-3 max-w-md">
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
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
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
		<!-- Bottom Panel (Chat/Mind, expandable) -->
		<div class="border-t border-surface-border bg-bg-secondary transition-all relative" class:h-72={chatExpanded} class:h-12={!chatExpanded}>
			{#if chatExpanded}
				<!-- Tab buttons and minimize -->
				<div class="absolute top-0 left-0 right-0 h-8 flex items-center justify-between px-3 border-b border-surface-border/50 bg-bg-secondary z-10">
					<div class="flex items-center gap-1">
						<button
							onclick={() => (bottomTab = 'chat')}
							class="px-3 py-1 text-xs font-mono transition-all"
							class:bg-accent-primary={bottomTab === 'chat'}
							class:text-bg-primary={bottomTab === 'chat'}
							class:text-text-secondary={bottomTab !== 'chat'}
							class:hover:text-text-primary={bottomTab !== 'chat'}
						>
							Chat
						</button>
						<button
							onclick={() => (bottomTab = 'mind')}
							class="px-3 py-1 text-xs font-mono transition-all"
							class:bg-accent-secondary={bottomTab === 'mind'}
							class:text-bg-primary={bottomTab === 'mind'}
							class:text-text-secondary={bottomTab !== 'mind'}
							class:hover:text-text-primary={bottomTab !== 'mind'}
						>
							Mind
						</button>
					</div>
					<button
						onclick={() => (chatExpanded = false)}
						class="text-text-tertiary hover:text-text-secondary text-xs font-mono"
					>
						[minimize]
					</button>
				</div>
				<div class="h-full pt-8">
					{#if bottomTab === 'chat'}
						<ChatPanel />
					{:else}
						<MindPanel />
					{/if}
				</div>
			{:else}
				<button
					onclick={() => (chatExpanded = true)}
					class="w-full h-full flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary hover:bg-surface transition-all"
				>
					<span class="font-mono text-sm">Open {bottomTab === 'chat' ? 'Chat' : 'Mind'}</span>
					<span class="text-xs text-text-tertiary">
						{#if bottomTab === 'chat'}/help for commands{:else}decisions & sessions{/if}
					</span>
				</button>
			{/if}
		</div>
	</main>
	{#if showNodeDetails && currentSelectedNode}
		<NodeConfigPanel
			node={currentSelectedNode}
			onClose={() => (showNodeDetails = false)}
			onDelete={() => { removeNode(currentSelectedNode!.id); showNodeDetails = false; }}
		/>
	{/if}
</div>

{#if showValidation}
	<ValidationPanel onClose={() => (showValidation = false)} />
{/if}

{#if showExecution}
	<ExecutionPanel onClose={() => (showExecution = false)} />
{/if}

{#if contextMenu}
	<ContextMenu x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={closeContextMenu} />
{/if}

{#if showMissionExport}
	<!-- Mission Export Modal -->
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/60" onclick={closeMissionExport}></div>

		<!-- Modal -->
		<div class="relative w-full max-w-md bg-bg-secondary border border-surface-border shadow-xl">
			<div class="p-4 border-b border-surface-border flex items-center justify-between">
				<h2 class="text-lg font-medium text-text-primary">Export to Mission</h2>
				<button onclick={closeMissionExport} class="text-text-tertiary hover:text-text-secondary">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
						class="w-full px-3 py-2 bg-bg-primary border border-surface-border text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
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
						class="w-full px-3 py-2 bg-bg-primary border border-surface-border text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none"
					></textarea>
				</div>

				<div class="pt-2 text-xs font-mono text-text-tertiary">
					This will create a mission with {currentNodes.length} task{currentNodes.length !== 1 ? 's' : ''} and {currentConnections.length} connection{currentConnections.length !== 1 ? 's' : ''}.
				</div>
			</div>

			<div class="p-4 border-t border-surface-border flex items-center justify-end gap-2">
				<button
					onclick={closeMissionExport}
					class="px-4 py-2 text-sm font-mono text-text-secondary border border-surface-border hover:border-text-tertiary hover:text-text-primary transition-all"
				>
					Cancel
				</button>
				<button
					onclick={handleMissionExport}
					disabled={missionExporting || !missionName.trim()}
					class="px-4 py-2 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/60" onclick={cancelClear}></div>

		<!-- Modal -->
		<div class="relative w-full max-w-sm bg-bg-secondary border border-red-500/30 shadow-xl">
			<div class="p-4 border-b border-surface-border flex items-center gap-3">
				<div class="w-10 h-10 flex items-center justify-center bg-red-500/10 border border-red-500/30">
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
					class="px-4 py-2 text-sm font-mono text-text-secondary border border-surface-border hover:border-text-tertiary hover:text-text-primary transition-all"
				>
					Cancel
				</button>
				<button
					onclick={confirmClear}
					class="px-4 py-2 text-sm font-mono bg-red-500 text-white hover:bg-red-600 transition-all"
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
		cursor: pointer;
		transition: all 0.15s;
	}
	:global(.toolbar-btn-sm:hover) {
		color: var(--text-secondary);
		background: var(--surface-active);
	}
	:global(.toolbar-btn-sm.active) {
		color: var(--accent-primary);
		background: rgba(0, 196, 154, 0.1);
	}
	:global(.toolbar-btn-sm.active:hover) {
		background: rgba(0, 196, 154, 0.15);
	}
</style>
