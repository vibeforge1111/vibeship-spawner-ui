<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { eventRouter } from '$lib/spawner-live';
	import type { AgentEvent } from '$lib/spawner-live/types/events';

	interface Props {
		maxEntries?: number;
		onClose?: () => void;
	}

	let { maxEntries = 100, onClose }: Props = $props();

	interface LogEntry {
		id: string;
		event: AgentEvent;
		receivedAt: number;
	}

	let entries = $state<LogEntry[]>([]);
	let autoScroll = $state(true);
	let filter = $state<string>('all');
	let paused = $state(false);
	let logContainer: HTMLDivElement;
	let unsubscribe: (() => void) | null = null;

	// Event type colors
	const eventColors: Record<string, string> = {
		agent_enter: '#22c55e',
		agent_exit: '#4ade80',
		agent_progress: '#3b82f6',
		agent_thinking: '#8b5cf6',
		agent_output: '#06b6d4',
		agent_error: '#ef4444',
		agent_skip: '#6b7280',
		handoff_start: '#f59e0b',
		handoff_complete: '#fbbf24',
		pipeline_start: '#22d3ee',
		pipeline_complete: '#10b981',
		pipeline_failed: '#dc2626',
		deviation_warn: '#f97316'
	};

	// Event type icons
	const eventIcons: Record<string, string> = {
		agent_enter: '→',
		agent_exit: '←',
		agent_progress: '◐',
		agent_thinking: '💭',
		agent_output: '📤',
		agent_error: '✗',
		agent_skip: '⊘',
		handoff_start: '⇢',
		handoff_complete: '⇠',
		pipeline_start: '▶',
		pipeline_complete: '✓',
		pipeline_failed: '✗',
		deviation_warn: '⚠'
	};

	function handleEvent(event: AgentEvent) {
		if (paused) return;

		const entry: LogEntry = {
			id: `${event.id || Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
			event,
			receivedAt: Date.now()
		};

		entries = [...entries, entry].slice(-maxEntries);

		// Auto-scroll to bottom
		if (autoScroll && logContainer) {
			requestAnimationFrame(() => {
				logContainer.scrollTop = logContainer.scrollHeight;
			});
		}
	}

	function formatTime(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		}) + '.' + String(date.getMilliseconds()).padStart(3, '0');
	}

	function formatEventType(type: string): string {
		return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
	}

	function getFilteredEntries(): LogEntry[] {
		if (filter === 'all') return entries;
		return entries.filter(e => e.event.type.startsWith(filter));
	}

	function clearLog() {
		entries = [];
	}

	function exportLog() {
		const data = entries.map(e => ({
			time: formatTime(e.event.timestamp),
			type: e.event.type,
			nodeId: e.event.nodeId,
			agentId: e.event.agentId,
			data: e.event.data,
			metadata: e.event.metadata
		}));
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `execution-log-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	onMount(() => {
		unsubscribe = eventRouter.subscribe({
			id: 'execution-log-panel',
			callback: handleEvent
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	const filteredEntries = $derived(getFilteredEntries());
</script>

<div class="execution-log-panel">
	<div class="panel-header">
		<div class="header-left">
			<h3>Execution Log</h3>
			<span class="entry-count">{entries.length}</span>
		</div>
		<div class="header-right">
			{#if onClose}
				<button class="icon-btn" onclick={onClose} title="Close">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<div class="panel-toolbar">
		<select bind:value={filter}>
			<option value="all">All Events</option>
			<option value="agent">Agent Events</option>
			<option value="handoff">Handoffs</option>
			<option value="pipeline">Pipeline</option>
			<option value="deviation">Deviations</option>
		</select>

		<div class="toolbar-spacer"></div>

		<button class="toolbar-btn" class:active={autoScroll} onclick={() => (autoScroll = !autoScroll)} title="Auto-scroll">
			<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
			</svg>
		</button>

		<button class="toolbar-btn" class:active={paused} onclick={() => (paused = !paused)} title={paused ? 'Resume' : 'Pause'}>
			{#if paused}
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>
			{:else}
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>
			{/if}
		</button>

		<button class="toolbar-btn" onclick={clearLog} title="Clear log">
			<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
			</svg>
		</button>

		<button class="toolbar-btn" onclick={exportLog} title="Export log">
			<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
			</svg>
		</button>
	</div>

	<div class="log-container" bind:this={logContainer}>
		{#if filteredEntries.length === 0}
			<div class="empty-state">
				<p>No events yet</p>
				<p class="hint">Events will appear here as they flow through the system</p>
			</div>
		{:else}
			{#each filteredEntries as entry (entry.id)}
				{@const event = entry.event}
				{@const color = eventColors[event.type] || '#6b7280'}
				{@const icon = eventIcons[event.type] || '•'}
				<div class="log-entry" style="--event-color: {color}">
					<span class="event-time">{formatTime(event.timestamp)}</span>
					<span class="event-icon">{icon}</span>
					<span class="event-type">{formatEventType(event.type)}</span>
					{#if event.nodeId}
						<span class="event-node" title={event.nodeId}>{event.nodeId.slice(0, 8)}</span>
					{/if}
					{#if event.agentId}
						<span class="event-agent">{event.agentId}</span>
					{/if}
					{#if event.data?.progress !== undefined}
						<span class="event-progress">{event.data.progress}%</span>
					{/if}
					{#if event.data?.error}
						<span class="event-error">{event.data.error}</span>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.execution-log-panel {
		background: var(--bg-secondary, #1a1a24);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 8px;
		width: 400px;
		height: 400px;
		display: flex;
		flex-direction: column;
		font-family: var(--font-mono, monospace);
		font-size: 11px;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		border-bottom: 1px solid var(--surface-border, #2a2a3a);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.entry-count {
		padding: 2px 6px;
		background: var(--surface, #252530);
		border-radius: 4px;
		font-size: 10px;
		color: var(--text-tertiary, #666);
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.icon-btn {
		background: none;
		border: none;
		color: var(--text-tertiary, #666);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.icon-btn:hover {
		color: var(--text-primary, #fff);
	}

	.panel-toolbar {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--surface-border, #2a2a3a);
	}

	.panel-toolbar select {
		padding: 4px 8px;
		background: var(--surface, #252530);
		border: 1px solid var(--surface-border, #2a2a3a);
		color: var(--text-primary, #fff);
		font-family: var(--font-mono, monospace);
		font-size: 10px;
		border-radius: 4px;
	}

	.toolbar-spacer {
		flex: 1;
	}

	.toolbar-btn {
		background: none;
		border: none;
		color: var(--text-tertiary, #666);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.toolbar-btn:hover {
		color: var(--text-primary, #fff);
		background: var(--surface, #252530);
	}

	.toolbar-btn.active {
		color: var(--accent-primary, #22c55e);
	}

	.log-container {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-tertiary, #666);
	}

	.empty-state p {
		margin: 0;
	}

	.empty-state .hint {
		margin-top: 4px;
		font-size: 10px;
		opacity: 0.7;
	}

	.log-entry {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 12px;
		border-left: 2px solid var(--event-color, #666);
		margin-left: 12px;
	}

	.log-entry:hover {
		background: var(--surface, #252530);
	}

	.event-time {
		color: var(--text-tertiary, #666);
		font-size: 10px;
		min-width: 80px;
	}

	.event-icon {
		color: var(--event-color, #666);
		font-size: 12px;
		min-width: 16px;
		text-align: center;
	}

	.event-type {
		color: var(--event-color, #666);
		font-weight: 600;
		min-width: 100px;
	}

	.event-node {
		color: var(--text-secondary, #888);
		font-size: 10px;
		padding: 1px 4px;
		background: var(--surface, #252530);
		border-radius: 3px;
	}

	.event-agent {
		color: var(--accent-secondary, #3b82f6);
		font-size: 10px;
	}

	.event-progress {
		color: var(--accent-primary, #22c55e);
		font-size: 10px;
		font-weight: 600;
	}

	.event-error {
		color: var(--status-error, #ef4444);
		font-size: 10px;
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Scrollbar */
	.log-container::-webkit-scrollbar {
		width: 6px;
	}

	.log-container::-webkit-scrollbar-track {
		background: transparent;
	}

	.log-container::-webkit-scrollbar-thumb {
		background: var(--surface-border, #2a2a3a);
		border-radius: 3px;
	}

	.log-container::-webkit-scrollbar-thumb:hover {
		background: var(--text-tertiary, #666);
	}
</style>
