<!--
	Compact Kanban for the welcome page — three columns sourced from
	missionsState. Replaces the marketing "Skilled Agents" section so
	the entrance lands on actual operator state, not sell copy.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { missionsState, loadMissions } from '$lib/stores/missions.svelte';
	import { mcpState } from '$lib/stores/mcp.svelte';
	import type { Mission } from '$lib/services/mcp-client';

	let missions = $state<Mission[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let mcpConnected = $state(false);

	onMount(() => {
		const unsubMcp = mcpState.subscribe((s) => {
			mcpConnected = s.status === 'connected';
		});
		const unsub = missionsState.subscribe((s) => {
			missions = s.missions;
			loading = s.loading;
			error = s.error;
		});
		loadMissions({ limit: 30 }).catch(() => {});
		return () => {
			unsub();
			unsubMcp();
		};
	});

	const active = $derived(missions.filter((m) => m.status === 'running' || m.status === 'paused'));
	const queued = $derived(missions.filter((m) => m.status === 'draft' || m.status === 'ready'));
	const recent = $derived(
		missions
			.filter((m) => m.status === 'completed' || m.status === 'failed')
			.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
			.slice(0, 6)
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
</script>

<section class="max-w-6xl mx-auto px-6 pb-24">
	<div class="flex items-end justify-between mb-6">
		<div>
			<p class="overline">Mission board</p>
			<h2 class="text-2xl font-sans font-semibold text-text-primary tracking-tight">
				What's running.
			</h2>
		</div>
		<a href="/missions" class="font-mono text-xs text-text-secondary hover:text-accent-primary transition-colors">
			Open missions →
		</a>
	</div>

	{#if !mcpConnected && !loading && missions.length === 0}
		<div class="border border-surface-border rounded-lg bg-bg-secondary px-5 py-8 text-center">
			<p class="font-mono text-xs text-text-tertiary">
				MCP server offline — board will populate when canvas-sync connects.
			</p>
		</div>
	{:else if error && missions.length === 0}
		<div class="border border-surface-border rounded-lg bg-bg-secondary px-5 py-8 text-center">
			<p class="font-mono text-xs text-text-tertiary">{error}</p>
		</div>
	{:else}
		<div class="grid md:grid-cols-3 gap-4">
			{#each [{ title: 'Active', items: active, hint: 'running · paused' }, { title: 'Queued', items: queued, hint: 'draft · ready' }, { title: 'Recent', items: recent, hint: 'completed · failed' }] as col}
				<div class="border border-surface-border rounded-lg bg-bg-secondary">
					<div class="flex items-center justify-between px-4 py-3 border-b border-surface-border">
						<span class="font-mono text-xs font-semibold text-text-bright tracking-wide">{col.title}</span>
						<span class="font-mono text-[10px] text-text-tertiary">{col.items.length} · {col.hint}</span>
					</div>
					<div class="p-2 space-y-1.5 min-h-[140px]">
						{#each col.items as m (m.id)}
							<a
								href={`/missions/${m.id}`}
								class="block px-3 py-2 rounded-md border border-transparent hover:border-surface-border hover:bg-bg-primary transition-all group"
							>
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
								</div>
							</a>
						{:else}
							<p class="px-3 py-6 font-mono text-[11px] text-text-faint text-center">empty</p>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
