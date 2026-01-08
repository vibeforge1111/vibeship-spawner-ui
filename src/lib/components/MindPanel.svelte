<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';
	import {
		mindState,
		loadProject,
		addDecision,
		addIssue,
		resolveIssue,
		addSessionSummary,
		type MindState
	} from '$lib/stores/mind.svelte';
	import { mcpState } from '$lib/stores/mcp.svelte';
	import type { MindDecision, MindIssue } from '$lib/services/mcp-client';

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

	// Sub-tabs - Learnings first, then Decisions, Issues, Sessions
	let activeSubTab = $state<'learnings' | 'decisions' | 'issues' | 'sessions'>('learnings');

	// Quick add states
	let showQuickAdd = $state(false);
	let quickAddType = $state<'decision' | 'issue' | 'session'>('decision');
	let quickInput1 = $state('');
	let quickInput2 = $state('');
	let submitting = $state(false);

	$effect(() => {
		const unsub1 = mindState.subscribe((s) => (currentState = s));
		const unsub2 = mcpState.subscribe((s) => (mcpConnected = s.status === 'connected'));
		return () => {
			unsub1();
			unsub2();
		};
	});

	onMount(async () => {
		await new Promise((r) => setTimeout(r, 300));
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

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function openQuickAdd(type: 'decision' | 'issue' | 'session') {
		quickAddType = type;
		showQuickAdd = true;
		quickInput1 = '';
		quickInput2 = '';
	}

	function closeQuickAdd() {
		showQuickAdd = false;
		quickInput1 = '';
		quickInput2 = '';
	}

	async function handleQuickSubmit() {
		submitting = true;
		let success = false;

		if (quickAddType === 'decision' && quickInput1 && quickInput2) {
			success = await addDecision(quickInput1, quickInput2);
		} else if (quickAddType === 'issue' && quickInput1) {
			success = await addIssue(quickInput1);
		} else if (quickAddType === 'session' && quickInput1) {
			success = await addSessionSummary(quickInput1);
		}

		submitting = false;
		if (success) {
			closeQuickAdd();
		}
	}

	async function handleResolve(issue: MindIssue) {
		await resolveIssue(issue.description);
	}

	const learnings = $derived(currentState.learnings ?? []);
	const decisions = $derived(currentState.project?.decisions ?? []);
	const issues = $derived(currentState.project?.issues ?? []);
	const openIssues = $derived(issues.filter((i) => i.status === 'open'));
	const sessions = $derived(currentState.project?.sessions ?? []);
</script>

<div class="flex flex-col h-full">
	<!-- Header with sub-tabs -->
	<div class="flex items-center justify-between px-4 py-2 border-b border-surface-border">
		<div class="flex items-center gap-1">
			<button
				onclick={() => (activeSubTab = 'learnings')}
				class="px-2 py-1 text-xs font-mono transition-all"
				class:bg-green-500={activeSubTab === 'learnings'}
				class:text-bg-primary={activeSubTab === 'learnings'}
				class:text-text-secondary={activeSubTab !== 'learnings'}
				class:hover:text-text-primary={activeSubTab !== 'learnings'}
			>
				Learnings{#if learnings.length > 0}<span class="ml-1 opacity-60">({learnings.length})</span>{/if}
			</button>
			<button
				onclick={() => (activeSubTab = 'decisions')}
				class="px-2 py-1 text-xs font-mono transition-all"
				class:bg-accent-primary={activeSubTab === 'decisions'}
				class:text-bg-primary={activeSubTab === 'decisions'}
				class:text-text-secondary={activeSubTab !== 'decisions'}
				class:hover:text-text-primary={activeSubTab !== 'decisions'}
			>
				Decisions{#if decisions.length > 0}<span class="ml-1 opacity-60">({decisions.length})</span>{/if}
			</button>
			<button
				onclick={() => (activeSubTab = 'issues')}
				class="px-2 py-1 text-xs font-mono transition-all"
				class:bg-accent-primary={activeSubTab === 'issues'}
				class:text-bg-primary={activeSubTab === 'issues'}
				class:text-text-secondary={activeSubTab !== 'issues'}
				class:hover:text-text-primary={activeSubTab !== 'issues'}
			>
				Issues{#if openIssues.length > 0}<span class="ml-1 text-yellow-400">({openIssues.length})</span>{/if}
			</button>
			<button
				onclick={() => (activeSubTab = 'sessions')}
				class="px-2 py-1 text-xs font-mono transition-all"
				class:bg-accent-primary={activeSubTab === 'sessions'}
				class:text-bg-primary={activeSubTab === 'sessions'}
				class:text-text-secondary={activeSubTab !== 'sessions'}
				class:hover:text-text-primary={activeSubTab !== 'sessions'}
			>
				Sessions{#if sessions.length > 0}<span class="ml-1 opacity-60">({sessions.length})</span>{/if}
			</button>
		</div>
		<div class="flex items-center gap-2">
			{#if mcpConnected && currentState.project}
				<button
					onclick={() => openQuickAdd(activeSubTab === 'decisions' ? 'decision' : activeSubTab === 'issues' ? 'issue' : 'session')}
					class="px-2 py-1 text-xs font-mono text-accent-primary hover:bg-accent-primary hover:text-bg-primary transition-all border border-accent-primary/30"
				>
					+ Add
				</button>
			{/if}
			<a href="/mind" class="text-text-tertiary hover:text-accent-primary transition-colors" title="Open full Mind page">
				<Icon name="external-link" size={14} />
			</a>
		</div>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-3">
		{#if !mcpConnected}
			<div class="flex flex-col items-center justify-center h-full text-center py-8">
				<span class="text-text-tertiary mb-2"><Icon name="wifi-off" size={24} /></span>
				<p class="text-xs text-text-tertiary">MCP Offline</p>
				<a href="/guide" class="text-xs text-accent-primary hover:underline mt-1">Setup Guide</a>
			</div>
		{:else if currentState.loading}
			<div class="flex items-center justify-center h-full">
				<span class="text-xs text-text-tertiary font-mono animate-pulse">Loading...</span>
			</div>
		{:else if currentState.error}
			<div class="p-3 bg-red-500/10 border border-red-500/30">
				<p class="text-xs text-red-400 font-mono">{currentState.error}</p>
			</div>
		{:else if !currentState.project}
			<div class="flex flex-col items-center justify-center h-full text-center py-8">
				<span class="text-2xl text-text-tertiary mb-2">[ ]</span>
				<p class="text-xs text-text-tertiary">No project loaded</p>
			</div>
		{:else}
			<!-- Learnings -->
			{#if activeSubTab === 'learnings'}
				{#if learnings.length === 0}
					<div class="flex flex-col items-center justify-center h-full text-center py-8">
						<span class="text-2xl text-text-tertiary mb-2">💡</span>
						<p class="text-xs text-text-tertiary">No learnings yet</p>
						<p class="text-xs text-text-tertiary mt-1">Insights will appear as you work</p>
					</div>
				{:else}
					<div class="space-y-2">
						{#each learnings.slice(0, 10) as learning}
							<div class="p-2 bg-green-500/5 border border-green-500/20">
								<div class="flex items-start justify-between gap-2">
									<div class="flex-1 min-w-0">
										<p class="text-xs text-text-primary">{learning.content || learning.what || learning}</p>
										{#if learning.context}
											<p class="text-xs text-text-tertiary mt-0.5 line-clamp-1">{learning.context}</p>
										{/if}
									</div>
									{#if learning.created_at}
										<span class="text-[10px] font-mono text-text-tertiary whitespace-nowrap">
											{formatDate(learning.created_at)}
										</span>
									{/if}
								</div>
							</div>
						{/each}
						{#if learnings.length > 10}
							<a href="/mind" class="block text-center text-xs text-green-400 hover:underline py-2">
								View all {learnings.length} learnings
							</a>
						{/if}
					</div>
				{/if}
			{/if}

			<!-- Decisions -->
			{#if activeSubTab === 'decisions'}
				{#if decisions.length === 0}
					<div class="flex flex-col items-center justify-center h-full text-center py-8">
						<span class="text-2xl text-text-tertiary mb-2">?</span>
						<p class="text-xs text-text-tertiary">No decisions yet</p>
						<p class="text-xs text-text-tertiary mt-1">Record architectural decisions</p>
					</div>
				{:else}
					<div class="space-y-2">
						{#each decisions.slice().reverse().slice(0, 10) as decision}
							<div class="p-2 bg-bg-tertiary border border-surface-border">
								<div class="flex items-start justify-between gap-2">
									<div class="flex-1 min-w-0">
										<p class="text-xs text-text-primary font-medium truncate">{decision.what}</p>
										<p class="text-xs text-text-tertiary mt-0.5 line-clamp-2">{decision.why}</p>
									</div>
									<span class="text-[10px] font-mono text-text-tertiary whitespace-nowrap">
										{formatDate(decision.created_at)}
									</span>
								</div>
							</div>
						{/each}
						{#if decisions.length > 10}
							<a href="/mind" class="block text-center text-xs text-accent-primary hover:underline py-2">
								View all {decisions.length} decisions
							</a>
						{/if}
					</div>
				{/if}
			{/if}

			<!-- Issues -->
			{#if activeSubTab === 'issues'}
				{#if issues.length === 0}
					<div class="flex flex-col items-center justify-center h-full text-center py-8">
						<span class="text-2xl text-text-tertiary mb-2">v</span>
						<p class="text-xs text-text-tertiary">No issues tracked</p>
						<p class="text-xs text-text-tertiary mt-1">Track bugs and blockers</p>
					</div>
				{:else}
					<div class="space-y-2">
						{#each openIssues as issue}
							<div class="p-2 bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-2">
								<span class="text-yellow-400 font-mono text-xs">[ ]</span>
								<p class="text-xs text-text-primary flex-1 truncate">{issue.description}</p>
								<button
									onclick={() => handleResolve(issue)}
									class="text-[10px] font-mono text-green-400 hover:underline"
								>
									Resolve
								</button>
							</div>
						{/each}
						{#each issues.filter(i => i.status === 'resolved').slice(0, 3) as issue}
							<div class="p-2 bg-green-500/5 border border-green-500/20 flex items-center gap-2 opacity-60">
								<span class="text-green-400 font-mono text-xs">[x]</span>
								<p class="text-xs text-text-tertiary flex-1 truncate line-through">{issue.description}</p>
							</div>
						{/each}
					</div>
				{/if}
			{/if}

			<!-- Sessions -->
			{#if activeSubTab === 'sessions'}
				{#if sessions.length === 0}
					<div class="flex flex-col items-center justify-center h-full text-center py-8">
						<span class="text-2xl text-text-tertiary mb-2">...</span>
						<p class="text-xs text-text-tertiary">No session summaries</p>
						<p class="text-xs text-text-tertiary mt-1">Record what you accomplished</p>
					</div>
				{:else}
					<div class="space-y-2">
						{#each sessions.slice().reverse().slice(0, 5) as session}
							<div class="p-2 bg-bg-tertiary border border-surface-border">
								<div class="flex items-start justify-between gap-2">
									<p class="text-xs text-text-secondary flex-1 line-clamp-2">{session.summary}</p>
									<span class="text-[10px] font-mono text-text-tertiary whitespace-nowrap">
										{formatDate(session.created_at)}
									</span>
								</div>
							</div>
						{/each}
						{#if sessions.length > 5}
							<a href="/mind" class="block text-center text-xs text-accent-primary hover:underline py-2">
								View all {sessions.length} sessions
							</a>
						{/if}
					</div>
				{/if}
			{/if}
		{/if}
	</div>
</div>

<!-- Quick Add Modal -->
{#if showQuickAdd}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<div class="absolute inset-0 bg-black/60" onclick={closeQuickAdd}></div>
		<div class="relative w-full max-w-sm bg-bg-secondary border border-surface-border shadow-xl mx-4">
			<div class="p-3 border-b border-surface-border flex items-center justify-between">
				<h2 class="text-sm font-medium text-text-primary">
					Add {quickAddType === 'decision' ? 'Decision' : quickAddType === 'issue' ? 'Issue' : 'Session'}
				</h2>
				<button onclick={closeQuickAdd} class="text-text-tertiary hover:text-text-secondary">
					<Icon name="x" size={16} />
				</button>
			</div>

			<div class="p-3 space-y-3">
				{#if quickAddType === 'decision'}
					<div>
						<label for="quick-what" class="block text-xs font-mono text-text-tertiary mb-1">What?</label>
						<input
							id="quick-what"
							type="text"
							bind:value={quickInput1}
							placeholder="Use PostgreSQL for database"
							class="w-full px-2 py-1.5 bg-bg-primary border border-surface-border text-text-primary font-mono text-xs placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
						/>
					</div>
					<div>
						<label for="quick-why" class="block text-xs font-mono text-text-tertiary mb-1">Why?</label>
						<textarea
							id="quick-why"
							bind:value={quickInput2}
							placeholder="JSONB support and team experience"
							rows="2"
							class="w-full px-2 py-1.5 bg-bg-primary border border-surface-border text-text-primary font-mono text-xs placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none"
						></textarea>
					</div>
				{:else if quickAddType === 'issue'}
					<div>
						<label for="quick-issue" class="block text-xs font-mono text-text-tertiary mb-1">Issue</label>
						<textarea
							id="quick-issue"
							bind:value={quickInput1}
							placeholder="Auth flow breaks on session expiry"
							rows="2"
							class="w-full px-2 py-1.5 bg-bg-primary border border-surface-border text-text-primary font-mono text-xs placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none"
						></textarea>
					</div>
				{:else}
					<div>
						<label for="quick-session" class="block text-xs font-mono text-text-tertiary mb-1">Summary</label>
						<textarea
							id="quick-session"
							bind:value={quickInput1}
							placeholder="Implemented auth with JWT tokens"
							rows="3"
							class="w-full px-2 py-1.5 bg-bg-primary border border-surface-border text-text-primary font-mono text-xs placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none"
						></textarea>
					</div>
				{/if}
			</div>

			<div class="p-3 border-t border-surface-border flex items-center justify-end gap-2">
				<button
					onclick={closeQuickAdd}
					class="px-3 py-1.5 text-xs font-mono text-text-secondary border border-surface-border hover:border-text-tertiary"
				>
					Cancel
				</button>
				<button
					onclick={handleQuickSubmit}
					disabled={submitting || (quickAddType === 'decision' ? !quickInput1 || !quickInput2 : !quickInput1)}
					class="px-3 py-1.5 text-xs font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{submitting ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
