<script lang="ts">
	import Icon from './Icon.svelte';
	import type { CanvasNode } from '$lib/stores/canvas.svelte';
	import { mcpClient } from '$lib/services/mcp-client';
	import { mcpState } from '$lib/stores/mcp.svelte';

	let { node, onClose, onDelete }: {
		node: CanvasNode;
		onClose: () => void;
		onDelete?: () => void;
	} = $props();

	let activeTab = $state<'details' | 'config' | 'warnings'>('details');
	let warnings = $state<string[]>([]);
	let loadingWarnings = $state(false);
	let mcpConnected = $state(false);

	// Subscribe to MCP state
	$effect(() => {
		const unsub = mcpState.subscribe((s) => (mcpConnected = s.status === 'connected'));
		return unsub;
	});

	// Load sharp edges when warnings tab is selected
	$effect(() => {
		if (activeTab === 'warnings' && mcpConnected && warnings.length === 0) {
			loadWarnings();
		}
	});

	async function loadWarnings() {
		if (!mcpConnected) return;
		loadingWarnings = true;
		try {
			const result = await mcpClient.watchOut({
				stack: node.skill.tags || [],
				situation: `Using ${node.skill.name} skill in a workflow`
			});
			if (result.success && result.data) {
				// Extract warnings from the response
				const data = result.data as { gotchas?: Array<{ warning: string }> };
				warnings = data.gotchas?.map(g => g.warning) || [];
			}
		} catch (e) {
			console.error('Failed to load warnings:', e);
		} finally {
			loadingWarnings = false;
		}
	}

	function getCategoryColor(category: string): string {
		const colors: Record<string, string> = {
			development: 'text-blue-400',
			frameworks: 'text-purple-400',
			integrations: 'text-green-400',
			'ai-ml': 'text-pink-400',
			agents: 'text-cyan-400',
			data: 'text-orange-400',
			design: 'text-rose-400',
			marketing: 'text-yellow-400',
			strategy: 'text-emerald-400',
			enterprise: 'text-indigo-400',
			finance: 'text-lime-400',
			legal: 'text-gray-400',
			science: 'text-teal-400',
			startup: 'text-amber-400'
		};
		return colors[category] || 'text-text-secondary';
	}
</script>

