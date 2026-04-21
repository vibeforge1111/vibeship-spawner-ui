<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';

	// External tools (in separate repos)
	const externalTools = [
		{
			id: 'contentforge',
			name: 'ContentForge',
			description: 'Analyze any content for viral potential with our 4-agent pipeline',
			agents: ['Marketing', 'Copywriting', 'Research', 'Psychology'],
			color: 'accent-primary',
			repo: 'https://github.com/vibeforge1111/vibe-contentforge'
		}
	];
</script>

<svelte:head>
	<title>Tools - Spawner</title>
</svelte:head>

<Navbar />

<div class="min-h-screen bg-bg-primary">
	<section class="max-w-6xl mx-auto px-6 pt-16 pb-12">
		<div class="text-center mb-16">
			<p class="font-mono text-xs text-accent-primary mb-3 tracking-widest">STANDALONE TOOLS</p>
			<h1 class="text-4xl font-serif text-text-primary mb-4">Tools</h1>
			<p class="text-text-secondary max-w-2xl mx-auto">
				Powerful standalone tools that also work as pipeline nodes.
				Use them directly or chain them into automated workflows.
			</p>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			<!-- Coming Soon placeholder -->
			<div class="bg-bg-secondary border border-dashed border-surface-border opacity-60">
				<div class="p-6">
					<div class="flex items-center gap-3 mb-4">
						<div class="w-10 h-10 flex items-center justify-center bg-surface-border text-text-tertiary">
							<span class="text-lg">+</span>
						</div>
						<h2 class="text-xl font-serif text-text-tertiary">More Coming</h2>
					</div>
					<p class="text-text-tertiary text-sm">
						Hook Writer, PRD Analyzer, and more tools are in development.
					</p>
				</div>
			</div>
		</div>

		<!-- External Tools (Separate Repos) -->
		{#if externalTools.length > 0}
			<div class="mt-16">
				<p class="font-mono text-xs text-text-tertiary mb-6 tracking-widest">STANDALONE TOOLS (SEPARATE REPOS)</p>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each externalTools as tool}
						<a
							href={tool.repo}
							target="_blank"
							rel="noopener noreferrer"
							class="group bg-bg-secondary border border-surface-border hover:border-accent-primary/50 transition-all"
						>
							<div class="p-6">
								<div class="flex items-center gap-3 mb-4">
									<div class="w-10 h-10 flex items-center justify-center bg-accent-primary/20 text-accent-primary">
										<span class="text-lg font-bold">{tool.name.charAt(0)}</span>
									</div>
									<h2 class="text-xl font-serif text-text-primary group-hover:text-accent-primary transition-colors">
										{tool.name}
									</h2>
									<span class="text-xs text-text-tertiary ml-auto">External</span>
								</div>
								<p class="text-text-secondary text-sm mb-4">{tool.description}</p>
								<div class="flex flex-wrap gap-2">
									{#each tool.agents as agent}
										<span class="text-xs font-mono px-2 py-1 bg-bg-primary border border-surface-border text-text-tertiary">
											{agent}
										</span>
									{/each}
								</div>
							</div>
							<div class="px-6 py-3 border-t border-surface-border bg-bg-primary/50 flex items-center justify-between">
								<span class="text-xs font-mono text-text-tertiary">View on GitHub</span>
								<span class="text-accent-primary group-hover:translate-x-1 transition-transform">↗</span>
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	</section>
</div>
