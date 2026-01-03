<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import AgentCard from '$lib/components/AgentCard.svelte';
	import McpCard from '$lib/components/McpCard.svelte';
	import McpConnection from '$lib/components/McpConnection.svelte';
	import MissionBuilder from '$lib/components/MissionBuilder.svelte';
	import {
		stackStore,
		selectedAgents,
		selectedMcps,
		freeAgents,
		premiumAgents,
		recommendedAgents,
		allSkillIds,
		generatedConfig
	} from '$lib/stores/stack.svelte';

	let activeTab = $state<'agents' | 'mcps' | 'missions' | 'export'>('agents');
	let projectDescription = $state('');

	// Subscribe to stores
	let currentState = $state({
		agents: [],
		mcps: [],
		selectedAgentIds: [],
		selectedMcpIds: [],
		projectType: 'saas'
	});
	let currentSelectedAgents = $state([]);
	let currentSelectedMcps = $state([]);
	let currentFreeAgents = $state([]);
	let currentPremiumAgents = $state([]);
	let currentRecommendedAgents = $state([]);
	let currentAllSkillIds = $state([]);
	let currentGeneratedConfig = $state({});

	$effect(() => {
		const unsub1 = stackStore.subscribe((s) => (currentState = s));
		const unsub2 = selectedAgents.subscribe((a) => (currentSelectedAgents = a));
		const unsub3 = selectedMcps.subscribe((m) => (currentSelectedMcps = m));
		const unsub4 = freeAgents.subscribe((a) => (currentFreeAgents = a));
		const unsub5 = premiumAgents.subscribe((a) => (currentPremiumAgents = a));
		const unsub6 = recommendedAgents.subscribe((r) => (currentRecommendedAgents = r));
		const unsub7 = allSkillIds.subscribe((s) => (currentAllSkillIds = s));
		const unsub8 = generatedConfig.subscribe((c) => (currentGeneratedConfig = c));
		return () => {
			unsub1();
			unsub2();
			unsub3();
			unsub4();
			unsub5();
			unsub6();
			unsub7();
			unsub8();
		};
	});

	function applyRecommendations() {
		stackStore.selectAgents(currentRecommendedAgents);
	}

	function copyConfig() {
		navigator.clipboard.writeText(JSON.stringify(currentGeneratedConfig, null, 2));
	}

	function downloadConfig() {
		const blob = new Blob([JSON.stringify(currentGeneratedConfig, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'spawner-config.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	const projectTypes = [
		{ id: 'saas', label: 'SaaS', icon: '💼' },
		{ id: 'marketplace', label: 'Marketplace', icon: '🛒' },
		{ id: 'ai-app', label: 'AI App', icon: '🤖' },
		{ id: 'web3', label: 'Web3', icon: '⛓️' },
		{ id: 'tool', label: 'Developer Tool', icon: '🔧' },
		{ id: 'other', label: 'Other', icon: '📦' }
	];
</script>

<svelte:head>
	<title>Builder - Spawner</title>
</svelte:head>

<div class="min-h-screen bg-bg-primary">
	<!-- Header -->
	<header class="border-b border-surface-border bg-bg-secondary">
		<div class="max-w-6xl mx-auto px-6 py-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<a href="/" class="flex items-center gap-2">
						<img src="/logo.png" alt="vibeship" class="w-6 h-6" />
						<span class="text-text-primary">vibeship</span>
						<span class="text-accent-primary">spawner</span>
					</a>
					<span class="text-text-tertiary">/</span>
					<h1 class="text-lg font-medium text-text-primary">Builder</h1>
				</div>

				<div class="flex items-center gap-3">
					<a href="/skills" class="btn-ghost btn-sm">Skills</a>
					<a href="/canvas" class="btn-secondary btn-sm">Canvas</a>
				</div>
			</div>
		</div>
	</header>

	<div class="max-w-6xl mx-auto px-6 py-8">
		<!-- Project Type Selection -->
		<section class="mb-8">
			<h2 class="text-lg font-medium text-text-primary mb-4">What are you building?</h2>
			<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
				{#each projectTypes as type}
					<button
						class="p-4 border text-center transition-all {currentState.projectType === type.id
							? 'bg-accent-primary/10 border-accent-primary'
							: 'bg-bg-secondary border-surface-border hover:border-text-tertiary'}"
						onclick={() => stackStore.setProjectType(type.id)}
					>
						<div class="text-2xl mb-2">{type.icon}</div>
						<div class="text-sm font-medium text-text-primary">{type.label}</div>
					</button>
				{/each}
			</div>
		</section>

		<!-- MCP Connection -->
		<section class="mb-8">
			<div class="max-w-md">
				<McpConnection />
			</div>
		</section>

		<!-- Recommendations -->
		<section class="mb-8 p-4 bg-bg-secondary border border-surface-border">
			<div class="flex items-center justify-between">
				<div>
					<h3 class="font-medium text-text-primary mb-1">Recommended for {currentState.projectType}</h3>
					<p class="text-sm text-text-secondary">
						{currentRecommendedAgents.length} agents suggested based on your project type
					</p>
				</div>
				<button class="btn-primary btn-sm" onclick={applyRecommendations}>Apply Recommendations</button>
			</div>
		</section>

		<!-- Tabs -->
		<div class="flex gap-1 mb-6 p-1 bg-bg-tertiary w-fit">
			<button
				class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'agents'
					? 'bg-accent-primary text-bg-primary'
					: 'text-text-secondary hover:text-text-primary'}"
				onclick={() => (activeTab = 'agents')}
			>
				Agents ({currentSelectedAgents.length})
			</button>
			<button
				class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'mcps'
					? 'bg-accent-primary text-bg-primary'
					: 'text-text-secondary hover:text-text-primary'}"
				onclick={() => (activeTab = 'mcps')}
			>
				MCP Servers ({currentSelectedMcps.length})
			</button>
			<button
				class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'missions'
					? 'bg-accent-primary text-bg-primary'
					: 'text-text-secondary hover:text-text-primary'}"
				onclick={() => (activeTab = 'missions')}
			>
				Missions
			</button>
			<button
				class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'export'
					? 'bg-accent-primary text-bg-primary'
					: 'text-text-secondary hover:text-text-primary'}"
				onclick={() => (activeTab = 'export')}
			>
				Export
			</button>
		</div>

		<!-- Content -->
		{#if activeTab === 'agents'}
			<div class="space-y-8">
				<!-- Free Agents -->
				<div>
					<h3 class="text-sm font-semibold text-text-tertiary uppercase tracking-wide mb-4">
						Free Agents ({currentFreeAgents.length})
					</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#each currentFreeAgents as agent}
							<AgentCard
								{agent}
								selected={currentState.selectedAgentIds.includes(agent.id)}
								onToggle={() => stackStore.toggleAgent(agent.id)}
							/>
						{/each}
					</div>
				</div>

				<!-- Premium Agents -->
				<div>
					<h3 class="text-sm font-semibold text-text-tertiary uppercase tracking-wide mb-4">
						Premium Agents ({currentPremiumAgents.length})
					</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#each currentPremiumAgents as agent}
							<AgentCard
								{agent}
								selected={currentState.selectedAgentIds.includes(agent.id)}
								onToggle={() => stackStore.toggleAgent(agent.id)}
							/>
						{/each}
					</div>
				</div>
			</div>
		{:else if activeTab === 'mcps'}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				{#each currentState.mcps as mcp}
					<McpCard
						{mcp}
						selected={currentState.selectedMcpIds.includes(mcp.id)}
						onToggle={() => stackStore.toggleMcp(mcp.id)}
					/>
				{/each}
			</div>
		{:else if activeTab === 'missions'}
			<MissionBuilder />
		{:else if activeTab === 'export'}
			<div class="space-y-6">
				<!-- Summary -->
				<div class="p-6 bg-bg-secondary border border-surface-border">
					<h3 class="font-medium text-text-primary mb-4">Configuration Summary</h3>

					<div class="grid grid-cols-2 gap-6 mb-6">
						<div>
							<div class="text-sm text-text-tertiary mb-2">Selected Agents</div>
							<div class="flex flex-wrap gap-2">
								{#each currentSelectedAgents as agent}
									<span class="px-2 py-1 text-sm bg-bg-tertiary text-text-primary">
										{agent.icon} {agent.name}
									</span>
								{/each}
							</div>
						</div>
						<div>
							<div class="text-sm text-text-tertiary mb-2">Selected MCPs</div>
							<div class="flex flex-wrap gap-2">
								{#each currentSelectedMcps as mcp}
									<span class="px-2 py-1 text-sm bg-bg-tertiary text-text-primary">
										{mcp.icon} {mcp.name}
									</span>
								{/each}
							</div>
						</div>
					</div>

					<div>
						<div class="text-sm text-text-tertiary mb-2">Skills ({currentAllSkillIds.length})</div>
						<div class="flex flex-wrap gap-1">
							{#each currentAllSkillIds as skillId}
								<span class="px-1.5 py-0.5 text-xs font-mono bg-accent-primary/10 text-accent-primary">
									{skillId}
								</span>
							{/each}
						</div>
					</div>
				</div>

				<!-- Config Output -->
				<div class="p-6 bg-bg-secondary border border-surface-border">
					<div class="flex items-center justify-between mb-4">
						<h3 class="font-medium text-text-primary">Generated Configuration</h3>
						<div class="flex gap-2">
							<button class="btn-ghost btn-sm" onclick={copyConfig}>
								<Icon name="clipboard" size={14} />
								Copy
							</button>
							<button class="btn-primary btn-sm" onclick={downloadConfig}>
								<Icon name="download" size={14} />
								Download
							</button>
						</div>
					</div>

					<pre class="p-4 bg-bg-primary border border-surface-border text-sm font-mono text-text-secondary overflow-x-auto">{JSON.stringify(currentGeneratedConfig, null, 2)}</pre>
				</div>

				<!-- Next Steps -->
				<div class="p-6 bg-accent-primary/5 border border-accent-primary/20">
					<h3 class="font-medium text-text-primary mb-3">Next Steps</h3>
					<ol class="list-decimal list-inside space-y-2 text-sm text-text-secondary">
						<li>Download the configuration file above</li>
						<li>Save it to your project as <code class="px-1 py-0.5 bg-bg-tertiary font-mono text-xs">claude_code_config.json</code></li>
						<li>Install the MCP servers using the commands shown</li>
						<li>Run <code class="px-1 py-0.5 bg-bg-tertiary font-mono text-xs">claude</code> in your project directory</li>
					</ol>
				</div>
			</div>
		{/if}
	</div>
</div>
