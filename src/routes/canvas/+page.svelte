<script lang="ts">
	import DraggableNode from '$lib/components/nodes/DraggableNode.svelte';
	import SkillsPanel from '$lib/components/SkillsPanel.svelte';
	import ConnectionLine from '$lib/components/ConnectionLine.svelte';
	import { canvasState, nodes, connections, selectedNodeId, selectedNode, addNode, selectNode, setZoom, clearCanvas } from '$lib/stores/canvas.svelte';
	import type { Skill } from '$lib/stores/skills.svelte';

	let chatInput = $state('');
	let activeTab = $state('skills');
	let canvasEl;
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

	$effect(() => {
		const unsub1 = nodes.subscribe((n) => (currentNodes = n));
		const unsub2 = connections.subscribe((c) => (currentConnections = c));
		const unsub3 = selectedNodeId.subscribe((id) => (currentSelectedNodeId = id));
		const unsub4 = selectedNode.subscribe((node) => (currentSelectedNode = node));
		return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
	});

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

<div class="h-screen flex bg-bg-primary">
	<aside class="w-64 border-r border-surface-border bg-bg-secondary flex flex-col">
		<div class="p-4 border-b border-surface-border"><a href="/" class="flex items-center gap-2"><img src="/logo.png" alt="vibeship" class="w-6 h-6" /><span class="text-text-primary">vibeship</span><span class="text-accent-primary">spawner</span></a></div>
		<div class="p-3 border-b border-surface-border"><div class="flex gap-1 p-0.5 bg-bg-tertiary"><button class="flex-1 py-1.5 text-sm font-medium" class:bg-accent-primary={activeTab === 'skills'} class:text-bg-primary={activeTab === 'skills'} onclick={() => (activeTab = 'skills')}>Skills</button><button class="flex-1 py-1.5 text-sm font-medium" class:bg-accent-primary={activeTab === 'mind'} class:text-bg-primary={activeTab === 'mind'} onclick={() => (activeTab = 'mind')}>Mind</button></div></div>
		<div class="flex-1 overflow-hidden">{#if activeTab === 'skills'}<SkillsPanel />{:else}<div class="p-4"><span class="font-mono text-accent-primary text-sm">recall()</span><div class="p-3 bg-surface border border-surface-border mt-3"><p class="text-xs text-text-secondary">No memories yet.</p></div></div>{/if}</div>
		<div class="p-4 border-t border-surface-border"><div class="text-xs text-text-tertiary">Project • {currentNodes.length} nodes</div></div>
	</aside>
	<main class="flex-1 flex flex-col">
		<header class="h-12 border-b border-surface-border bg-bg-secondary flex items-center px-4 gap-4"><div class="flex items-center gap-2"><button class="btn-ghost btn-sm" onclick={clearCanvas}>Clear</button><span class="text-sm text-text-secondary">{currentNodes.length} nodes</span></div><div class="flex items-center gap-1 px-2 border-l border-surface-border"><button class="btn-ghost btn-sm" onclick={handleZoomOut}>-</button><button class="btn-ghost btn-sm min-w-[4rem] font-mono text-xs" onclick={handleZoomReset}>{Math.round(zoom * 100)}%</button><button class="btn-ghost btn-sm" onclick={handleZoomIn}>+</button></div><div class="flex-1"></div><div class="flex items-center gap-2"><button class="btn-secondary btn-sm">Validate</button><button class="btn-primary btn-sm" disabled={currentNodes.length === 0}>Run</button></div></header>
		<div bind:this={canvasEl} class="canvas-area flex-1 relative overflow-hidden bg-bg-primary" class:panning={isPanning} ondrop={handleDrop} ondragover={handleDragOver} onclick={handleCanvasClick} onmousedown={handleMouseDown} onmousemove={handleMouseMove} onmouseup={handleMouseUp} onmouseleave={handleMouseUp} role="application" tabindex="0">
			<div class="absolute inset-0 opacity-20 pointer-events-none" style="background-image: radial-gradient(circle, #2a2a38 1px, transparent 1px); background-size: {24 * zoom}px {24 * zoom}px;"></div>
			<div class="absolute inset-0" style="transform: translate({pan.x}px, {pan.y}px);">
				<svg class="absolute inset-0 pointer-events-none overflow-visible"><defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#00C49A" /></marker></defs>{#each currentConnections as connection}<ConnectionLine {connection} nodes={currentNodes} />{/each}</svg>
				{#each currentNodes as node (node.id)}<DraggableNode {node} selected={currentSelectedNodeId === node.id} {zoom} />{/each}
			</div>
			{#if currentNodes.length === 0}<div class="absolute inset-0 flex items-center justify-center pointer-events-none"><div class="text-center"><h3 class="text-lg font-medium text-text-primary mb-2">No skills on canvas</h3><p class="text-sm text-text-secondary">Drag skills from the sidebar</p></div></div>{/if}
		</div>
		<div class="border-t border-surface-border bg-bg-secondary p-4"><div class="max-w-2xl mx-auto"><div class="relative"><input type="text" bind:value={chatInput} placeholder="Ask Claude..." class="input pr-24" /><button class="absolute right-2 top-1/2 -translate-y-1/2 btn-primary btn-sm">Send</button></div></div></div>
	</main>
	{#if currentSelectedNode}<aside class="w-80 border-l border-surface-border bg-bg-secondary flex flex-col"><div class="p-4 border-b border-surface-border flex items-center justify-between"><h2 class="font-medium text-text-primary">{currentSelectedNode.skill.name}</h2><button onclick={() => selectNode(null)} class="btn-ghost p-1">X</button></div><div class="flex-1 overflow-y-auto p-4"><div class="mb-6"><h3 class="text-xs font-semibold text-text-tertiary uppercase mb-2">Description</h3><p class="text-sm text-text-secondary">{currentSelectedNode.skill.description}</p></div></div><div class="p-4 border-t border-surface-border"><button class="btn-secondary btn-md w-full">Test Node</button></div></aside>{/if}
</div>

<style>.canvas-area { cursor: grab; }.canvas-area.panning { cursor: grabbing; }</style>
