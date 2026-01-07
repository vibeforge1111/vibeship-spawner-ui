<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import {
		mcpStore,
		filteredDefinitions,
		connectedInstances,
		pendingFeedbackCount,
		initializeMCPStore,
		createInstance,
		connectInstance,
		disconnectInstance,
		removeInstance,
		setFilterCategory,
		setSearchQuery,
		processAllFeedback,
		type MCPState
	} from '$lib/stores/mcps.svelte';
	import type { MCPDefinition, MCPInstance, MCPCategory, MCPConnectionStatus } from '$lib/types/mcp';

	let state = $state<MCPState>({
		definitions: [],
		loadingDefinitions: false,
		instances: [],
		loadingInstances: false,
		pendingFeedback: [],
		processedFeedback: [],
		feedbackLoading: false,
		skillBindings: [],
		teamBindings: [],
		selectedMCPId: null,
		filterCategory: 'all',
		searchQuery: '',
		error: null
	});

	let definitions = $state<MCPDefinition[]>([]);
	let instances = $state<MCPInstance[]>([]);
	let feedbackCount = $state(0);

	// Tabs
	let activeTab = $state<'discover' | 'connected' | 'feedback'>('discover');

	// Modal state
	let showConnectModal = $state(false);
	let selectedDefinition = $state<MCPDefinition | null>(null);
	let connecting = $state(false);

	$effect(() => {
		const unsub1 = mcpStore.subscribe((s) => (state = s));
		const unsub2 = filteredDefinitions.subscribe((d) => (definitions = d));
		const unsub3 = connectedInstances.subscribe((i) => (instances = i));
		const unsub4 = pendingFeedbackCount.subscribe((c) => (feedbackCount = c));
		return () => {
			unsub1();
			unsub2();
			unsub3();
			unsub4();
		};
	});

	onMount(() => {
		initializeMCPStore();
	});

	// Category icons
	function getCategoryIcon(category: MCPCategory): string {
		switch (category) {
			case 'feedback':
				return 'message-circle';
			case 'tool':
				return 'wrench';
			case 'data':
				return 'database';
			case 'integration':
				return 'plug';
			case 'automation':
				return 'cpu';
			case 'monitoring':
				return 'activity';
			default:
				return 'box';
		}
	}

	function getCategoryColor(category: MCPCategory): string {
		switch (category) {
			case 'feedback':
				return 'text-green-400 bg-green-500/10 border-green-500/30';
			case 'tool':
				return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
			case 'data':
				return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
			case 'integration':
				return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
			case 'automation':
				return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
			case 'monitoring':
				return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
			default:
				return 'text-text-secondary bg-bg-secondary border-surface-border';
		}
	}

	function getStatusColor(status: MCPConnectionStatus): string {
		switch (status) {
			case 'connected':
				return 'text-green-400';
			case 'connecting':
				return 'text-yellow-400';
			case 'error':
				return 'text-red-400';
			default:
				return 'text-text-tertiary';
		}
	}

	function getStatusIcon(status: MCPConnectionStatus): string {
		switch (status) {
			case 'connected':
				return 'check-circle';
			case 'connecting':
				return 'loader';
			case 'error':
				return 'alert-circle';
			default:
				return 'circle';
		}
	}

	async function handleConnect(definition: MCPDefinition) {
		selectedDefinition = definition;
		showConnectModal = true;
	}

	async function confirmConnect() {
		if (!selectedDefinition) return;

		connecting = true;
		try {
			const instance = createInstance(selectedDefinition.id);
			await connectInstance(instance.id);
			showConnectModal = false;
			selectedDefinition = null;
			activeTab = 'connected';
		} catch (e) {
			console.error('Failed to connect MCP:', e);
		} finally {
			connecting = false;
		}
	}

	async function handleDisconnect(instance: MCPInstance) {
		disconnectInstance(instance.id);
	}

	async function handleRemove(instance: MCPInstance) {
		removeInstance(instance.id);
	}

	async function handleProcessFeedback() {
		await processAllFeedback();
	}

	const categories: (MCPCategory | 'all')[] = [
		'all',
		'feedback',
		'tool',
		'data',
		'integration',
		'automation',
		'monitoring'
	];
