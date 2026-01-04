<script lang="ts">
	import Navbar from './Navbar.svelte';
	import Footer from './Footer.svelte';

	let { onStart }: { onStart?: () => void } = $props();

	let inputValue = $state('');
	let isFocused = $state(false);

	const skillCategories = [
		{ name: 'Frontend', count: 45, icon: '◧' },
		{ name: 'Backend', count: 62, icon: '⬡' },
		{ name: 'DevOps', count: 38, icon: '⚙' },
		{ name: 'Security', count: 41, icon: '⛨' },
		{ name: 'Data', count: 35, icon: '◉' },
		{ name: 'AI/ML', count: 28, icon: '◈' }
	];

	const benchmarks = [
		{ skill: 'nextjs-app-router', metric: 'Accuracy', value: '94%', baseline: '71%', improvement: '+32%' },
		{ skill: 'supabase-auth', metric: 'Success Rate', value: '98%', baseline: '82%', improvement: '+20%' },
		{ skill: 'react-patterns', metric: 'Code Quality', value: '91%', baseline: '68%', improvement: '+34%' }
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

	<!-- Section 1: Skilled Agents -->
	<section class="max-w-6xl mx-auto px-6 pb-24">
		<div class="grid lg:grid-cols-2 gap-12 items-center">
			<!-- Left: Content -->
			<div class="animate-slide-up" style="animation-delay: 150ms;">
				<p class="font-mono text-xs text-accent-primary mb-3 tracking-widest">01 — SKILLED AGENTS</p>
				<h2 class="text-3xl font-serif text-text-primary mb-4">
					Not generic LLMs.<br/>
					<span class="text-accent-primary">Specialized experts.</span>
				</h2>
				<p class="text-text-secondary mb-8 leading-relaxed">
					Each skill transforms Claude into a domain expert — with curated patterns,
					anti-patterns, and decision frameworks baked in. No more starting from zero.
				</p>

				<!-- Skill categories grid -->
				<div class="grid grid-cols-3 gap-3">
					{#each skillCategories as cat, i}
						<div
							class="group p-3 bg-bg-secondary border border-surface-border hover:border-accent-primary/30 transition-all cursor-default"
							style="animation-delay: {200 + i * 50}ms;"
						>
							<span class="text-lg mb-1 block text-accent-primary/70 group-hover:text-accent-primary transition-colors">{cat.icon}</span>
							<p class="text-sm text-text-primary font-medium">{cat.name}</p>
							<p class="text-xs text-text-tertiary font-mono">{cat.count} skills</p>
						</div>
					{/each}
				</div>
			</div>

			<!-- Right: Visual - Single terminal box, divided -->
			<div class="animate-slide-up" style="animation-delay: 200ms;">
				<div class="bg-bg-secondary border border-surface-border">
					<!-- Terminal header -->
					<div class="flex items-center gap-2 px-5 py-3 border-b border-surface-border">
						<span class="w-2.5 h-2.5 rounded-full bg-red-500/70"></span>
						<span class="w-2.5 h-2.5 rounded-full bg-yellow-500/70"></span>
						<span class="w-2.5 h-2.5 rounded-full bg-green-500/70"></span>
						<span class="ml-2 text-xs text-text-tertiary font-mono">the difference</span>
					</div>

					<!-- Without Skill - Top -->
					<div class="px-5 py-4">
						<p class="text-xs text-text-tertiary font-mono uppercase tracking-wider mb-3">Without Skill</p>
						<p class="text-sm text-text-secondary leading-relaxed">
							Generic output. You iterate, debug, and learn the edge cases yourself.
						</p>
					</div>

					<!-- Divider -->
					<div class="border-t border-dashed border-surface-border mx-5"></div>

					<!-- With Skill - Bottom -->
					<div class="px-5 py-4">
						<p class="text-xs text-accent-primary font-mono uppercase tracking-wider mb-3">With Skill</p>
						<p class="text-sm text-text-primary leading-relaxed">
							Expert-level from the start. Anthropic recommends skills over general prompting — each of ours is benchmarked to prove it.
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Section 2: Benchmarked Performance -->
	<section class="border-t border-surface-border">
		<div class="max-w-6xl mx-auto px-6 py-24">
			<div class="grid lg:grid-cols-2 gap-12 items-center">
				<!-- Left: Benchmarks visual -->
				<div class="order-2 lg:order-1 animate-slide-up" style="animation-delay: 250ms;">
					<div class="space-y-4">
						{#each benchmarks as bench, i}
							<div class="p-4 bg-bg-secondary border border-surface-border">
								<div class="flex items-center justify-between mb-3">
									<span class="font-mono text-sm text-accent-primary">{bench.skill}</span>
									<span class="text-xs text-text-tertiary">{bench.metric}</span>
								</div>

								<!-- Progress bar comparison -->
								<div class="space-y-2">
									<div class="flex items-center gap-3">
										<span class="text-xs text-text-tertiary w-16">Baseline</span>
										<div class="flex-1 h-2 bg-surface-border rounded-full overflow-hidden">
											<div class="h-full bg-text-tertiary/50 rounded-full" style="width: {bench.baseline}"></div>
										</div>
										<span class="text-xs text-text-tertiary w-10">{bench.baseline}</span>
									</div>
									<div class="flex items-center gap-3">
										<span class="text-xs text-accent-primary w-16">Skilled</span>
										<div class="flex-1 h-2 bg-surface-border rounded-full overflow-hidden">
											<div class="h-full bg-accent-primary rounded-full transition-all duration-1000" style="width: {bench.value}"></div>
										</div>
										<span class="text-xs text-accent-primary w-10">{bench.value}</span>
									</div>
								</div>

								<p class="text-right mt-2">
									<span class="text-xs font-mono text-green-400">{bench.improvement}</span>
								</p>
							</div>
						{/each}
					</div>
				</div>

				<!-- Right: Content -->
				<div class="order-1 lg:order-2 animate-slide-up" style="animation-delay: 200ms;">
					<p class="font-mono text-xs text-accent-primary mb-3 tracking-widest">02 — BENCHMARKED</p>
					<h2 class="text-3xl font-serif text-text-primary mb-4">
						Every skill is<br/>
						<span class="text-accent-primary">tested and proven.</span>
					</h2>
					<p class="text-text-secondary mb-6 leading-relaxed">
						We don't just collect skills — we benchmark them. Each skill is tested against
						baseline Claude to measure real improvement in accuracy, code quality, and success rate.
					</p>
					<div class="flex items-center gap-6 text-sm">
						<div>
							<p class="text-2xl font-display font-bold text-accent-primary">+28%</p>
							<p class="text-xs text-text-tertiary">Avg. Improvement</p>
						</div>
						<div class="w-px h-10 bg-surface-border"></div>
						<div>
							<p class="text-2xl font-display font-bold text-text-primary">450+</p>
							<p class="text-xs text-text-tertiary">Skills Tested</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Section 3: Mind - Memory That Compounds -->
	<section class="border-t border-surface-border">
		<div class="max-w-6xl mx-auto px-6 py-24">
			<div class="text-center mb-16 animate-slide-up" style="animation-delay: 300ms;">
				<p class="font-mono text-xs text-accent-secondary mb-3 tracking-widest">03 — MIND</p>
				<h2 class="text-3xl font-serif text-text-primary mb-4">
					Memory that <span class="text-accent-secondary">compounds.</span>
				</h2>
				<p class="text-text-secondary max-w-2xl mx-auto">
					Agents don't just execute — they remember. Every decision, every context, every outcome
					is stored and retrieved. Your agents get smarter with every interaction.
				</p>
			</div>

			<!-- Memory flow visualization -->
			<div class="grid md:grid-cols-3 gap-6 mb-16">
				<div class="p-6 bg-bg-secondary border border-surface-border animate-slide-up" style="animation-delay: 350ms;">
					<div class="w-10 h-10 flex items-center justify-center border border-accent-secondary/30 text-accent-secondary mb-4">
						<span class="text-lg">α</span>
					</div>
					<h3 class="font-serif text-lg text-text-primary mb-2">Agent A executes</h3>
					<p class="text-sm text-text-secondary leading-relaxed">
						Completes a task with full context. Decisions, reasoning, and outcomes are captured.
					</p>
				</div>

				<div class="p-6 bg-bg-secondary border border-surface-border animate-slide-up" style="animation-delay: 400ms;">
					<div class="w-10 h-10 flex items-center justify-center border border-accent-secondary/30 text-accent-secondary mb-4">
						<span class="text-lg">◈</span>
					</div>
					<h3 class="font-serif text-lg text-text-primary mb-2">Mind remembers</h3>
					<p class="text-sm text-text-secondary leading-relaxed">
						Semantic memory stores what matters. Not logs — understanding. Patterns emerge over time.
					</p>
				</div>

				<div class="p-6 bg-bg-secondary border border-surface-border animate-slide-up" style="animation-delay: 450ms;">
					<div class="w-10 h-10 flex items-center justify-center border border-accent-secondary/30 text-accent-secondary mb-4">
						<span class="text-lg">β</span>
					</div>
					<h3 class="font-serif text-lg text-text-primary mb-2">Agent B improves</h3>
					<p class="text-sm text-text-secondary leading-relaxed">
						Picks up context instantly. No re-explanation. Builds on previous decisions. Compounds.
					</p>
				</div>
			</div>

			<!-- Stats row -->
			<div class="flex flex-wrap items-center justify-center gap-12 pt-8 border-t border-surface-border">
				<div class="text-center">
					<p class="text-3xl font-display font-bold text-accent-secondary mb-1">∞</p>
					<p class="font-mono text-text-tertiary text-xs uppercase tracking-wider">Memory Depth</p>
				</div>
				<div class="text-center">
					<p class="text-3xl font-display font-bold text-text-primary mb-1">0</p>
					<p class="font-mono text-text-tertiary text-xs uppercase tracking-wider">Context Lost</p>
				</div>
				<div class="text-center">
					<p class="text-3xl font-display font-bold text-accent-primary mb-1">100%</p>
					<p class="font-mono text-text-tertiary text-xs uppercase tracking-wider">Continuity</p>
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
