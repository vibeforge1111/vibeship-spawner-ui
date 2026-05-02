<script lang="ts">
	type Tier = 'core' | 'supporting' | 'related';
	type SkillRow = {
		id: string;
		name: string;
		category: string;
		score: number;
		reason: string;
		tier: Tier;
		isLabeledRelevant: boolean;
		isUnwanted: boolean;
	};
	type EvalCase = {
		name: string;
		prompt: string;
		pass: boolean;
		score: number;
		labeledPrecisionAtK: number;
		requiredRecall: number;
		anyOfRecall: number;
		mustNotCleanRate: number;
		missingRequired: string[];
		missingAnyOf: string[][];
		unwanted: string[];
		relevantReturned: string[];
		topK: number;
		expected: {
			mustInclude: string[];
			anyOf: string[][];
			mustNotInclude: string[];
			labels: string[];
		};
		skills: SkillRow[];
	};
	type PageData = {
		generatedAt: string;
		project: {
			name: string;
			catalogSkillCount: number;
			evalCaseCount: number;
			topKLimitSlots: number;
			returnedRecommendationCount: number;
		};
		summary: {
			caseCount: number;
			passCount: number;
			passRate: number;
			averageScore: number;
			averageLabeledPrecisionAtK: number;
			averageRequiredRecall: number;
			averageAnyOfRecall: number;
			averageMustNotCleanRate: number;
			failures: string[];
			tierCounts: Record<Tier, number>;
			lowPrecisionCases: string[];
		};
		scoring: {
			passRule: string;
			scoreWeights: Array<{ label: string; weight: number }>;
			precisionNote: string;
		};
		cases: EvalCase[];
	};

	let { data } = $props<{ data: PageData }>();
	let filter = $state<'all' | 'failing' | 'lowPrecision'>('all');
	const visibleCases = $derived(
		data.cases.filter((testCase: EvalCase) => {
			if (filter === 'failing') return !testCase.pass;
			if (filter === 'lowPrecision') return testCase.labeledPrecisionAtK < 0.5;
			return true;
		})
	);

	function pct(value: number) {
		return `${Math.round(value * 100)}%`;
	}

	function decimal(value: number) {
		return value.toFixed(3);
	}

	function tierClass(tier: Tier) {
		if (tier === 'core') return 'border-status-success/40 bg-status-success-bg text-status-success';
		if (tier === 'supporting') return 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary';
		return 'border-surface-border bg-bg-secondary text-text-secondary';
	}

	function formatAnyOfMissing(groups: string[][]) {
		return groups.map((group) => group.join(' / ')).join(', ');
	}
</script>

<svelte:head>
	<title>Skill Recommendation Evals - Spawner</title>
</svelte:head>

