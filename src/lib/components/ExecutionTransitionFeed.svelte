<script lang="ts">
	import type { TaskTransitionEvent } from '$lib/services/mission-executor';

	interface Props {
		transitions: TaskTransitionEvent[];
		formatTime: (timestamp: string | Date) => string;
		getTransitionBadge: (state: TaskTransitionEvent['state']) => string;
	}

	let { transitions, formatTime, getTransitionBadge }: Props = $props();
	const visibleTransitions = $derived(transitions.slice(-5).reverse());
</script>

{#if transitions.length > 0}
	<div class="px-4 py-3 border-b border-surface-border bg-bg-secondary">
		<div class="mb-2 flex items-center justify-between gap-3">
			<div class="flex items-center gap-2">
				<div class="h-2 w-2 bg-vibe-teal animate-pulse"></div>
				<span class="text-xs font-mono text-text-secondary uppercase tracking-wider">Build Activity</span>
			</div>
			<span class="text-[10px] font-mono text-text-tertiary">
				{transitions.length} checkpoint{transitions.length === 1 ? '' : 's'}
			</span>
		</div>
		<div class="grid gap-1.5">
			{#each visibleTransitions as item}
				<div class="border border-surface-border bg-bg-primary px-3 py-2">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<div class="flex flex-wrap items-center gap-2">
								<span class="px-1.5 py-0.5 text-[10px] font-mono uppercase {getTransitionBadge(item.state)}">
									{item.state}
								</span>
								{#if item.agentLabel}
									<span class="text-[10px] font-mono text-vibe-teal">{item.agentLabel}</span>
								{/if}
								{#if item.taskName}
									<span class="truncate text-xs font-mono text-text-primary">{item.taskName}</span>
								{/if}
							</div>
							<div class="mt-1 text-xs text-text-secondary break-words">{item.message}</div>
						</div>
						<div class="shrink-0 text-right">
							<div class="text-[10px] font-mono text-text-tertiary">{formatTime(item.timestamp)}</div>
							{#if typeof item.progress === 'number'}
								<div class="mt-1 text-[10px] font-mono text-vibe-teal">{item.progress}%</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