<aside class="w-80 border-l border-surface-border bg-bg-secondary flex flex-col h-full">
	<!-- Header -->
	<div class="p-4 border-b border-surface-border flex items-center justify-between">
		<div class="flex items-center gap-2 min-w-0">
			<Icon name="layers" size={16} />
			<h2 class="font-medium text-text-primary truncate">{node.skill.name}</h2>
		</div>
		<button onclick={onClose} class="p-1 text-text-tertiary hover:text-text-primary transition-colors">
			<Icon name="x" size={16} />
		</button>
	</div>

	<!-- Tabs -->
	<div class="flex border-b border-surface-border">
		<button
			onclick={() => activeTab = 'details'}
			class="flex-1 px-3 py-2 text-xs font-mono transition-colors {activeTab === 'details' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-tertiary hover:text-text-secondary'}"
		>
			Details
		</button>
		<button
			onclick={() => activeTab = 'config'}
			class="flex-1 px-3 py-2 text-xs font-mono transition-colors {activeTab === 'config' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-tertiary hover:text-text-secondary'}"
		>
			Config
		</button>
		<button
			onclick={() => activeTab = 'warnings'}
			class="flex-1 px-3 py-2 text-xs font-mono transition-colors relative {activeTab === 'warnings' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-tertiary hover:text-text-secondary'}"
		>
			Warnings
			{#if warnings.length > 0}
				<span class="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full"></span>
			{/if}
		</button>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-4">
		{#if activeTab === 'details'}
			<!-- Description -->
			<div class="mb-5">
				<h3 class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">Description</h3>
				<p class="text-sm text-text-secondary leading-relaxed">{node.skill.description || 'No description available'}</p>
			</div>

			<!-- Category & Tier -->
			<div class="mb-5 flex items-center gap-3">
				<div class="px-2 py-1 bg-bg-tertiary border border-surface-border">
					<span class="text-xs font-mono {getCategoryColor(node.skill.category)}">{node.skill.category}</span>
				</div>
				<div class="px-2 py-1 {node.skill.tier === 'premium' ? 'bg-accent-secondary/10 border-accent-secondary/30' : 'bg-accent-primary/10 border-accent-primary/30'} border">
					<span class="text-xs font-mono {node.skill.tier === 'premium' ? 'text-accent-secondary' : 'text-accent-primary'}">
						{node.skill.tier === 'premium' ? 'PRO' : 'FREE'}
					</span>
				</div>
			</div>

			<!-- Tags -->
			{#if node.skill.tags && node.skill.tags.length > 0}
				<div class="mb-5">
					<h3 class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">Tags</h3>
					<div class="flex flex-wrap gap-1.5">
						{#each node.skill.tags as tag}
							<span class="px-2 py-0.5 text-xs font-mono text-text-secondary bg-bg-tertiary border border-surface-border">
								{tag}
							</span>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Triggers -->
			{#if node.skill.triggers && node.skill.triggers.length > 0}
				<div class="mb-5">
					<h3 class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">Triggers</h3>
					<ul class="space-y-1">
						{#each node.skill.triggers.slice(0, 5) as trigger}
							<li class="text-xs font-mono text-text-secondary pl-2 border-l-2 border-accent-primary/30">
								{trigger}
							</li>
						{/each}
						{#if node.skill.triggers.length > 5}
							<li class="text-xs font-mono text-text-tertiary">
								+{node.skill.triggers.length - 5} more...
							</li>
						{/if}
					</ul>
				</div>
			{/if}

			<!-- Handoffs -->
			{#if node.skill.handoffs && node.skill.handoffs.length > 0}
				<div class="mb-5">
					<h3 class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">Handoffs</h3>
					<ul class="space-y-2">
						{#each node.skill.handoffs as handoff}
							<li class="p-2 bg-bg-tertiary border border-surface-border text-xs">
								<span class="text-text-tertiary">when:</span>
								<span class="text-text-secondary ml-1">{handoff.trigger}</span>
								<br />
								<span class="text-text-tertiary">to:</span>
								<span class="text-accent-primary ml-1">{handoff.to}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Pairs Well With -->
			{#if node.skill.pairsWell && node.skill.pairsWell.length > 0}
				<div class="mb-5">
					<h3 class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">Pairs Well With</h3>
					<div class="flex flex-wrap gap-1.5">
						{#each node.skill.pairsWell as pair}
							<span class="px-2 py-0.5 text-xs font-mono text-accent-primary bg-accent-primary/10 border border-accent-primary/30">
								{pair}
							</span>
						{/each}
					</div>
				</div>
			{/if}

		{:else if activeTab === 'config'}
			<!-- Node Configuration -->
			<div class="space-y-4">
				<div>
					<h3 class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">Node ID</h3>
					<p class="text-xs font-mono text-text-secondary bg-bg-tertiary px-2 py-1 border border-surface-border">
						{node.id}
					</p>
				</div>

				<div>
					<h3 class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">Position</h3>
					<div class="grid grid-cols-2 gap-2">
						<div class="bg-bg-tertiary px-2 py-1 border border-surface-border">
							<span class="text-xs font-mono text-text-tertiary">x:</span>
							<span class="text-xs font-mono text-text-secondary ml-1">{Math.round(node.position.x)}</span>
						</div>
						<div class="bg-bg-tertiary px-2 py-1 border border-surface-border">
							<span class="text-xs font-mono text-text-tertiary">y:</span>
							<span class="text-xs font-mono text-text-secondary ml-1">{Math.round(node.position.y)}</span>
						</div>
					</div>
				</div>

				<div class="pt-4 border-t border-surface-border">
					<p class="text-xs text-text-tertiary mb-3">
						Parameter configuration will be available when MCP server provides skill schemas.
					</p>
				</div>
			</div>

		{:else if activeTab === 'warnings'}
			<!-- Sharp Edges / Warnings -->
			<div class="space-y-3">
				{#if !mcpConnected}
					<div class="p-3 bg-bg-tertiary border border-surface-border text-xs text-text-tertiary">
						<Icon name="alert-triangle" size={14} />
						<span class="ml-2">Connect to MCP to load warnings</span>
					</div>
				{:else if loadingWarnings}
					<div class="flex items-center gap-2 text-xs text-text-tertiary">
						<div class="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
						<span>Loading warnings...</span>
					</div>
				{:else if warnings.length === 0}
					<div class="p-3 bg-green-500/10 border border-green-500/30 text-xs text-green-400">
						<Icon name="check" size={14} />
						<span class="ml-2">No warnings found for this skill</span>
					</div>
				{:else}
					{#each warnings as warning}
						<div class="p-3 bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
							<div class="flex items-start gap-2">
								<Icon name="alert-triangle" size={14} />
								<span>{warning}</span>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Footer Actions -->
	<div class="p-4 border-t border-surface-border space-y-2">
		<button class="w-full px-4 py-2 text-sm font-mono text-accent-primary border border-accent-primary hover:bg-accent-primary hover:text-bg-primary transition-all">
			Test Node
		</button>
		{#if onDelete}
			<button
				onclick={onDelete}
				class="w-full px-4 py-2 text-sm font-mono text-red-400 border border-red-400/50 hover:bg-red-400 hover:text-bg-primary transition-all"
			>
				Delete Node
			</button>
		{/if}
	</div>
</aside>
