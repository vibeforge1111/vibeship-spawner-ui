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

	function relTime(iso: string | null): string {
		if (!iso) return '';
		const d = Date.now() - new Date(iso).getTime();
		const m = Math.floor(d / 60000);
		if (m < 1) return 'just now';
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
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
				<div class="grid md:grid-cols-3 gap-4">
					{#each [
						{ title: 'To do', items: toDo, hint: 'draft · ready', empty: 'No pending missions' },
						{ title: 'In progress', items: inProgress, hint: 'running · paused', empty: 'Nothing running' },
						{ title: 'Done', items: done, hint: 'completed · failed', empty: 'No history yet' }
					] as col}
						<section class="border border-surface-border rounded-lg bg-bg-secondary flex flex-col min-h-[320px]">
							<div class="flex items-center justify-between px-4 py-3 border-b border-surface-border">
								<span class="font-mono text-xs font-semibold text-text-bright tracking-wide">{col.title}</span>
								<span class="font-mono text-[10px] text-text-tertiary">{col.items.length} · {col.hint}</span>
							</div>
							<div class="p-2 space-y-1.5 flex-1 overflow-y-auto">
								{#each col.items as m (m.id)}
									<article class="group px-3 py-2.5 rounded-md border border-transparent hover:border-surface-border hover:bg-bg-primary transition-all">
										<a href={`/missions/${m.id}`} class="block mb-1.5">
											<div class="flex items-center gap-2 mb-1">
												<span class="w-1.5 h-1.5 rounded-full {statusDot(m.status)}"></span>
												<span class="font-sans text-sm text-text-primary truncate group-hover:text-accent-primary transition-colors">
													{m.name || 'Untitled mission'}
												</span>
											</div>
											<div class="flex items-center gap-2 font-mono text-[10px] text-text-tertiary">
												<span>{m.mode}</span>
												<span>·</span>
												<span>{relTime(m.updated_at ?? m.created_at)}</span>
												{#if m.tasks?.length}
													<span>·</span>
													<span>{m.tasks.length} task{m.tasks.length !== 1 ? 's' : ''}</span>
												{/if}
											</div>
										</a>
										<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
									<p class="px-3 py-8 font-mono text-[11px] text-text-faint text-center">{col.empty}</p>
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
