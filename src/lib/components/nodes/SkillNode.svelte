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
		status?: 'idle' | 'queued' | 'running' | 'success' | 'error';
		onSelect?: () => void;
		onTest?: () => void;
		onPortDragStart?: (portId: string, portType: 'input' | 'output', e: MouseEvent) => void;
		onPortDragEnd?: (portId: string, portType: 'input' | 'output') => void;
		onHandoffClick?: (skillId: string, sourceNodeId: string, sourcePortId: string) => void;
	} = $props();

	// Track for double-click detection on handoff ports
	let lastClickTime = $state<number>(0);
	let lastClickPort = $state<string | null>(null);
	let showTagMenu = $state(false);

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

	// Chrome header tag mapping — short mono label per category
	const categoryTags: Record<string, string> = {
		development: 'DEV', backend: 'DEV', frontend: 'DEV', frameworks: 'DEV',
		devops: 'DEV', 'game-dev': 'GAME', testing: 'TEST', hardware: 'HW', maker: 'HW',
		integration: 'INT', integrations: 'INT',
		ai: 'AI', 'ai-agents': 'AGENT', 'ai-tools': 'AI',
		data: 'DATA', blockchain: 'CHAIN', finance: 'FIN', trading: 'TRADE', security: 'SEC',
		marketing: 'MKT', creative: 'DESIGN', design: 'DESIGN', community: 'COMM',
		strategy: 'STRAT', enterprise: 'ENT', startup: 'START', product: 'PROD',
		education: 'EDU', legal: 'LEGAL', climate: 'CLIM',
		biotech: 'BIO', science: 'SCI', simulation: 'SIM', space: 'SPACE',
		agents: 'AGENT'
	};
	const chromeTag = $derived(categoryTags[data.category] || data.category.slice(0, 4).toUpperCase());

	// MCP tool count for this skill
	const skillMcpEntries = $derived(SKILL_MCP_MAP[data.id] || []);
	const mcpToolCount = $derived(skillMcpEntries.reduce((acc: number, e: { mcps: string[] }) => acc + e.mcps.length, 0));

	// Right-slot label: only render when it carries non-redundant info. The
	// left tag already encodes category; right should show skill count / MCP
	// count / status, or stay empty.
	const chromeSubLabel = $derived(data.skillChain && data.skillChain.length > 0
		? `${data.skillChain.length} skill${data.skillChain.length === 1 ? '' : 's'}`
		: mcpToolCount > 0
			? `${mcpToolCount} mcp`
			: '');
	const displayTags = $derived(data.skillChain && data.skillChain.length > 0 ? data.skillChain : (data.tags || []));
	const visibleTags = $derived(displayTags.slice(0, 2));
	const hiddenTags = $derived(displayTags.slice(2));
	const extraTagCount = $derived(Math.max(0, displayTags.length - visibleTags.length));
	const tagMenuTitle = $derived(data.skillChain && data.skillChain.length > 0 ? 'Other skills' : 'Other tags');
	const statusLabel = $derived(
		status === 'queued' ? 'QUEUED' : status === 'running' ? 'RUN' : status === 'success' ? 'DONE' : ''
	);

	// Calculate port positions
	const maxPorts = $derived(Math.max(data.inputs?.length || 1, data.outputs?.length || 1));
	const nodeHeight = $derived(Math.max(96, 46 + maxPorts * 18));

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
		// Border color intentionally NOT set here — CSS handles it with a neutral
		// dark ring. Per-type color info is still exposed via title tooltip.
		const spacing = nodeHeight / (total + 1);
		const top = spacing * (index + 1);
		return `top: ${top}px;`;
	}
</script>

