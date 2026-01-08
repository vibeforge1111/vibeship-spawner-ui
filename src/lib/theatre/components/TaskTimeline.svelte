<script lang="ts">
	/**
	 * Task Timeline Component
	 *
	 * Task 8: Understanding - Visual timeline of task execution.
	 * Shows when tasks started, how long they took, and their status.
	 */

	import { theatreStore } from '../theatre-store.svelte';
	import type { TheatreLog } from '../types';

	// Props
	interface Props {
		maxItems?: number;
	}

	let { maxItems = 10 }: Props = $props();

	// Reactive state
	let logs = $derived(theatreStore.logs);
	let characters = $derived(theatreStore.characters);

	// Group logs by task
	interface TaskGroup {
		taskId: string;
		taskName: string;
		agentId: string;
		agentName: string;
		agentColor: string;
		startTime: Date;
		endTime: Date | null;
		status: 'running' | 'success' | 'error';
		logs: TheatreLog[];
	}

	function groupByTask(): TaskGroup[] {
		const groups = new Map<string, TaskGroup>();

		for (const log of logs) {
			if (!log.agentId) continue;

			const agent = characters.find(c => c.id === log.agentId);
			const key = `${log.agentId}-${log.message.slice(0, 20)}`;

			if (!groups.has(key)) {
				groups.set(key, {
					taskId: key,
					taskName: log.message.slice(0, 50),
					agentId: log.agentId,
					agentName: agent?.name || log.agentId,
					agentColor: agent?.color || '#00ffff',
					startTime: log.timestamp,
					endTime: null,
					status: log.type === 'success' ? 'success' : log.type === 'error' ? 'error' : 'running',
					logs: [log]
				});
			} else {
				const group = groups.get(key)!;
				group.logs.push(log);
				group.endTime = log.timestamp;
				if (log.type === 'success') group.status = 'success';
				if (log.type === 'error') group.status = 'error';
			}
		}

		return Array.from(groups.values())
			.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
			.slice(0, maxItems);
	}

	let taskGroups = $derived(groupByTask());

	function formatDuration(start: Date, end: Date | null): string {
		const endTime = end || new Date();
		const ms = endTime.getTime() - start.getTime();
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		return `${(ms / 60000).toFixed(1)}m`;
	}

	function getStatusIcon(status: TaskGroup['status']): string {
		switch (status) {
			case 'success': return '✓';
			case 'error': return '✕';
			default: return '▸';
		}
	}
</script>

<div class="task-timeline">
	<div class="timeline-header">
		<h4>Task Timeline</h4>
		<span class="task-count">{taskGroups.length} tasks</span>
	</div>

	<div class="timeline-content">
		{#if taskGroups.length === 0}
			<div class="timeline-empty">
				<div class="empty-icon">◇</div>
				<span>No tasks yet</span>
			</div>
		{:else}
			{#each taskGroups as group}
				<div
					class="task-item"
					class:running={group.status === 'running'}
					class:success={group.status === 'success'}
					class:error={group.status === 'error'}
					style="--agent-color: {group.agentColor}"
				>
					<div class="task-connector"></div>

					<div class="task-dot">
						<span class="status-icon">{getStatusIcon(group.status)}</span>
					</div>

					<div class="task-content">
						<div class="task-header">
							<span class="agent-badge" style="background: {group.agentColor}">{group.agentName}</span>
							<span class="task-duration">{formatDuration(group.startTime, group.endTime)}</span>
						</div>
						<div class="task-name">{group.taskName}</div>
						<div class="task-time">{group.startTime.toLocaleTimeString()}</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.task-timeline {
		display: flex;
		flex-direction: column;
		background: var(--surface-secondary, #111116);
		height: 100%;
	}

	.timeline-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--surface-border, #1a1a2e);
	}

	.timeline-header h4 {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary, #a0a0a0);
		margin: 0;
	}

	.task-count {
		font-size: 0.625rem;
		font-family: monospace;
		color: var(--text-muted, #5a5a6d);
	}

	.timeline-content {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 1rem;
	}

	.timeline-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted, #5a5a6d);
		gap: 0.5rem;
	}

	.empty-icon {
		font-size: 2rem;
		opacity: 0.3;
	}

	.task-item {
		position: relative;
		display: flex;
		align-items: flex-start;
		padding: 0.75rem 0;
		padding-left: 1.5rem;
	}

	.task-connector {
		position: absolute;
		left: 0.4rem;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--surface-border, #1a1a2e);
	}

	.task-item:last-child .task-connector {
		display: none;
	}

	.task-dot {
		position: absolute;
		left: 0;
		top: 0.75rem;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-tertiary, #1a1a2e);
		border: 2px solid var(--agent-color);
	}

	.task-item.running .task-dot {
		animation: pulse 1.5s infinite;
	}

	.task-item.success .task-dot {
		background: var(--status-success, #10B981);
		border-color: var(--status-success, #10B981);
	}

	.task-item.error .task-dot {
		background: var(--status-error, #EF4444);
		border-color: var(--status-error, #EF4444);
	}

	@keyframes pulse {
		0%, 100% { transform: scale(1); opacity: 1; }
		50% { transform: scale(1.1); opacity: 0.7; }
	}

	.status-icon {
		font-size: 0.625rem;
		color: var(--agent-color);
	}

	.task-item.success .status-icon,
	.task-item.error .status-icon {
		color: white;
	}

	.task-content {
		flex: 1;
		min-width: 0;
	}

	.task-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.agent-badge {
		padding: 0.125rem 0.375rem;
		font-size: 0.625rem;
		font-family: monospace;
		color: var(--text-inverse, #0a0a0f);
		font-weight: 600;
	}

	.task-duration {
		font-size: 0.625rem;
		font-family: monospace;
		color: var(--accent-primary, #00ffff);
	}

	.task-name {
		font-size: 0.75rem;
		color: var(--text-primary, #e5e5e5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.task-time {
		font-size: 0.625rem;
		font-family: monospace;
		color: var(--text-muted, #5a5a6d);
		margin-top: 0.25rem;
	}
</style>
