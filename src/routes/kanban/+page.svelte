<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { missionsState, loadMissions, startMission as startCurrent, setCurrentMission, deleteMission } from '$lib/stores/missions.svelte';
	import { mcpState } from '$lib/stores/mcp.svelte';
	import type { Mission } from '$lib/services/mcp-client';

	type Tab = 'board' | 'scheduled';
	let activeTab = $state<Tab>('board');

	let missions = $state<Mission[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let mcpConnected = $state(false);

	onMount(() => {
		const unsubMcp = mcpState.subscribe((s) => { mcpConnected = s.status === 'connected'; });
		const unsub = missionsState.subscribe((s) => {
			missions = s.missions;
			loading = s.loading;
			error = s.error;
		});
		loadMissions({ limit: 200 }).catch(() => {});
		return () => { unsub(); unsubMcp(); };
	});

	const toDo = $derived(missions.filter((m) => m.status === 'draft' || m.status === 'ready'));
	const inProgress = $derived(missions.filter((m) => m.status === 'running' || m.status === 'paused'));
	const done = $derived(
		missions
			.filter((m) => m.status === 'completed' || m.status === 'failed')
			.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
	);

	function formatDate(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
		return d.toLocaleString(undefined, opts);
	}

	function statusDot(s: Mission['status']): string {
		switch (s) {
			case 'running': return 'bg-accent-primary animate-pulse';
			case 'paused': return 'bg-status-amber';
			case 'failed': return 'bg-status-error';
			case 'completed': return 'bg-status-success';
			case 'ready': return 'bg-text-secondary';
			default: return 'bg-text-faint';
		}
	}

	// Priority is inferred until a real priority field ships on Mission.
	// Multi-LLM + running/paused → High; short backlog → Medium; everything else → Low.
	function priorityOf(m: Mission): 'High' | 'Medium' | 'Low' {
		if (m.status === 'running' || m.status === 'paused') return 'High';
		if (m.mode === 'multi-llm-orchestrator') return 'High';
		if ((m.tasks?.length ?? 0) > 5) return 'High';
		if (m.status === 'ready' || m.status === 'draft') return 'Medium';
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

	async function handleStart(m: Mission) {
		setCurrentMission(m);
		await startCurrent();
		await loadMissions({ limit: 200 });
	}

	async function handleDelete(m: Mission) {
		if (!confirm(`Delete mission "${m.name}"?`)) return;
		await deleteMission(m.id);
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
				<p class="overline">Mission board</p>
				<h1 class="text-2xl font-sans font-semibold text-text-primary tracking-tight">
					{missions.length} missions · {inProgress.length} running
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
			{#if !mcpConnected && !loading && missions.length === 0}
				<div class="border border-surface-border rounded-lg bg-bg-secondary px-5 py-10 text-center">
					<p class="font-mono text-xs text-text-tertiary">
						MCP server offline — board will populate when a mission is created from the canvas.
					</p>
				</div>
			{:else if error && missions.length === 0}
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
								{#each col.items as m (m.id)}
									{@const p = priorityOf(m)}
									<article class="group px-3.5 py-3 rounded-lg border border-surface-border bg-bg-secondary hover:border-border-strong transition-all">
										<a href={`/missions/${m.id}`} class="block">
											<div class="flex items-start gap-2 mb-2">
												<Icon name="file-text" size={14} class="text-text-tertiary mt-0.5 shrink-0" />
												<span class="font-sans text-sm leading-snug text-text-primary group-hover:text-accent-primary transition-colors">
													{m.name || 'Untitled mission'}
												</span>
											</div>
											<div class="flex items-center gap-2 flex-wrap">
												<span class="px-1.5 py-0.5 text-[10px] font-mono rounded-sm border {priorityClass(p)}">{p}</span>
												<span class="font-mono text-[10px] text-text-tertiary">
													{formatDate(m.updated_at ?? m.created_at)}
												</span>
												{#if m.status === 'running' || m.status === 'paused'}
													<span class="ml-auto inline-flex items-center gap-1 font-mono text-[10px] text-text-tertiary">
														<span class="w-1.5 h-1.5 rounded-full {statusDot(m.status)}"></span>
														{m.status}
													</span>
												{/if}
											</div>
										</a>
										<div class="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
											{#if m.status === 'ready' || m.status === 'draft'}
												<button
													onclick={() => handleStart(m)}
													class="px-2 py-0.5 text-[10px] font-mono text-accent-primary border border-accent-primary/30 rounded-sm hover:bg-accent-primary hover:text-bg-primary transition-all"
												>
													Start
												</button>
											{/if}
											<a
												href={`/missions/${m.id}`}
												class="px-2 py-0.5 text-[10px] font-mono text-text-secondary border border-surface-border rounded-sm hover:border-text-tertiary hover:text-text-primary transition-all"
											>
												Open
											</a>
											<button
												onclick={() => handleDelete(m)}
												class="ml-auto px-2 py-0.5 text-[10px] font-mono text-text-tertiary rounded-sm hover:text-status-red transition-all"
												title="Delete mission"
											>
												Delete
											</button>
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
