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
	import {
		canRunCreatorMissionBoardCard,
		canValidateCreatorMissionBoardCard,
		getMissionBoardCardActionLinks,
		mergeMissionBoardCards,
		type MissionBoardCard as BoardCard
	} from '$lib/services/mission-board-cards';
	import {
		buildMissionImprovementDraft,
		type MissionImprovementDraft,
		type MissionImprovementSource
	} from '$lib/services/mission-improvement';

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
		executionStarted?: boolean;
		queuedAt?: string | null;
		startedAt?: string | null;
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
		projectLineage?: BoardCard['projectLineage'];
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
			for (const key of ['created', 'running', 'paused', 'completed', 'failed', 'cancelled'] as const) {
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
			queuedAt: m.created_at ?? null,
			startedAt: m.status === 'running' ? (m.updated_at ?? null) : null,
			taskCount: m.tasks?.length ?? 0,
			strategy: m.mode,
			tasks,
			detailHref: `/missions/${encodeURIComponent(m.id)}`
		};
	}

	function relayStatusToCard(s: string): CardStatus {
		if (s === 'created') return 'ready';
		if (s === 'running' || s === 'paused' || s === 'completed' || s === 'failed' || s === 'cancelled') return s;
		return 'ready';
	}

	function relayToCard(e: RelayEntry): BoardCard {
		const name = e.missionName ?? e.taskName ?? e.missionId;
		const status = relayStatusToCard(e.status);
		const showSummary = status === 'completed' || status === 'failed' || status === 'cancelled';
		const taskCount = e.taskCount ?? 0;
		const strategy = taskCount <= 1 ? 'single' : 'parallel_consensus';
		return {
			id: e.missionId,
			name,
			status,
			mode: e.missionId.startsWith('mission-creator-') ? 'creator-mission' : 'spark',
			source: 'spark',
			updatedAt: e.lastUpdated ?? null,
			createdAt: e.lastUpdated ?? null,
			lastEventType: e.lastEventType,
			executionStarted: e.executionStarted,
			queuedAt: e.queuedAt ?? null,
			startedAt: e.startedAt ?? null,
			taskCount,
			taskStatusCounts: e.taskStatusCounts,
			strategy,
			taskNames: e.taskNames,
			tasks: e.tasks ?? e.taskNames?.map((title) => ({ title, skills: [] })),
			summary: showSummary ? e.lastSummary : undefined,
			providerSummary: e.providerSummary,
			providerResults: e.providerResults,
			projectLineage: e.projectLineage ?? null,
			canvasHref: canvasHrefForMission(e.missionId, name),
			detailHref: `/missions/${encodeURIComponent(e.missionId)}`
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
		return pipeline
			? `/canvas?pipeline=${encodeURIComponent(pipeline.id)}&mission=${encodeURIComponent(missionId)}`
			: `/canvas?mission=${encodeURIComponent(missionId)}`;
	}

	const cards = $derived(() => {
		return mergeMissionBoardCards(relay.map(relayToCard), missions.map(mcpToCard));
	});

	let searchQuery = $state('');
	let searchFocused = $state(false);

	const filteredCards = $derived(() => {
		const q = searchQuery.trim().toLowerCase();
		return cards().filter((c) => {
			if (!q) return true;
			return c.name.toLowerCase().includes(q) || (c.summary ?? '').toLowerCase().includes(q);
		});
	});

	const toDo = $derived(filteredCards().filter((c) => c.status === 'draft' || c.status === 'ready'));
	const inProgress = $derived(filteredCards().filter((c) => c.status === 'running' || c.status === 'paused'));
	const done = $derived(
		filteredCards()
			.filter((c) => c.status === 'completed' || c.status === 'failed' || c.status === 'cancelled')
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
		applyImproveUrlParams();
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
			case 'cancelled': return 'bg-text-tertiary';
			case 'completed': return 'bg-status-success';
			case 'ready': return 'bg-text-secondary';
			default: return 'bg-text-faint';
		}
	}

	function taskProgressPercent(card: BoardCard): number {
		const counts = card.taskStatusCounts;
		if (!counts || counts.total <= 0) {
			if (card.status === 'completed') return 100;
			if (card.status === 'running') return 48;
			return 0;
		}
		return Math.round(((counts.completed + counts.failed + counts.cancelled) / counts.total) * 100);
	}

	function hasTaskProgress(card: BoardCard): boolean {
		const counts = card.taskStatusCounts;
		return Boolean(counts && counts.total > 0);
	}

	function taskProgressRatio(card: BoardCard): string {
		const counts = card.taskStatusCounts;
		if (!counts || counts.total <= 0) return '';
		const settled = counts.completed + counts.failed + counts.cancelled;
		return `${settled}/${counts.total}`;
	}

	function taskProgressLabel(card: BoardCard): string {
		const counts = card.taskStatusCounts;
		if (!counts || counts.total <= 0) return '';
		return `${taskProgressRatio(card)} task${counts.total === 1 ? '' : 's'} completed`;
	}

	function focusLine(card: BoardCard): string | null {
		if (card.status === 'completed') return null;
		const summary = card.summary?.trim();
		if (summary && summary !== card.name) return summary;
		if (card.status === 'running') return 'Running now.';
		if (card.status === 'paused') return 'Paused and ready to resume.';
		if (card.status === 'failed') return card.providerSummary?.replace(/^Codex:\s*/i, '').trim() || 'Needs attention.';
		if (card.status === 'cancelled') return 'Cancelled.';
		if (card.status === 'ready' || card.status === 'draft') return 'Queued for dispatch.';
		return null;
	}

	function cardTimestamp(card: BoardCard): string {
		if ((card.status === 'ready' || card.status === 'draft') && card.queuedAt) return formatDate(card.queuedAt);
		if ((card.status === 'running' || card.status === 'paused') && card.startedAt) return formatDate(card.startedAt);
		return formatDate(card.updatedAt ?? card.createdAt);
	}

	function typeIcon(card: BoardCard): string {
		return 'box';
	}

	function typeLabel(card: BoardCard): string {
		return 'Canvas';
	}

	function typeBadgeClass(card: BoardCard): string {
		return 'border-surface-border bg-bg-primary/70 text-text-tertiary group-hover:border-iris/60 group-hover:text-iris';
	}

	function lineageSummary(card: BoardCard): string | null {
		const lineage = card.projectLineage;
		if (!lineage) return null;
		const parts = [];
		if (lineage.iterationNumber) parts.push(`Iteration ${lineage.iterationNumber}`);
		if (lineage.projectPath) parts.push(lineage.projectPath.split(/[\\/]/).filter(Boolean).pop() || lineage.projectPath);
		return parts.length ? parts.join(' / ') : null;
	}

	function hasCardActions(card: BoardCard): boolean {
		return Boolean(
			card.projectLineage?.previewUrl ||
			card.projectLineage?.projectPath ||
			canRunCreatorMissionBoardCard(card) ||
			canValidateCreatorMissionBoardCard(card) ||
			card.source === 'mcp'
		);
	}

	function columnDot(title: string): string {
		if (title === 'To do')       return 'bg-text-tertiary';
		if (title === 'In progress') return 'bg-accent-primary';
		return 'bg-status-success';
	}

	async function handleStart(card: BoardCard) {
		if (card.source !== 'mcp') return;
		const m = missions.find((x) => x.id === card.id);
		if (!m) return;
		setCurrentMission(m);
		await startCurrent();
		await loadMissions({ limit: 200 });
	}

	let creatorRunMissionId = $state<string | null>(null);
	let creatorRunMessage = $state<{ missionId: string; tone: 'info' | 'success' | 'error'; text: string } | null>(null);
	let creatorValidateMissionId = $state<string | null>(null);
	let creatorValidateMessage = $state<{ missionId: string; tone: 'info' | 'success' | 'error'; text: string } | null>(null);

	function creatorRunMessageClass(tone: 'info' | 'success' | 'error'): string {
		if (tone === 'success') return 'text-status-success';
		if (tone === 'error') return 'text-status-error';
		return 'text-accent-primary';
	}

	async function handleCreatorRun(card: BoardCard) {
		if (!canRunCreatorMissionBoardCard(card) || creatorRunMissionId) return;
		creatorRunMissionId = card.id;
		creatorRunMessage = { missionId: card.id, tone: 'info', text: 'Starting creator execution...' };
		try {
			const r = await fetch('/api/creator/mission/execute', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ missionId: card.id })
			});
			const data = await r.json().catch(() => ({}));
			if (!r.ok || data?.ok === false) {
				throw new Error(data?.error || `HTTP ${r.status}`);
			}
			if (data?.started) {
				creatorRunMessage = {
					missionId: card.id,
					tone: 'success',
					text: `Execution started${data.providerId ? ` with ${data.providerId}` : ''}.`
				};
			} else if (data?.skipped) {
				creatorRunMessage = {
					missionId: card.id,
					tone: 'info',
					text: data.reason || 'Execution was skipped by the runtime.'
				};
			} else if (data?.error) {
				throw new Error(data.error);
			} else {
				creatorRunMessage = { missionId: card.id, tone: 'info', text: 'Execution request accepted.' };
			}
			await fetchRelay();
		} catch (e) {
			creatorRunMessage = {
				missionId: card.id,
				tone: 'error',
				text: e instanceof Error ? e.message : 'creator execution failed'
			};
		} finally {
			creatorRunMissionId = null;
		}
	}

	function creatorValidationSummary(data: Record<string, unknown>): { tone: 'info' | 'success' | 'error'; text: string } {
		const run = data.run && typeof data.run === 'object' ? data.run as Record<string, unknown> : {};
		const status = String(data.status || run.status || 'accepted');
		const results = Array.isArray(run.results) ? run.results as Array<Record<string, unknown>> : [];
		const passed = results.filter((result) => result.status === 'passed').length;
		const failed = results.filter((result) => result.status === 'failed').length;
		const skipped = results.filter((result) => result.status === 'skipped').length;
		const tone = status === 'passed' ? 'success' : status === 'failed' ? 'error' : 'info';
		return {
			tone,
			text: results.length > 0
				? `Validation ${status}: ${passed} passed, ${failed} failed, ${skipped} skipped.`
				: `Validation ${status}.`
		};
	}

	async function handleCreatorValidate(card: BoardCard) {
		if (!canValidateCreatorMissionBoardCard(card) || creatorValidateMissionId) return;
		creatorValidateMissionId = card.id;
		creatorValidateMessage = { missionId: card.id, tone: 'info', text: 'Running creator validation...' };
		try {
			const r = await fetch('/api/creator/mission/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ missionId: card.id, async: true })
			});
			const data = await r.json().catch(() => ({}));
			if (!r.ok || data?.ok === false) {
				throw new Error(data?.error || `HTTP ${r.status}`);
			}
			creatorValidateMessage = {
				missionId: card.id,
				...creatorValidationSummary(data)
			};
			await fetchRelay();
		} catch (e) {
			creatorValidateMessage = {
				missionId: card.id,
				tone: 'error',
				text: e instanceof Error ? e.message : 'creator validation failed'
			};
		} finally {
			creatorValidateMissionId = null;
		}
	}

	let quickAddOpen = $state(false);
	let quickAddGoal = $state('');
	let quickAddFeedback = $state('');
	let quickAddImprovementDraft = $state<MissionImprovementDraft | null>(null);
	let quickAddImprovementSource = $state<MissionImprovementSource | null>(null);
	let quickAddDispatching = $state(false);
	let quickAddError = $state<string | null>(null);

	function resetQuickAdd() {
		quickAddOpen = false;
		quickAddGoal = '';
		quickAddFeedback = '';
		quickAddImprovementDraft = null;
		quickAddImprovementSource = null;
		quickAddError = null;
	}

	function handleImprove(card: BoardCard) {
		const draft = buildMissionImprovementDraft(card);
		quickAddGoal = draft.goal;
		quickAddFeedback = card.projectLineage?.improvementFeedback || '';
		quickAddImprovementDraft = draft;
		quickAddImprovementSource = card;
		quickAddOpen = true;
		quickAddError = null;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function handleQuickAdd() {
		const improvementDraft = quickAddImprovementSource
			? buildMissionImprovementDraft(quickAddImprovementSource, quickAddFeedback)
			: quickAddImprovementDraft;
		const goal = (improvementDraft?.goal ?? quickAddGoal).trim();
		if (!goal || quickAddDispatching) return;
		quickAddDispatching = true;
		quickAddError = null;
		try {
			const r = await fetch('/api/spark/run', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					goal,
					userId: 'kanban-quickadd',
					requestId: `quickadd-${Date.now()}`,
					...(improvementDraft?.payload ?? {})
				})
			});
			const data = await r.json();
			if (!r.ok || !data?.success) {
				quickAddError = data?.error ?? `HTTP ${r.status}`;
			} else {
				resetQuickAdd();
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

	function applyImproveUrlParams() {
		const params = new URLSearchParams(window.location.search);
		const projectPath = params.get('improveProjectPath');
		const parentMissionId = params.get('parentMissionId');
		const previewUrl = params.get('previewUrl');
		const projectId = params.get('projectId');
		const iterationNumber = Number(params.get('iterationNumber') || '');
		const improvementFeedback = params.get('improvementFeedback');
		if (!projectPath && !parentMissionId) return;
		const source = {
			id: parentMissionId || 'unknown-parent-mission',
			name: 'shipped project',
			projectLineage: {
				projectId: projectId || null,
				projectPath: projectPath || null,
				previewUrl: previewUrl || null,
				parentMissionId: null,
				iterationNumber: Number.isFinite(iterationNumber) && iterationNumber > 0 ? iterationNumber : null,
				improvementFeedback: improvementFeedback || null
			}
		};
		const draft = buildMissionImprovementDraft(source);
		quickAddGoal = draft.goal;
		quickAddFeedback = improvementFeedback || '';
		quickAddImprovementDraft = draft;
		quickAddImprovementSource = source;
		quickAddOpen = true;
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
					<Icon name="search" size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
					<input
						type="text"
						placeholder="Search…"
						bind:value={searchQuery}
						onfocus={() => (searchFocused = true)}
						onblur={() => (searchFocused = false)}
						class="w-full pl-9 pr-3 py-2 bg-bg-secondary border border-surface-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
					/>
				</div>

				{#if searchQuery}
					<span class="font-mono text-xs text-text-tertiary">{filteredCards().length}/{cards().length}</span>
				{/if}

				<button
					onclick={() => {
						if (quickAddOpen) resetQuickAdd();
						else {
							quickAddOpen = true;
							quickAddError = null;
							quickAddImprovementDraft = null;
							quickAddImprovementSource = null;
							quickAddFeedback = '';
						}
					}}
					class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono bg-accent-primary text-bg-primary rounded-md hover:bg-accent-primary-hover transition-all"
					title="New mission"
				>
					<Icon name="plus" size={14} />
					<span class="hidden sm:inline">New</span>
				</button>
			{/if}

			<div class="flex items-center gap-1 p-1 border border-surface-border rounded-md bg-bg-secondary">
				<button
					class="px-3.5 py-1.5 text-xs font-mono rounded-sm transition-colors {activeTab === 'board' ? 'bg-accent-primary text-bg-primary' : 'text-text-secondary hover:text-text-primary'}"
					onclick={() => activeTab = 'board'}
				>
					Board
				</button>
				<button
					class="px-3.5 py-1.5 text-xs font-mono rounded-sm transition-colors {activeTab === 'scheduled' ? 'bg-accent-primary text-bg-primary' : 'text-text-secondary hover:text-text-primary'}"
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
					{#if quickAddImprovementSource}
						<div class="flex-1 space-y-2">
							<div class="flex flex-wrap items-center gap-2 font-mono text-[10px] text-text-tertiary">
								<span class="text-accent-primary">Improve</span>
								<span>{quickAddImprovementSource.name}</span>
								{#if quickAddImprovementDraft?.payload.iterationNumber}
									<span>Iteration {quickAddImprovementDraft.payload.iterationNumber}</span>
								{/if}
							</div>
							<textarea
								rows="3"
								placeholder="What should change?"
								bind:value={quickAddFeedback}
								onkeydown={(e) => { if (e.key === 'Escape') resetQuickAdd(); }}
								class="w-full resize-none px-3 py-2 bg-bg-primary border border-surface-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary font-mono"
							></textarea>
						</div>
					{:else}
						<input
							type="text"
							placeholder="Describe what Spark should run..."
							bind:value={quickAddGoal}
							onkeydown={(e) => { if (e.key === 'Enter') handleQuickAdd(); if (e.key === 'Escape') resetQuickAdd(); }}
							class="flex-1 px-3 py-2 bg-bg-primary border border-surface-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary font-mono"
						/>
					{/if}
					<button
						onclick={handleQuickAdd}
						disabled={(quickAddImprovementSource ? !quickAddFeedback.trim() : !quickAddGoal.trim()) || quickAddDispatching}
						class="px-3 py-2 text-xs font-mono bg-accent-primary text-bg-primary rounded-md hover:bg-accent-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{quickAddDispatching ? 'Dispatching…' : 'Run'}
					</button>
					<button
						onclick={resetQuickAdd}
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
					{ title: 'Completed', items: done, empty: 'No history yet' }
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
								{@const actionLinks = getMissionBoardCardActionLinks(c)}
								{@const summary = focusLine(c)}
								{@const lineage = lineageSummary(c)}
								{@const hasProgress = hasTaskProgress(c)}
								{@const hasActions = hasCardActions(c)}
								<article class="group relative overflow-hidden rounded-md border border-surface-border bg-bg-secondary transition-all hover:border-iris/60 hover:bg-bg-tertiary/40">
									<a
										href={actionLinks.detailHref}
										class="block px-4 py-3.5 text-inherit focus:outline-none focus-visible:ring-1 focus-visible:ring-iris/70 rounded-md"
										title="Open this mission"
									>
										<div class="mb-3 flex items-start justify-between gap-3 pr-24">
											<div class="min-w-0 flex-1">
												<h3 class="flex items-start gap-2 font-sans text-base font-semibold leading-snug text-text-primary transition-colors group-hover:text-accent-primary">
													<span class="mt-1.5 h-2 w-2 rounded-full shrink-0 {statusDot(c.status)}"></span>
													<span class="line-clamp-2">{c.name}</span>
												</h3>
												<p class="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] leading-tight text-text-secondary">
													<Icon name="clock" size={11} class="text-text-tertiary" />
													<span>{cardTimestamp(c)}</span>
												</p>
											</div>
											<div class="shrink-0 text-right">
												<Icon name="arrow-right" size={14} class="ml-auto text-text-tertiary transition-all group-hover:translate-x-0.5 group-hover:text-accent-primary" />
											</div>
										</div>

										{#if summary}
											<p class="mb-2.5 text-sm leading-relaxed text-text-secondary line-clamp-2">{summary}</p>
										{/if}

										{#if lineage}
											<p class="mb-2.5 truncate font-mono text-[10px] text-text-tertiary">{lineage}</p>
										{/if}

										{#if hasProgress}
										<div>
											<div class="mb-2 flex items-center justify-between gap-3 font-mono text-xs font-semibold text-text-secondary">
												<span>{taskProgressLabel(c)}</span>
												<span>{taskProgressPercent(c)}%</span>
											</div>
											<div class="h-1.5 overflow-hidden rounded-full bg-bg-primary">
												<div class="h-full rounded-full bg-accent-primary transition-all" style="width: {taskProgressPercent(c)}%"></div>
											</div>
										</div>
										{/if}

									</a>

									{#if actionLinks.canvasHref}
										<a
											href={actionLinks.canvasHref}
											data-sveltekit-reload
											class="absolute right-4 top-3.5 z-10 inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider shadow-sm transition-colors {typeBadgeClass(c)} hover:border-iris/70 hover:text-iris focus:outline-none focus-visible:ring-1 focus-visible:ring-iris/70"
											title="Open this mission in Canvas"
										>
											<Icon name={typeIcon(c)} size={11} />
											<span>{typeLabel(c)}</span>
										</a>
									{:else}
										<span
											class="absolute right-4 top-3.5 z-10 inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider shadow-sm transition-colors {typeBadgeClass(c)}"
											title="Canvas link unavailable"
										>
											<Icon name={typeIcon(c)} size={11} />
											<span>{typeLabel(c)}</span>
										</span>
									{/if}

									<div class:hidden={!hasActions} class="flex flex-wrap items-center gap-2 border-t border-surface-border/60 px-4 py-2.5">
										{#if c.projectLineage?.previewUrl}
											<a
												href={c.projectLineage.previewUrl}
												onclick={(event) => event.stopPropagation()}
												class="inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-mono text-text-secondary border border-surface-border rounded-sm hover:border-accent-primary/50 hover:text-accent-primary transition-all"
												title="Open the shipped project preview"
											>
												Preview
											</a>
										{/if}
										{#if c.projectLineage?.projectPath}
											<button
												onclick={() => handleImprove(c)}
												class="inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-mono text-text-secondary border border-surface-border rounded-sm hover:border-accent-primary/50 hover:text-accent-primary transition-all"
												title="Start another polish pass on this shipped project"
											>
												Improve
											</button>
										{/if}
										{#if canRunCreatorMissionBoardCard(c)}
											<button
												onclick={() => handleCreatorRun(c)}
												disabled={creatorRunMissionId === c.id}
												class="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[10px] font-mono text-accent-primary border border-accent-primary/30 rounded-sm hover:bg-accent-primary hover:text-bg-primary transition-all disabled:opacity-60 disabled:cursor-not-allowed"
												title="Execute this creator mission through the provider runtime"
											>
												<Icon name={creatorRunMissionId === c.id ? 'loader' : 'play'} size={10} />
												{creatorRunMissionId === c.id ? 'Starting' : 'Run'}
											</button>
										{/if}
										{#if canValidateCreatorMissionBoardCard(c)}
											<button
												onclick={() => handleCreatorValidate(c)}
												disabled={creatorValidateMissionId === c.id}
												class="inline-flex items-center justify-center gap-1 px-2.5 py-1 text-[10px] font-mono text-status-success border border-status-success/30 rounded-sm hover:bg-status-success hover:text-bg-primary transition-all disabled:opacity-60 disabled:cursor-not-allowed"
												title="Run this creator mission's validation commands"
											>
												<Icon name={creatorValidateMissionId === c.id ? 'loader' : 'check-circle'} size={10} />
												{creatorValidateMissionId === c.id ? 'Validating' : 'Validate'}
											</button>
										{/if}
										{#if c.source === 'mcp' && (c.status === 'ready' || c.status === 'draft')}
											<button
												onclick={() => handleStart(c)}
												class="inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-mono text-accent-primary border border-accent-primary/30 rounded-sm hover:bg-accent-primary hover:text-bg-primary transition-all"
											>
												Start
											</button>
										{/if}
										{#if c.source === 'mcp'}
											<button
												onclick={() => handleDelete(c)}
												class="ml-auto inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-mono text-text-tertiary rounded-sm hover:text-status-red transition-all"
												title="Delete mission"
											>
												Delete
											</button>
										{/if}
										{#if creatorRunMessage && creatorRunMessage.missionId === c.id}
											<p class="basis-full font-mono text-[10px] leading-snug {creatorRunMessageClass(creatorRunMessage.tone)}">
												{creatorRunMessage.text}
											</p>
										{/if}
										{#if creatorValidateMessage && creatorValidateMessage.missionId === c.id}
											<p class="basis-full font-mono text-[10px] leading-snug {creatorRunMessageClass(creatorValidateMessage.tone)}">
												{creatorValidateMessage.text}
											</p>
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
