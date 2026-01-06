<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import LearningsTimeline from '$lib/components/LearningsTimeline.svelte';
	import LearningsFilter from '$lib/components/LearningsFilter.svelte';
	import WorkflowPatterns from '$lib/components/WorkflowPatterns.svelte';
	import AgentEffectiveness from '$lib/components/AgentEffectiveness.svelte';
	import LearningsExportImport from '$lib/components/LearningsExportImport.svelte';
	import {
		mindState,
		loadProject,
		addDecision,
		addIssue,
		resolveIssue,
		addSessionSummary,
		loadLearnings,
		type MindState
	} from '$lib/stores/mind.svelte';
	import { mcpState } from '$lib/stores/mcp.svelte';
	import {
		isMemoryConnected,
		memoryConnectionStatus,
		connectMemory
	} from '$lib/stores/memory-settings.svelte';
	import type { MindDecision, MindIssue } from '$lib/services/mcp-client';
	import type { Memory } from '$lib/types/memory';

	let currentState = $state<MindState>({
		project: null,
		loading: false,
		error: null,
		learnings: [],
		patterns: [],
		agentStats: {},
		learningsLoading: false,
		memoryConnected: false
	});
	let mcpConnected = $state(false);
	let memoryConnected = $state(false);
	let memoryStatus = $state<string>('disconnected');

	// Form states
	let activeTab = $state<'decisions' | 'issues' | 'sessions' | 'learnings'>('decisions');
	let showAddForm = $state(false);
	let formType = $state<'decision' | 'issue' | 'session'>('decision');

	// Decision form
	let decisionWhat = $state('');
	let decisionWhy = $state('');

	// Issue form
	let issueDescription = $state('');

	// Session form
	let sessionSummary = $state('');

	let submitting = $state(false);

	// Filtered learnings for the filter component
	let filteredLearnings = $state<Memory[]>([]);

	$effect(() => {
		const unsub1 = mindState.subscribe((s) => (currentState = s));
		const unsub2 = mcpState.subscribe((s) => (mcpConnected = s.status === 'connected'));
		const unsub3 = isMemoryConnected.subscribe((v) => (memoryConnected = v));
		const unsub4 = memoryConnectionStatus.subscribe((v) => (memoryStatus = v));
		return () => {
			unsub1();
			unsub2();
			unsub3();
			unsub4();
		};
	});

	onMount(async () => {
		await new Promise((r) => setTimeout(r, 500));
		if (mcpConnected) {
			await loadProject();
		}
	});

	// Reload when MCP connects
	$effect(() => {
		if (mcpConnected && !currentState.project && !currentState.loading) {
			loadProject();
		}
	});

	// Load learnings when tab is selected and memory is connected
	$effect(() => {
		if (activeTab === 'learnings' && memoryConnected && currentState.learnings.length === 0 && !currentState.learningsLoading) {
			loadLearnings();
		}
	});

	async function handleConnectMemory() {
		await connectMemory();
		if (memoryConnected) {
			loadLearnings();
		}
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function openAddForm(type: 'decision' | 'issue' | 'session') {
		formType = type;
		showAddForm = true;
	}

	function closeAddForm() {
		showAddForm = false;
		decisionWhat = '';
		decisionWhy = '';
		issueDescription = '';
		sessionSummary = '';
	}

	async function handleSubmit() {
		submitting = true;
		let success = false;

		if (formType === 'decision' && decisionWhat && decisionWhy) {
			success = await addDecision(decisionWhat, decisionWhy);
		} else if (formType === 'issue' && issueDescription) {
			success = await addIssue(issueDescription);
		} else if (formType === 'session' && sessionSummary) {
			success = await addSessionSummary(sessionSummary);
		}

		submitting = false;
		if (success) {
			closeAddForm();
		}
	}

	async function handleResolveIssue(issue: MindIssue) {
		await resolveIssue(issue.description);
	}

	const decisions = $derived(currentState.project?.decisions ?? []);
	const issues = $derived(currentState.project?.issues ?? []);
	const openIssues = $derived(issues.filter((i) => i.status === 'open'));
	const resolvedIssues = $derived(issues.filter((i) => i.status === 'resolved'));
	const sessions = $derived(currentState.project?.sessions ?? []);
</script>

<div class="min-h-screen bg-bg-primary flex flex-col">
	<Navbar />

	<main class="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center gap-3 mb-2">
				<h1 class="text-3xl font-serif text-text-primary">Mind</h1>
				<span class="font-mono text-sm text-accent-secondary">recall()</span>
				{#if !mcpConnected}
					<span
						class="px-2 py-0.5 text-xs font-mono text-yellow-400 border border-yellow-500/30 bg-yellow-500/10"
					>
						MCP Offline
					</span>
				{/if}
			</div>
			<p class="text-text-secondary">
				Semantic memory that persists across sessions. Store decisions, track issues, and record
				session summaries.
			</p>
		</div>

		<!-- Tabs -->
		<div class="flex items-center gap-2 mb-6">
			<button
				onclick={() => (activeTab = 'decisions')}
				class="px-3 py-1.5 font-mono text-sm border transition-all"
				class:bg-accent-primary={activeTab === 'decisions'}
				class:text-bg-primary={activeTab === 'decisions'}
				class:border-accent-primary={activeTab === 'decisions'}
				class:text-text-secondary={activeTab !== 'decisions'}
				class:border-surface-border={activeTab !== 'decisions'}
				class:hover:border-text-tertiary={activeTab !== 'decisions'}
			>
				Decisions
				{#if decisions.length > 0}<span class="opacity-60">({decisions.length})</span>{/if}
			</button>
			<button
				onclick={() => (activeTab = 'issues')}
				class="px-3 py-1.5 font-mono text-sm border transition-all"
				class:bg-accent-primary={activeTab === 'issues'}
				class:text-bg-primary={activeTab === 'issues'}
				class:border-accent-primary={activeTab === 'issues'}
				class:text-text-secondary={activeTab !== 'issues'}
				class:border-surface-border={activeTab !== 'issues'}
				class:hover:border-text-tertiary={activeTab !== 'issues'}
			>
				Issues
				{#if openIssues.length > 0}<span class="text-yellow-400">({openIssues.length} open)</span
					>{/if}
			</button>
			<button
				onclick={() => (activeTab = 'sessions')}
				class="px-3 py-1.5 font-mono text-sm border transition-all"
				class:bg-accent-primary={activeTab === 'sessions'}
				class:text-bg-primary={activeTab === 'sessions'}
				class:border-accent-primary={activeTab === 'sessions'}
				class:text-text-secondary={activeTab !== 'sessions'}
				class:border-surface-border={activeTab !== 'sessions'}
				class:hover:border-text-tertiary={activeTab !== 'sessions'}
			>
				Sessions
				{#if sessions.length > 0}<span class="opacity-60">({sessions.length})</span>{/if}
			</button>

			<div class="w-px h-5 bg-surface-border mx-1"></div>

			<button
				onclick={() => (activeTab = 'learnings')}
				class="px-3 py-1.5 font-mono text-sm border transition-all"
				class:bg-accent-primary={activeTab === 'learnings'}
				class:text-bg-primary={activeTab === 'learnings'}
				class:border-accent-primary={activeTab === 'learnings'}
				class:text-text-secondary={activeTab !== 'learnings'}
				class:border-surface-border={activeTab !== 'learnings'}
				class:hover:border-text-tertiary={activeTab !== 'learnings'}
			>
				Learnings
				{#if currentState.learnings.length > 0}<span class="opacity-60">({currentState.learnings.length})</span>{/if}
			</button>

			<div class="flex-1"></div>

			{#if mcpConnected && currentState.project}
				<button
					onclick={() =>
						openAddForm(
							activeTab === 'decisions' ? 'decision' : activeTab === 'issues' ? 'issue' : 'session'
						)}
					class="px-4 py-1.5 font-mono text-sm bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
				>
					+ Add {activeTab === 'decisions'
						? 'Decision'
						: activeTab === 'issues'
							? 'Issue'
							: 'Session'}
				</button>
			{/if}
		</div>

		<!-- Content -->
		{#if !mcpConnected}
			<div class="border border-surface-border bg-bg-secondary p-12 text-center">
				<div class="text-4xl mb-4 opacity-50">~</div>
				<h3 class="text-lg text-text-primary mb-2">MCP Server Offline</h3>
				<p class="text-sm text-text-secondary mb-4">
					Connect to the MCP server to access Mind memory.
				</p>
				<a href="/guide" class="font-mono text-sm text-accent-primary hover:underline">
					Setup Guide
				</a>
			</div>
		{:else if currentState.loading}
			<div class="border border-surface-border bg-bg-secondary p-12 text-center">
				<div class="animate-pulse text-text-tertiary font-mono">Loading memories...</div>
			</div>
		{:else if currentState.error}
			<div class="border border-red-500/30 bg-red-500/10 p-6">
				<p class="text-red-400 font-mono text-sm">{currentState.error}</p>
			</div>
		{:else if !currentState.project}
			<div class="border border-surface-border bg-bg-secondary p-12 text-center">
				<div class="text-4xl mb-4 opacity-50">[ ]</div>
				<h3 class="text-lg text-text-primary mb-2">No project loaded</h3>
				<p class="text-sm text-text-secondary mb-4">
					Start a new project or load an existing one.
				</p>
			</div>
		{:else}
			<!-- Decisions Tab -->
			{#if activeTab === 'decisions'}
				{#if decisions.length === 0}
					<div class="border border-surface-border bg-bg-secondary p-12 text-center">
						<div class="text-4xl mb-4 opacity-50">?</div>
						<h3 class="text-lg text-text-primary mb-2">No decisions yet</h3>
						<p class="text-sm text-text-secondary mb-4">
							Record architectural decisions and their rationale.
						</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each decisions as decision}
							<div class="border border-surface-border bg-bg-secondary p-4">
								<div class="flex items-start justify-between gap-4">
									<div class="flex-1">
										<h3 class="font-medium text-text-primary mb-1">{decision.what}</h3>
										<p class="text-sm text-text-secondary">{decision.why}</p>
									</div>
									<span class="text-xs font-mono text-text-tertiary whitespace-nowrap">
										{formatDate(decision.created_at)}
									</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}

			<!-- Issues Tab -->
			{#if activeTab === 'issues'}
				{#if issues.length === 0}
					<div class="border border-surface-border bg-bg-secondary p-12 text-center">
						<div class="text-4xl mb-4 opacity-50">v</div>
						<h3 class="text-lg text-text-primary mb-2">No issues tracked</h3>
						<p class="text-sm text-text-secondary mb-4">Track bugs, blockers, and things to fix.</p>
					</div>
				{:else}
					<div class="space-y-6">
						{#if openIssues.length > 0}
							<div>
								<h3 class="text-sm font-mono text-text-tertiary uppercase tracking-wider mb-3">
									Open ({openIssues.length})
								</h3>
								<div class="space-y-2">
									{#each openIssues as issue}
										<div
											class="border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start justify-between gap-4"
										>
											<div class="flex items-center gap-3">
												<span class="text-yellow-400 font-mono">[ ]</span>
												<p class="text-text-primary">{issue.description}</p>
											</div>
											<div class="flex items-center gap-2">
												<span class="text-xs font-mono text-text-tertiary">
													{formatDate(issue.created_at)}
												</span>
												<button
													onclick={() => handleResolveIssue(issue)}
													class="text-xs font-mono text-green-400 hover:underline"
												>
													Resolve
												</button>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if resolvedIssues.length > 0}
							<div>
								<h3 class="text-sm font-mono text-text-tertiary uppercase tracking-wider mb-3">
									Resolved ({resolvedIssues.length})
								</h3>
								<div class="space-y-2">
									{#each resolvedIssues as issue}
										<div
											class="border border-green-500/30 bg-green-500/10 p-4 flex items-start justify-between gap-4 opacity-75"
										>
											<div class="flex items-center gap-3">
												<span class="text-green-400 font-mono">[x]</span>
												<p class="text-text-secondary line-through">{issue.description}</p>
											</div>
											<span class="text-xs font-mono text-text-tertiary">
												{formatDate(issue.created_at)}
											</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			{/if}

			<!-- Sessions Tab -->
			{#if activeTab === 'sessions'}
				{#if sessions.length === 0}
					<div class="border border-surface-border bg-bg-secondary p-12 text-center">
						<div class="text-4xl mb-4 opacity-50">...</div>
						<h3 class="text-lg text-text-primary mb-2">No session summaries</h3>
						<p class="text-sm text-text-secondary mb-4">
							Record what was accomplished in each session.
						</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each sessions as session}
							<div class="border border-surface-border bg-bg-secondary p-4">
								<div class="flex items-start justify-between gap-4">
									<p class="text-text-secondary flex-1">{session.summary}</p>
									<span class="text-xs font-mono text-text-tertiary whitespace-nowrap">
										{formatDate(session.created_at)}
									</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}

			<!-- Learnings Tab -->
			{#if activeTab === 'learnings'}
				{#if !memoryConnected}
					<div class="border border-surface-border bg-bg-secondary p-12 text-center">
						<div class="text-4xl mb-4 opacity-50">~</div>
						<h3 class="text-lg text-text-primary mb-2">Mind Memory Offline</h3>
						<p class="text-sm text-text-secondary mb-4">
							Connect to Mind to view agent learnings and workflow patterns.
						</p>
						<button
							onclick={handleConnectMemory}
							class="px-4 py-2 font-mono text-sm bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
						>
							Connect to Mind
						</button>
						<a href="/settings" class="block mt-3 font-mono text-sm text-text-tertiary hover:text-accent-primary">
							Configure in Settings
						</a>
					</div>
				{:else}
					<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
						<!-- Main Timeline with Filters -->
						<div class="lg:col-span-2">
							<!-- Filters -->
							<LearningsFilter
								learnings={currentState.learnings}
								onFilter={(filtered) => filteredLearnings = filtered}
							/>

							<!-- Timeline -->
							<LearningsTimeline
								learnings={filteredLearnings.length > 0 || currentState.learnings.length === 0 ? filteredLearnings : currentState.learnings}
								loading={currentState.learningsLoading}
							/>
						</div>

						<!-- Sidebar -->
						<div class="space-y-6">
							<!-- Workflow Patterns -->
							<WorkflowPatterns
								patterns={currentState.patterns}
								loading={currentState.learningsLoading}
							/>

							<!-- Agent Stats (if we have any) -->
							{#each Object.entries(currentState.agentStats) as [agentId, stats]}
								<AgentEffectiveness
									{agentId}
									agentName={agentId}
									{stats}
									learnings={currentState.learnings.filter(l =>
										(l.metadata as { agent_id?: string })?.agent_id === agentId
									)}
								/>
							{/each}

							<!-- Export/Import -->
							<LearningsExportImport
								onImportComplete={(count) => {
									// Reload learnings after import
									if (count > 0) loadLearnings();
								}}
							/>
						</div>
					</div>
				{/if}
			{/if}
		{/if}
	</main>

	<Footer />
</div>

<!-- Add Form Modal -->
{#if showAddForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="absolute inset-0 bg-black/60" onclick={closeAddForm} role="presentation"></div>

		<div class="relative w-full max-w-md bg-bg-secondary border border-surface-border shadow-xl">
			<div class="p-4 border-b border-surface-border flex items-center justify-between">
				<h2 class="text-lg font-medium text-text-primary">
					Add {formType === 'decision'
						? 'Decision'
						: formType === 'issue'
							? 'Issue'
							: 'Session Summary'}
				</h2>
				<button onclick={closeAddForm} class="text-text-tertiary hover:text-text-secondary" aria-label="Close form">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<div class="p-4 space-y-4">
				{#if formType === 'decision'}
					<div>
						<label for="decision-what" class="block text-sm font-mono text-text-tertiary mb-1.5">
							What was decided? *
						</label>
						<input
							id="decision-what"
							type="text"
							bind:value={decisionWhat}
							placeholder="Use PostgreSQL for the database"
							class="w-full px-3 py-2 bg-bg-primary border border-surface-border text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
						/>
					</div>
					<div>
						<label for="decision-why" class="block text-sm font-mono text-text-tertiary mb-1.5">
							Why? *
						</label>
						<textarea
							id="decision-why"
							bind:value={decisionWhy}
							placeholder="We need JSONB support and the team has experience with it"
							rows="3"
							class="w-full px-3 py-2 bg-bg-primary border border-surface-border text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none"
						></textarea>
					</div>
				{:else if formType === 'issue'}
					<div>
						<label for="issue-desc" class="block text-sm font-mono text-text-tertiary mb-1.5">
							Issue Description *
						</label>
						<textarea
							id="issue-desc"
							bind:value={issueDescription}
							placeholder="Auth flow breaks when session expires"
							rows="3"
							class="w-full px-3 py-2 bg-bg-primary border border-surface-border text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none"
						></textarea>
					</div>
				{:else}
					<div>
						<label for="session-summary" class="block text-sm font-mono text-text-tertiary mb-1.5">
							Session Summary *
						</label>
						<textarea
							id="session-summary"
							bind:value={sessionSummary}
							placeholder="Implemented user authentication with JWT tokens, added login/signup pages"
							rows="4"
							class="w-full px-3 py-2 bg-bg-primary border border-surface-border text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none"
						></textarea>
					</div>
				{/if}
			</div>

			<div class="p-4 border-t border-surface-border flex items-center justify-end gap-2">
				<button
					onclick={closeAddForm}
					class="px-4 py-2 text-sm font-mono text-text-secondary border border-surface-border hover:border-text-tertiary hover:text-text-primary transition-all"
				>
					Cancel
				</button>
				<button
					onclick={handleSubmit}
					disabled={submitting ||
						(formType === 'decision' && (!decisionWhat || !decisionWhy)) ||
						(formType === 'issue' && !issueDescription) ||
						(formType === 'session' && !sessionSummary)}
					class="px-4 py-2 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{submitting ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}
