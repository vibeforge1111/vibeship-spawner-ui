<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import LearningsTimeline from '$lib/components/LearningsTimeline.svelte';
	import LearningsFilter from '$lib/components/LearningsFilter.svelte';
	import WorkflowPatterns from '$lib/components/WorkflowPatterns.svelte';
	import AgentEffectiveness from '$lib/components/AgentEffectiveness.svelte';
	import LearningsExportImport from '$lib/components/LearningsExportImport.svelte';
	import ImprovementCard from '$lib/components/ImprovementCard.svelte';
	import SelfImprovementMetrics from '$lib/components/SelfImprovementMetrics.svelte';
	import {
		mindState,
		addDecision,
		addIssue,
		resolveIssue,
		addSessionSummary,
		loadAllMindData,
		loadLearnings,
		loadMoreLearnings,
		loadDecisions,
		loadIssues,
		loadSessions,
		loadImprovements,
		applyImprovement,
		dismissImprovement,
		checkMemoryConnection,
		type MindState,
		type MindDecision,
		type MindIssue,
		type MindSession
	} from '$lib/stores/mind.svelte';
	import {
		isMemoryConnected,
		memoryConnectionStatus,
		connectMemory
	} from '$lib/stores/memory-settings.svelte';
	import type { Memory, Improvement } from '$lib/types/memory';

	let currentState = $state<MindState>({
		project: null,
		loading: false,
		error: null,
		learnings: [],
		patterns: [],
		agentStats: {},
		learningsLoading: false,
		memoryConnected: false,
		decisions: [],
		issues: [],
		sessions: [],
		decisionsLoading: false,
		issuesLoading: false,
		sessionsLoading: false,
		improvements: [],
		improvementsLoading: false,
		improvementStats: null
	});
	let memoryConnected = $state(false);
	let memoryStatus = $state<string>('disconnected');

	// Form states - Learnings first, then Improvements, then Intelligence (LITE+ metrics)
	let activeTab = $state<'learnings' | 'improvements' | 'intelligence' | 'decisions' | 'issues' | 'sessions'>('learnings');
	let showAddForm = $state(false);
	let formType = $state<'decision' | 'issue' | 'session'>('decision');
	let improvementFilter = $state<'all' | 'pending' | 'applied'>('all');

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
		const unsub2 = isMemoryConnected.subscribe((v) => (memoryConnected = v));
		const unsub3 = memoryConnectionStatus.subscribe((v) => (memoryStatus = v));
		return () => {
			unsub1();
			unsub2();
			unsub3();
		};
	});

	onMount(async () => {
		// Try to connect to Mind v5 and load all data
		await new Promise((r) => setTimeout(r, 300));
		const connected = await checkMemoryConnection();
		if (connected) {
			await loadAllMindData();
		}
	});

	// Load data for each tab when selected (if not already loaded)
	$effect(() => {
		if (!memoryConnected) return;

		if (activeTab === 'learnings' && currentState.learnings.length === 0 && !currentState.learningsLoading) {
			loadLearnings();
		} else if (activeTab === 'improvements' && currentState.improvements.length === 0 && !currentState.improvementsLoading) {
			loadImprovements();
		} else if (activeTab === 'decisions' && currentState.decisions.length === 0 && !currentState.decisionsLoading) {
			loadDecisions();
		} else if (activeTab === 'issues' && currentState.issues.length === 0 && !currentState.issuesLoading) {
			loadIssues();
		} else if (activeTab === 'sessions' && currentState.sessions.length === 0 && !currentState.sessionsLoading) {
			loadSessions();
		}
	});

	async function handleConnectMemory() {
		await connectMemory();
		const connected = await checkMemoryConnection();
		if (connected) {
			loadAllMindData();
		}
	}

	function formatDate(dateStr: string): string {
		// Mind v5 stores timestamps in UTC without 'Z' suffix
		// Append 'Z' if not present to ensure proper UTC parsing
		const utcDateStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
		const date = new Date(utcDateStr);
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

	async function handleApplyImprovement(id: string) {
		await applyImprovement(id);
	}

	async function handleDismissImprovement(id: string) {
		await dismissImprovement(id);
	}

	function handleViewEvidence(id: string) {
		// TODO: Open modal with evidence from source missions
		console.log('View evidence for:', id);
	}

	// Now using unified Mind v5 storage
	const decisions = $derived(currentState.decisions);
	const issues = $derived(currentState.issues);
	const openIssues = $derived(issues.filter((i) => i.status === 'open'));
	const resolvedIssues = $derived(issues.filter((i) => i.status === 'resolved'));
	const sessions = $derived(currentState.sessions);

	// Improvement derived
	const improvements = $derived(currentState.improvements);
	const filteredImprovements = $derived(
		improvementFilter === 'all'
			? improvements
			: improvements.filter((i) => i.status === improvementFilter)
	);
	const pendingCount = $derived(improvements.filter((i) => i.status === 'pending').length);
</script>

<div class="min-h-screen bg-bg-primary flex flex-col">
	<Navbar />

	<main class="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center gap-3 mb-2">
				<h1 class="text-3xl font-serif text-text-primary">Mind</h1>
				<span class="font-mono text-sm text-accent-secondary">v5</span>
				{#if !currentState.memoryConnected}
					<span
						class="px-2 py-0.5 text-xs font-mono text-yellow-400 border border-yellow-500/30 bg-yellow-500/10"
					>
						Offline
					</span>
				{:else}
					<span
						class="px-2 py-0.5 text-xs font-mono text-accent-primary border border-accent-primary/30 bg-accent-primary/10"
					>
						Connected
					</span>
				{/if}
			</div>
			<p class="text-text-secondary">
				Unified memory powered by Mind v5. All learnings, decisions, issues, and sessions stored in SQLite.
			</p>
		</div>

		<!-- Tabs -->
		<div class="flex items-center gap-2 mb-6">
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
			<button
				onclick={() => (activeTab = 'improvements')}
				class="px-3 py-1.5 font-mono text-sm border transition-all"
				class:bg-purple-500={activeTab === 'improvements'}
				class:text-white={activeTab === 'improvements'}
				class:border-purple-500={activeTab === 'improvements'}
				class:text-text-secondary={activeTab !== 'improvements'}
				class:border-surface-border={activeTab !== 'improvements'}
				class:hover:border-text-tertiary={activeTab !== 'improvements'}
			>
				Improvements
				{#if pendingCount > 0}<span class="text-yellow-400">({pendingCount} pending)</span>{/if}
			</button>
			<button
				onclick={() => (activeTab = 'intelligence')}
				class="px-3 py-1.5 font-mono text-sm border transition-all"
				class:bg-emerald-500={activeTab === 'intelligence'}
				class:text-white={activeTab === 'intelligence'}
				class:border-emerald-500={activeTab === 'intelligence'}
				class:text-text-secondary={activeTab !== 'intelligence'}
				class:border-surface-border={activeTab !== 'intelligence'}
				class:hover:border-text-tertiary={activeTab !== 'intelligence'}
			>
				Intelligence
				<span class="text-xs text-emerald-400 ml-1">LITE+</span>
			</button>
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

			<div class="flex-1"></div>

			{#if currentState.memoryConnected && activeTab !== 'learnings' && activeTab !== 'improvements' && activeTab !== 'intelligence'}
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
		{#if !currentState.memoryConnected}
			<div class="border border-surface-border bg-bg-secondary p-12 text-center">
				<div class="text-4xl mb-4 opacity-50">~</div>
				<h3 class="text-lg text-text-primary mb-2">Mind v5 Offline</h3>
				<p class="text-sm text-text-secondary mb-4">
					Start Mind v5 Lite to access unified memory storage.
				</p>
				<button
					onclick={handleConnectMemory}
					class="px-4 py-2 font-mono text-sm bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
				>
					Connect to Mind v5
				</button>
				<p class="mt-3 text-xs text-text-tertiary font-mono">
					Run: start_mind_lite.bat
				</p>
			</div>
		{:else if currentState.loading}
			<div class="border border-surface-border bg-bg-secondary p-12 text-center">
				<div class="animate-pulse text-text-tertiary font-mono">Loading memories...</div>
			</div>
		{:else if currentState.error}
			<div class="border border-red-500/30 bg-red-500/10 p-6">
				<p class="text-red-400 font-mono text-sm">{currentState.error}</p>
			</div>
		{:else}
			<!-- Learnings Tab (First) -->
			{#if activeTab === 'learnings'}
				{#if currentState.learningsLoading}
					<div class="border border-surface-border bg-bg-secondary p-12 text-center">
						<div class="animate-pulse text-text-tertiary font-mono">Loading learnings...</div>
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

							<!-- Load More Button -->
							{#if currentState.learningsHasMore}
								<div class="mt-4 text-center">
									<button
										onclick={() => loadMoreLearnings()}
										disabled={currentState.learningsLoadingMore}
										class="px-6 py-2 font-mono text-sm border border-surface-border text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-all disabled:opacity-50"
									>
										{#if currentState.learningsLoadingMore}
											Loading...
										{:else}
											Load All Learnings
										{/if}
									</button>
									<p class="mt-2 text-xs text-text-tertiary font-mono">
										Showing {currentState.learnings.length} of many learnings
									</p>
								</div>
							{/if}
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

			<!-- Improvements Tab -->
			{#if activeTab === 'improvements'}
				{#if currentState.improvementsLoading}
					<div class="border border-surface-border bg-bg-secondary p-12 text-center">
						<div class="animate-pulse text-text-tertiary font-mono">Loading improvements...</div>
					</div>
				{:else}
					<!-- Filter controls -->
					<div class="flex items-center gap-4 mb-6">
						<div class="flex items-center gap-2">
							<span class="text-sm font-mono text-text-tertiary">Filter:</span>
							<button
								onclick={() => (improvementFilter = 'pending')}
								class="px-3 py-1 text-xs font-mono border transition-all"
								class:bg-yellow-500={improvementFilter === 'pending'}
								class:text-black={improvementFilter === 'pending'}
								class:border-yellow-500={improvementFilter === 'pending'}
								class:text-text-secondary={improvementFilter !== 'pending'}
								class:border-surface-border={improvementFilter !== 'pending'}
							>
								Pending
							</button>
							<button
								onclick={() => (improvementFilter = 'applied')}
								class="px-3 py-1 text-xs font-mono border transition-all"
								class:bg-green-500={improvementFilter === 'applied'}
								class:text-black={improvementFilter === 'applied'}
								class:border-green-500={improvementFilter === 'applied'}
								class:text-text-secondary={improvementFilter !== 'applied'}
								class:border-surface-border={improvementFilter !== 'applied'}
							>
								Applied
							</button>
							<button
								onclick={() => (improvementFilter = 'all')}
								class="px-3 py-1 text-xs font-mono border transition-all"
								class:bg-accent-primary={improvementFilter === 'all'}
								class:text-bg-primary={improvementFilter === 'all'}
								class:border-accent-primary={improvementFilter === 'all'}
								class:text-text-secondary={improvementFilter !== 'all'}
								class:border-surface-border={improvementFilter !== 'all'}
							>
								All
							</button>
						</div>

						<div class="flex-1"></div>

						<!-- Stats summary -->
						{#if currentState.improvementStats}
							<div class="flex items-center gap-4 text-xs font-mono text-text-tertiary">
								<span>{currentState.improvementStats.pending} pending</span>
								<span>{currentState.improvementStats.applied} applied</span>
								<span class="text-accent-primary">
									{Math.round((currentState.improvementStats.avgImpact || 0) * 100)}% avg impact
								</span>
							</div>
						{/if}
					</div>

					{#if filteredImprovements.length === 0}
						<div class="border border-surface-border bg-bg-secondary p-12 text-center">
							<div class="text-4xl mb-4 opacity-50">~</div>
							<h3 class="text-lg text-text-primary mb-2">
								{#if improvementFilter === 'pending'}
									No pending improvements
								{:else if improvementFilter === 'applied'}
									No applied improvements yet
								{:else}
									No improvements found
								{/if}
							</h3>
							<p class="text-sm text-text-secondary mb-4">
								Improvements are generated from mission executions and agent learnings.
							</p>
						</div>
					{:else}
						<div class="grid gap-4 md:grid-cols-2">
							{#each filteredImprovements as improvement (improvement.id)}
								<ImprovementCard
									{improvement}
									onApply={handleApplyImprovement}
									onDismiss={handleDismissImprovement}
									onViewEvidence={handleViewEvidence}
								/>
							{/each}
						</div>
					{/if}
				{/if}
			{/if}

			<!-- Intelligence Tab (LITE+ Metrics) -->
			{#if activeTab === 'intelligence'}
				<SelfImprovementMetrics />
			{/if}

			<!-- Decisions Tab -->
			{#if activeTab === 'decisions'}
				{#if currentState.decisionsLoading}
					<div class="border border-surface-border bg-bg-secondary p-12 text-center">
						<div class="animate-pulse text-text-tertiary font-mono">Loading decisions...</div>
					</div>
				{:else if decisions.length === 0}
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
				<!-- Issues Guidance -->
				<div class="mb-6 p-4 border border-surface-border bg-bg-secondary">
					<div class="flex items-start gap-3">
						<span class="text-accent-secondary font-mono text-lg">?</span>
						<div class="text-sm">
							<p class="text-text-primary font-medium mb-2">How Issues Work</p>
							<ul class="text-text-secondary space-y-1">
								<li><span class="text-yellow-400 font-mono">Auto-created</span> when tasks fail during mission execution</li>
								<li><span class="text-accent-primary font-mono">+ Add Issue</span> to manually track bugs or blockers you encounter</li>
								<li><span class="text-green-400 font-mono">Resolve</span> when the issue is fixed - keeps a history for learning</li>
							</ul>
						</div>
					</div>
				</div>

				{#if currentState.issuesLoading}
					<div class="border border-surface-border bg-bg-secondary p-12 text-center">
						<div class="animate-pulse text-text-tertiary font-mono">Loading issues...</div>
					</div>
				{:else if issues.length === 0}
					<div class="border border-surface-border bg-bg-secondary p-12 text-center">
						<div class="text-4xl mb-4 opacity-50">v</div>
						<h3 class="text-lg text-text-primary mb-2">No issues tracked</h3>
						<p class="text-sm text-text-secondary mb-4">
							Issues are auto-created when tasks fail. Click <span class="text-accent-primary">+ Add Issue</span> to manually track problems.
						</p>
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
				{#if currentState.sessionsLoading}
					<div class="border border-surface-border bg-bg-secondary p-12 text-center">
						<div class="animate-pulse text-text-tertiary font-mono">Loading sessions...</div>
					</div>
				{:else if sessions.length === 0}
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
