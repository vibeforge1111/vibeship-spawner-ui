<script lang="ts">
	import type { MissionLog } from '$lib/services/mcp-client';
	import type { ExecutionStatus, TaskTransitionEvent } from '$lib/services/mission-executor';
	import { toasts } from '$lib/stores/toast.svelte';

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
		const logText = logs.map((log) => `[${formatTime(log.created_at)}] ${log.message}`).join('\n');
		navigator.clipboard.writeText(logText);
		toasts.success('Logs copied to clipboard');
	}

	function copyLogMessage(message: string): void {
		navigator.clipboard.writeText(message);
		toasts.success('Copied');
	}

	$effect(() => {
		if (logs.length > 0 && logsContainer) {
			logsContainer.scrollTop = logsContainer.scrollHeight;
		}
	});
</script>

<div class="flex-1 flex flex-col min-h-0 border-t border-surface-border">
	<div class="flex items-center justify-between px-4 py-2 bg-bg-tertiary border-b border-surface-border sticky top-0 z-10">
		<div class="flex items-center gap-2">
			<svg class="w-4 h-4 text-vibe-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
			</svg>
			<span class="text-xs font-mono text-text-secondary uppercase tracking-wider">Execution Logs</span>
			{#if logs.length > 0}
				<span class="px-1.5 py-0.5 bg-vibe-teal/20 text-xs font-mono text-vibe-teal">{logs.length}</span>
			{/if}
		</div>
		{#if logs.length > 0}
			<button
				onclick={copyAllLogs}
				class="text-xs text-text-tertiary hover:text-text-secondary px-2 py-1 border border-surface-border hover:border-vibe-teal/50 rounded-md transition-all flex items-center gap-1"
			>
				<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
				</svg>
				Copy
			</button>
		{/if}
	</div>

	<div bind:this={logsContainer} class="flex-1 overflow-y-auto p-3 font-mono text-sm bg-bg-primary select-text">
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
			<div class="space-y-1">
				{#each logs as log}
					<div class="grid grid-cols-[72px_minmax(0,1fr)_20px] items-start gap-3 cursor-text hover:bg-vibe-teal/5 px-2 py-1.5 -mx-2 group transition-colors text-text-secondary">
						<span class="text-xs text-text-tertiary flex-shrink-0 select-text tabular-nums">
							{formatTime(log.created_at)}
						</span>
						<span class="select-text break-words leading-relaxed">{log.message}</span>
						<button
							onclick={() => copyLogMessage(log.message)}
							class="opacity-0 group-hover:opacity-100 text-xs text-text-tertiary hover:text-vibe-teal transition-all px-1"
							title="Copy this log"
						>
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
