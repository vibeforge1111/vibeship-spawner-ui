<script lang="ts">
	import Icon from './Icon.svelte';
	import type { Skill } from '$lib/stores/skills.svelte';

	let { skill }: { skill: Skill } = $props();

	const categoryIcons: Record<string, string> = {
		// Development
		development: 'cpu',
		backend: 'server',
		frontend: 'layout',
		frameworks: 'layers',
		mobile: 'smartphone',
		// Infrastructure
		devops: 'cloud',
		infrastructure: 'server',
		security: 'shield',
		testing: 'check-circle',
		performance: 'activity',
		// AI & Data
		ai: 'brain',
		'ai-ml': 'brain',
		'ai-agents': 'sparkles',
		'ai-tools': 'wand',
		agents: 'sparkles',
		data: 'database',
		'data-science': 'bar-chart',
		// Game Dev
		'game-dev': 'gamepad',
		gamedev: 'gamepad',
		'game-dev-llm': 'gamepad',
		// Web3 & Finance
		blockchain: 'link',
		web3: 'globe',
		finance: 'dollar-sign',
		trading: 'trending-up',
		// Business
		business: 'briefcase',
		strategy: 'target',
		startup: 'rocket',
		founder: 'lightbulb',
		product: 'box',
		enterprise: 'building',
		// Marketing & Communications
		marketing: 'megaphone',
		community: 'users',
		communications: 'message-circle',
		// Creative
		creative: 'pen-tool',
		design: 'palette',
		// Specialized
		space: 'rocket',
		biotech: 'flask',
		robotics: 'cpu',
		climate: 'globe',
		education: 'graduation-cap',
		legal: 'scale',
		hardware: 'cpu',
		// Integrations & Other
		integrations: 'plug',
		integration: 'plug',
		mcp: 'plug',
		compliance: 'clipboard',
		architecture: 'layers',
		analytics: 'bar-chart',
		ecommerce: 'shopping-cart',
		nocode: 'wand',
		productivity: 'check-circle',
		engineering: 'wrench'
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
	class="group flex items-center gap-4 p-4 bg-bg-secondary border border-surface-border hover:border-accent-primary transition-all duration-normal"
>
	<!-- Icon -->
	<div class="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-bg-tertiary border border-surface-border text-accent-primary">
		<Icon name={categoryIcons[skill.category] || 'layers'} size={18} />
	</div>

	<!-- Main content -->
	<div class="flex-1 min-w-0">
		<div class="flex items-center gap-2 mb-0.5">
			<h3 class="text-base font-display font-semibold text-text-primary group-hover:text-accent-primary transition-colors truncate">
				{skill.name}
			</h3>
			<!-- Tier Badge -->
			{#if skill.tier === 'premium'}
				<div class="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary">
					<Icon name="crown" size={10} />
					<span class="font-mono text-[10px] font-medium">PRO</span>
				</div>
			{:else}
				<div class="flex-shrink-0 px-1.5 py-0.5 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary">
					<span class="font-mono text-[10px]">FREE</span>
				</div>
			{/if}
		</div>
		<p class="text-sm text-text-secondary truncate">
			{skill.description}
		</p>
	</div>

	<!-- Category -->
	<div class="hidden sm:flex items-center gap-1.5 flex-shrink-0">
		<span class="font-mono text-xs text-text-tertiary uppercase">{skill.category}</span>
	</div>

	<!-- Tokens -->
	<div class="hidden md:flex items-center gap-1 flex-shrink-0 text-text-tertiary">
		<Icon name="cpu" size={12} />
		<span class="font-mono text-xs">{formatTokens(skill.tokenEstimate)}</span>
	</div>

	<!-- Arrow -->
	<div class="flex-shrink-0 text-accent-primary opacity-0 group-hover:opacity-100 transition-opacity">
		<Icon name="chevron-right" size={16} />
	</div>
</a>
