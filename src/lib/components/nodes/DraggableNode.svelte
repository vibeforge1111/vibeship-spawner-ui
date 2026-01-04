<script lang="ts">
	import SkillNode from './SkillNode.svelte';
	import type { CanvasNode } from '$lib/stores/canvas.svelte';
	import { updateNodePosition, selectNode, toggleNodeSelection, removeNode, startConnectionDrag, updateConnectionDrag, endConnectionDrag, completeConnection, snapPosition, canvasState } from '$lib/stores/canvas.svelte';
	import type { SkillNodeData } from '$lib/types/skill';
	import { generatePorts } from '$lib/utils/ports';
	import { onMount } from 'svelte';

	let {
		node,
		selected = false,
		zoom = 1,
		pan = { x: 0, y: 0 },
		onOpenDetails,
		onContextMenu
	}: {
		node: CanvasNode;
		selected?: boolean;
		zoom?: number;
		pan?: { x: number; y: number };
		onOpenDetails?: () => void;
		onContextMenu?: (e: MouseEvent) => void;
	} = $props();

	let isDragging = $state(false);
	let dragOffset = $state({ x: 0, y: 0 });

	// Clean up window event listeners on unmount to prevent stuck states
	onMount(() => {
		return () => {
			// Remove any lingering event listeners
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
			window.removeEventListener('mousemove', handleConnectionDragMove);
			window.removeEventListener('mouseup', handleConnectionDragEnd);
		};
	});

	// Generate dynamic ports based on skill properties
	const ports = $derived(generatePorts({
		category: node.skill.category,
		handoffs: node.skill.handoffs,
		pairsWell: node.skill.pairsWell,
		tags: node.skill.tags
	}));

	// Convert skill to SkillNodeData format
	const nodeData: SkillNodeData = $derived({
		id: node.id,
		name: node.skill.name,
		description: node.skill.description,
		category: node.skill.category,
		tier: node.skill.tier,
		icon: getCategoryIcon(node.skill.category),
		inputs: ports.inputs,
		outputs: ports.outputs
	});

	function getCategoryIcon(category: string): string {
		const icons: Record<string, string> = {
			development: '💻',
			frameworks: '🏗️',
			integrations: '🔗',
			'ai-ml': '🧠',
			agents: '🤖',
			data: '📊',
			design: '🎨',
			marketing: '📢',
			strategy: '📈',
			enterprise: '🏢',
			finance: '💰',
			legal: '⚖️',
			science: '🔬',
			startup: '🚀'
		};
		return icons[category] || '⚡';
	}

	function handleMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();

		isDragging = true;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		dragOffset = {
			x: e.clientX - rect.left,
			y: e.clientY - rect.top
		};

		// Shift+click for multi-select, regular click for single select
		toggleNodeSelection(node.id, e.shiftKey);

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;

		const canvasEl = document.querySelector('.canvas-area');
		if (!canvasEl) return;

		const canvasRect = canvasEl.getBoundingClientRect();
		// Account for pan offset when calculating position
		// dragOffset is in screen pixels (already accounts for zoom via bounding rect)
		const rawX = (e.clientX - canvasRect.left - pan.x - dragOffset.x) / zoom;
		const rawY = (e.clientY - canvasRect.top - pan.y - dragOffset.y) / zoom;

		// Apply snap to grid (no constraints - canvas is infinite)
		const snapped = snapPosition(rawX, rawY);
		updateNodePosition(node.id, snapped);
	}

	function handleMouseUp() {
		isDragging = false;
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('mouseup', handleMouseUp);
	}

	function handleSelect() {
		selectNode(node.id);
	}

	function handleDelete() {
		removeNode(node.id);
	}

	function handleTest() {
		console.log('Testing node:', node.id, node.skill.name);
	}

	// Port connection handlers
	function handlePortDragStart(portId: string, portType: 'input' | 'output', e: MouseEvent) {
		const canvasEl = document.querySelector('.canvas-area');
		if (!canvasEl) return;

		const canvasRect = canvasEl.getBoundingClientRect();
		// Convert screen coordinates to canvas space (accounting for pan and zoom)
		// The SVG is inside the zoomed container, so all coordinates must be in canvas space
		const portX = (e.clientX - canvasRect.left - pan.x) / zoom;
		const portY = (e.clientY - canvasRect.top - pan.y) / zoom;

		startConnectionDrag(node.id, portId, portType, portX, portY);

		window.addEventListener('mousemove', handleConnectionDragMove);
		window.addEventListener('mouseup', handleConnectionDragEnd);
	}

	function handleConnectionDragMove(e: MouseEvent) {
		const canvasEl = document.querySelector('.canvas-area');
		if (!canvasEl) return;

		const canvasRect = canvasEl.getBoundingClientRect();
		// Convert screen coordinates to canvas space (same as start position)
		const currentX = (e.clientX - canvasRect.left - pan.x) / zoom;
		const currentY = (e.clientY - canvasRect.top - pan.y) / zoom;

		updateConnectionDrag(currentX, currentY);
	}

	function handleConnectionDragEnd(e: MouseEvent) {
		window.removeEventListener('mousemove', handleConnectionDragMove);
		window.removeEventListener('mouseup', handleConnectionDragEnd);
		
		// Check if we released over a port
		const target = e.target as HTMLElement;
		const portHandle = target.closest('.port-handle') as HTMLElement;
		
		if (portHandle) {
			const targetNodeId = portHandle.dataset.nodeId;
			const targetPortId = portHandle.dataset.portId;
			if (targetNodeId && targetPortId) {
				completeConnection(targetNodeId, targetPortId);
				return;
			}
		}
		
		endConnectionDrag();
	}

	function handlePortDragEnd(portId: string, portType: 'input' | 'output') {
		// This is called when mouse up happens directly on a port
		completeConnection(node.id, portId);
	}
