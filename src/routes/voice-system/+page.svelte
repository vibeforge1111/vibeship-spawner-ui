<script lang="ts">
	import type { VoiceReadinessStatus, VoiceSystemDashboard } from '$lib/services/voice-system';

	interface PageData {
		dashboard: VoiceSystemDashboard;
	}

	let { data } = $props<{ data: PageData }>();
	const dashboard = $derived(data.dashboard);

	function statusClass(status: VoiceReadinessStatus) {
		if (status === 'ready') return 'border-status-success/35 bg-status-success-bg text-status-success';
		if (status === 'configured') return 'border-accent-primary/35 bg-accent-primary/10 text-accent-primary';
		if (status === 'partial') return 'border-status-warning/35 bg-status-warning-bg text-status-warning';
		if (status === 'blocked') return 'border-status-error/35 bg-status-error-bg text-status-error';
		return 'border-surface-border bg-bg-secondary text-text-secondary';
	}

	function dotClass(status: VoiceReadinessStatus) {
		if (status === 'ready') return 'bg-status-success';
		if (status === 'configured') return 'bg-accent-primary';
		if (status === 'partial') return 'bg-status-warning';
		if (status === 'blocked') return 'bg-status-error';
		return 'bg-text-faint';
	}

	function formatTime(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	}
</script>

<svelte:head>
	<title>Voice System - Spawner</title>
</svelte:head>

