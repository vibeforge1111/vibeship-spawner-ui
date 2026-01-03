<script lang="ts">
	import SkillNode from './SkillNode.svelte';
	import type { CanvasNode } from '$lib/stores/canvas.svelte';
	import { updateNodePosition, selectNode, removeNode, startConnectionDrag, updateConnectionDrag, endConnectionDrag, completeConnection } from '$lib/stores/canvas.svelte';
	import type { SkillNodeData } from '$lib/types/skill';

	let {
		node,
		selected = false,
		zoom = 1
	}: {
		node: CanvasNode;
		selected?: boolean;
		zoom?: number;
	} = $props();

	let isDragging = $state(false);
	let dragOffset = $state({ x: 0, y: 0 });

	// Convert skill to SkillNodeData format
	const nodeData: SkillNodeData = $derived({
		id: node.id,
		name: node.skill.name,
		description: node.skill.description,
		category: node.skill.category,
		tier: node.skill.tier,
		icon: getCategoryIcon(node.skill.category),
		inputs: [{ id: 'input', label: 'Input', type: 'object' as const }],
		outputs: [{ id: 'output', label: 'Output', type: 'object' as const }]
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

		selectNode(node.id);

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;

		const canvasEl = document.querySelector('.canvas-area');
		if (!canvasEl) return;

		const canvasRect = canvasEl.getBoundingClientRect();
		const newX = (e.clientX - canvasRect.left - dragOffset.x) / zoom;
		const newY = (e.clientY - canvasRect.top - dragOffset.y) / zoom;

		updateNodePosition(node.id, {
			x: Math.max(0, newX),
			y: Math.max(0, newY)
		});
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
		// Get the port position relative to canvas
		const portX = (e.clientX - canvasRect.left) / zoom;
		const portY = (e.clientY - canvasRect.top) / zoom;
		
		startConnectionDrag(node.id, portId, portType, portX, portY);
		
		window.addEventListener('mousemove', handleConnectionDragMove);
		window.addEventListener('mouseup', handleConnectionDragEnd);
	}

	function handleConnectionDragMove(e: MouseEvent) {
		const canvasEl = document.querySelector('.canvas-area');
		if (!canvasEl) return;
		
		const canvasRect = canvasEl.getBoundingClientRect();
		const currentX = (e.clientX - canvasRect.left) / zoom;
		const currentY = (e.clientY - canvasRect.top) / zoom;
		
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
	style="left: {node.position.x}px; top: {node.position.y}px; transform: scale({zoom}); transform-origin: top left;"
	onmousedown={handleMouseDown}
	role="button"
	tabindex="0"
>
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
		top: -8px;
		right: -8px;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--status-error);
		color: white;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.draggable-node:hover .delete-btn {
		opacity: 1;
	}
</style>