<div
	class="node w-56 select-none relative"
	class:selected
	class:ghost
	class:has-status={!!statusLabel}
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

	<!-- Chrome header: mono tag left, italic secondary right (only if non-redundant) -->
	<div class="node-chrome">
		<span class="chrome-tag">{chromeTag}</span>
		{#if chromeSubLabel}
			<i class="chrome-sub">{chromeSubLabel}</i>
		{/if}
	</div>

	<!-- Body: title + sub + optional tags/mcp -->
	<div class="node-body">
		<h3 class="node-title">{data.name}</h3>
		{#if statusLabel}
			<div
				class="node-status"
				class:node-status-queued={status === 'queued'}
				class:node-status-running={status === 'running'}
				class:node-status-success={status === 'success'}
			>
				{statusLabel}
			</div>
		{/if}

		{#if data.skillChain && data.skillChain.length > 0 && visibleTags.length === 0}
			<div class="node-sub skill-sub">
				{data.skillChain.slice(0, 2).join(' · ')}{data.skillChain.length > 2 ? ` +${data.skillChain.length - 2}` : ''}
			</div>
		{/if}

		{#if visibleTags.length > 0}
			<div class="node-tag-cluster">
				<div class="node-tags">
					{#each visibleTags as tag}
						<span class="node-tag" title={tag}>{tag}</span>
					{/each}
					{#if extraTagCount > 0}
						<button
							type="button"
							class="node-tag node-tag-more"
							aria-expanded={showTagMenu}
							aria-label={`Show ${extraTagCount} more ${data.skillChain && data.skillChain.length > 0 ? 'skills' : 'tags'}`}
							title={`Show ${extraTagCount} more`}
							onmousedown={(e) => {
								e.preventDefault();
								e.stopPropagation();
							}}
							onclick={(e) => {
								e.stopPropagation();
								showTagMenu = !showTagMenu;
							}}
						>
							+{extraTagCount}
						</button>
					{/if}
				</div>

				{#if showTagMenu && hiddenTags.length > 0}
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
					<div
						class="node-tag-menu"
						role="list"
						onmousedown={(e) => e.stopPropagation()}
						onclick={(e) => e.stopPropagation()}
						onkeydown={(e) => e.stopPropagation()}
					>
						<div class="node-tag-menu-title">{tagMenuTitle}</div>
						<div class="node-tag-menu-list">
							{#each hiddenTags as tag}
								<span class="node-tag-menu-item" role="listitem" title={tag}>{tag}</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

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
	/* ── Spark-agent aesthetic: card with chrome header + body ── */

	.node {
		background: var(--surface-raised);
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		box-shadow: 0 10px 28px -16px rgba(0,0,0,0.55), inset 0 1px 0 rgb(255 255 255 / 0.03);
		transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
	}

	.node:hover {
		border-color: var(--accent);
		box-shadow: 0 16px 42px -18px rgba(0,0,0,0.62), 0 0 0 1px var(--accent-mid);
	}

	.node.selected {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent-mid), 0 20px 50px -18px rgba(47,202,148,0.26);
	}

	.node.ghost {
		opacity: 0.75;
	}

	/* Chrome header — mono tag left, italic secondary right */
	.node-chrome {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		background: var(--bg-subtle);
		border-bottom: 1px solid var(--border);
		border-radius: 8px 8px 0 0;
		font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 1px;
	}

	.chrome-tag {
		min-width: 0;
		color: var(--text);
		letter-spacing: 1.5px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chrome-sub {
		flex: 0 0 auto;
		font-style: normal;
		color: var(--text-tertiary);
		letter-spacing: 0.4px;
	}

	/* Body — title + sub */
	.node-body {
		position: relative;
		padding: 11px 12px 12px;
	}

	.node-status {
		position: absolute;
		top: 8px;
		right: 9px;
		display: inline-flex;
		align-items: center;
		height: 16px;
		padding: 0 6px;
		border: 1px solid rgb(var(--status-amber-rgb, 216 200 104) / 0.65);
		border-radius: 5px;
		background: var(--bg-secondary, #141B2D);
		color: var(--status-amber, #D8C868);
		font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
		font-size: 9px;
		font-weight: 500;
		line-height: 1;
		letter-spacing: 0.5px;
	}

	.node-status-running,
	.node-status-success {
		border-color: rgb(var(--accent-rgb, 47 202 148) / 0.72);
		color: var(--accent, #2FCA94);
		box-shadow: 0 0 12px rgb(var(--accent-rgb, 47 202 148) / 0.12);
	}

	.node.has-status .node-title {
		padding-right: 54px;
	}

	.node-title {
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 13.5px;
		font-weight: 600;
		color: var(--text);
		margin: 0 0 2px 0;
		line-height: 1.25;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: break-word;
	}

	.node-sub {
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 10.5px;
		font-weight: 500;
		color: var(--text-tertiary);
		letter-spacing: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.skill-sub {
		color: var(--text-secondary);
	}

	.node-tags {
		display: flex;
		flex-wrap: nowrap;
		gap: 3px;
		margin-top: 8px;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
	}

	.node-tag-cluster {
		position: relative;
		z-index: 30;
	}

	.node-tag {
		flex: 0 1 auto;
		min-width: 0;
		max-width: 88px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 2px 5px;
		border: 1px solid rgb(var(--accent-rgb, 47 202 148) / 0.18);
		border-radius: 4px;
		background: rgb(var(--accent-rgb, 47 202 148) / 0.045);
		color: var(--text-secondary);
		font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
		font-size: 9px;
		line-height: 1.15;
		letter-spacing: 0;
	}

	.node-tag-more {
		flex: 0 0 auto;
		color: var(--accent);
		border-color: rgb(var(--accent-rgb, 47 202 148) / 0.28);
		background: rgb(var(--accent-rgb, 47 202 148) / 0.07);
		cursor: pointer;
	}

	button.node-tag {
		appearance: none;
		text-align: left;
	}

	.node-tag-more:hover,
	.node-tag-more[aria-expanded='true'] {
		border-color: rgb(var(--accent-rgb, 47 202 148) / 0.55);
		background: rgb(var(--accent-rgb, 47 202 148) / 0.14);
		color: var(--text);
	}

	.node-tag-menu {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		width: max-content;
		min-width: 172px;
		max-width: 240px;
		padding: 8px;
		border: 1px solid var(--border-strong);
		border-radius: 8px;
		background: rgb(17 21 28 / 0.98);
		box-shadow:
			0 18px 46px -22px rgb(0 0 0 / 0.88),
			0 0 0 1px rgb(var(--accent-rgb, 47 202 148) / 0.1);
		backdrop-filter: blur(12px);
		z-index: 80;
	}

	.node-tag-menu-title {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
		color: var(--accent);
		font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
		font-size: 8.5px;
		line-height: 1;
		letter-spacing: 0.7px;
		text-transform: uppercase;
	}

	.node-tag-menu-title::before {
		content: '';
		width: 5px;
		height: 5px;
		border-radius: 999px;
		background: var(--accent);
		box-shadow: 0 0 10px rgb(var(--accent-rgb, 47 202 148) / 0.55);
	}

	.node-tag-menu-list {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.node-tag-menu-item {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 3px 6px;
		border: 1px solid rgb(var(--accent-rgb, 47 202 148) / 0.16);
		border-radius: 5px;
		background: rgb(var(--accent-rgb, 47 202 148) / 0.055);
		color: var(--text-secondary);
		font-family: var(--font-mono, 'DM Mono', ui-monospace, monospace);
		font-size: 8.5px;
		line-height: 1.2;
	}

	.node-tag-menu-item:hover {
		border-color: rgb(var(--accent-rgb, 47 202 148) / 0.36);
		background: rgb(var(--accent-rgb, 47 202 148) / 0.1);
		color: var(--text);
	}

	/* Ports: large enough to click, centered exactly on the card edge */
	.port-handle {
		position: absolute;
		width: 10px;
		height: 10px;
		background: var(--accent);
		border: 2px solid var(--bg-primary);
		border-radius: 50%;
		cursor: crosshair;
		z-index: 35;
		transition: all 0.1s;
		transform: translateY(-50%);
		box-shadow:
			0 0 0 1px rgb(var(--accent-rgb, 47 202 148) / 0.2),
			0 0 8px rgb(var(--accent-rgb, 47 202 148) / 0.16);
	}

	.port-handle:hover {
		background: var(--accent);
		border-color: var(--accent-mid);
		transform: translateY(-50%) scale(1.25);
		box-shadow:
			0 0 0 3px rgb(var(--accent-rgb, 47 202 148) / 0.14),
			0 0 14px var(--accent-mid);
	}

	.port-input {
		left: -5px;
	}

	.port-output {
		right: -5px;
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
		box-shadow:
			0 0 0 3px rgb(var(--accent-rgb, 47 202 148) / 0.16),
			0 0 12px var(--accent-primary, #00C49A);
		transform: translateY(-50%) scale(1.2);
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
