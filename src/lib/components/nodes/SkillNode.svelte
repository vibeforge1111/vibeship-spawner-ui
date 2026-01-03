<script lang="ts">
	import type { SkillNodeData } from '$lib/types/skill';

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

	function handlePortMouseDown(e: MouseEvent, portId: string, portType: 'input' | 'output') {
		e.stopPropagation();
		e.preventDefault();
		onPortDragStart?.(portId, portType, e);
	}

	function handlePortMouseUp(e: MouseEvent, portId: string, portType: 'input' | 'output') {
		e.stopPropagation();
		onPortDragEnd?.(portId, portType);
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
>
	<!-- Input port (left edge) -->
	{#if data.inputs && data.inputs.length > 0}
		<div
			class="port-handle port-input"
			onmousedown={(e) => handlePortMouseDown(e, data.inputs[0].id, 'input')}
			onmouseup={(e) => handlePortMouseUp(e, data.inputs[0].id, 'input')}
			data-port-id={data.inputs[0].id}
			data-port-type="input"
			data-node-id={nodeId}
			role="button"
			tabindex="-1"
			title="Input"
		></div>
	{/if}

	<!-- Output port (right edge) -->
	{#if data.outputs && data.outputs.length > 0}
		<div
			class="port-handle port-output"
			onmousedown={(e) => handlePortMouseDown(e, data.outputs[0].id, 'output')}
			onmouseup={(e) => handlePortMouseUp(e, data.outputs[0].id, 'output')}
			data-port-id={data.outputs[0].id}
			data-port-type="output"
			data-node-id={nodeId}
			role="button"
			tabindex="-1"
			title="Output"
		></div>
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
		width: 14px;
		height: 14px;
		background: var(--bg-secondary);
		border: 2px solid var(--accent-primary);
		border-radius: 50%;
		cursor: crosshair;
		z-index: 10;
		transition: transform 0.15s, background 0.15s;
	}

	.port-handle:hover {
		transform: scale(1.3);
		background: var(--accent-primary);
	}

	.port-input {
		left: -7px;
		top: 50%;
		transform: translateY(-50%);
	}

	.port-input:hover {
		transform: translateY(-50%) scale(1.3);
	}

	.port-output {
		right: -7px;
		top: 50%;
		transform: translateY(-50%);
	}

	.port-output:hover {
		transform: translateY(-50%) scale(1.3);
	}
</style>
