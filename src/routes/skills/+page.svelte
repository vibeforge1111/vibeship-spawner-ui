<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import SkillCard from '$lib/components/SkillCard.svelte';
	import SkillRow from '$lib/components/SkillRow.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import SkillsHero from '$lib/components/skills/SkillsHero.svelte';
	import TierExplainer from '$lib/components/skills/TierExplainer.svelte';
	import CategoryBrowser from '$lib/components/skills/CategoryBrowser.svelte';
	import SkillsGuide from '$lib/components/skills/SkillsGuide.svelte';
	import { filteredSkills, loading, error, loadSkills, skillCounts, skillSource, categoryCounts } from '$lib/stores/skills.svelte';

	let showSidebar = $state(true);
	let viewMode = $state<'cards' | 'rows'>('cards');

	function handleViewChange(mode: 'cards' | 'rows') {
		viewMode = mode;
	}

	onMount(() => {
		loadSkills();
	});
</script>

<svelte:head>
	<title>Skills Library | Vibeship Spawner</title>
	<meta name="description" content="Browse 400+ AI skills that transform Claude into domain experts. Free open source and token-optimized Pro versions." />
</svelte:head>

<div class="min-h-screen bg-bg-primary">
	<Navbar />

	<main class="max-w-7xl mx-auto px-4 sm:px-6 py-8">
		<!-- Hero Section -->
		<SkillsHero />

		<!-- Tier Explainer -->
		<TierExplainer />

		<!-- How to Use Guide -->
		<SkillsGuide />

		<!-- Main Content Area -->
		<div class="flex flex-col lg:flex-row gap-6">
			<!-- Sidebar - Categories -->
			<aside class="lg:w-72 flex-shrink-0">
				<!-- Mobile toggle -->
				<button
					onclick={() => showSidebar = !showSidebar}
					class="lg:hidden w-full flex items-center justify-between p-3 bg-bg-secondary border border-surface-border mb-4"
				>
					<span class="font-mono text-sm text-text-secondary">Categories</span>
					<Icon name="chevron-down" size={14} class={showSidebar ? 'rotate-180' : ''} />
				</button>

				<div class={showSidebar ? 'block' : 'hidden lg:block'}>
					<CategoryBrowser categoryCounts={$categoryCounts} />

					<!-- Source indicator -->
					<div class="p-3 bg-bg-secondary border border-surface-border">
						<div class="flex items-center gap-2">
							<span class="w-2 h-2 rounded-full {$skillSource === 'mcp' ? 'bg-green-500' : 'bg-amber-500'}"></span>
							<span class="font-mono text-xs text-text-tertiary">
								Source: {$skillSource === 'mcp' ? 'MCP Server' : 'Local Skills'}
							</span>
						</div>
					</div>
				</div>
			</aside>

			<!-- Main Content -->
			<div class="flex-1 min-w-0">
				<!-- Filter Bar -->
				<div class="mb-6">
					<FilterBar {viewMode} onViewChange={handleViewChange} />
				</div>

				<!-- Skills Grid -->
				{#if $loading}
					<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
						{#each Array(9) as _}
							<div class="h-56 bg-bg-secondary border border-surface-border animate-pulse"></div>
						{/each}
					</div>
				{:else if $error}
					<div class="p-8 text-center bg-bg-secondary border border-surface-border">
						<div class="w-12 h-12 mx-auto mb-4 flex items-center justify-center bg-red-500/10 border border-red-500/30 text-red-500">
							<Icon name="x" size={24} />
						</div>
						<h3 class="text-lg font-display font-semibold text-text-primary mb-2">Failed to Load Skills</h3>
						<p class="text-text-secondary mb-4">{$error}</p>
						<button
							onclick={loadSkills}
							class="px-4 py-2 bg-accent-primary text-bg-primary font-mono text-sm hover:bg-accent-primary/90 transition-colors"
						>
							Retry
						</button>
					</div>
				{:else if $filteredSkills.length === 0}
					<div class="p-12 text-center bg-bg-secondary border border-surface-border">
						<div class="w-12 h-12 mx-auto mb-4 flex items-center justify-center bg-bg-tertiary border border-surface-border text-text-tertiary">
							<Icon name="search" size={24} />
						</div>
						<h3 class="text-lg font-display font-semibold text-text-primary mb-2">No skills found</h3>
						<p class="text-text-secondary mb-4">Try adjusting your search or filters</p>
					</div>
				{:else}
					<!-- Results count -->
					<div class="flex items-center justify-between mb-4">
						<p class="text-sm font-mono text-text-tertiary">
							Showing <span class="text-text-primary font-medium">{$filteredSkills.length}</span> of {$skillCounts.total} skills
						</p>
					</div>

					{#if viewMode === 'cards'}
						<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
							{#each $filteredSkills as skill (skill.id)}
								<SkillCard {skill} />
							{/each}
						</div>
					{:else}
						<div class="flex flex-col gap-2">
							{#each $filteredSkills as skill (skill.id)}
								<SkillRow {skill} />
							{/each}
						</div>
					{/if}

					<!-- Load more indicator for large sets -->
					{#if $filteredSkills.length > 50}
						<div class="mt-8 p-4 bg-bg-secondary border border-surface-border text-center">
							<p class="text-sm text-text-secondary">
								Showing all {$filteredSkills.length} matching skills. Use filters to narrow results.
							</p>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</main>

	<Footer />
</div>
