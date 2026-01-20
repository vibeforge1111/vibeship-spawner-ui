<script lang="ts">
	import Icon from './Icon.svelte';
	import { filters, setFilter, resetFilters, skillCounts } from '$lib/stores/skills.svelte';
	import type { SkillTier } from '$lib/stores/skills.svelte';

	const tiers: { value: SkillTier | 'all'; label: string; icon?: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'free', label: 'Free' },
		{ value: 'premium', label: 'Pro', icon: 'crown' }
	];
</script>

<div class="space-y-4">
	<!-- Main controls row -->
	<div class="flex flex-col sm:flex-row gap-3">
		<!-- Tier Tabs -->
		<div class="flex bg-bg-secondary border border-surface-border p-1">
			{#each tiers as tier}
				<button
					onclick={() => setFilter('tier', tier.value)}
					class="flex items-center gap-1.5 px-4 py-2 font-mono text-sm transition-all"
					class:bg-accent-primary={$filters.tier === tier.value}
					class:text-bg-primary={$filters.tier === tier.value}
					class:text-text-secondary={$filters.tier !== tier.value}
					class:hover:text-text-primary={$filters.tier !== tier.value}
				>
					{#if tier.icon}
						<Icon name={tier.icon} size={12} />
					{/if}
					{tier.label}
					<span class="text-xs opacity-70">
						{#if tier.value === 'all'}
							({$skillCounts.total})
						{:else if tier.value === 'free'}
							({$skillCounts.free})
						{:else}
							({$skillCounts.premium})
						{/if}
					</span>
				</button>
			{/each}
		</div>

		<div class="flex-1"></div>

		<!-- Reset -->
		{#if $filters.search || $filters.category !== 'all' || $filters.tier !== 'all'}
			<button
				onclick={resetFilters}
				class="flex items-center gap-1 px-3 py-2.5 text-text-tertiary hover:text-text-primary transition-colors font-mono text-sm"
			>
				<Icon name="x" size={14} />
				<span>Clear filters</span>
			</button>
		{/if}
	</div>

	<!-- Active filters display -->
	{#if $filters.category !== 'all'}
		<div class="flex items-center gap-2 flex-wrap">
			<span class="text-xs font-mono text-text-tertiary">Filtering:</span>
			<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-xs font-mono">
				{$filters.category}
				<button onclick={() => setFilter('category', 'all')} class="hover:text-accent-primary/70">
					<Icon name="x" size={10} />
				</button>
			</span>
		</div>
	{/if}
</div>
