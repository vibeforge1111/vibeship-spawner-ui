<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import SkillCard from '$lib/components/SkillCard.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { filteredSkills, loading, error, loadSkills, skillCounts } from '$lib/stores/skills.svelte';

	onMount(() => {
		loadSkills();
	});
</script>

<svelte:head>
	<title>Skills | Vibeship Spawner</title>
</svelte:head>

<div class="min-h-screen bg-bg-primary">
	<Navbar />

	<main class="max-w-6xl mx-auto px-6 py-12">
		<!-- Header -->
		<div class="mb-10">
			<div class="flex items-center gap-2 mb-4">
				<Icon name="layers" size={20} />
				<span class="font-mono text-sm text-text-tertiary uppercase tracking-wider">Skills Library</span>
			</div>
			<h1 class="text-3xl font-display font-bold text-text-primary mb-3">
				Browse <span class="text-accent-primary">{$skillCounts.total}</span> Skills
			</h1>
			<p class="text-text-secondary max-w-2xl">
				Specialized expertise that transforms Claude into a domain expert.
				Free skills are open source. Premium skills are token-optimized for faster, cheaper responses.
			</p>
		</div>

		<!-- Tier Explainer -->
		<div class="grid md:grid-cols-2 gap-4 mb-10">
			<div class="p-4 bg-bg-secondary border border-surface-border">
				<div class="flex items-center gap-2 mb-2">
					<div class="px-2 py-0.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary font-mono text-xs">
						FREE
					</div>
					<span class="font-display font-semibold text-text-primary">Open Source</span>
				</div>
				<p class="text-sm text-text-secondary">
					Full-featured skills available on GitHub. Great for learning and customization.
				</p>
			</div>
			<div class="p-4 bg-bg-secondary border border-surface-border">
				<div class="flex items-center gap-2 mb-2">
					<div class="flex items-center gap-1 px-2 py-0.5 bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary font-mono text-xs">
						<Icon name="crown" size={10} />
						PRO
					</div>
					<span class="font-display font-semibold text-text-primary">Token-Optimized</span>
				</div>
				<p class="text-sm text-text-secondary">
					Same expertise, 60-70% fewer tokens. Faster responses, lower costs.
				</p>
			</div>
		</div>

		<!-- Filter Bar -->
		<div class="mb-8">
			<FilterBar />
		</div>

		<!-- Skills Grid -->
		{#if $loading}
			<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each Array(6) as _}
					<div class="h-64 bg-bg-secondary border border-surface-border animate-pulse"></div>
				{/each}
			</div>
		{:else if $error}
			<div class="p-8 text-center bg-bg-secondary border border-surface-border">
				<Icon name="x" size={24} />
				<p class="mt-2 text-text-secondary">{$error}</p>
				<button
					onclick={loadSkills}
					class="mt-4 px-4 py-2 bg-accent-primary text-bg-primary font-mono text-sm"
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
			<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each $filteredSkills as skill (skill.id)}
					<SkillCard {skill} />
				{/each}
			</div>
		{/if}
	</main>

	<Footer />
</div>
