<script lang="ts">
	/**
	 * Pipeline View Component
	 *
	 * Task 6: Transparency - Shows what the agent pipeline is actually doing.
	 * Displays execution flow, current operations, and detailed logs.
	 */

	import { theatreStore } from '../theatre-store.svelte';
	import type { AgentCharacter, TheatreLog, Handoff } from '../types';
	import { ROLE_NAMES } from '../types';

	// Props
	interface Props {
		expanded?: boolean;
	}

	let { expanded = false }: Props = $props();

	// Reactive state
	let characters = $derived(theatreStore.characters);
	let logs = $derived(theatreStore.logs);
	let handoffs = $derived(theatreStore.handoffs);
	let progress = $derived(theatreStore.progress);

	// Computed values
	let activeAgents = $derived(characters.filter(c => c.status === 'working'));
	let completedCount = $derived(characters.filter(c => c.status === 'celebrating').length);
	let errorCount = $derived(characters.filter(c => c.status === 'error').length);

	// Execution timeline entries
	let timeline = $derived(
		[...logs, ...handoffs.map(h => ({
			id: h.id,
			timestamp: h.timestamp,
			agentId: h.fromAgent,
			message: `Handoff to ${ROLE_NAMES[characters.find(c => c.id === h.toAgent)?.role || 'general']}: ${h.payload}`,
			type: 'handoff' as const
		}))]
		.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
		.slice(0, 20)
	);

	function getAgentName(agentId: string): string {
		const char = characters.find(c => c.id === agentId);
		return char?.name || agentId;
	}

	function getStatusColor(status: AgentCharacter['status']): string {
		switch (status) {
			case 'working': return 'var(--status-info)';
			case 'celebrating': return 'var(--status-success)';
			case 'error': return 'var(--status-error)';
			case 'blocked': return 'var(--status-warning)';
			case 'handoff': return 'var(--accent-primary)';
			default: return 'var(--text-muted)';
		}
	}
</script>

<div class="pipeline-view" class:expanded>
	<!-- Header Stats -->
	<div class="pipeline-header">
		<h3>Pipeline Status</h3>
		<div class="stats">
			<div class="stat">
				<span class="stat-value" style="color: var(--status-info)">{activeAgents.length}</span>
				<span class="stat-label">Active</span>
			</div>
			<div class="stat">
				<span class="stat-value" style="color: var(--status-success)">{completedCount}</span>
				<span class="stat-label">Done</span>
			</div>
			<div class="stat">
				<span class="stat-value" style="color: var(--status-error)">{errorCount}</span>
				<span class="stat-label">Errors</span>
			</div>
		</div>
	</div>

	<!-- Active Operations -->
	{#if activeAgents.length > 0}
		<div class="active-operations">
			<h4>Active Operations</h4>
			{#each activeAgents as agent}
				<div class="operation-card" style="--agent-color: {agent.color}">
					<div class="operation-header">
						<span class="operation-agent">{agent.name}</span>
						<span class="operation-progress">{agent.progress}%</span>
					</div>
					<div class="operation-task">{agent.currentTask || 'Processing...'}</div>
					<div class="operation-bar">
						<div class="operation-fill" style="width: {agent.progress}%"></div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Agent Status Grid -->
	<div class="agent-grid">
		<h4>All Agents</h4>
		<div class="grid">
			{#each characters as char}
				<div class="agent-status" style="--agent-color: {char.color}">
					<div class="agent-indicator" style="background: {getStatusColor(char.status)}"></div>
					<div class="agent-details">
						<span class="agent-name">{char.name}</span>
						<span class="agent-state">{char.status}</span>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Execution Timeline -->
	<div class="timeline">
		<h4>Execution Timeline</h4>
		<div class="timeline-list">
			{#each timeline as entry}
				<div class="timeline-entry" class:success={entry.type === 'success'} class:error={entry.type === 'error'} class:handoff={entry.type === 'handoff'}>
					<span class="entry-time">{entry.timestamp.toLocaleTimeString()}</span>
					<span class="entry-agent">{getAgentName(entry.agentId)}</span>
					<span class="entry-message">{entry.message}</span>
				</div>
			{/each}
			{#if timeline.length === 0}
				<div class="timeline-empty">No activity yet</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.pipeline-view {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		background: var(--surface-secondary, #111116);
		max-height: 100%;
		overflow-y: auto;
	}

	.pipeline-view.expanded {
		position: fixed;
		inset: 0;
		z-index: 100;
	}

	/* Header */
	.pipeline-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.pipeline-header h3 {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.stats {
		display: flex;
		gap: 1rem;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 700;
		font-family: monospace;
	}

	.stat-label {
		font-size: 0.625rem;
		text-transform: uppercase;
		color: var(--text-muted, #5a5a6d);
	}

	/* Active Operations */
	.active-operations h4,
	.agent-grid h4,
	.timeline h4 {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--text-secondary, #a0a0a0);
		margin: 0 0 0.5rem 0;
	}

	.operation-card {
		background: var(--surface-tertiary, #1a1a2e);
		padding: 0.75rem;
		margin-bottom: 0.5rem;
		border-left: 3px solid var(--agent-color);
	}

	.operation-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 0.25rem;
	}

	.operation-agent {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.operation-progress {
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--accent-primary, #00ffff);
	}

	.operation-task {
		font-size: 0.75rem;
		color: var(--text-secondary, #a0a0a0);
		margin-bottom: 0.5rem;
	}

	.operation-bar {
		height: 4px;
		background: var(--surface-primary, #0a0a0f);
	}

	.operation-fill {
		height: 100%;
		background: var(--agent-color);
		transition: width 0.3s ease;
	}

	/* Agent Grid */
	.grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
	}

	.agent-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--surface-tertiary, #1a1a2e);
	}

	.agent-indicator {
		width: 8px;
		height: 8px;
	}

	.agent-details {
		display: flex;
		flex-direction: column;
	}

	.agent-name {
		font-size: 0.75rem;
		font-weight: 500;
	}

	.agent-state {
		font-size: 0.625rem;
		text-transform: uppercase;
		color: var(--text-muted, #5a5a6d);
	}

	/* Timeline */
	.timeline-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 200px;
		overflow-y: auto;
	}

	.timeline-entry {
		display: grid;
		grid-template-columns: 70px 80px 1fr;
		gap: 0.5rem;
		padding: 0.375rem;
		background: var(--surface-tertiary, #1a1a2e);
		font-size: 0.6875rem;
	}

	.timeline-entry.success {
		border-left: 2px solid var(--status-success);
	}

	.timeline-entry.error {
		border-left: 2px solid var(--status-error);
	}

	.timeline-entry.handoff {
		border-left: 2px solid var(--accent-primary);
	}

	.entry-time {
		font-family: monospace;
		color: var(--text-muted, #5a5a6d);
	}

	.entry-agent {
		font-weight: 500;
		color: var(--text-secondary, #a0a0a0);
	}

	.entry-message {
		color: var(--text-primary, #e5e5e5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.timeline-empty {
		text-align: center;
		padding: 1rem;
		color: var(--text-muted, #5a5a6d);
		font-style: italic;
	}
</style>
