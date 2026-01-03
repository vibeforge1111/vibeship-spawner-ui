<script lang="ts">
	import Icon from './Icon.svelte';

	let copied = $state(false);

	async function copyInstallCommand() {
		await navigator.clipboard.writeText('npx github:vibeforge1111/vibeship-spawner-skills install --mcp');
		copied = true;
		setTimeout(() => copied = false, 2000);
	}
</script>

<footer class="border-t border-surface-border bg-bg-secondary">
	<!-- Install Command Bar -->
	<div class="flex items-center justify-center gap-3 py-4 px-4 bg-bg-tertiary border-b border-surface-border">
		<code class="font-mono text-sm text-accent-primary bg-bg-primary px-4 py-2 border border-surface-border">
			npx github:vibeforge1111/vibeship-spawner-skills install --mcp
		</code>
		<button
			onclick={copyInstallCommand}
			class="font-mono text-xs text-text-secondary bg-bg-primary border border-surface-border px-3 py-2 cursor-pointer transition-all hover:bg-accent-primary hover:text-bg-primary hover:border-accent-primary"
		>
			{copied ? 'Copied!' : 'Copy'}
		</button>
	</div>

	<!-- Footer Content -->
	<div class="max-w-6xl mx-auto px-8 py-6">
		<div class="flex justify-between gap-8 flex-col md:flex-row">
			<!-- Brand -->
			<div class="max-w-[280px]">
				<a href="/" class="flex items-center gap-1.5 mb-3">
					<img src="/logo.png" alt="vibeship" class="w-5 h-5" />
					<span class="text-text-primary text-[1.1rem]" style="font-family: 'Instrument Serif', Georgia, serif;">vibeship</span>
					<span class="text-accent-primary text-[1.1rem]" style="font-family: 'Instrument Serif', Georgia, serif;">spawner</span>
				</a>
				<p class="font-mono text-sm text-text-tertiary">Give Claude the skills it's missing.</p>
			</div>

			<!-- Links -->
			<div class="flex gap-10">
				<!-- Product -->
				<div class="flex flex-col gap-2">
					<h4 class="font-mono text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2">Product</h4>
					<a href="/skills" class="inline-flex items-center gap-2 font-mono text-sm text-text-secondary hover:text-accent-primary transition-colors">
						<Icon name="layers" size={12} />
						<span>Skills</span>
					</a>
					<a href="/guide" class="inline-flex items-center gap-2 font-mono text-sm text-text-secondary hover:text-accent-primary transition-colors">
						<Icon name="book" size={12} />
						<span>Guide</span>
					</a>
				</div>

				<!-- Resources -->
				<div class="flex flex-col gap-2">
					<h4 class="font-mono text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-2">Resources</h4>
					<a href="https://github.com/vibeforge1111/vibeship-spawner-skills" target="_blank" rel="noopener" class="inline-flex items-center gap-2 font-mono text-sm text-text-secondary hover:text-accent-primary transition-colors">
						<Icon name="github" size={12} />
						<span>GitHub</span>
					</a>
					<a href="https://mind.vibeship.co" target="_blank" rel="noopener" class="inline-flex items-center gap-2 font-mono text-sm text-text-secondary hover:text-accent-primary transition-colors">
						<Icon name="brain" size={12} />
						<span>Mind</span>
					</a>
					<a href="https://claude.com/blog/skills" target="_blank" rel="noopener" class="inline-flex items-center gap-2 font-mono text-sm text-text-secondary hover:text-accent-primary transition-colors">
						<Icon name="external-link" size={12} />
						<span>Claude on Skills</span>
					</a>
				</div>
			</div>
		</div>
	</div>

	<!-- Bottom -->
	<div class="max-w-6xl mx-auto px-8 py-4 border-t border-surface-border text-center">
		<span class="font-mono text-xs text-text-tertiary">© 2025 vibeship</span>
	</div>
</footer>
