<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import {
		missionsState,
		loadMission,
		loadMissionLogs,
		startMission,
		completeMission,
		startLogPolling,
		stopLogPolling,
		generateClaudeCodePrompt,
		type MissionsState
	} from '$lib/stores/missions.svelte';
	import { mcpState } from '$lib/stores/mcp.svelte';
	import type { Mission, MissionLog, MissionTask, MissionAgent } from '$lib/services/mcp-client';

	let missionId = $state('');
	let currentState = $state<MissionsState>({
		missions: [],
		currentMission: null,
		logs: [],
		loading: false,
		error: null,
		pollingInterval: null
	});
	let mcpConnected = $state(false);
	let showPrompt = $state(false);
	let copiedPrompt = $state(false);

	type MissionControlEntry = {
		eventType: string;
		missionId: string;
		missionName: string | null;
		taskId: string | null;
		taskName: string | null;
		taskSkills?: string[];
		summary: string;
		timestamp: string;
		source: string;
	};

	type TaskRollup = {
		key: string;
		title: string;
		skills: string[];
		status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
		startedAt: string;
		updatedAt: string;
		lastSummary: string;
	};

	type MissionControlSnapshot = {
		enabled: { sparkIngest: boolean; webhooks: boolean };
		targets: { sparkIngestUrl: string | null; webhookCount: number };
		stats: { totalRelayed: number; perMission: Record<string, number> };
		recent: MissionControlEntry[];
		providerSummary?: string | null;
		providerResults?: Array<{
			providerId: string;
			status: string;
			summary: string;
			durationMs: number | null;
			completedAt: string | null;
		}>;
	};

	let missionControlLoading = $state(false);
	let missionControlError = $state<string | null>(null);
	let missionControl = $state<MissionControlSnapshot | null>(null);
	let missionControlPoller: ReturnType<typeof setInterval> | null = null;
	let missionControlActionLoading = $state(false);
	let missionControlActionMessage = $state<string | null>(null);

	$effect(() => {
		const unsub = page.subscribe((p) => {
			missionId = p.params.id ?? '';
		});
		return unsub;
	});

	$effect(() => {
		const unsub1 = missionsState.subscribe((s) => (currentState = s));
		const unsub2 = mcpState.subscribe((s) => (mcpConnected = s.status === 'connected'));
		return () => { unsub1(); unsub2(); };
	});

	async function loadMissionControlStatus(): Promise<void> {
		if (!missionId) return;
		missionControlLoading = true;
		missionControlError = null;
		try {
			const response = await fetch(`/api/mission-control/status?missionId=${encodeURIComponent(missionId)}`);
			if (!response.ok) {
				throw new Error(`Mission control status failed (${response.status})`);
			}
			const body = await response.json();
			missionControl = (body?.snapshot || null) as MissionControlSnapshot | null;
		} catch (error) {
			missionControlError = error instanceof Error ? error.message : 'Unable to load mission control status';
		} finally {
			missionControlLoading = false;
		}
	}

	async function executeMissionControlAction(action: 'pause' | 'resume' | 'kill'): Promise<void> {
		if (!missionId) return;
		missionControlActionLoading = true;
		missionControlActionMessage = null;
		missionControlError = null;
		try {
			const response = await fetch('/api/mission-control/command', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ missionId, action, source: 'spawner-ui' })
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok || !body?.ok) {
				throw new Error(body?.error || `Action failed (${response.status})`);
			}

			missionControlActionMessage = body?.message || `Mission ${action} executed.`;
			await loadMissionControlStatus();
			await loadMissionLogs(missionId);
			await loadMission(missionId);
		} catch (error) {
			missionControlError = error instanceof Error ? error.message : 'Mission control action failed';
		} finally {
			missionControlActionLoading = false;
		}
	}

	function startMissionControlPolling(): void {
		if (missionControlPoller) return;
		missionControlPoller = setInterval(() => {
			void loadMissionControlStatus();
		}, 4000);
	}

	function stopMissionControlPolling(): void {
		if (!missionControlPoller) return;
		clearInterval(missionControlPoller);
		missionControlPoller = null;
	}

	onMount(async () => {
		await new Promise(r => setTimeout(r, 300));
		if (!missionId) return;

		// Relay always works regardless of MCP — Spark missions live there.
		await loadMissionControlStatus();
		startMissionControlPolling();

		if (mcpConnected) {
			await loadMission(missionId);
			await loadMissionLogs(missionId);
			if (currentState.currentMission?.status === 'running') {
				startLogPolling(missionId);
			}
		}
	});

	onDestroy(() => {
		stopLogPolling();
		stopMissionControlPolling();
	});

	// Reload when missionId changes
	$effect(() => {
		if (!missionId) return;
		void loadMissionControlStatus();
		startMissionControlPolling();
		if (mcpConnected && !currentState.loading) {
			loadMission(missionId);
			loadMissionLogs(missionId);
		}
	});

	function getStatusColor(status: Mission['status'] | MissionTask['status'] | 'success' | 'error'): string {
		switch (status) {
			case 'running':
			case 'in_progress': return 'text-yellow-400';
			case 'completed':
			case 'success': return 'text-green-400';
			case 'failed':
			case 'error': return 'text-red-400';
			case 'paused':
			case 'blocked': return 'text-blue-400';
			case 'ready': return 'text-accent-primary';
			default: return 'text-text-tertiary';
		}
	}

	function getStatusBadge(status: Mission['status']): string {
		switch (status) {
			case 'running': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
			case 'completed': return 'text-green-400 border-green-500/30 bg-green-500/10';
			case 'failed': return 'text-red-400 border-red-500/30 bg-red-500/10';
			case 'paused': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
			case 'ready': return 'text-accent-primary border-accent-primary/30 bg-accent-primary/10';
			default: return 'text-text-tertiary border-surface-border bg-surface';
		}
	}

	function getLogIcon(type: MissionLog['type']): string {
		switch (type) {
			case 'start': return '>';
			case 'progress': return '-';
			case 'handoff': return '=>';
			case 'complete': return 'v';
			case 'error': return 'x';
		}
	}

	function getLogColor(type: MissionLog['type']): string {
		switch (type) {
			case 'start': return 'text-accent-primary';
			case 'progress': return 'text-text-secondary';
			case 'handoff': return 'text-accent-secondary';
			case 'complete': return 'text-green-400';
			case 'error': return 'text-red-400';
		}
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	async function handleStart() {
		const success = await startMission();
		if (success) {
			startLogPolling(missionId);
		}
	}

	async function handleComplete() {
		await completeMission();
	}

	function copyPrompt() {
		if (!currentState.currentMission) return;
		const prompt = generateClaudeCodePrompt(currentState.currentMission);
		navigator.clipboard.writeText(prompt);
		copiedPrompt = true;
		setTimeout(() => copiedPrompt = false, 2000);
	}

	const mission = $derived(currentState.currentMission);
	const logs = $derived(currentState.logs);

	const completedTasks = $derived(() => mission?.tasks.filter(t => t.status === 'completed').length ?? 0);
	const progress = $derived(() => mission && mission.tasks.length > 0 ? (completedTasks() / mission.tasks.length) * 100 : 0);
</script>

<div class="min-h-screen bg-bg-primary flex flex-col">
	<Navbar />

	<main class="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
		<!-- Back link -->
		<a href="/missions" class="inline-flex items-center gap-1 text-sm font-mono text-text-tertiary hover:text-text-secondary mb-6">
			&larr; Back to Missions
		</a>

		{#if !mcpConnected && missionControl && missionControl.recent.length > 0}
			{@const recentDesc = missionControl.recent}
			{@const chronological = [...recentDesc].reverse()}
			{@const latest = recentDesc[0]}
			{@const earliest = chronological[0]}
			{@const sparkName = chronological.find((e) => e.missionName)?.missionName ?? missionId}
			{@const taskRollups = (() => {
				const map = new Map<string, TaskRollup>();
				for (const ev of chronological) {
					if (!ev.taskName && !ev.taskId) continue;
					const key = ev.taskId ?? ev.taskName ?? 'task';
					if (!map.has(key)) {
						map.set(key, {
							key,
							title: ev.taskName ?? key,
							skills: ev.taskSkills ?? [],
							status: 'pending',
							startedAt: ev.timestamp,
							updatedAt: ev.timestamp,
							lastSummary: ev.summary
						});
					}
					const t = map.get(key)!;
					t.updatedAt = ev.timestamp;
					t.lastSummary = ev.summary;
					if (ev.taskSkills && ev.taskSkills.length > 0 && t.skills.length === 0) t.skills = ev.taskSkills;
					if (ev.eventType === 'task_started') t.status = 'running';
					else if (ev.eventType === 'task_completed') t.status = 'completed';
					else if (ev.eventType === 'task_failed') t.status = 'failed';
					else if (ev.eventType === 'task_cancelled') t.status = 'cancelled';
				}
				return [...map.values()];
			})()}
			{@const missionEvents = chronological.filter((e) => e.eventType.startsWith('mission_'))}
			{@const sparkStatus = latest.eventType.startsWith('mission_') ? latest.eventType.replace('mission_', '') : 'in progress'}

			<!-- Spark mission detail: MCP has no record but relay tracked the lifecycle -->
			<div class="mb-8">
				<div class="flex items-center gap-3 mb-2 flex-wrap">
					<h1 class="text-2xl font-sans font-semibold text-text-primary tracking-tight">{sparkName}</h1>
					<span class="px-2 py-0.5 text-[10px] font-mono rounded-sm border border-accent-mid text-accent-primary bg-accent-subtle">spark</span>
					<span class="px-2 py-0.5 text-[10px] font-mono rounded-sm border {getStatusBadge(sparkStatus as Mission['status']) ?? 'border-surface-border text-text-tertiary'}">{sparkStatus}</span>
				</div>
				<p class="font-mono text-xs text-text-tertiary">
					{missionId} · started {new Date(earliest.timestamp).toLocaleString()} · {taskRollups.length} task{taskRollups.length !== 1 ? 's' : ''}
				</p>
			</div>

			{#if missionControl.providerResults && missionControl.providerResults.length > 0}
				<div class="mb-6">
					<h2 class="font-mono text-xs font-semibold text-text-bright tracking-wide mb-3">Agent results</h2>
					<div class="grid gap-3">
						{#each missionControl.providerResults as result (result.providerId)}
							<article class="px-4 py-3.5 rounded-lg border border-surface-border bg-bg-secondary">
								<div class="flex items-center gap-2 mb-2">
									<span class="w-1.5 h-1.5 rounded-full shrink-0 {result.status === 'failed' ? 'bg-status-error' : result.status === 'completed' ? 'bg-status-success' : 'bg-accent-primary animate-pulse'}"></span>
									<h3 class="font-sans text-sm font-semibold text-text-primary leading-tight flex-1">{result.providerId}</h3>
									<span class="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">{result.status}</span>
								</div>
								<p class="font-mono text-xs text-text-secondary leading-relaxed pl-3.5">{result.summary}</p>
								{#if result.durationMs}
									<p class="font-mono text-[10px] text-text-faint pl-3.5 mt-2">{Math.round(result.durationMs / 1000)}s</p>
								{/if}
							</article>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Per-task cards -->
			{#if taskRollups.length > 0}
				<div class="mb-6">
					<h2 class="font-mono text-xs font-semibold text-text-bright tracking-wide mb-3">Tasks</h2>
					<div class="grid gap-3">
						{#each taskRollups as task (task.key)}
							{@const dot = task.status === 'failed' ? 'bg-status-error' : task.status === 'completed' ? 'bg-status-success' : task.status === 'running' ? 'bg-accent-primary animate-pulse' : task.status === 'cancelled' ? 'bg-text-faint' : 'bg-text-tertiary'}
							<article class="px-4 py-3.5 rounded-lg border border-surface-border bg-bg-secondary">
								<div class="flex items-center gap-2 mb-2">
									<span class="w-1.5 h-1.5 rounded-full shrink-0 {dot}"></span>
									<h3 class="font-sans text-sm font-semibold text-text-primary leading-tight flex-1">{task.title}</h3>
									<span class="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">{task.status}</span>
								</div>
								{#if task.skills.length > 0}
									<div class="flex items-center gap-1 flex-wrap mb-2 pl-3.5">
										{#each task.skills as skill}
											<span class="px-1.5 py-px text-[9px] font-mono rounded-full text-text-tertiary bg-bg-primary/60 border border-surface-border/70">{skill}</span>
										{/each}
									</div>
								{/if}
								<p class="font-mono text-[10px] text-text-faint pl-3.5">
									{new Date(task.startedAt).toLocaleTimeString()}{task.updatedAt !== task.startedAt ? ` → ${new Date(task.updatedAt).toLocaleTimeString()}` : ''}
								</p>
							</article>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Compact mission-level events -->
			{#if missionEvents.length > 0}
				<div class="border border-surface-border rounded-lg bg-bg-secondary">
					<div class="px-5 py-3 border-b border-surface-border flex items-center justify-between">
						<h2 class="font-mono text-xs font-semibold text-text-bright tracking-wide">Mission events</h2>
						<span class="font-mono text-[10px] text-text-tertiary">
							sparkIngest: {missionControl.enabled.sparkIngest ? 'on' : 'off'} · webhooks: {missionControl.targets.webhookCount}
						</span>
					</div>
					<ol class="divide-y divide-surface-border/50">
						{#each missionEvents as ev (ev.timestamp + '-' + ev.eventType)}
							<li class="px-5 py-2.5 flex items-start gap-3">
								<span class="w-1.5 h-1.5 rounded-full mt-2 shrink-0 {ev.eventType.endsWith('_failed') ? 'bg-status-error' : ev.eventType.endsWith('_completed') ? 'bg-status-success' : ev.eventType.endsWith('_started') ? 'bg-accent-primary' : 'bg-text-tertiary'}"></span>
								<div class="flex-1 min-w-0">
									<span class="font-mono text-xs font-medium text-text-primary">{ev.eventType}</span>
									<p class="font-mono text-[10px] text-text-faint">
										{new Date(ev.timestamp).toLocaleString()} · {ev.source}
									</p>
								</div>
							</li>
						{/each}
					</ol>
				</div>
			{/if}

			<p class="mt-4 font-mono text-[11px] text-text-tertiary">
				This mission was dispatched through <code class="text-accent-primary">/api/spark/run</code>; provider output is retained separately from MCP task records.
			</p>
		{:else if !mcpConnected}
			<div class="border border-surface-border rounded-lg bg-bg-secondary p-12 text-center">
				<h3 class="text-lg text-text-primary mb-2">MCP Server Offline</h3>
				<p class="text-sm text-text-secondary">Connect to view canvas mission details.</p>
				{#if missionControl && missionControl.recent.length === 0}
					<p class="text-xs font-mono text-text-tertiary mt-3">No relay activity for {missionId} either.</p>
				{/if}
			</div>
		{:else if currentState.loading}
			<div class="border border-surface-border bg-bg-secondary p-12 text-center">
				<div class="animate-pulse text-text-tertiary font-mono">Loading mission...</div>
			</div>
		{:else if currentState.error}
			<div class="border border-red-500/30 bg-red-500/10 p-6">
				<p class="text-red-400 font-mono text-sm">{currentState.error}</p>
			</div>
		{:else if !mission}
			<div class="border border-surface-border bg-bg-secondary p-12 text-center">
				<h3 class="text-lg text-text-primary mb-2">Mission Not Found</h3>
				<p class="text-sm text-text-secondary">This mission may have been deleted.</p>
			</div>
		{:else}
			<!-- Header -->
			<div class="mb-8">
				<div class="flex items-center gap-3 mb-2">
					<h1 class="text-3xl font-serif text-text-primary">{mission.name}</h1>
					<span class="px-2 py-0.5 text-xs font-mono border {getStatusBadge(mission.status)}">
						{mission.status}
					</span>
				</div>
				{#if mission.description}
					<p class="text-text-secondary">{mission.description}</p>
				{/if}
			</div>

			<!-- Progress bar -->
			{#if mission.status === 'running' || mission.status === 'completed'}
				<div class="mb-8">
					<div class="flex items-center justify-between mb-2 text-sm font-mono">
						<span class="text-text-tertiary">Progress</span>
						<span class="text-text-secondary">{completedTasks()}/{mission.tasks.length} tasks</span>
					</div>
					<div class="h-2 bg-surface-border">
						<div
							class="h-full transition-all duration-500"
							class:bg-yellow-500={mission.status === 'running'}
							class:bg-green-500={mission.status === 'completed'}
							style="width: {progress()}%"
						></div>
					</div>
				</div>
			{/if}

			<div class="grid lg:grid-cols-3 gap-6">
				<!-- Left column: Tasks & Agents -->
				<div class="lg:col-span-2 space-y-6">
					<!-- Tasks -->
					<div class="border border-surface-border bg-bg-secondary">
						<div class="p-4 border-b border-surface-border">
							<h2 class="font-medium text-text-primary">Tasks</h2>
						</div>
						<div class="divide-y divide-surface-border">
							{#each mission.tasks as task (task.id)}
								{@const agent = mission.agents.find(a => a.id === task.assignedTo)}
								<div class="p-4">
									<div class="flex items-start gap-3">
										<span class="font-mono text-sm {getStatusColor(task.status)}">
											{task.status === 'completed' ? '[x]' : task.status === 'in_progress' ? '[~]' : '[ ]'}
										</span>
										<div class="flex-1">
											<div class="flex items-center gap-2">
												<span class="text-text-primary font-medium">{task.title}</span>
												{#if agent}
													<span class="text-xs font-mono text-accent-secondary">-> {agent.name}</span>
												{/if}
											</div>
											<p class="text-sm text-text-secondary mt-1">{task.description}</p>
											{#if task.dependsOn && task.dependsOn.length > 0}
												<p class="text-xs font-mono text-text-tertiary mt-1">
													Depends on: {task.dependsOn.join(', ')}
												</p>
											{/if}
										</div>
									</div>
								</div>
							{:else}
								<div class="p-4 text-sm text-text-tertiary">No tasks defined</div>
							{/each}
						</div>
					</div>

					<!-- Agents -->
					<div class="border border-surface-border bg-bg-secondary">
						<div class="p-4 border-b border-surface-border">
							<h2 class="font-medium text-text-primary">Agents</h2>
						</div>
						<div class="grid sm:grid-cols-2 gap-3 p-4">
							{#each mission.agents as agent (agent.id)}
								<div class="p-3 border border-surface-border">
									<div class="flex items-center gap-2 mb-1">
										<span class="w-2 h-2 bg-accent-secondary rounded-full"></span>
										<span class="font-medium text-text-primary">{agent.name}</span>
									</div>
									<p class="text-xs text-text-secondary mb-2">{agent.role}</p>
									<div class="flex flex-wrap gap-1">
										{#each agent.skills as skill}
											<span class="px-1.5 py-0.5 text-xs font-mono text-accent-primary bg-accent-primary/10">
												{skill}
											</span>
										{/each}
									</div>
								</div>
							{:else}
								<div class="text-sm text-text-tertiary">No agents assigned</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- Right column: Logs & Actions -->
				<div class="space-y-6">
					<!-- Actions -->
					<div class="border border-surface-border bg-bg-secondary p-4">
						<h3 class="font-medium text-text-primary mb-4">Actions</h3>
						<div class="space-y-2">
							{#if mission.status === 'draft' || mission.status === 'ready'}
								<button
									onclick={handleStart}
									class="w-full px-4 py-2 font-mono text-sm bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
								>
									Start Mission
								</button>
							{/if}
							{#if mission.status === 'running'}
								<button
									onclick={handleComplete}
									class="w-full px-4 py-2 font-mono text-sm bg-green-500 text-bg-primary hover:bg-green-400 transition-all"
								>
									Mark Complete
								</button>
							{/if}
							<button
								onclick={() => showPrompt = !showPrompt}
								class="w-full px-4 py-2 font-mono text-sm text-text-secondary border border-surface-border hover:border-text-tertiary transition-all"
							>
								{showPrompt ? 'Hide' : 'Show'} Claude Code Prompt
							</button>
						</div>
					</div>

					<!-- Mission Control -->
					<div class="border border-surface-border bg-bg-secondary p-4">
						<div class="flex items-center justify-between mb-3">
							<h3 class="font-medium text-text-primary">Mission Control</h3>
							<button
								onclick={() => loadMissionControlStatus()}
								class="text-xs font-mono text-accent-primary hover:underline"
							>
								Refresh
							</button>
						</div>

						<div class="grid grid-cols-3 gap-2 mb-3">
							<button
								onclick={() => executeMissionControlAction('pause')}
								disabled={missionControlActionLoading || mission.status !== 'running'}
								class="px-2 py-1 text-xs font-mono border border-surface-border text-text-secondary hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
							>
								Pause
							</button>
							<button
								onclick={() => executeMissionControlAction('resume')}
								disabled={missionControlActionLoading || mission.status !== 'paused'}
								class="px-2 py-1 text-xs font-mono border border-surface-border text-text-secondary hover:border-green-400 disabled:opacity-40 disabled:cursor-not-allowed"
							>
								Resume
							</button>
							<button
								onclick={() => executeMissionControlAction('kill')}
								disabled={missionControlActionLoading || mission.status === 'completed' || mission.status === 'failed'}
								class="px-2 py-1 text-xs font-mono border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
							>
								Kill
							</button>
						</div>

						{#if missionControlActionMessage}
							<p class="text-xs font-mono text-green-400 mb-2">{missionControlActionMessage}</p>
						{/if}

						{#if missionControlLoading && !missionControl}
							<p class="text-xs font-mono text-text-tertiary">Loading mission control telemetry...</p>
						{:else if missionControlError}
							<p class="text-xs font-mono text-red-400">{missionControlError}</p>
						{:else if missionControl}
							<div class="space-y-3 text-xs font-mono">
								<div class="grid grid-cols-2 gap-2 text-text-secondary">
									<div class="border border-surface-border p-2">
										<div class="text-text-tertiary mb-1">Spark Ingest</div>
										<div class={missionControl.enabled.sparkIngest ? 'text-green-400' : 'text-text-tertiary'}>
											{missionControl.enabled.sparkIngest ? 'ENABLED' : 'DISABLED'}
										</div>
									</div>
									<div class="border border-surface-border p-2">
										<div class="text-text-tertiary mb-1">Webhooks</div>
										<div class={missionControl.enabled.webhooks ? 'text-green-400' : 'text-text-tertiary'}>
											{missionControl.targets.webhookCount}
										</div>
									</div>
								</div>

								<div class="text-text-secondary">
									Relayed for this mission: {missionControl.stats.perMission[mission.id] || 0}
								</div>

								<div class="border border-surface-border max-h-36 overflow-y-auto">
									{#if missionControl.recent.length === 0}
										<div class="p-2 text-text-tertiary">No relay events yet.</div>
									{:else}
										{#each missionControl.recent as event, index (`${event.timestamp}-${index}`)}
											<div class="px-2 py-1.5 border-b border-surface-border/60 last:border-0">
												<div class="text-text-secondary">{event.summary}</div>
												<div class="text-text-tertiary">{formatTime(event.timestamp)} • {event.source}</div>
											</div>
										{/each}
									{/if}
								</div>
							</div>
						{:else}
							<p class="text-xs font-mono text-text-tertiary">Mission control not initialized yet.</p>
						{/if}
					</div>

					<!-- Claude Code Prompt -->
					{#if showPrompt}
						<div class="border border-surface-border bg-bg-secondary">
							<div class="p-3 border-b border-surface-border flex items-center justify-between">
								<span class="text-sm font-mono text-text-tertiary">Claude Code Prompt</span>
								<button
									onclick={copyPrompt}
									class="text-xs font-mono text-accent-primary hover:underline"
								>
									{copiedPrompt ? 'Copied!' : 'Copy'}
								</button>
							</div>
							<pre class="p-3 text-xs font-mono text-text-secondary overflow-x-auto max-h-64 whitespace-pre-wrap">{generateClaudeCodePrompt(mission)}</pre>
						</div>
					{/if}

					<!-- Meta -->
					<div class="border border-surface-border bg-bg-secondary p-4">
						<h3 class="font-medium text-text-primary mb-3">Details</h3>
						<dl class="space-y-2 text-sm">
							<div class="flex justify-between">
								<dt class="text-text-tertiary">Mode</dt>
								<dd class="text-text-secondary font-mono">{mission.mode}</dd>
							</div>
							<div class="flex justify-between">
								<dt class="text-text-tertiary">Created</dt>
								<dd class="text-text-secondary font-mono">{formatDate(mission.created_at)}</dd>
							</div>
							{#if mission.started_at}
								<div class="flex justify-between">
									<dt class="text-text-tertiary">Started</dt>
									<dd class="text-text-secondary font-mono">{formatDate(mission.started_at)}</dd>
								</div>
							{/if}
							{#if mission.completed_at}
								<div class="flex justify-between">
									<dt class="text-text-tertiary">Completed</dt>
									<dd class="text-text-secondary font-mono">{formatDate(mission.completed_at)}</dd>
								</div>
							{/if}
						</dl>
					</div>

					<!-- Logs -->
					<div class="border border-surface-border bg-bg-secondary">
						<div class="p-3 border-b border-surface-border flex items-center justify-between">
							<span class="text-sm font-medium text-text-primary">Logs</span>
							<span class="text-xs font-mono text-text-tertiary">{logs.length} entries</span>
						</div>
						<div class="max-h-64 overflow-y-auto">
							{#if logs.length === 0}
								<div class="p-4 text-sm text-text-tertiary text-center">No logs yet</div>
							{:else}
								<div class="font-mono text-xs">
									{#each logs as log (log.id)}
										<div class="px-3 py-1.5 border-b border-surface-border/50 last:border-0">
											<div class="flex items-start gap-2">
												<span class="text-text-tertiary w-16 flex-shrink-0">{formatTime(log.created_at)}</span>
												<span class="{getLogColor(log.type)} w-4">{getLogIcon(log.type)}</span>
												<span class="text-text-secondary flex-1">{log.message}</span>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</main>

	<Footer />
</div>
