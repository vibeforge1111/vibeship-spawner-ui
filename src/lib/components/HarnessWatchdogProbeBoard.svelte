<script lang="ts">
	import type {
		WatchdogAuthorityGateRow,
		WatchdogBoardStatus,
		WatchdogOpenBlocker,
		WatchdogProbeBoard,
		WatchdogProbeRow,
		WatchdogRegistryDriftRow,
		WatchdogRollbackNote,
		WatchdogTelegramProofRow
	} from '$lib/services/harness-watchdog';

	type Section = {
		id: string;
		title: string;
		rows: Array<WatchdogProbeRow | WatchdogAuthorityGateRow | WatchdogTelegramProofRow | WatchdogRegistryDriftRow>;
		empty: string;
	};

	let {
		board,
		loading = false,
		error = null
	}: {
		board: WatchdogProbeBoard | null;
		loading?: boolean;
		error?: string | null;
	} = $props();

	const sections = $derived<Section[]>([
		{ id: 'runtime', title: 'Runtime Health', rows: board?.runtimeHealth ?? [], empty: 'No runtime rows.' },
		{ id: 'authority', title: 'Authority Gates', rows: board?.authorityGates ?? [], empty: 'No authority rows.' },
		{ id: 'telegram', title: 'Telegram Proof', rows: board?.telegramProof ?? [], empty: 'No Telegram proof.' },
		{ id: 'registry', title: 'Registry Drift', rows: board?.registryDrift ?? [], empty: 'No registry evidence.' }
	]);

	function shortTime(value: string | null | undefined): string {
		if (!value) return 'n/a';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function sectionStatus(rows: Array<Pick<WatchdogProbeRow, 'severity'>>): WatchdogBoardStatus {
		if (rows.some((row) => row.severity === 'blocked' || row.severity === 'error')) return 'blocked';
		if (rows.some((row) => row.severity === 'stale')) return 'stale';
		if (rows.some((row) => row.severity === 'degraded')) return 'degraded';
		if (rows.length === 0) return 'empty';
		return 'healthy';
	}

	function statusClass(status: string): string {
		switch (status) {
			case 'healthy':
			case 'approved':
				return 'border-status-success/35 bg-status-success/10 text-status-success';
			case 'blocked':
			case 'denied':
			case 'interrupted':
			case 'machine-policy-origin':
			case 'error':
				return 'border-status-error/35 bg-status-error/10 text-status-error';
			case 'stale':
			case 'degraded':
			case 'missing':
				return 'border-status-amber/35 bg-status-amber/10 text-status-amber';
			default:
				return 'border-surface-border bg-bg-primary text-text-tertiary';
		}
	}

	function latestCheckedAt(rows: Array<Pick<WatchdogProbeRow, 'checkedAt'>>): string | null {
		return rows
			.map((row) => row.checkedAt)
			.filter(Boolean)
			.sort()
			.at(-1) ?? null;
	}

	function rowMeta(row: WatchdogProbeRow): string {
		return [row.source, row.evidenceRef ? `evidence ${row.evidenceRef}` : null].filter(Boolean).join(' / ');
	}

	function rollbackStatus(notes: WatchdogRollbackNote[]): WatchdogBoardStatus {
		if (notes.some((note) => note.status === 'blocked' || note.status === 'error')) return 'blocked';
		if (notes.some((note) => note.status === 'stale')) return 'stale';
		if (notes.some((note) => note.status === 'degraded')) return 'degraded';
		if (notes.length === 0) return 'empty';
		return 'healthy';
	}

	function blockerStatus(blockers: WatchdogOpenBlocker[]): WatchdogBoardStatus {
		if (blockers.some((blocker) => blocker.status === 'blocked' || blocker.status === 'error')) return 'blocked';
		if (blockers.some((blocker) => blocker.status === 'stale')) return 'stale';
		if (blockers.some((blocker) => blocker.status === 'degraded')) return 'degraded';
		if (blockers.length === 0) return 'healthy';
		return 'blocked';
	}
</script>

<section class="space-y-4" aria-label="Harness watchdog probe board">
	<div class="rounded-md border border-surface-border bg-bg-secondary p-4">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="min-w-0">
				<p class="font-mono text-xs uppercase tracking-[0.16em] text-text-tertiary">Harness Watchdog</p>
				<h1 class="mt-1 text-2xl font-semibold text-text-primary">Probe Board</h1>
				<div class="mt-2 flex flex-wrap gap-2 font-mono text-[11px] text-text-tertiary">
					<span class="rounded border border-surface-border bg-bg-primary px-2 py-1">{board?.requestId ?? 'request pending'}</span>
					<span class="rounded border border-surface-border bg-bg-primary px-2 py-1">{board?.missionId ?? 'mission pending'}</span>
					<span class="rounded border border-surface-border bg-bg-primary px-2 py-1">{board?.traceRef ?? 'trace pending'}</span>
				</div>
			</div>
			<div class="text-right">
				<span class={`inline-flex rounded-md border px-3 py-1 font-mono text-xs uppercase ${statusClass(board?.status ?? 'empty')}`}>
					{loading ? 'loading' : board?.status ?? 'empty'}
				</span>
				<p class="mt-2 font-mono text-xs text-text-tertiary">{shortTime(board?.checkedAt)}</p>
			</div>
		</div>
	</div>

	{#if error}
		<div class="rounded-md border border-status-error/35 bg-status-error/10 p-4 text-sm text-status-error">
			{error}
		</div>
	{/if}

	<div class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
		{#each sections as section}
			{@const currentStatus = sectionStatus(section.rows)}
			<section class="min-h-[13rem] rounded-md border border-surface-border bg-bg-secondary p-4">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h2 class="font-mono text-sm uppercase tracking-[0.14em] text-text-primary">{section.title}</h2>
						<p class="mt-1 font-mono text-[11px] text-text-tertiary">{shortTime(latestCheckedAt(section.rows))}</p>
					</div>
					<span class={`rounded border px-2 py-1 font-mono text-[10px] uppercase ${statusClass(currentStatus)}`}>
						{currentStatus}
					</span>
				</div>

				<div class="mt-3 space-y-2">
					{#each section.rows.slice(0, 4) as row}
						<div class="border-t border-surface-border pt-2">
							<div class="flex items-center justify-between gap-2">
								<p class="min-w-0 truncate text-sm font-medium text-text-primary">{row.label}</p>
								<span class={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${statusClass(row.status)}`}>
									{row.status}
								</span>
							</div>
							<p class="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{row.summary}</p>
							<p class="mt-1 truncate font-mono text-[10px] text-text-tertiary">{rowMeta(row)}</p>
						</div>
					{:else}
						<p class="border-t border-surface-border pt-4 text-sm text-text-tertiary">{section.empty}</p>
					{/each}
					{#if section.rows.length > 4}
						<p class="font-mono text-[10px] text-text-tertiary">+{section.rows.length - 4} more rows</p>
					{/if}
				</div>
			</section>
		{/each}

		<section class="min-h-[13rem] rounded-md border border-surface-border bg-bg-secondary p-4">
			<div class="flex items-start justify-between gap-3">
				<div>
					<h2 class="font-mono text-sm uppercase tracking-[0.14em] text-text-primary">Rollback Notes</h2>
					<p class="mt-1 font-mono text-[11px] text-text-tertiary">{shortTime(latestCheckedAt(board?.rollbackNotes ?? []))}</p>
				</div>
				<span class={`rounded border px-2 py-1 font-mono text-[10px] uppercase ${statusClass(rollbackStatus(board?.rollbackNotes ?? []))}`}>
					{rollbackStatus(board?.rollbackNotes ?? [])}
				</span>
			</div>
			<div class="mt-3 space-y-2">
				{#each (board?.rollbackNotes ?? []).slice(0, 4) as note}
					<div class="border-t border-surface-border pt-2">
						<div class="flex items-center justify-between gap-2">
							<p class="min-w-0 truncate text-sm font-medium text-text-primary">{note.summary}</p>
							<span class={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${statusClass(note.status)}`}>
								{note.status}
							</span>
						</div>
						<p class="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{note.recommendedAction}</p>
						<p class="mt-1 truncate font-mono text-[10px] text-text-tertiary">{note.source} / evidence {note.evidenceRef ?? 'n/a'}</p>
					</div>
				{:else}
					<p class="border-t border-surface-border pt-4 text-sm text-text-tertiary">No rollback guidance is attached.</p>
				{/each}
			</div>
		</section>

		<section class="min-h-[13rem] rounded-md border border-surface-border bg-bg-secondary p-4">
			<div class="flex items-start justify-between gap-3">
				<div>
					<h2 class="font-mono text-sm uppercase tracking-[0.14em] text-text-primary">Open Blockers</h2>
					<p class="mt-1 font-mono text-[11px] text-text-tertiary">{shortTime(latestCheckedAt(board?.openBlockers ?? []))}</p>
				</div>
				<span class={`rounded border px-2 py-1 font-mono text-[10px] uppercase ${statusClass(blockerStatus(board?.openBlockers ?? []))}`}>
					{blockerStatus(board?.openBlockers ?? [])}
				</span>
			</div>
			<div class="mt-3 space-y-2">
				{#each (board?.openBlockers ?? []).slice(0, 4) as blocker}
					<div class="border-t border-surface-border pt-2">
						<div class="flex items-center justify-between gap-2">
							<p class="min-w-0 truncate text-sm font-medium text-text-primary">{blocker.id}</p>
							<span class={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${statusClass(blocker.status)}`}>
								{blocker.status}
							</span>
						</div>
						<p class="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{blocker.summary}</p>
						<p class="mt-1 truncate font-mono text-[10px] text-text-tertiary">{blocker.source} / evidence {blocker.evidenceRef ?? 'n/a'}</p>
					</div>
				{:else}
					<p class="border-t border-surface-border pt-4 text-sm text-text-tertiary">No open blockers.</p>
				{/each}
			</div>
		</section>
	</div>
</section>
