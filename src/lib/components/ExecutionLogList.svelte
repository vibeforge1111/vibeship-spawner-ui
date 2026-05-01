<script lang="ts">
	import type { MissionLog } from '$lib/services/mcp-client';
	import type { ExecutionStatus, TaskTransitionEvent } from '$lib/services/mission-executor';
	import { toasts } from '$lib/stores/toast.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		logs: MissionLog[];
		isRunning: boolean;
		status?: ExecutionStatus;
		transitions?: TaskTransitionEvent[];
		formatTime?: (timestamp: string | Date) => string;
		getTransitionBadge?: (state: TaskTransitionEvent['state']) => string;
	}

	let { logs, isRunning, status }: Props = $props();
	let logsContainer = $state<HTMLDivElement | undefined>(undefined);

	function formatTime(dateStr: string | Date): string {
		const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function copyAllLogs(): void {
		const logText = logs.map((log) => `${formatTime(log.created_at)}  ${formatLogMessage(log.message)}`).join('\n');
		navigator.clipboard.writeText(logText);
		toasts.success('Logs copied to clipboard');
	}

	function copyLogMessage(message: string): void {
		navigator.clipboard.writeText(formatLogMessage(message));
		toasts.success('Copied');
	}

	function formatLogMessage(message: string): string {
		return message
			.replace(/\[MissionControl\]\s*/g, '')
			.replace(/\s*\((mission-[^)]+)\)\.?$/g, '')
			.replace(/^Progress:\s*/i, '')
			.trim();
	}

	function getLogDotClass(type: MissionLog['type']): string {
		switch (type) {
			case 'complete':
				return 'bg-accent-primary';
			case 'error':
				return 'bg-status-error';
			case 'start':
				return 'bg-vibe-teal';
			case 'handoff':
				return 'bg-status-warning';
			default:
				return 'bg-text-tertiary';
		}
	}

	$effect(() => {
		if (logs.length > 0 && logsContainer) {
			logsContainer.scrollTop = logsContainer.scrollHeight;
		}
	});
</script>

<div class="flex-1 flex flex-col min-h-0 border-t border-surface-border">
	<div class="flex items-center justify-between px-4 py-3 bg-bg-secondary border-b border-surface-border sticky top-0 z-10">
		<div class="flex items-center gap-2">
			<svg class="w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
			</svg>
			<span class="text-xs font-mono text-text-secondary uppercase tracking-[0.16em]">Trace Log</span>
			{#if logs.length > 0}
				<span class="rounded border border-surface-border bg-bg-primary px-1.5 py-0.5 text-xs font-mono text-text-tertiary">{logs.length}</span>
			{/if}
		</div>
		{#if logs.length > 0}
			<button
				onclick={copyAllLogs}
				class="inline-flex items-center gap-1 rounded-md border border-surface-border px-2 py-1 text-xs text-text-tertiary transition-all hover:border-vibe-teal/50 hover:text-text-secondary"
			>
				<Icon name="copy" size={13} class="shrink-0" />
				Copy
			</button>
		{/if}
	</div>

	<div bind:this={logsContainer} class="flex-1 overflow-y-auto bg-bg-primary p-3 font-mono text-sm select-text">
		{#if logs.length === 0}
			<div class="flex flex-col items-center justify-center h-full py-8 text-text-tertiary">
				{#if isRunning}
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 bg-vibe-teal animate-pulse"></div>
						<span>{status === 'creating' ? 'Creating mission...' : 'Starting execution...'}</span>
					</div>
				{:else}
					<svg class="w-8 h-8 mb-2 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16m-7 6h7" />
					</svg>
					<p class="text-sm">Click "Run Workflow" to start execution</p>
					<p class="text-xs text-text-muted mt-1">Logs will appear here</p>
				{/if}
			</div>
		{:else}
			<div class="space-y-0.5">
				{#each logs as log}
					<div class="group -mx-2 grid cursor-text grid-cols-[72px_8px_minmax(0,1fr)_20px] items-start gap-3 px-2 py-1.5 text-text-secondary transition-colors hover:bg-vibe-teal/5">
						<span class="select-text text-xs tabular-nums text-text-tertiary">
							{formatTime(log.created_at)}
						</span>
						<span class="mt-1.5 h-1.5 w-1.5 rounded-full {getLogDotClass(log.type)}"></span>
						<span class="select-text break-words leading-relaxed">{formatLogMessage(log.message)}</span>
						<button
							onclick={() => copyLogMessage(log.message)}
							class="rounded p-1 text-xs text-text-tertiary opacity-0 transition-all hover:bg-bg-secondary hover:text-vibe-teal group-hover:opacity-100"
							title="Copy this log"
						>
							<Icon name="copy" size={13} class="shrink-0" />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
