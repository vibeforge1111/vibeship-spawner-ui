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

	$effect(() => {
		const unsub = page.subscribe((p) => {
			missionId = p.params.id;
		});
		return unsub;
	});

	$effect(() => {
		const unsub1 = missionsState.subscribe((s) => (currentState = s));
		const unsub2 = mcpState.subscribe((s) => (mcpConnected = s.status === 'connected'));
		return () => { unsub1(); unsub2(); };
	});

	onMount(async () => {
		await new Promise(r => setTimeout(r, 300));
		if (mcpConnected && missionId) {
			await loadMission(missionId);
			await loadMissionLogs(missionId);

			// Start polling if mission is running
			if (currentState.currentMission?.status === 'running') {
				startLogPolling(missionId);
			}
		}
	});

	onDestroy(() => {
		stopLogPolling();
	});

	// Reload when missionId changes
	$effect(() => {
		if (mcpConnected && missionId && !currentState.loading) {
			loadMission(missionId);
			loadMissionLogs(missionId);
		}
	});

	function getStatusColor(status: Mission['status'] | MissionTask['status']): string {
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
			<- Back to Missions
		</a>

		{#if !mcpConnected}
			<div class="border border-surface-border bg-bg-secondary p-12 text-center">
				<h3 class="text-lg text-text-primary mb-2">MCP Server Offline</h3>
				<p class="text-sm text-text-secondary">Connect to view mission details.</p>
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
