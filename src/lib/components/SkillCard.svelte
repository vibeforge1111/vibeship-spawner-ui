<script lang="ts">
	import Icon from './Icon.svelte';
	import type { Skill } from '$lib/stores/skills.svelte';

	let { skill }: { skill: Skill } = $props();

	const categoryIcons: Record<string, string> = {
		development: 'cpu',
		frameworks: 'layers',
		integrations: 'zap',
		'ai-ml': 'brain',
		agents: 'sparkles',
		data: 'grid',
		design: 'compass',
		marketing: 'play',
		strategy: 'book',
		enterprise: 'shield',
		finance: 'zap',
		legal: 'book-open',
		science: 'sparkles',
		startup: 'zap'
	};

	function formatTokens(tokens: number | undefined): string {
		if (!tokens) return '—';
		if (tokens >= 1000) {
			return (tokens / 1000).toFixed(1) + 'k';
		}
		return tokens.toString();
	}
</script>

<a
	href="/skills/{skill.id}"
	class="group block p-5 bg-bg-secondary border border-surface-border hover:border-accent-primary transition-all duration-normal"
>
	<!-- Header -->
	<div class="flex items-start justify-between mb-3">
		<div class="flex items-center gap-2">
			<div class="w-8 h-8 flex items-center justify-center bg-bg-tertiary border border-surface-border text-accent-primary">
				<Icon name={categoryIcons[skill.category] || 'layers'} size={16} />
			</div>
			<span class="font-mono text-xs text-text-tertiary uppercase tracking-wider">{skill.category}</span>
		</div>

		<!-- Tier Badge -->
		{#if skill.tier === 'premium'}
			<div class="flex items-center gap-1 px-2 py-0.5 bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary">
				<Icon name="crown" size={12} />
				<span class="font-mono text-xs font-medium">PRO</span>
			</div>
		{:else}
			<div class="flex items-center gap-1 px-2 py-0.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary">
				<span class="font-mono text-xs">FREE</span>
			</div>
		{/if}
	</div>

	<!-- Name -->
	<h3 class="text-lg font-display font-semibold text-text-primary mb-2 group-hover:text-accent-primary transition-colors">
		{skill.name}
	</h3>

	<!-- Description -->
	<p class="text-sm text-text-secondary mb-4 line-clamp-2">
		{skill.description}
	</p>

	<!-- Tags -->
	<div class="flex flex-wrap gap-1.5 mb-4">
		{#each skill.tags.slice(0, 4) as tag}
			<span class="px-2 py-0.5 text-xs font-mono text-text-tertiary bg-bg-tertiary border border-surface-border">
				{tag}
			</span>
		{/each}
		{#if skill.tags.length > 4}
			<span class="px-2 py-0.5 text-xs font-mono text-text-tertiary bg-bg-tertiary border border-surface-border">
				+{skill.tags.length - 4}
			</span>
		{/if}
	</div>

	<!-- Footer -->
	<div class="flex items-center justify-between pt-3 border-t border-surface-border">
		<div class="flex items-center gap-1 text-text-tertiary">
			<Icon name="cpu" size={12} />
			<span class="font-mono text-xs">{formatTokens(skill.tokenEstimate)} tokens</span>
		</div>

		<span class="flex items-center gap-1 text-sm text-accent-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
			View
			<Icon name="chevron-right" size={14} />
		</span>
	</div>
</a>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
