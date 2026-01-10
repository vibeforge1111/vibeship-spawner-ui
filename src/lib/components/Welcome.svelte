<script lang="ts">
	import { goto } from '$app/navigation';
	import Navbar from './Navbar.svelte';
	import Footer from './Footer.svelte';
	import PRDProcessingModal from './PRDProcessingModal.svelte';
	import { isConnected as mcpConnected, isConnecting as mcpConnecting } from '$lib/stores/mcp.svelte';
	import { isConnected as syncConnected, syncStatus } from '$lib/services/sync-client';
	import { isMemoryConnected, memoryConnectionStatus } from '$lib/stores/memory-settings.svelte';
	import { setPRD, setProjectName } from '$lib/stores/project-docs.svelte';
	import { analyzePRD, generateTasksFromPRD, tasksToWorkflow, type PRDAnalysis, type GeneratedTask } from '$lib/utils/prd-analyzer';
	import { skills as skillsStore, loadSkills, addSkills } from '$lib/stores/skills.svelte';
	import { addNodesWithConnections, clearCanvas, nodes, connections } from '$lib/stores/canvas.svelte';
	import { createNewPipeline, saveCurrentPipeline, initPipelines, type PipelineData } from '$lib/stores/pipelines.svelte';
	import { toasts } from '$lib/stores/toast.svelte';
	import { get } from 'svelte/store';

	let { onStart }: { onStart?: (goal: string) => void } = $props();
	let showSetupGuide = $state(false);

	let inputValue = $state('');
	let isFocused = $state(false);
	let isSubmitting = $state(false);
	let fileInputEl: HTMLInputElement;

	// PRD Processing Modal state
	let showProcessingModal = $state(false);
	let processingStage = $state(0);
	let processingProjectName = $state('');
	let processingFeaturesFound = $state(0);
	let processingTasksGenerated = $state(0);
	let pendingWorkflow: Pick<PipelineData, 'nodes' | 'connections'> | null = null;

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
		if (inputValue.trim() && onStart && !isSubmitting) {
			isSubmitting = true;
			onStart(inputValue.trim());
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}

	async function handlePRDUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (event) => {
			const content = event.target?.result as string;
			setPRD(content);

			// Extract project name from file name
			const fileName = file.name.replace(/\.(md|txt)$/i, '').replace(/[-_]/g, ' ');
			if (fileName.length > 2 && fileName.length < 50 && !fileName.toLowerCase().includes('prd')) {
				setProjectName(fileName);
				processingProjectName = fileName;
			}

			// Show processing modal
			showProcessingModal = true;
			processingStage = 0;

			try {
				// Stage 0: Reading PRD
				console.log('[PRD] Starting analysis, content length:', content.length);
				await delay(600);

				// Stage 1: Analyzing Features
				processingStage = 1;
				await delay(500);
				const analysis = analyzePRD(content);
				console.log('[PRD] Analysis complete:', { projectName: analysis.projectName, features: analysis.features.length });
				processingProjectName = analysis.projectName || processingProjectName;
				processingFeaturesFound = analysis.features.length;

				// Stage 2: Detecting Stack
				processingStage = 2;
				await delay(500);

				// Stage 3: Matching Skills - ensure skills are loaded
				processingStage = 3;
				let skillsList = get(skillsStore);
				console.log('[PRD] Skills before load:', skillsList.length);
				if (skillsList.length === 0) {
					// Try to load skills if empty
					await loadSkills();
					skillsList = get(skillsStore);
					console.log('[PRD] Skills after load:', skillsList.length);
				}
				await delay(500);

				// Stage 4: Building Pipeline
				processingStage = 4;
				const tasks = generateTasksFromPRD(analysis, skillsList);
				console.log('[PRD] Generated tasks:', tasks.length);
				processingTasksGenerated = tasks.length;

				if (tasks.length === 0) {
					showProcessingModal = false;
					toasts.error('Could not extract tasks from PRD. Try adding more detail.');
					return;
				}

				// Generate workflow
				const workflow = tasksToWorkflow(tasks, skillsList);
				console.log('[PRD] Workflow nodes:', workflow.nodes.length, 'connections:', workflow.connections.length);
				pendingWorkflow = workflow;
				await delay(600);

				// Stage 5: Ready
				processingStage = 5;

				// Update project name from analysis
				if (analysis.projectName && analysis.projectName !== 'New Project') {
					setProjectName(analysis.projectName);
				}

			} catch (err) {
				console.error('[PRD] Analysis failed at stage', processingStage, ':', err);
				showProcessingModal = false;
				toasts.error(`Failed to analyze PRD: ${err instanceof Error ? err.message : 'Unknown error'}`);
			}
		};
		reader.readAsText(file);
		input.value = '';
	}

	function handleProcessingComplete() {
		console.log('[PRD] handleProcessingComplete called, pendingWorkflow:', !!pendingWorkflow);

		if (pendingWorkflow) {
			console.log('[PRD] Setting up pipeline with', pendingWorkflow.nodes.length, 'nodes');

			// Initialize pipeline system
			initPipelines();

			// Create a new pipeline for this PRD
			const pipelineName = processingProjectName || 'PRD Pipeline';
			createNewPipeline(pipelineName);

			// Extract skills from workflow nodes and add to skills store
			// This makes them appear in the left sidebar
			const workflowSkills = pendingWorkflow.nodes.map(n => n.skill);
			addSkills(workflowSkills);

			// Clear canvas and add the workflow nodes
			clearCanvas();
			addNodesWithConnections(pendingWorkflow.nodes, pendingWorkflow.connections);

			// Get the actual nodes/connections from the store (they have full CanvasNode format now)
			const currentNodes = get(nodes);
			const currentConnections = get(connections);

			// Save to the pipeline so canvas page loads it correctly
			saveCurrentPipeline({
				nodes: currentNodes,
				connections: currentConnections,
				zoom: 1,
				pan: { x: 0, y: 0 }
			});

			toasts.success(`Pipeline ready with ${pendingWorkflow.nodes.length} agents`);
		} else {
			console.warn('[PRD] No pending workflow, just navigating to canvas');
		}

		showProcessingModal = false;
		pendingWorkflow = null;
		console.log('[PRD] Navigating to /canvas');
		goto('/canvas');
	}

	function delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
