<script lang="ts">
	import Icon from './Icon.svelte';
	import { filters, setFilter, resetFilters, skillCounts, allTags } from '$lib/stores/skills.svelte';
	import type { SkillTier } from '$lib/stores/skills.svelte';

	const tiers: { value: SkillTier | 'all'; label: string; icon?: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'free', label: 'Free' },
		{ value: 'premium', label: 'Pro', icon: 'crown' }
	];

	let showTags = $state(false);
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

		<!-- Search Input -->
		<div class="flex-1 relative">
			<div class="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
				<Icon name="search" size={16} />
			</div>
			<input
				type="text"
				placeholder="Search skills by name, description, or tags..."
				value={$filters.search}
				oninput={(e) => setFilter('search', e.currentTarget.value)}
				class="w-full pl-10 pr-4 py-2.5 bg-bg-secondary border border-surface-border text-text-primary placeholder:text-text-tertiary font-mono text-sm focus:outline-none focus:border-accent-primary transition-colors"
			/>
		</div>

		<!-- Tags Toggle -->
		<button
			onclick={() => showTags = !showTags}
			class="flex items-center gap-2 px-4 py-2.5 bg-bg-secondary border border-surface-border text-text-secondary hover:text-text-primary hover:border-accent-primary transition-all font-mono text-sm"
			class:border-accent-primary={showTags || $filters.tags.length > 0}
			class:text-accent-primary={showTags || $filters.tags.length > 0}
		>
			<Icon name="tag" size={14} />
			<span>Tags</span>
			{#if $filters.tags.length > 0}
				<span class="px-1.5 py-0.5 bg-accent-primary text-bg-primary text-xs">{$filters.tags.length}</span>
			{/if}
		</button>

		<!-- Reset -->
		{#if $filters.search || $filters.category !== 'all' || $filters.tier !== 'all' || $filters.tags.length > 0}
			<button
				onclick={resetFilters}
				class="flex items-center gap-1 px-3 py-2.5 text-text-tertiary hover:text-text-primary transition-colors font-mono text-sm"
			>
				<Icon name="x" size={14} />
				<span>Clear</span>
			</button>
		{/if}
	</div>

	<!-- Tags Panel -->
	{#if showTags && $allTags.length > 0}
		<div class="p-4 bg-bg-secondary border border-surface-border animate-fade-in">
			<label class="block font-mono text-xs text-text-tertiary uppercase tracking-wider mb-3">
				Filter by Tags
			</label>
			<div class="flex flex-wrap gap-2">
				{#each $allTags.slice(0, 20) as tag}
					<button
						onclick={() => {
							const current = $filters.tags;
							if (current.includes(tag)) {
								setFilter('tags', current.filter((t: string) => t !== tag));
							} else {
								setFilter('tags', [...current, tag]);
							}
						}}
						class="px-2.5 py-1 border font-mono text-xs transition-all"
						class:bg-accent-primary={$filters.tags.includes(tag)}
						class:text-bg-primary={$filters.tags.includes(tag)}
						class:border-accent-primary={$filters.tags.includes(tag)}
						class:bg-bg-primary={!$filters.tags.includes(tag)}
						class:text-text-tertiary={!$filters.tags.includes(tag)}
						class:border-surface-border={!$filters.tags.includes(tag)}
						class:hover:border-accent-primary={!$filters.tags.includes(tag)}
						class:hover:text-text-primary={!$filters.tags.includes(tag)}
					>
						{tag}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Active filters display -->
	{#if $filters.category !== 'all' || $filters.tags.length > 0}
		<div class="flex items-center gap-2 flex-wrap">
			<span class="text-xs font-mono text-text-tertiary">Active:</span>
			{#if $filters.category !== 'all'}
				<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-xs font-mono">
					{$filters.category}
					<button onclick={() => setFilter('category', 'all')} class="hover:text-accent-primary/70">
						<Icon name="x" size={10} />
					</button>
				</span>
			{/if}
			{#each $filters.tags as tag}
				<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-bg-tertiary border border-surface-border text-text-secondary text-xs font-mono">
					{tag}
					<button onclick={() => setFilter('tags', $filters.tags.filter((t: string) => t !== tag))} class="hover:text-text-primary">
						<Icon name="x" size={10} />
					</button>
				</span>
			{/each}
		</div>
	{/if}
</div>
