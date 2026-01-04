<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
</script>

<svelte:head>
	<title>Create Skills - Vibeship Spawner</title>
</svelte:head>

<div class="min-h-screen flex flex-col bg-bg-primary">
	<Navbar />

	<main class="flex-1 py-16">
		<div class="max-w-4xl mx-auto px-6">
			<!-- Header -->
			<div class="mb-12">
				<h1 class="font-serif text-4xl text-text-primary mb-4">Create Your Own Skills</h1>
				<p class="text-text-secondary text-lg">
					Build custom skills to extend Claude's capabilities for your specific domain.
				</p>
			</div>

			<!-- Quick Start -->
			<div class="mb-12 p-6 border border-accent-primary bg-accent-primary/5">
				<h2 class="font-serif text-xl text-text-primary mb-4">Quick Start</h2>
				<pre class="p-4 bg-bg-primary border border-surface-border overflow-x-auto text-sm font-mono text-text-primary"><code># Clone the skills template
git clone https://github.com/vibeship/skill-template.git my-skill
cd my-skill

# Edit your skill
code skill.yaml

# Test locally
spawner skill test ./skill.yaml</code></pre>
			</div>

			<!-- Skill Structure -->
			<div class="mb-12">
				<h2 class="font-serif text-2xl text-text-primary mb-6">Skill File Structure</h2>

				<div class="space-y-4">
					<div class="p-4 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">skill.yaml</h3>
						<p class="text-sm text-text-secondary mb-3">Main skill definition with identity, triggers, and metadata</p>
						<pre class="p-3 bg-bg-primary border border-surface-border text-xs font-mono overflow-x-auto"><code>id: my-custom-skill
name: My Custom Skill
description: Does something amazing
category: development
tags: [custom, example]
triggers:
  - "when user asks about X"
  - "when implementing Y"</code></pre>
					</div>

					<div class="p-4 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">patterns.md</h3>
						<p class="text-sm text-text-secondary mb-3">Best practices and implementation patterns</p>
						<pre class="p-3 bg-bg-primary border border-surface-border text-xs font-mono overflow-x-auto"><code># Patterns

## Pattern 1: Basic Usage
When doing X, always remember to...

## Pattern 2: Advanced Usage
For complex scenarios...</code></pre>
					</div>

					<div class="p-4 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">anti-patterns.md</h3>
						<p class="text-sm text-text-secondary mb-3">Common mistakes to avoid</p>
						<pre class="p-3 bg-bg-primary border border-surface-border text-xs font-mono overflow-x-auto"><code># Anti-Patterns

## Don't Do This
Avoid doing X because...

## Better Alternative
Instead, do Y...</code></pre>
					</div>

					<div class="p-4 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">sharp-edges.yaml</h3>
						<p class="text-sm text-text-secondary mb-3">Gotchas and edge cases with detection patterns</p>
						<pre class="p-3 bg-bg-primary border border-surface-border text-xs font-mono overflow-x-auto"><code>edges:
  - id: common-mistake
    title: Common Mistake
    description: Watch out for...
    detection: "pattern to detect"
    fix: How to fix it</code></pre>
					</div>

					<div class="p-4 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">collaboration.yaml</h3>
						<p class="text-sm text-text-secondary mb-3">How this skill works with others</p>
						<pre class="p-3 bg-bg-primary border border-surface-border text-xs font-mono overflow-x-auto"><code>pairs_with:
  - other-skill-id
  - another-skill

handoffs:
  - trigger: "when needing database"
    to: database-skill</code></pre>
					</div>
				</div>
			</div>

			<!-- Categories -->
			<div class="mb-12">
				<h2 class="font-serif text-2xl text-text-primary mb-6">Skill Categories</h2>

				<div class="grid md:grid-cols-2 gap-4">
					{#each [
						{ name: 'development', desc: 'Core programming skills' },
						{ name: 'frameworks', desc: 'Framework-specific patterns' },
						{ name: 'integration', desc: 'Third-party service integrations' },
						{ name: 'pattern', desc: 'Design and architecture patterns' },
						{ name: 'design', desc: 'UI/UX design skills' },
						{ name: 'marketing', desc: 'Marketing and growth skills' },
						{ name: 'strategy', desc: 'Business strategy skills' },
						{ name: 'product', desc: 'Product management skills' }
					] as category}
						<div class="p-4 border border-surface-border">
							<h3 class="font-mono text-accent-primary">{category.name}</h3>
							<p class="text-sm text-text-secondary">{category.desc}</p>
						</div>
					{/each}
				</div>
			</div>

			<!-- Publishing -->
			<div class="mb-12">
				<h2 class="font-serif text-2xl text-text-primary mb-6">Publishing Your Skill</h2>

				<div class="space-y-4">
					<div class="flex items-start gap-4 p-4 border border-surface-border">
						<div class="w-8 h-8 flex items-center justify-center border border-accent-primary text-accent-primary font-mono text-sm flex-shrink-0">1</div>
						<div>
							<h3 class="font-medium text-text-primary">Test Locally</h3>
							<p class="text-sm text-text-secondary">Run <code class="bg-surface px-1">spawner skill test</code> to validate your skill</p>
						</div>
					</div>

					<div class="flex items-start gap-4 p-4 border border-surface-border">
						<div class="w-8 h-8 flex items-center justify-center border border-accent-primary text-accent-primary font-mono text-sm flex-shrink-0">2</div>
						<div>
							<h3 class="font-medium text-text-primary">Score Check</h3>
							<p class="text-sm text-text-secondary">Aim for 80+ score using <code class="bg-surface px-1">spawner skill score</code></p>
						</div>
					</div>

					<div class="flex items-start gap-4 p-4 border border-surface-border">
						<div class="w-8 h-8 flex items-center justify-center border border-accent-primary text-accent-primary font-mono text-sm flex-shrink-0">3</div>
						<div>
							<h3 class="font-medium text-text-primary">Submit PR</h3>
							<p class="text-sm text-text-secondary">Open a pull request to the <a href="https://github.com/vibeship/spawner-skills" class="text-accent-primary hover:underline">spawner-skills</a> repo</p>
						</div>
					</div>

					<div class="flex items-start gap-4 p-4 border border-surface-border">
						<div class="w-8 h-8 flex items-center justify-center border border-accent-primary text-accent-primary font-mono text-sm flex-shrink-0">4</div>
						<div>
							<h3 class="font-medium text-text-primary">Review & Merge</h3>
							<p class="text-sm text-text-secondary">Once reviewed, your skill will be available to all Spawner users</p>
						</div>
					</div>
				</div>
			</div>

			<!-- CTA -->
			<div class="text-center p-8 border border-surface-border bg-bg-secondary">
				<h2 class="font-serif text-xl text-text-primary mb-4">Ready to build?</h2>
				<p class="text-text-secondary mb-6">Check out existing skills for inspiration</p>
				<a
					href="/skills"
					class="inline-block px-6 py-2 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
				>
					Browse Skills
				</a>
			</div>
		</div>
	</main>

	<Footer />
</div>
