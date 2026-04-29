<script lang="ts">
	import type {
		AgentRuntimeStatus,
		ExecutionProgress,
		LoadedSkillInfo
	} from '$lib/services/mission-executor';
	import type { MCPRuntimeTool } from '$lib/services/mcp-runtime';

	interface Props {
		executionProgress: ExecutionProgress;
		nodeCount: number;
		executionDuration: string;
		mcpConnectedCount: number;
		mcpTools: MCPRuntimeTool[];
		runtimeAgents: AgentRuntimeStatus[];
		currentTaskSkills: LoadedSkillInfo[];
		mcpDetailOpen: boolean;
		multiLLMPanelCollapsed: boolean;
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
		mcpDetailOpen = $bindable(),
		multiLLMPanelCollapsed = $bindable(),
		copyPromptCollapsed = $bindable(),
		copyToClipboard
	}: Props = $props();

	let missionTaskCount = $derived(executionProgress.mission?.tasks?.length || nodeCount);
	let missionCompletedTaskCount = $derived(
		executionProgress.mission?.tasks?.filter((task) => task.status === 'completed').length || 0
	);
	let missionProgressLabel = $derived(
		missionTaskCount > 0 ? `${missionCompletedTaskCount}/${missionTaskCount} tasks done` : `${nodeCount} nodes`
	);
</script>

<div class="flex items-center justify-between mb-3">
	<span class="font-mono text-xs text-text-tertiary tracking-widest uppercase">Overall Progress</span>
	<span class="text-base font-mono font-medium text-text-primary tabular-nums">{executionProgress.progress}%</span>
</div>
<div class="w-full h-1.5 rounded-full bg-surface overflow-hidden">
	<div
		class="h-full rounded-full transition-all duration-500 ease-out"
		class:bg-accent-primary={executionProgress.status === 'completed'}
		class:bg-status-warning={executionProgress.status === 'partial'}
		class:bg-vibe-teal={executionProgress.status === 'running' || executionProgress.status === 'creating'}
		class:bg-blue-500={executionProgress.status === 'paused'}
		class:bg-status-error={executionProgress.status === 'failed'}
		class:bg-gray-500={executionProgress.status === 'cancelled'}
		style="width: {executionProgress.progress}%"
	></div>
</div>

<div class="flex justify-between mt-3 text-sm text-text-tertiary font-mono">
	<span>
		{missionProgressLabel}{#if mcpConnectedCount > 0}
			&bull; <span class="text-accent-primary">{mcpConnectedCount} MCP{mcpConnectedCount > 1 ? 's' : ''}</span>
		{/if}
	</span>
	<span class="tabular-nums">{executionDuration}</span>
</div>
{#if mcpConnectedCount > 0}
	<button
		class="mt-1 text-[10px] font-mono text-text-tertiary hover:text-accent-primary transition-colors text-left"
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

{#if executionProgress.multiLLMExecution?.enabled}
	{@const multiPack = executionProgress.multiLLMExecution}
	{@const activeProvider =
		multiPack.providers.find((provider) =>
			runtimeAgents.some((agent) => agent.agentId === provider.id && agent.status === 'running')
		) || multiPack.providers[0]}
	{@const activeAgent = activeProvider
		? runtimeAgents.find((agent) => agent.agentId === activeProvider.id)
		: null}
	<div class="mt-3 border border-vibe-teal/30">
		<div
			onclick={() => (multiLLMPanelCollapsed = !multiLLMPanelCollapsed)}
			onkeydown={(event) => event.key === 'Enter' && (multiLLMPanelCollapsed = !multiLLMPanelCollapsed)}
			role="button"
			tabindex="0"
			class="w-full flex items-center justify-between px-3 py-2 bg-vibe-teal/10 hover:bg-vibe-teal/15 transition-colors cursor-pointer"
		>
			<div class="flex items-center gap-2">
				<svg class="w-4 h-4 text-vibe-teal transition-transform {multiLLMPanelCollapsed ? '' : 'rotate-90'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
				<span class="text-xs font-mono text-vibe-teal uppercase tracking-wider">Agent Activity</span>
				<span class="text-[10px] font-mono text-text-tertiary">
					{multiPack.strategy} &bull; {multiPack.providers.length} provider(s)
				</span>
			</div>
			{#if activeProvider}
				<div class="text-right">
					<div class="text-[10px] font-mono text-vibe-teal uppercase tracking-wider">
						{activeAgent?.status || 'assigned'}
					</div>
					<div class="text-[11px] font-mono text-text-primary">
						{activeProvider.label}
					</div>
				</div>
			{/if}
		</div>
		{#if !multiLLMPanelCollapsed}
			<div class="p-3 bg-vibe-teal/5 space-y-2">
				{#each multiPack.providers as provider}
					{@const assignment = multiPack.assignments[provider.id]}
					<div class="p-2 border border-surface-border bg-bg-primary">
						<div class="flex items-center justify-between gap-2">
							<div class="text-xs">
								<div class="font-mono text-text-primary flex items-center gap-1.5">
									{provider.label} ({provider.id})
									{#if runtimeAgents.some((agent) => agent.agentId === provider.id && agent.status === 'running')}
										<span class="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
									{:else if runtimeAgents.some((agent) => agent.agentId === provider.id && agent.status === 'completed')}
										<span class="inline-block w-1.5 h-1.5 rounded-full bg-green-400"></span>
									{:else if runtimeAgents.some((agent) => agent.agentId === provider.id && agent.status === 'failed')}
										<span class="inline-block w-1.5 h-1.5 rounded-full bg-red-400"></span>
									{/if}
								</div>
								<div class="text-text-tertiary">
									{provider.model} &bull; {assignment?.mode || 'execute'} &bull; {assignment?.taskIds?.length || 0} task(s)
								</div>
							</div>
							<span class="text-[10px] font-mono text-vibe-teal">
								{runtimeAgents.find((agent) => agent.agentId === provider.id)?.status || 'assigned'}
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

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
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
				</svg>
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
{:else if executionProgress.missionId}
	<div class="mt-2 p-2 bg-surface-secondary text-xs">
		<div class="flex items-center justify-between gap-2">
			<span class="text-text-tertiary">Mission ID:</span>
			<code class="text-accent-primary font-mono select-all">{executionProgress.missionId}</code>
		</div>
	</div>
{/if}

{#if executionProgress.loadedSkills && executionProgress.loadedSkills.length > 0}
	<div class="mt-3 flex items-center gap-3 px-3 py-2 bg-indigo-500/10 border border-indigo-500/30">
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
