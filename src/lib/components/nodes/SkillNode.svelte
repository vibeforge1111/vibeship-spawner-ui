<script lang="ts">
	import type { SkillNodeData, Port } from '$lib/types/skill';
	import { getPortColor } from '$lib/utils/ports';
	import { draggingConnection, wouldConnectionBeValid } from '$lib/stores/canvas.svelte';
	import type { DraggingConnection } from '$lib/stores/canvas.svelte';

	let {
		data,
		nodeId = '',
		selected = false,
		ghost = false,
		collapsed = false,
		onSelect,
		onTest,
		onPortDragStart,
		onPortDragEnd,
		onHandoffClick
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
		onHandoffClick?: (skillId: string, sourceNodeId: string, sourcePortId: string) => void;
	} = $props();

	// Track for double-click detection on handoff ports
	let lastClickTime = $state<number>(0);
	let lastClickPort = $state<string | null>(null);

	let currentDraggingConnection = $state<DraggingConnection | null>(null);

	$effect(() => {
		const unsub = draggingConnection.subscribe((dc) => (currentDraggingConnection = dc));
		return unsub;
	});

	// Check if a port would be a valid drop target
	function isValidDropTarget(portId: string, portType: 'input' | 'output'): boolean {
		if (!currentDraggingConnection) return false;
		// Only show valid indicator on opposite port types
		if (currentDraggingConnection.sourcePortType === portType) return false;
		// Check if connection would be valid
		return wouldConnectionBeValid(nodeId, portId);
	}

	// Check if we're currently dragging (to show indicators)
	const isDragging = $derived(currentDraggingConnection !== null);

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

	function handlePortMouseDown(e: MouseEvent, portId: string, portType: 'input' | 'output', port?: Port) {
		e.stopPropagation();
		e.preventDefault();
		onPortDragStart?.(portId, portType, e);
	}

	function handlePortMouseUp(e: MouseEvent, portId: string, portType: 'input' | 'output', port?: Port) {
		e.stopPropagation();
		onPortDragEnd?.(portId, portType);
	}

	function handlePortDoubleClick(e: MouseEvent, port: Port) {
		e.stopPropagation();
		e.preventDefault();

		// Double-click on handoff port - spawn the skill
		if (port.skillId) {
			onHandoffClick?.(port.skillId, nodeId, port.id);
		}
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
			{@const isValid = isValidDropTarget(port.id, 'input')}
			{@const showIndicator = isDragging && currentDraggingConnection?.sourcePortType === 'output'}
			<div
				class="port-handle port-input"
				class:valid-target={showIndicator && isValid}
				class:invalid-target={showIndicator && !isValid}
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
			{@const isValid = isValidDropTarget(port.id, 'output')}
			{@const showIndicator = isDragging && currentDraggingConnection?.sourcePortType === 'input'}
			{@const isHandoff = !!port.skillId}
			<div
				class="port-handle port-output"
				class:valid-target={showIndicator && isValid}
				class:invalid-target={showIndicator && !isValid}
				class:handoff-port={isHandoff}
				onmousedown={(e) => handlePortMouseDown(e, port.id, 'output', port)}
				onmouseup={(e) => handlePortMouseUp(e, port.id, 'output', port)}
				ondblclick={isHandoff ? (e) => handlePortDoubleClick(e, port) : undefined}
				data-port-id={port.id}
				data-port-type="output"
				data-node-id={nodeId}
				role="button"
				tabindex="-1"
				title={isHandoff ? `Double-click to spawn ${port.label} • Drag to connect` : `${port.label} (${port.type})`}
				style={getPortStyle(port, i, data.outputs.length)}
			>
				{#if data.outputs.length > 1}
					<span class="port-label port-label-right" class:handoff-label={isHandoff}>
						{port.label}
						{#if isHandoff}
							<span class="spawn-hint">+</span>
						{/if}
					</span>
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
		cursor: crosshair;
		z-index: 20;
		transition: all 0.1s;
		transform: translateY(-50%);
	}

	.port-handle:hover {
		background: currentColor;
		transform: translateY(-50%) scale(1.2);
	}

	.port-input {
		left: -7px;
	}

	.port-output {
		right: -7px;
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

	/* Valid drop target indicator */
	.port-handle.valid-target {
		background: var(--accent-primary, #00C49A);
		border-color: var(--accent-primary, #00C49A);
		box-shadow: 0 0 8px var(--accent-primary, #00C49A);
		transform: translateY(-50%) scale(1.3);
	}

	/* Invalid drop target indicator */
	.port-handle.invalid-target {
		background: var(--bg-secondary);
		border-color: var(--status-error, #ef4444);
		opacity: 0.5;
	}

	/* Handoff port - clickable to spawn */
	.port-handle.handoff-port {
		border-color: #3B82F6;
		cursor: pointer;
	}

	.port-handle.handoff-port:hover {
		background: #3B82F6;
		box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
	}

	.port-handle.handoff-port:hover .port-label {
		opacity: 1;
	}

	.handoff-label {
		color: #3B82F6;
		font-weight: 500;
	}

	.spawn-hint {
		display: inline-block;
		margin-left: 2px;
		font-size: 10px;
		color: #3B82F6;
		opacity: 0.7;
	}
</style>
