<script lang="ts">
	import type {
		AgentRuntimeStatus,
		ExecutionProgress,
		LoadedSkillInfo
	} from '$lib/services/mission-executor';
	import type { MCPRuntimeTool } from '$lib/services/mcp-runtime';
	import Icon from './Icon.svelte';
	import { summarizeTaskRows, type TaskStatusRow } from '$lib/services/execution-task-rows';

	interface Props {
		executionProgress: ExecutionProgress;
		nodeCount: number;
		executionDuration: string;
		mcpConnectedCount: number;
		mcpTools: MCPRuntimeTool[];
		runtimeAgents: AgentRuntimeStatus[];
		currentTaskSkills: LoadedSkillInfo[];
		taskRows?: TaskStatusRow[];
		mcpDetailOpen: boolean;
		copyPromptCollapsed: boolean;
		copyToClipboard: (text: string, successMessage: string) => void;
	}

	let {
		executionProgress,
		nodeCount,
		executionDuration,
		mcpConnectedCount,
		mcpTools,
		runtimeAgents,
		currentTaskSkills,
		taskRows = [],
		mcpDetailOpen = $bindable(),
		copyPromptCollapsed = $bindable(),
		copyToClipboard
	}: Props = $props();

	let missionTaskCount = $derived(executionProgress.mission?.tasks?.length || nodeCount);
	let missionCompletedTaskCount = $derived(
		executionProgress.mission?.tasks?.filter((task) => task.status === 'completed').length || 0
	);
	let taskSummary = $derived.by(() => summarizeTaskRows(taskRows));
	let taskBuckets = $derived.by(() => [
		{
			key: 'completed',
			label: 'Done',
			count: taskSummary.completed,
			tasks: taskRows.filter((task) => task.status === 'completed'),
			dot: 'bg-status-success',
			tone: 'text-status-success'
		},
		{
			key: 'running',
			label: 'Active',
			count: taskSummary.running,
			tasks: taskRows.filter((task) => task.status === 'running'),
			dot: 'bg-sky-400',
			tone: 'text-sky-300'
		},
		{
			key: 'pending',
			label: 'Queued',
			count: taskSummary.pending,
			tasks: taskRows.filter((task) => task.status === 'pending' || task.status === 'blocked'),
			dot: 'bg-amber-300',
			tone: 'text-amber-300'
		},
		{
			key: 'failed',
			label: 'Failed',
			count: taskSummary.failed,
			tasks: taskRows.filter((task) => task.status === 'failed'),
			dot: 'bg-status-error',
			tone: 'text-status-error'
		}
	]);
	let missionTitle = $derived(executionProgress.mission?.name || 'Canvas execution');
	let activeTaskLabel = $derived(
		executionProgress.currentTaskName ||
		executionProgress.currentTaskMessage ||
			(executionProgress.status === 'completed' ? 'Execution complete' : 'Waiting for next task')
	);
	let providerRuntimeStatus = $derived.by(() => {
		const multiPack = executionProgress.multiLLMExecution;
		if (!multiPack?.enabled) return [];

		return multiPack.providers.map((provider) => ({
			provider,
			assignment: multiPack.assignments[provider.id],
			status: runtimeAgents.find((agent) => agent.agentId === provider.id)?.status || 'assigned'
		}));
	});

	function progressDotClass(status: ExecutionProgress['status']): string {
		if (status === 'completed') return 'bg-status-success';
		if (status === 'failed') return 'bg-status-error';
		if (status === 'partial') return 'bg-status-warning';
		if (status === 'running' || status === 'creating') return 'bg-sky-400 animate-pulse';
		if (status === 'paused') return 'bg-blue-400';
		return 'bg-text-tertiary';
	}

	function progressTextClass(status: ExecutionProgress['status']): string {
		if (status === 'completed') return 'text-status-success';
		if (status === 'failed') return 'text-status-error';
		if (status === 'partial') return 'text-status-warning';
		if (status === 'running' || status === 'creating') return 'text-sky-300';
		if (status === 'paused') return 'text-blue-300';
		return 'text-text-tertiary';
	}

	function taskDotClass(status: TaskStatusRow['status']): string {
		if (status === 'completed') return 'bg-status-success';
		if (status === 'running') return 'bg-sky-400';
		if (status === 'failed') return 'bg-status-error';
		if (status === 'blocked') return 'bg-status-warning';
		return 'bg-text-tertiary';
	}
</script>

