<script lang="ts">
	// Note: Using window.location.href instead of goto() for navigation
	// to avoid Svelte reactivity issues with canvas (see handleProcessingComplete)
	import Navbar from './Navbar.svelte';
	import Footer from './Footer.svelte';
	import PRDProcessingModal from './PRDProcessingModal.svelte';
	import { setPRD, setProjectName } from '$lib/stores/project-docs.svelte';
	import { analyzePRD, generateTasksFromPRD, tasksToWorkflow, type PRDAnalysis, type GeneratedTask } from '$lib/utils/prd-analyzer';
	import { processSmartPRD, type SmartPRDAnalysis, type SmartMission } from '$lib/utils/smart-prd-analyzer';
	import { initPRDBridge, requestPRDAnalysis, analysisStatus, prdResultToWorkflow, type PRDAnalysisResult } from '$lib/services/prd-bridge';
	import { queuePipelineLoad } from '$lib/services/pipeline-loader';
	import { onMount } from 'svelte';
	import { skills as skillsStore, loadSkills, addSkills } from '$lib/stores/skills.svelte';
	import { addNodesWithConnections, clearCanvas, nodes, connections } from '$lib/stores/canvas.svelte';
	import { initPipelines } from '$lib/stores/pipelines.svelte';
	import type { Skill } from '$lib/stores/skills.svelte';
	import { toasts } from '$lib/stores/toast.svelte';
	import { get } from 'svelte/store';

	let { onStart }: { onStart?: (goal: string, options?: { includeSkills?: boolean; includeMCPs?: boolean }) => void } = $props();

	let inputValue = $state('');
	let isFocused = $state(false);
	let isSubmitting = $state(false);
	let fileInputEl: HTMLInputElement;

	// Smart Mode - uses new analyzer that generates smaller, completable missions
	let useSmartMode = $state(true);  // Default ON
	let smartPrompt = $state<string | null>(null);  // Store generated prompt

	// AI Mode - uses real Claude AI via bridge for intelligent PRD analysis
	let useAIMode = $state(true);  // Default ON - this is the PREFERRED mode
	let aiAnalysisStatus = $state<'idle' | 'pending' | 'analyzing' | 'complete' | 'error'>('idle');

	// Pipeline options - what to include in generated pipeline
	let includeSkills = $state(true);   // Include H70 skill recommendations per task
	let includeMCPs = $state(true);     // Include best MCP tool recommendations per task

	// Initialize PRD bridge on mount
	onMount(() => {
		initPRDBridge();
		// Subscribe to analysis status updates
		const unsubscribe = analysisStatus.subscribe(status => {
			aiAnalysisStatus = status;
		});
		return unsubscribe;
	});

	// PRD Processing Modal state
	let showProcessingModal = $state(false);
	let processingStage = $state(0);
	let processingProjectName = $state('');
	let processingFeaturesFound = $state(0);
	let processingTasksGenerated = $state(0);
	let waitingForClaude = $state(false);
	let currentPrdRequestId = $state('');
	// Workflow type matches tasksToWorkflow return type
	let pendingWorkflow: {
		nodes: { skill: Skill; position: { x: number; y: number } }[];
		connections: { sourceIndex: number; targetIndex: number }[];
	} | null = null;

	function createQueuedPipelineId(): string {
		return `pipe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
	}

	const skillCategories = [
		{ name: 'Frontend', count: 45, icon: '<>' },
		{ name: 'Backend', count: 62, icon: '[]' },
		{ name: 'DevOps', count: 38, icon: '{}' },
		{ name: 'Security', count: 41, icon: '!!' },
		{ name: 'Data', count: 35, icon: '()' },
		{ name: 'AI/ML', count: 28, icon: 'AI' }
	];

	function handleSubmit() {
		if (inputValue.trim() && onStart && !isSubmitting) {
			isSubmitting = true;
			onStart(inputValue.trim(), { includeSkills, includeMCPs });
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
				console.log('[PRD] Starting analysis, content length:', content.length, 'aiMode:', useAIMode, 'smartMode:', useSmartMode);
				await delay(600);

				// Load skills first (needed for all modes)
				let skillsList = get(skillsStore);
				if (skillsList.length === 0) {
					await loadSkills();
					skillsList = get(skillsStore);
				}

				if (useAIMode) {
					// === AI MODE ===
					// Uses REAL Claude AI intelligence via bridge (PREFERRED)
					console.log('[PRD-AI] Setting up for Claude analysis...');

					// Stage 1: Writing PRD for Claude
					processingStage = 1;

					try {
						// Write PRD to file for Claude to read
						const writeResponse = await fetch('/api/prd-bridge/write', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								content,
								requestId: `prd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
								projectName: processingProjectName,
								options: { includeSkills, includeMCPs }
							})
						});

						if (!writeResponse.ok) {
							throw new Error('Failed to write PRD');
						}

						const { requestId } = await writeResponse.json();
						currentPrdRequestId = requestId;

						// Show "waiting for Claude" with copyable prompt
						waitingForClaude = true;

						console.log('[PRD-AI] PRD written, waiting for Claude. Request ID:', requestId);

						// Capture skillsList in closure
						const capturedSkills = skillsList;

						// Shared function to process result from either SSE or polling
						let resultProcessed = false;
						let pollInterval: ReturnType<typeof setInterval> | null = null;

						function processClaudeResult(result: PRDAnalysisResult) {
							if (resultProcessed) return;
							resultProcessed = true;

							if (pollInterval) {
								clearInterval(pollInterval);
								pollInterval = null;
							}

							try {
								waitingForClaude = false;
								processingProjectName = result.projectName || processingProjectName;
								processingFeaturesFound = result.tasks?.length || 0;
								processingStage = 4;
								processingTasksGenerated = result.tasks?.length || 0;

								console.log('[PRD-AI] Converting to workflow with', capturedSkills.length, 'skills');
								pendingWorkflow = prdResultToWorkflow(result, capturedSkills);
								console.log('[PRD-AI] Workflow created:', pendingWorkflow?.nodes?.length, 'nodes');

								smartPrompt = result.executionPrompt;
								processingStage = 5;

								if (result.projectName && result.projectName !== 'New Project') {
									setProjectName(result.projectName);
								}

								console.log('[PRD-AI] Pipeline ready! Stage:', processingStage);
							} catch (err) {
								console.error('[PRD-AI] Error processing result:', err);
								waitingForClaude = false;
								processingStage = 5;
							}
						}

						let unsubscribe = () => {};
						const aiCompleted = await new Promise<boolean>((resolve) => {
							let settled = false;
							const settle = (success: boolean) => {
								if (settled) return;
								settled = true;
								if (pollInterval) {
									clearInterval(pollInterval);
									pollInterval = null;
								}
								unsubscribe();
								resolve(success);
							};

							// Set up listener for Claude's response
							unsubscribe = analysisStatus.subscribe(status => {
								console.log('[PRD-AI] Status changed to:', status);
								if (status === 'complete' && !resultProcessed) {
									// Claude responded! Get the result from the store
									import('$lib/services/prd-bridge').then(({ analysisResult }) => {
										const result = get(analysisResult);
										console.log('[PRD-AI] Got result via SSE:', result?.projectName);

										if (result) {
											processClaudeResult(result);
											settle(true);
										}
									}).catch(err => {
										console.error('[PRD-AI] Import error:', err);
									});
								}
							});

							// POLLING FALLBACK: Check for stored results every 2 seconds
							pollInterval = setInterval(async () => {
								if (resultProcessed) {
									settle(true);
									return;
								}

								try {
									const response = await fetch(`/api/prd-bridge/result?requestId=${requestId}`);
									const data = await response.json();

									if (data.found && data.result && !resultProcessed) {
										console.log('[PRD-AI] Got result via POLLING:', data.result.projectName);
										processClaudeResult(data.result);
										await fetch('/api/prd-bridge/pending', { method: 'DELETE' });
										settle(true);
									}
								} catch (err) {
									console.debug('[PRD-AI] Polling check failed:', err);
								}
							}, 2000);

							// Give runtime bridge/codex auto-analysis enough time before local fallback
							setTimeout(() => settle(false), 45000);
						});

						if (aiCompleted) {
							return;
						}

						waitingForClaude = false;
						useAIMode = false;
						toasts.info('Runtime analysis did not respond in time. Continuing automatically with local smart analysis.');

					} catch (err) {
						console.error('[PRD-AI] Setup failed:', err);
						waitingForClaude = false;
						toasts.warning('Could not set up Claude analysis, using local analyzer');
						useAIMode = false;
					}

				}

				// Only run smart/legacy mode if AI mode didn't succeed
				if (!useAIMode && useSmartMode) {
					// === SMART MODE ===
					// Uses new analyzer that generates smaller, completable missions

					// Stage 1: Smart Analysis
					processingStage = 1;
					await delay(400);
					const result = processSmartPRD(content, skillsList);

					console.log('[PRD-Smart] Analysis complete:', {
						projectName: result.analysis.projectName,
						projectType: result.analysis.projectType,
						pipelineType: result.analysis.pipelineType,
						features: result.analysis.explicitFeatures.length,
						tasks: result.mission.totalTasks,
						infrastructure: result.analysis.infrastructure
					});

					processingProjectName = result.analysis.projectName || processingProjectName;
					processingFeaturesFound = result.analysis.explicitFeatures.length;

					// Stage 2: Stack Detection
					processingStage = 2;
					await delay(300);

					// Stage 3: Skills
					processingStage = 3;
					await delay(300);

					// Stage 4: Building Pipeline
					processingStage = 4;
					processingTasksGenerated = result.mission.totalTasks;

					if (result.mission.tasks.length === 0) {
						showProcessingModal = false;
						toasts.error('Could not extract tasks from PRD. Try adding more detail.');
						return;
					}

					// Apply pipeline options
					if (!includeSkills) {
						// Strip skill assignments from workflow nodes
						for (const node of result.workflow.nodes) {
							if (node.skill) {
								node.skill.skillChain = [];
							}
						}
						// Strip skills from mission tasks
						for (const task of result.mission.tasks) {
							task.skills = [];
						}
					}

					pendingWorkflow = result.workflow;
					smartPrompt = result.prompt;  // Store for later copy
					await delay(400);

					// Stage 5: Ready
					processingStage = 5;

					if (result.analysis.projectName && result.analysis.projectName !== 'New Project') {
						setProjectName(result.analysis.projectName);
					}

					console.log('[PRD-Smart] Pipeline ready:',
						result.mission.totalTasks, 'tasks,',
						result.mission.estimatedComplexity, 'complexity');

				} else if (!useAIMode && !useSmartMode) {
					// === LEGACY MODE ===
					// Original analyzer (only used if both AI and Smart modes are disabled)

					// Stage 1: Analyzing Features
					processingStage = 1;
					await delay(500);
					const analysis = analyzePRD(content);
					console.log('[PRD-Legacy] Analysis complete:', { projectName: analysis.projectName, features: analysis.features.length });
					processingProjectName = analysis.projectName || processingProjectName;
					processingFeaturesFound = analysis.features.length;

					// Stage 2: Detecting Stack
					processingStage = 2;
					await delay(500);

					// Stage 3: Matching Skills
					processingStage = 3;
					await delay(500);

					// Stage 4: Building Pipeline
					processingStage = 4;
					const tasks = generateTasksFromPRD(analysis, skillsList);
					console.log('[PRD-Legacy] Generated tasks:', tasks.length);
					processingTasksGenerated = tasks.length;

					if (tasks.length === 0) {
						showProcessingModal = false;
						toasts.error('Could not extract tasks from PRD. Try adding more detail.');
						return;
					}

					// Generate workflow
					const workflow = tasksToWorkflow(tasks, skillsList);
					console.log('[PRD-Legacy] Workflow nodes:', workflow.nodes.length, 'connections:', workflow.connections.length);
					pendingWorkflow = workflow;
					smartPrompt = null;  // No smart prompt in legacy mode
					await delay(600);

					// Stage 5: Ready
					processingStage = 5;

					if (analysis.projectName && analysis.projectName !== 'New Project') {
						setProjectName(analysis.projectName);
					}
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

	async function handleProcessingComplete() {
		console.log('[PRD] handleProcessingComplete called, pendingWorkflow:', !!pendingWorkflow);

		const pipelineName = processingProjectName || 'PRD Pipeline';

		if (pendingWorkflow && pendingWorkflow.nodes.length > 0) {
			console.log('[PRD] Queueing pipeline with', pendingWorkflow.nodes.length, 'nodes and', pendingWorkflow.connections.length, 'connections');

			// Extract skills from workflow nodes and add to skills store (for sidebar)
			const workflowSkills = pendingWorkflow.nodes.map(n => n.skill);
			addSkills(workflowSkills);

			// Queue the pipeline load - canvas will pick this up on mount
			const queued = await queuePipelineLoad({
				pipelineId: createQueuedPipelineId(),
				pipelineName,
				nodes: pendingWorkflow.nodes,
				connections: pendingWorkflow.connections,
				source: 'prd'
			});

			if (queued) {
				toasts.success(`Pipeline ready with ${pendingWorkflow.nodes.length} agents`);
			} else {
				toasts.error('Failed to queue pipeline');
			}
		} else {
			// Queue empty pipeline so we don't load old one
			console.warn('[PRD] No workflow nodes, queueing empty pipeline');
			await queuePipelineLoad({
				pipelineId: createQueuedPipelineId(),
				pipelineName,
				nodes: [],
				connections: [],
				source: 'prd'
			});
			toasts.warning('Pipeline created but no tasks were generated. Try re-analyzing the PRD.');
		}

		showProcessingModal = false;
		pendingWorkflow = null;
		console.log('[PRD] Navigating to /canvas');
		window.location.href = '/canvas';
	}

	function delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Skip Claude AI and use local smart analyzer instead
	 */
	async function handleSkipToLocal() {
		console.log('[PRD] Skipping to local analyzer...');
		waitingForClaude = false;

		// Read the pending PRD content
		const prdResponse = await fetch('/api/prd-bridge/pending');
		const prdData = await prdResponse.json();

		if (!prdData.pending || !prdData.prdContent) {
			toasts.error('No pending PRD found');
			showProcessingModal = false;
			return;
		}

		// Load skills if needed
		let skillsList = get(skillsStore);
		if (skillsList.length === 0) {
			await loadSkills();
			skillsList = get(skillsStore);
		}

		// Use smart analyzer
		processingStage = 1;
		await delay(300);
		const result = processSmartPRD(prdData.prdContent, skillsList);

		processingProjectName = result.analysis.projectName || processingProjectName;
		processingFeaturesFound = result.analysis.explicitFeatures.length;

		processingStage = 2;
		await delay(200);
		processingStage = 3;
		await delay(200);
		processingStage = 4;
		processingTasksGenerated = result.mission.totalTasks;

		if (result.mission.tasks.length === 0) {
			showProcessingModal = false;
			toasts.error('Could not extract tasks from PRD');
			return;
		}

		pendingWorkflow = result.workflow;
		smartPrompt = result.prompt;
		await delay(300);

		processingStage = 5;

		if (result.analysis.projectName && result.analysis.projectName !== 'New Project') {
			setProjectName(result.analysis.projectName);
		}

		// Clear the pending request
		await fetch('/api/prd-bridge/pending', { method: 'DELETE' });
	}

	/**
	 * Convert PRD Analysis Result from Claude AI to workflow format
	 *
	 * Creates TASK-FOCUSED nodes where each node represents a feature/task,
	 * with skills shown as tags. This prevents duplicate skill nodes and
	 * gives a cleaner view of what's being built.
	 */
	// prdResultToWorkflow is now imported from $lib/services/prd-bridge
</script>

<PRDProcessingModal
	isOpen={showProcessingModal}
	currentStage={processingStage}
	projectName={processingProjectName}
	featuresFound={processingFeaturesFound}
	tasksGenerated={processingTasksGenerated}
	waitingForClaude={waitingForClaude}
	prdRequestId={currentPrdRequestId}
	onComplete={handleProcessingComplete}
	onSkipToLocal={handleSkipToLocal}
/>

<div class="min-h-screen bg-bg-primary">
	<!-- Navbar -->
	<Navbar />

	<!-- Hero Section -->
	<section class="max-w-6xl mx-auto px-6 pt-20 pb-16">
		<div class="text-center mb-16 animate-fade-in">
			<p class="overline" style="color: var(--text-ghost); letter-spacing: 1.5px;">Skilled agents · Execution plane · Automated pipelines</p>
			<h1 class="text-[3.25rem] leading-[1.08] font-sans font-semibold text-text-primary mb-6 tracking-tight">
				A framework to <span class="text-accent-primary relative inline-block">level up Claude<span class="claude-underline"></span></span>
			</h1>
			<p class="text-lg text-text-secondary max-w-2xl mx-auto mb-6 leading-relaxed">
				593 specialized skills turn agents into domain experts. Build workflows on canvas,
				dispatch missions, and run providers from one place.
			</p>
			<div class="flex items-center justify-center gap-6 text-sm font-mono text-text-tertiary">
				<span class="flex items-center gap-2">
					<span class="cursor-blocks pulsing"><span></span><span></span><span></span></span>
					Better than regular Opus 4.5
				</span>
				<span class="flex items-center gap-2">
					<span class="w-1.5 h-1.5 bg-accent-primary rounded-full animate-pulse"></span>
					Execution that stays visible
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
					class="flex items-center gap-4 px-5 py-2 border-t transition-colors duration-normal {isFocused ? 'border-accent-primary/30' : 'border-surface-border'}"
				>
					<span class="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Include:</span>
					<label class="flex items-center gap-1.5 cursor-pointer group">
						<button
							type="button"
							role="switch"
							aria-checked={includeSkills}
							onclick={() => includeSkills = !includeSkills}
							class="relative w-7 h-4 rounded-full transition-colors {includeSkills ? 'bg-accent-primary' : 'bg-surface-border'}"
						>
							<span class="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform {includeSkills ? 'translate-x-3' : ''}"></span>
						</button>
						<span class="text-xs font-mono {includeSkills ? 'text-accent-primary' : 'text-text-tertiary'} group-hover:text-text-primary transition-colors">Skills</span>
					</label>
					<label class="flex items-center gap-1.5 cursor-pointer group">
						<button
							type="button"
							role="switch"
							aria-checked={includeMCPs}
							onclick={() => includeMCPs = !includeMCPs}
							class="relative w-7 h-4 rounded-full transition-colors {includeMCPs ? 'bg-accent-primary' : 'bg-surface-border'}"
						>
							<span class="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform {includeMCPs ? 'translate-x-3' : ''}"></span>
						</button>
						<span class="text-xs font-mono {includeMCPs ? 'text-accent-primary' : 'text-text-tertiary'} group-hover:text-text-primary transition-colors">MCPs</span>
					</label>
				</div>

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
				<p class="overline">01 — Skilled agents</p>
				<h2 class="text-3xl font-sans font-semibold text-text-primary mb-4 tracking-tight">
					Not generic LLMs.<br/>
					<span class="text-accent-primary">Specialized experts.</span>
				</h2>
				<p class="text-text-secondary mb-8 leading-relaxed">
					Each skill transforms Claude into a domain expert - with curated patterns,
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
							Expert-level from the start. Anthropic recommends skills over general prompting - each of ours is benchmarked to prove it.
						</p>
					</div>
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
