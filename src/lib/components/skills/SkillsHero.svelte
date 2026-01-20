<script lang="ts">
	import Icon from '../Icon.svelte';

	// Mini workflow showing skill collaboration
	const workflowNodes = [
		{ id: 'product', label: 'Product', icon: 'compass' },
		{ id: 'backend', label: 'Backend', icon: 'server' },
		{ id: 'frontend', label: 'Frontend', icon: 'layout' },
		{ id: 'database', label: 'Database', icon: 'database' },
		{ id: 'security', label: 'Security', icon: 'shield' },
		{ id: 'devops', label: 'DevOps', icon: 'cloud' }
	];
</script>

<div class="relative overflow-hidden bg-gradient-to-br from-bg-secondary via-bg-primary to-bg-secondary border border-surface-border mb-8">
	<!-- Background pattern -->
	<div class="absolute inset-0 opacity-5">
		<div class="absolute inset-0" style="background-image: radial-gradient(circle at 1px 1px, currentColor 1px, transparent 1px); background-size: 24px 24px;"></div>
	</div>

	<div class="relative p-6 md:p-8">
		<div class="flex flex-col lg:flex-row lg:items-center gap-6">
			<!-- Text content -->
			<div class="flex-1">
				<div class="flex items-center gap-2 mb-3">
					<div class="w-8 h-8 flex items-center justify-center bg-accent-primary/10 border border-accent-primary/30">
						<Icon name="sparkles" size={16} class="text-accent-primary" />
					</div>
					<span class="font-mono text-xs text-accent-primary uppercase tracking-wider">Skill Library</span>
				</div>

				<h1 class="text-2xl md:text-3xl font-display font-bold text-text-primary mb-3">
					A Team of <span class="text-accent-primary">World-Class Experts</span>
				</h1>

				<p class="text-text-secondary max-w-xl text-sm md:text-base">
					Each skill transforms Claude into a domain specialist. Skills collaborate through intelligent handoffs,
					building complete solutions like a well-coordinated team.
				</p>
			</div>

			<!-- Compact workflow diagram -->
			<div class="lg:w-80 flex-shrink-0">
				<div class="bg-bg-primary/50 border border-surface-border p-4">
					<div class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-3 text-center">
						Skills Collaborate
					</div>

					<!-- Workflow nodes in a compact grid -->
					<div class="grid grid-cols-3 gap-2">
						{#each workflowNodes as node, i}
							<div
								class="group relative p-2 bg-bg-secondary border border-surface-border hover:border-accent-primary/50 transition-all cursor-default"
								style="animation: fadeInUp 0.3s ease-out {i * 0.05}s both;"
							>
								<div class="flex flex-col items-center gap-1">
									<div class="w-6 h-6 flex items-center justify-center text-accent-primary/70 group-hover:text-accent-primary transition-colors">
										<Icon name={node.icon} size={14} />
									</div>
									<span class="text-[10px] font-mono text-text-tertiary group-hover:text-text-secondary transition-colors">
										{node.label}
									</span>
								</div>

								<!-- Connection dots -->
								{#if i < 5}
									<div class="absolute -right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-accent-primary/30 rounded-full"></div>
								{/if}
							</div>
						{/each}
					</div>

					<!-- Arrow showing flow -->
					<div class="flex items-center justify-center gap-2 mt-3 text-text-tertiary">
						<span class="text-[10px] font-mono">Input</span>
						<div class="flex-1 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent"></div>
						<Icon name="chevron-right" size={12} class="text-accent-primary/50" />
						<div class="flex-1 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent"></div>
						<span class="text-[10px] font-mono">Output</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