<main class="min-h-screen bg-bg-primary text-text-primary">
	<section class="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-4 sm:px-5">
		<header class="flex flex-wrap items-start justify-between gap-3 border-b border-surface-border pb-3">
			<div class="min-w-0">
				<p class="font-mono text-xs uppercase text-accent-primary">Voice System</p>
				<h1 class="mt-1 text-2xl font-semibold text-text-bright">Telegram voice runtime</h1>
				<p class="mt-1 max-w-3xl text-sm text-text-secondary">
					A compact view of the current voice path, provider scope, delivery evidence, and ownership boundaries.
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2 text-xs font-mono">
				{#if dashboard.isSampleData}
					<span data-testid="sample-data-indicator" class="border border-status-warning/40 bg-status-warning-bg px-2 py-1 text-status-warning">Sample view</span>
				{:else}
					<span data-testid="live-data-indicator" class="border border-status-success/40 bg-status-success-bg px-2 py-1 text-status-success">Live snapshot</span>
				{/if}
				<span class="border border-surface-border bg-bg-secondary px-2 py-1 text-text-secondary">{formatTime(dashboard.generatedAt)}</span>
			</div>
		</header>

		{#if dashboard.warnings.length > 0}
			<section class="border border-status-warning/30 bg-status-warning-bg p-3 text-sm text-status-warning" aria-label="Voice dashboard notice">
				{dashboard.warnings[0]}
			</section>
		{/if}

		<section class="grid gap-3 lg:grid-cols-[1fr_1.15fr]" aria-label="Voice profile and runtime path">
			<article class="border border-surface-border bg-bg-tertiary p-4">
				<div class="mb-4 flex items-start justify-between gap-3">
					<div>
						<p class="font-mono text-xs uppercase text-text-tertiary">Current profile</p>
						<h2 class="mt-1 text-xl font-semibold text-text-bright">{dashboard.profile.voiceName}</h2>
					</div>
					<span class="border border-accent-primary/35 bg-accent-primary/10 px-2 py-1 font-mono text-xs text-accent-primary">{dashboard.profile.providerLabel}</span>
				</div>
				<div class="grid gap-3 text-sm sm:grid-cols-2">
					<div class="border border-surface-border bg-bg-primary p-3">
						<p class="font-mono text-xs uppercase text-text-tertiary">Agent</p>
						<p class="mt-1 text-text-bright">{dashboard.profile.agentLabel}</p>
					</div>
					<div class="border border-surface-border bg-bg-primary p-3">
						<p class="font-mono text-xs uppercase text-text-tertiary">Telegram profile</p>
						<p class="mt-1 text-text-bright">{dashboard.profile.telegramProfile}</p>
					</div>
					<div class="border border-surface-border bg-bg-primary p-3">
						<p class="font-mono text-xs uppercase text-text-tertiary">Preference scope</p>
						<p class="mt-1 text-text-bright">{dashboard.profile.preferenceScope}</p>
					</div>
					<div class="border border-surface-border bg-bg-primary p-3">
						<p class="font-mono text-xs uppercase text-text-tertiary">Voice id / effect</p>
						<p class="mt-1 text-text-bright">{dashboard.profile.voiceIdMasked} / {dashboard.profile.audioEffect}</p>
					</div>
				</div>
			</article>

			<article class="border border-surface-border bg-bg-tertiary p-4">
				<div class="mb-4 flex items-center justify-between gap-3">
					<h2 class="text-sm font-semibold text-text-bright">Runtime path</h2>
					<span class="font-mono text-xs text-text-tertiary">Telegram -> Builder -> voice chip -> Telegram</span>
				</div>
				<div class="grid gap-2 md:grid-cols-4">
					{#each dashboard.runtimePath as step, index}
						<div class="min-h-[144px] border border-surface-border bg-bg-primary p-3">
							<div class="mb-3 flex items-center justify-between gap-2">
								<span class={`h-2.5 w-2.5 ${dotClass(step.status)}`}></span>
								<span class="font-mono text-xs text-text-tertiary">{String(index + 1).padStart(2, '0')}</span>
							</div>
							<h3 class="text-sm font-semibold text-text-bright">{step.label}</h3>
							<p class="mt-1 font-mono text-xs text-accent-primary">{step.owner}</p>
							<p class="mt-2 text-xs text-text-secondary">{step.detail}</p>
						</div>
					{/each}
				</div>
			</article>
		</section>

		<section class="grid gap-3 md:grid-cols-3" aria-label="Voice readiness metrics">
			{#each dashboard.metrics as metric}
				<article data-testid={`metric-${metric.id}`} class="min-h-[128px] border border-surface-border bg-bg-tertiary p-3">
					<div class="flex items-start justify-between gap-2">
						<h2 class="text-sm font-semibold text-text-bright">{metric.label}</h2>
						<span class={`border px-2 py-0.5 font-mono text-xs ${statusClass(metric.status)}`}>{metric.status}</span>
					</div>
					<p class="mt-3 text-3xl font-semibold text-text-bright">{metric.value}</p>
					<p class="mt-2 text-sm text-text-secondary">{metric.help}</p>
				</article>
			{/each}
		</section>

		<div class="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
			<section class="grid gap-4">
				<article class="border border-surface-border bg-bg-tertiary p-3" aria-label="Provider readiness">
					<h2 class="mb-3 text-sm font-semibold text-text-bright">Provider readiness</h2>
					<div class="space-y-2">
						{#each dashboard.providers as provider}
							<div class="grid gap-2 border border-surface-border bg-bg-primary p-3 text-sm sm:grid-cols-[132px_1fr_auto] sm:items-center">
								<div>
									<p class="font-semibold text-text-bright">{provider.label}</p>
									<p class="font-mono text-xs text-text-tertiary">{provider.role}</p>
								</div>
								<p class="text-text-secondary">{provider.detail}</p>
								<span class={`w-fit border px-2 py-0.5 font-mono text-xs ${statusClass(provider.status)}`}>{provider.status}</span>
							</div>
						{/each}
					</div>
				</article>

				<article class="border border-surface-border bg-bg-tertiary p-3" aria-label="Last Telegram delivery">
					<div class="mb-2 flex items-start justify-between gap-3">
						<h2 class="text-sm font-semibold text-text-bright">Last Telegram delivery</h2>
						<span class="font-mono text-xs text-text-tertiary">{dashboard.lastDelivery.method}</span>
					</div>
					<p class="text-2xl font-semibold text-text-bright">{dashboard.lastDelivery.status}</p>
					<p class="mt-1 font-mono text-xs text-text-tertiary">{dashboard.lastDelivery.when}</p>
					<p class="mt-2 text-sm text-text-secondary">{dashboard.lastDelivery.detail}</p>
				</article>
			</section>

			<section class="grid gap-4">
				<article class="border border-surface-border bg-bg-tertiary p-3" aria-label="Ownership boundaries">
					<h2 class="mb-3 text-sm font-semibold text-text-bright">Ownership boundaries</h2>
					<div class="divide-y divide-surface-border border border-surface-border bg-bg-primary">
						{#each dashboard.boundaries as boundary}
							<div class="grid gap-2 p-3 text-sm md:grid-cols-[132px_1fr_1fr]">
								<p class="font-semibold text-text-bright">{boundary.owner}</p>
								<p class="text-text-secondary">{boundary.owns}</p>
								<p class="text-text-tertiary">{boundary.notOwner}</p>
							</div>
						{/each}
					</div>
				</article>

				<article class="border border-surface-border bg-bg-tertiary p-3" aria-label="Telegram checks and commands">
					<div class="grid gap-4 md:grid-cols-2">
						<div>
							<h2 class="mb-2 text-sm font-semibold text-text-bright">Production checks</h2>
							<ul class="space-y-1 text-sm text-text-secondary">
								{#each dashboard.checks as check}
									<li class="flex gap-2"><span class="mt-2 h-1.5 w-1.5 shrink-0 bg-accent-primary"></span><span>{check}</span></li>
								{/each}
							</ul>
						</div>
						<div>
							<h2 class="mb-2 text-sm font-semibold text-text-bright">Telegram commands</h2>
							<div class="flex flex-wrap gap-2">
								{#each dashboard.telegramCommands as command}
									<span class="border border-surface-border bg-bg-primary px-2 py-1 font-mono text-xs text-text-secondary">{command}</span>
								{/each}
							</div>
						</div>
					</div>
				</article>
			</section>
		</div>

		<footer class="border-t border-surface-border pt-3 text-xs text-text-tertiary">
			Source: {dashboard.sourceLabel}
		</footer>
	</section>
</main>
