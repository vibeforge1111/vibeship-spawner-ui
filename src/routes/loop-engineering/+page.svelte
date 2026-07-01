<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import {
		GateBadge,
		LoopHelp,
		MetricTile,
		StatusBadge
	} from '$lib/components/loop-engineering';
	import type {
		LoopEngineeringEvent,
		LoopEngineeringRegistry,
		LoopEngineeringChipSummary
	} from '$lib/server/loop-engineering-registry';

	let { data }: { data: { registry: LoopEngineeringRegistry } } = $props();
	const registry = $derived(data.registry);
	const needsAttention = $derived(
		registry.chips.filter((chip) => chip.status === 'blocked' || chip.blockers.length > 0 || !chip.benchmark.blindVerified)
	);

	const pathSteps = [
		{
			label: 'Define',
			help: 'Name the domain workflow and the situations where this chip should help.'
		},
		{
			label: 'Benchmark',
			help: 'Add visible, held-out, trap, no-op, or regression cases that judge useful behavior.'
		},
		{
			label: 'Improve',
			help: 'Run private loops against selected cases and keep generator output separate from evaluator scoring.'
		},
		{
			label: 'Review',
			help: 'Accept only separated evaluator evidence before distilling lessons or claiming improvement.'
		},
		{
			label: 'Activate',
			help: 'Stage a scoped use case with rollback and approval. Nothing is globally activated from this board.'
		}
	];

	function formatScore(value: number | null) {
		return typeof value === 'number' ? value.toFixed(1) : 'n/a';
	}

	function formatDelta(value: number | null) {
		if (typeof value !== 'number') return 'n/a';
		return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
	}

	function deltaTone(value: number | null): 'default' | 'success' | 'warning' | 'error' {
		if (typeof value !== 'number') return 'default';
		if (value > 0) return 'success';
		if (value < 0) return 'error';
		return 'warning';
	}

	function evaluatorLabel(event: LoopEngineeringEvent) {
		if (!event.evaluatorSeparated) return 'missing';
		if (event.status === 'queued' || event.status === 'running') return 'required';
		return 'separated';
	}

	function eventStatusHelp(event: LoopEngineeringEvent) {
		if (event.evaluatorSeparated) return 'This event has separated evaluator handling in the ledger.';
		return 'This record is provenance or staging only; it is not evaluator proof of improvement.';
	}

	function chipBoundary(chip: LoopEngineeringChipSummary) {
		if (chip.status === 'local_fast_path') return 'local fast path evidence exists';
		if (chip.status === 'blocked') return 'blocked until proof gaps close';
		if (chip.status === 'private_candidate' || chip.status === 'loop_proven_private') return 'private candidate';
		return 'private/local evidence only';
	}
</script>

