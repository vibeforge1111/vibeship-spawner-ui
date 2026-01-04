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
			desc: 'Visual orchestration for AI skill chains. Connect 450+ specialized skills.',
			stat: '450+',
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
			<p class="font-mono text-sm mb-4 tracking-wider"><span class="text-accent-primary">SKILLED AGENTS</span> <span class="text-text-tertiary">|</span> <span class="text-accent-secondary">CONTEXT/MEMORY LAYER</span> <span class="text-text-tertiary">|</span> <span class="text-accent-primary">AUTOMATED PIPELINES</span></p>
			<h1 class="text-[3.5rem] leading-tight font-serif font-normal text-text-primary mb-6">
				A Framework To <span class="text-accent-primary relative inline-block">Level Up Claude<span class="claude-underline"></span></span>
			</h1>
			<p class="text-lg text-text-secondary max-w-2xl mx-auto mb-6">
				450+ specialized skills transform Claude into domain experts. Chain them into pipelines.
				Give your agents and teams persistent memory with Mind.
			</p>
			<div class="flex items-center justify-center gap-6 text-sm font-mono text-text-tertiary">
				<span class="flex items-center gap-2">
					<span class="w-2 h-2 bg-accent-primary"></span>
					Better than regular Opus 4.5
				</span>
				<span class="flex items-center gap-2">
					<span class="w-2 h-2 bg-accent-secondary"></span>
					Memory that persists
				</span>
			</div>
		</div>

		<!-- Main Input -->
		<div class="max-w-2xl mx-auto mb-20 animate-slide-up" style="animation-delay: 100ms;">
			<div
				class="input-container relative border bg-bg-secondary transition-all duration-normal outline-none ring-0"
				class:border-accent-primary={isFocused}
				class:input-glow={isFocused}
				class:border-surface-border={!isFocused}
			>
				<textarea
					bind:value={inputValue}
					onfocus={() => isFocused = true}
					onblur={() => isFocused = false}
					onkeydown={handleKeydown}
					placeholder="Describe what you want to build..."
					rows="3"
					class="w-full bg-transparent px-5 py-4 text-lg text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono"
				></textarea>

				<div
					class="flex items-center justify-between px-5 py-3 border-t transition-colors duration-normal"
					class:border-accent-primary={isFocused}
					class:border-surface-border={!isFocused}
				>
					<div class="flex items-center gap-2 text-sm text-text-tertiary font-mono">
						<kbd class="px-1.5 py-0.5 bg-surface rounded text-xs border border-surface-border">Enter</kbd>
						<span>to spawn</span>
					</div>

					<button
						onclick={handleSubmit}
						disabled={!inputValue.trim()}
						class="group flex items-center gap-2 px-4 py-2 font-medium transition-all disabled:cursor-not-allowed"
						class:button-active={inputValue.trim()}
						class:button-inactive={!inputValue.trim()}
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
					<h3 class="text-xl font-serif text-text-primary mb-2">{tool.title}</h3>

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
			<p class="font-mono text-sm text-text-tertiary mb-4">MCP-NATIVE ORCHESTRATION</p>
			<h2 class="text-2xl font-serif text-text-primary mb-4">
				<span class="text-accent-secondary">Mind</span> + <span class="text-accent-primary">Spawner</span> = Agents with Memory
			</h2>
			<p class="text-text-secondary max-w-xl mx-auto mb-8">
				Your pipelines remember. Your agents learn. Your teams share context.
				Build autonomous systems where every Claude instance has persistent memory.
			</p>
			<div class="flex flex-wrap items-center justify-center gap-8 text-sm">
				<div class="text-center">
					<p class="text-2xl font-display font-bold text-accent-primary mb-1">450+</p>
					<p class="font-mono text-text-tertiary text-xs uppercase tracking-wider">Skills</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-display font-bold text-accent-secondary mb-1">∞</p>
					<p class="font-mono text-text-tertiary text-xs uppercase tracking-wider">Memory</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-display font-bold text-text-primary mb-1">0</p>
					<p class="font-mono text-text-tertiary text-xs uppercase tracking-wider">Context Lost</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<Footer />
</div>

<style>
	.input-glow {
		box-shadow: inset 0 0 30px -8px rgb(45 212 191 / 0.5);
	}

	.button-inactive {
		background: transparent;
		border: 1px solid rgb(45 212 191 / 0.5);
		color: rgb(45 212 191);
		opacity: 0.7;
	}

	.button-active {
		background: rgb(45 212 191);
		border: 1px solid rgb(45 212 191);
		color: rgb(15 23 42);
		box-shadow: 0 0 10px rgb(45 212 191 / 0.4);
	}

	.button-active:hover {
		background: rgb(94 234 212);
		border-color: rgb(94 234 212);
	}

	/* Override global focus-visible ring that causes border overflow */
	:global(.input-container textarea:focus),
	:global(.input-container textarea:focus-visible) {
		outline: none !important;
		--tw-ring-offset-width: 0px !important;
		--tw-ring-shadow: 0 0 #0000 !important;
		--tw-ring-color: transparent !important;
		box-shadow: none !important;
	}

	.input-container.input-glow {
		box-shadow: inset 0 0 30px -8px rgb(45 212 191 / 0.5) !important;
	}
</style>