<main class="min-h-screen bg-bg-primary text-text-primary">
	<section class="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-5 py-5">
		<header class="flex flex-wrap items-start justify-between gap-3 border-b border-surface-border pb-3">
			<div>
				<p class="font-mono text-xs uppercase text-accent-primary">Internal matcher audit</p>
				<h1 class="mt-1 text-2xl font-semibold text-text-bright">Skill recommendation dashboard</h1>
				<p class="mt-1 max-w-3xl text-sm text-text-secondary">{data.project.name}</p>
			</div>
			<div class="flex flex-wrap gap-2 text-xs font-mono">
				<span class="border border-surface-border bg-bg-secondary px-2 py-1 text-text-secondary">
					Generated {new Date(data.generatedAt).toLocaleString()}
				</span>
				<span class={data.summary.passRate === 1 ? 'badge-success' : 'badge-warning'}>
					{data.summary.passCount}/{data.summary.caseCount} passing
				</span>
			</div>
		</header>

		<section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6" aria-label="Summary metrics">
			<div class="panel p-3">
				<p class="font-mono text-xs text-text-tertiary">Catalog skills</p>
				<p class="mt-1 text-2xl font-semibold">{data.project.catalogSkillCount}</p>
			</div>
			<div class="panel p-3">
				<p class="font-mono text-xs text-text-tertiary">Project tests</p>
				<p class="mt-1 text-2xl font-semibold">{data.project.evalCaseCount}</p>
			</div>
			<div class="panel p-3">
				<p class="font-mono text-xs text-text-tertiary">Returned pairings</p>
				<p class="mt-1 text-2xl font-semibold">{data.project.returnedRecommendationCount}</p>
				<p class="mt-1 text-xs text-text-tertiary">top-{data.cases[0]?.topK ?? 10} cap: {data.project.topKLimitSlots}</p>
			</div>
			<div class="panel p-3">
				<p class="font-mono text-xs text-text-tertiary">Average score</p>
				<p class="mt-1 text-2xl font-semibold">{decimal(data.summary.averageScore)}</p>
			</div>
			<div class="panel p-3">
				<p class="font-mono text-xs text-text-tertiary">Precision@K</p>
				<p class="mt-1 text-2xl font-semibold">{pct(data.summary.averageLabeledPrecisionAtK)}</p>
			</div>
			<div class="panel p-3">
				<p class="font-mono text-xs text-text-tertiary">Required recall</p>
				<p class="mt-1 text-2xl font-semibold">{pct(data.summary.averageRequiredRecall)}</p>
			</div>
		</section>

		<section class="grid gap-4 xl:grid-cols-[1fr_420px]">
			<div class="panel p-3" aria-label="How scoring works">
				<h2 class="text-sm font-semibold">Test method</h2>
				<p class="mt-2 text-sm text-text-secondary">{data.scoring.passRule}</p>
				<div class="mt-3 grid gap-2 md:grid-cols-4">
					{#each data.scoring.scoreWeights as weight}
						<div class="border border-surface-border bg-bg-primary p-2">
							<p class="font-mono text-xs text-text-tertiary">{weight.label}</p>
							<p class="mt-1 text-lg font-semibold">{weight.weight}%</p>
						</div>
					{/each}
				</div>
				<p class="mt-3 text-xs text-text-tertiary">{data.scoring.precisionNote}</p>
			</div>

			<div class="panel p-3" aria-label="Tier distribution">
				<h2 class="text-sm font-semibold">Paired skill tiers</h2>
				<div class="mt-3 grid grid-cols-3 gap-2">
					{#each ['core', 'supporting', 'related'] as tier}
						<div class="border border-surface-border bg-bg-primary p-2">
							<p class="font-mono text-xs uppercase text-text-tertiary">{tier}</p>
							<p class="mt-1 text-xl font-semibold">{data.summary.tierCounts[tier as Tier]}</p>
						</div>
					{/each}
				</div>
				<div class="mt-3 grid grid-cols-3 gap-2 text-xs">
					<div>
						<p class="font-mono text-text-tertiary">Any-of recall</p>
						<p class="mt-1 font-semibold">{pct(data.summary.averageAnyOfRecall)}</p>
					</div>
					<div>
						<p class="font-mono text-text-tertiary">Clean rate</p>
						<p class="mt-1 font-semibold">{pct(data.summary.averageMustNotCleanRate)}</p>
					</div>
					<div>
						<p class="font-mono text-text-tertiary">Failures</p>
						<p class="mt-1 font-semibold">{data.summary.failures.length}</p>
					</div>
				</div>
			</div>
		</section>

		<section class="panel overflow-hidden" aria-label="Recommendation eval cases">
			<div class="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-3 py-2">
				<h2 class="text-sm font-semibold">Project prompts and paired skills</h2>
				<div class="flex gap-1 text-xs">
					<button class={filter === 'all' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onclick={() => filter = 'all'}>All</button>
					<button class={filter === 'failing' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onclick={() => filter = 'failing'}>Failing</button>
					<button class={filter === 'lowPrecision' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onclick={() => filter = 'lowPrecision'}>Low precision</button>
				</div>
			</div>

			<div class="divide-y divide-surface-border">
				{#each visibleCases as testCase}
					<article class="grid gap-3 px-3 py-3 xl:grid-cols-[360px_1fr]">
						<div>
							<div class="flex flex-wrap items-center gap-2">
								<h3 class="font-semibold text-text-bright">{testCase.name}</h3>
								<span class={testCase.pass ? 'badge-success' : 'badge-error'}>{testCase.pass ? 'pass' : 'fail'}</span>
								<span class="border border-surface-border bg-bg-secondary px-2 py-0.5 font-mono text-xs text-text-tertiary">
									score {decimal(testCase.score)}
								</span>
							</div>
							<p class="mt-2 text-sm text-text-secondary">{testCase.prompt}</p>
							<div class="mt-3 space-y-2 text-xs">
								<div>
									<p class="font-mono uppercase text-text-tertiary">Expected</p>
									<div class="mt-1 flex flex-wrap gap-1">
										{#each testCase.expected.labels as label}
											<span class="border border-surface-border bg-bg-primary px-2 py-0.5 text-text-secondary">{label}</span>
										{/each}
									</div>
								</div>
								{#if !testCase.pass}
									<div class="border border-status-error/40 bg-status-error-bg p-2 text-status-error">
										{#if testCase.missingRequired.length}Missing required: {testCase.missingRequired.join(', ')}{/if}
										{#if testCase.missingAnyOf.length} Missing any-of: {formatAnyOfMissing(testCase.missingAnyOf)}{/if}
										{#if testCase.unwanted.length} Unwanted: {testCase.unwanted.join(', ')}{/if}
									</div>
								{/if}
							</div>
						</div>

						<div class="overflow-x-auto">
							<table class="w-full min-w-[760px] text-left text-xs">
								<thead class="bg-bg-secondary text-text-tertiary">
									<tr>
										<th class="px-2 py-2 font-mono">Skill</th>
										<th class="px-2 py-2 font-mono">Tier</th>
										<th class="px-2 py-2 text-right font-mono">Score</th>
										<th class="px-2 py-2 font-mono">Category</th>
										<th class="px-2 py-2 font-mono">Reason</th>
										<th class="px-2 py-2 font-mono">Label</th>
									</tr>
								</thead>
								<tbody>
									{#each testCase.skills as skill}
										<tr class="border-t border-surface-border">
											<td class="px-2 py-2">
												<p class="font-medium text-text-bright">{skill.name}</p>
												<p class="font-mono text-[11px] text-text-tertiary">{skill.id}</p>
											</td>
											<td class="px-2 py-2">
												<span class={`border px-2 py-0.5 font-mono text-[11px] uppercase ${tierClass(skill.tier)}`}>{skill.tier}</span>
											</td>
											<td class="px-2 py-2 text-right font-mono">{skill.score}</td>
											<td class="px-2 py-2 text-text-secondary">{skill.category}</td>
											<td class="max-w-[240px] px-2 py-2 text-text-secondary">{skill.reason}</td>
											<td class="px-2 py-2">
												{#if skill.isUnwanted}
													<span class="badge-error">unwanted</span>
												{:else if skill.isLabeledRelevant}
													<span class="badge-success">expected</span>
												{:else}
													<span class="text-text-tertiary">unlabeled</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
							<div class="mt-2 flex flex-wrap gap-2 font-mono text-xs text-text-tertiary">
								<span>precision {pct(testCase.labeledPrecisionAtK)}</span>
								<span>required {pct(testCase.requiredRecall)}</span>
								<span>any-of {pct(testCase.anyOfRecall)}</span>
								<span>clean {pct(testCase.mustNotCleanRate)}</span>
							</div>
						</div>
					</article>
				{/each}
			</div>
		</section>
	</section>
</main>
