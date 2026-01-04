<script lang="ts">
	import type { SkillNodeData, Port } from '$lib/types/skill';
	import { getPortColor } from '$lib/utils/ports';

	let {
		data,
		nodeId = '',
		selected = false,
		ghost = false,
		collapsed = false,
		onSelect,
		onTest,
		onPortDragStart,
		onPortDragEnd
	}: {
		data: SkillNodeData;
		nodeId?: string;
		selected?: boolean;
		ghost?: boolean;
		collapsed?: boolean;
		onSelect?: () => void;
		onTest?: () => void;
		onPortDragStart?: (portId: string, portType: 'input' | 'output', e: MouseEvent) => void;
		onPortDragEnd?: (portId: string, portType: 'input' | 'output') => void;
	} = $props();

	// Category color mapping
	const categoryColors: Record<string, string> = {
		development: 'bg-category-development',
		integration: 'bg-category-integration',
		ai: 'bg-category-ai',
		data: 'bg-category-data',
		marketing: 'bg-category-marketing',
		strategy: 'bg-category-strategy',
		agents: 'bg-category-agents',
		mind: 'bg-category-mind'
	};

	const categoryBadges: Record<string, string> = {
		development: 'category-development',
		integration: 'category-integration',
		ai: 'category-ai',
		data: 'category-data',
		marketing: 'category-marketing',
		strategy: 'category-strategy',
		agents: 'category-agents',
		mind: 'category-mind'
	};

	const categoryColor = categoryColors[data.category] || 'bg-surface-active';
	const badgeClass = categoryBadges[data.category] || '';

	// Calculate port positions
	const maxPorts = $derived(Math.max(data.inputs?.length || 1, data.outputs?.length || 1));
	const nodeHeight = $derived(Math.max(48, 20 + maxPorts * 18));

	function handlePortMouseDown(e: MouseEvent, portId: string, portType: 'input' | 'output') {
		e.stopPropagation();
		e.preventDefault();
		onPortDragStart?.(portId, portType, e);
	}

	function handlePortMouseUp(e: MouseEvent, portId: string, portType: 'input' | 'output') {
		e.stopPropagation();
		onPortDragEnd?.(portId, portType);
	}

	function getPortStyle(port: Port, index: number, total: number): string {
		const color = getPortColor(port.type);
		const spacing = nodeHeight / (total + 1);
		const top = spacing * (index + 1);
		return `border-color: ${color}; top: ${top}px;`;
	}
</script>

<div
	class="node w-48 select-none relative"
	class:selected
	class:ghost
	onclick={onSelect}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && onSelect?.()}
	style="min-height: {nodeHeight}px;"
>
	<!-- Input ports (left edge) -->
	{#if data.inputs && data.inputs.length > 0}
		{#each data.inputs as port, i}
			<div
				class="port-handle port-input"
				onmousedown={(e) => handlePortMouseDown(e, port.id, 'input')}
				onmouseup={(e) => handlePortMouseUp(e, port.id, 'input')}
				data-port-id={port.id}
				data-port-type="input"
				data-node-id={nodeId}
				role="button"
				tabindex="-1"
				title="{port.label} ({port.type})"
				style={getPortStyle(port, i, data.inputs.length)}
			>
				{#if data.inputs.length > 1}
					<span class="port-label port-label-left">{port.label}</span>
				{/if}
			</div>
		{/each}
	{/if}

	<!-- Output ports (right edge) -->
	{#if data.outputs && data.outputs.length > 0}
		{#each data.outputs as port, i}
			<div
				class="port-handle port-output"
				onmousedown={(e) => handlePortMouseDown(e, port.id, 'output')}
				onmouseup={(e) => handlePortMouseUp(e, port.id, 'output')}
				data-port-id={port.id}
				data-port-type="output"
				data-node-id={nodeId}
				role="button"
				tabindex="-1"
				title="{port.label} ({port.type})"
				style={getPortStyle(port, i, data.outputs.length)}
			>
				{#if data.outputs.length > 1}
					<span class="port-label port-label-right">{port.label}</span>
				{/if}
			</div>
		{/each}
	{/if}

	<!-- Color accent bar -->
	<div class="h-0.5 {categoryColor}"></div>

	<!-- Clean Node Content -->
	<div class="px-3 py-2.5">
		<h3 class="text-sm font-mono text-text-primary truncate">{data.name}</h3>
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.port-handle {
		position: absolute;
		width: 12px;
		height: 12px;
		background: var(--bg-secondary);
		border: 2px solid;
		border-radius: 50%;
		cursor: crosshair;
		z-index: 10;
		transition: transform 0.15s, background 0.15s, box-shadow 0.15s;
		transform: translateY(-50%);
	}

	.port-handle:hover {
		transform: translateY(-50%) scale(1.3);
		box-shadow: 0 0 8px currentColor;
	}

	.port-input {
		left: -6px;
	}

	.port-output {
		right: -6px;
	}

	.port-label {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		font-size: 9px;
		font-family: var(--font-mono);
		color: var(--text-tertiary);
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.port-label-left {
		left: 16px;
	}

	.port-label-right {
		right: 16px;
	}

	.port-handle:hover .port-label {
		opacity: 1;
	}
</style>
