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
		status = 'idle',
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
		status?: 'idle' | 'running' | 'success' | 'error';
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

	// Category color mapping - complete mapping for all skills.json categories
	const categoryColors: Record<string, string> = {
		// Primary categories with dedicated colors
		development: 'bg-category-development',
		integration: 'bg-category-integration',
		integrations: 'bg-category-integration', // alias
		ai: 'bg-category-ai',
		'ai-agents': 'bg-category-agents',
		'ai-tools': 'bg-category-ai',
		data: 'bg-category-data',
		marketing: 'bg-category-marketing',
		strategy: 'bg-category-strategy',
		agents: 'bg-category-agents',
		mind: 'bg-category-mind',
		
		// Map additional categories to existing color schemes
		backend: 'bg-category-development',
		frontend: 'bg-category-development',
		frameworks: 'bg-category-development',
		devops: 'bg-category-development',
		'game-dev': 'bg-category-development',
		testing: 'bg-category-development',
		hardware: 'bg-category-development',
		maker: 'bg-category-development',
		
		blockchain: 'bg-category-data',
		finance: 'bg-category-data',
		trading: 'bg-category-data',
		security: 'bg-category-data',
		
		creative: 'bg-category-marketing',
		design: 'bg-category-marketing',
		community: 'bg-category-marketing',
		
		enterprise: 'bg-category-strategy',
		startup: 'bg-category-strategy',
		product: 'bg-category-strategy',
		education: 'bg-category-strategy',
		legal: 'bg-category-strategy',
		climate: 'bg-category-strategy',
		
		biotech: 'bg-category-ai',
		science: 'bg-category-ai',
		simulation: 'bg-category-ai',
		space: 'bg-category-ai'
	};

	const categoryBadges: Record<string, string> = {
		// Primary categories
		development: 'category-development',
		integration: 'category-integration',
		integrations: 'category-integration', // alias
		ai: 'category-ai',
		'ai-agents': 'category-agents',
		'ai-tools': 'category-ai',
		data: 'category-data',
		marketing: 'category-marketing',
		strategy: 'category-strategy',
		agents: 'category-agents',
		mind: 'category-mind',
		
		// Map additional categories
		backend: 'category-development',
		frontend: 'category-development',
		frameworks: 'category-development',
		devops: 'category-development',
		'game-dev': 'category-development',
		testing: 'category-development',
		hardware: 'category-development',
		maker: 'category-development',
		
		blockchain: 'category-data',
		finance: 'category-data',
		trading: 'category-data',
		security: 'category-data',
		
		creative: 'category-marketing',
		design: 'category-marketing',
		community: 'category-marketing',
		
		enterprise: 'category-strategy',
		startup: 'category-strategy',
		product: 'category-strategy',
		education: 'category-strategy',
		legal: 'category-strategy',
		climate: 'category-strategy',
		
		biotech: 'category-ai',
		science: 'category-ai',
		simulation: 'category-ai',
		space: 'category-ai'
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
	class="skill-node w-48 select-none relative"
	class:selected
	class:ghost
	class:running={status === 'running'}
	class:success={status === 'success'}
	class:error={status === 'error'}
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
				style={getPortStyle(port, i, data.inputs.length)}
			>
				<!-- Styled tooltip -->
				<span class="port-tooltip port-tooltip-left">
					<span class="tooltip-name">{port.label}</span>
					<span class="tooltip-type">{port.type}</span>
				</span>
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
				style={getPortStyle(port, i, data.outputs.length)}
			>
				<!-- Styled tooltip -->
				<span class="port-tooltip port-tooltip-right">
					{#if isHandoff}
						<span class="tooltip-action">Double-click to spawn</span>
						<span class="tooltip-name">{port.label}</span>
					{:else}
						<span class="tooltip-name">{port.label}</span>
						<span class="tooltip-type">{port.type}</span>
					{/if}
				</span>
			</div>
		{/each}
	{/if}

	<!-- Color accent bar -->
	<div class="accent-bar {categoryColor}"></div>

	<!-- Node Content -->
	<div class="node-content">
		<h3 class="node-name">{data.name}</h3>

		<!-- Work Indicator - only shows when actively running -->
		{#if status === 'running'}
			<div class="work-indicator">
				<svg class="hammer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M15 12l-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9" />
					<path d="M17.64 15L22 10.64" />
					<path d="M20.91 11.7l-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91" />
				</svg>
				<span class="work-text">Working...</span>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Base node styling - Vibeship solid design */
	.skill-node {
		background: #111111;
		border: 1px solid #2a2a2a;
		border-radius: 0;
		transition: all 0.15s ease;
		overflow: visible;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.skill-node:hover {
		border-color: #3a3a3a;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
	}

	.skill-node.selected {
		border-color: var(--accent-primary, #00C49A);
		box-shadow: 0 0 0 1px var(--accent-primary, #00C49A), 0 4px 16px rgba(0, 196, 154, 0.2);
	}

	.skill-node.ghost {
		opacity: 0.6;
	}

	.skill-node.running {
		border-color: var(--color-yellow-500, #eab308);
		box-shadow: 0 0 0 1px var(--color-yellow-500, #eab308), 0 4px 12px rgba(234, 179, 8, 0.15);
	}

	.skill-node.success {
		border-color: var(--accent-primary, #00C49A);
	}

	.skill-node.error {
		border-color: var(--status-error, #ef4444);
	}

	/* Accent bar */
	.accent-bar {
		height: 3px;
	}

	/* Node content */
	.node-content {
		padding: 10px 12px;
	}

	.node-name {
		font-size: 13px;
		font-family: var(--font-mono);
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 500;
	}

	/* Work indicator - centered under name */
	.work-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-top: 8px;
		padding: 6px 8px;
		background: rgba(234, 179, 8, 0.1);
		border: 1px solid rgba(234, 179, 8, 0.3);
		border-radius: 4px;
	}

	.hammer-icon {
		width: 14px;
		height: 14px;
		color: var(--color-yellow-500, #eab308);
		animation: hammer-build 0.4s ease-in-out infinite;
		transform-origin: bottom left;
	}

	@keyframes hammer-build {
		0%, 100% {
			transform: rotate(0deg);
		}
		50% {
			transform: rotate(-20deg);
		}
	}

	.work-text {
		font-size: 10px;
		font-family: var(--font-mono);
		color: var(--color-yellow-500, #eab308);
		font-weight: 500;
	}

	/* Port styles - clean squares with larger hover area */
	.port-handle {
		position: absolute;
		width: 12px;
		height: 12px;
		background: #111111;
		border: 2px solid #3a3a3a;
		border-radius: 2px;
		cursor: crosshair;
		z-index: 20;
		transition: all 0.15s ease;
		transform: translateY(-50%);
	}

	/* Larger invisible hover area */
	.port-handle::before {
		content: '';
		position: absolute;
		top: -8px;
		left: -8px;
		right: -8px;
		bottom: -8px;
	}

	.port-handle:hover {
		background: var(--accent-primary, #00C49A);
		border-color: var(--accent-primary, #00C49A);
		transform: translateY(-50%) scale(1.15);
	}

	.port-input {
		left: -7px;
	}

	.port-output {
		right: -7px;
	}


	/* Styled tooltips for ports */
	.port-tooltip {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-family: var(--font-mono);
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.15s ease, transform 0.15s ease;
		background: linear-gradient(135deg, #1a1a1a 0%, #141414 100%);
		padding: 8px 12px;
		border: 1px solid #333;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
		z-index: 100;
	}

	.port-tooltip-left {
		right: 24px;
		left: auto;
		transform: translateY(-50%) translateX(4px);
	}

	.port-tooltip-right {
		left: 24px;
		right: auto;
		transform: translateY(-50%) translateX(-4px);
	}

	.port-handle:hover .port-tooltip {
		opacity: 1;
	}

	.port-handle:hover .port-tooltip-left {
		transform: translateY(-50%) translateX(0);
	}

	.port-handle:hover .port-tooltip-right {
		transform: translateY(-50%) translateX(0);
	}

	.tooltip-action {
		font-size: 9px;
		color: var(--accent-primary, #00C49A);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-weight: 600;
	}

	.tooltip-name {
		font-size: 11px;
		color: #fff;
		font-weight: 500;
	}

	.tooltip-type {
		font-size: 9px;
		color: #666;
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
		background: var(--bg-primary, #0a0a0a);
		border-color: var(--status-error, #ef4444);
		opacity: 0.4;
	}

	/* Handoff port - clickable to spawn */
	.port-handle.handoff-port {
		border-color: #3B82F6;
		background: var(--bg-primary, #0a0a0a);
		cursor: pointer;
	}

	.port-handle.handoff-port:hover {
		background: #3B82F6;
		border-color: #3B82F6;
		box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
	}

</style>
