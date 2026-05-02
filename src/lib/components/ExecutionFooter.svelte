<script lang="ts">
	import type { ExecutionProgress } from '$lib/services/mission-executor';

	interface Props {
		executionProgress: ExecutionProgress | null;
		isRunning: boolean;
		isPaused: boolean;
		isTerminal: boolean;
		canCancel: boolean;
		canPause: boolean;
		canResume: boolean;
		canRun: boolean;
		currentNodeCount: number;
		formatTime: (timestamp: string | Date) => string;
		onCancel: () => void;
		onPause: () => void;
		onResume: () => void;
		onClose: () => void;
		onRun: () => void;
	}

	let {
		executionProgress,
		isRunning,
		isPaused,
		isTerminal,
		canCancel,
		canPause,
		canResume,
		canRun,
		currentNodeCount,
		formatTime,
		onCancel,
		onPause,
		onResume,
		onClose,
		onRun
	}: Props = $props();
</script>

<div class="px-6 py-5 border-t border-surface-border bg-bg-secondary flex justify-between items-center gap-4 flex-wrap">
	<div class="flex items-center gap-2 text-sm text-text-tertiary font-mono">
		{#if executionProgress?.endTime}
			Finished at {formatTime(executionProgress.endTime)}
		{:else if executionProgress?.startTime}
			Started at {formatTime(executionProgress.startTime)}
		{:else}
			Ready to run
		{/if}
	</div>
	<div class="flex gap-2 items-center">
		{#if canCancel}
			<button
				onclick={onCancel}
				class="px-4 py-2.5 rounded-md text-sm font-medium text-status-error border border-status-error/40 hover:border-status-error/70 hover:bg-status-error/10 transition-all"
			>
				Cancel
			</button>
		{/if}

		{#if canPause}
			<button
				onclick={onPause}
				class="px-4 py-2.5 rounded-md text-sm font-medium text-blue-400 border border-blue-400/40 hover:border-blue-400/70 hover:bg-blue-400/10 transition-all"
			>
				Pause
			</button>
		{/if}
		{#if canResume}
			<button
				onclick={onResume}
				class="px-4 py-2.5 rounded-md text-sm font-medium text-blue-400 border border-blue-400/40 hover:border-blue-400/70 hover:bg-blue-400/10 transition-all"
			>
				Resume
			</button>
		{/if}

		{#if !isRunning && !isPaused}
			<button
				onclick={onClose}
				class="px-4 py-2.5 rounded-md text-sm font-medium text-text-secondary border border-surface-border bg-bg-primary hover:border-text-tertiary hover:text-text-primary transition-all"
			>
				Close
			</button>
		{/if}

		<button
			onclick={onRun}
			disabled={!canRun}
			class="inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed {isRunning
				? 'border-vibe-teal/60 bg-vibe-teal/15 text-vibe-teal shadow-[0_0_30px_-10px_rgba(47,202,148,0.9)]'
				: 'border-accent-primary/30 bg-accent-primary text-accent-fg shadow-[0_10px_28px_-18px_rgba(47,202,148,0.9)] hover:opacity-90'} {!canRun && !isRunning ? 'opacity-40' : ''}"
			title={isTerminal
				? 'This mission is complete. Inspect logs here instead of starting over.'
				: currentNodeCount === 0
					? 'No nodes to execute'
					: ''}
		>
			{#if isRunning}
				<span class="relative flex h-2.5 w-2.5">
					<span class="absolute inline-flex h-full w-full rounded-full bg-vibe-teal opacity-60 animate-ping-slow"></span>
					<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-vibe-teal"></span>
				</span>
				<span>Running now</span>
			{:else if executionProgress?.status === 'completed'}
				Completed
			{:else if executionProgress?.status === 'failed'}
				Failed
			{:else if executionProgress?.status === 'cancelled'}
				Cancelled
			{:else}
				Run Workflow
			{/if}
		</button>
	</div>
</div>
