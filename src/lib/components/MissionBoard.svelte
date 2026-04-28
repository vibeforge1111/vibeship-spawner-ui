<!--
	MissionBoard — full kanban (board + scheduled tabs) extracted from
	/kanban/+page.svelte so it can render on the landing page AND /kanban
	with one source of truth. No page chrome (Navbar/Footer) — caller supplies.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { missionsState, loadMissions, startMission as startCurrent, setCurrentMission, deleteMission } from '$lib/stores/missions.svelte';
	import { mcpState } from '$lib/stores/mcp.svelte';
	import { initPipelines, pipelines } from '$lib/stores/pipelines.svelte';
	import type { Mission } from '$lib/services/mcp-client';
	import type { PipelineMetadata } from '$lib/stores/pipelines.svelte';
	import { mergeMissionBoardCards, type MissionBoardCard as BoardCard } from '$lib/services/mission-board-cards';

	type Tab = 'board' | 'scheduled';
	let activeTab = $state<Tab>('board');

	type CardStatus = BoardCard['status'];

	let missions = $state<Mission[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let mcpConnected = $state(false);
	let currentPipelines = $state<PipelineMetadata[]>([]);

	type RelayEntry = {
		missionId: string;
		missionName: string | null;
		status: string;
		lastEventType: string;
		lastUpdated: string;
		lastSummary: string;
		taskName: string | null;
		taskCount?: number;
		taskStatusCounts?: {
			queued: number;
			running: number;
			completed: number;
			failed: number;
			cancelled: number;
			total: number;
		};
		taskNames?: string[];
		tasks?: Array<{ title: string; skills: string[]; status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' }>;
		providerSummary?: string | null;
		providerResults?: Array<{ providerId: string; status: string; summary: string }>;
	};
	let relay = $state<RelayEntry[]>([]);
	let relayTimer: ReturnType<typeof setInterval> | null = null;
	let lastRefresh = $state<number>(0);
	let refreshPulse = $state(false);

	type ScheduleRecord = {
		id: string;
		cron: string;
		action: 'mission' | 'loop';
		payload: Record<string, unknown>;
		chatId?: string | null;
		createdAt: string;
		lastFiredAt: string | null;
		nextFireAt: string | null;
		fireCount: number;
		lastStatus: string | null;
		enabled: boolean;
	};
	let schedules = $state<ScheduleRecord[]>([]);
	let schedulesLoading = $state(false);
	let schedulesError = $state<string | null>(null);
	let scheduleTimer: ReturnType<typeof setInterval> | null = null;
	let showCreate = $state(false);
	let newCron = $state('0 3 * * *');
	let newAction = $state<'mission' | 'loop'>('loop');
	let newGoal = $state('');
	let newChip = $state('domain-chip-spark-ops-critic');
	let newRounds = $state(1);
	let newChatId = $state('8319079055');
	let creating = $state(false);

	async function fetchSchedules() {
		schedulesLoading = true;
		try {
			const r = await fetch('/api/scheduled');
			const data = await r.json();
			schedules = Array.isArray(data.schedules) ? data.schedules : [];
			schedulesError = null;
		} catch (err: unknown) {
			schedulesError = err instanceof Error ? err.message : 'fetch failed';
		} finally {
			schedulesLoading = false;
		}
	}

	async function createScheduleFromForm() {
		creating = true;
		try {
			const payload =
				newAction === 'mission'
					? { goal: newGoal }
					: { chipKey: newChip, rounds: newRounds };
			const r = await fetch('/api/scheduled', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cron: newCron,
					action: newAction,
					payload,
					chatId: newChatId || null
				})
			});
			const data = await r.json();
			if (!data.ok) {
				schedulesError = data.error || 'create failed';
			} else {
				schedulesError = null;
				showCreate = false;
				newGoal = '';
				await fetchSchedules();
			}
		} catch (err: unknown) {
			schedulesError = err instanceof Error ? err.message : 'create failed';
		} finally {
			creating = false;
		}
	}

	async function deleteScheduleById(id: string) {
		const prev = schedules;
		schedules = schedules.filter((s) => s.id !== id);
		try {
			const r = await fetch(`/api/scheduled?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
			const data = await r.json();
			if (!data.ok) {
				schedules = prev;
				schedulesError = data.error || 'delete failed';
			} else {
				schedulesError = null;
				fetchSchedules();
			}
		} catch (err: unknown) {
			schedules = prev;
			schedulesError = err instanceof Error ? err.message : 'delete failed';
		}
	}

	function formatNextFire(iso: string | null): string {
		if (!iso) return '-';
		try {
			const d = new Date(iso);
			const ms = d.getTime() - Date.now();
			const localTime = d.toLocaleString(undefined, {
				weekday: 'short',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});
			if (ms <= 0) return `due now (${localTime})`;
			const s = Math.floor(ms / 1000);
			let rel: string;
			if (s < 60) rel = `${s}s`;
			else if (s < 3600) rel = `${Math.floor(s / 60)}m`;
			else if (s < 86_400) rel = `${Math.floor(s / 3600)}h`;
			else rel = `${Math.floor(s / 86_400)}d`;
			return `${localTime} (in ${rel})`;
		} catch {
			return iso;
		}
	}

	function formatTime12(h: number, m: number): string {
		const hh = ((h + 11) % 12) + 1;
		const mm = String(m).padStart(2, '0');
		const suffix = h < 12 ? 'AM' : 'PM';
		return mm === '00' ? `${hh} ${suffix}` : `${hh}:${mm} ${suffix}`;
	}

	const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	function humanizeCron(cron: string): string {
		const parts = cron.trim().split(/\s+/);
		if (parts.length !== 5) return cron;
		const [minute, hour, dom, month, dow] = parts;

		if (hour === '*' && dom === '*' && month === '*' && dow === '*') {
			if (minute === '*') return 'Every minute';
			const m = /^\*\/(\d+)$/.exec(minute);
			if (m) return `Every ${m[1]} minute${m[1] === '1' ? '' : 's'}`;
			if (/^\d+$/.test(minute)) return `At ${minute} min past every hour`;
		}

		if (dom === '*' && month === '*' && dow === '*') {
			const h = /^\*\/(\d+)$/.exec(hour);
			if (h && /^\d+$/.test(minute)) return `Every ${h[1]} hour${h[1] === '1' ? '' : 's'} at :${minute.padStart(2, '0')}`;
			if (/^\d+$/.test(hour) && /^\d+$/.test(minute)) {
				const label = dow === '*' ? 'Daily' : '';
				return `${label} at ${formatTime12(+hour, +minute)}`.trim();
			}
		}

		if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && dom === '*' && month === '*' && /^\d$/.test(dow)) {
			return `Every ${DOW[+dow]} at ${formatTime12(+hour, +minute)}`;
		}

		if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && /^\d+$/.test(dom) && month === '*' && dow === '*') {
			return `Monthly on day ${dom} at ${formatTime12(+hour, +minute)}`;
		}

		if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && /^\d+$/.test(dom) && /^\d+$/.test(month) && dow === '*') {
			return `Yearly on ${MON[+month - 1]} ${dom} at ${formatTime12(+hour, +minute)}`;
		}

		return `Custom: ${cron}`;
	}

	const ACTION_DESCRIPTIONS: Record<string, string> = {
		loop: "Runs the chip's recursive self-improvement cycle (suggest -> evaluate). Token cost depends on the chip's hooks.",
		mission: 'Spawns a new mission via /api/spark/run that dispatches to all configured LLM providers in parallel.'
	};

	function payloadSummary(rec: ScheduleRecord): string {
		if (rec.action === 'mission') return String((rec.payload as { goal?: string }).goal ?? '');
		const p = rec.payload as { chipKey?: string; rounds?: number };
		return `${p.chipKey} x${p.rounds ?? 1}`;
	}

	function humanSummary(rec: ScheduleRecord): string {
		if (rec.action === 'mission') {
			const goal = String((rec.payload as { goal?: string }).goal ?? '(no goal)');
			return `Run mission "${goal}"`;
		}
		const p = rec.payload as { chipKey?: string; rounds?: number };
		const n = p.rounds ?? 1;
		return `Run ${n} loop round${n === 1 ? '' : 's'} on ${p.chipKey}`;
	}

	function scheduleCell(rec: ScheduleRecord): string {
		const pattern = humanizeCron(rec.cron);
		if (!rec.nextFireAt) return pattern;
		const ms = new Date(rec.nextFireAt).getTime() - Date.now();
		if (ms <= 0) return `${pattern} · due now`;
		const s = Math.floor(ms / 1000);
		let rel: string;
		if (s < 60) rel = `${s}s`;
		else if (s < 3600) rel = `${Math.floor(s / 60)}m`;
		else if (s < 86_400) rel = `${Math.floor(s / 3600)}h`;
		else rel = `${Math.floor(s / 86_400)}d`;
		return `${pattern} · next in ${rel}`;
	}

	const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

	$effect(() => {
		if (activeTab === 'scheduled') {
			fetchSchedules();
			scheduleTimer = setInterval(fetchSchedules, 15_000);
			return () => {
				if (scheduleTimer) clearInterval(scheduleTimer);
				scheduleTimer = null;
			};
		}
		return undefined;
	});

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
			/* relay endpoint not critical */
		}
	}

	function mcpToCard(m: Mission): BoardCard {
		const tasks = m.tasks?.map((t) => {
			const agent = m.agents?.find((a) => a.id === t.assignedTo);
			return { title: t.title, skills: agent?.skills ?? [] };
		});
		return {
			id: m.id,
			name: m.name || 'Untitled mission',
			status: m.status,
			mode: m.mode,
			source: 'mcp',
			updatedAt: m.updated_at ?? null,
			createdAt: m.created_at ?? null,
			taskCount: m.tasks?.length ?? 0,
			strategy: m.mode,
			tasks
		};
	}

	function relayStatusToCard(s: string): CardStatus {
		if (s === 'created') return 'ready';
		if (s === 'running' || s === 'paused' || s === 'completed' || s === 'failed') return s;
		return 'ready';
	}

	function relayToCard(e: RelayEntry): BoardCard {
		const name = e.missionName ?? e.taskName ?? e.missionId;
		const status = relayStatusToCard(e.status);
		const showSummary = status === 'completed' || status === 'failed';
		const taskCount = e.taskCount ?? 0;
		const strategy = taskCount <= 1 ? 'single' : 'parallel_consensus';
		return {
			id: e.missionId,
			name,
			status,
			mode: 'spark',
			source: 'spark',
			updatedAt: e.lastUpdated ?? null,
			createdAt: e.lastUpdated ?? null,
			taskCount,
			taskStatusCounts: e.taskStatusCounts,
			strategy,
			taskNames: e.taskNames,
			tasks: e.tasks ?? e.taskNames?.map((title) => ({ title, skills: [] })),
			summary: showSummary ? e.lastSummary : undefined,
			providerSummary: e.providerSummary,
			providerResults: e.providerResults,
			canvasHref: canvasHrefForMission(e.missionId, name)
		};
	}

	function missionNumericSuffix(id: string): string {
		return id.replace(/^(spark|mission)-/, '');
	}

	function normalizeTitle(value: string | null | undefined): string {
		return (value || '')
			.toLowerCase()
			.replace(/^spark run:\s*/, '')
			.replace(/[^\p{L}\p{N}]+/gu, ' ')
			.trim();
	}

	function canvasHrefForMission(missionId: string, missionName?: string | null): string | null {
		const suffix = missionNumericSuffix(missionId);
		const normalizedMission = normalizeTitle(missionName);
		const pipeline = currentPipelines.find((candidate) => {
			if (suffix && candidate.id.includes(suffix)) return true;
			if (normalizedMission && normalizeTitle(candidate.name) === normalizedMission) return true;
			return false;
		});
		return pipeline ? `/canvas?pipeline=${encodeURIComponent(pipeline.id)}` : null;
	}

	const cards = $derived(() => {
		return mergeMissionBoardCards(relay.map(relayToCard), missions.map(mcpToCard));
	});

	let searchQuery = $state('');
	let sourceFilter = $state<'all' | 'mcp' | 'spark'>('all');
	let searchFocused = $state(false);

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
		initPipelines();
		const unsubMcp = mcpState.subscribe((s) => { mcpConnected = s.status === 'connected'; });
		const unsubPipelines = pipelines.subscribe((p) => { currentPipelines = p; });
		const unsub = missionsState.subscribe((s) => {
			missions = s.missions;
			loading = s.loading;
			error = s.error;
		});
		loadMissions({ limit: 200 }).catch(() => {});
		fetchRelay();
		relayTimer = setInterval(fetchRelay, 4000);
		return () => { unsub(); unsubMcp(); unsubPipelines(); };
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

	function taskStatusClass(status: string | undefined): string {
		if (status === 'completed') return 'text-status-success border-status-success/40 bg-status-success/10';
		if (status === 'failed') return 'text-status-error border-status-error/40 bg-status-error/10';
		if (status === 'cancelled') return 'text-text-tertiary border-surface-border bg-bg-primary/70';
		if (status === 'running') return 'text-accent-primary border-accent-primary/40 bg-accent-primary/10';
		return 'text-status-amber border-status-amber/35 bg-status-amber/10';
	}

	function taskStatusLabel(status: string | undefined): string {
		if (status === 'completed') return 'Done';
		if (status === 'failed') return 'Failed';
		if (status === 'cancelled') return 'Cancelled';
		if (status === 'running') return 'Running';
		return 'Queued';
	}

	function taskProgressSummary(card: BoardCard): string | null {
		const counts = card.taskStatusCounts;
		if (!counts || counts.total <= 0) return null;
		const parts = [];
		if (counts.completed) parts.push(`${counts.completed} done`);
		if (counts.running) parts.push(`${counts.running} running`);
		if (counts.failed) parts.push(`${counts.failed} failed`);
		if (counts.cancelled) parts.push(`${counts.cancelled} cancelled`);
		if (counts.queued) parts.push(`${counts.queued} queued`);
		return parts.length ? parts.join(' / ') : `${counts.total} tasks`;
	}

	function columnDot(title: string): string {
		if (title === 'To do')       return 'bg-text-tertiary';
		if (title === 'In progress') return 'bg-accent-primary';
		return 'bg-status-success';
	}

	let expandedCardId = $state<string | null>(null);

	function toggleCard(card: BoardCard) {
		expandedCardId = expandedCardId === card.id ? null : card.id;
	}

	async function handleStart(card: BoardCard) {
		if (card.source !== 'mcp') return;
		const m = missions.find((x) => x.id === card.id);
		if (!m) return;
		setCurrentMission(m);
		await startCurrent();
		await loadMissions({ limit: 200 });
	}

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

<div class="w-full">
	<header class="mb-6 flex items-end justify-between gap-4 flex-wrap">
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

		<div class="flex items-center gap-2 flex-wrap justify-end">
			{#if activeTab === 'board'}
				<div
					class="relative transition-all"
					class:w-40={!searchFocused && !searchQuery}
					class:w-64={searchFocused || !!searchQuery}
				>
					<Icon name="search" size={12} class="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
					<input
						type="text"
						placeholder="Search…"
						bind:value={searchQuery}
						onfocus={() => (searchFocused = true)}
						onblur={() => (searchFocused = false)}
						class="w-full pl-7 pr-2 py-1 bg-bg-secondary border border-surface-border rounded-md text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
					/>
				</div>

				<div class="flex items-center gap-0.5 p-0.5 border border-surface-border rounded-md bg-bg-secondary">
					{#each [{id: 'all', label: 'All'}, {id: 'mcp', label: 'Canvas'}, {id: 'spark', label: 'Spark'}] as opt}
						<button
							class="px-2 py-0.5 text-[10px] font-mono rounded-sm transition-colors {sourceFilter === opt.id ? 'bg-accent-primary text-bg-primary' : 'text-text-secondary hover:text-text-primary'}"
							onclick={() => sourceFilter = opt.id as typeof sourceFilter}
						>
							{opt.label}
						</button>
					{/each}
				</div>

				{#if searchQuery || sourceFilter !== 'all'}
					<span class="font-mono text-[10px] text-text-tertiary">{filteredCards().length}/{cards().length}</span>
				{/if}

				<button
					onclick={() => { quickAddOpen = !quickAddOpen; quickAddError = null; }}
					class="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-accent-primary text-bg-primary rounded-md hover:bg-accent-primary-hover transition-all"
					title="New mission"
				>
					<Icon name="plus" size={12} />
					<span class="hidden sm:inline">New</span>
				</button>
			{/if}

			<div class="flex items-center gap-1 p-0.5 border border-surface-border rounded-md bg-bg-secondary">
				<button
					class="px-2.5 py-0.5 text-[11px] font-mono rounded-sm transition-colors {activeTab === 'board' ? 'bg-accent-primary text-bg-primary' : 'text-text-secondary hover:text-text-primary'}"
					onclick={() => activeTab = 'board'}
				>
					Board
				</button>
				<button
					class="px-2.5 py-0.5 text-[11px] font-mono rounded-sm transition-colors {activeTab === 'scheduled' ? 'bg-accent-primary text-bg-primary' : 'text-text-secondary hover:text-text-primary'}"
					onclick={() => activeTab = 'scheduled'}
				>
					Scheduled
				</button>
			</div>
		</div>
	</header>

	{#if activeTab === 'board'}

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
						<div class="sticky top-0 z-10 flex items-center justify-between gap-2 px-1 py-4 mb-1 bg-bg-primary/90 backdrop-blur-sm border-b border-surface-border">
							<div class="flex items-center gap-2.5">
								<span class="w-2 h-2 rounded-full {columnDot(col.title)}"></span>
								<span class="font-mono text-xs font-semibold text-text-bright tracking-widest uppercase">{col.title}</span>
							</div>
							<span class="font-mono text-sm text-text-tertiary tabular-nums">{col.items.length}</span>
						</div>

						<div class="flex-1 space-y-3">
							{#each col.items as c (c.id)}
								<article class="group relative px-5 py-4 rounded-md border border-surface-border bg-bg-secondary hover:border-border-strong transition-all" class:border-accent-primary={expandedCardId === c.id}>
									<button
										type="button"
										class="block w-full p-0 border-0 bg-transparent text-left text-inherit cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary/70 rounded-md"
										aria-expanded={expandedCardId === c.id}
										onclick={() => toggleCard(c)}
									>
										<div class="flex items-center gap-2.5 mb-3">
											<span class="w-2 h-2 rounded-full shrink-0 {statusDot(c.status)}"></span>
											<h3 class="font-sans text-base font-semibold leading-snug text-text-primary group-hover:text-accent-primary transition-colors line-clamp-2">
												{c.name}
											</h3>
										</div>

										{#if c.source === 'spark' && c.summary}
											<p class="text-sm text-text-secondary leading-relaxed mb-3 line-clamp-2">{c.summary}</p>
										{/if}

										{#if c.source === 'spark' && c.providerSummary}
											<p class="text-sm text-accent-primary/90 leading-relaxed mb-3 line-clamp-3">{c.providerSummary}</p>
										{/if}

										{#if c.tasks && c.tasks.length > 0}
											<ul class="space-y-2.5 mb-3 border-l-2 border-surface-border/60 pl-3.5">
												{#each c.tasks.slice(0, 3) as task}
													<li>
														<div class="flex items-center gap-2">
															<div class="font-sans text-sm text-text-secondary leading-snug line-clamp-1 min-w-0 flex-1">{task.title}</div>
															<span class="shrink-0 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wide rounded-sm border {taskStatusClass(task.status)}">
																{taskStatusLabel(task.status)}
															</span>
														</div>
														{#if task.skills && task.skills.length > 0}
															<div class="flex items-center gap-1.5 flex-wrap mt-1.5">
																{#each task.skills.slice(0, 3) as skill}
																	<span class="px-2 py-0.5 text-[11px] font-mono rounded-full text-text-tertiary bg-bg-primary/60 border border-surface-border/70">{skill}</span>
																{/each}
																{#if task.skills.length > 3}
																	<span class="text-[11px] font-mono text-text-faint">+{task.skills.length - 3}</span>
																{/if}
															</div>
														{/if}
													</li>
												{/each}
												{#if c.tasks.length > 3}
													<li class="font-mono text-xs text-text-faint">+{c.tasks.length - 3} more</li>
												{/if}
											</ul>
										{/if}

										<div class="font-mono text-xs text-text-tertiary flex items-center gap-2">
											<span>{formatDate(c.updatedAt ?? c.createdAt)}</span>
											{#if c.taskCount > 0 && (!c.tasks || c.tasks.length === 0)}
												<span>· {c.taskCount} task{c.taskCount !== 1 ? 's' : ''}</span>
											{/if}
											{#if taskProgressSummary(c)}
												<span>· {taskProgressSummary(c)}</span>
											{/if}
											{#if c.source === 'spark'}
												<span class="text-accent-primary/70" title={c.strategy ?? ''}>· spark</span>
											{/if}
											{#if c.status === 'running' || c.status === 'paused'}
												<span class="ml-auto">{c.status}</span>
											{/if}
										</div>

										{#if expandedCardId === c.id}
											<div class="mt-3 border-t border-surface-border/70 pt-3 space-y-2">
												<div class="grid grid-cols-2 gap-2 font-mono text-[10px] text-text-tertiary">
													<span>ID: {c.id}</span>
													<span>Status: {c.status}</span>
													<span>Source: {c.source}</span>
													<span>Priority: {priorityOf(c)}</span>
												</div>

												{#if c.summary}
													<p class="font-mono text-[10px] text-text-secondary leading-snug">{c.summary}</p>
												{/if}

												{#if c.providerSummary}
													<p class="font-mono text-[10px] text-accent-primary/80 leading-snug">{c.providerSummary}</p>
												{/if}

												{#if taskProgressSummary(c)}
													<p class="font-mono text-[10px] text-text-secondary leading-snug">Tasks: {taskProgressSummary(c)}</p>
												{/if}

												{#if c.providerResults && c.providerResults.length > 0}
													<div class="space-y-1">
														{#each c.providerResults.slice(0, 3) as result}
															<p class="font-mono text-[10px] text-text-tertiary">
																<span class="text-text-secondary">{result.providerId}</span>
																<span> {result.status}</span>
																{#if result.summary}
																	<span>: {result.summary}</span>
																{/if}
															</p>
														{/each}
													</div>
												{/if}

												<p class="font-mono text-[10px] text-text-faint">Click again to collapse.</p>
											</div>
										{/if}
									</button>

									<div class="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										{#if c.canvasHref}
											<a
												href={c.canvasHref}
												data-sveltekit-reload
												onclick={(event) => event.stopPropagation()}
												class="px-2 py-0.5 text-[10px] font-mono text-accent-primary border border-accent-primary/30 rounded-sm hover:bg-accent-primary hover:text-bg-primary transition-all"
												title="Open this project's canvas"
											>
												Canvas
											</a>
										{/if}
										{#if c.source === 'mcp' && (c.status === 'ready' || c.status === 'draft')}
											<button
												onclick={() => handleStart(c)}
												class="px-2 py-0.5 text-[10px] font-mono text-accent-primary border border-accent-primary/30 rounded-sm hover:bg-accent-primary hover:text-bg-primary transition-all"
											>
												Start
											</button>
										{/if}
										{#if c.source === 'mcp'}
											<button
												onclick={() => handleDelete(c)}
												class="px-2 py-0.5 text-[10px] font-mono text-text-tertiary rounded-sm hover:text-status-red transition-all"
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
		<div class="flex items-center justify-between mb-4">
			<div>
				<p class="overline">Scheduled missions ({schedules.length})</p>
				<h2 class="text-lg font-sans font-medium text-text-primary">Cron-driven missions + autoloops</h2>
			</div>
			<button
				class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
				onclick={() => (showCreate = !showCreate)}
			>
				{showCreate ? 'Cancel' : '+ New schedule'}
			</button>
		</div>

		{#if schedulesError}
			<div class="mb-4 border border-status-error bg-status-error/10 p-3 font-mono text-xs text-status-error">
				{schedulesError}
			</div>
		{/if}

		{#if showCreate}
			<div class="mb-4 border border-surface-border bg-bg-secondary p-4 space-y-3">
				<div class="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-3 items-start">
					<label for="schedule-cron" class="font-mono text-[11px] text-text-tertiary pt-1">Cron</label>
					<div>
						<input
							id="schedule-cron"
							type="text"
							bind:value={newCron}
							placeholder="0 9 * * *"
							class="w-full px-2 py-1 bg-bg-primary border border-surface-border font-mono text-sm text-text-primary focus:outline-none focus:border-accent-primary"
						/>
						<p class="font-mono text-[10px] text-accent-primary mt-1">
							{humanizeCron(newCron)} <span class="text-text-tertiary">(in your timezone, {LOCAL_TZ})</span>
						</p>
						<p class="font-mono text-[10px] text-text-tertiary mt-1">
							Examples: <code>*/5 * * * *</code> every 5 min · <code>0 9 * * *</code> daily 9 AM · <code>0 */6 * * *</code> every 6 hours · <code>0 0 * * 0</code> weekly Sunday midnight
						</p>
					</div>
					<label for="schedule-action" class="font-mono text-[11px] text-text-tertiary pt-1">Action</label>
					<div>
						<select
							id="schedule-action"
							bind:value={newAction}
							class="w-full px-2 py-1 bg-bg-primary border border-surface-border font-mono text-sm text-text-primary focus:outline-none focus:border-accent-primary"
						>
							<option value="loop">loop - recursive self-improvement cycle</option>
							<option value="mission">mission - dispatch to all LLM providers</option>
						</select>
						<p class="font-mono text-[10px] text-text-tertiary mt-1">
							{ACTION_DESCRIPTIONS[newAction] ?? ''}
						</p>
					</div>
					{#if newAction === 'mission'}
						<label for="schedule-goal" class="font-mono text-[11px] text-text-tertiary">Goal</label>
						<input
							id="schedule-goal"
							type="text"
							bind:value={newGoal}
							placeholder="research seedify news today"
							class="w-full px-2 py-1 bg-bg-primary border border-surface-border font-mono text-sm text-text-primary focus:outline-none focus:border-accent-primary"
						/>
					{:else}
						<label for="schedule-chip-key" class="font-mono text-[11px] text-text-tertiary">Chip key</label>
						<input
							id="schedule-chip-key"
							type="text"
							bind:value={newChip}
							class="w-full px-2 py-1 bg-bg-primary border border-surface-border font-mono text-sm text-text-primary focus:outline-none focus:border-accent-primary"
						/>
						<label for="schedule-rounds" class="font-mono text-[11px] text-text-tertiary">Rounds</label>
						<input
							id="schedule-rounds"
							type="number"
							min="1"
							max="10"
							bind:value={newRounds}
							class="w-20 px-2 py-1 bg-bg-primary border border-surface-border font-mono text-sm text-text-primary focus:outline-none focus:border-accent-primary"
						/>
					{/if}
					<label for="schedule-chat-id" class="font-mono text-[11px] text-text-tertiary">Chat id (optional)</label>
					<input
						id="schedule-chat-id"
						type="text"
						bind:value={newChatId}
						placeholder="Telegram chat id to notify on fire"
						class="w-full px-2 py-1 bg-bg-primary border border-surface-border font-mono text-sm text-text-primary focus:outline-none focus:border-accent-primary"
					/>
				</div>
				<button
					class="px-3 py-1.5 text-xs font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all disabled:opacity-50"
					disabled={creating || !newCron || (newAction === 'mission' ? !newGoal : !newChip)}
					onclick={createScheduleFromForm}
				>
					{creating ? 'Creating...' : 'Create schedule'}
				</button>
			</div>
		{/if}

		{#if schedulesLoading && schedules.length === 0}
			<div class="border border-surface-border bg-bg-secondary px-5 py-10 text-center font-mono text-xs text-text-tertiary">
				Loading...
			</div>
		{:else if schedules.length === 0}
			<div class="border border-surface-border bg-bg-secondary px-5 py-10 text-center">
				<p class="font-mono text-xs text-text-tertiary">
					No schedules yet. Click <span class="text-accent-primary">+ New schedule</span> or fire
					<code class="font-mono text-accent-primary">POST /api/scheduled</code>.
				</p>
			</div>
		{:else}
			<p class="font-mono text-[10px] text-text-tertiary mb-2">
				All times in your local timezone ({LOCAL_TZ}). Hover any cell for details.
			</p>
			<div class="border border-surface-border overflow-hidden">
				<table class="w-full text-sm font-mono">
					<thead class="bg-bg-secondary border-b border-surface-border">
						<tr>
							<th class="text-left px-3 py-2 text-[11px] text-text-tertiary">What it does</th>
							<th class="text-left px-3 py-2 text-[11px] text-text-tertiary">Action</th>
							<th class="text-right px-3 py-2 text-[11px] text-text-tertiary">Fires</th>
							<th class="text-left px-3 py-2 text-[11px] text-text-tertiary">Schedule</th>
							<th class="text-left px-3 py-2 text-[11px] text-text-tertiary">Last status</th>
							<th class="text-right px-3 py-2 text-[11px] text-text-tertiary"></th>
						</tr>
					</thead>
					<tbody>
						{#each schedules as rec (rec.id)}
							<tr class="border-b border-surface-border hover:bg-bg-secondary/50">
								<td class="px-3 py-2 text-text-primary" title={`Schedule id: ${rec.id}\nCron: ${rec.cron}\nCreated: ${new Date(rec.createdAt).toLocaleString()}`}>
									<div class="text-sm">{humanSummary(rec)}</div>
									<div class="text-[10px] text-text-tertiary">{rec.id}</div>
								</td>
								<td class="px-3 py-2">
									<span
										class="inline-block px-1.5 py-0.5 text-[10px] bg-bg-secondary border border-surface-border text-accent-primary cursor-help"
										title={ACTION_DESCRIPTIONS[rec.action] ?? ''}
									>
										{rec.action}
									</span>
								</td>
								<td class="px-3 py-2 text-right text-text-secondary" title={rec.lastFiredAt ? `Last fired: ${new Date(rec.lastFiredAt).toLocaleString()}` : 'Never fired yet'}>
									{rec.fireCount}
								</td>
								<td class="px-3 py-2 text-text-secondary cursor-help" title={`cron: ${rec.cron}${rec.nextFireAt ? `\nNext fire (local): ${new Date(rec.nextFireAt).toLocaleString()}` : ''}`}>
									{scheduleCell(rec)}
								</td>
								<td class="px-3 py-2 text-[11px] text-text-tertiary max-w-xs truncate" title={rec.lastStatus ?? 'no fires yet'}>
									{rec.lastStatus ?? '-'}
								</td>
								<td class="px-3 py-2 text-right">
									<button
										class="text-[11px] text-status-error hover:opacity-80"
										onclick={() => deleteScheduleById(rec.id)}
										title="Delete this schedule permanently"
									>
										delete
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
