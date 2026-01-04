<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';

	const articles = [
		{
			category: 'Getting Started',
			items: [
				{ title: 'What is Spawner?', slug: 'what-is-spawner', description: 'Introduction to the Spawner ecosystem' },
				{ title: 'Installing Spawner', slug: 'installation', description: 'How to install and configure Spawner' },
				{ title: 'Your First Workflow', slug: 'first-workflow', description: 'Create your first canvas workflow' }
			]
		},
		{
			category: 'Skills',
			items: [
				{ title: 'Understanding Skills', slug: 'understanding-skills', description: 'What skills are and how they work' },
				{ title: 'Using Skills in Claude', slug: 'skills-in-claude', description: 'Invoke skills in Claude Code and Desktop' },
				{ title: 'Creating Custom Skills', slug: 'custom-skills', description: 'Build your own domain-specific skills' }
			]
		},
		{
			category: 'Canvas',
			items: [
				{ title: 'Canvas Basics', slug: 'canvas-basics', description: 'Learn the canvas interface' },
				{ title: 'Connecting Nodes', slug: 'connecting-nodes', description: 'How to connect skills together' },
				{ title: 'Validating Workflows', slug: 'validating', description: 'Check your workflow for issues' },
				{ title: 'Running Workflows', slug: 'running', description: 'Execute your workflow' }
			]
		},
		{
			category: 'MCP Integration',
			items: [
				{ title: 'What is MCP?', slug: 'what-is-mcp', description: 'Model Context Protocol explained' },
				{ title: 'Setting up MCP Server', slug: 'mcp-setup', description: 'Configure the Spawner MCP server' },
				{ title: 'MCP Tools Reference', slug: 'mcp-tools', description: 'Available MCP tools and usage' }
			]
		},
		{
			category: 'Advanced',
			items: [
				{ title: 'Skill Collaboration', slug: 'collaboration', description: 'How skills work together' },
				{ title: 'Sharp Edges', slug: 'sharp-edges', description: 'Common pitfalls and gotchas' },
				{ title: 'Best Practices', slug: 'best-practices', description: 'Recommended patterns and approaches' }
			]
		}
	];

	let searchQuery = $state('');

	const filteredArticles = $derived(
		searchQuery
			? articles.map(category => ({
					...category,
					items: category.items.filter(
						item =>
							item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
							item.description.toLowerCase().includes(searchQuery.toLowerCase())
					)
				})).filter(category => category.items.length > 0)
			: articles
	);
</script>

<svelte:head>
	<title>Knowledge Base - Vibeship Spawner</title>
</svelte:head>

<div class="min-h-screen flex flex-col bg-bg-primary">
	<Navbar />

	<main class="flex-1 py-16">
		<div class="max-w-4xl mx-auto px-6">
			<!-- Header -->
			<div class="text-center mb-12">
				<h1 class="font-serif text-4xl text-text-primary mb-4">Knowledge Base</h1>
				<p class="text-text-secondary text-lg">
					Learn how to use Spawner effectively
				</p>
			</div>

			<!-- Search -->
			<div class="max-w-xl mx-auto mb-12">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search articles..."
					class="w-full px-4 py-3 bg-surface border border-surface-border text-text-primary font-mono focus:outline-none focus:border-accent-primary"
				/>
			</div>

			<!-- Articles -->
			<div class="space-y-12">
				{#each filteredArticles as category}
					<div>
						<h2 class="font-serif text-xl text-text-primary mb-4 pb-2 border-b border-surface-border">
							{category.category}
						</h2>
						<div class="grid gap-4">
							{#each category.items as article}
								<a
									href="/kb/{article.slug}"
									class="block p-4 border border-surface-border hover:border-accent-primary transition-all group"
								>
									<h3 class="font-medium text-text-primary group-hover:text-accent-primary transition-colors">
										{article.title}
									</h3>
									<p class="text-sm text-text-secondary mt-1">{article.description}</p>
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			{#if filteredArticles.length === 0}
				<div class="text-center py-12">
					<p class="text-text-tertiary">No articles found for "{searchQuery}"</p>
					<button
						onclick={() => (searchQuery = '')}
						class="mt-4 text-sm text-accent-primary hover:underline"
					>
						Clear search
					</button>
				</div>
			{/if}

			<!-- Quick Links -->
			<div class="mt-16 p-8 border border-surface-border bg-bg-secondary text-center">
				<h2 class="font-serif text-xl text-text-primary mb-4">Can't find what you need?</h2>
				<div class="flex flex-wrap justify-center gap-4">
					<a href="/guide" class="text-accent-primary hover:underline">MCP Setup Guide</a>
					<span class="text-text-tertiary">•</span>
					<a href="https://github.com/vibeship/spawner" class="text-accent-primary hover:underline">GitHub</a>
					<span class="text-text-tertiary">•</span>
					<a href="https://discord.gg/vibeship" class="text-accent-primary hover:underline">Discord</a>
				</div>
			</div>
		</div>
	</main>

	<Footer />
</div>