</script>

<div
	class="draggable-node absolute"
	class:dragging={isDragging}
	class:selected
	class:running={node.status === 'running'}
	class:success={node.status === 'success'}
	class:error={node.status === 'error'}
	style="left: {node.position.x}px; top: {node.position.y}px;"
	onmousedown={handleMouseDown}
	ondblclick={() => onOpenDetails?.()}
	oncontextmenu={onContextMenu}
	role="button"
	tabindex="0"
>
	<!-- Status indicator -->
	{#if node.status && node.status !== 'idle'}
		<div class="status-indicator" class:running={node.status === 'running'} class:success={node.status === 'success'} class:error={node.status === 'error'}>
			{#if node.status === 'running'}
				<span class="animate-spin">⟳</span>
			{:else if node.status === 'success'}
				✓
			{:else if node.status === 'error'}
				✗
			{/if}
		</div>
	{/if}

	<SkillNode
		data={nodeData}
		nodeId={node.id}
		{selected}
		onSelect={handleSelect}
		onTest={handleTest}
		onPortDragStart={handlePortDragStart}
		onPortDragEnd={handlePortDragEnd}
	/>

	<!-- Delete button on hover -->
	<button
		class="delete-btn"
		onclick={(e) => { e.stopPropagation(); handleDelete(); }}
		title="Remove node"
	>
		<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
		</svg>
	</button>
</div>

<style>
	.draggable-node {
		cursor: grab;
		z-index: 10; /* Ensure nodes are above SVG connection layer */
		pointer-events: auto; /* Fix 7: Ensure nodes receive events even when parent has pointer-events: none */
	}

	.draggable-node.dragging {
		cursor: grabbing;
		z-index: 100;
	}

	.draggable-node.selected {
		z-index: 50;
	}

	.delete-btn {
		position: absolute;
		top: -6px;
		right: -6px;
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary);
		color: var(--status-error);
		border: 1px solid var(--status-error);
		cursor: pointer;
		opacity: 0;
		font-family: var(--font-mono);
		font-size: 10px;
	}

	.delete-btn:hover {
		background: var(--status-error);
		color: var(--bg-primary);
	}

	.draggable-node:hover .delete-btn {
		opacity: 1;
	}

	.status-indicator {
		position: absolute;
		top: -8px;
		left: -8px;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		font-size: 12px;
		z-index: 10;
	}

	.status-indicator.running {
		background: var(--color-yellow-500, #eab308);
		color: black;
	}

	.status-indicator.success {
		background: var(--accent-primary);
		color: white;
	}

	.status-indicator.error {
		background: var(--status-error);
		color: white;
	}

	.draggable-node.running {
		outline: 2px solid var(--color-yellow-500, #eab308);
		outline-offset: 2px;
		animation: pulse 1s ease-in-out infinite;
	}

	.draggable-node.success {
		outline: 2px solid var(--accent-primary);
		outline-offset: 2px;
	}

	.draggable-node.error {
		outline: 2px solid var(--status-error);
		outline-offset: 2px;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}
</style>
