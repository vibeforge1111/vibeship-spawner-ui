<script lang="ts">
	import type { StartupGateStatus, StartupSelfImprovementDashboard } from '$lib/services/startup-self-improvement';

	interface PageData {
		dashboard: StartupSelfImprovementDashboard;
	}

	let { data } = $props<{ data: PageData }>();
	const dashboard = $derived(data.dashboard);
	const passedGateCount = $derived(dashboard.gates.filter((gate: StartupSelfImprovementDashboard['gates'][number]) => gate.pass).length);
	const totalGateCount = $derived(Math.max(1, dashboard.gates.length));

	function formatScore(value: number | null) {
		if (value === null) return 'unknown';
		return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
	}

	function statusClass(status: StartupGateStatus) {
		if (status === 'passed') return 'border-status-success/40 bg-status-success-bg text-status-success';
		if (status === 'blocked') return 'border-status-error/40 bg-status-error-bg text-status-error';
		if (status === 'pending' || status === 'waiting') return 'border-status-warning/40 bg-status-warning-bg text-status-warning';
		return 'border-surface-border bg-bg-secondary text-text-secondary';
	}
</script>

<svelte:head>
	<title>Startup Self-Improvement - Spawner</title>
</svelte:head>

<main class="min-h-screen bg-bg-primary text-text-primary">
	<section class="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-4 sm:px-5">
		<header class="grid gap-3 border-b border-surface-border pb-4 lg:grid-cols-[1fr_auto] lg:items-end">
			<div>
				<p class="font-mono text-xs uppercase text-accent-primary">Startup Self-Improvement</p>
				<h1 class="mt-1 text-2xl font-semibold text-text-bright sm:text-3xl">Bound Startup Bench dossier</h1>
				<p class="mt-1 max-w-3xl text-sm text-text-secondary">
					Read-only proof surface for private movement, promotion gates, blockers, and the next real action.
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2 text-xs font-mono lg:justify-end">
				<span class={dashboard.isSampleData ? 'border border-status-warning/40 bg-status-warning-bg px-2 py-1 text-status-warning' : 'border border-status-success/40 bg-status-success-bg px-2 py-1 text-status-success'}>
					{dashboard.isSampleData ? 'Sample / missing' : 'Bound dossier'}
				</span>
				<span class="border border-surface-border bg-bg-secondary px-2 py-1 text-text-secondary">read-only</span>
				<span class="border border-accent-primary/30 bg-accent-primary/10 px-2 py-1 text-accent-primary">{passedGateCount}/{totalGateCount} gates</span>
			</div>
		</header>

		{#if dashboard.warnings.length > 0}
			<section class="border border-status-warning/30 bg-status-warning-bg p-3 text-sm text-status-warning" aria-label="Startup dossier notice">
				{dashboard.warnings[0]}
			</section>
		{/if}

		<section class="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]" aria-label="Startup score and claim boundary">
			<article class="border border-surface-border bg-bg-tertiary p-4">
				<div class="grid gap-3 sm:grid-cols-3">
					<div class="border border-surface-border bg-bg-primary p-3">
						<p class="font-mono text-xs uppercase text-text-tertiary">Baseline</p>
						<p class="mt-2 text-3xl font-semibold text-text-bright">{formatScore(dashboard.score.baseline)}</p>
					</div>
					<div class="border border-surface-border bg-bg-primary p-3">
						<p class="font-mono text-xs uppercase text-text-tertiary">Candidate</p>
						<p class="mt-2 text-3xl font-semibold text-text-bright">{formatScore(dashboard.score.candidate)}</p>
					</div>
					<div class="border border-surface-border bg-bg-primary p-3">
						<p class="font-mono text-xs uppercase text-text-tertiary">Private delta</p>
						<p class="mt-2 text-3xl font-semibold text-text-bright">{dashboard.score.delta !== null && dashboard.score.delta > 0 ? '+' : ''}{formatScore(dashboard.score.delta)}</p>
					</div>
				</div>
				<p class="mt-4 text-sm text-text-secondary">
					{dashboard.claimBoundary}
				</p>
			</article>

			<article class="border border-surface-border bg-bg-tertiary p-4">
				<p class="font-mono text-xs uppercase text-text-tertiary">Claim booleans</p>
				<div class="mt-3 grid gap-2">
					<div class="grid grid-cols-[1fr_auto] border border-surface-border bg-bg-primary p-3 text-sm">
						<span>Score claim</span>
						<span class={dashboard.scoreClaimAllowed ? 'text-status-success' : 'text-status-warning'}>{dashboard.scoreClaimAllowed ? 'allowed' : 'blocked'}</span>
					</div>
					<div class="grid grid-cols-[1fr_auto] border border-surface-border bg-bg-primary p-3 text-sm">
						<span>Improvement claim</span>
						<span class={dashboard.improvementClaimAllowed ? 'text-status-success' : 'text-status-warning'}>{dashboard.improvementClaimAllowed ? 'allowed' : 'blocked'}</span>
					</div>
					<div class="grid grid-cols-[1fr_auto] border border-surface-border bg-bg-primary p-3 text-sm">
						<span>Public ready</span>
						<span class={dashboard.publication.publicReady ? 'text-status-success' : 'text-text-tertiary'}>{dashboard.publication.publicReady ? 'true' : 'false'}</span>
					</div>
					<div class="grid grid-cols-[1fr_auto] border border-surface-border bg-bg-primary p-3 text-sm">
						<span>Network absorbable</span>
						<span class={dashboard.publication.networkAbsorbable ? 'text-status-success' : 'text-text-tertiary'}>{dashboard.publication.networkAbsorbable ? 'true' : 'false'}</span>
					</div>
				</div>
				<p class="mt-3 text-sm text-text-secondary">{dashboard.actions.reason}</p>
			</article>
		</section>

		<section class="border border-surface-border bg-bg-tertiary p-4" aria-label="Startup proof gates">
			<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h2 class="text-sm font-semibold text-text-bright">Proof gates</h2>
				<span class="font-mono text-xs text-text-tertiary">{dashboard.status}</span>
			</div>
			<div class="grid gap-2 md:grid-cols-3">
				{#each dashboard.gates as gate}
					<div class="min-h-[112px] border border-surface-border bg-bg-primary p-3">
						<div class="flex items-start justify-between gap-2">
							<h3 class="text-sm font-semibold text-text-bright">{gate.label}</h3>
							<span class={`border px-2 py-0.5 font-mono text-[10px] ${statusClass(gate.status)}`}>{gate.status}</span>
						</div>
						<p class="mt-3 text-xs text-text-secondary">{gate.blockers[0] || (gate.pass ? 'Passed for the bound dossier.' : 'No blocker text recorded.')}</p>
					</div>
				{/each}
			</div>
		</section>

		<section class="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]" aria-label="Startup blockers and artifacts">
			<article class="border border-surface-border bg-bg-tertiary p-4">
				<h2 class="text-sm font-semibold text-text-bright">Next action</h2>
				<p class="mt-2 text-lg text-text-bright">{dashboard.nextAction}</p>
				<div class="mt-4 flex flex-wrap gap-2">
					{#each dashboard.blockers as blocker}
						<span class="border border-status-warning/35 bg-status-warning-bg px-2 py-1 text-xs text-status-warning">{blocker}</span>
					{/each}
				</div>
			</article>

			<article class="border border-surface-border bg-bg-tertiary p-4">
				<h2 class="text-sm font-semibold text-text-bright">Artifact manifest</h2>
				<div class="mt-3 grid gap-2 text-xs">
					<div class="border border-surface-border bg-bg-primary p-3">
						<p class="font-mono uppercase text-text-tertiary">Proof bundle</p>
						<p class="mt-1 break-all text-text-secondary">{dashboard.proofBundle.bundleId || dashboard.proofBundle.status || 'missing'}</p>
					</div>
					<div class="border border-surface-border bg-bg-primary p-3">
						<p class="font-mono uppercase text-text-tertiary">Dossier</p>
						<p class="mt-1 break-all text-text-secondary">{dashboard.artifacts.dossierPath || 'not found'}</p>
					</div>
					<div class="border border-surface-border bg-bg-primary p-3">
						<p class="font-mono uppercase text-text-tertiary">Bundle manifest</p>
						<p class="mt-1 break-all text-text-secondary">{dashboard.proofBundle.manifestPath || 'not found'}</p>
					</div>
				</div>
			</article>
		</section>
	</section>
</main>