</script>

<PRDProcessingModal
	isOpen={showProcessingModal}
	currentStage={processingStage}
	projectName={processingProjectName}
	featuresFound={processingFeaturesFound}
	tasksGenerated={processingTasksGenerated}
	onComplete={handleProcessingComplete}
/>

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

			<!-- Connection Status -->
			<div class="mt-6 flex flex-col items-center gap-2">
				<div class="flex items-center gap-2">
					<!-- MCP Status -->
					{#if $mcpConnected}
						<div class="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/30">
							<span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
							<span class="text-xs font-mono text-green-400">MCP</span>
						</div>
					{:else if $mcpConnecting}
						<div class="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/30">
							<span class="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
							<span class="text-xs font-mono text-yellow-400">MCP</span>
						</div>
					{:else}
						<div class="flex items-center gap-1.5 px-2.5 py-1 bg-text-tertiary/10 border border-surface-border">
							<span class="w-1.5 h-1.5 bg-text-tertiary rounded-full"></span>
							<span class="text-xs font-mono text-text-tertiary">MCP</span>
						</div>
					{/if}

					<!-- Mind Status -->
					{#if $isMemoryConnected}
						<div class="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/30">
							<span class="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
							<span class="text-xs font-mono text-purple-400">Mind</span>
						</div>
					{:else}
						<div class="flex items-center gap-1.5 px-2.5 py-1 bg-text-tertiary/10 border border-surface-border">
							<span class="w-1.5 h-1.5 bg-text-tertiary rounded-full"></span>
							<span class="text-xs font-mono text-text-tertiary">Mind</span>
						</div>
					{/if}

					<!-- Real-time Sync Status -->
					{#if $syncConnected}
						<div class="flex items-center gap-1.5 px-2.5 py-1 bg-accent-primary/10 border border-accent-primary/30">
							<span class="w-1.5 h-1.5 bg-accent-primary rounded-full"></span>
							<span class="text-xs font-mono text-accent-primary">Sync</span>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Setup Guide Modal -->
		{#if showSetupGuide}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_interactive_supports_focus -->
			<div class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onclick={() => showSetupGuide = false} role="dialog" aria-modal="true" tabindex="-1">
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div class="bg-bg-secondary border border-surface-border max-w-lg w-full max-h-[80vh] overflow-y-auto" onclick={(e) => e.stopPropagation()} role="document">
					<div class="flex items-center justify-between px-5 py-4 border-b border-surface-border">
						<h3 class="font-serif text-lg text-text-primary">Setup Bidirectional Sync</h3>
						<button onclick={() => showSetupGuide = false} class="text-text-tertiary hover:text-text-primary" aria-label="Close dialog">
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div class="px-5 py-4 space-y-6">
						<div>
							<p class="font-mono text-xs text-accent-primary mb-2 tracking-widest">STEP 1</p>
							<p class="text-sm text-text-secondary mb-2">Clone spawner-v2 (the sync server):</p>
							<code class="block p-3 bg-surface rounded text-sm font-mono text-text-primary">
								git clone https://github.com/vibeship/spawner-v2.git
							</code>
						</div>

						<div>
							<p class="font-mono text-xs text-accent-primary mb-2 tracking-widest">STEP 2</p>
							<p class="text-sm text-text-secondary mb-2">Install and run locally:</p>
							<code class="block p-3 bg-surface rounded text-sm font-mono text-text-primary whitespace-pre">cd spawner-v2
npm install
wrangler dev</code>
						</div>

						<div>
							<p class="font-mono text-xs text-accent-primary mb-2 tracking-widest">STEP 3</p>
							<p class="text-sm text-text-secondary mb-2">Server runs at localhost:8787. Both Spawner UI and Claude Code connect here.</p>
						</div>

						<div class="p-4 bg-accent-primary/10 border border-accent-primary/30 rounded">
							<p class="text-sm text-accent-primary font-medium mb-2">How it works:</p>
							<ul class="text-xs text-text-secondary space-y-1">
								<li>- Spawner UI creates missions → stored in MCP server</li>
								<li>- Claude Code reads missions via spawner_mission tools</li>
								<li>- Changes sync instantly via WebSocket</li>
								<li>- Both see real-time updates</li>
							</ul>
						</div>
					</div>

					<div class="px-5 py-4 border-t border-surface-border">
						<button
							onclick={() => showSetupGuide = false}
							class="w-full py-2 bg-accent-primary text-bg-primary font-medium hover:bg-accent-primary/90 transition-colors"
						>
							Got it
						</button>
					</div>
				</div>
			</div>
		{/if}

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

					<div class="flex items-center gap-3">
						<!-- Hidden file input -->
						<input
							type="file"
							accept=".md,.txt"
							onchange={handlePRDUpload}
							bind:this={fileInputEl}
							class="hidden"
						/>

						<!-- Upload PRD Button -->
						<button
							onclick={() => fileInputEl?.click()}
							class="flex items-center gap-2 px-3 py-1.5 text-sm font-mono text-accent-secondary border border-accent-secondary/40 hover:bg-accent-secondary/10 transition-all"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
							</svg>
							<span>PRD</span>
						</button>

						<!-- Spawn Button -->
						<button
							onclick={handleSubmit}
							disabled={!inputValue.trim() || isSubmitting}
							class="group flex items-center gap-2 px-4 py-2 font-medium transition-all disabled:cursor-not-allowed"
							class:button-active={inputValue.trim() && !isSubmitting}
							class:button-inactive={!inputValue.trim() || isSubmitting}
						>
							{#if isSubmitting}
								<span class="animate-pulse">analyzing...</span>
							{:else}
								<span>spawn()</span>
								<svg class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
								</svg>
							{/if}
						</button>
					</div>
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
