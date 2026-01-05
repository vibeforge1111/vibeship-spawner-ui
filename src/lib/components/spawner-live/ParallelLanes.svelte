<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { nodes, connections } from '$lib/stores/canvas.svelte';
	import { get } from 'svelte/store';
	import { eventRouter, isLiveEnabled, timelineRecorder } from '$lib/spawner-live';
	import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();

	// Agent state
	interface AgentState {
		nodeId: string;
		nodeName: string;
		status: 'idle' | 'running' | 'completed' | 'error';
		progress: number;
		startTime: number | null;
		endTime: number | null;
		lane: number;
	}

	let agentStates = $state<Map<string, AgentState>>(new Map());
	let maxLanes = $state(1);
	let currentNodes = $state<CanvasNode[]>([]);
	let currentConnections = $state<Connection[]>([]);
	let executionStartTime = $state<number | null>(null);
	let currentTime = $state(0);

	// Calculate parallel execution lanes based on dependencies
	function calculateLanes(nodes: CanvasNode[], connections: Connection[]): Map<string, number> {
		const laneMap = new Map<string, number>();
		const inDegree = new Map<string, number>();
		const deps = new Map<string, string[]>();

		// Initialize
		for (const node of nodes) {
			inDegree.set(node.id, 0);
			deps.set(node.id, []);
		}

		// Build dependency graph
		for (const conn of connections) {
			const current = inDegree.get(conn.targetNodeId) || 0;
			inDegree.set(conn.targetNodeId, current + 1);
			deps.get(conn.targetNodeId)?.push(conn.sourceNodeId);
		}

		// Assign lanes using topological levels
		const processed = new Set<string>();
		let currentLane = 0;
		let maxLane = 0;

		while (processed.size < nodes.length) {
			// Find all nodes with no unprocessed dependencies
			const available: string[] = [];
			for (const node of nodes) {
				if (processed.has(node.id)) continue;
				const nodeDeps = deps.get(node.id) || [];
				if (nodeDeps.every((d) => processed.has(d))) {
					available.push(node.id);
				}
			}

			if (available.length === 0) break; // Cycle detection

			// Assign lanes to available nodes (they can run in parallel)
			for (let i = 0; i < available.length; i++) {
				const nodeId = available[i];
				laneMap.set(nodeId, i);
				processed.add(nodeId);
				maxLane = Math.max(maxLane, i);
			}

			currentLane++;
		}

		maxLanes = maxLane + 1;
		return laneMap;
	}

	// Subscribe to stores
	onMount(() => {
		const unsubNodes = nodes.subscribe((n) => {
			currentNodes = n;
			updateLanes();
		});

		const unsubConns = connections.subscribe((c) => {
			currentConnections = c;
			updateLanes();
		});

		// Subscribe to event router for real-time updates
		const unsubEvents = eventRouter.subscribe((event) => {
			handleEvent(event);
		});

		// Update current time periodically
		const timeInterval = setInterval(() => {
			if (executionStartTime) {
				currentTime = Date.now() - executionStartTime;
			}
		}, 100);

		return () => {
			unsubNodes();
			unsubConns();
			unsubEvents();
			clearInterval(timeInterval);
		};
	});

	function updateLanes() {
		const laneMap = calculateLanes(currentNodes, currentConnections);

		// Update agent states
		const newStates = new Map<string, AgentState>();
		for (const node of currentNodes) {
			const existingState = agentStates.get(node.id);
			newStates.set(node.id, {
				nodeId: node.id,
				nodeName: node.skill.name,
				status: existingState?.status || 'idle',
				progress: existingState?.progress || 0,
				startTime: existingState?.startTime || null,
				endTime: existingState?.endTime || null,
				lane: laneMap.get(node.id) || 0
			});
		}
		agentStates = newStates;
	}

	function handleEvent(event: any) {
		if (!event.nodeId) return;

		const state = agentStates.get(event.nodeId);
		if (!state) return;

		switch (event.type) {
			case 'pipeline_start':
				executionStartTime = Date.now();
				currentTime = 0;
				// Reset all states
				for (const [id, s] of agentStates) {
					s.status = 'idle';
					s.progress = 0;
					s.startTime = null;
					s.endTime = null;
				}
				agentStates = new Map(agentStates);
				break;

			case 'agent_enter':
				state.status = 'running';
				state.startTime = Date.now();
				state.progress = 0;
				agentStates = new Map(agentStates);
				break;

			case 'agent_progress':
				state.progress = event.metadata?.progress || 0;
				agentStates = new Map(agentStates);
				break;

			case 'agent_exit':
				state.status = event.metadata?.success !== false ? 'completed' : 'error';
				state.endTime = Date.now();
				state.progress = 100;
				agentStates = new Map(agentStates);
				break;

			case 'agent_error':
				state.status = 'error';
				state.endTime = Date.now();
				agentStates = new Map(agentStates);
				break;

			case 'pipeline_complete':
				executionStartTime = null;
				break;
		}
	}

	// Get color for status
	function getStatusColor(status: AgentState['status']): string {
		switch (status) {
			case 'running':
				return 'var(--accent-primary)';
			case 'completed':
				return '#22c55e';
			case 'error':
				return '#ef4444';
			default:
				return 'var(--text-tertiary)';
		}
	}

	// Get width for progress bar
	function getProgressWidth(state: AgentState): string {
		if (state.status === 'completed') return '100%';
		if (state.status === 'idle') return '0%';
		return `${state.progress}%`;
	}

	// Format duration
	function formatDuration(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(1)}s`;
	}

	// Get running agents count
	const runningCount = $derived(() => {
		let count = 0;
		for (const [_, state] of agentStates) {
			if (state.status === 'running') count++;
		}
		return count;
	});

	// Get completed agents count
	const completedCount = $derived(() => {
		let count = 0;
		for (const [_, state] of agentStates) {
			if (state.status === 'completed') count++;
		}
		return count;
	});

	// Group agents by lane
	const laneGroups = $derived(() => {
		const groups: AgentState[][] = [];
		for (let i = 0; i < maxLanes; i++) {
			groups.push([]);
		}
		for (const [_, state] of agentStates) {
			if (groups[state.lane]) {
				groups[state.lane].push(state);
			}
		}
		return groups;
	});
</script>

{#if $isLiveEnabled && currentNodes.length > 0}
	<div class="parallel-lanes {className}">
		<!-- Header -->
		<div class="lanes-header">
			<div class="header-left">
				<div class="indicator" class:active={runningCount() > 0}></div>
				<span class="title">Parallel Execution</span>
			</div>
			<div class="header-right">
				<span class="stat">
					<span class="stat-value">{runningCount()}</span> running
				</span>
				<span class="stat">
					<span class="stat-value">{completedCount()}</span>/{currentNodes.length} done
				</span>
			</div>
		</div>

		<!-- Lanes -->
		<div class="lanes-container">
			{#each laneGroups() as lane, laneIndex}
				{#if lane.length > 0}
					<div class="lane">
						<div class="lane-label">Lane {laneIndex + 1}</div>
						<div class="lane-agents">
							{#each lane as agent}
								<div
									class="agent-card"
									class:running={agent.status === 'running'}
									class:completed={agent.status === 'completed'}
									class:error={agent.status === 'error'}
								>
									<div class="agent-header">
										<span class="agent-name">{agent.nodeName}</span>
										<span class="agent-status" style="color: {getStatusColor(agent.status)}">
											{agent.status}
										</span>
									</div>
									<div class="agent-progress">
										<div
											class="progress-bar"
											style="width: {getProgressWidth(agent)}; background-color: {getStatusColor(agent.status)}"
										></div>
									</div>
									{#if agent.startTime}
										<div class="agent-time">
											{#if agent.endTime}
												{formatDuration(agent.endTime - agent.startTime)}
											{:else}
												{formatDuration(Date.now() - agent.startTime)}...
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>

		<!-- Timeline bar -->
		{#if executionStartTime}
			<div class="timeline-bar">
				<span class="timeline-label">Elapsed:</span>
				<span class="timeline-value">{formatDuration(currentTime)}</span>
			</div>
		{/if}
	</div>
{/if}

<style>
	.parallel-lanes {
		background: var(--bg-secondary, #1a1a24);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 8px;
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		overflow: hidden;
	}

	.lanes-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
		background: var(--surface, #252530);
		border-bottom: 1px solid var(--surface-border, #2a2a3a);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.indicator {
		width: 8px;
		height: 8px;
		background: var(--text-tertiary, #666);
		border-radius: 50%;
		transition: all 0.3s;
	}

	.indicator.active {
		background: var(--accent-primary, #22c55e);
		box-shadow: 0 0 8px var(--accent-primary, #22c55e);
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	.title {
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.header-right {
		display: flex;
		gap: 12px;
	}

	.stat {
		color: var(--text-tertiary, #666);
	}

	.stat-value {
		color: var(--accent-primary, #22c55e);
		font-weight: 600;
	}

	.lanes-container {
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 200px;
		overflow-y: auto;
	}

	.lane {
		display: flex;
		gap: 8px;
		align-items: flex-start;
	}

	.lane-label {
		min-width: 50px;
		padding: 6px 0;
		color: var(--text-tertiary, #666);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.lane-agents {
		flex: 1;
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.agent-card {
		background: var(--surface, #252530);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 6px;
		padding: 8px 10px;
		min-width: 120px;
		max-width: 180px;
		transition: all 0.2s;
	}

	.agent-card.running {
		border-color: var(--accent-primary, #22c55e);
		box-shadow: 0 0 8px rgba(34, 197, 94, 0.2);
	}

	.agent-card.completed {
		border-color: #22c55e;
		opacity: 0.8;
	}

	.agent-card.error {
		border-color: #ef4444;
		box-shadow: 0 0 8px rgba(239, 68, 68, 0.2);
	}

	.agent-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 6px;
	}

	.agent-name {
		color: var(--text-primary, #fff);
		font-weight: 500;
		font-size: 11px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.agent-status {
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.agent-progress {
		height: 3px;
		background: var(--surface-border, #2a2a3a);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-bar {
		height: 100%;
		transition: width 0.3s ease-out;
	}

	.agent-time {
		margin-top: 4px;
		font-size: 9px;
		color: var(--text-tertiary, #666);
		text-align: right;
	}

	.timeline-bar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		padding: 8px 14px;
		background: var(--surface, #252530);
		border-top: 1px solid var(--surface-border, #2a2a3a);
	}

	.timeline-label {
		color: var(--text-tertiary, #666);
	}

	.timeline-value {
		color: var(--accent-primary, #22c55e);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* Scrollbar */
	.lanes-container::-webkit-scrollbar {
		width: 4px;
	}

	.lanes-container::-webkit-scrollbar-track {
		background: transparent;
	}

	.lanes-container::-webkit-scrollbar-thumb {
		background: var(--surface-border, #2a2a3a);
		border-radius: 2px;
	}

	.lanes-container::-webkit-scrollbar-thumb:hover {
		background: var(--text-tertiary, #666);
	}
</style>
