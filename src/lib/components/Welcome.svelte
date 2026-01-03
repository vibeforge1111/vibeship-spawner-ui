<script lang="ts">
	import Navbar from './Navbar.svelte';
	import Footer from './Footer.svelte';

	let { onStart }: { onStart?: () => void } = $props();

	let inputValue = $state('');
	let isFocused = $state(false);

	const tools = [
		{
			number: '01',
			name: 'spawn()',
			title: 'Spawner',
			desc: 'Visual orchestration for AI skill chains. Connect 273+ specialized skills.',
			stat: '273+',
			statLabel: 'Skills',
			href: '/canvas'
		},
		{
			number: '02',
			name: 'recall()',
			title: 'Mind',
			desc: 'Semantic memory that persists across sessions. Never lose context again.',
			stat: '∞',
			statLabel: 'Memory',
			href: '/mind'
		},
		{
			number: '03',
			name: 'scan()',
			title: 'Scanner',
			desc: 'Security scanning with Opengrep, Trivy, and Gitleaks. Find vulnerabilities fast.',
			stat: '2000+',
			statLabel: 'Vuln Types',
			href: '/scanner'
		},
		{
			number: '04',
			name: 'learn()',
			title: 'Knowledge Base',
			desc: 'Curated articles and guides for the vibe coding ecosystem.',
			stat: '50+',
			statLabel: 'Articles',
			href: '/kb'
		}
	];

	function handleSubmit() {
		if (inputValue.trim() && onStart) {
			onStart();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<div class="min-h-screen bg-bg-primary">
	<!-- Navbar -->
	<Navbar />

	<!-- Hero Section -->
	<section class="max-w-6xl mx-auto px-6 pt-20 pb-16">
		<div class="text-center mb-16 animate-fade-in">
			<p class="text-accent-primary font-mono text-sm mb-4 tracking-wider">THE VIBE CODING ECOSYSTEM</p>
			<h1 class="text-display font-display text-text-primary mb-6">
				Build with <span class="text-accent-primary">Claude</span>.<br/>
				Ship with <span class="text-accent-primary">Confidence</span>.
			</h1>
			<p class="text-lg text-text-secondary max-w-2xl mx-auto">
				Visual orchestration meets semantic memory. Connect skills, validate with sharp edges, deploy anywhere.
			</p>
		</div>

		<!-- Main Input -->
		<div class="max-w-2xl mx-auto mb-20 animate-slide-up" style="animation-delay: 100ms;">
			<div
				class="relative border transition-all duration-normal"
				class:bg-vibe-teal-glow={isFocused}
				class:border-accent-primary={isFocused}
				class:shadow-glow-teal={isFocused}
				class:bg-bg-secondary={!isFocused}
				class:border-surface-border={!isFocused}
			>
				<textarea
					bind:value={inputValue}
					onfocus={() => isFocused = true}
					onblur={() => isFocused = false}
					onkeydown={handleKeydown}
					placeholder="Describe what you want to build..."
					rows="3"
					class="w-full bg-transparent px-5 py-4 text-lg text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none font-mono"
				></textarea>

				<div class="flex items-center justify-between px-5 py-3 border-t border-surface-border">
					<div class="flex items-center gap-2 text-sm text-text-tertiary font-mono">
						<kbd class="px-1.5 py-0.5 bg-surface rounded text-xs border border-surface-border">Enter</kbd>
						<span>to spawn</span>
					</div>

					<button
						onclick={handleSubmit}
						disabled={!inputValue.trim()}
						class="group flex items-center gap-2 px-4 py-2 bg-accent-primary text-bg-primary font-medium hover:bg-accent-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<span>spawn()</span>
						<svg class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	</section>

	<!-- Tools Grid -->
	<section class="max-w-6xl mx-auto px-6 pb-20">
		<div class="grid md:grid-cols-2 gap-4">
			{#each tools as tool, i}
				<a
					href={tool.href}
					class="group relative p-6 bg-bg-secondary border border-surface-border hover:border-vibe-teal-border hover:shadow-card-glow transition-all duration-normal animate-slide-up"
					style="animation-delay: {150 + i * 50}ms;"
				>
					<!-- Number badge -->
					<span class="absolute top-6 right-6 text-xs font-mono text-text-tertiary">{tool.number}</span>

					<!-- Function name -->
					<p class="font-mono text-accent-primary text-sm mb-2">{tool.name}</p>

					<!-- Title -->
					<h3 class="text-xl font-display font-semibold text-text-primary mb-2">{tool.title}</h3>

					<!-- Description -->
					<p class="text-sm text-text-secondary mb-6 leading-relaxed">{tool.desc}</p>

					<!-- Stat and CTA -->
					<div class="flex items-end justify-between">
						<div>
							<p class="text-3xl font-display font-bold text-text-primary">{tool.stat}</p>
							<p class="text-xs text-text-tertiary uppercase tracking-wider">{tool.statLabel}</p>
						</div>
						<span class="flex items-center gap-1 text-sm text-accent-primary font-medium group-hover:gap-2 transition-all">
							Open
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
							</svg>
						</span>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<!-- Ecosystem Callout -->
	<section class="border-t border-surface-border">
		<div class="max-w-6xl mx-auto px-6 py-16 text-center">
			<p class="font-mono text-sm text-text-tertiary mb-4">MCP-NATIVE</p>
			<h2 class="text-2xl font-display font-semibold text-text-primary mb-4">
				<span class="text-accent-secondary">Mind</span> + <span class="text-accent-primary">Spawner</span> = Full Stack Claude
			</h2>
			<p class="text-text-secondary max-w-xl mx-auto">
				Semantic memory meets visual orchestration. Build complex AI workflows that remember context across sessions.
			</p>
		</div>
	</section>

	<!-- Footer -->
	<Footer />
</div>