<svelte:head>
	<title>Loop Engineering · spawner</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-bg-primary text-text-primary">
	<Navbar />

	<main class="mx-auto flex w-full max-w-[180rem] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
		<header class="grid gap-4 border-b border-surface-border pb-5 xl:grid-cols-[1fr_auto] xl:items-end">
			<div class="min-w-0">
				<p class="overline">Loop engineering</p>
				<h1 class="text-2xl font-semibold tracking-tight text-text-bright sm:text-3xl">Domain Chip control plane</h1>
				<p class="mt-2 max-w-4xl text-sm leading-6 text-text-secondary">
					Inspect chips, run private evals, stage safe improvements, and keep the proof trail in Spawner. Telegram stays useful as a fast lane, but this is the operator surface.
				</p>
			</div>
			<div class="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[38rem]">
				<MetricTile label="chips" value={registry.summary.total} help="Domain Chips discovered in the configured local chip root." />
				<MetricTile label="events" value={registry.summary.resultEvents} help="Benchmark, loop, evaluator, schedule, and activation records in the current evidence ledger." />
				<MetricTile label="benchmark pass" value={registry.summary.benchmarkPasses} tone="success" help="Chips with benchmark evidence that currently passes their local artifact checks." />
				<MetricTile label="fast path" value={registry.summary.localFastPaths} help="Chips with local fast-path support. This is still local/private unless activation is approved." />
			</div>
		</header>

		<section class="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
			<div class="border border-surface-border bg-bg-secondary p-4">
				<div class="flex items-center gap-2">
					<p class="font-mono text-[10px] uppercase text-text-tertiary">What this is</p>
					<LoopHelp text="A Domain Chip is a private domain-specific operating pack: prompts, rules, benchmarks, loops, evidence, and activation notes for one repeatable workflow." />
				</div>
				<h2 class="mt-2 text-lg font-semibold text-text-bright">Useful chips improve only when evidence says they do.</h2>
				<p class="mt-2 text-sm leading-6 text-text-secondary">
					Use this board to choose a chip, add benchmark coverage, run local private evaluations, distill accepted lessons, and stage activation without publishing or globally enabling anything.
				</p>
			</div>

			<div class="border border-surface-border bg-bg-secondary p-4">
				<div class="flex items-center gap-2">
					<p class="font-mono text-[10px] uppercase text-text-tertiary">Build path</p>
					<LoopHelp text="This is the product sequence a new user should follow. Advanced evidence remains available below." />
				</div>
				<div class="mt-3 grid gap-2 sm:grid-cols-5">
					{#each pathSteps as step, index}
						<div class="border border-surface-border bg-bg-primary p-3">
							<div class="flex items-center justify-between gap-2">
								<span class="flex h-6 w-6 items-center justify-center border border-accent-primary/35 bg-accent-primary/10 font-mono text-xs text-accent-primary">{index + 1}</span>
								<LoopHelp text={step.help} label={`${step.label} help`} />
							</div>
							<p class="mt-3 text-sm font-medium text-text-bright">{step.label}</p>
						</div>
					{/each}
				</div>
			</div>
		</section>

		{#if needsAttention.length > 0}
			<section class="border border-status-warning/35 bg-status-warning-bg/40 p-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<div>
						<p class="font-mono text-[10px] uppercase text-status-warning">Needs attention</p>
						<h2 class="mt-1 text-lg font-semibold text-text-bright">Chips with proof gaps or blockers</h2>
					</div>
					<StatusBadge status="attention" label={`${needsAttention.length} to review`} />
				</div>
				<div class="mt-3 grid gap-2 lg:grid-cols-2">
					{#each needsAttention.slice(0, 4) as chip}
						<a class="block border border-surface-border bg-bg-primary p-3 hover:border-accent-primary/40" href={`/loop-engineering/${encodeURIComponent(chip.id)}`}>
							<div class="flex flex-wrap items-center justify-between gap-2">
								<p class="font-medium text-text-bright">{chip.domain}</p>
								<StatusBadge status={chip.status} label={chip.statusLabel} />
							</div>
							<p class="mt-2 text-sm leading-5 text-text-secondary">{chip.blockers[0] || chip.nextAction}</p>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<div class="mb-3 flex flex-wrap items-end justify-between gap-3">
				<div>
					<p class="font-mono text-[10px] uppercase text-text-tertiary">Chip registry</p>
					<h2 class="mt-1 text-lg font-semibold text-text-bright">Open a chip and take the next safe action</h2>
				</div>
				<p class="font-mono text-xs text-text-tertiary">{registry.chips.length} discovered</p>
			</div>

			{#if registry.chips.length === 0}
				<div class="border border-surface-border bg-bg-secondary p-6 text-sm text-text-secondary">
					No Domain Chip evidence was found in the configured chips root.
				</div>
			{:else}
				<div class="grid gap-4 xl:grid-cols-2">
					{#each registry.chips as chip}
						<article class="border border-surface-border bg-bg-secondary p-4">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<StatusBadge status={chip.status} label={chip.statusLabel} />
										<span class="border border-surface-border bg-bg-primary px-2 py-1 font-mono text-[11px] text-text-tertiary">{chip.visibility}</span>
										<span class="border border-surface-border bg-bg-primary px-2 py-1 font-mono text-[11px] text-text-tertiary">{chipBoundary(chip)}</span>
									</div>
									<h3 class="mt-3 truncate text-lg font-semibold text-text-bright" title={chip.name}>{chip.domain}</h3>
									<p class="mt-1 text-sm leading-5 text-text-secondary">{chip.nextAction}</p>
								</div>
								<a
									href={`/loop-engineering/${encodeURIComponent(chip.id)}`}
									class="inline-flex items-center justify-center gap-2 border border-surface-border bg-bg-primary px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-text-primary"
								>
									Open
									<Icon name="arrow-right" size={14} />
								</a>
							</div>

							<div class="mt-4 grid gap-2 sm:grid-cols-3">
								<MetricTile label="delta" value={formatDelta(chip.benchmark.utilityDelta)} tone={deltaTone(chip.benchmark.utilityDelta)} help="Candidate score minus no-chip baseline. Positive deltas still require evaluator proof before activation." />
								<MetricTile label="rounds" value={`${chip.loop.roundsObserved}/${chip.loop.requiredRounds || 'n/a'}`} help="Observed private improvement loop rounds compared with the chip's expected proof depth." />
								<MetricTile label="claims" value={`${chip.allowedClaimCount}/${chip.disallowedClaimCount}`} help="Allowed claims versus blocked claims from the chip's evidence matrix." />
							</div>

							<div class="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
								<div class="grid grid-cols-3 gap-2 border border-surface-border bg-bg-primary p-3 text-xs">
									<div>
										<div class="flex items-center gap-1 text-text-tertiary">
											<span>No chip</span>
											<LoopHelp text="The baseline result without this chip's guidance." />
										</div>
										<p class="mt-1 font-mono text-text-bright">{formatScore(chip.benchmark.noChipScore)}</p>
									</div>
									<div>
										<div class="flex items-center gap-1 text-text-tertiary">
											<span>Candidate</span>
											<LoopHelp text="The chip-assisted result being compared against baseline." />
										</div>
										<p class="mt-1 font-mono text-text-bright">{formatScore(chip.benchmark.chipScore)}</p>
									</div>
									<div>
										<div class="flex items-center gap-1 text-text-tertiary">
											<span>Blind</span>
											<LoopHelp text="Whether scoring avoided exposing source labels before evaluator scoring." />
										</div>
										<p class="mt-1 font-mono text-text-bright">{chip.benchmark.blindVerified ? 'yes' : 'no'}</p>
									</div>
								</div>
								<div class="border border-surface-border bg-bg-primary p-3">
									<p class="font-mono text-[10px] uppercase text-text-tertiary">Proof gates</p>
									<div class="mt-3 flex flex-wrap gap-2">
										<GateBadge label="eval" passed={chip.gates.sealedEvaluator} help="Separated or sealed evaluator evidence exists." />
										<GateBadge label="watchtower" passed={chip.gates.watchtower} help="Regression/watchtower checks have evidence." />
										<GateBadge label="rollback" passed={chip.gates.rollback} help="Rollback proof is present." />
										<GateBadge label="activation" passed={chip.activation.loopModeAllowed || chip.activation.reviewPacketAllowed} help="Activation is at least supported for review or loop mode; approval may still be required." />
									</div>
								</div>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</section>

		<details class="border border-surface-border bg-bg-secondary">
			<summary class="cursor-pointer px-4 py-3 text-sm font-medium text-text-bright hover:bg-bg-primary">
				Advanced evidence ledger ({registry.summary.resultEvents})
			</summary>
			{#if registry.events.length === 0}
				<p class="border-t border-surface-border p-4 text-sm text-text-tertiary">No loop-engineering events were derived from chip evidence yet.</p>
			{:else}
				<div class="border-t border-surface-border p-4">
					<div class="overflow-x-auto">
						<table class="w-full min-w-[72rem] border-collapse text-left text-sm">
							<thead class="font-mono text-[10px] uppercase text-text-tertiary">
								<tr class="border-b border-surface-border">
									<th class="py-2 pr-3">Status</th>
									<th class="py-2 pr-3">Chip</th>
									<th class="py-2 pr-3">Event</th>
									<th class="py-2 pr-3">No chip</th>
									<th class="py-2 pr-3">Candidate</th>
									<th class="py-2 pr-3">Delta</th>
									<th class="py-2 pr-3">Rounds</th>
									<th class="py-2 pr-3">Evaluator</th>
									<th class="py-2 pr-3">Next action</th>
								</tr>
							</thead>
							<tbody>
								{#each registry.events.slice(0, 32) as event}
									<tr class="border-b border-surface-border/70 align-top">
										<td class="py-3 pr-3">
											<StatusBadge status={event.status} />
										</td>
										<td class="max-w-[14rem] py-3 pr-3">
											<a class="block truncate text-text-bright hover:text-accent-primary" href={`/loop-engineering/${encodeURIComponent(event.chipId)}`} title={event.domain}>
												{event.domain}
											</a>
											<p class="mt-1 truncate font-mono text-[11px] text-text-tertiary" title={event.chipId}>{event.chipId}</p>
										</td>
										<td class="py-3 pr-3">
											<p class="text-text-secondary">{event.label}</p>
											<p class="mt-1 font-mono text-[11px] text-text-tertiary">{event.sourceSurface}</p>
										</td>
										<td class="py-3 pr-3 font-mono text-text-secondary">{formatScore(event.previousScore)}</td>
										<td class="py-3 pr-3 font-mono text-text-secondary">{formatScore(event.candidateScore)}</td>
										<td class="py-3 pr-3 font-mono text-text-bright">{formatDelta(event.utilityDelta)}</td>
										<td class="py-3 pr-3 font-mono text-text-secondary">{event.roundsObserved ?? 'n/a'}</td>
										<td class="py-3 pr-3">
											<span class="inline-flex items-center gap-1 font-mono text-xs text-text-secondary">
												{evaluatorLabel(event)}
												<LoopHelp text={eventStatusHelp(event)} />
											</span>
										</td>
										<td class="max-w-[22rem] py-3 pr-3">
											<p class="break-words text-text-secondary">{event.nextAction}</p>
											{#if event.evidenceRefs.length}
												<p class="mt-1 truncate font-mono text-[11px] text-text-tertiary" title={event.evidenceRefs.join(', ')}>
													{event.evidenceRefs.join(', ')}
												</p>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</details>
	</main>

	<Footer />
</div>
