<script lang="ts">
	import type { SkillNodeData, Port } from '$lib/types/skill';
	import { getPortColor } from '$lib/utils/ports';
	import { draggingConnection, wouldConnectionBeValid } from '$lib/stores/canvas.svelte';
	import type { DraggingConnection } from '$lib/stores/canvas.svelte';
	import { SKILL_MCP_MAP } from '$lib/types/mcp';

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

	// MCP tool count for this skill
	const skillMcpEntries = SKILL_MCP_MAP[data.id] || [];
	const mcpToolCount = skillMcpEntries.reduce((acc: number, e: { mcps: string[] }) => acc + e.mcps.length, 0);

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
	style="min-height: {nodeHeight}px; pointer-events: auto;"
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

	<!-- Clean Node Content -->
	<div class="px-3 py-2.5">
		<h3 class="task-name text-sm font-mono text-text-primary">{data.name}</h3>

		<!-- Skills badges (shows which skills handle this task) -->
		{#if data.skillChain && data.skillChain.length > 0}
			<div class="skill-tags-row mt-1.5">
				<div class="skill-tags">
					{#each data.skillChain.slice(0, 4) as skill}
						<span class="skill-tag" title={skill}>
							{skill}
						</span>
					{/each}
					{#if data.skillChain.length > 4}
						<span class="skill-tag skill-tag-more" title={data.skillChain.slice(4).join(', ')}>
							+{data.skillChain.length - 4}
						</span>
					{/if}
				</div>
			</div>
		{/if}

		<!-- MCP tool indicator -->
		{#if mcpToolCount > 0}
			<div class="mcp-badge">
				<svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<path d="M12 2v6m0 8v6M2 12h6m8 0h6" />
				</svg>
				{mcpToolCount} MCP tools
			</div>
		{/if}
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.task-name {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: break-word;
		line-height: 1.35;
	}

	.port-handle {
		position: absolute;
		width: 12px;
		height: 12px;
		background: var(--bg-secondary);
		border: 2px solid;
		border-radius: 50%;
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

	/* Skill Tags - shows which skills handle this task */
	.skill-tags-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 0;
		border-top: 1px solid var(--border-surface, rgba(255, 255, 255, 0.1));
		margin-top: 4px;
		padding-top: 4px;
	}

	.skill-tags {
		display: flex;
		align-items: center;
		gap: 3px;
		flex-wrap: wrap;
		overflow: hidden;
		flex: 1;
	}

	.skill-tag {
		font-size: 9px;
		font-family: var(--font-mono);
		color: var(--accent-primary, #00C49A);
		background: rgba(0, 196, 154, 0.1);
		border: 1px solid rgba(0, 196, 154, 0.2);
		padding: 1px 7px;
		border-radius: 9999px;
		white-space: nowrap;
		cursor: default;
		transition: all 0.15s;
	}

	.skill-tag:hover {
		color: var(--text-primary);
		background: rgba(0, 196, 154, 0.2);
		border-color: rgba(0, 196, 154, 0.4);
	}

	.skill-tag-more {
		color: var(--text-tertiary);
		background: var(--bg-tertiary, rgba(255, 255, 255, 0.05));
		border-color: var(--border-surface, rgba(255, 255, 255, 0.1));
	}

	/* MCP tool indicator */
	.mcp-badge {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		margin-top: 4px;
		font-size: 8px;
		font-family: var(--font-mono);
		color: var(--text-tertiary);
		opacity: 0.7;
		transition: opacity 0.15s;
	}

	.mcp-badge svg {
		color: var(--accent-primary, #00C49A);
	}

	.node:hover .mcp-badge {
		opacity: 1;
	}
</style>
