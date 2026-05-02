<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { skills, loadSkills, type Skill } from '$lib/stores/skills.svelte';
	import { getCategoryIcon } from '$lib/utils/skill-category-icons';

	let skill = $state<Skill | null>(null);
	let loading = $state(true);

	onMount(async () => {
		await loadSkills();
		const id = $page.params.id;
		skills.subscribe((s) => {
			skill = s.find((sk) => sk.id === id) || null;
			loading = false;
		});
	});

	function formatTokens(tokens: number | undefined): string {
		if (!tokens) return '—';
		if (tokens >= 1000) {
			return (tokens / 1000).toFixed(1) + 'k';
		}
		return tokens.toString();
	}
</script>

<svelte:head>
	<title>{skill?.name || 'Skill'} | Vibeship Spawner</title>
</svelte:head>

<div class="min-h-screen bg-bg-primary">
	<Navbar />

	<main class="max-w-4xl mx-auto px-6 py-12">
		<!-- Back Link -->
		<a href="/skills" class="inline-flex items-center gap-2 text-text-tertiary hover:text-accent-primary transition-colors font-mono text-sm mb-8">
			<Icon name="chevron-right" size={14} />
			<span>Back to Skills</span>
		</a>

		{#if loading}
			<div class="animate-pulse space-y-6">
				<div class="h-8 bg-bg-secondary w-1/3"></div>
				<div class="h-4 bg-bg-secondary w-2/3"></div>
				<div class="h-64 bg-bg-secondary"></div>
			</div>
		{:else if !skill}
			<div class="p-12 text-center bg-bg-secondary border border-surface-border">
				<div class="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-bg-tertiary border border-surface-border text-text-tertiary">
					<Icon name="x" size={32} />
				</div>
				<h2 class="text-xl font-display font-semibold text-text-primary mb-2">Skill Not Found</h2>
				<p class="text-text-secondary mb-6">The skill you're looking for doesn't exist or has been removed.</p>
				<a href="/skills" class="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary text-bg-primary font-mono text-sm">
					Browse Skills
					<Icon name="arrow-right" size={14} />
				</a>
			</div>
		{:else}
			<!-- Header -->
			<div class="flex items-start justify-between mb-8">
				<div class="flex items-start gap-4">
					<div class="w-14 h-14 flex items-center justify-center bg-bg-secondary border border-surface-border text-accent-primary">
						<Icon name={getCategoryIcon(skill.category)} size={28} />
					</div>
					<div>
						<div class="flex items-center gap-3 mb-2">
							<h1 class="text-2xl font-display font-bold text-text-primary">{skill.name}</h1>
							{#if skill.tier === 'premium'}
								<div class="flex items-center gap-1 px-2 py-0.5 bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary">
									<Icon name="crown" size={12} />
									<span class="font-mono text-xs font-medium">PRO</span>
								</div>
							{:else}
								<div class="px-2 py-0.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary font-mono text-xs">
									FREE
								</div>
							{/if}
						</div>
						<p class="text-text-secondary font-mono text-sm uppercase tracking-wider">{skill.category}</p>
					</div>
				</div>
			</div>

			<!-- Description -->
			<div class="mb-8">
				<p class="text-lg text-text-primary leading-relaxed">{skill.description}</p>
			</div>

			<!-- Stats Grid -->
			<div class="grid grid-cols-3 gap-4 mb-8">
				<div class="p-4 bg-bg-secondary border border-surface-border text-center">
					<div class="flex items-center justify-center gap-1 text-text-tertiary mb-2">
						<Icon name="cpu" size={14} />
					</div>
					<p class="text-xl font-display font-bold text-text-primary">{formatTokens(skill.tokenEstimate)}</p>
					<p class="font-mono text-xs text-text-tertiary uppercase tracking-wider">Tokens</p>
				</div>
				<div class="p-4 bg-bg-secondary border border-surface-border text-center">
					<div class="flex items-center justify-center gap-1 text-text-tertiary mb-2">
						<Icon name="zap" size={14} />
					</div>
					<p class="text-xl font-display font-bold text-text-primary">{skill.triggers.length}</p>
					<p class="font-mono text-xs text-text-tertiary uppercase tracking-wider">Triggers</p>
				</div>
				<div class="p-4 bg-bg-secondary border border-surface-border text-center">
					<div class="flex items-center justify-center gap-1 text-text-tertiary mb-2">
						<Icon name="tag" size={14} />
					</div>
					<p class="text-xl font-display font-bold text-text-primary">{skill.tags.length}</p>
					<p class="font-mono text-xs text-text-tertiary uppercase tracking-wider">Tags</p>
				</div>
			</div>

			<!-- Tags -->
			<div class="mb-8">
				<h3 class="font-mono text-xs text-text-tertiary uppercase tracking-wider mb-3">Tags</h3>
				<div class="flex flex-wrap gap-2">
					{#each skill.tags as tag}
						<span class="px-3 py-1 text-sm font-mono text-text-secondary bg-bg-secondary border border-surface-border">
							{tag}
						</span>
					{/each}
				</div>
			</div>

			<!-- Triggers -->
			<div class="mb-8">
				<h3 class="font-mono text-xs text-text-tertiary uppercase tracking-wider mb-3">Activation Triggers</h3>
				<div class="p-4 bg-bg-secondary border border-surface-border font-mono text-sm">
					{#each skill.triggers as trigger, i}
						<span class="text-accent-primary">"{trigger}"</span>{#if i < skill.triggers.length - 1}<span class="text-text-tertiary">, </span>{/if}
					{/each}
				</div>
				<p class="mt-2 text-xs text-text-tertiary">
					Say any of these phrases to automatically activate this skill.
				</p>
			</div>

			<!-- Install Instructions -->
			<div class="p-6 bg-bg-secondary border border-surface-border">
				<h3 class="font-display font-semibold text-text-primary mb-4">How to Use This Skill</h3>
				
				{#if skill.tier === 'free'}
					<div class="space-y-4">
						<div>
							<p class="font-mono text-xs text-text-tertiary uppercase tracking-wider mb-2">1. Install Skills</p>
							<code class="block p-3 bg-bg-primary border border-surface-border font-mono text-sm text-accent-primary">
								npx github:vibeforge1111/vibeship-spawner-skills install --mcp
							</code>
						</div>
						<div>
							<p class="font-mono text-xs text-text-tertiary uppercase tracking-wider mb-2">2. Activate in Chat</p>
							<p class="text-text-secondary text-sm">
								Simply mention one of the triggers above, or use <code class="px-1 py-0.5 bg-bg-primary border border-surface-border text-accent-primary">spawner_load</code> with the skill ID.
							</p>
						</div>
					</div>
				{:else}
					<div class="space-y-4">
						<p class="text-text-secondary">
							This is a premium skill with token-optimized patterns. Premium skills provide the same expertise
							with 60-70% fewer tokens, resulting in faster responses and lower costs.
						</p>
						<a href="/pricing" class="inline-flex items-center gap-2 px-4 py-2 bg-accent-secondary text-bg-primary font-mono text-sm">
							Get Premium Access
							<Icon name="arrow-right" size={14} />
						</a>
					</div>
				{/if}
			</div>
		{/if}
	</main>

	<Footer />
</div>

<style>
	/* Rotate chevron to point left for back button */
	a:first-of-type :global(svg) {
		transform: rotate(180deg);
	}
</style>
