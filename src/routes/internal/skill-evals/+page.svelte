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
	let filter = $state<'attention' | 'all' | 'failing' | 'lowPrecision'>('attention');
	const attentionCases = $derived(
		data.cases.filter((testCase: EvalCase) => !testCase.pass || testCase.labeledPrecisionAtK < 0.5)
	);
	const visibleCases = $derived(
		data.cases.filter((testCase: EvalCase) => {
			if (filter === 'attention') return attentionCases.includes(testCase);
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

	function coreSkills(testCase: EvalCase) {
		return testCase.skills.filter((skill) => skill.tier === 'core').slice(0, 4);
	}

	function issueText(testCase: EvalCase) {
		if (!testCase.pass) {
			const issues = [
				testCase.missingRequired.length ? `missing ${testCase.missingRequired.join(', ')}` : '',
				testCase.missingAnyOf.length ? `missing one-of group` : '',
				testCase.unwanted.length ? `returned unwanted ${testCase.unwanted.join(', ')}` : ''
			].filter(Boolean);
			return issues.join('; ');
		}
		if (testCase.labeledPrecisionAtK < 0.5) return 'review low labeled precision';
		return 'looks healthy';
	}
</script>

<svelte:head>
	<title>Skill Recommendation Evals - Spawner</title>
</svelte:head>

<main class="min-h-screen bg-bg-primary text-text-primary">
	<section class="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-5 py-5">
		<header class="flex flex-wrap items-start justify-between gap-3 border-b border-surface-border pb-3">
			<div>
				<p class="font-mono text-xs uppercase text-accent-primary">Internal matcher audit</p>
				<h1 class="mt-1 text-2xl font-semibold text-text-bright">What should I look at?</h1>
				<p class="mt-1 max-w-3xl text-sm text-text-secondary">
					A quieter view of the Spawner UI + spark-skill-graphs recommendation tests.
				</p>
			</div>
			<div class="flex flex-wrap gap-2 text-xs font-mono">
				<span class={data.summary.passRate === 1 ? 'badge-success' : 'badge-warning'}>
					{data.summary.passCount}/{data.summary.caseCount} tests passing
				</span>
				<span class="border border-surface-border bg-bg-secondary px-2 py-1 text-text-secondary">
					{new Date(data.generatedAt).toLocaleString()}
				</span>
			</div>
		</header>

		<section class="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]" aria-label="Focus summary">
			<div class="panel p-4">
				<p class="font-mono text-xs uppercase text-text-tertiary">Verdict</p>
				<h2 class="mt-1 text-xl font-semibold text-text-bright">
					The matcher is passing the golden suite. Focus review on low-precision prompts, not broken recall.
				</h2>
				<p class="mt-2 text-sm text-text-secondary">
					Required recall, any-of recall, and must-not cleanliness are all at {pct(data.summary.averageRequiredRecall)}.
					The {pct(data.summary.averageLabeledPrecisionAtK)} precision number is conservative because useful supporting
					skills are counted as unlabeled unless they are in the hand-labeled expected set.
				</p>
				<div class="mt-4 grid gap-2 sm:grid-cols-4">
					<div>
						<p class="font-mono text-xs text-text-tertiary">Catalog</p>
						<p class="text-lg font-semibold">{data.project.catalogSkillCount} skills</p>
					</div>
					<div>
						<p class="font-mono text-xs text-text-tertiary">Tests</p>
						<p class="text-lg font-semibold">{data.project.evalCaseCount}</p>
					</div>
					<div>
						<p class="font-mono text-xs text-text-tertiary">Pairings</p>
						<p class="text-lg font-semibold">{data.project.returnedRecommendationCount}/{data.project.topKLimitSlots}</p>
					</div>
					<div>
						<p class="font-mono text-xs text-text-tertiary">Avg score</p>
						<p class="text-lg font-semibold">{decimal(data.summary.averageScore)}</p>
					</div>
				</div>
			</div>

			<div class="panel p-4">
				<p class="font-mono text-xs uppercase text-text-tertiary">Attention queue</p>
				<p class="mt-1 text-3xl font-semibold text-text-bright">{attentionCases.length}</p>
				<p class="mt-1 text-sm text-text-secondary">
					{data.summary.failures.length} failing, {data.summary.lowPrecisionCases.length} low labeled precision.
				</p>
				<div class="mt-4 grid grid-cols-3 gap-2 text-xs">
					<div class="border border-surface-border bg-bg-primary p-2">
						<p class="font-mono uppercase text-text-tertiary">core</p>
						<p class="mt-1 text-lg font-semibold">{data.summary.tierCounts.core}</p>
					</div>
					<div class="border border-surface-border bg-bg-primary p-2">
						<p class="font-mono uppercase text-text-tertiary">support</p>
						<p class="mt-1 text-lg font-semibold">{data.summary.tierCounts.supporting}</p>
					</div>
					<div class="border border-surface-border bg-bg-primary p-2">
						<p class="font-mono uppercase text-text-tertiary">related</p>
						<p class="mt-1 text-lg font-semibold">{data.summary.tierCounts.related}</p>
					</div>
				</div>
			</div>
		</section>

		<section class="panel overflow-hidden" aria-label="Recommendation eval cases">
			<div class="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-3 py-2">
				<div>
					<h2 class="text-sm font-semibold">Review list</h2>
					<p class="mt-0.5 text-xs text-text-tertiary">Open a row only when you want the full evidence.</p>
				</div>
				<div class="flex flex-wrap gap-1 text-xs">
					<button class={filter === 'attention' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onclick={() => filter = 'attention'}>Attention</button>
					<button class={filter === 'all' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onclick={() => filter = 'all'}>All</button>
					<button class={filter === 'failing' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onclick={() => filter = 'failing'}>Failing</button>
					<button class={filter === 'lowPrecision' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onclick={() => filter = 'lowPrecision'}>Low precision</button>
				</div>
			</div>

			<div class="divide-y divide-surface-border">
				{#each visibleCases as testCase}
					<details class="group px-3 py-3">
						<summary class="grid cursor-pointer list-none gap-3 md:grid-cols-[220px_1fr_160px] md:items-center">
							<div class="flex items-center gap-2">
								<span class={testCase.pass ? 'badge-success' : 'badge-error'}>{testCase.pass ? 'pass' : 'fail'}</span>
								<span class="font-semibold text-text-bright">{testCase.name}</span>
							</div>
							<div>
								<p class="line-clamp-1 text-sm text-text-secondary">{testCase.prompt}</p>
								<div class="mt-1 flex flex-wrap gap-1">
									{#each coreSkills(testCase) as skill}
										<span class={`border px-2 py-0.5 text-[11px] ${tierClass(skill.tier)}`}>{skill.id}</span>
									{/each}
								</div>
							</div>
							<div class="text-left md:text-right">
								<p class="font-mono text-xs text-text-tertiary">precision {pct(testCase.labeledPrecisionAtK)}</p>
								<p class="mt-0.5 text-xs text-text-secondary">{issueText(testCase)}</p>
							</div>
						</summary>

						<div class="mt-4 grid gap-4 xl:grid-cols-[360px_1fr]">
							<div class="space-y-3 text-sm">
								<div>
									<p class="font-mono text-xs uppercase text-text-tertiary">Project prompt</p>
									<p class="mt-1 text-text-secondary">{testCase.prompt}</p>
								</div>
								<div>
									<p class="font-mono text-xs uppercase text-text-tertiary">Expected labels</p>
									<div class="mt-1 flex flex-wrap gap-1 text-xs">
										{#each testCase.expected.labels as label}
											<span class="border border-surface-border bg-bg-primary px-2 py-0.5 text-text-secondary">{label}</span>
										{/each}
									</div>
								</div>
								<div class="grid grid-cols-4 gap-2 text-xs">
									<div>
										<p class="font-mono text-text-tertiary">score</p>
										<p class="font-semibold">{decimal(testCase.score)}</p>
									</div>
									<div>
										<p class="font-mono text-text-tertiary">required</p>
										<p class="font-semibold">{pct(testCase.requiredRecall)}</p>
									</div>
									<div>
										<p class="font-mono text-text-tertiary">any-of</p>
										<p class="font-semibold">{pct(testCase.anyOfRecall)}</p>
									</div>
									<div>
										<p class="font-mono text-text-tertiary">clean</p>
										<p class="font-semibold">{pct(testCase.mustNotCleanRate)}</p>
									</div>
								</div>
							</div>

							<div class="overflow-x-auto">
								<table class="w-full min-w-[700px] text-left text-xs">
									<thead class="bg-bg-secondary text-text-tertiary">
										<tr>
											<th class="px-2 py-2 font-mono">Paired skill</th>
											<th class="px-2 py-2 font-mono">Tier</th>
											<th class="px-2 py-2 text-right font-mono">Score</th>
											<th class="px-2 py-2 font-mono">Why</th>
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
												<td class="max-w-[260px] px-2 py-2 text-text-secondary">{skill.reason}</td>
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
							</div>
						</div>
					</details>
				{/each}
			</div>
		</section>

		<section class="panel p-3 text-sm text-text-secondary" aria-label="Test method">
			<p class="font-semibold text-text-bright">How to read this</p>
			<p class="mt-1">{data.scoring.passRule}</p>
			<p class="mt-1 text-xs text-text-tertiary">{data.scoring.precisionNote}</p>
		</section>
	</section>
</main>
