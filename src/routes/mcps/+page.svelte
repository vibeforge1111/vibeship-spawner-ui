<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import {
		mcpStore,
		filteredRegistry,
		connectedInstances,
		pendingFeedbackCount,
		mcpCategories,
		initializeMCPStore,
		createInstance,
		connectInstance,
		disconnectInstance,
		removeInstance,
		setFilterCategory,
		setFilterSubcategory,
		setSearchQuery,
		processAllFeedback,
		type MCPState
	} from '$lib/stores/mcps.svelte';
	import type { MCPInstance, MCPConnectionStatus, MCPRegistryItem } from '$lib/types/mcp';

	let state = $state<MCPState>({
		registry: [],
		loadingRegistry: false,
		instances: [],
		loadingInstances: false,
		pendingFeedback: [],
		processedFeedback: [],
		feedbackLoading: false,
		skillBindings: [],
		teamBindings: [],
		selectedMCPId: null,
		filterCategory: 'all',
		filterSubcategory: null,
		searchQuery: '',
		error: null
	});

	let registry = $state<MCPRegistryItem[]>([]);
	let instances = $state<MCPInstance[]>([]);
	let feedbackCount = $state(0);
	let categories = $state<string[]>([]);

	// Tabs
	let activeTab = $state<'discover' | 'connected' | 'feedback'>('discover');

	// Modal state
	let showConnectModal = $state(false);
	let selectedMCP = $state<MCPRegistryItem | null>(null);
	let connecting = $state(false);

	// Search
	let searchInputEl: HTMLInputElement;

	$effect(() => {
		const unsub1 = mcpStore.subscribe((s) => (state = s));
		const unsub2 = filteredRegistry.subscribe((r) => (registry = r));
		const unsub3 = connectedInstances.subscribe((i) => (instances = i));
		const unsub4 = pendingFeedbackCount.subscribe((c) => (feedbackCount = c));
		const unsub5 = mcpCategories.subscribe((c) => (categories = c));
		return () => {
			unsub1();
			unsub2();
			unsub3();
			unsub4();
			unsub5();
		};
	});

	onMount(() => {
		initializeMCPStore();
	});

	// Category icons
	function getCategoryIcon(category: string): string {
		switch (category) {
			case 'Development':
				return 'code';
			case 'Databases':
				return 'database';
			case 'Cloud':
				return 'cloud';
			case 'AI':
				return 'cpu';
			case 'Communication':
				return 'message-circle';
			case 'Browser':
				return 'globe';
			case 'Finance':
				return 'dollar-sign';
			case 'Security':
				return 'shield';
			case 'Productivity':
				return 'briefcase';
			case 'Design':
				return 'pen-tool';
			case 'Media':
				return 'video';
			case 'CRM':
				return 'users';
			case 'Analytics':
				return 'bar-chart';
			case 'E-commerce':
				return 'shopping-cart';
			case 'CMS':
				return 'file';
			case 'Social':
				return 'share-2';
			case 'Location':
				return 'map-pin';
			case 'Utilities':
				return 'tool';
			case 'IoT':
				return 'wifi';
			case 'Marketing':
				return 'megaphone';
			case 'No-Code':
				return 'wand';
			case 'Legal':
				return 'scale';
			case 'HR':
				return 'building';
			case 'Product':
				return 'clipboard';
			case 'Blockchain':
				return 'link';
			case 'DeFi':
				return 'trending-up';
			case 'Trading':
				return 'activity';
			case 'Prediction Markets':
				return 'target';
			default:
				return 'box';
		}
	}

	function getCategoryColor(category: string): string {
		switch (category) {
			case 'Development':
				return 'text-blue-400';
			case 'Databases':
				return 'text-purple-400';
			case 'Cloud':
				return 'text-cyan-400';
			case 'AI':
				return 'text-pink-400';
			case 'Communication':
				return 'text-green-400';
			case 'Browser':
				return 'text-orange-400';
			case 'Finance':
				return 'text-yellow-400';
			case 'Security':
				return 'text-red-400';
			case 'Productivity':
				return 'text-indigo-400';
			case 'Design':
				return 'text-violet-400';
			case 'Media':
				return 'text-fuchsia-400';
			case 'CRM':
				return 'text-teal-400';
			case 'Analytics':
				return 'text-lime-400';
			case 'E-commerce':
				return 'text-amber-400';
			case 'CMS':
				return 'text-slate-400';
			case 'Social':
				return 'text-sky-400';
			case 'Location':
				return 'text-emerald-400';
			case 'Utilities':
				return 'text-stone-400';
			case 'IoT':
				return 'text-rose-400';
			case 'Marketing':
				return 'text-orange-500';
			case 'No-Code':
				return 'text-purple-500';
			case 'Legal':
				return 'text-gray-400';
			case 'HR':
				return 'text-blue-500';
			case 'Product':
				return 'text-green-500';
			case 'Blockchain':
				return 'text-indigo-500';
			case 'DeFi':
				return 'text-emerald-500';
			case 'Trading':
				return 'text-cyan-500';
			case 'Prediction Markets':
				return 'text-red-500';
			default:
				return 'text-text-secondary';
		}
	}

	function getCategoryBgColor(category: string): string {
		switch (category) {
			case 'Development':
				return 'bg-blue-500/10 border-blue-500/30';
			case 'Databases':
				return 'bg-purple-500/10 border-purple-500/30';
			case 'Cloud':
				return 'bg-cyan-500/10 border-cyan-500/30';
			case 'AI':
				return 'bg-pink-500/10 border-pink-500/30';
			case 'Communication':
				return 'bg-green-500/10 border-green-500/30';
			case 'Browser':
				return 'bg-orange-500/10 border-orange-500/30';
			case 'Finance':
				return 'bg-yellow-500/10 border-yellow-500/30';
			case 'Security':
				return 'bg-red-500/10 border-red-500/30';
			case 'Productivity':
				return 'bg-indigo-500/10 border-indigo-500/30';
			case 'Design':
				return 'bg-violet-500/10 border-violet-500/30';
			case 'Media':
				return 'bg-fuchsia-500/10 border-fuchsia-500/30';
			case 'CRM':
				return 'bg-teal-500/10 border-teal-500/30';
			case 'Analytics':
				return 'bg-lime-500/10 border-lime-500/30';
			case 'E-commerce':
				return 'bg-amber-500/10 border-amber-500/30';
			case 'CMS':
				return 'bg-slate-500/10 border-slate-500/30';
			case 'Social':
				return 'bg-sky-500/10 border-sky-500/30';
			case 'Location':
				return 'bg-emerald-500/10 border-emerald-500/30';
			case 'Utilities':
				return 'bg-stone-500/10 border-stone-500/30';
			case 'IoT':
				return 'bg-rose-500/10 border-rose-500/30';
			case 'Marketing':
				return 'bg-orange-500/10 border-orange-500/30';
			case 'No-Code':
				return 'bg-purple-500/10 border-purple-500/30';
			case 'Legal':
				return 'bg-gray-500/10 border-gray-500/30';
			case 'HR':
				return 'bg-blue-500/10 border-blue-500/30';
			case 'Product':
				return 'bg-green-500/10 border-green-500/30';
			case 'Blockchain':
				return 'bg-indigo-500/10 border-indigo-500/30';
			case 'DeFi':
				return 'bg-emerald-500/10 border-emerald-500/30';
			case 'Trading':
				return 'bg-cyan-500/10 border-cyan-500/30';
			case 'Prediction Markets':
				return 'bg-red-500/10 border-red-500/30';
			default:
				return 'bg-surface-active border-surface-border';
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

	async function handleConnect(mcp: MCPRegistryItem) {
		selectedMCP = mcp;
		showConnectModal = true;
	}

	async function confirmConnect() {
		if (!selectedMCP) return;

		connecting = true;
		try {
			const instance = createInstance(selectedMCP.id);
			await connectInstance(instance.id);
			showConnectModal = false;
			selectedMCP = null;
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

	function handleCategoryClick(category: string) {
		setFilterCategory(category);
		setFilterSubcategory(null);
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			setSearchQuery('');
			searchInputEl?.blur();
		}
	}

	// Get subcategories for current category
	function getSubcategoriesForCategory(category: string): string[] {
		return [
			...new Set(
				state.registry.filter((m) => m.category === category).map((m) => m.subcategory)
			)
		];
	}

	// Check if MCP is connected
	function isConnected(mcpId: string): boolean {
		return state.instances.some((i) => i.definitionId === mcpId);
	}

	// Get count for category
	function getCategoryCount(category: string): number {
		return state.registry.filter((m) => m.category === category).length;
	}
</script>

<div class="h-screen flex bg-bg-primary relative">
	<!-- Left Sidebar (Canvas-style) -->
	<aside class="w-64 border-r border-surface-border bg-bg-secondary flex flex-col z-10">
		<!-- Logo -->
		<div class="p-4 border-b border-surface-border">
			<a href="/" class="flex items-center gap-1.5">
				<img src="/logo.png" alt="vibeship" class="w-6 h-6" />
				<span class="font-serif text-[1.36rem] text-text-primary">vibeship</span>
				<span class="font-serif text-[1.36rem] text-accent-primary">spawner</span>
			</a>
		</div>

		<!-- Main Tabs -->
		<div class="p-3 border-b border-surface-border">
			<div class="flex p-0.5 border border-surface-border">
				<button
					class="flex-1 py-1.5 px-3 text-sm font-mono transition-all"
					class:bg-accent-primary={activeTab === 'discover'}
					class:text-bg-primary={activeTab === 'discover'}
					class:text-text-secondary={activeTab !== 'discover'}
					onclick={() => (activeTab = 'discover')}
				>
					Discover
				</button>
				<button
					class="flex-1 py-1.5 px-3 text-sm font-mono transition-all relative"
					class:bg-accent-secondary={activeTab === 'connected'}
					class:text-bg-primary={activeTab === 'connected'}
					class:text-text-secondary={activeTab !== 'connected'}
					onclick={() => (activeTab = 'connected')}
				>
					Connected
					{#if instances.length > 0}
						<span class="absolute -top-1 -right-1 w-4 h-4 text-[10px] bg-green-500 text-white rounded-full flex items-center justify-center">
							{instances.length}
						</span>
					{/if}
				</button>
			</div>
		</div>

		<!-- Search (in sidebar) -->
		{#if activeTab === 'discover'}
			<div class="p-3 border-b border-surface-border">
				<div class="relative flex items-center">
					<span class="absolute left-2.5 text-text-tertiary pointer-events-none">
						<Icon name="search" size={14} />
					</span>
					<input
						bind:this={searchInputEl}
						type="text"
						placeholder="Search MCPs..."
						value={state.searchQuery}
						oninput={(e) => setSearchQuery(e.currentTarget.value)}
						onkeydown={handleSearchKeydown}
						class="w-full pl-8 pr-8 py-2 bg-bg-primary border border-surface-border text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
					/>
					{#if state.searchQuery}
						<button
							onclick={() => setSearchQuery('')}
							class="absolute right-2 text-text-tertiary hover:text-text-secondary"
						>
							<Icon name="x" size={14} />
						</button>
					{/if}
				</div>
			</div>

			<!-- Categories List -->
			<div class="flex-1 overflow-y-auto">
				<!-- All MCPs -->
				<button
					onclick={() => handleCategoryClick('all')}
					class="w-full px-3 py-2.5 flex items-center gap-3 transition-all border-l-2"
					class:border-accent-primary={state.filterCategory === 'all'}
					class:bg-surface-active={state.filterCategory === 'all'}
					class:border-transparent={state.filterCategory !== 'all'}
					class:hover:bg-surface-active={state.filterCategory !== 'all'}
				>
					<div class="w-8 h-8 flex items-center justify-center bg-bg-primary border border-surface-border">
						<Icon name="layers" size={16} class="text-text-secondary" />
					</div>
					<div class="flex-1 text-left">
						<div class="text-sm font-medium text-text-primary">All MCPs</div>
						<div class="text-xs text-text-tertiary">{state.registry.length} available</div>
					</div>
				</button>

				<!-- Category Items -->
				{#each categories as category}
					{@const count = getCategoryCount(category)}
					{@const isActive = state.filterCategory === category}
					<button
						onclick={() => handleCategoryClick(category)}
						class="w-full px-3 py-2.5 flex items-center gap-3 transition-all border-l-2"
						class:border-accent-primary={isActive}
						class:bg-surface-active={isActive}
						class:border-transparent={!isActive}
						class:hover:bg-surface-active={!isActive}
					>
						<div class="w-8 h-8 flex items-center justify-center border {getCategoryBgColor(category)}">
							<Icon name={getCategoryIcon(category)} size={16} class={getCategoryColor(category)} />
						</div>
						<div class="flex-1 text-left">
							<div class="text-sm font-medium text-text-primary">{category}</div>
							<div class="text-xs text-text-tertiary">{count} MCPs</div>
						</div>
					</button>
				{/each}
			</div>
		{:else}
			<!-- Connected MCPs sidebar content -->
			<div class="flex-1 overflow-y-auto p-3">
				{#if state.instances.length === 0}
					<div class="text-center py-8">
						<div class="text-text-tertiary mb-2">
							<Icon name="plug" size={32} />
						</div>
						<p class="text-sm text-text-tertiary">No MCPs connected</p>
						<button
							onclick={() => (activeTab = 'discover')}
							class="mt-2 text-xs text-accent-primary hover:underline"
						>
							Discover MCPs
						</button>
					</div>
				{:else}
					<p class="text-xs text-text-tertiary font-mono mb-2">CONNECTED ({state.instances.length})</p>
					<div class="space-y-2">
						{#each state.instances as instance}
							{@const mcp = state.registry.find((m) => m.id === instance.definitionId)}
							<div class="p-2 bg-bg-primary border border-surface-border">
								<div class="flex items-center gap-2">
									<span class="{getStatusColor(instance.status)}">
										<Icon name={getStatusIcon(instance.status)} size={12} class={instance.status === 'connecting' ? 'animate-spin' : ''} />
									</span>
									<span class="text-sm text-text-primary truncate flex-1">{instance.name}</span>
								</div>
								{#if mcp}
									<p class="text-xs text-text-tertiary mt-1 truncate">{mcp.category}</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Footer Stats -->
		<div class="p-3 border-t border-surface-border">
			<div class="flex items-center justify-between text-xs font-mono text-text-tertiary">
				<span>{state.registry.length} available</span>
				<div class="flex items-center gap-2">
					<span class="flex items-center gap-1">
						<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
						{instances.length}
					</span>
					{#if feedbackCount > 0}
						<span class="flex items-center gap-1 text-yellow-400">
							<span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
							{feedbackCount}
						</span>
					{/if}
				</div>
			</div>
		</div>
	</aside>

	<!-- Main Content -->
	<main class="flex-1 flex flex-col overflow-hidden">
		<!-- Header Toolbar -->
		<header class="border-b border-surface-border bg-bg-secondary">
			<div class="h-12 flex items-center px-4 gap-4">
				<!-- Title -->
				<div class="flex items-center gap-2">
					<h1 class="text-lg font-serif text-text-primary">MCPs</h1>
					<span class="font-mono text-xs text-accent-secondary">connect()</span>
				</div>

				<div class="flex-1"></div>

				<!-- Stats -->
				<div class="flex items-center gap-4 text-xs font-mono">
					<div class="flex items-center gap-1.5">
						<span class="text-text-tertiary">Available:</span>
						<span class="text-text-primary">{state.registry.length}</span>
					</div>
					<div class="flex items-center gap-1.5">
						<span class="text-text-tertiary">Connected:</span>
						<span class="text-green-400">{instances.length}</span>
					</div>
					<div class="flex items-center gap-1.5">
						<span class="text-text-tertiary">Bindings:</span>
						<span class="text-text-primary">{state.skillBindings.length + state.teamBindings.length}</span>
					</div>
					{#if feedbackCount > 0}
						<div class="flex items-center gap-1.5">
							<span class="text-text-tertiary">Feedback:</span>
							<span class="text-yellow-400">{feedbackCount}</span>
						</div>
					{/if}
				</div>

				<div class="w-px h-5 bg-surface-border"></div>

				<!-- Feedback Tab Button -->
				<button
					onclick={() => (activeTab = 'feedback')}
					class="px-3 py-1.5 text-xs font-mono border transition-all"
					class:bg-accent-primary={activeTab === 'feedback'}
					class:text-bg-primary={activeTab === 'feedback'}
					class:border-accent-primary={activeTab === 'feedback'}
					class:text-text-secondary={activeTab !== 'feedback'}
					class:border-surface-border={activeTab !== 'feedback'}
					class:hover:border-text-tertiary={activeTab !== 'feedback'}
				>
					Feedback
					{#if feedbackCount > 0}
						<span class="ml-1 text-yellow-400">({feedbackCount})</span>
					{/if}
				</button>
			</div>

			<!-- Subcategory filter row (when category selected) -->
			{#if activeTab === 'discover' && state.filterCategory !== 'all'}
				{@const subcategories = getSubcategoriesForCategory(state.filterCategory)}
				{#if subcategories.length > 1}
					<div class="h-9 flex items-center px-4 gap-2 border-t border-surface-border/50 overflow-x-auto">
						<span class="text-xs text-text-tertiary font-mono flex-shrink-0">Filter:</span>
						<button
							onclick={() => setFilterSubcategory(null)}
							class="px-2 py-1 text-xs font-mono transition-all flex-shrink-0"
							class:bg-accent-primary={!state.filterSubcategory}
							class:text-bg-primary={!state.filterSubcategory}
							class:text-text-tertiary={state.filterSubcategory}
							class:hover:text-text-secondary={state.filterSubcategory}
						>
							All
						</button>
						{#each subcategories as subcategory}
							<button
								onclick={() => setFilterSubcategory(subcategory)}
								class="px-2 py-1 text-xs font-mono transition-all flex-shrink-0"
								class:bg-accent-primary={state.filterSubcategory === subcategory}
								class:text-bg-primary={state.filterSubcategory === subcategory}
								class:text-text-tertiary={state.filterSubcategory !== subcategory}
								class:hover:text-text-secondary={state.filterSubcategory !== subcategory}
							>
								{subcategory}
							</button>
						{/each}
					</div>
				{/if}
			{/if}
		</header>

		<!-- Content Area -->
		<div class="flex-1 overflow-y-auto p-4">
			<!-- Discover Tab -->
			{#if activeTab === 'discover'}
				<!-- Results info -->
				<div class="flex items-center justify-between mb-4">
					<p class="text-sm text-text-tertiary font-mono">
						{registry.length} MCP{registry.length !== 1 ? 's' : ''}
						{#if state.filterCategory !== 'all'}
							in <span class={getCategoryColor(state.filterCategory)}>{state.filterCategory}</span>
						{/if}
						{#if state.filterSubcategory}
							/ {state.filterSubcategory}
						{/if}
						{#if state.searchQuery}
							matching "{state.searchQuery}"
						{/if}
					</p>
				</div>

				<!-- MCP List -->
				<div class="space-y-2">
					{#each registry as mcp}
						{@const connected = isConnected(mcp.id)}
						<div
							class="border border-surface-border bg-bg-secondary hover:border-text-tertiary transition-all"
						>
							<div class="p-4 flex items-center gap-4">
								<!-- Icon -->
								<div
									class="w-10 h-10 flex items-center justify-center border flex-shrink-0 {getCategoryBgColor(
										mcp.category
									)}"
								>
									<Icon
										name={getCategoryIcon(mcp.category)}
										size={20}
										class={getCategoryColor(mcp.category)}
									/>
								</div>

								<!-- Info -->
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<h3 class="font-medium text-text-primary">{mcp.name}</h3>
										{#if mcp.official}
											<span
												class="px-1.5 py-0.5 text-[10px] font-mono text-accent-primary border border-accent-primary/30 bg-accent-primary/10"
											>
												Official
											</span>
										{/if}
										{#if connected}
											<span class="text-green-400">
												<Icon name="check-circle" size={14} />
											</span>
										{/if}
									</div>
									<p class="text-sm text-text-secondary line-clamp-1">{mcp.description}</p>
								</div>

								<!-- Category & Subcategory -->
								<div class="flex-shrink-0 text-right hidden md:block">
									<p class="text-xs font-mono {getCategoryColor(mcp.category)}">{mcp.category}</p>
									<p class="text-xs text-text-tertiary">{mcp.subcategory}</p>
								</div>

								<!-- Popularity -->
								<div class="flex-shrink-0 w-16 hidden lg:block">
									<div class="h-1.5 bg-bg-primary rounded-full overflow-hidden">
										<div
											class="h-full bg-accent-primary transition-all"
											style="width: {mcp.popularity}%"
										></div>
									</div>
									<p class="text-[10px] text-text-tertiary text-center mt-1">
										{mcp.popularity}% popular
									</p>
								</div>

								<!-- Skills count -->
								{#if mcp.skills.length > 0}
									<div
										class="flex-shrink-0 hidden md:flex items-center gap-1 text-xs text-text-tertiary"
									>
										<Icon name="zap" size={12} />
										<span>{mcp.skills.length} skills</span>
									</div>
								{/if}

								<!-- Connect Button -->
								<button
									onclick={() => handleConnect(mcp)}
									disabled={connected}
									class="flex-shrink-0 px-4 py-2 font-mono text-sm border transition-all"
									class:bg-accent-primary={!connected}
									class:text-bg-primary={!connected}
									class:border-accent-primary={!connected}
									class:hover:bg-accent-primary-hover={!connected}
									class:bg-bg-tertiary={connected}
									class:text-text-tertiary={connected}
									class:border-surface-border={connected}
									class:cursor-not-allowed={connected}
								>
									{connected ? 'Connected' : 'Connect'}
								</button>
							</div>
						</div>
					{/each}
				</div>

				{#if registry.length === 0}
					<div class="border border-surface-border bg-bg-secondary p-12 text-center">
						<div class="text-4xl mb-4 opacity-50">~</div>
						<h3 class="text-lg text-text-primary mb-2">No MCPs found</h3>
						<p class="text-sm text-text-secondary">Try adjusting your search or filters.</p>
					</div>
				{/if}
			{/if}

			<!-- Connected Tab (full view) -->
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
							{@const mcp = state.registry.find((m) => m.id === instance.definitionId)}
							<div class="border border-surface-border bg-bg-secondary">
								<div class="p-4 flex items-center gap-4">
									<!-- Status & Icon -->
									<div class="relative">
										<div
											class="w-12 h-12 flex items-center justify-center border {mcp
												? getCategoryBgColor(mcp.category)
												: 'bg-bg-primary border-surface-border'}"
										>
											<Icon
												name={mcp ? getCategoryIcon(mcp.category) : 'box'}
												size={24}
												class={mcp ? getCategoryColor(mcp.category) : 'text-text-tertiary'}
											/>
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
												<span class="text-green-400"
													>{instance.feedbackCount} feedback sent</span
												>
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

								<!-- MCP Info -->
								{#if mcp}
									<div class="px-4 pb-4 border-t border-surface-border pt-3">
										<div class="flex items-center gap-4 text-xs text-text-tertiary">
											<span class="font-mono {getCategoryColor(mcp.category)}">{mcp.category}</span
											>
											<span>{mcp.subcategory}</span>
											{#if mcp.skills.length > 0}
												<span class="flex items-center gap-1">
													<Icon name="zap" size={10} />
													Works with: {mcp.skills.slice(0, 3).join(', ')}{mcp.skills.length > 3
														? '...'
														: ''}
												</span>
											{/if}
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
		</div>
	</main>
</div>

<!-- Connect Modal -->
{#if showConnectModal && selectedMCP}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<div class="absolute inset-0 bg-black/60" onclick={() => (showConnectModal = false)}></div>

		<div class="relative w-full max-w-md bg-bg-secondary border border-surface-border shadow-xl">
			<div class="p-4 border-b border-surface-border flex items-center justify-between">
				<h2 class="text-lg font-medium text-text-primary">Connect {selectedMCP.name}</h2>
				<button
					onclick={() => (showConnectModal = false)}
					class="text-text-tertiary hover:text-text-secondary"
				>
					<Icon name="x" size={20} />
				</button>
			</div>

			<div class="p-4">
				<p class="text-sm text-text-secondary mb-4">{selectedMCP.description}</p>

				<div class="flex items-center gap-3 mb-4">
					<span
						class="px-2 py-1 text-xs font-mono {getCategoryColor(
							selectedMCP.category
						)} border border-current/30 bg-current/10"
					>
						{selectedMCP.category}
					</span>
					<span class="text-xs text-text-tertiary">{selectedMCP.subcategory}</span>
					{#if selectedMCP.official}
						<span
							class="px-2 py-1 text-xs font-mono text-accent-primary border border-accent-primary/30 bg-accent-primary/10"
						>
							Official
						</span>
					{/if}
				</div>

				{#if selectedMCP.skills.length > 0}
					<div class="mb-4">
						<h4 class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">
							Compatible Skills
						</h4>
						<div class="flex flex-wrap gap-2">
							{#each selectedMCP.skills.slice(0, 8) as skill}
								<span
									class="px-2 py-1 text-xs font-mono text-text-secondary bg-bg-primary border border-surface-border"
								>
									{skill}
								</span>
							{/each}
							{#if selectedMCP.skills.length > 8}
								<span class="px-2 py-1 text-xs font-mono text-text-tertiary">
									+{selectedMCP.skills.length - 8} more
								</span>
							{/if}
						</div>
					</div>
				{/if}

				{#if selectedMCP.repository}
					<div class="mb-4 p-3 bg-bg-primary border border-surface-border">
						<p class="text-xs text-text-tertiary mb-1">Repository</p>
						<p class="text-sm font-mono text-text-secondary">{selectedMCP.repository}</p>
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
	.line-clamp-1 {
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
