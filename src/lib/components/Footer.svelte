<script lang="ts">
	import Icon from './Icon.svelte';
</script>

<footer class="border-t border-surface-border bg-bg-secondary">
	<div class="max-w-6xl mx-auto px-8 py-6">
		<div class="flex justify-between gap-8 flex-col md:flex-row">
			<div class="max-w-[280px]">
				<a href="/" class="flex items-center gap-1.5 mb-3">
					<img src="/logo.png" alt="vibeship" class="w-5 h-5" />
					<span class="text-text-primary text-[1.1rem]" style="font-family: 'Instrument Serif', Georgia, serif;">vibeship</span>
					<span class="text-accent-primary text-[1.1rem]" style="font-family: 'Instrument Serif', Georgia, serif;">spawner</span>
				</a>
				<p class="font-mono text-sm text-text-tertiary">Mission control for local agent execution.</p>
			</div>

			<div class="flex gap-10">
				<div class="flex flex-col gap-2">
					<h4 class="font-mono text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2">Product</h4>
					<a href="/canvas" class="inline-flex items-center gap-2 font-mono text-sm text-text-secondary hover:text-accent-primary transition-colors">
						<Icon name="grid" size={12} />
						<span>Canvas</span>
					</a>
					<a href="/missions" class="inline-flex items-center gap-2 font-mono text-sm text-text-secondary hover:text-accent-primary transition-colors">
						<Icon name="play" size={12} />
						<span>Missions</span>
					</a>
					<a href="/skills" class="inline-flex items-center gap-2 font-mono text-sm text-text-secondary hover:text-accent-primary transition-colors">
						<Icon name="layers" size={12} />
						<span>Skills</span>
					</a>
				</div>

				<div class="flex flex-col gap-2">
					<h4 class="font-mono text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2">Resources</h4>
					<a href="https://github.com/vibeforge1111/vibeship-spawner-skills" target="_blank" rel="noopener" class="inline-flex items-center gap-2 font-mono text-sm text-text-secondary hover:text-accent-primary transition-colors">
						<Icon name="github" size={12} />
						<span>GitHub</span>
					</a>
					<a href="https://claude.com/blog/skills" target="_blank" rel="noopener" class="inline-flex items-center gap-2 font-mono text-sm text-text-secondary hover:text-accent-primary transition-colors">
						<Icon name="external-link" size={12} />
						<span>Claude on Skills</span>
					</a>
				</div>
			</div>
		</div>
	</div>

	<div class="max-w-6xl mx-auto px-8 py-4 border-t border-surface-border text-center">
		<span class="font-mono text-xs text-text-tertiary">© 2025 vibeship</span>
	</div>
</footer>
