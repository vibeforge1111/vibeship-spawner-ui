<script lang="ts">
	import DraggableNode from '$lib/components/nodes/DraggableNode.svelte';
	import SkillsPanel from '$lib/components/SkillsPanel.svelte';
	import ConnectionLine from '$lib/components/ConnectionLine.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import ValidationPanel from '$lib/components/ValidationPanel.svelte';
	import ExecutionPanel from '$lib/components/ExecutionPanel.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import Minimap from '$lib/components/Minimap.svelte';
	import { canvasState, nodes, connections, selectedNodeId, selectedNodeIds, selectedConnectionId, selectedNode, draggingConnection, cuttingLine, selectionBox, snapToGrid, gridSize, addNode, selectNode, selectConnection, selectAllNodes, clearSelection, deleteSelected, duplicateSelected, copySelected, pasteFromClipboard, removeConnection, removeNode, setZoom, zoomToFit, frameSelected, clearCanvas, loadCanvas, enableAutoSave, deleteSavedCanvas, getSavedCanvasInfo, undo, redo, canUndo, canRedo, clearHistory, startConnectionCut, updateConnectionCut, endConnectionCut, cancelConnectionCut, startSelectionBox, updateSelectionBox, endSelectionBox, cancelSelectionBox, toggleSnapToGrid, snapPosition, autoLayout, exportCanvasToFile, importCanvasFromFile } from '$lib/stores/canvas.svelte';
	import type { CuttingLine, CanvasNode, Connection, DraggingConnection, SelectionBox } from '$lib/stores/canvas.svelte';
	import { onMount } from 'svelte';
	import type { Skill } from '$lib/stores/skills.svelte';

	let activeTab = $state('skills');
	let chatExpanded = $state(false);
	let showValidation = $state(false);
	let showExecution = $state(false);
	let showNodeDetails = $state(false);
	let canvasEl: HTMLDivElement;
	let lastSaved = $state<Date | null>(null);

	// Context menu state
	let contextMenu = $state<{ x: number; y: number; type: 'node' | 'connection' | 'canvas'; targetId?: string } | null>(null);

	onMount(() => {
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

		// Track canvas dimensions for minimap
		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				canvasWidth = entry.contentRect.width;
				canvasHeight = entry.contentRect.height;
			}
		});
		if (canvasEl) {
			resizeObserver.observe(canvasEl);
		}

		return () => {
			disableAutoSave();
			resizeObserver.disconnect();
		};
	});

	function handleMinimapPan(x: number, y: number) {
		canvasState.update(s => ({ ...s, pan: { x, y } }));
	}

	function handleClear() {
		if (currentNodes.length > 0 && !confirm('Clear canvas? This will delete all nodes.')) {
			return;
		}
		clearCanvas();
		deleteSavedCanvas();
		lastSaved = null;
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

		canvasState.update(s => ({ ...s, pan: { x: panX, y: panY } }));
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
		// Middle-click or Alt+left-click for panning
		if (e.button === 1 || (e.button === 0 && e.altKey)) {
			isPanning = true;
			panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
			e.preventDefault();
			return;
		}
		// Left-click on empty canvas to start selection box
		if (e.button === 0 && e.target === e.currentTarget) {
			e.preventDefault();
			isSelecting = true;
			const rect = canvasEl.getBoundingClientRect();
			const x = (e.clientX - rect.left - pan.x) / zoom;
			const y = (e.clientY - rect.top - pan.y) / zoom;
			startSelectionBox(x, y);
		}
	}
	function handleMouseMove(e: MouseEvent) {
		if (isPanning) {
			pan = { x: e.clientX - panStart.x, y: e.clientY - panStart.y };
		}
		if (isCutting && canvasEl) {
			const rect = canvasEl.getBoundingClientRect();
			const x = (e.clientX - rect.left - pan.x) / zoom;
			const y = (e.clientY - rect.top - pan.y) / zoom;
			updateConnectionCut(x, y);
		}
		if (isSelecting && canvasEl) {
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
		<div class="p-3 border-b border-surface-border"><div class="flex p-0.5 border border-surface-border"><button class="flex-1 py-1.5 px-3 text-sm font-mono transition-all" class:bg-accent-primary={activeTab === 'skills'} class:text-bg-primary={activeTab === 'skills'} class:text-text-secondary={activeTab !== 'skills'} onclick={() => (activeTab = 'skills')}>Skills</button><button class="flex-1 py-1.5 px-3 text-sm font-mono transition-all" class:bg-accent-secondary={activeTab === 'mind'} class:text-bg-primary={activeTab === 'mind'} class:text-text-secondary={activeTab !== 'mind'} onclick={() => (activeTab = 'mind')}>Mind</button></div></div>
		<div class="flex-1 overflow-hidden">{#if activeTab === 'skills'}<SkillsPanel />{:else}<div class="p-4"><span class="font-mono text-accent-primary text-sm">recall()</span><div class="p-3 bg-surface border border-surface-border mt-3"><p class="text-xs text-text-secondary">No memories yet.</p></div></div>{/if}</div>
		<div class="p-4 border-t border-surface-border"><div class="text-xs text-text-tertiary">Project • {currentNodes.length} nodes</div></div>
	</aside>
	<main class="flex-1 flex flex-col">
		<header class="h-12 border-b border-surface-border bg-bg-secondary flex items-center px-4 gap-4"><div class="flex items-center gap-2"><button class="btn-ghost btn-sm" onclick={handleClear}>Clear</button><button class="btn-ghost btn-sm" onclick={handleExport} title="Export canvas"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg></button><button class="btn-ghost btn-sm" onclick={() => fileInputEl?.click()} title="Import canvas"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button><input bind:this={fileInputEl} type="file" accept=".json" class="hidden" onchange={handleImport} /><span class="text-sm text-text-secondary">{currentNodes.length} nodes</span>{#if lastSaved}<span class="text-xs text-text-tertiary">• saved</span>{/if}</div><div class="flex items-center gap-1 px-2 border-l border-surface-border"><button class="btn-ghost btn-sm" onclick={() => undo()} disabled={!currentCanUndo} title="Undo (Ctrl+Z)" class:opacity-40={!currentCanUndo}><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg></button><button class="btn-ghost btn-sm" onclick={() => redo()} disabled={!currentCanRedo} title="Redo (Ctrl+Shift+Z)" class:opacity-40={!currentCanRedo}><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"/></svg></button></div><div class="flex items-center gap-1 px-2 border-l border-surface-border"><button class="btn-ghost btn-sm" onclick={handleZoomOut}>-</button><button class="btn-ghost btn-sm min-w-[4rem] font-mono text-xs" onclick={handleZoomReset}>{Math.round(zoom * 100)}%</button><button class="btn-ghost btn-sm" onclick={handleZoomIn}>+</button><button class="btn-ghost btn-sm ml-1" onclick={handleZoomToFit} title="Fit all (zoom to show all nodes)"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg></button></div><div class="flex items-center gap-1 px-2 border-l border-surface-border"><button class="btn-ghost btn-sm font-mono text-xs" class:text-accent-primary={currentSnapToGrid} onclick={() => toggleSnapToGrid()} title="Toggle snap to grid"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg></button></div><div class="flex items-center gap-1 px-2 border-l border-surface-border"><button class="btn-ghost btn-sm" class:text-accent-primary={showSearch} onclick={toggleSearch} title="Search nodes (Ctrl+F)"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></button><button class="btn-ghost btn-sm" class:text-accent-primary={showMinimap} onclick={() => (showMinimap = !showMinimap)} title="Toggle minimap"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg></button><div class="relative"><button class="btn-ghost btn-sm" class:text-accent-primary={showLayoutMenu} onclick={() => (showLayoutMenu = !showLayoutMenu)} title="Auto-layout nodes"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 8v8M8 12h8"/></svg></button>{#if showLayoutMenu}<div class="absolute top-full left-0 mt-1 bg-bg-secondary border border-surface-border shadow-lg z-50 min-w-32"><button class="w-full px-3 py-1.5 text-left text-sm font-mono hover:bg-surface-active" onclick={() => handleAutoLayout('category')}>By Category</button><button class="w-full px-3 py-1.5 text-left text-sm font-mono hover:bg-surface-active" onclick={() => handleAutoLayout('grid')}>Grid</button><button class="w-full px-3 py-1.5 text-left text-sm font-mono hover:bg-surface-active" onclick={() => handleAutoLayout('horizontal')}>Horizontal</button><button class="w-full px-3 py-1.5 text-left text-sm font-mono hover:bg-surface-active" onclick={() => handleAutoLayout('vertical')}>Vertical</button></div>{/if}</div></div><div class="flex-1"></div><div class="flex items-center gap-2"><button onclick={() => (showValidation = true)} class="px-3 py-1.5 text-sm font-mono text-text-primary border border-surface-border hover:border-accent-primary hover:text-accent-primary transition-all">Validate</button><button onclick={() => (showExecution = true)} class="px-3 py-1.5 text-sm font-mono bg-accent-primary text-bg-primary border border-accent-primary hover:bg-accent-primary-hover transition-all disabled:opacity-70 disabled:cursor-not-allowed" disabled={currentNodes.length === 0}>Run</button></div></header>
		<div bind:this={canvasEl} class="canvas-area flex-1 relative overflow-hidden bg-bg-primary" class:panning={isPanning} class:cutting={isCutting} class:selecting={isSelecting} ondrop={handleDrop} ondragover={handleDragOver} onclick={handleCanvasClick} oncontextmenu={handleCanvasContextMenu} onmousedown={handleMouseDown} onmousemove={handleMouseMove} onmouseup={handleMouseUp} onmouseleave={handleMouseUp} role="application" tabindex="0">
			<div class="absolute inset-0 opacity-20 pointer-events-none" style="background-image: radial-gradient(circle, #2a2a38 1px, transparent 1px); background-size: {24 * zoom}px {24 * zoom}px;"></div>
			<div class="absolute inset-0" style="transform: translate({pan.x}px, {pan.y}px);">
				<svg class="absolute inset-0 pointer-events-none overflow-visible"><defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#00C49A" /></marker></defs>{#each currentConnections as connection}<ConnectionLine {connection} nodes={currentNodes} selected={currentSelectedConnectionId === connection.id} />{/each}{#if currentDraggingConnection}<path d={getTempConnectionPath(currentDraggingConnection)} fill="none" stroke="#00C49A" stroke-width="2" stroke-dasharray="4 4" class="temp-connection" />{/if}{#if currentCuttingLine}<line x1={currentCuttingLine.startX} y1={currentCuttingLine.startY} x2={currentCuttingLine.currentX} y2={currentCuttingLine.currentY} stroke="#ef4444" stroke-width="2" stroke-dasharray="6 3" class="cutting-line" /><circle cx={currentCuttingLine.startX} cy={currentCuttingLine.startY} r="4" fill="#ef4444" /><circle cx={currentCuttingLine.currentX} cy={currentCuttingLine.currentY} r="4" fill="#ef4444" />{/if}{#if currentSelectionBox}{@const x = Math.min(currentSelectionBox.startX, currentSelectionBox.currentX)}{@const y = Math.min(currentSelectionBox.startY, currentSelectionBox.currentY)}{@const w = Math.abs(currentSelectionBox.currentX - currentSelectionBox.startX)}{@const h = Math.abs(currentSelectionBox.currentY - currentSelectionBox.startY)}<rect {x} {y} width={w} height={h} fill="rgba(0, 196, 154, 0.1)" stroke="#00C49A" stroke-width="1" stroke-dasharray="4 2" class="selection-box" />{/if}</svg>
				{#each currentNodes as node (node.id)}<DraggableNode {node} selected={currentSelectedNodeIds.includes(node.id)} {zoom} onOpenDetails={() => (showNodeDetails = true)} onContextMenu={(e) => handleNodeContextMenu(node.id, e)} />{/each}
			</div>
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
		<!-- Chat Panel (expandable) -->
		<div class="border-t border-surface-border bg-bg-secondary transition-all relative" class:h-72={chatExpanded} class:h-12={!chatExpanded}>
			{#if chatExpanded}
				<button
					onclick={() => (chatExpanded = false)}
					class="absolute top-2 right-4 z-10 text-text-tertiary hover:text-text-secondary text-xs font-mono"
				>
					[minimize]
				</button>
				<div class="h-full">
					<ChatPanel />
				</div>
			{:else}
				<button
					onclick={() => (chatExpanded = true)}
					class="w-full h-full flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary hover:bg-surface transition-all"
				>
					<span class="font-mono text-sm">Open Chat</span>
					<span class="text-xs text-text-tertiary">/help for commands</span>
				</button>
			{/if}
		</div>
	</main>
	{#if showNodeDetails && currentSelectedNode}<aside class="w-80 border-l border-surface-border bg-bg-secondary flex flex-col"><div class="p-4 border-b border-surface-border flex items-center justify-between"><h2 class="font-medium text-text-primary">{currentSelectedNode.skill.name}</h2><button onclick={() => (showNodeDetails = false)} class="btn-ghost p-1">X</button></div><div class="flex-1 overflow-y-auto p-4"><div class="mb-6"><h3 class="text-xs font-semibold text-text-tertiary uppercase mb-2">Description</h3><p class="text-sm text-text-secondary">{currentSelectedNode.skill.description}</p></div></div><div class="p-4 border-t border-surface-border"><button class="w-full px-4 py-2 text-sm font-mono text-accent-primary border border-accent-primary hover:bg-accent-primary hover:text-bg-primary transition-all">Test Node</button></div></aside>{/if}
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
</style>
