<script lang="ts">
	import DraggableNode from '$lib/components/nodes/DraggableNode.svelte';
	import SkillsPanel from '$lib/components/SkillsPanel.svelte';
	import ConnectionLine from '$lib/components/ConnectionLine.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import ValidationPanel from '$lib/components/ValidationPanel.svelte';
	import ExecutionPanel from '$lib/components/ExecutionPanel.svelte';
	import { canvasState, nodes, connections, selectedNodeId, selectedNode, draggingConnection, addNode, selectNode, setZoom, clearCanvas, loadCanvas, enableAutoSave, deleteSavedCanvas, getSavedCanvasInfo, undo, redo, canUndo, canRedo, clearHistory } from '$lib/stores/canvas.svelte';
	import { onMount } from 'svelte';
	import type { Skill } from '$lib/stores/skills.svelte';
	import type { DraggingConnection } from '$lib/stores/canvas.svelte';

	let activeTab = $state('skills');
	let chatExpanded = $state(false);
	let showValidation = $state(false);
	let showExecution = $state(false);
	let canvasEl;
	let lastSaved = $state<Date | null>(null);

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

		return () => {
			disableAutoSave();
		};
	});

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

	let currentNodes = $state([]);
	let currentConnections = $state([]);
	let currentSelectedNodeId = $state(null);
	let currentSelectedNode = $state(null);
	let currentDraggingConnection = $state<DraggingConnection | null>(null);
	let currentCanUndo = $state(false);
	let currentCanRedo = $state(false);

	$effect(() => {
		const unsub1 = nodes.subscribe((n) => (currentNodes = n));
		const unsub2 = connections.subscribe((c) => (currentConnections = c));
		const unsub3 = selectedNodeId.subscribe((id) => (currentSelectedNodeId = id));
		const unsub4 = selectedNode.subscribe((node) => (currentSelectedNode = node));
		const unsub5 = draggingConnection.subscribe((dc) => (currentDraggingConnection = dc));
		const unsub6 = canUndo.subscribe((v) => (currentCanUndo = v));
		const unsub7 = canRedo.subscribe((v) => (currentCanRedo = v));
		return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); };
	});

	function handleKeydown(e: KeyboardEvent) {
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
			addNode(skill, { x: (e.clientX - rect.left - pan.x) / zoom, y: (e.clientY - rect.top - pan.y) / zoom });
		} catch (err) { console.error(err); }
	}

	function handleDragOver(e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }
	function handleCanvasClick(e) { if (e.target === e.currentTarget) selectNode(null); }
	function handleZoomIn() { setZoom(zoom + 0.1); }
	function handleZoomOut() { setZoom(zoom - 0.1); }
	function handleZoomReset() { setZoom(1); }
	function handleMouseDown(e) { if (e.button === 1 || (e.button === 0 && e.altKey)) { isPanning = true; panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y }; e.preventDefault(); } }
	function handleMouseMove(e) { if (isPanning) pan = { x: e.clientX - panStart.x, y: e.clientY - panStart.y }; }
	function handleMouseUp() { isPanning = false; }
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
		<header class="h-12 border-b border-surface-border bg-bg-secondary flex items-center px-4 gap-4"><div class="flex items-center gap-2"><button class="btn-ghost btn-sm" onclick={handleClear}>Clear</button><span class="text-sm text-text-secondary">{currentNodes.length} nodes</span>{#if lastSaved}<span class="text-xs text-text-tertiary">• saved</span>{/if}</div><div class="flex items-center gap-1 px-2 border-l border-surface-border"><button class="btn-ghost btn-sm" onclick={() => undo()} disabled={!currentCanUndo} title="Undo (Ctrl+Z)" class:opacity-40={!currentCanUndo}><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg></button><button class="btn-ghost btn-sm" onclick={() => redo()} disabled={!currentCanRedo} title="Redo (Ctrl+Shift+Z)" class:opacity-40={!currentCanRedo}><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"/></svg></button></div><div class="flex items-center gap-1 px-2 border-l border-surface-border"><button class="btn-ghost btn-sm" onclick={handleZoomOut}>-</button><button class="btn-ghost btn-sm min-w-[4rem] font-mono text-xs" onclick={handleZoomReset}>{Math.round(zoom * 100)}%</button><button class="btn-ghost btn-sm" onclick={handleZoomIn}>+</button></div><div class="flex-1"></div><div class="flex items-center gap-2"><button onclick={() => (showValidation = true)} class="px-3 py-1.5 text-sm font-mono text-text-primary border border-surface-border hover:border-accent-primary hover:text-accent-primary transition-all">Validate</button><button onclick={() => (showExecution = true)} class="px-3 py-1.5 text-sm font-mono bg-accent-primary text-bg-primary border border-accent-primary hover:bg-accent-primary-hover transition-all disabled:opacity-70 disabled:cursor-not-allowed" disabled={currentNodes.length === 0}>Run</button></div></header>
		<div bind:this={canvasEl} class="canvas-area flex-1 relative overflow-hidden bg-bg-primary" class:panning={isPanning} ondrop={handleDrop} ondragover={handleDragOver} onclick={handleCanvasClick} onmousedown={handleMouseDown} onmousemove={handleMouseMove} onmouseup={handleMouseUp} onmouseleave={handleMouseUp} role="application" tabindex="0">
			<div class="absolute inset-0 opacity-20 pointer-events-none" style="background-image: radial-gradient(circle, #2a2a38 1px, transparent 1px); background-size: {24 * zoom}px {24 * zoom}px;"></div>
			<div class="absolute inset-0" style="transform: translate({pan.x}px, {pan.y}px);">
				<svg class="absolute inset-0 pointer-events-none overflow-visible"><defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#00C49A" /></marker></defs>{#each currentConnections as connection}<ConnectionLine {connection} nodes={currentNodes} />{/each}{#if currentDraggingConnection}<path d={getTempConnectionPath(currentDraggingConnection)} fill="none" stroke="#00C49A" stroke-width="2" stroke-dasharray="4 4" class="temp-connection" />{/if}</svg>
				{#each currentNodes as node (node.id)}<DraggableNode {node} selected={currentSelectedNodeId === node.id} {zoom} />{/each}
			</div>
			{#if currentNodes.length === 0}<div class="absolute inset-0 flex items-center justify-center pointer-events-none"><div class="text-center"><h3 class="text-lg font-medium text-text-primary mb-2">No skills on canvas</h3><p class="text-sm text-text-secondary">Drag skills from the sidebar</p></div></div>{/if}
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
	{#if currentSelectedNode}<aside class="w-80 border-l border-surface-border bg-bg-secondary flex flex-col"><div class="p-4 border-b border-surface-border flex items-center justify-between"><h2 class="font-medium text-text-primary">{currentSelectedNode.skill.name}</h2><button onclick={() => selectNode(null)} class="btn-ghost p-1">X</button></div><div class="flex-1 overflow-y-auto p-4"><div class="mb-6"><h3 class="text-xs font-semibold text-text-tertiary uppercase mb-2">Description</h3><p class="text-sm text-text-secondary">{currentSelectedNode.skill.description}</p></div></div><div class="p-4 border-t border-surface-border"><button class="w-full px-4 py-2 text-sm font-mono text-accent-primary border border-accent-primary hover:bg-accent-primary hover:text-bg-primary transition-all">Test Node</button></div></aside>{/if}
</div>

{#if showValidation}
	<ValidationPanel onClose={() => (showValidation = false)} />
{/if}

{#if showExecution}
	<ExecutionPanel onClose={() => (showExecution = false)} />
{/if}

<style>
	.canvas-area { cursor: grab; }
	.canvas-area.panning { cursor: grabbing; }
	.temp-connection {
		opacity: 0.7;
		animation: dash 0.5s linear infinite;
	}
	@keyframes dash {
		to { stroke-dashoffset: -8; }
	}
</style>
