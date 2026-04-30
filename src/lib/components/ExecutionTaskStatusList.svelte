<script lang="ts">
	import type { ExecutionStatus, ReconciliationResult } from '$lib/services/mission-executor';
	import {
		getNextTaskRow,
		summarizeTaskRows,
		type TaskStatusRow
	} from '$lib/services/execution-task-rows';
	import { getTaskBadgeClass, getTaskRowClass } from '$lib/services/execution-panel-formatting';

	interface ReworkTask {
		name: string;
		retry: number;
		maxRetries: number;
	}

	interface Props {
		taskRows: TaskStatusRow[];
		reworkTasks: Map<string, ReworkTask>;
		status: ExecutionStatus;
		isRunning: boolean;
		reconciliation: ReconciliationResult | null;
		error: string | null;
		nodeCount: number;
		executionDuration: string;
		onResumePartial: () => void;
		onDismissPartial: () => void;
	}

	let {
		taskRows,
		reworkTasks,
		status,
		isRunning,
		reconciliation,
		error,
		nodeCount,
		executionDuration,
		onResumePartial,
		onDismissPartial
	}: Props = $props();

	let taskSummary = $derived.by(() => summarizeTaskRows(taskRows));
	let nextTask = $derived.by(() => getNextTaskRow(taskRows));
	let taskCompletionLabel = $derived(`${taskSummary.completed}/${taskRows.length} done`);
</script>

