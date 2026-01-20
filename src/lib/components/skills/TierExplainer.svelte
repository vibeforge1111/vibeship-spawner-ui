<script lang="ts">
	import Icon from '../Icon.svelte';
</script>

<div class="grid md:grid-cols-2 gap-4 mb-8">
	<!-- Free Tier -->
	<div class="group p-5 bg-bg-secondary border border-surface-border hover:border-accent-primary/30 transition-all">
		<div class="flex items-start justify-between mb-3">
			<div class="flex items-center gap-2">
				<div class="px-2.5 py-1 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary font-mono text-xs font-medium">
					FREE
				</div>
				<span class="font-display font-semibold text-text-primary">Open Source</span>
			</div>
			<a
				href="https://github.com/vibeship/skills"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-1 text-text-tertiary hover:text-accent-primary transition-colors"
			>
				<Icon name="github" size={16} />
			</a>
		</div>

		<p class="text-sm text-text-secondary mb-4">
			Full-featured H70 skills available on GitHub. Includes identity, patterns, anti-patterns, and sharp edges.
		</p>

		<div class="space-y-2">
			<div class="flex items-center gap-2 text-sm text-text-secondary">
				<Icon name="check" size={14} class="text-green-500" />
				<span>Complete skill content</span>
			</div>
			<div class="flex items-center gap-2 text-sm text-text-secondary">
				<Icon name="check" size={14} class="text-green-500" />
				<span>Community maintained</span>
			</div>
			<div class="flex items-center gap-2 text-sm text-text-secondary">
				<Icon name="check" size={14} class="text-green-500" />
				<span>Customizable for your needs</span>
			</div>
		</div>
	</div>

	<!-- Pro Tier -->
	<div class="group relative p-5 bg-bg-secondary border border-accent-secondary/30 hover:border-accent-secondary/50 transition-all">
		<!-- Pro badge -->
		<div class="absolute -top-2 -right-2 px-2 py-0.5 bg-accent-secondary text-bg-primary font-mono text-[10px] font-bold uppercase">
			H70 Format
		</div>

		<div class="flex items-start justify-between mb-3">
			<div class="flex items-center gap-2">
				<div class="flex items-center gap-1 px-2.5 py-1 bg-accent-secondary/10 border border-accent-secondary/30 text-accent-secondary font-mono text-xs font-medium">
					<Icon name="crown" size={12} />
					PRO
				</div>
				<span class="font-display font-semibold text-text-primary">H70 Skills</span>
			</div>
		</div>

		<p class="text-sm text-text-secondary mb-4">
			Production-ready from the first prompt. Identity, patterns, and anti-patterns that make Claude build like a senior engineer.
		</p>

		<div class="space-y-2 mb-4">
			<div class="flex items-center gap-2 text-sm text-text-secondary">
				<Icon name="rocket" size={14} class="text-accent-secondary" />
				<span>Ship-quality code, first try</span>
			</div>
			<div class="flex items-center gap-2 text-sm text-text-secondary">
				<Icon name="zap" size={14} class="text-accent-secondary" />
				<span>60-70% less token usage</span>
			</div>
			<div class="flex items-center gap-2 text-sm text-text-secondary">
				<Icon name="users" size={14} class="text-accent-secondary" />
				<span>Battle-tested by thousands of devs</span>
			</div>
		</div>

		<a
			href="/pricing"
			class="inline-flex items-center gap-2 px-4 py-2 bg-accent-secondary text-bg-primary font-mono text-sm font-medium hover:bg-accent-secondary/90 transition-colors"
		>
			<span>Subscribe</span>
			<Icon name="chevron-right" size={14} />
		</a>
	</div>
</div>
