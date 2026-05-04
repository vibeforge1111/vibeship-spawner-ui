<script lang="ts">
	import Icon from './Icon.svelte';
	import BrandLogo from './BrandLogo.svelte';

	let { publicPreviewLocked = false }: { publicPreviewLocked?: boolean } = $props();
</script>

<footer class="border-t border-surface-border bg-bg-secondary">
	<div class="max-w-6xl mx-auto px-6 py-10 flex items-center justify-between gap-6 flex-col sm:flex-row">
		<div class="flex items-center gap-3">
			<BrandLogo size="sm" />
			<span class="font-mono text-xs text-text-tertiary tracking-widest hidden sm:inline">© 2025</span>
		</div>

		<div class="flex items-center gap-6">
			{#if publicPreviewLocked}
				<a href="https://sparkswarm.ai/waitlist" class="font-sans text-sm text-text-secondary hover:text-accent-primary transition-colors">Waitlist</a>
				<span class="font-sans text-sm text-text-tertiary">Private workspace access</span>
			{:else}
				<a href="/canvas" class="font-sans text-sm text-text-secondary hover:text-accent-primary transition-colors">Canvas</a>
				<a href="/kanban" class="font-sans text-sm text-text-secondary hover:text-accent-primary transition-colors">Kanban</a>
				<a href="/skills" class="font-sans text-sm text-text-secondary hover:text-accent-primary transition-colors">Skills</a>
			{/if}
			<a href="https://github.com/vibeforge1111/vibeship-spawner-ui" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 font-sans text-sm text-text-secondary hover:text-accent-primary transition-colors">
				<Icon name="github" size={14} />
				<span>GitHub</span>
			</a>
		</div>
	</div>
</footer>