</script>

<div class="min-h-screen bg-bg-primary flex flex-col">
	<Navbar />

	<main class="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center gap-3 mb-2">
				<h1 class="text-3xl font-serif text-text-primary">MCPs</h1>
				<span class="font-mono text-sm text-accent-secondary">connect()</span>
			</div>
			<p class="text-text-secondary">
				Connect MCP servers to enhance skills, feed data to Mind, and automate workflows.
			</p>
		</div>

		<!-- Stats Row -->
		<div class="grid grid-cols-4 gap-4 mb-8">
			<div class="border border-surface-border bg-bg-secondary p-4">
				<div class="text-2xl font-mono text-text-primary">{state.definitions.length}</div>
				<div class="text-xs text-text-tertiary">Available</div>
			</div>
			<div class="border border-surface-border bg-bg-secondary p-4">
				<div class="text-2xl font-mono text-green-400">{instances.length}</div>
				<div class="text-xs text-text-tertiary">Connected</div>
			</div>
			<div class="border border-surface-border bg-bg-secondary p-4">
				<div class="text-2xl font-mono text-text-primary">
					{state.skillBindings.length + state.teamBindings.length}
				</div>
				<div class="text-xs text-text-tertiary">Bindings</div>
			</div>
			<div class="border border-surface-border bg-bg-secondary p-4">
				<div class="text-2xl font-mono" class:text-yellow-400={feedbackCount > 0}>
					{feedbackCount}
				</div>
				<div class="text-xs text-text-tertiary">Pending Feedback</div>
			</div>
		</div>

		<!-- Tabs -->
		<div class="flex items-center gap-2 mb-6">
			<button
				onclick={() => (activeTab = 'discover')}
				class="px-4 py-2 font-mono text-sm border transition-all"
				class:bg-accent-primary={activeTab === 'discover'}
				class:text-bg-primary={activeTab === 'discover'}
				class:border-accent-primary={activeTab === 'discover'}
				class:text-text-secondary={activeTab !== 'discover'}
				class:border-surface-border={activeTab !== 'discover'}
			>
				Discover
			</button>
			<button
				onclick={() => (activeTab = 'connected')}
				class="px-4 py-2 font-mono text-sm border transition-all"
				class:bg-accent-primary={activeTab === 'connected'}
				class:text-bg-primary={activeTab === 'connected'}
				class:border-accent-primary={activeTab === 'connected'}
				class:text-text-secondary={activeTab !== 'connected'}
				class:border-surface-border={activeTab !== 'connected'}
			>
				Connected
				{#if instances.length > 0}
					<span class="ml-1 opacity-60">({instances.length})</span>
				{/if}
			</button>
			<button
				onclick={() => (activeTab = 'feedback')}
				class="px-4 py-2 font-mono text-sm border transition-all"
				class:bg-accent-primary={activeTab === 'feedback'}
				class:text-bg-primary={activeTab === 'feedback'}
				class:border-accent-primary={activeTab === 'feedback'}
				class:text-text-secondary={activeTab !== 'feedback'}
				class:border-surface-border={activeTab !== 'feedback'}
			>
				Feedback
				{#if feedbackCount > 0}
					<span class="ml-1 text-yellow-400">({feedbackCount})</span>
				{/if}
			</button>
		</div>

		<!-- Discover Tab -->
		{#if activeTab === 'discover'}
			<!-- Search & Filter -->
			<div class="flex items-center gap-4 mb-6">
				<div class="flex-1 relative">
					<input
						type="text"
						placeholder="Search MCPs..."
						value={state.searchQuery}
						oninput={(e) => setSearchQuery(e.currentTarget.value)}
						class="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-surface-border text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
					/>
					<Icon
						name="search"
						size={16}
						class="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
					/>
				</div>

				<div class="flex gap-1">
					{#each categories as category}
						<button
							onclick={() => setFilterCategory(category)}
							class="px-3 py-2 text-xs font-mono border transition-all"
							class:bg-accent-primary={state.filterCategory === category}
							class:text-bg-primary={state.filterCategory === category}
							class:border-accent-primary={state.filterCategory === category}
							class:text-text-secondary={state.filterCategory !== category}
							class:border-surface-border={state.filterCategory !== category}
						>
							{category === 'all' ? 'All' : category}
						</button>
					{/each}
				</div>
			</div>

			<!-- MCP Grid -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each definitions as definition}
					{@const isConnected = state.instances.some((i) => i.definitionId === definition.id)}
					<div class="border border-surface-border bg-bg-secondary hover:border-text-tertiary transition-all">
						<!-- Header -->
						<div class="p-4 border-b border-surface-border">
							<div class="flex items-start gap-3">
								<div
									class="w-10 h-10 rounded flex items-center justify-center {getCategoryColor(
										definition.category
									)}"
								>
									<Icon name={getCategoryIcon(definition.category)} size={20} />
								</div>
								<div class="flex-1 min-w-0">
									<h3 class="font-medium text-text-primary">{definition.name}</h3>
									<p class="text-xs text-text-tertiary font-mono">{definition.category}</p>
								</div>
								{#if isConnected}
									<span class="text-green-400">
										<Icon name="check-circle" size={16} />
									</span>
								{/if}
							</div>
						</div>

						<!-- Body -->
						<div class="p-4">
							<p class="text-sm text-text-secondary line-clamp-2 mb-3">{definition.description}</p>

							<!-- Capabilities -->
							<div class="flex flex-wrap gap-1 mb-3">
								{#each definition.capabilities.slice(0, 3) as capability}
									<span
										class="px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary border border-surface-border"
									>
										{capability}
									</span>
								{/each}
								{#if definition.capabilities.length > 3}
									<span class="px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary">
										+{definition.capabilities.length - 3}
									</span>
								{/if}
							</div>

							<!-- Tools count -->
							<div class="flex items-center justify-between text-xs text-text-tertiary mb-3">
								<span class="flex items-center gap-1">
									<Icon name="wrench" size={12} />
									{definition.tools.length} tools
								</span>
								{#if definition.feedbackTypes?.length}
									<span class="flex items-center gap-1 text-green-400">
										<Icon name="message-circle" size={12} />
										Feeds Mind
									</span>
								{/if}
							</div>

							<!-- Connect Button -->
							<button
								onclick={() => handleConnect(definition)}
								disabled={isConnected}
								class="w-full py-2 font-mono text-sm border transition-all"
								class:bg-accent-primary={!isConnected}
								class:text-bg-primary={!isConnected}
								class:border-accent-primary={!isConnected}
								class:hover:bg-accent-primary-hover={!isConnected}
								class:bg-bg-tertiary={isConnected}
								class:text-text-tertiary={isConnected}
								class:border-surface-border={isConnected}
								class:cursor-not-allowed={isConnected}
							>
								{isConnected ? 'Connected' : 'Connect'}
							</button>
						</div>
					</div>
				{/each}
			</div>

			{#if definitions.length === 0}
				<div class="border border-surface-border bg-bg-secondary p-12 text-center">
					<div class="text-4xl mb-4 opacity-50">~</div>
					<h3 class="text-lg text-text-primary mb-2">No MCPs found</h3>
					<p class="text-sm text-text-secondary">Try adjusting your search or filters.</p>
				</div>
			{/if}
		{/if}

		<!-- Connected Tab -->
		{#if activeTab === 'connected'}
			{#if state.instances.length === 0}
				<div class="border border-surface-border bg-bg-secondary p-12 text-center">
					<div class="text-4xl mb-4 opacity-50">
						<Icon name="plug" size={48} />
					</div>
					<h3 class="text-lg text-text-primary mb-2">No MCPs connected</h3>
					<p class="text-sm text-text-secondary mb-4">
						Connect MCPs to enhance your skills and feed data to Mind.
					</p>
					<button
						onclick={() => (activeTab = 'discover')}
						class="px-4 py-2 font-mono text-sm bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
					>
						Discover MCPs
					</button>
				</div>
			{:else}
				<div class="space-y-4">
					{#each state.instances as instance}
						{@const definition = state.definitions.find((d) => d.id === instance.definitionId)}
						<div class="border border-surface-border bg-bg-secondary">
							<div class="p-4 flex items-center gap-4">
								<!-- Status & Icon -->
								<div class="relative">
									<div
										class="w-12 h-12 rounded flex items-center justify-center {definition
											? getCategoryColor(definition.category)
											: 'bg-bg-tertiary'}"
									>
										<Icon name={definition ? getCategoryIcon(definition.category) : 'box'} size={24} />
									</div>
									<span
										class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center bg-bg-primary {getStatusColor(
											instance.status
										)}"
									>
										<Icon
											name={getStatusIcon(instance.status)}
											size={10}
											class={instance.status === 'connecting' ? 'animate-spin' : ''}
										/>
									</span>
								</div>

								<!-- Info -->
								<div class="flex-1 min-w-0">
									<h3 class="font-medium text-text-primary">{instance.name}</h3>
									<div class="flex items-center gap-3 text-xs text-text-tertiary">
										<span class="font-mono">{instance.status}</span>
										{#if instance.usageCount > 0}
											<span>Used {instance.usageCount} times</span>
										{/if}
										{#if instance.feedbackCount > 0}
											<span class="text-green-400">{instance.feedbackCount} feedback sent</span>
										{/if}
									</div>
								</div>

								<!-- Attachments -->
								<div class="flex items-center gap-2">
									{#if instance.attachedToSkills.length > 0}
										<span
											class="px-2 py-1 text-xs font-mono text-accent-primary border border-accent-primary/30 bg-accent-primary/10"
										>
											{instance.attachedToSkills.length} skills
										</span>
									{/if}
									{#if instance.attachedToTeams.length > 0}
										<span
											class="px-2 py-1 text-xs font-mono text-pink-400 border border-pink-500/30 bg-pink-500/10"
										>
											{instance.attachedToTeams.length} teams
										</span>
									{/if}
								</div>

								<!-- Actions -->
								<div class="flex items-center gap-2">
									{#if instance.status === 'connected'}
										<button
											onclick={() => handleDisconnect(instance)}
											class="px-3 py-1.5 text-xs font-mono text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/10 transition-all"
										>
											Disconnect
										</button>
									{:else if instance.status === 'disconnected'}
										<button
											onclick={() => connectInstance(instance.id)}
											class="px-3 py-1.5 text-xs font-mono text-green-400 border border-green-500/30 hover:bg-green-500/10 transition-all"
										>
											Connect
										</button>
									{/if}
									<button
										onclick={() => handleRemove(instance)}
										class="px-3 py-1.5 text-xs font-mono text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-all"
									>
										Remove
									</button>
								</div>
							</div>

							<!-- Tools (collapsed) -->
							{#if definition}
								<div class="px-4 pb-4 border-t border-surface-border pt-3">
									<div class="text-xs text-text-tertiary mb-2">Tools:</div>
									<div class="flex flex-wrap gap-2">
										{#each definition.tools as tool}
											<span
												class="px-2 py-1 text-xs font-mono text-text-secondary bg-bg-primary border border-surface-border"
											>
												{tool.name}
											</span>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		<!-- Feedback Tab -->
		{#if activeTab === 'feedback'}
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<!-- Pending Feedback -->
				<div class="lg:col-span-2">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-lg font-medium text-text-primary">Pending Feedback</h2>
						{#if state.pendingFeedback.length > 0}
							<button
								onclick={handleProcessFeedback}
								class="px-4 py-2 text-xs font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
							>
								Process All
							</button>
						{/if}
					</div>

					{#if state.pendingFeedback.length === 0}
						<div class="border border-surface-border bg-bg-secondary p-12 text-center">
							<div class="text-4xl mb-4 opacity-50">
								<Icon name="inbox" size={48} />
							</div>
							<h3 class="text-lg text-text-primary mb-2">No pending feedback</h3>
							<p class="text-sm text-text-secondary">
								Feedback from MCPs will appear here to be processed and sent to Mind.
							</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each state.pendingFeedback as feedback}
								<div class="border border-yellow-500/30 bg-yellow-500/10 p-4">
									<div class="flex items-start gap-3">
										<span class="text-yellow-400">
											<Icon name="clock" size={16} />
										</span>
										<div class="flex-1">
											<p class="text-text-primary">{feedback.summary}</p>
											<div class="flex items-center gap-3 mt-2 text-xs text-text-tertiary">
												<span class="font-mono">{feedback.mcpName}</span>
												<span>{feedback.feedbackType}</span>
												<span class="capitalize">{feedback.sentiment}</span>
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Recent Processed -->
				<div>
					<h2 class="text-lg font-medium text-text-primary mb-4">Recently Processed</h2>

					{#if state.processedFeedback.length === 0}
						<div class="border border-surface-border bg-bg-secondary p-6 text-center">
							<p class="text-sm text-text-tertiary">No processed feedback yet.</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each state.processedFeedback.slice(0, 10) as feedback}
								<div class="border border-green-500/30 bg-green-500/5 p-3">
									<p class="text-sm text-text-secondary line-clamp-2">{feedback.summary}</p>
									<div class="flex items-center justify-between mt-2 text-xs">
										<span class="text-text-tertiary font-mono">{feedback.mcpName}</span>
										<span class="text-green-400">+{feedback.confidenceImpact.toFixed(2)}</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</main>

	<Footer />
</div>

<!-- Connect Modal -->
{#if showConnectModal && selectedDefinition}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<div class="absolute inset-0 bg-black/60" onclick={() => (showConnectModal = false)}></div>

		<div class="relative w-full max-w-md bg-bg-secondary border border-surface-border shadow-xl">
			<div class="p-4 border-b border-surface-border flex items-center justify-between">
				<h2 class="text-lg font-medium text-text-primary">Connect {selectedDefinition.name}</h2>
				<button
					onclick={() => (showConnectModal = false)}
					class="text-text-tertiary hover:text-text-secondary"
				>
					<Icon name="x" size={20} />
				</button>
			</div>

			<div class="p-4">
				<p class="text-sm text-text-secondary mb-4">{selectedDefinition.description}</p>

				{#if selectedDefinition.requiresAuth}
					<div class="p-3 bg-yellow-500/10 border border-yellow-500/30 mb-4">
						<p class="text-xs text-yellow-400">
							This MCP requires authentication ({selectedDefinition.authType}).
						</p>
					</div>
				{/if}

				<div class="mb-4">
					<h4 class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">
						Available Tools
					</h4>
					<div class="flex flex-wrap gap-2">
						{#each selectedDefinition.tools as tool}
							<span
								class="px-2 py-1 text-xs font-mono text-text-secondary bg-bg-primary border border-surface-border"
							>
								{tool.name}
							</span>
						{/each}
					</div>
				</div>

				{#if selectedDefinition.feedbackTypes?.length}
					<div class="mb-4">
						<h4 class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">
							Feedback to Mind
						</h4>
						<div class="flex flex-wrap gap-2">
							{#each selectedDefinition.feedbackTypes as feedbackType}
								<span
									class="px-2 py-1 text-xs font-mono text-green-400 bg-green-500/10 border border-green-500/30"
								>
									{feedbackType}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="p-4 border-t border-surface-border flex items-center justify-end gap-2">
				<button
					onclick={() => (showConnectModal = false)}
					class="px-4 py-2 text-sm font-mono text-text-secondary border border-surface-border hover:border-text-tertiary transition-all"
				>
					Cancel
				</button>
				<button
					onclick={confirmConnect}
					disabled={connecting}
					class="px-4 py-2 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all disabled:opacity-50"
				>
					{connecting ? 'Connecting...' : 'Connect'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
