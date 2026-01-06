<script lang="ts">
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { toasts } from '$lib/stores/toast.svelte';
	import {
		getProjectDocs,
		setPRD,
		setArchitecture,
		setImplementation,
		setProjectName,
		parseImplementationPlan,
		exportAsMarkdown,
		resetToDefaults
	} from '$lib/stores/project-docs.svelte';
	import { generateWorkflow, generateMissionFromTasks } from '$lib/utils/workflow-generator';
	import { analyzePRD, generateTasksFromPRD, tasksToWorkflow, type PRDAnalysis, type GeneratedTask } from '$lib/utils/prd-analyzer';
	import { skills as skillsStore } from '$lib/stores/skills.svelte';
	import { addNodesWithConnections, clearCanvas } from '$lib/stores/canvas.svelte';

	const docs = $derived(getProjectDocs());
	let skillsList = $state<any[]>([]);

	// Subscribe to skills store
	$effect(() => {
		const unsub = skillsStore.subscribe(s => {
			skillsList = s;
		});
		return unsub;
	});

	let activeTab = $state<'prd' | 'architecture' | 'implementation'>('prd');
	let isGenerating = $state(false);
	let parsedTasks = $derived(parseImplementationPlan(docs.implementation));

	// PRD Analysis state
	let prdAnalysis = $state<PRDAnalysis | null>(null);
	let generatedTasks = $state<GeneratedTask[]>([]);
	let showAnalysis = $state(false);

	// Auto-analyze PRD when it changes
	$effect(() => {
		if (docs.prd && docs.prd.length > 50) {
			const analysis = analyzePRD(docs.prd);
			prdAnalysis = analysis;
			if (skillsList.length > 0) {
				generatedTasks = generateTasksFromPRD(analysis, skillsList);
			}
		} else {
			prdAnalysis = null;
			generatedTasks = [];
		}
	});

	function handlePRDChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		setPRD(target.value);
	}

	function handleArchChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		setArchitecture(target.value);
	}

	function handleImplChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		setImplementation(target.value);
	}

	function handleNameChange(e: Event) {
		const target = e.target as HTMLInputElement;
		setProjectName(target.value);
	}

	async function generateAndGoToCanvas() {
		if (parsedTasks.length === 0) {
			toasts.error('No tasks found in Implementation Plan. Add tasks using the ### Task: format.');
			return;
		}

		isGenerating = true;

		try {
			// Generate workflow from tasks
			const workflow = generateWorkflow(parsedTasks, skillsList);

			if (workflow.nodes.length === 0) {
				toasts.error('Could not generate workflow. Check your Implementation Plan format.');
				return;
			}

			// Clear existing canvas and add new nodes
			clearCanvas();
			addNodesWithConnections(workflow.nodes, workflow.connections);

			toasts.success(`Generated ${workflow.nodes.length} nodes with ${workflow.connections.length} connections`);

			// Navigate to canvas
			goto('/canvas');
		} catch (e) {
			console.error('Failed to generate workflow:', e);
			toasts.error('Failed to generate workflow');
		} finally {
			isGenerating = false;
		}
	}

	async function generateFromPRD() {
		if (!prdAnalysis || generatedTasks.length === 0) {
			toasts.error('Write a PRD first to auto-generate tasks');
			return;
		}

		isGenerating = true;

		try {
			// Convert tasks to workflow
			const workflow = tasksToWorkflow(generatedTasks, skillsList);

			if (workflow.nodes.length === 0) {
				toasts.error('Could not generate workflow from PRD analysis.');
				return;
			}

			// Clear existing canvas and add new nodes
			clearCanvas();
			addNodesWithConnections(workflow.nodes, workflow.connections);

			// Update project name if detected
			if (prdAnalysis.projectName && prdAnalysis.projectName !== 'New Project') {
				setProjectName(prdAnalysis.projectName);
			}

			toasts.success(`Generated ${workflow.nodes.length} tasks from PRD analysis`);

			// Navigate to canvas
			goto('/canvas');
		} catch (e) {
			console.error('Failed to generate from PRD:', e);
			toasts.error('Failed to generate workflow from PRD');
		} finally {
			isGenerating = false;
		}
	}

	function downloadMarkdown() {
		const content = exportAsMarkdown();
		const blob = new Blob([content], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${docs.projectName.toLowerCase().replace(/\s+/g, '-')}-docs.md`;
		a.click();
		URL.revokeObjectURL(url);
		toasts.success('Downloaded project documents');
	}

	function handleReset() {
		if (confirm('Reset all documents to defaults? This cannot be undone.')) {
			resetToDefaults();
			toasts.success('Reset to defaults');
		}
	}

	function handlePRDUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const content = event.target?.result as string;
			setPRD(content);
			activeTab = 'prd';

			// Extract project name from file name if it looks like a project name
			const fileName = file.name.replace(/\.(md|txt)$/i, '').replace(/[-_]/g, ' ');
			if (fileName.length > 2 && fileName.length < 50 && !fileName.toLowerCase().includes('prd')) {
				setProjectName(fileName);
			}

			toasts.success(`Loaded PRD: ${file.name}`);
		};
		reader.readAsText(file);
		input.value = '';
	}

	function handleFileUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const content = event.target?.result as string;
			// Detect which document type based on content
			if (content.includes('# Product Requirements') || content.includes('## Overview')) {
				setPRD(content);
				activeTab = 'prd';
				toasts.success('Imported PRD');
			} else if (content.includes('# Architecture') || content.includes('## System Overview')) {
				setArchitecture(content);
				activeTab = 'architecture';
				toasts.success('Imported Architecture');
			} else if (content.includes('# Implementation') || content.includes('### Task:')) {
				setImplementation(content);
				activeTab = 'implementation';
				toasts.success('Imported Implementation Plan');
			} else {
				// Default to implementation
				setImplementation(content);
				activeTab = 'implementation';
				toasts.success('Imported as Implementation Plan');
			}
		};
		reader.readAsText(file);
		input.value = '';
	}
</script>

<svelte:head>
	<title>Project | Spawner</title>
</svelte:head>

<div class="min-h-screen bg-bg-primary p-6">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="flex items-center justify-between mb-6">
			<div class="flex items-center gap-4">
				<a href="/" class="text-text-tertiary hover:text-text-primary" aria-label="Go back home">
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
					</svg>
				</a>
				<div>
					<input
						type="text"
						value={docs.projectName}
						oninput={handleNameChange}
						class="text-2xl font-bold bg-transparent border-none outline-none text-text-primary focus:ring-1 focus:ring-accent-primary/50 rounded px-2 -ml-2"
					/>
					<p class="text-text-tertiary text-sm ml-0.5">Define your project, generate workflow</p>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<label class="px-4 py-2 bg-gradient-to-r from-accent-primary to-accent-secondary hover:opacity-90 text-white rounded-lg cursor-pointer transition-all font-medium">
					<input type="file" accept=".md,.txt" onchange={handlePRDUpload} class="hidden" />
					Upload PRD
				</label>
				<label class="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-text-secondary rounded-lg cursor-pointer transition-colors">
					<input type="file" accept=".md,.txt" onchange={handleFileUpload} class="hidden" />
					Import MD
				</label>
				<button
					onclick={downloadMarkdown}
					class="px-4 py-2 bg-surface-secondary hover:bg-surface-tertiary text-text-secondary rounded-lg transition-colors"
				>
					Export
				</button>
				<button
					onclick={handleReset}
					class="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
				>
					Reset
				</button>
			</div>
		</div>

		<!-- Main Content -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Document Editor -->
			<div class="lg:col-span-2 bg-surface-primary rounded-xl border border-border-subtle">
				<!-- Tabs -->
				<div class="flex border-b border-border-subtle">
					<button
						onclick={() => activeTab = 'prd'}
						class="flex-1 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'prd' ? 'text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5' : 'text-text-tertiary hover:text-text-secondary'}"
					>
						PRD
					</button>
					<button
						onclick={() => activeTab = 'architecture'}
						class="flex-1 px-4 py-3 text-sm font-medium transition-colors {activeTab === 'architecture' ? 'text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5' : 'text-text-tertiary hover:text-text-secondary'}"
					>
						Architecture
					</button>
					<button
						onclick={() => activeTab = 'implementation'}
						class="flex-1 px-4 py-3 text-sm font-medium transition-colors relative {activeTab === 'implementation' ? 'text-accent-primary border-b-2 border-accent-primary bg-accent-primary/5' : 'text-text-tertiary hover:text-text-secondary'}"
					>
						Implementation
						{#if parsedTasks.length > 0}
							<span class="absolute -top-1 -right-1 w-5 h-5 bg-accent-primary text-white text-xs rounded-full flex items-center justify-center">
								{parsedTasks.length}
							</span>
						{/if}
					</button>
				</div>

				<!-- Editor -->
				<div class="p-4">
					{#if activeTab === 'prd'}
						<textarea
							value={docs.prd}
							oninput={handlePRDChange}
							class="w-full h-[500px] bg-bg-primary border border-border-subtle rounded-lg p-4 font-mono text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 resize-none"
							placeholder="Write your Product Requirements Document..."
						></textarea>
					{:else if activeTab === 'architecture'}
						<textarea
							value={docs.architecture}
							oninput={handleArchChange}
							class="w-full h-[500px] bg-bg-primary border border-border-subtle rounded-lg p-4 font-mono text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 resize-none"
							placeholder="Define your system architecture..."
						></textarea>
					{:else}
						<textarea
							value={docs.implementation}
							oninput={handleImplChange}
							class="w-full h-[500px] bg-bg-primary border border-border-subtle rounded-lg p-4 font-mono text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 resize-none"
							placeholder="Plan your implementation tasks..."
						></textarea>
					{/if}
				</div>
			</div>

			<!-- Sidebar -->
			<div class="space-y-6">
				<!-- PRD Analysis (shows when PRD has content) -->
				{#if prdAnalysis && activeTab === 'prd'}
					<div class="bg-surface-primary rounded-xl border border-border-subtle p-4">
						<h3 class="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
							<svg class="w-5 h-5 text-accent-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
							</svg>
							PRD Analysis
						</h3>

						<div class="space-y-3">
							<div>
								<span class="text-xs text-text-tertiary">Project Type</span>
								<p class="text-sm font-medium text-text-primary capitalize">{prdAnalysis.projectType}</p>
							</div>

							{#if prdAnalysis.features.length > 0}
								<div>
									<span class="text-xs text-text-tertiary">Features Detected ({prdAnalysis.features.length})</span>
									<div class="flex flex-wrap gap-1 mt-1">
										{#each prdAnalysis.features.slice(0, 6) as feature}
											<span class="text-xs px-2 py-0.5 bg-accent-primary/10 text-accent-primary rounded">
												{feature.name.slice(0, 20)}{feature.name.length > 20 ? '...' : ''}
											</span>
										{/each}
										{#if prdAnalysis.features.length > 6}
											<span class="text-xs px-2 py-0.5 bg-surface-tertiary text-text-tertiary rounded">
												+{prdAnalysis.features.length - 6} more
											</span>
										{/if}
									</div>
								</div>
							{/if}

							{#if prdAnalysis.techHints.length > 0}
								<div>
									<span class="text-xs text-text-tertiary">Tech Stack Hints</span>
									<div class="flex flex-wrap gap-1 mt-1">
										{#each prdAnalysis.techHints.slice(0, 5) as tech}
											<span class="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 rounded capitalize">
												{tech}
											</span>
										{/each}
									</div>
								</div>
							{/if}

							{#if generatedTasks.length > 0}
								<div class="pt-2 border-t border-border-subtle">
									<span class="text-xs text-text-tertiary">Auto-Generated Tasks</span>
									<p class="text-lg font-bold text-accent-primary">{generatedTasks.length} tasks ready</p>
								</div>
							{/if}
						</div>
					</div>

					<!-- Generate from PRD Button -->
					<button
						onclick={generateFromPRD}
						disabled={generatedTasks.length === 0 || isGenerating}
						class="w-full py-4 bg-gradient-to-r from-accent-primary to-accent-secondary text-white rounded-xl font-semibold text-lg shadow-lg shadow-accent-primary/25 hover:shadow-accent-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3"
					>
						{#if isGenerating}
							<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Generating...
						{:else}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
							</svg>
							Generate from PRD
						{/if}
					</button>

					<p class="text-center text-text-tertiary text-sm">
						{generatedTasks.length} tasks will be auto-generated
					</p>
				{:else}
					<!-- Parsed Tasks Preview (for Implementation tab) -->
					<div class="bg-surface-primary rounded-xl border border-border-subtle p-4">
						<h3 class="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
							<svg class="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
							</svg>
							{activeTab === 'prd' ? 'PRD Preview' : 'Parsed Tasks'}
						</h3>

						{#if activeTab === 'prd'}
							<p class="text-text-tertiary text-sm">
								Write or upload a PRD to auto-generate tasks. Click "Upload PRD" above or paste content in the editor.
							</p>
						{:else if parsedTasks.length === 0}
							<p class="text-text-tertiary text-sm">
								No tasks detected. Use this format in Implementation:
							</p>
							<pre class="mt-2 text-xs bg-bg-primary p-2 rounded text-text-secondary overflow-x-auto">### Task: Task Name
- **Skill**: skill-id
- **Description**: What to do
- **Depends on**: Other Task</pre>
						{:else}
							<div class="space-y-2 max-h-[300px] overflow-y-auto">
								{#each parsedTasks as task, i}
									<div class="p-2 bg-bg-primary rounded-lg border border-border-subtle">
										<div class="flex items-center gap-2">
											<span class="w-5 h-5 bg-accent-primary/20 text-accent-primary rounded text-xs flex items-center justify-center font-medium">
												{i + 1}
											</span>
											<span class="text-sm font-medium text-text-primary truncate">{task.title}</span>
										</div>
										{#if task.skillId}
											<div class="mt-1 ml-7">
												<span class="text-xs px-2 py-0.5 bg-accent-secondary/20 text-accent-secondary rounded">
													{task.skillId}
												</span>
											</div>
										{/if}
										{#if task.dependsOn.length > 0}
											<div class="mt-1 ml-7 text-xs text-text-tertiary">
												Depends on: {task.dependsOn.join(', ')}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Generate Button (for Implementation tab) -->
					{#if activeTab === 'implementation'}
						<button
							onclick={generateAndGoToCanvas}
							disabled={parsedTasks.length === 0 || isGenerating}
							class="w-full py-4 bg-gradient-to-r from-accent-primary to-accent-secondary text-white rounded-xl font-semibold text-lg shadow-lg shadow-accent-primary/25 hover:shadow-accent-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3"
						>
							{#if isGenerating}
								<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Generating...
							{:else}
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
								</svg>
								Generate Workflow
							{/if}
						</button>

						<p class="text-center text-text-tertiary text-sm">
							{parsedTasks.length} tasks will be created as canvas nodes
						</p>
					{/if}
				{/if}

				<!-- Quick Tips -->
				<div class="bg-surface-secondary/50 rounded-xl p-4">
					<h4 class="text-sm font-semibold text-text-secondary mb-2">
						{activeTab === 'prd' ? 'PRD Tips' : 'Quick Tips'}
					</h4>
					<ul class="text-xs text-text-tertiary space-y-1">
						{#if activeTab === 'prd'}
							<li>Upload any PRD document (.md or .txt)</li>
							<li>Features are auto-detected from bullet points</li>
							<li>Tech stack hints are extracted automatically</li>
							<li>Tasks are generated based on detected features</li>
						{:else}
							<li>Use <code class="bg-bg-primary px-1 rounded">### Task:</code> to define tasks</li>
							<li>Set <code class="bg-bg-primary px-1 rounded">- **Skill**:</code> to match a skill ID</li>
							<li>Use <code class="bg-bg-primary px-1 rounded">- **Depends on**:</code> for dependencies</li>
							<li>Tasks auto-connect based on dependencies</li>
						{/if}
					</ul>
				</div>
			</div>
		</div>
	</div>
</div>