<div class="rounded-lg border border-surface-border bg-bg-primary/65 p-4">
	<div class="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
		<div class="min-w-0">
			<div class="font-mono text-[10px] uppercase tracking-[0.18em] text-text-tertiary">Mission Trace</div>
			<div class="mt-1 truncate text-base font-semibold text-text-primary">{missionTitle}</div>
			<div class="mt-1 truncate text-xs font-mono text-text-tertiary">{activeTaskLabel}</div>
			<div class="mt-2 flex flex-wrap items-center gap-1.5">
				<span class="rounded border border-surface-border bg-bg-secondary px-2 py-1 text-[10px] font-mono text-text-secondary">
					<span class="text-text-tertiary">tasks</span>
					<span class="ml-1 font-semibold tabular-nums text-text-primary">{missionCompletedTaskCount}/{missionTaskCount}</span>
				</span>
				<span class="rounded border border-surface-border bg-bg-secondary px-2 py-1 text-[10px] font-mono text-text-secondary">
					<span class="text-text-tertiary">elapsed</span>
					<span class="ml-1 font-semibold tabular-nums text-text-primary">{executionDuration}</span>
				</span>
				<span class="rounded border border-surface-border bg-bg-secondary px-2 py-1 text-[10px] font-mono text-text-secondary">
					<span class="text-text-tertiary">mcp</span>
					<span class="ml-1 font-semibold {mcpConnectedCount > 0 ? 'text-accent-primary' : 'text-text-primary'}">
						{mcpConnectedCount > 0 ? mcpConnectedCount : 'local'}
					</span>
				</span>
			</div>
		</div>
		<div class="justify-self-start rounded-md border border-surface-border bg-bg-secondary px-3 py-2 text-right sm:justify-self-end">
			<div class="text-2xl font-semibold leading-none tabular-nums text-text-primary">
				{executionProgress.progress}<span class="ml-0.5 text-sm font-medium text-text-tertiary">%</span>
			</div>
			<div class="mt-1 flex items-center justify-end gap-1.5">
				<span class="h-1.5 w-1.5 rounded-full {progressDotClass(executionProgress.status)}"></span>
				<span class="text-[10px] font-mono uppercase tracking-[0.14em] {progressTextClass(executionProgress.status)}">{executionProgress.status}</span>
			</div>
		</div>
	</div>

	<div class="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface">
		<div
			class="execution-progress-fill h-full rounded-full transition-all duration-500 ease-out"
			class:bg-accent-primary={executionProgress.status === 'completed'}
			class:bg-status-warning={executionProgress.status === 'partial'}
			class:bg-vibe-teal={executionProgress.status === 'running' || executionProgress.status === 'creating'}
			class:bg-blue-500={executionProgress.status === 'paused'}
			class:bg-status-error={executionProgress.status === 'failed'}
			class:bg-gray-500={executionProgress.status === 'cancelled'}
			style="width: {executionProgress.progress}%"
		></div>
	</div>

	{#if taskRows.length > 0}
		<div class="mt-3 rounded-md border border-surface-border bg-bg-secondary/85 px-3 py-2">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="min-w-0">
					<div class="flex min-w-0 items-center gap-2">
						<span class="shrink-0 text-[10px] font-mono uppercase tracking-[0.14em] text-text-tertiary">Task flow</span>
						<div class="flex max-w-full items-center gap-1.5 overflow-hidden">
							{#each taskRows.slice(0, 16) as task}
								<span
									class="h-2 w-2 shrink-0 rounded-full {taskDotClass(task.status)}"
									title={`#${task.index} ${task.title} - ${task.status}`}
								></span>
							{/each}
							{#if taskRows.length > 16}
								<span class="text-[10px] font-mono text-text-tertiary">+{taskRows.length - 16}</span>
							{/if}
						</div>
						<span class="shrink-0 text-xs font-semibold tabular-nums text-text-primary">
							{taskSummary.completed}/{taskRows.length}
						</span>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4" aria-label="Task state summary">
					{#each taskBuckets as bucket}
						<div class="task-bucket relative">
							<button
								type="button"
								class="task-bucket-trigger w-full rounded-md border border-surface-border bg-bg-primary px-2 py-1.5 text-right outline-none transition-colors hover:border-accent-primary/30 focus-visible:border-accent-primary"
								aria-label={`${bucket.count} ${bucket.label} tasks`}
							>
								<div class="flex items-center justify-end gap-1.5">
									<span class="h-1.5 w-1.5 rounded-full {bucket.dot}"></span>
									<span class="text-sm font-semibold leading-none tabular-nums text-text-primary">{bucket.count}</span>
								</div>
								<div class="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.08em] {bucket.tone}">
									{bucket.label}
								</div>
							</button>
							<div class="task-bucket-popover">
								<div class="mb-1 flex items-center justify-between gap-3">
									<span class="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] {bucket.tone}">
										{bucket.label}
									</span>
									<span class="text-[10px] font-mono text-text-tertiary">{bucket.count}</span>
								</div>
								{#if bucket.tasks.length > 0}
									<div class="space-y-1">
										{#each bucket.tasks.slice(0, 6) as task}
											<div class="min-w-0 rounded border border-surface-border bg-bg-secondary px-2 py-1.5">
												<div class="truncate text-xs font-medium text-text-primary">#{task.index} {task.title}</div>
												{#if task.message}
													<div class="mt-0.5 truncate text-[10px] text-text-tertiary">{task.message}</div>
												{/if}
												{#if task.skills.length > 0}
													<div class="mt-1 truncate text-[10px] font-mono text-text-tertiary">
														{task.skills.slice(0, 3).join(' / ')}
													</div>
												{/if}
											</div>
										{/each}
										{#if bucket.tasks.length > 6}
											<div class="text-[10px] font-mono text-text-tertiary">+{bucket.tasks.length - 6} more</div>
										{/if}
									</div>
								{:else}
									<div class="rounded border border-surface-border bg-bg-secondary px-2 py-2 text-xs text-text-tertiary">
										No tasks in this state.
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if executionProgress.multiLLMExecution?.enabled}
		{@const multiPack = executionProgress.multiLLMExecution}
		<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-surface-border pt-3">
			<span class="text-[10px] font-mono uppercase tracking-[0.14em] text-text-tertiary">Providers</span>
			<span class="rounded-md border border-vibe-teal/20 bg-vibe-teal/10 px-2 py-1 text-[11px] font-semibold text-vibe-teal">
				{multiPack.strategy}
			</span>
			{#each providerRuntimeStatus as item}
				<span class="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-surface-border bg-bg-secondary px-2 py-1 text-[11px] text-text-secondary">
					<span
						class="h-1.5 w-1.5 shrink-0 rounded-full"
						class:bg-yellow-400={item.status === 'running'}
						class:bg-green-400={item.status === 'completed'}
						class:bg-red-400={item.status === 'failed'}
						class:bg-text-tertiary={!['running', 'completed', 'failed'].includes(item.status)}
					></span>
					<span class="font-semibold text-text-primary">{item.provider.label}</span>
					<span class="truncate text-text-tertiary">{item.provider.model}</span>
					<span class="text-vibe-teal">{item.assignment?.taskIds?.length || 0}</span>
				</span>
			{/each}
		</div>
	{/if}
</div>

{#if mcpConnectedCount > 0}
	<button
		class="mt-2 text-[10px] font-mono text-text-tertiary hover:text-accent-primary transition-colors text-left"
		onclick={() => (mcpDetailOpen = !mcpDetailOpen)}
	>
		{mcpDetailOpen ? '\u25BE' : '\u25B8'} {mcpTools.length} tools across {mcpConnectedCount} MCP{mcpConnectedCount > 1 ? 's' : ''}
	</button>
	{#if mcpDetailOpen}
		<div class="mt-1 pl-2 border-l border-accent-primary/30 space-y-0.5">
			{#each [...new Map(mcpTools.map((tool) => [tool.mcpName, tool])).keys()] as mcpName}
				{@const tools = mcpTools.filter((tool) => tool.mcpName === mcpName)}
				<div class="text-[10px] font-mono">
					<span class="text-accent-primary">{mcpName}</span>
					<span class="text-text-tertiary">: {tools.map((tool) => tool.toolName).join(', ')}</span>
				</div>
			{/each}
		</div>
	{/if}
{/if}

<style>
	.execution-progress-fill {
		background-image: linear-gradient(
			135deg,
			rgb(255 255 255 / 0.32) 0 18%,
			transparent 18% 50%,
			rgb(255 255 255 / 0.2) 50% 68%,
			transparent 68% 100%
		);
		background-size: 20px 20px;
	}

	.task-bucket-popover {
		position: absolute;
		right: 0;
		top: calc(100% + 8px);
		z-index: 20;
		display: none;
		width: min(280px, 72vw);
		border: 1px solid var(--border);
		border-radius: 6px;
		background: rgb(var(--bg-rgb) / 0.98);
		padding: 10px;
		text-align: left;
		box-shadow:
			0 22px 60px rgb(0 0 0 / 0.45),
			0 0 0 1px rgb(255 255 255 / 0.04);
	}

	.task-bucket:hover .task-bucket-popover,
	.task-bucket:focus-within .task-bucket-popover {
		display: block;
	}
</style>

{#if executionProgress.executionPrompt && !executionProgress.multiLLMExecution?.enabled}
	<div class="mt-3 border border-accent-primary/30 rounded-lg overflow-hidden">
		<div
			onclick={() => (copyPromptCollapsed = !copyPromptCollapsed)}
			onkeydown={(event) => event.key === 'Enter' && (copyPromptCollapsed = !copyPromptCollapsed)}
			role="button"
			tabindex="0"
			class="w-full flex items-center justify-between px-3 py-2 bg-accent-primary/10 hover:bg-accent-primary/15 transition-colors cursor-pointer"
		>
			<div class="flex items-center gap-2">
				<svg class="w-4 h-4 text-accent-primary transition-transform {copyPromptCollapsed ? '' : 'rotate-90'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
				<span class="text-xs font-mono text-accent-primary uppercase tracking-wider">Single-LLM Prompt</span>
			</div>
			<button
				class="px-3 py-1 bg-accent-primary hover:bg-accent-primary-hover text-bg-primary text-xs font-mono transition-all flex items-center gap-2"
				onclick={(event) => {
					event.stopPropagation();
					copyToClipboard(executionProgress.executionPrompt || '', 'Copied single-LLM prompt');
				}}
			>
				<Icon name="copy" size={14} class="shrink-0" />
				Copy
			</button>
		</div>
		{#if !copyPromptCollapsed}
			<div class="p-3 bg-accent-primary/5">
				<div class="max-h-32 overflow-y-auto bg-bg-primary p-2 border border-surface-border text-xs font-mono text-text-secondary select-text">
					<pre class="whitespace-pre-wrap break-all">{(executionProgress.executionPrompt || '').slice(0, 500)}{(executionProgress.executionPrompt || '').length > 500 ? '...' : ''}</pre>
				</div>
				<p class="mt-2 text-xs text-text-tertiary">
					Optional fallback only. Direct auto-run does not require copy/paste.
				</p>
			</div>
		{/if}
	</div>
{:else if executionProgress.loadedSkills && executionProgress.loadedSkills.length > 0}
	<div class="mt-2 flex items-center justify-between gap-2 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
		<span>Skill at work</span>
		<span>{currentTaskSkills.length > 0 ? 'Live now' : `${executionProgress.loadedSkills.length} loaded`}</span>
	</div>
{:else if executionProgress.missionId}
	<div class="mt-2 p-2 bg-surface-secondary text-xs">
		<div class="flex items-center justify-between gap-2">
			<span class="text-text-tertiary">Mission ID:</span>
			<code class="text-accent-primary font-mono select-all">{executionProgress.missionId}</code>
		</div>
	</div>
{/if}

{#if executionProgress.loadedSkills && executionProgress.loadedSkills.length > 0}
	<div class="mt-1 flex items-center gap-3 px-3 py-2 bg-indigo-500/10 border border-indigo-500/30">
		<div class="relative">
			{#if currentTaskSkills.length > 0}
				<svg class="w-5 h-5 text-indigo-400 animate-[hammer_0.4s_ease-in-out_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
				</svg>
				<span class="absolute -top-0.5 -right-0.5 w-1 h-1 bg-amber-400 animate-ping"></span>
				<span class="absolute -bottom-0.5 -left-0.5 w-1 h-1 bg-indigo-300 animate-ping" style="animation-delay: 0.2s"></span>
			{:else}
				<svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
				</svg>
			{/if}
		</div>
		<div class="flex-1 flex items-center gap-2">
			{#if currentTaskSkills.length > 0}
				<span class="text-xs font-mono text-indigo-200 font-medium">{currentTaskSkills[0].name}</span>
				<span class="text-xs text-indigo-400/60">working...</span>
			{:else}
				<span class="text-xs font-mono text-indigo-400">{executionProgress.loadedSkills.length} skills loaded</span>
			{/if}
		</div>
		<span class="px-2 py-0.5 bg-indigo-500/30 text-xs font-mono text-indigo-300">{executionProgress.loadedSkills.length}</span>
	</div>
{/if}
