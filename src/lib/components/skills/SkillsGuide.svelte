<script lang="ts">
	import Icon from '../Icon.svelte';

	const guideItems = [
		{
			icon: 'book-open',
			title: 'H70 Skill Format',
			description: 'Learn the structure: identity, patterns, anti-patterns, and sharp edges that make skills powerful.',
			link: '/guide/h70-format',
			linkText: 'Learn H70'
		},
		{
			icon: 'terminal',
			title: 'Use in Claude Code',
			description: 'Load skills with /skill command or let Claude auto-detect from your task description.',
			link: '/guide/claude-code',
			linkText: 'Setup Guide'
		},
		{
			icon: 'layers',
			title: 'Skill Chaining',
			description: 'Combine multiple skills for complex tasks. Skills hand off intelligently to specialists.',
			link: '/guide/skill-chains',
			linkText: 'See Examples'
		}
	];
</script>

<div class="bg-bg-secondary border border-surface-border p-5 mb-8">
	<div class="flex items-center gap-2 mb-4">
		<Icon name="info" size={16} class="text-accent-primary" />
		<h3 class="font-display font-semibold text-text-primary">How to Use Skills</h3>
	</div>

	<div class="grid md:grid-cols-3 gap-4">
		{#each guideItems as item}
			<div class="group p-4 bg-bg-primary border border-surface-border hover:border-accent-primary/30 transition-all">
				<div class="flex items-center gap-2 mb-2">
					<div class="w-7 h-7 flex items-center justify-center bg-accent-primary/10 text-accent-primary">
						<Icon name={item.icon} size={14} />
					</div>
					<h4 class="font-medium text-sm text-text-primary">{item.title}</h4>
				</div>

				<p class="text-xs text-text-secondary mb-3 line-clamp-2">
					{item.description}
				</p>

				<a
					href={item.link}
					class="inline-flex items-center gap-1 text-xs font-mono text-accent-primary hover:underline"
				>
					{item.linkText}
					<Icon name="chevron-right" size={12} />
				</a>
			</div>
		{/each}
	</div>

	<!-- Quick tip -->
	<div class="mt-4 pt-4 border-t border-surface-border">
		<div class="flex items-start gap-3 p-3 bg-accent-primary/5 border border-accent-primary/20">
			<Icon name="zap" size={16} class="text-accent-primary flex-shrink-0 mt-0.5" />
			<div>
				<p class="text-sm text-text-secondary">
					<span class="font-medium text-text-primary">Pro tip:</span> In Claude Code, just describe your task and Claude will auto-load relevant skills. No need to memorize skill names!
				</p>
			</div>
		</div>
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
