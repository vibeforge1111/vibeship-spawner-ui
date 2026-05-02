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
	const NODE_WIDTH = 224;
	const NODE_HEIGHT = 96;
	const PADDING = 420;

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
				<circle cx="5" cy="5" r="0.55" fill="var(--text-tertiary)" opacity="0.18" />
			</pattern>
			<linearGradient id="minimap-surface" x1="0" y1="0" x2="1" y2="1">
				<stop offset="0%" stop-color="var(--bg-secondary)" />
				<stop offset="100%" stop-color="var(--surface-raised)" />
			</linearGradient>
		</defs>
		<rect width="100%" height="100%" fill="url(#minimap-surface)" />
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
				opacity="0.58"
				stroke="rgba(255, 255, 255, 0.18)"
				stroke-width="0.75"
				rx="2.5"
			/>
		{/each}

		<!-- Viewport indicator -->
		<rect
			class="viewport-window"
			x={viewport().x}
			y={viewport().y}
			width={viewport().width}
			height={viewport().height}
			fill="rgb(var(--accent-rgb, 47 202 148) / 0.18)"
			stroke="rgb(var(--accent-rgb, 47 202 148) / 0.78)"
			stroke-width="1.25"
			rx="5"
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
		background: color-mix(in srgb, var(--bg-secondary) 84%, black);
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		box-shadow:
			0 18px 48px -28px rgb(0 0 0 / 0.9),
			0 0 0 1px rgb(255 255 255 / 0.035),
			inset 0 1px 0 rgb(255 255 255 / 0.04);
		cursor: pointer;
		z-index: 40;
		overflow: hidden;
		transition:
			border-color 140ms ease,
			box-shadow 140ms ease,
			transform 140ms ease;
	}

	.minimap:hover {
		border-color: rgb(var(--accent-rgb, 47 202 148) / 0.72);
		background:
			linear-gradient(90deg, rgb(var(--accent-rgb, 47 202 148) / 0.16), rgb(var(--surface-rgb, 23 27 37) / 0.86)),
			repeating-linear-gradient(90deg, transparent 0 12px, rgb(255 255 255 / 0.055) 12px 13px),
			color-mix(in srgb, var(--bg-secondary) 84%, black);
		box-shadow:
			0 20px 52px -28px rgb(0 0 0 / 0.95),
			0 0 0 1px rgb(var(--accent-rgb, 47 202 148) / 0.22),
			0 12px 34px rgb(var(--accent-rgb, 47 202 148) / 0.16),
			inset 0 1px 0 rgb(255 255 255 / 0.1);
		transform: translateY(-1px);
	}

	.minimap svg {
		display: block;
	}

	.viewport-window {
		opacity: 0.9;
		transition: opacity 160ms ease;
	}

	.minimap:hover .viewport-window {
		opacity: 1;
	}

	.minimap-label {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 17px;
		padding: 0 6px;
		border-top: 1px solid rgb(255 255 255 / 0.055);
		background: rgb(7 10 15 / 0.42);
		font-size: 8.5px;
		font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
		color: var(--text-tertiary);
		pointer-events: none;
		letter-spacing: 0.1px;
	}

	.zoom-label {
		color: var(--accent);
	}
</style>
