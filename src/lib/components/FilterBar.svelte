<script lang="ts">
	import Icon from './Icon.svelte';
	import { filters, setFilter, resetFilters, skillCounts, allTags } from '$lib/stores/skills.svelte';
	import type { SkillCategory, SkillTier } from '$lib/stores/skills.svelte';

	let showFilters = $state(false);

	const categories: { value: SkillCategory | 'all'; label: string }[] = [
		{ value: 'all', label: 'All Categories' },
		{ value: 'development', label: 'Development' },
		{ value: 'frameworks', label: 'Frameworks' },
		{ value: 'integrations', label: 'Integrations' },
		{ value: 'ai-ml', label: 'AI & ML' },
		{ value: 'agents', label: 'Agents' },
		{ value: 'data', label: 'Data' },
		{ value: 'design', label: 'Design' },
		{ value: 'marketing', label: 'Marketing' },
		{ value: 'strategy', label: 'Strategy' },
		{ value: 'enterprise', label: 'Enterprise' },
		{ value: 'finance', label: 'Finance' },
		{ value: 'legal', label: 'Legal' },
		{ value: 'science', label: 'Science' },
		{ value: 'startup', label: 'Startup' }
	];

	const tiers: { value: SkillTier | 'all'; label: string }[] = [
		{ value: 'all', label: 'All Tiers' },
		{ value: 'free', label: 'Free' },
		{ value: 'premium', label: 'Premium' }
	];
</script>

<div class="space-y-4">
	<!-- Search and Toggle -->
	<div class="flex items-center gap-3">
		<!-- Search Input -->
		<div class="flex-1 relative">
			<div class="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
				<Icon name="search" size={16} />
			</div>
			<input
				type="text"
				placeholder="Search skills..."
				value={$filters.search}
				oninput={(e) => setFilter('search', e.currentTarget.value)}
				class="w-full pl-10 pr-4 py-2.5 bg-bg-secondary border border-surface-border text-text-primary placeholder:text-text-tertiary font-mono text-sm focus:outline-none focus:border-accent-primary transition-colors"
			/>
		</div>

		<!-- Filter Toggle -->
		<button
			onclick={() => showFilters = !showFilters}
			class="flex items-center gap-2 px-4 py-2.5 bg-bg-secondary border border-surface-border text-text-secondary hover:text-text-primary hover:border-accent-primary transition-all font-mono text-sm"
			class:border-accent-primary={showFilters}
			class:text-accent-primary={showFilters}
		>
			<Icon name="filter" size={14} />
			<span>Filters</span>
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

	<!-- Filter Panel -->
	{#if showFilters}
		<div class="p-4 bg-bg-secondary border border-surface-border space-y-4 animate-fade-in">
			<div class="grid md:grid-cols-2 gap-4">
				<!-- Category Select -->
				<div>
					<label class="block font-mono text-xs text-text-tertiary uppercase tracking-wider mb-2">
						Category
					</label>
					<select
						value={$filters.category}
						onchange={(e) => setFilter('category', e.currentTarget.value as SkillCategory | 'all')}
						class="w-full px-3 py-2 bg-bg-primary border border-surface-border text-text-primary font-mono text-sm focus:outline-none focus:border-accent-primary cursor-pointer"
					>
						{#each categories as cat}
							<option value={cat.value}>{cat.label}</option>
						{/each}
					</select>
				</div>

				<!-- Tier Select -->
				<div>
					<label class="block font-mono text-xs text-text-tertiary uppercase tracking-wider mb-2">
						Tier
					</label>
					<div class="flex gap-2">
						{#each tiers as tier}
							<button
								onclick={() => setFilter('tier', tier.value)}
								class="flex-1 px-3 py-2 border font-mono text-sm transition-all"
								class:bg-accent-primary={$filters.tier === tier.value}
								class:text-bg-primary={$filters.tier === tier.value}
								class:border-accent-primary={$filters.tier === tier.value}
								class:bg-bg-primary={$filters.tier !== tier.value}
								class:text-text-secondary={$filters.tier !== tier.value}
								class:border-surface-border={$filters.tier !== tier.value}
								class:hover:border-accent-primary={$filters.tier !== tier.value}
							>
								{tier.label}
								{#if tier.value === 'free'}
									<span class="ml-1 text-xs opacity-70">({$skillCounts.free})</span>
								{:else if tier.value === 'premium'}
									<span class="ml-1 text-xs opacity-70">({$skillCounts.premium})</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Popular Tags -->
			{#if $allTags.length > 0}
				<div>
					<label class="block font-mono text-xs text-text-tertiary uppercase tracking-wider mb-2">
						Popular Tags
					</label>
					<div class="flex flex-wrap gap-2">
						{#each $allTags.slice(0, 12) as tag}
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
		</div>
	{/if}

	<!-- Results Summary -->
	<div class="flex items-center justify-between text-sm font-mono text-text-tertiary">
		<span>
			Showing <span class="text-text-primary">{$skillCounts.total}</span> skills
			{#if $filters.tier !== 'all'}
				<span class="text-accent-primary">({$filters.tier})</span>
			{/if}
		</span>
		{#if $filters.tags.length > 0}
			<span class="flex items-center gap-1">
				<Icon name="tag" size={12} />
				{$filters.tags.length} tag{$filters.tags.length > 1 ? 's' : ''} selected
			</span>
		{/if}
	</div>
</div>
