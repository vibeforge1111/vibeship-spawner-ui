<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { missionsState, loadMissions, startMission as startCurrent, setCurrentMission, deleteMission } from '$lib/stores/missions.svelte';
	import { mcpState } from '$lib/stores/mcp.svelte';
	import type { Mission } from '$lib/services/mcp-client';

	type Tab = 'board' | 'scheduled';
	let activeTab = $state<Tab>('board');

	type CardStatus = 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'failed';
	type BoardCard = {
		id: string;
		name: string;
		status: CardStatus;
		mode: string;
		source: 'mcp' | 'spark';
		updatedAt: string | null;
		createdAt: string | null;
		taskCount: number;
		summary?: string | null;
	};

	let missions = $state<Mission[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let mcpConnected = $state(false);

	// Spark-dispatched missions live in mission-control-relay, not MCP. Pull
	// that board every few seconds and merge so /kanban shows the union.
	type RelayEntry = { missionId: string; status: string; lastEventType: string; lastUpdated: string; lastSummary: string; taskName: string | null };
	let relay = $state<RelayEntry[]>([]);
	let relayTimer: ReturnType<typeof setInterval> | null = null;
	let lastRefresh = $state<number>(0);
	let refreshPulse = $state(false);

	async function fetchRelay() {
		try {
			const r = await fetch('/api/mission-control/board');
			if (!r.ok) return;
			const data = await r.json();
			const buckets = data?.board ?? {};
			const flat: RelayEntry[] = [];
			for (const key of ['created', 'running', 'paused', 'completed', 'failed'] as const) {
				for (const entry of buckets[key] ?? []) flat.push(entry as RelayEntry);
			}
			relay = flat;
			lastRefresh = Date.now();
			refreshPulse = true;
			setTimeout(() => { refreshPulse = false; }, 600);
		} catch {
			/* swallow — relay endpoint isn't critical for MCP missions */
		}
	}

	function mcpToCard(m: Mission): BoardCard {
		return {
			id: m.id,
			name: m.name || 'Untitled mission',
			status: m.status,
			mode: m.mode,
			source: 'mcp',
			updatedAt: m.updated_at ?? null,
			createdAt: m.created_at ?? null,
			taskCount: m.tasks?.length ?? 0
		};
	}

	function relayStatusToCard(s: string): CardStatus {
		if (s === 'created') return 'ready';
		if (s === 'running' || s === 'paused' || s === 'completed' || s === 'failed') return s;
		return 'ready';
	}

	function relayToCard(e: RelayEntry): BoardCard {
		const name = e.taskName ?? e.missionId;
		return {
			id: e.missionId,
			name,
			status: relayStatusToCard(e.status),
			mode: 'spark',
			source: 'spark',
			updatedAt: e.lastUpdated ?? null,
			createdAt: e.lastUpdated ?? null,
			taskCount: 0,
			summary: e.lastSummary
		};
	}

	// Merge — MCP wins on id collision because it carries richer data.
	const cards = $derived(() => {
		const byId = new Map<string, BoardCard>();
		for (const e of relay) byId.set(e.missionId, relayToCard(e));
		for (const m of missions) byId.set(m.id, mcpToCard(m));
		return [...byId.values()];
	});

	// Search + source filter applied before column splitting.
	let searchQuery = $state('');
	let sourceFilter = $state<'all' | 'mcp' | 'spark'>('all');

	const filteredCards = $derived(() => {
		const q = searchQuery.trim().toLowerCase();
		return cards().filter((c) => {
			if (sourceFilter !== 'all' && c.source !== sourceFilter) return false;
			if (!q) return true;
			return c.name.toLowerCase().includes(q) || (c.summary ?? '').toLowerCase().includes(q);
		});
	});

	const toDo = $derived(filteredCards().filter((c) => c.status === 'draft' || c.status === 'ready'));
	const inProgress = $derived(filteredCards().filter((c) => c.status === 'running' || c.status === 'paused'));
	const done = $derived(
		filteredCards()
			.filter((c) => c.status === 'completed' || c.status === 'failed')
			.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
	);

	onMount(() => {
		const unsubMcp = mcpState.subscribe((s) => { mcpConnected = s.status === 'connected'; });
		const unsub = missionsState.subscribe((s) => {
			missions = s.missions;
			loading = s.loading;
			error = s.error;
		});
		loadMissions({ limit: 200 }).catch(() => {});
		fetchRelay();
		relayTimer = setInterval(fetchRelay, 4000);
		return () => { unsub(); unsubMcp(); };
	});

	onDestroy(() => {
		if (relayTimer) clearInterval(relayTimer);
	});

	function formatDate(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
		return d.toLocaleString(undefined, opts);
	}

	function statusDot(s: CardStatus): string {
		switch (s) {
			case 'running': return 'bg-accent-primary animate-pulse';
			case 'paused': return 'bg-status-amber';
			case 'failed': return 'bg-status-error';
			case 'completed': return 'bg-status-success';
			case 'ready': return 'bg-text-secondary';
			default: return 'bg-text-faint';
		}
	}

	// Priority is inferred until a real priority field ships on cards.
	function priorityOf(c: BoardCard): 'High' | 'Medium' | 'Low' {
		if (c.status === 'running' || c.status === 'paused') return 'High';
		if (c.mode === 'multi-llm-orchestrator' || c.mode === 'spark') return 'High';
		if (c.taskCount > 5) return 'High';
		if (c.status === 'ready' || c.status === 'draft') return 'Medium';
		return 'Low';
	}

	function priorityClass(p: 'High' | 'Medium' | 'Low'): string {
		if (p === 'High')   return 'bg-status-error/15 text-status-error border-status-error/30';
		if (p === 'Medium') return 'bg-status-amber/15 text-status-amber border-status-amber/30';
		return 'bg-bg-primary text-text-tertiary border-surface-border';
	}

	function columnDot(title: string): string {
		if (title === 'To do')       return 'bg-text-tertiary';
		if (title === 'In progress') return 'bg-accent-primary';
		return 'bg-status-success';
	}

	async function handleStart(card: BoardCard) {
		if (card.source !== 'mcp') return; // Spark missions auto-start via /api/spark/run
		const m = missions.find((x) => x.id === card.id);
		if (!m) return;
		setCurrentMission(m);
		await startCurrent();
		await loadMissions({ limit: 200 });
	}

	// Quick-add: POST /api/spark/run with a one-line goal.
	let quickAddOpen = $state(false);
	let quickAddGoal = $state('');
	let quickAddDispatching = $state(false);
	let quickAddError = $state<string | null>(null);

	async function handleQuickAdd() {
		const goal = quickAddGoal.trim();
		if (!goal || quickAddDispatching) return;
		quickAddDispatching = true;
		quickAddError = null;
		try {
			const r = await fetch('/api/spark/run', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ goal, userId: 'kanban-quickadd', requestId: `quickadd-${Date.now()}` })
			});
			const data = await r.json();
			if (!r.ok || !data?.success) {
				quickAddError = data?.error ?? `HTTP ${r.status}`;
			} else {
				quickAddGoal = '';
				quickAddOpen = false;
				await fetchRelay();
			}
		} catch (e) {
			quickAddError = e instanceof Error ? e.message : 'dispatch failed';
		} finally {
			quickAddDispatching = false;
		}
	}

	async function handleDelete(card: BoardCard) {
		if (card.source !== 'mcp') return;
		if (!confirm(`Delete mission "${card.name}"?`)) return;
		await deleteMission(card.id);
		await loadMissions({ limit: 200 });
	}