{#if taskRows.length > 0}
	<div class="mt-4 border border-surface-border overflow-hidden">
		<div class="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-bg-tertiary border-b border-surface-border">
			<div>
				<span class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Task Status</span>
				<div class="mt-0.5 text-[11px] font-mono text-accent-primary">
					{taskCompletionLabel}
				</div>
				{#if nextTask && isRunning}
					<div class="mt-0.5 text-[11px] font-mono text-vibe-teal truncate max-w-[36rem]">
						Active {nextTask.index}/{taskRows.length}: {nextTask.title}
					</div>
				{/if}
			</div>
			<div class="grid grid-cols-4 gap-1 text-right">
				<div class="min-w-16 border border-accent-primary/20 bg-accent-primary/5 px-2 py-1">
					<div class="text-sm font-mono font-bold text-accent-primary">{taskSummary.completed}</div>
					<div class="text-[10px] font-mono text-accent-primary/70 uppercase">Done</div>
				</div>
				<div class="min-w-16 border border-vibe-teal/20 bg-vibe-teal/5 px-2 py-1">
					<div class="text-sm font-mono font-bold text-vibe-teal">{taskSummary.running}</div>
					<div class="text-[10px] font-mono text-vibe-teal/70 uppercase">Run</div>
				</div>
				<div class="min-w-16 border border-amber-500/20 bg-amber-500/5 px-2 py-1">
					<div class="text-sm font-mono font-bold text-status-warning">{taskSummary.pending}</div>
					<div class="text-[10px] font-mono text-status-warning/70 uppercase">Wait</div>
				</div>
				<div class="min-w-16 border border-status-error/20 bg-status-error/5 px-2 py-1">
					<div class="text-sm font-mono font-bold text-status-error">{taskSummary.failed}</div>
					<div class="text-[10px] font-mono text-status-error/70 uppercase">Fail</div>
				</div>
			</div>
		</div>
		<div class="max-h-56 overflow-y-auto bg-bg-primary">
			{#each taskRows as task}
				<div class="px-3 py-2 border-b last:border-b-0 {getTaskRowClass(task.status)}">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="w-6 shrink-0 text-[10px] font-mono text-text-tertiary">#{task.index}</span>
								<span class="truncate text-xs font-mono text-text-primary">{task.title}</span>
							</div>
							{#if task.message && task.status === 'running'}
								<div class="mt-1 text-[11px] text-text-tertiary truncate">{task.message}</div>
							{/if}
							{#if task.skills.length > 0}
								<div class="mt-1 flex flex-wrap gap-1">
									{#each task.skills.slice(0, 4) as skill}
										<span class="rounded-full border border-surface-border bg-bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary">
											{skill}
										</span>
									{/each}
								</div>
							{/if}
						</div>
						<span class="px-1.5 py-0.5 border text-[10px] font-mono uppercase {getTaskBadgeClass(task.status)}">
							{task.status}
						</span>
					</div>
				</div>
			{/each}
		</div>
		{#if reworkTasks.size > 0}
			<div class="px-3 py-2 bg-orange-500/5 border-t border-orange-500/20">
				{#each [...reworkTasks.entries()] as [taskId, rework]}
					<div class="flex items-center gap-2 py-0.5">
						<span class="px-1.5 py-0.5 bg-orange-500/20 border border-orange-500/40 text-orange-400 text-[10px] font-mono uppercase tracking-wider">Rework</span>
						<span class="text-xs text-text-primary font-mono">{rework.name}</span>
						<span class="text-[10px] text-orange-400/60 font-mono">retry {rework.retry}/{rework.maxRetries}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

{#if status === 'completed'}
	<div class="mt-3 p-3 bg-accent-primary/10 border border-accent-primary/30 rounded-lg">
		<div class="flex items-center gap-2 mb-2">
			<div class="w-5 h-5 flex items-center justify-center bg-accent-primary/20 border border-accent-primary/50">
				<svg class="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="3" d="M5 13l4 4L19 7" />
				</svg>
			</div>
			<span class="text-accent-primary font-medium font-mono uppercase tracking-wide text-sm">Workflow Completed</span>
		</div>
		<p class="text-xs text-text-secondary">
			Successfully completed {taskSummary.completed} task{taskSummary.completed !== 1 ? 's' : ''} in {executionDuration}.
		</p>
	</div>
{:else if status === 'partial'}
	<div class="mt-3 p-3 bg-status-warning/10 border border-yellow-500/30">
		<div class="flex items-center gap-2 mb-2">
			<div class="w-5 h-5 flex items-center justify-center bg-status-warning/20 border border-yellow-500/50">
				<svg class="w-3 h-3 text-status-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.194-.833-2.964 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
				</svg>
			</div>
			<span class="text-status-warning font-medium font-mono uppercase tracking-wide text-sm">Mission Partially Complete</span>
		</div>
		{#if reconciliation}
			<p class="text-xs text-text-secondary">
				{reconciliation.completedTasks}/{reconciliation.totalTasks} tasks completed
				{#if reconciliation.failedTasks > 0}
					, {reconciliation.failedTasks} failed
				{/if}
			</p>
			{#if reconciliation.pendingTasks.length > 0}
				<div class="mt-2 text-xs text-status-warning/70">
					<span class="font-mono uppercase text-[10px] tracking-wider">Incomplete:</span>
					{#each reconciliation.pendingTasks as task}
						<div class="ml-2 mt-0.5 text-text-tertiary">- {task.title} <span class="text-status-warning/50">({task.status})</span></div>
					{/each}
				</div>
				<div class="mt-3 flex gap-2">
					<button
						class="px-3 py-1.5 bg-status-warning/20 border border-yellow-500/50 text-status-warning text-xs font-mono uppercase tracking-wider hover:bg-status-warning/30 transition-colors"
						onclick={onResumePartial}
					>
						Resume {reconciliation.pendingTasks.length} Pending Task{reconciliation.pendingTasks.length !== 1 ? 's' : ''}
					</button>
					<button
						class="px-3 py-1.5 bg-surface-secondary border border-surface-border text-text-secondary text-xs font-mono uppercase tracking-wider hover:bg-surface-hover transition-colors"
						onclick={onDismissPartial}
					>
						Dismiss
					</button>
				</div>
			{/if}
		{:else}
			<p class="text-xs text-text-secondary">
				Agent reported completion but some tasks were not finished.
			</p>
		{/if}
	</div>
{:else if status === 'failed'}
	<div class="mt-3 p-3 bg-status-error/10 border border-status-error/30 rounded-lg">
		<div class="flex items-center gap-2 mb-2">
			<div class="w-5 h-5 flex items-center justify-center bg-status-error/20 border border-red-500/50">
				<svg class="w-3 h-3 text-status-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="3" d="M6 6l12 12M6 18L18 6" />
				</svg>
			</div>
			<span class="text-status-error font-medium font-mono uppercase tracking-wide text-sm">Workflow Failed</span>
		</div>
		<p class="text-xs text-text-secondary">
			Completed {taskSummary.completed} of {taskRows.length || nodeCount} tasks before failure.
			{#if error}
				<br/>Error: {error}
			{/if}
		</p>
	</div>
{/if}
