<script lang="ts">
	let { data } = $props();

	const status = $derived(data.status);
	const doneCount = $derived(status.checks.filter((check) => check.ok).length);
</script>

<svelte:head>
	<title>Spark Live Setup</title>
</svelte:head>

<main class="min-h-screen bg-[rgb(18,20,20)] px-4 py-8 text-text-primary">
	<section class="mx-auto max-w-5xl">
		<div class="mb-8 flex flex-col gap-4 border-b border-surface-border pb-6 md:flex-row md:items-end md:justify-between">
			<div>
				<p class="overline text-accent-primary">Spark Live</p>
				<h1 class="mt-3 font-display text-4xl font-semibold text-text-bright">Hosted setup</h1>
				<p class="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
					A private checklist for the hosted/VPS Spark path. It shows what is configured without revealing tokens or API keys.
				</p>
			</div>

			<a class="inline-flex rounded-md bg-accent-primary px-4 py-3 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover" href="/kanban">
				Open Kanban
			</a>
		</div>

		<div class="grid gap-4 md:grid-cols-3">
			<div class="rounded-lg border border-surface-border bg-surface-primary p-5">
				<p class="text-xs uppercase tracking-wide text-text-tertiary">Readiness</p>
				<p class="mt-2 text-2xl font-semibold text-text-bright">{doneCount}/{status.checks.length}</p>
				<p class="mt-2 text-sm text-text-secondary">{status.ready ? 'Ready for a guided smoke test.' : 'Finish the missing items below.'}</p>
			</div>
			<div class="rounded-lg border border-surface-border bg-surface-primary p-5">
				<p class="text-xs uppercase tracking-wide text-text-tertiary">Agent route</p>
				<p class="mt-2 font-mono text-sm text-text-bright">{status.roles.agent}</p>
				<p class="mt-2 text-sm text-text-secondary">Chat, runtime, memory, and normal Telegram replies.</p>
			</div>
			<div class="rounded-lg border border-surface-border bg-surface-primary p-5">
				<p class="text-xs uppercase tracking-wide text-text-tertiary">Mission route</p>
				<p class="mt-2 font-mono text-sm text-text-bright">{status.roles.mission}</p>
				<p class="mt-2 text-sm text-text-secondary">Spawner builds and longer execution missions.</p>
			</div>
		</div>

		<div class="mt-6 grid gap-3">
			{#each status.checks as check}
				<article class="rounded-lg border border-surface-border bg-surface-primary p-4">
					<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div>
							<div class="flex items-center gap-3">
								<span class={check.ok ? 'text-status-green' : 'text-status-yellow'}>{check.ok ? 'OK' : 'Needs setup'}</span>
								<h2 class="text-base font-semibold text-text-bright">{check.label}</h2>
							</div>
							<p class="mt-2 text-sm leading-6 text-text-secondary">{check.detail}</p>
						</div>
						<p class="max-w-xl rounded-md bg-bg-secondary px-3 py-2 text-sm leading-6 text-text-secondary">{check.fix}</p>
					</div>
				</article>
			{/each}
		</div>

		<div class="mt-6 rounded-lg border border-surface-border bg-surface-primary p-5">
			<h2 class="text-base font-semibold text-text-bright">Next commands</h2>
			<div class="mt-3 grid gap-2 font-mono text-sm text-text-secondary">
				<p>spark live status</p>
				<p>spark live verify --quick</p>
				<p>spark live verify</p>
				<p>spark logs spark-telegram-bot --lines 80</p>
			</div>
		</div>
	</section>
</main>
