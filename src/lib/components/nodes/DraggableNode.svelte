<script lang="ts">
	import { logger } from '$lib/utils/logger';
	import SkillNode from './SkillNode.svelte';
	import type { CanvasNode } from '$lib/stores/canvas.svelte';
	import { updateNodePosition, selectNode, toggleNodeSelection, removeNode, startConnectionDrag, updateConnectionDrag, endConnectionDrag, completeConnection, snapPosition, canvasState } from '$lib/stores/canvas.svelte';
	import { get } from 'svelte/store';
	import type { SkillNodeData } from '$lib/types/skill';
	import { generatePorts } from '$lib/utils/ports';
	import { onMount } from 'svelte';

	let {
		node,
		selected = false,
		zoom = 1,
		pan = { x: 0, y: 0 },
		onOpenDetails,
		onContextMenu,
		onHandoffClick
	}: {
		node: CanvasNode;
		selected?: boolean;
		zoom?: number;
		pan?: { x: number; y: number };
		onOpenDetails?: () => void;
		onContextMenu?: (e: MouseEvent) => void;
		onHandoffClick?: (skillId: string, sourceNodeId: string, sourcePortId: string) => void;
	} = $props();

	let isDragging = $state(false);
	let dragOffset = $state({ x: 0, y: 0 });
	let previousStatus = $state<'idle' | 'queued' | 'running' | 'success' | 'error'>('idle');
	let statusTransitionPulse = $state(false);

	// FIX: Helper to get current zoom/pan from store (avoids stale closure values)
	function getCurrentTransform() {
		const state = get(canvasState);
		return { zoom: state.zoom, pan: state.pan };
	}

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

	$effect(() => {
		const currentStatus = node.status || 'idle';
		let timeout: ReturnType<typeof setTimeout> | null = null;
		if (currentStatus !== previousStatus) {
			statusTransitionPulse = true;
			timeout = setTimeout(() => {
				statusTransitionPulse = false;
			}, 420);
			previousStatus = currentStatus;
		}
		return () => {
			if (timeout) clearTimeout(timeout);
		};
	});

	// Generate dynamic ports based on skill properties
	const ports = $derived(generatePorts({
		category: node.skill.category,
		handoffs: node.skill.handoffs,
		pairsWell: node.skill.pairsWell,
		tags: node.skill.tags
	}));

	// Convert skill to SkillNodeData format (including skill chain if present)
	const nodeData: SkillNodeData = $derived({
		id: node.id,
		name: node.skill.name,
		description: node.skill.description,
		category: node.skill.category,
		tier: node.skill.tier,
		tags: node.skill.tags,
		icon: getCategoryIcon(node.skill.category),
		inputs: ports.inputs,
		outputs: ports.outputs,
		skillChain: node.skill.skillChain,
		chainDescription: node.skill.chainDescription
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

		// FIX: Read current zoom/pan from store to avoid stale closure values
		const { zoom: currentZoom, pan: currentPan } = getCurrentTransform();

		const canvasRect = canvasEl.getBoundingClientRect();
		// Account for pan offset when calculating position
		// dragOffset is in screen pixels (already accounts for zoom via bounding rect)
		const rawX = (e.clientX - canvasRect.left - currentPan.x - dragOffset.x) / currentZoom;
		const rawY = (e.clientY - canvasRect.top - currentPan.y - dragOffset.y) / currentZoom;

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
		logger.info('Testing node:', node.id, node.skill.name);
	}

	// Port connection handlers
	function handlePortDragStart(portId: string, portType: 'input' | 'output', e: MouseEvent) {
		const canvasEl = document.querySelector('.canvas-area');
		if (!canvasEl) return;

		// FIX: Read current zoom/pan from store to avoid stale closure values
		const { zoom: currentZoom, pan: currentPan } = getCurrentTransform();

		const canvasRect = canvasEl.getBoundingClientRect();
		// Convert screen coordinates to canvas space (accounting for pan and zoom)
		// The SVG is inside the zoomed container, so all coordinates must be in canvas space
		const portX = (e.clientX - canvasRect.left - currentPan.x) / currentZoom;
		const portY = (e.clientY - canvasRect.top - currentPan.y) / currentZoom;

		startConnectionDrag(node.id, portId, portType, portX, portY);

		window.addEventListener('mousemove', handleConnectionDragMove);
		window.addEventListener('mouseup', handleConnectionDragEnd);
	}

	function handleConnectionDragMove(e: MouseEvent) {
		const canvasEl = document.querySelector('.canvas-area');
		if (!canvasEl) return;

		// FIX: Read current zoom/pan from store to avoid stale closure values
		const { zoom: currentZoom, pan: currentPan } = getCurrentTransform();

		const canvasRect = canvasEl.getBoundingClientRect();
		// Convert screen coordinates to canvas space (same as start position)
		const currentX = (e.clientX - canvasRect.left - currentPan.x) / currentZoom;
		const currentY = (e.clientY - canvasRect.top - currentPan.y) / currentZoom;

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
	class:queued={node.status === 'queued'}
	class:running={node.status === 'running'}
	class:success={node.status === 'success'}
	class:error={node.status === 'error'}
	class:status-transition={statusTransitionPulse}
	style="left: {node.position.x}px; top: {node.position.y}px; pointer-events: auto !important;"
	onmousedown={handleMouseDown}
	ondblclick={() => onOpenDetails?.()}
	oncontextmenu={onContextMenu}
	role="button"
	tabindex="0"
>
	<!-- Inner wrapper for relative positioning of status indicators -->
	<div class="node-content-wrapper">
		<!-- Running status - animated ring around node -->
		{#if node.status === 'running'}
			<div class="running-ring"></div>
			<div class="running-glow"></div>
		{/if}

		<!-- Success status - DONE label + soft glow (no redundant tick) -->
		{#if node.status === 'success'}
			<div class="success-glow"></div>
		{/if}

		<!-- Error status - corner badge -->
		{#if node.status === 'error'}
			<div class="error-badge">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</div>
			<div class="error-glow"></div>
		{/if}

		<SkillNode
			data={nodeData}
			nodeId={node.id}
			{selected}
			status={node.status || 'idle'}
			onSelect={handleSelect}
			onTest={handleTest}
			onPortDragStart={handlePortDragStart}
			onPortDragEnd={handlePortDragEnd}
			{onHandoffClick}
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
</div>

<style>
	.draggable-node {
		cursor: grab;
		z-index: 10;
		pointer-events: auto;
		/* Note: Do NOT add position: relative here - it breaks Tailwind's .absolute class */
	}

	.node-content-wrapper {
		position: relative;
	}

	.draggable-node.dragging {
		cursor: grabbing;
		z-index: 100;
	}

	.draggable-node.selected {
		z-index: 50;
	}

	.draggable-node.status-transition {
		animation: statusTransitionPop 0.4s ease-out;
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
		color: #FF4D4D;
		border: 1px solid #FF4D4D;
		border-radius: 5px;
		cursor: pointer;
		opacity: 0;
		font-family: var(--font-mono);
		font-size: 10px;
		transition: all 150ms ease;
	}

	.delete-btn:hover {
		background: #FF4D4D;
		color: var(--bg-primary);
	}

	.draggable-node:hover .delete-btn,
	.node-content-wrapper:hover .delete-btn {
		opacity: 1;
	}

	/* ====== QUEUED STATE ====== */
	.draggable-node.queued {
		opacity: 0.95;
	}

	/* ====== RUNNING STATE ====== */
	.running-ring {
		position: absolute;
		inset: -3px;
		border: 1px solid #00C49A;
		border-radius: 11px;
		animation: ringPulse 1.5s ease-in-out infinite;
		pointer-events: none;
	}

	.running-glow {
		position: absolute;
		inset: -6px;
		border: 1px solid rgba(0, 196, 154, 0.2);
		border-radius: 14px;
		animation: glowPulse 1.5s ease-in-out infinite;
		pointer-events: none;
		z-index: -1;
	}

	.success-glow {
		position: absolute;
		inset: -2px;
		border: 1px solid rgb(var(--accent-rgb, 47 202 148) / 0.18);
		border-radius: 10px;
		pointer-events: none;
		animation: successFadeIn 150ms ease-out;
	}

	/* ====== ERROR STATE ====== */
	.error-badge {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-secondary, #141B2D);
		color: #FF4D4D;
		border: 1px solid #FF4D4D;
		border-radius: 6px;
		z-index: 20;
		animation: badgePopIn 200ms ease-out;
	}

	.error-glow {
		position: absolute;
		inset: -2px;
		border: 1px solid rgba(255, 77, 77, 0.3);
		border-radius: 10px;
		pointer-events: none;
		animation: successFadeIn 150ms ease-out;
	}

	/* ====== ANIMATIONS ====== */
	@keyframes statusTransitionPop {
		0% {
			transform: scale(0.98);
		}
		55% {
			transform: scale(1.015);
		}
		100% {
			transform: scale(1);
		}
	}

	@keyframes ringPulse {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.6;
			transform: scale(1.02);
		}
	}

	@keyframes glowPulse {
		0%, 100% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
	}

	@keyframes badgePopIn {
		0% {
			opacity: 0;
			transform: scale(0.5);
		}
		50% {
			transform: scale(1.2);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes successFadeIn {
		0% {
			opacity: 0;
		}
		100% {
			opacity: 1;
		}
	}
</style>
