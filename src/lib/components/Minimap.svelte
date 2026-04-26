<script lang="ts">
	// Minimap component for canvas navigation
	import type { CanvasNode } from '$lib/stores/canvas.svelte';

	let {
		nodes = [],
		zoom = 1,
		pan = { x: 0, y: 0 },
		viewportWidth = 800,
		viewportHeight = 600,
		onPanTo
	}: {
		nodes: CanvasNode[];
		zoom?: number;
		pan?: { x: number; y: number };
		viewportWidth?: number;
		viewportHeight?: number;
		onPanTo?: (x: number, y: number) => void;
	} = $props();

	// Minimap dimensions
	const MINIMAP_WIDTH = 160;
	const MINIMAP_HEIGHT = 120;
	const NODE_WIDTH = 192;
	const NODE_HEIGHT = 48;
	const PADDING = 50;

	// Calculate bounds of all nodes
	const bounds = $derived(() => {
		if (nodes.length === 0) {
			return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
		}
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		for (const node of nodes) {
			minX = Math.min(minX, node.position.x);
			minY = Math.min(minY, node.position.y);
			maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
			maxY = Math.max(maxY, node.position.y + NODE_HEIGHT);
		}
		return {
			minX: minX - PADDING,
			minY: minY - PADDING,
			maxX: maxX + PADDING,
			maxY: maxY + PADDING
		};
	});

	// Calculate scale to fit content in minimap
	const scale = $derived(() => {
		const b = bounds();
		const contentWidth = b.maxX - b.minX;
		const contentHeight = b.maxY - b.minY;
		return Math.min(MINIMAP_WIDTH / contentWidth, MINIMAP_HEIGHT / contentHeight, 1);
	});

	// Transform canvas coordinates to minimap coordinates
	function toMinimapCoords(x: number, y: number): { x: number; y: number } {
		const b = bounds();
		const s = scale();
		return {
			x: (x - b.minX) * s,
			y: (y - b.minY) * s
		};
	}

	// Get viewport rectangle in minimap coordinates
	const viewport = $derived(() => {
		const b = bounds();
		const s = scale();
		// Viewport in canvas coordinates
		const vpX = -pan.x / zoom;
		const vpY = -pan.y / zoom;
		const vpW = viewportWidth / zoom;
		const vpH = viewportHeight / zoom;
		// Transform to minimap
		return {
			x: (vpX - b.minX) * s,
			y: (vpY - b.minY) * s,
			width: vpW * s,
			height: vpH * s
		};
	});

	// Category colors for nodes
	const categoryColors: Record<string, string> = {
		development: '#3B82F6',
		frameworks: '#8B5CF6',
		integrations: '#06B6D4',
		'ai-ml': '#EC4899',
		agents: '#F59E0B',
		data: '#10B981',
		design: '#F43F5E',
		marketing: '#84CC16',
		strategy: '#6366F1',
		enterprise: '#64748B',
		finance: '#22C55E',
		legal: '#A855F7',
		science: '#14B8A6',
		startup: '#EF4444'
	};

	function getNodeColor(category: string): string {
		return categoryColors[category] || '#6B7280';
	}

	let isDragging = $state(false);

	function handleClick(e: MouseEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		navigateToPoint(e.clientX - rect.left, e.clientY - rect.top);
	}

	function handleMouseDown(e: MouseEvent) {
		isDragging = true;
		handleClick(e);
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		navigateToPoint(e.clientX - rect.left, e.clientY - rect.top);
	}

	function handleMouseUp() {
		isDragging = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		navigateToPoint(MINIMAP_WIDTH / 2, MINIMAP_HEIGHT / 2);
	}

	function navigateToPoint(minimapX: number, minimapY: number) {
		const b = bounds();
		const s = scale();
		// Convert minimap coords back to canvas coords
		const canvasX = minimapX / s + b.minX;
		const canvasY = minimapY / s + b.minY;
		// Center viewport on this point
		const centerX = -canvasX * zoom + viewportWidth / 2;
		const centerY = -canvasY * zoom + viewportHeight / 2;
		onPanTo?.(centerX, centerY);
	}
</script>

<div
	class="minimap"
	style="width: {MINIMAP_WIDTH}px; height: {MINIMAP_HEIGHT}px;"
	onclick={handleClick}
	onmousedown={handleMouseDown}
	onmousemove={handleMouseMove}
	onmouseup={handleMouseUp}
	onmouseleave={handleMouseUp}
	onkeydown={handleKeydown}
	role="button"
	tabindex="0"
>
	<svg width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT}>
		<!-- Background grid -->
		<defs>
			<pattern id="minimap-grid" width="10" height="10" patternUnits="userSpaceOnUse">
				<circle cx="5" cy="5" r="0.5" fill="var(--text-tertiary)" opacity="0.3" />
			</pattern>
		</defs>
		<rect width="100%" height="100%" fill="url(#minimap-grid)" />

		<!-- Nodes -->
		{#each nodes as node}
			{@const pos = toMinimapCoords(node.position.x, node.position.y)}
			{@const s = scale()}
			<rect
				x={pos.x}
				y={pos.y}
				width={NODE_WIDTH * s}
				height={NODE_HEIGHT * s}
				fill={getNodeColor(node.skill.category)}
				rx="1"
			/>
		{/each}

		<!-- Viewport indicator -->
		<rect
			x={viewport().x}
			y={viewport().y}
			width={viewport().width}
			height={viewport().height}
			fill="rgba(0, 196, 154, 0.15)"
			stroke="#00C49A"
			stroke-width="1"
			rx="2"
		/>
	</svg>

	<!-- Label -->
	<div class="minimap-label">
		<span>{nodes.length} nodes</span>
		<span class="zoom-label">{Math.round(zoom * 100)}%</span>
	</div>
</div>

<style>
	.minimap {
		position: absolute;
		bottom: 16px;
		right: 16px;
		background: var(--bg-secondary);
		border: 1px solid var(--surface-border);
		cursor: pointer;
		z-index: 40;
		overflow: hidden;
	}

	.minimap:hover {
		border-color: var(--accent-primary);
	}

	.minimap-label {
		position: absolute;
		bottom: 2px;
		left: 4px;
		right: 4px;
		display: flex;
		justify-content: space-between;
		font-size: 8px;
		font-family: var(--font-mono);
		color: var(--text-tertiary);
		pointer-events: none;
	}

	.zoom-label {
		color: var(--accent-primary);
	}
</style>