</script>

<svelte:head>
	<title>Kanban · spawner</title>
</svelte:head>

<div class="min-h-screen bg-bg-primary flex flex-col">
	<Navbar />

	<main class="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
		<header class="mb-6 flex items-end justify-between gap-4">
			<div>
				<p class="overline flex items-center gap-2">
					<span>Mission board</span>
					<span
						class="w-1.5 h-1.5 rounded-full transition-all {refreshPulse ? 'bg-accent-primary scale-150' : 'bg-text-faint'}"
						title={lastRefresh ? `Synced ${formatDate(new Date(lastRefresh).toISOString())}` : 'Syncing…'}
					></span>
				</p>
				<h1 class="text-2xl font-sans font-semibold text-text-primary tracking-tight">
					{cards().length} missions · {inProgress.length} running
				</h1>
			</div>
			<div class="flex items-center gap-1 p-0.5 border border-surface-border rounded-md bg-bg-secondary">
				<button
					class="px-3 py-1 text-xs font-mono rounded-sm transition-colors {activeTab === 'board' ? 'bg-accent-primary text-bg-primary' : 'text-text-secondary hover:text-text-primary'}"
					onclick={() => activeTab = 'board'}
				>
					Board
				</button>
				<button
					class="px-3 py-1 text-xs font-mono rounded-sm transition-colors {activeTab === 'scheduled' ? 'bg-accent-primary text-bg-primary' : 'text-text-secondary hover:text-text-primary'}"
					onclick={() => activeTab = 'scheduled'}
				>
					Scheduled
				</button>
			</div>
		</header>

		{#if activeTab === 'board'}
			<!-- Board filter row -->
			<div class="flex items-center gap-3 mb-4 flex-wrap">
				<div class="relative flex-1 min-w-[200px] max-w-md">
					<Icon name="search" size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
					<input
						type="text"
						placeholder="Search missions..."
						bind:value={searchQuery}
						class="w-full pl-8 pr-3 py-1.5 bg-bg-secondary border border-surface-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
					/>
				</div>
				<div class="flex items-center gap-1 p-0.5 border border-surface-border rounded-md bg-bg-secondary">
					{#each [{id: 'all', label: 'All'}, {id: 'mcp', label: 'MCP'}, {id: 'spark', label: 'Spark'}] as opt}
						<button
							class="px-2.5 py-0.5 text-[11px] font-mono rounded-sm transition-colors {sourceFilter === opt.id ? 'bg-accent-primary text-bg-primary' : 'text-text-secondary hover:text-text-primary'}"
							onclick={() => sourceFilter = opt.id as typeof sourceFilter}
						>
							{opt.label}
						</button>
					{/each}
				</div>
				{#if searchQuery || sourceFilter !== 'all'}
					<span class="font-mono text-[11px] text-text-tertiary">{filteredCards().length} / {cards().length}</span>
				{/if}
				<div class="flex-1"></div>
				<button
					onclick={() => { quickAddOpen = !quickAddOpen; quickAddError = null; }}
					class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-accent-primary text-bg-primary rounded-md hover:bg-accent-primary-hover transition-all"
				>
					<Icon name="plus" size={12} />
					<span>New mission</span>
				</button>
			</div>

			{#if quickAddOpen}
				<div class="mb-4 border border-surface-border rounded-lg bg-bg-secondary p-3">
					<div class="flex items-start gap-2">
						<input
							type="text"
							placeholder="Describe what Spark should run..."
							bind:value={quickAddGoal}
							onkeydown={(e) => { if (e.key === 'Enter') handleQuickAdd(); if (e.key === 'Escape') { quickAddOpen = false; quickAddGoal = ''; } }}
							class="flex-1 px-3 py-2 bg-bg-primary border border-surface-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary font-mono"
						/>
						<button
							onclick={handleQuickAdd}
							disabled={!quickAddGoal.trim() || quickAddDispatching}
							class="px-3 py-2 text-xs font-mono bg-accent-primary text-bg-primary rounded-md hover:bg-accent-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{quickAddDispatching ? 'Dispatching…' : 'Run'}
						</button>
						<button
							onclick={() => { quickAddOpen = false; quickAddGoal = ''; quickAddError = null; }}
							class="px-2 py-2 text-xs font-mono text-text-tertiary rounded-md hover:text-text-primary transition-all"
							aria-label="Cancel"
						>
							<Icon name="x" size={14} />
						</button>
					</div>
					{#if quickAddError}
						<p class="mt-2 font-mono text-[11px] text-status-error">{quickAddError}</p>
					{:else}
						<p class="mt-2 font-mono text-[10px] text-text-tertiary">
							Routes through <code class="text-accent-primary">/api/spark/run</code> → mission-control-relay → this board.
							Press Enter to dispatch, Esc to cancel.
						</p>
					{/if}
				</div>
			{/if}

			{#if !mcpConnected && !loading && cards().length === 0}
				<div class="border border-surface-border rounded-lg bg-bg-secondary px-5 py-10 text-center">
					<p class="font-mono text-xs text-text-tertiary">
						No missions yet. Create one from the canvas or fire <code class="font-mono text-accent-primary">POST /api/spark/run</code>.
					</p>
				</div>
			{:else if error && cards().length === 0}
				<div class="border border-surface-border rounded-lg bg-bg-secondary px-5 py-10 text-center">
					<p class="font-mono text-xs text-text-tertiary">{error}</p>
				</div>
			{:else}
				<div class="grid md:grid-cols-3 gap-5">
					{#each [
						{ title: 'To do', items: toDo, empty: 'No pending missions' },
						{ title: 'In progress', items: inProgress, empty: 'Nothing running' },
						{ title: 'Done', items: done, empty: 'No history yet' }
					] as col}
						<section class="flex flex-col min-h-[320px]">
							<!-- Column header: pill + count, like the reference board -->
							<div class="flex items-center gap-2 px-1 pb-3">
								<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-bg-secondary border border-surface-border">
									<span class="w-1.5 h-1.5 rounded-full {columnDot(col.title)}"></span>
									<span class="font-sans text-[11px] font-medium text-text-bright">{col.title}</span>
								</span>
								<span class="font-mono text-[11px] text-text-tertiary">{col.items.length}</span>
							</div>

							<div class="flex-1 space-y-2">
								{#each col.items as c (c.id)}
									{@const p = priorityOf(c)}
									<article class="group px-3.5 py-3 rounded-lg border border-surface-border bg-bg-secondary hover:border-border-strong transition-all">
										<a href={`/missions/${c.id}`} class="block">
											<div class="flex items-start gap-2 mb-2">
												<Icon name="file-text" size={14} class="text-text-tertiary mt-0.5 shrink-0" />
												<span class="font-sans text-sm leading-snug text-text-primary group-hover:text-accent-primary transition-colors">
													{c.name}
												</span>
											</div>
											{#if c.source === 'spark' && c.summary}
												<p class="font-mono text-[10px] text-text-tertiary leading-snug mb-2 line-clamp-2">{c.summary}</p>
											{/if}
											<div class="flex items-center gap-2 flex-wrap">
												<span class="px-1.5 py-0.5 text-[10px] font-mono rounded-sm border {priorityClass(p)}">{p}</span>
												<span class="font-mono text-[10px] text-text-tertiary">
													{formatDate(c.updatedAt ?? c.createdAt)}
												</span>
												{#if c.source === 'spark'}
													<span class="px-1.5 py-0.5 text-[10px] font-mono rounded-sm border border-accent-mid text-accent-primary bg-accent-subtle">spark</span>
												{/if}
												{#if c.status === 'running' || c.status === 'paused'}
													<span class="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-text-tertiary">
														<span class="w-1.5 h-1.5 rounded-full {statusDot(c.status)}"></span>
														{c.status}
													</span>
												{/if}
											</div>
										</a>
										<div class="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
											{#if c.source === 'mcp' && (c.status === 'ready' || c.status === 'draft')}
												<button
													onclick={() => handleStart(c)}
													class="px-2 py-0.5 text-[10px] font-mono text-accent-primary border border-accent-primary/30 rounded-sm hover:bg-accent-primary hover:text-bg-primary transition-all"
												>
													Start
												</button>
											{/if}
											<a
												href={`/missions/${c.id}`}
												class="px-2 py-0.5 text-[10px] font-mono text-text-secondary border border-surface-border rounded-sm hover:border-text-tertiary hover:text-text-primary transition-all"
											>
												Open
											</a>
											{#if c.source === 'mcp'}
												<button
													onclick={() => handleDelete(c)}
													class="ml-auto px-2 py-0.5 text-[10px] font-mono text-text-tertiary rounded-sm hover:text-status-red transition-all"
													title="Delete mission"
												>
													Delete
												</button>
											{/if}
										</div>
									</article>
								{:else}
									<div class="px-3.5 py-5 rounded-lg border border-dashed border-surface-border bg-bg-secondary/40 text-center">
										<p class="font-mono text-[11px] text-text-faint">{col.empty}</p>
									</div>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- Scheduled tab — placeholder for phase 2 -->
			<div class="border border-surface-border rounded-lg bg-bg-secondary px-5 py-12 text-center">
				<p class="overline" style="margin-bottom: 8px;">Coming in next pass</p>
				<h2 class="text-lg font-sans font-medium text-text-primary mb-2">Scheduled missions</h2>
				<p class="text-sm text-text-secondary max-w-md mx-auto mb-4">
					Recurring missions with cron expressions, dispatched through <code class="font-mono text-accent-primary">/api/spark/run</code>
					so they relay to Spark Intelligence Builder and the Telegram bridge.
				</p>
				<p class="font-mono text-[11px] text-text-tertiary">
					Next: cron input · run history · "Run now" · pause/resume.
				</p>
			</div>
		{/if}
	</main>

	<Footer />
</div>
