<script lang="ts">
	/**
	 * Workflow Graph Component
	 *
	 * Task 8: Understanding - Visualize workflow relationships and dependencies.
	 * Shows a simplified DAG of agents and their connections.
	 */

	import { theatreStore } from '../theatre-store.svelte';
	import { ROLE_NAMES } from '../types';
	import type { AgentCharacter, Handoff } from '../types';

	// Props
	interface Props {
		compact?: boolean;
	}

	let { compact = false }: Props = $props();

	// Reactive state
	let characters = $derived(theatreStore.characters);
	let handoffs = $derived(theatreStore.handoffs);
	let activeCharacter = $derived(theatreStore.activeCharacter);

	// Calculate node positions in a simple layout
	function getNodePosition(index: number, total: number): { x: number; y: number } {
		if (compact) {
			// Linear layout for compact mode
			const spacing = 100 / (total + 1);
			return { x: spacing * (index + 1), y: 50 };
		}

		// Arc layout for full mode
		const angleStart = Math.PI * 0.1;
		const angleEnd = Math.PI * 0.9;
		const angle = angleStart + (angleEnd - angleStart) * (index / Math.max(1, total - 1));
		const radius = 35;

		return {
			x: 50 + Math.cos(angle) * radius,
			y: 65 - Math.sin(angle) * radius
		};
	}

	// Find connections between agents based on handoffs
	function getConnections(): Array<{ from: AgentCharacter; to: AgentCharacter; active: boolean }> {
		const connections: Array<{ from: AgentCharacter; to: AgentCharacter; active: boolean }> = [];
		const seen = new Set<string>();

		for (const handoff of handoffs) {
			const from = characters.find(c => c.id === handoff.fromAgent);
			const to = characters.find(c => c.id === handoff.toAgent);
			const key = `${handoff.fromAgent}-${handoff.toAgent}`;

			if (from && to && !seen.has(key)) {
				seen.add(key);
				const isActive = activeCharacter && (activeCharacter.id === from.id || activeCharacter.id === to.id);
				connections.push({ from, to, active: isActive || false });
			}
		}

		return connections;
	}

	let connections = $derived(getConnections());

	function getStatusIndicator(status: AgentCharacter['status']): string {
		switch (status) {
			case 'working': return 'animate-pulse';
			case 'celebrating': return 'animate-bounce';
			case 'error': return 'animate-ping';
			default: return '';
		}
	}
</script>

<div class="workflow-graph" class:compact>
	<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
		<!-- Definitions for effects -->
		<defs>
			<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
				<feGaussianBlur stdDeviation="2" result="coloredBlur"/>
				<feMerge>
					<feMergeNode in="coloredBlur"/>
					<feMergeNode in="SourceGraphic"/>
				</feMerge>
			</filter>

			<linearGradient id="connection-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
				<stop offset="0%" style="stop-color:#00ffff;stop-opacity:0.8" />
				<stop offset="100%" style="stop-color:#ff00ff;stop-opacity:0.8" />
			</linearGradient>

			<!-- Arrow marker -->
			<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
				<polygon points="0 0, 10 3.5, 0 7" fill="url(#connection-gradient)" />
			</marker>
		</defs>

		<!-- Connections -->
		{#each connections as conn}
			{@const fromPos = getNodePosition(characters.indexOf(conn.from), characters.length)}
			{@const toPos = getNodePosition(characters.indexOf(conn.to), characters.length)}
			{@const midX = (fromPos.x + toPos.x) / 2}
			{@const midY = (fromPos.y + toPos.y) / 2 - 10}
			<path
				d="M {fromPos.x} {fromPos.y} Q {midX} {midY} {toPos.x} {toPos.y}"
				fill="none"
				stroke={conn.active ? 'url(#connection-gradient)' : 'var(--surface-border, #1a1a2e)'}
				stroke-width={conn.active ? '0.5' : '0.3'}
				marker-end="url(#arrowhead)"
				class:active={conn.active}
			/>
		{/each}

		<!-- Agent nodes -->
		{#each characters as char, i}
			{@const pos = getNodePosition(i, characters.length)}
			{@const isActive = activeCharacter?.id === char.id}
			<g
				transform="translate({pos.x}, {pos.y})"
				class="agent-node"
				class:active={isActive}
			>
				<!-- Status ring -->
				<circle
					r="6"
					fill="none"
					stroke={char.color}
					stroke-width="0.5"
					stroke-dasharray={char.status === 'idle' ? '2 2' : 'none'}
					class={getStatusIndicator(char.status)}
					opacity={char.status === 'idle' ? 0.3 : 0.8}
				/>

				<!-- Agent body -->
				<circle
					r="4"
					fill={char.color}
					filter={isActive ? 'url(#glow)' : 'none'}
					opacity={char.status === 'idle' ? 0.5 : 1}
				/>

				<!-- Progress indicator -->
				{#if char.progress > 0 && char.progress < 100}
					<circle
						r="5"
						fill="none"
						stroke={char.color}
						stroke-width="0.8"
						stroke-dasharray="{(char.progress / 100) * 31.4} 31.4"
						transform="rotate(-90)"
					/>
				{/if}

				<!-- Label -->
				{#if !compact}
					<text
						y="10"
						text-anchor="middle"
						class="agent-label"
						fill="currentColor"
					>
						{ROLE_NAMES[char.role]}
					</text>
				{/if}
			</g>
		{/each}
	</svg>

	<!-- Legend (non-compact only) -->
	{#if !compact}
		<div class="legend">
			<div class="legend-item">
				<span class="dot idle"></span>
				<span>Idle</span>
			</div>
			<div class="legend-item">
				<span class="dot working"></span>
				<span>Working</span>
			</div>
			<div class="legend-item">
				<span class="dot complete"></span>
				<span>Complete</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.workflow-graph {
		width: 100%;
		height: 200px;
		background: var(--surface-secondary, #111116);
		padding: 0.5rem;
	}

	.workflow-graph.compact {
		height: 80px;
	}

	svg {
		width: 100%;
		height: 100%;
	}

	.agent-node {
		cursor: pointer;
		transition: transform 0.2s ease;
	}

	.agent-node:hover {
		transform: scale(1.2);
	}

	.agent-node.active circle {
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}

	path.active {
		animation: flow 1.5s linear infinite;
		stroke-dasharray: 4 2;
	}

	@keyframes flow {
		from { stroke-dashoffset: 0; }
		to { stroke-dashoffset: 12; }
	}

	.agent-label {
		font-size: 3px;
		font-family: monospace;
		text-transform: uppercase;
		fill: var(--text-secondary, #a0a0a0);
	}

	.legend {
		display: flex;
		justify-content: center;
		gap: 1rem;
		padding: 0.5rem;
		font-size: 0.625rem;
		color: var(--text-muted, #5a5a6d);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.dot {
		width: 6px;
		height: 6px;
	}

	.dot.idle {
		background: var(--text-muted, #5a5a6d);
	}

	.dot.working {
		background: var(--status-info, #06B6D4);
		animation: pulse 1s infinite;
	}

	.dot.complete {
		background: var(--status-success, #10B981);
	}
</style>
