<script lang="ts">
	import Icon from './Icon.svelte';
	import BrandLogo from './BrandLogo.svelte';
</script>

<footer class="border-t border-surface-border bg-bg-secondary">
	<div class="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between gap-6 flex-col sm:flex-row">
		<div class="flex items-center gap-3">
			<BrandLogo size="sm" />
			<span class="font-mono text-xs text-text-tertiary hidden sm:inline">© 2025</span>
		</div>

		<div class="flex items-center gap-5">
			<a href="/canvas" class="font-mono text-xs text-text-secondary hover:text-accent-primary transition-colors">Canvas</a>
			<a href="/kanban" class="font-mono text-xs text-text-secondary hover:text-accent-primary transition-colors">Kanban</a>
			<a href="/skills" class="font-mono text-xs text-text-secondary hover:text-accent-primary transition-colors">Skills</a>
			<a href="https://github.com/vibeforge1111/vibeship-spawner-skills" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 font-mono text-xs text-text-secondary hover:text-accent-primary transition-colors">
				<Icon name="github" size={12} />
				<span>GitHub</span>
			</a>
		</div>
	</div>
</footer>
