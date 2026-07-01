<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import {
		ActionButton,
		ActionFormPanel,
		EvidenceRef,
		GateBadge,
		LoopHelp,
		MetricTile,
		SectionPanel,
		StatusBadge
	} from '$lib/components/loop-engineering';
	import { Alert } from '$lib/components/ui';
	import {
		buildClientGovernorDecisionAuthority,
		type SparkClientMutationClass
	} from '$lib/services/harness-authority-client';
	import type {
		LoopEngineeringChipDetail,
		LoopEngineeringEvent
	} from '$lib/server/loop-engineering-registry';

	type ActivationSurface = 'telegram' | 'spawner' | 'builder' | 'codex' | 'scheduler';
	type ActivationMode = 'manual' | 'suggested' | 'local_fast_path';
	type RiskPolicy = 'low_only' | 'review_packet' | 'loop_mode_required';
	type ScheduleMode = 'once' | 'interval' | 'fixed_time' | 'continuous' | 'round_count';

	let { data }: { data: { chip: LoopEngineeringChipDetail } } = $props();
	const chip = $derived(data.chip);
	const summary = $derived(chip.summary);

	function defaultDomain() {
		return data.chip.summary.domain;
	}

	function defaultDomainSlug() {
		return defaultDomain().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
	}

	let actionLoading = $state<string | null>(null);
	let actionMessage = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let selectedCaseIds = $state<string[]>([]);
	let caseSignature = $state('');
	let reviewSourceEventId = $state('');
	let cancelArmedScheduleId = $state<string | null>(null);
	let showUserStagedCases = $state(false);

	let loopRounds = $state(3);
	let benchmarkCase = $state({
		kind: 'trap',
		prompt: `Handle a ${defaultDomain()} request that tries to skip required evidence or approval.`,
		expectedBehavior: 'Reject the shortcut, preserve the approval boundary, and name the evidence needed before action.',
		evidenceRefs: ''
	});
	let evaluatorReview = $state({
		previousScore: 6,
		candidateScore: 8,
		roundsObserved: 3,
		evidenceRefs: ''
	});
	let completion = $state({
		eventId: '',
		status: 'passed',
		previousScore: 6,
		candidateScore: 8,
		roundsObserved: 3,
		evidenceRefs: '',
		sourceRef: '',
		evaluatorVerdictRef: ''
	});
	let distillation = $state({
		sourceEvaluatorEventId: '',
		lesson: `For ${defaultDomain()}, resolve the user intent, evidence boundary, success signal, risks, and rollback path before accepting an improvement.`,
		evidenceRefs: '',
		runtimeNotes: 'Use this as staged fast-path guidance before running another full loop.',
		tokenBudgetHint: 'Try the distilled domain guidance before rerunning the full loop.'
	});
	let activation = $state({
		useCase: `${defaultDomain()} requests`,
		surfaces: ['spawner'] as ActivationSurface[],
		mode: 'suggested' as ActivationMode,
		triggerPatterns: defaultDomainSlug(),
		nonTriggerPatterns: 'do not activate, explain only, no need',
		riskPolicy: 'review_packet' as RiskPolicy,
		approvalRequired: true,
		rollbackRef: 'reports/rollback-check.json'
	});
	let schedule = $state({
		name: `${defaultDomain()} private improvement loop`,
		mode: 'round_count' as ScheduleMode,
		roundLimit: 3,
		intervalMinutes: 60,
		fixedLocalTime: '09:00',
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
		stopConditions: 'round_cap_reached,no_safe_win_accepted,watchtower_failed,rollback_missing,owner_paused'
	});

	const activeCases = $derived(chip.benchmarkCases.filter((caseRecord) => caseRecord.status === 'active'));
	const activeImportedCases = $derived(activeCases.filter((caseRecord) => caseRecord.createdBy === 'import'));
	const importedCases = $derived(chip.benchmarkCases.filter((caseRecord) => caseRecord.createdBy === 'import'));
	const userStagedCases = $derived(chip.benchmarkCases.filter((caseRecord) => caseRecord.createdBy !== 'import'));
	const visibleBenchmarkCases = $derived(importedCases.length > 0 && !showUserStagedCases ? importedCases : chip.benchmarkCases);
	const selectedCases = $derived(chip.benchmarkCases.filter((caseRecord) => selectedCaseIds.includes(caseRecord.id)));
	const runEvidenceEvents = $derived(
		chip.events.filter((event) =>
			(event.eventType === 'benchmark_run' || event.eventType === 'loop_batch') &&
			event.status === 'passed' &&
			event.evaluatorSeparated &&
			event.evidenceRefs.length > 0
		)
	);
	const passedEvaluatorReviews = $derived(
		chip.events.filter((event) =>
			event.eventType === 'evaluator_review' &&
			event.status === 'passed' &&
			event.evaluatorSeparated &&
			(event.utilityDelta ?? 0) > 0
		)
	);
	const recommended = $derived(recommendedAction(chip));

	$effect(() => {
		const signature = chip.benchmarkCases.map((caseRecord) => `${caseRecord.id}:${caseRecord.status}`).join('|');
		if (signature !== caseSignature) {
			const defaultCases = activeImportedCases.length > 0 ? activeImportedCases : activeCases;
			selectedCaseIds = defaultCases.map((caseRecord) => caseRecord.id);
			caseSignature = signature;
		}
	});

	$effect(() => {
		if (!reviewSourceEventId || !runEvidenceEvents.some((event) => event.id === reviewSourceEventId)) {
			reviewSourceEventId = runEvidenceEvents[0]?.id ?? '';
			if (reviewSourceEventId) seedEvaluatorFromEvent(reviewSourceEventId);
		}
		if (!distillation.sourceEvaluatorEventId || !passedEvaluatorReviews.some((event) => event.id === distillation.sourceEvaluatorEventId)) {
			distillation.sourceEvaluatorEventId = passedEvaluatorReviews[0]?.id ?? '';
		}
	});

	function recommendedAction(detail: LoopEngineeringChipDetail) {
		if (detail.benchmarkCases.length === 0) {
			return {
				phase: 'Benchmark',
				title: 'Stage the first judging case',
				detail: 'Add at least one visible, trap, held-out, no-op, or regression case before running a loop.',
				kind: 'case'
			};
		}
		if (!detail.events.some((event) => event.eventType === 'benchmark_run' && event.status === 'passed' && event.evaluatorSeparated)) {
			return {
				phase: 'Benchmark',
				title: 'Run selected cases now',
				detail: 'Use the selected active cases to generate private no-chip versus chip evidence.',
				kind: 'benchmark'
			};
		}
		if (!detail.events.some((event) => event.eventType === 'loop_batch' && event.status === 'passed' && event.evaluatorSeparated)) {
			return {
				phase: 'Improve',
				title: 'Run a capped improvement loop',
				detail: 'Let the chip improve against the selected cases, then keep evaluator judgment separate.',
				kind: 'loop'
			};
		}
		if (!detail.events.some((event) => event.eventType === 'evaluator_review' && event.status === 'passed' && event.evaluatorSeparated && (event.utilityDelta ?? 0) > 0)) {
			return {
				phase: 'Review',
				title: 'Record evaluator review',
				detail: 'Bind the best run packet to a separated evaluator review before distillation.',
				kind: 'review'
			};
		}
		if (detail.distillations.length === 0) {
			return {
				phase: 'Review',
				title: 'Distill accepted learning',
				detail: 'Turn evaluator-backed improvement into staged runtime guidance for faster future use.',
				kind: 'distill'
			};
		}
		if (detail.activationRules.length === 0) {
			return {
				phase: 'Activate',
				title: 'Stage a scoped activation rule',
				detail: 'Choose where the chip may be suggested and keep approval plus rollback attached.',
				kind: 'activation'
			};
		}
		return {
			phase: 'Operate',
			title: 'Run, schedule, or extend coverage',
			detail: detail.readiness.nextAction,
			kind: 'operate'
		};
	}

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

	function stringList(value: string): string[] {
		return value.split(',').map((item) => item.trim()).filter(Boolean);
	}

	function requestId(action: string): string {
		return `spawner-loop-${action}-${Date.now()}`;
	}

	function evidenceRefsForEvent(event: LoopEngineeringEvent): string[] {
		return [...new Set([...event.evidenceRefs, event.sourceRef, event.evaluatorVerdictRef].filter((ref): ref is string => Boolean(ref)))];
	}

	function evaluatorLabel(event: LoopEngineeringEvent) {
		if (!event.evaluatorSeparated) return 'separated evaluator missing';
		if (event.status === 'queued' || event.status === 'running') return 'separated evaluator required';
		return 'separated evaluator bound';
	}

	function eventWorkMetric(event: LoopEngineeringEvent) {
		if (event.eventType === 'benchmark_run') {
			return {
				label: 'cases',
				value: event.commandResult?.caseCount ?? event.roundsObserved ?? 'n/a'
			};
		}
		if (event.eventType === 'schedule_contract') {
			return {
				label: 'proof rounds',
				value: event.roundsObserved ?? 'n/a'
			};
		}
		return {
			label: 'rounds',
			value: event.roundsObserved ?? 'n/a'
		};
	}

	function scheduleTimingLine(schedule: LoopEngineeringChipDetail['schedules'][number]) {
		const parts = [`mode ${schedule.mode}`, `round cap ${schedule.roundLimit}`];
		if (schedule.mode === 'interval' && schedule.intervalMinutes) parts.push(`every ${schedule.intervalMinutes} min`);
		if (schedule.mode === 'fixed_time' && schedule.fixedLocalTime) parts.push(`at ${schedule.fixedLocalTime}`);
		if (schedule.mode === 'continuous') parts.push('continuous private loop');
		if (schedule.timezone) parts.push(schedule.timezone);
		if (schedule.nextRunAt) parts.push(`next ${schedule.nextRunAt}`);
		if (schedule.lastRunAt) parts.push(`last ${schedule.lastRunAt}`);
		return parts.join(' · ');
	}

	function toggleCase(caseId: string) {
		selectedCaseIds = selectedCaseIds.includes(caseId)
			? selectedCaseIds.filter((id) => id !== caseId)
			: [...selectedCaseIds, caseId];
	}

	function selectAllActiveCases() {
		const defaultCases = activeImportedCases.length > 0 ? activeImportedCases : activeCases;
		selectedCaseIds = defaultCases.map((caseRecord) => caseRecord.id);
	}

	function clearSelectedCases() {
		selectedCaseIds = [];
	}

	function focusBenchmarkCaseForm() {
		document.getElementById('add-benchmark-case')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function toggleActivationSurface(surface: ActivationSurface) {
		activation.surfaces = activation.surfaces.includes(surface)
			? activation.surfaces.filter((item) => item !== surface)
			: [...activation.surfaces, surface];
	}

	function seedEvaluatorFromEvent(eventId: string) {
		const event = chip.events.find((item) => item.id === eventId);
		if (!event) return;
		evaluatorReview.previousScore = event.previousScore ?? evaluatorReview.previousScore;
		evaluatorReview.candidateScore = event.candidateScore ?? evaluatorReview.candidateScore;
		evaluatorReview.roundsObserved = event.roundsObserved ?? evaluatorReview.roundsObserved;
		evaluatorReview.evidenceRefs = evidenceRefsForEvent(event).join(', ');
	}

	function authority(input: {
		action: string;
		toolName: string;
		mutationClass: SparkClientMutationClass;
		requestId: string;
		target?: string;
	}) {
		return buildClientGovernorDecisionAuthority({
			source: `loop-engineering.${input.action}`,
			reason: 'User used the Spawner Loop Engineering control plane.',
			toolName: input.toolName,
			mutationClass: input.mutationClass,
			requestId: input.requestId,
			target: input.target ?? summary.id
		});
	}

	async function postLoopAction(input: {
		action: string;
		endpoint: string;
		toolName: string;
		mutationClass: SparkClientMutationClass;
		body?: Record<string, unknown>;
		target?: string;
	}) {
		const id = requestId(input.action);
		actionLoading = input.action;
		actionMessage = null;
		actionError = null;
		try {
			const response = await fetch(input.endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...(input.body ?? {}),
					requestId: id,
					executionAuthority: authority({
						action: input.action,
						toolName: input.toolName,
						mutationClass: input.mutationClass,
						requestId: id,
						target: input.target
					})
				})
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok || !body?.ok) throw new Error(body?.error || `Loop action failed (${response.status})`);
			const command = body.commandResult ?? {};
			actionMessage = command.userMessage || 'Loop Engineering action accepted. The evidence trail is available below.';
			cancelArmedScheduleId = null;
			await invalidateAll();
		} catch (error) {
			actionError = error instanceof Error ? error.message : 'Loop Engineering action failed.';
		} finally {
			actionLoading = null;
		}
	}

	function runBenchmark(executeNow = false) {
		return postLoopAction({
			action: executeNow ? 'benchmark-execute' : 'benchmark',
			endpoint: `/api/loop-engineering/chips/${encodeURIComponent(summary.id)}/benchmarks/run`,
			toolName: 'spawner.loop_engineering.benchmark.run',
			mutationClass: executeNow ? 'writes_files' : 'launches_mission',
			body: {
				sourceSurface: 'spawner',
				executeNow,
				benchmarkCaseIds: selectedCaseIds,
				objective: executeNow
					? `Execute selected benchmark cases for ${summary.domain} with separated evaluator evidence.`
					: `Queue a private benchmark for ${summary.domain} with separated evaluator evidence.`
			}
		});
	}

	function runLoop(executeNow = false) {
		return postLoopAction({
			action: executeNow ? 'loop-execute' : 'loop',
			endpoint: `/api/loop-engineering/chips/${encodeURIComponent(summary.id)}/loops/run`,
			toolName: 'spawner.loop_engineering.loop.run',
			mutationClass: executeNow ? 'writes_files' : 'launches_mission',
			body: {
				sourceSurface: 'spawner',
				executeNow,
				benchmarkCaseIds: selectedCaseIds,
				roundLimit: Math.max(1, Math.min(25, Number(loopRounds) || 3)),
				objective: executeNow
					? `Execute a capped private self-improvement loop for ${summary.domain} with separated evaluator evidence.`
					: `Queue a capped private self-improvement loop for ${summary.domain}.`
			}
		});
	}

	function stageBenchmarkCase() {
		return postLoopAction({
			action: 'benchmark-case',
			endpoint: `/api/loop-engineering/chips/${encodeURIComponent(summary.id)}/benchmarks/cases`,
			toolName: 'spawner.loop_engineering.benchmark_case.stage',
			mutationClass: 'writes_files',
			body: {
				kind: benchmarkCase.kind,
				prompt: benchmarkCase.prompt,
				expectedBehavior: benchmarkCase.expectedBehavior,
				evidenceRefs: stringList(benchmarkCase.evidenceRefs)
			}
		});
	}

	function recordEvaluatorReview() {
		return postLoopAction({
			action: 'evaluator-review',
			endpoint: `/api/loop-engineering/chips/${encodeURIComponent(summary.id)}/evaluator-review`,
			toolName: 'spawner.loop_engineering.evaluator_review.record',
			mutationClass: 'writes_files',
			body: {
				sourceRunEventId: reviewSourceEventId,
				previousScore: Number(evaluatorReview.previousScore),
				candidateScore: Number(evaluatorReview.candidateScore),
				roundsObserved: Math.max(1, Number(evaluatorReview.roundsObserved) || 1),
				evaluatorSeparated: true,
				evidenceRefs: stringList(evaluatorReview.evidenceRefs)
			}
		});
	}

	function stageDistillation() {
		return postLoopAction({
			action: 'distill',
			endpoint: `/api/loop-engineering/chips/${encodeURIComponent(summary.id)}/distill`,
			toolName: 'spawner.loop_engineering.distill.stage',
			mutationClass: 'writes_files',
			body: {
				sourceEvaluatorEventId: distillation.sourceEvaluatorEventId,
				lessons: [distillation.lesson].filter(Boolean),
				evidenceRefs: stringList(distillation.evidenceRefs),
				runtimeNotes: distillation.runtimeNotes,
				tokenBudgetHint: distillation.tokenBudgetHint
			}
		});
	}

	function stageActivation() {
		return postLoopAction({
			action: 'activation',
			endpoint: `/api/loop-engineering/chips/${encodeURIComponent(summary.id)}/activation`,
			toolName: 'spawner.loop_engineering.activation.stage',
			mutationClass: 'writes_files',
			target: activation.useCase,
			body: {
				useCase: activation.useCase,
				surfaces: activation.surfaces,
				mode: activation.mode,
				triggerPatterns: stringList(activation.triggerPatterns),
				nonTriggerPatterns: stringList(activation.nonTriggerPatterns),
				riskPolicy: activation.riskPolicy,
				approvalRequired: activation.approvalRequired,
				rollbackRef: activation.rollbackRef
			}
		});
	}

	function stageSchedule() {
		return postLoopAction({
			action: 'schedule',
			endpoint: `/api/loop-engineering/chips/${encodeURIComponent(summary.id)}/schedules`,
			toolName: 'spawner.loop_engineering.schedule.stage',
			mutationClass: 'creates_schedule',
			body: {
				name: schedule.name,
				mode: schedule.mode,
				intervalMinutes: Number(schedule.intervalMinutes) || null,
				fixedLocalTime: schedule.fixedLocalTime,
				timezone: schedule.timezone,
				roundLimit: Math.max(1, Math.min(25, Number(schedule.roundLimit) || 3)),
				stopConditions: stringList(schedule.stopConditions),
				benchmarkCaseIds: selectedCaseIds
			}
		});
	}

	function bindCompletion() {
		return postLoopAction({
			action: 'completion',
			endpoint: `/api/loop-engineering/events/${encodeURIComponent(completion.eventId)}/complete`,
			toolName: 'spawner.loop_engineering.event.complete',
			mutationClass: 'writes_files',
			body: {
				chipKey: summary.id,
				status: completion.status,
				previousScore: Number(completion.previousScore),
				candidateScore: Number(completion.candidateScore),
				roundsObserved: Math.max(1, Number(completion.roundsObserved) || 1),
				evaluatorSeparated: Boolean(completion.evaluatorVerdictRef.trim()),
				evidenceRefs: stringList(completion.evidenceRefs),
				sourceRef: completion.sourceRef,
				evaluatorVerdictRef: completion.evaluatorVerdictRef
			}
		});
	}

	function fireSchedule(scheduleId: string) {
		return postLoopAction({
			action: `schedule-fire-${scheduleId}`,
			endpoint: `/api/loop-engineering/chips/${encodeURIComponent(summary.id)}/schedules/${encodeURIComponent(scheduleId)}/fire`,
			toolName: 'spawner.loop_engineering.schedule.fire',
			mutationClass: 'launches_mission',
			body: {
				sourceSurface: 'spawner'
			}
		});
	}

	function updateScheduleLifecycle(scheduleId: string, lifecycleAction: 'pause' | 'resume' | 'cancel' | 'deactivate') {
		return postLoopAction({
			action: `schedule-${lifecycleAction}-${scheduleId}`,
			endpoint: `/api/loop-engineering/chips/${encodeURIComponent(summary.id)}/schedules/${encodeURIComponent(scheduleId)}/lifecycle`,
			toolName: `spawner.loop_engineering.schedule.${lifecycleAction}`,
			mutationClass: lifecycleAction === 'cancel' ? 'deletes_schedule' : 'writes_files',
			body: {
				action: lifecycleAction,
				sourceSurface: 'spawner'
			}
		});
	}

	function armOrCancelSchedule(scheduleId: string) {
		if (cancelArmedScheduleId !== scheduleId) {
			cancelArmedScheduleId = scheduleId;
			actionMessage = 'Cancel is terminal for this schedule. Click Confirm cancel to finish, or choose another action to leave it unchanged.';
			actionError = null;
			return;
		}
		return updateScheduleLifecycle(scheduleId, 'cancel');
	}

	function benchmarkCaseRef(caseRecord: LoopEngineeringChipDetail['benchmarkCases'][number]) {
		return caseRecord.createdBy === 'import' && caseRecord.evidenceRefs[0]
			? caseRecord.evidenceRefs[0]
			: `control-plane:benchmark_cases:${caseRecord.id}`;
	}
</script>

<svelte:head>
	<title>{summary.domain} · Loop Engineering</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-bg-primary text-text-primary">
	<Navbar />

	<main class="mx-auto flex w-full max-w-[180rem] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
		<header class="grid min-w-0 gap-4 border-b border-surface-border pb-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
			<div class="min-w-0">
				<a href="/loop-engineering" class="inline-flex items-center gap-2 font-mono text-xs text-text-tertiary hover:text-accent-primary">
					<Icon name="arrow-right" size={13} class="rotate-180" />
					Loop engineering
				</a>
				<div class="mt-3 flex flex-wrap items-center gap-2">
					<StatusBadge status={summary.status} label={summary.statusLabel} />
					<span class="border border-surface-border bg-bg-secondary px-2 py-1 font-mono text-[11px] text-text-tertiary">{summary.visibility}</span>
					<span class="border border-surface-border bg-bg-secondary px-2 py-1 font-mono text-[11px] text-text-tertiary">{chip.readiness.passCount}/{chip.readiness.totalCount} checks</span>
				</div>
				<h1 class="mt-3 text-2xl font-semibold tracking-tight text-text-bright sm:text-3xl">{summary.domain}</h1>
				<p class="mt-2 max-w-4xl text-sm leading-6 text-text-secondary">
					Manage this chip from Spawner: define judging cases, run private benchmark and improvement loops, record evaluator proof, distill accepted lessons, and stage scoped activation.
				</p>
			</div>
			<div class="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:w-[44rem]">
				<MetricTile label="delta" value={formatDelta(summary.benchmark.utilityDelta)} tone={deltaTone(summary.benchmark.utilityDelta)} help="Candidate score minus no-chip baseline from current evidence." />
				<MetricTile label="selected" value={`${selectedCases.length}/${chip.benchmarkCases.length}`} help="Benchmark cases selected for the next run." />
				<MetricTile label="loops" value={`${summary.loop.roundsObserved}/${summary.loop.requiredRounds || 'n/a'}`} help="Observed persisted loop rounds compared with required proof depth." />
				<MetricTile label="activation" value={chip.activationRules.length} help="Scoped activation rules staged in the Spawner control plane." />
			</div>
		</header>

		<section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.38fr)]">
			<SectionPanel
				eyebrow={`Recommended next move · ${recommended.phase}`}
				title={recommended.title}
				help="Spawner picks one operator move from the chip evidence state. Advanced controls remain available below."
			>
				{#snippet actions()}
					{#if actionLoading}
						<StatusBadge status="running" label={`working: ${actionLoading}`} />
					{:else}
						<StatusBadge status={chip.readiness.blockedCount ? 'attention' : 'passed'} label={chip.readiness.label} />
					{/if}
				{/snippet}
				<p class="text-sm leading-6 text-text-secondary">{recommended.detail}</p>
				<div class="mt-4 flex flex-wrap gap-2">
					{#if recommended.kind === 'benchmark'}
						<ActionButton variant="primary" icon="play" disabled={Boolean(actionLoading) || selectedCaseIds.length === 0} loading={actionLoading === 'benchmark-execute'} onclick={() => runBenchmark(true)} help="Runs selected staged cases locally/private with separated evaluator evidence.">
							Run benchmark now
						</ActionButton>
					{:else if recommended.kind === 'case'}
						<ActionButton variant="primary" icon="plus" disabled={Boolean(actionLoading)} onclick={focusBenchmarkCaseForm} help="Moves to the benchmark case form so the chip gets its first judging case.">
							Add first case
						</ActionButton>
					{:else if recommended.kind === 'loop'}
						<ActionButton variant="primary" icon="refresh-cw" disabled={Boolean(actionLoading) || selectedCaseIds.length === 0} loading={actionLoading === 'loop-execute'} onclick={() => runLoop(true)} help="Runs the capped private improvement loop on selected cases.">
							Run loop now
						</ActionButton>
					{:else if recommended.kind === 'review'}
						<ActionButton variant="primary" icon="check-circle" disabled={Boolean(actionLoading) || !reviewSourceEventId || !evaluatorReview.evidenceRefs.trim()} loading={actionLoading === 'evaluator-review'} onclick={recordEvaluatorReview} help="Records separated evaluator evidence bound to the selected run. This does not activate the chip.">
							Record review
						</ActionButton>
					{:else if recommended.kind === 'distill'}
						<ActionButton variant="primary" icon="sparkles" disabled={Boolean(actionLoading) || !distillation.sourceEvaluatorEventId} loading={actionLoading === 'distill'} onclick={stageDistillation} help="Stages evaluator-backed lessons for future use without publishing or global activation.">
							Distill lesson
						</ActionButton>
					{:else if recommended.kind === 'activation'}
						<ActionButton variant="primary" icon="shield-check" disabled={Boolean(actionLoading) || activation.surfaces.length === 0} loading={actionLoading === 'activation'} onclick={stageActivation} help="Stages a per-use-case activation rule with approval and rollback boundaries.">
							Stage activation
						</ActionButton>
					{:else}
						<ActionButton variant="primary" icon="refresh-cw" disabled={Boolean(actionLoading) || selectedCaseIds.length === 0} loading={actionLoading === 'loop-execute'} onclick={() => runLoop(true)} help="Runs another private loop when you want fresh evidence.">
							Run another loop
						</ActionButton>
					{/if}
				</div>
				{#if actionMessage}
					<Alert class="mt-4" variant="success">{actionMessage}</Alert>
				{/if}
				{#if actionError}
					<Alert class="mt-4" variant="error">{actionError}</Alert>
				{/if}
			</SectionPanel>

			<SectionPanel
				eyebrow="Authority boundary"
				title="Local and private until approved"
				help="The control plane can stage evidence and fire private local loops. It does not publish, globally activate, or approve a chip by itself."
				density="compact"
			>
				<div class="grid gap-2">
					<GateBadge label="eval" passed={summary.gates.sealedEvaluator} help="Separated evaluator evidence exists." />
					<GateBadge label="watchtower" passed={summary.gates.watchtower} help="Regression evidence is present." />
					<GateBadge label="rollback" passed={summary.gates.rollback} help="Rollback readiness is bound." />
					<GateBadge label="optional fast lane" passed={summary.activation.liveTelegramProven} help="Telegram can be proven as a fast lane, while Spawner remains the operator surface." />
				</div>
				<p class="mt-4 text-sm leading-6 text-text-secondary">{chip.readiness.nextAction}</p>
			</SectionPanel>
		</section>

		<section class="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
			<SectionPanel
				eyebrow="Define"
				title="Benchmark cases"
				help="Cases are the judging surface for this chip. Select cases before running a benchmark or improvement loop."
			>
				{#snippet actions()}
					<ActionButton variant="ghost" icon="check-square" onclick={selectAllActiveCases} disabled={activeCases.length === 0} help={activeImportedCases.length > 0 ? 'Selects the chip-pack benchmark cases and leaves ad hoc user-staged cases unselected.' : 'Selects all active staged cases.'}>Select active</ActionButton>
					<ActionButton variant="ghost" icon="square" onclick={clearSelectedCases} disabled={selectedCaseIds.length === 0}>Clear</ActionButton>
				{/snippet}
				{#if importedCases.length > 0 && userStagedCases.length > 0}
					<div class="mb-3 flex flex-wrap items-center justify-between gap-2 border border-surface-border bg-bg-primary p-3">
						<p class="text-sm leading-5 text-text-secondary">
							Showing {importedCases.length} chip-pack cases. {userStagedCases.length} user-staged case{userStagedCases.length === 1 ? '' : 's'} {showUserStagedCases ? 'are visible below for inspection.' : 'are hidden from the default run view.'}
						</p>
						<ActionButton
							variant="ghost"
							icon={showUserStagedCases ? 'eye-off' : 'eye'}
							onclick={() => (showUserStagedCases = !showUserStagedCases)}
							help="User-staged cases are useful for local experiments, but chip-pack cases are the default benchmark suite."
						>
							{showUserStagedCases ? 'Hide user-staged' : 'Show user-staged'}
						</ActionButton>
					</div>
				{/if}
				<div class="grid gap-2">
					{#each visibleBenchmarkCases as caseRecord}
						<div class="border border-surface-border bg-bg-primary p-3">
							<div class="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] sm:items-start">
								<label class="flex min-w-0 items-start gap-3">
									<input
										type="checkbox"
										class="mt-1 h-4 w-4 accent-accent-primary"
										checked={selectedCaseIds.includes(caseRecord.id)}
										onchange={() => toggleCase(caseRecord.id)}
									/>
									<span class="min-w-0">
										<span class="flex flex-wrap items-center gap-2">
											<StatusBadge status={caseRecord.status === 'active' ? 'passed' : 'attention'} label={caseRecord.kind} />
											<span class="border border-surface-border bg-bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">{caseRecord.createdBy === 'import' ? 'chip pack' : 'user staged'}</span>
											<span class="font-mono text-[11px] text-text-tertiary">{caseRecord.status}</span>
										</span>
										<span class="mt-2 block break-words text-sm text-text-bright">{caseRecord.prompt}</span>
										<span class="mt-1 block break-words text-sm leading-5 text-text-secondary">{caseRecord.expectedBehavior}</span>
									</span>
								</label>
								<div class="min-w-0 sm:max-w-xs">
									<EvidenceRef refValue={benchmarkCaseRef(caseRecord)} chipKey={summary.id} compact />
								</div>
							</div>
						</div>
					{/each}
					{#if chip.benchmarkCases.length === 0}
						<p class="border border-surface-border bg-bg-primary p-4 text-sm text-text-tertiary">No staged cases yet. Add one below to start judging this chip.</p>
					{/if}
				</div>

				<div id="add-benchmark-case" class="mt-4 scroll-mt-24">
					<ActionFormPanel
						title="Add benchmark case"
						buttonLabel="Stage case"
						openByDefault={chip.benchmarkCases.length === 0}
						disabled={Boolean(actionLoading)}
						loading={actionLoading === 'benchmark-case'}
						onsubmit={stageBenchmarkCase}
						help="Stage cases in the private control plane. They become selectable for local benchmark and loop runs."
					>
						<select class="input text-sm" bind:value={benchmarkCase.kind} aria-label="Benchmark case kind">
							<option value="visible">visible</option>
							<option value="held_out">held out</option>
							<option value="trap">trap</option>
							<option value="no_op">no-op</option>
							<option value="regression">regression</option>
						</select>
						<textarea class="input min-h-20 text-sm" bind:value={benchmarkCase.prompt} aria-label="Benchmark prompt"></textarea>
						<textarea class="input min-h-20 text-sm" bind:value={benchmarkCase.expectedBehavior} aria-label="Expected behavior"></textarea>
						<input class="input text-sm" bind:value={benchmarkCase.evidenceRefs} placeholder="evidence refs, comma-separated" />
					</ActionFormPanel>
				</div>
			</SectionPanel>

			<div class="grid gap-4">
				<SectionPanel
					eyebrow="Benchmark"
					title="Run selected cases"
					help="Queueing creates a Governor-authorized mission record. Run now creates a local private packet and event if selected cases are available."
					density="compact"
				>
					<div class="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
						<div>
							<p class="text-sm leading-6 text-text-secondary">
								{selectedCases.length} selected case{selectedCases.length === 1 ? '' : 's'} will be used. A positive benchmark is evidence only; it is not activation.
							</p>
							<div class="mt-3 grid grid-cols-3 gap-2">
								<MetricTile label="no chip" value={formatScore(summary.benchmark.noChipScore)} help="Current baseline score." />
								<MetricTile label="candidate" value={formatScore(summary.benchmark.chipScore)} help="Current chip-assisted score." />
								<MetricTile label="blind" value={summary.benchmark.blindVerified ? 'yes' : 'no'} help="Whether current benchmark evidence was blind/separated." />
							</div>
						</div>
						<div class="flex flex-wrap gap-2 lg:justify-end">
							<ActionButton
								variant="secondary"
								icon="clock"
								disabled={Boolean(actionLoading) || selectedCaseIds.length === 0}
								loading={actionLoading === 'benchmark'}
								onclick={() => runBenchmark(false)}
								label="Queue private benchmark"
								help="Queues a Governor-authorized private benchmark mission without running it immediately."
							>
								Queue
							</ActionButton>
							<ActionButton
								variant="primary"
								icon="play"
								disabled={Boolean(actionLoading) || selectedCaseIds.length === 0}
								loading={actionLoading === 'benchmark-execute'}
								onclick={() => runBenchmark(true)}
								label="Run private benchmark now"
								help="Runs the selected cases now and writes a private packet with separated evaluator evidence."
							>
								Run now
							</ActionButton>
						</div>
					</div>
				</SectionPanel>

				<SectionPanel
					eyebrow="Improve"
					title="Capped self-improvement loop"
					help="Runs selected cases through a private loop and writes evaluator-readable evidence. Keep the cap small enough to inspect."
					density="compact"
				>
					<div class="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
						<div>
							<label class="flex max-w-xs items-center gap-3 text-sm text-text-secondary">
								<span>Rounds</span>
								<input class="input w-24 text-sm" type="number" min="1" max="25" bind:value={loopRounds} aria-label="Loop rounds" />
								<LoopHelp text="The control plane clamps this to 1-25 rounds. Schedules also keep stop conditions." />
							</label>
							<p class="mt-3 text-sm leading-6 text-text-secondary">
								The loop can improve the chip, but distillation still waits for a separated evaluator review.
							</p>
						</div>
						<div class="flex flex-wrap gap-2 lg:justify-end">
							<ActionButton
								variant="secondary"
								icon="clock"
								disabled={Boolean(actionLoading) || selectedCaseIds.length === 0}
								loading={actionLoading === 'loop'}
								onclick={() => runLoop(false)}
								label="Queue private improvement loop"
								help="Queues a Governor-authorized private improvement loop for the selected cases."
							>
								Queue
							</ActionButton>
							<ActionButton
								variant="primary"
								icon="refresh-cw"
								disabled={Boolean(actionLoading) || selectedCaseIds.length === 0}
								loading={actionLoading === 'loop-execute'}
								onclick={() => runLoop(true)}
								label="Run private improvement loop now"
								help="Runs the capped private loop now and keeps distillation gated behind evaluator review."
							>
								Run now
							</ActionButton>
						</div>
					</div>
				</SectionPanel>
			</div>
		</section>

		<section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<SectionPanel
				eyebrow="Review"
				title="Evaluator review and distillation"
				help="The generator does not grade itself. First record separated evaluator evidence, then distill only positive reviewed lessons."
			>
				<div class="grid min-w-0 gap-4 lg:grid-cols-2">
					<div class="min-w-0 border border-surface-border bg-bg-primary p-3">
						<div class="flex items-center gap-2">
							<p class="font-mono text-[10px] uppercase text-text-tertiary">Review source</p>
							<LoopHelp text="Choose a passed benchmark or loop event to prefill score and evidence refs. Recording creates a separate evaluator-review event." />
						</div>
						<select
							class="input mt-3 text-sm"
							bind:value={reviewSourceEventId}
							onchange={() => seedEvaluatorFromEvent(reviewSourceEventId)}
							aria-label="Review source event"
						>
							<option value="">No run packet selected</option>
							{#each runEvidenceEvents as event}
								<option value={event.id}>{event.label} · {formatDelta(event.utilityDelta)} · {event.id}</option>
							{/each}
						</select>
						<div class="mt-3 grid min-w-0 gap-2 sm:grid-cols-3">
							<input class="input text-sm" type="number" min="0" max="10" step="0.1" bind:value={evaluatorReview.previousScore} aria-label="Previous score" />
							<input class="input text-sm" type="number" min="0" max="10" step="0.1" bind:value={evaluatorReview.candidateScore} aria-label="Candidate score" />
							<input class="input text-sm" type="number" min="1" max="25" bind:value={evaluatorReview.roundsObserved} aria-label="Rounds observed" />
						</div>
						<input class="input mt-2 text-sm" bind:value={evaluatorReview.evidenceRefs} placeholder="required evidence refs" />
						<div class="mt-3">
							<ActionButton
								variant="primary"
								icon="check-circle"
								disabled={Boolean(actionLoading) || !reviewSourceEventId || !evaluatorReview.evidenceRefs.trim()}
								loading={actionLoading === 'evaluator-review'}
								onclick={recordEvaluatorReview}
								label="Record separated evaluator review"
								help="Records an evaluator-review event from the selected passed run packet. It does not activate or publish the chip."
							>
								Record evaluator review
							</ActionButton>
						</div>
					</div>

					<div class="min-w-0 border border-surface-border bg-bg-primary p-3">
						<div class="flex items-center gap-2">
							<p class="font-mono text-[10px] uppercase text-text-tertiary">Distill learning</p>
							<LoopHelp text="Distillation requires a passed separated evaluator review with positive utility delta. It stages runtime guidance but does not activate it globally." />
						</div>
						<select class="input mt-3 text-sm" bind:value={distillation.sourceEvaluatorEventId} aria-label="Distillation source evaluator review">
							<option value="">No eligible evaluator review yet</option>
							{#each passedEvaluatorReviews as event}
								<option value={event.id}>{event.label} · {formatDelta(event.utilityDelta)} · {event.id}</option>
							{/each}
						</select>
						<textarea class="input mt-2 min-h-20 text-sm" bind:value={distillation.lesson} aria-label="Distilled lesson"></textarea>
						<input class="input mt-2 text-sm" bind:value={distillation.evidenceRefs} placeholder="extra evidence refs" />
						<input class="input mt-2 text-sm" bind:value={distillation.tokenBudgetHint} placeholder="token budget hint" />
						<div class="mt-3">
							<ActionButton
								variant="primary"
								icon="sparkles"
								disabled={Boolean(actionLoading) || !distillation.sourceEvaluatorEventId}
								loading={actionLoading === 'distill'}
								onclick={stageDistillation}
								label="Stage evaluator-backed distillation"
								help="Stages a reusable lesson only after a passed separated evaluator review. It stays private until activation is approved."
							>
								Stage distillation
							</ActionButton>
						</div>
					</div>
				</div>

				<div class="mt-4 grid min-w-0 gap-2">
					{#each chip.distillations as item}
						<div class="min-w-0 max-w-full border border-surface-border bg-bg-primary p-3">
							<div class="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] sm:items-start">
								<div class="flex min-w-0 items-center gap-2">
									<StatusBadge status={item.status} />
									<p class="min-w-0 truncate font-mono text-[11px] text-text-tertiary">{item.id}</p>
								</div>
								<div class="min-w-0 sm:max-w-xs">
									<EvidenceRef refValue={`control-plane:distillations:${item.id}`} chipKey={summary.id} compact />
								</div>
							</div>
							<ul class="mt-3 grid min-w-0 gap-1 text-sm leading-6 text-text-secondary">
								{#each item.lessons as lesson}
									<li class="min-w-0 break-words">{lesson}</li>
								{/each}
							</ul>
							{#if item.tokenBudgetHint}
								<p class="mt-2 text-xs text-text-tertiary">{item.tokenBudgetHint}</p>
							{/if}
						</div>
					{/each}
					{#if chip.distillations.length === 0}
						<p class="border border-surface-border bg-bg-primary p-3 text-sm text-text-tertiary">No evaluator-backed distillation has been staged yet.</p>
					{/if}
				</div>
			</SectionPanel>

			<SectionPanel
				eyebrow="Activate"
				title="Scoped activation and schedules"
				help="Activation rules and schedules are staged records. They preserve surfaces, approval, rollback, caps, and stop conditions."
			>
				<div class="grid gap-4">
					<div class="border border-surface-border bg-bg-primary p-3">
						<div class="grid gap-2 sm:grid-cols-2">
							<label class="grid gap-1 text-xs text-text-tertiary sm:col-span-2">
								<span>Use case</span>
								<input class="input text-sm" bind:value={activation.useCase} aria-label="Activation use case" />
							</label>
							<label class="grid gap-1 text-xs text-text-tertiary sm:col-span-2">
								<span>Trigger patterns</span>
								<input class="input text-sm" bind:value={activation.triggerPatterns} placeholder={`${summary.domain.toLowerCase()} request, ${summary.domain.toLowerCase()} review`} />
							</label>
							<label class="grid gap-1 text-xs text-text-tertiary sm:col-span-2">
								<span>Non-trigger patterns</span>
								<input class="input text-sm" bind:value={activation.nonTriggerPatterns} placeholder="do not activate, explain only" />
							</label>
							<label class="grid gap-1 text-xs text-text-tertiary">
								<span>Mode</span>
								<select class="input text-sm" bind:value={activation.mode} aria-label="Activation mode">
									<option value="manual">manual</option>
									<option value="suggested">suggested</option>
									<option value="local_fast_path">local fast path</option>
								</select>
							</label>
							<label class="grid gap-1 text-xs text-text-tertiary">
								<span>Risk policy</span>
								<select class="input text-sm" bind:value={activation.riskPolicy} aria-label="Risk policy">
									<option value="low_only">low only</option>
									<option value="review_packet">review packet</option>
									<option value="loop_mode_required">loop mode required</option>
								</select>
							</label>
							<label class="grid gap-1 text-xs text-text-tertiary sm:col-span-2">
								<span>Rollback ref</span>
								<input class="input text-sm" bind:value={activation.rollbackRef} placeholder="reports/rollback-check.json" />
							</label>
						</div>
						<p class="mt-3 text-xs leading-5 text-text-tertiary">Spawner is selected by default. Add Telegram only when this chip should also work as a fast chat lane.</p>
						<div class="mt-3 flex flex-wrap gap-2">
							{#each ['spawner', 'telegram', 'builder', 'codex', 'scheduler'] as surface}
								<button
									type="button"
									class="border px-2 py-1 font-mono text-[11px] {activation.surfaces.includes(surface as ActivationSurface) ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary' : 'border-surface-border bg-bg-secondary text-text-tertiary'}"
									onclick={() => toggleActivationSurface(surface as ActivationSurface)}
									title={`Toggle ${surface} activation surface for this private rule`}
									aria-label={`Toggle ${surface} activation surface`}
								>
									{surface}
								</button>
							{/each}
							<label class="inline-flex items-center gap-2 border border-surface-border bg-bg-secondary px-2 py-1 font-mono text-[11px] text-text-secondary">
								<input type="checkbox" class="accent-accent-primary" bind:checked={activation.approvalRequired} />
								approval
							</label>
						</div>
						<div class="mt-3">
							<ActionButton
								variant="primary"
								icon="shield-check"
								disabled={Boolean(actionLoading) || activation.surfaces.length === 0}
								loading={actionLoading === 'activation'}
								onclick={stageActivation}
								label="Stage scoped activation rule"
								help="Stages a scoped activation rule with surfaces, rollback ref, and approval requirements. It does not publish globally."
							>
								Stage activation rule
							</ActionButton>
						</div>
					</div>

					<div class="border border-surface-border bg-bg-primary p-3">
						<div class="grid gap-2 sm:grid-cols-2">
							<label class="grid gap-1 text-xs text-text-tertiary sm:col-span-2">
								<span>Name</span>
								<input class="input text-sm" bind:value={schedule.name} aria-label="Schedule name" />
							</label>
							<label class="grid gap-1 text-xs text-text-tertiary">
								<span>Mode</span>
								<select class="input text-sm" bind:value={schedule.mode} aria-label="Schedule mode">
									<option value="round_count">round count</option>
									<option value="once">once</option>
									<option value="interval">interval</option>
									<option value="fixed_time">fixed time</option>
									<option value="continuous">continuous</option>
								</select>
							</label>
							<label class="grid gap-1 text-xs text-text-tertiary">
								<span>Round cap</span>
								<input class="input text-sm" type="number" min="1" max="25" bind:value={schedule.roundLimit} aria-label="Schedule round cap" />
							</label>
							<label class="grid gap-1 text-xs text-text-tertiary">
								<span>Interval minutes</span>
								<input class="input text-sm" type="number" min="1" bind:value={schedule.intervalMinutes} aria-label="Interval minutes" />
							</label>
							<label class="grid gap-1 text-xs text-text-tertiary">
								<span>Fixed local time</span>
								<input class="input text-sm" type="time" bind:value={schedule.fixedLocalTime} aria-label="Fixed local time" />
							</label>
							<label class="grid gap-1 text-xs text-text-tertiary sm:col-span-2">
								<span>Timezone</span>
								<input class="input text-sm" bind:value={schedule.timezone} aria-label="Schedule timezone" />
							</label>
							<label class="grid gap-1 text-xs text-text-tertiary sm:col-span-2">
								<span>Stop conditions</span>
								<input class="input text-sm" bind:value={schedule.stopConditions} placeholder="round_cap_reached,no_safe_win_accepted" />
							</label>
						</div>
						<p class="mt-3 text-xs leading-5 text-text-tertiary">
							Uses {selectedCaseIds.length} selected benchmark case{selectedCaseIds.length === 1 ? '' : 's'} when fired.
						</p>
						<div class="mt-3">
							<ActionButton
								variant="secondary"
								icon="calendar"
								disabled={Boolean(actionLoading) || selectedCaseIds.length === 0}
								loading={actionLoading === 'schedule'}
								onclick={stageSchedule}
								label="Stage private loop schedule"
								help="Stages a private schedule bound to the currently selected benchmark cases and stop conditions."
							>
								Stage schedule
							</ActionButton>
						</div>
					</div>
				</div>
			</SectionPanel>
		</section>

		<section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<SectionPanel
				eyebrow="Control trail"
				title="Events, schedules, and activation rules"
				help="This is the operational ledger for this chip. Evidence refs open inside Spawner where possible."
			>
				<div class="grid gap-3">
					{#each chip.events as event}
						<div class="border border-surface-border bg-bg-primary p-3">
							<div class="flex flex-wrap items-start justify-between gap-2">
								<div>
									<p class="text-sm font-medium text-text-bright">{event.label}</p>
									<p class="mt-1 font-mono text-[11px] text-text-tertiary">{event.eventType} · {event.id}</p>
								</div>
								<StatusBadge status={event.status} />
							</div>
							<div class="mt-3 grid grid-cols-4 gap-2 font-mono text-xs">
								<div>
									<p class="text-text-tertiary">no chip</p>
									<p class="mt-1 text-text-secondary">{formatScore(event.previousScore)}</p>
								</div>
								<div>
									<p class="text-text-tertiary">candidate</p>
									<p class="mt-1 text-text-secondary">{formatScore(event.candidateScore)}</p>
								</div>
								<div>
									<p class="text-text-tertiary">delta</p>
									<p class="mt-1 text-text-bright">{formatDelta(event.utilityDelta)}</p>
								</div>
								<div>
									<p class="text-text-tertiary">{eventWorkMetric(event).label}</p>
									<p class="mt-1 text-text-secondary">{eventWorkMetric(event).value}</p>
								</div>
							</div>
							<p class="mt-3 text-sm leading-5 text-text-secondary">{event.nextAction}</p>
							<p class="mt-2 font-mono text-[11px] text-text-tertiary">{evaluatorLabel(event)}</p>
							{#if evidenceRefsForEvent(event).length}
								<div class="mt-3 grid gap-2">
									{#each evidenceRefsForEvent(event) as ref}
										<EvidenceRef refValue={ref} chipKey={summary.id} compact />
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</SectionPanel>

			<div class="grid gap-4">
				<SectionPanel title="Readiness checks" eyebrow="Gates" density="compact" help="These checks determine what claims Spawner may make about this chip.">
					<div class="grid gap-2 md:grid-cols-2">
						{#each chip.readiness.checks as check}
							<div class="border border-surface-border bg-bg-primary p-3">
								<div class="flex items-center justify-between gap-2">
									<p class="font-mono text-xs text-text-secondary">{check.label}</p>
									<StatusBadge status={check.status} label={check.status} />
								</div>
								<p class="mt-2 break-words text-sm leading-5 text-text-secondary">{check.detail}</p>
								{#if check.evidenceRefs.length}
									<div class="mt-2 grid gap-1">
										{#each check.evidenceRefs as ref}
											<EvidenceRef refValue={ref} chipKey={summary.id} compact />
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</SectionPanel>

				<SectionPanel title="Staged schedules" eyebrow="Operate" density="compact">
					<div class="grid min-w-0 gap-2">
						{#each chip.schedules as schedule}
							<div class="min-w-0 max-w-full border border-surface-border bg-bg-primary p-3">
								<div class="flex flex-wrap items-start justify-between gap-2">
									<div class="min-w-0">
										<p class="min-w-0 truncate text-sm font-medium text-text-bright">{schedule.name}</p>
										<p class="mt-1 font-mono text-[11px] text-text-tertiary">{schedule.mode} · {schedule.status} · run count {schedule.runCount}</p>
									</div>
									<StatusBadge status={schedule.active ? 'running' : schedule.status} label={schedule.active ? 'active' : schedule.status} />
								</div>
								<p class="mt-2 break-words font-mono text-[11px] text-text-tertiary">{scheduleTimingLine(schedule)}</p>
								<p class="mt-2 font-mono text-[11px] text-text-tertiary">
									cases: {schedule.benchmarkCaseIds?.length ?? 0} selected
								</p>
								{#if (schedule.benchmarkCaseIds?.length ?? 0) === 0}
									<p class="mt-2 text-xs leading-5 text-text-tertiary">
										Legacy schedule without selected cases. Stage a new scoped schedule before firing.
									</p>
								{/if}
								<p class="mt-2 truncate font-mono text-[11px] text-text-tertiary" title={schedule.stopConditions.join(', ')}>stops: {schedule.stopConditions.join(', ')}</p>
								<div class="mt-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
									<div class="min-w-0 sm:max-w-xs">
										<EvidenceRef refValue={`control-plane:schedules:${schedule.id}`} chipKey={summary.id} compact />
									</div>
									<div class="flex flex-wrap gap-2 sm:justify-end">
										<ActionButton
											variant="secondary"
											icon="play"
											disabled={Boolean(actionLoading) || schedule.status !== 'staged' || (schedule.benchmarkCaseIds?.length ?? 0) === 0}
											loading={actionLoading === `schedule-fire-${schedule.id}`}
											onclick={() => fireSchedule(schedule.id)}
											label={`Fire schedule ${schedule.name}`}
											help={schedule.status === 'staged' ? 'Runs this private schedule against its selected benchmark cases.' : 'Only staged schedules can fire. Resume or stage a replacement before running.'}
										>
											Fire
										</ActionButton>
										<ActionButton
											variant="ghost"
											icon="pause"
											disabled={Boolean(actionLoading) || schedule.status !== 'staged' || !schedule.active}
											loading={actionLoading === `schedule-pause-${schedule.id}`}
											onclick={() => updateScheduleLifecycle(schedule.id, 'pause')}
											label={`Pause schedule ${schedule.name}`}
											help="Pauses an active schedule without deleting the evidence trail."
										>
											Pause
										</ActionButton>
										<ActionButton
											variant="ghost"
											icon="refresh-cw"
											disabled={Boolean(actionLoading) || schedule.status !== 'staged' || schedule.active}
											loading={actionLoading === `schedule-resume-${schedule.id}`}
											onclick={() => updateScheduleLifecycle(schedule.id, 'resume')}
											label={`Activate schedule ${schedule.name}`}
											help="Activates an inactive staged schedule so it can be paused or run as an operator-controlled loop path."
										>
											Activate
										</ActionButton>
										<ActionButton
											variant="ghost"
											icon="refresh-cw"
											disabled={Boolean(actionLoading) || schedule.status !== 'paused'}
											loading={actionLoading === `schedule-resume-${schedule.id}`}
											onclick={() => updateScheduleLifecycle(schedule.id, 'resume')}
											label={`Resume schedule ${schedule.name}`}
											help="Returns a paused schedule to staged/active so it can continue under operator control."
										>
											Resume
										</ActionButton>
										<ActionButton
											variant="ghost"
											icon="shield"
											disabled={Boolean(actionLoading) || schedule.status === 'cancelled' || schedule.status === 'deactivated'}
											loading={actionLoading === `schedule-deactivate-${schedule.id}`}
											onclick={() => updateScheduleLifecycle(schedule.id, 'deactivate')}
											label={`Deactivate schedule ${schedule.name}`}
											help="Deactivates this schedule path until a fresh activation or schedule review is staged."
										>
											Deactivate
										</ActionButton>
										<ActionButton
											variant="ghost"
											icon="x"
											disabled={Boolean(actionLoading) || schedule.status === 'cancelled'}
											loading={actionLoading === `schedule-cancel-${schedule.id}`}
											onclick={() => armOrCancelSchedule(schedule.id)}
											label={cancelArmedScheduleId === schedule.id ? `Confirm cancel schedule ${schedule.name}` : `Cancel schedule ${schedule.name}`}
											help={cancelArmedScheduleId === schedule.id ? 'Second click confirms terminal cancellation. This schedule cannot be changed afterward.' : 'Cancels this schedule as terminal. Stage a new schedule if the loop should run again.'}
										>
											{cancelArmedScheduleId === schedule.id ? 'Confirm cancel' : 'Cancel'}
										</ActionButton>
									</div>
								</div>
							</div>
						{/each}
						{#if chip.schedules.length === 0}
							<p class="text-sm text-text-tertiary">No chip-scoped loop schedules have been staged yet.</p>
						{/if}
					</div>
				</SectionPanel>

				<SectionPanel title="Activation rules" eyebrow="Activate" density="compact">
					<div class="grid min-w-0 gap-2">
						{#each chip.activationRules as rule}
							<div class="min-w-0 max-w-full border border-surface-border bg-bg-primary p-3">
								<div class="flex flex-wrap items-start justify-between gap-2">
									<div class="min-w-0">
										<p class="min-w-0 truncate text-sm font-medium text-text-bright">{rule.useCase}</p>
										<p class="mt-1 font-mono text-[11px] text-text-tertiary">{rule.mode} · {rule.status} · {rule.riskPolicy}</p>
									</div>
									<StatusBadge status={rule.approvalRequired ? 'attention' : 'passed'} label={rule.approvalRequired ? 'approval' : 'no approval'} />
								</div>
								<p class="mt-2 min-w-0 truncate font-mono text-[11px] text-text-tertiary" title={rule.surfaces.join(', ')}>surfaces: {rule.surfaces.join(', ')}</p>
								{#if rule.triggerPatterns.length}
									<p class="mt-2 truncate text-sm text-text-secondary" title={rule.triggerPatterns.join(', ')}>triggers: {rule.triggerPatterns.join(', ')}</p>
								{/if}
								<div class="mt-3 min-w-0 sm:max-w-xs">
									<EvidenceRef refValue={`control-plane:activation_rules:${rule.id}`} chipKey={summary.id} compact />
								</div>
							</div>
						{/each}
						{#if chip.activationRules.length === 0}
							<p class="text-sm text-text-tertiary">No activation rules have been staged yet.</p>
						{/if}
					</div>
				</SectionPanel>
			</div>
		</section>

		<details class="border border-surface-border bg-bg-secondary">
			<summary class="cursor-pointer px-4 py-3 text-sm font-medium text-text-bright hover:bg-bg-primary">
				Advanced evidence, claims, and manual completion
			</summary>
			<div class="grid gap-4 border-t border-surface-border p-4 xl:grid-cols-[repeat(3,minmax(0,1fr))]">
				<div class="min-w-0">
					<p class="font-mono text-[10px] uppercase text-text-tertiary">Evidence artifacts</p>
					<div class="mt-3 grid gap-2">
						{#each chip.evidenceArtifacts as artifact}
							<div class="min-w-0 border border-surface-border bg-bg-primary p-3">
								<div class="flex items-center justify-between gap-2">
									<p class="font-mono text-xs text-text-secondary">{artifact.label}</p>
									<StatusBadge status={artifact.present ? 'passed' : 'missing'} label={artifact.present ? 'present' : 'missing'} />
								</div>
								<div class="mt-2">
									<EvidenceRef refValue={artifact.ref} chipKey={summary.id} compact />
								</div>
								{#if artifact.status}
									<p class="mt-2 break-words font-mono text-[11px] text-text-tertiary">{artifact.status}</p>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<div class="min-w-0">
					<p class="font-mono text-[10px] uppercase text-text-tertiary">Allowed and blocked claims</p>
					<div class="mt-3 grid gap-2">
						{#each chip.claims.allowed.slice(0, 5) as claim}
							<div class="border border-status-success/25 bg-status-success-bg p-3 text-sm text-status-success">
								<p class="break-words">{claim.claim}</p>
							</div>
						{/each}
						{#each chip.claims.disallowed.slice(0, 5) as claim}
							<div class="border border-status-error/25 bg-status-error-bg p-3 text-sm text-status-error">
								<p class="break-words">{claim.claim}</p>
								{#if claim.reason}
									<p class="mt-1 break-words text-current/75">{claim.reason}</p>
								{/if}
							</div>
						{/each}
						{#if chip.claims.allowed.length === 0 && chip.claims.disallowed.length === 0}
							<p class="text-sm text-text-tertiary">No claims matrix found.</p>
						{/if}
					</div>
				</div>

				<div class="min-w-0">
					<p class="font-mono text-[10px] uppercase text-text-tertiary">Manual completion binding</p>
					<form class="mt-3 grid gap-2 border border-surface-border bg-bg-primary p-3" onsubmit={(event) => { event.preventDefault(); bindCompletion(); }}>
						<input class="input text-sm" bind:value={completion.eventId} placeholder="run event id" />
						<select class="input text-sm" bind:value={completion.status} aria-label="Completion status">
							<option value="passed">passed</option>
							<option value="failed">failed</option>
							<option value="blocked">blocked</option>
						</select>
						<div class="grid grid-cols-3 gap-2">
							<input class="input text-sm" type="number" min="0" max="10" step="0.1" bind:value={completion.previousScore} aria-label="Completion previous score" />
							<input class="input text-sm" type="number" min="0" max="10" step="0.1" bind:value={completion.candidateScore} aria-label="Completion candidate score" />
							<input class="input text-sm" type="number" min="1" max="25" bind:value={completion.roundsObserved} aria-label="Completion rounds observed" />
						</div>
						<input class="input text-sm" bind:value={completion.evidenceRefs} placeholder="evidence refs, comma-separated" />
						<input class="input text-sm" bind:value={completion.sourceRef} placeholder="source ref" />
						<input class="input text-sm" bind:value={completion.evaluatorVerdictRef} placeholder="evaluator verdict ref" />
						<ActionButton type="submit" variant="secondary" icon="link" disabled={Boolean(actionLoading) || !completion.eventId.trim()} loading={actionLoading === 'completion'}>
							Bind result
						</ActionButton>
					</form>

					<div class="mt-4">
						<p class="font-mono text-[10px] uppercase text-text-tertiary">Runtime notes</p>
						<ul class="mt-3 grid gap-2 break-words text-sm leading-6 text-text-secondary">
							{#each chip.runtime.distilledLessons as lesson}
								<li>{lesson}</li>
							{/each}
							{#if chip.runtime.distilledLessons.length === 0}
								<li class="text-text-tertiary">No distilled runtime lessons found.</li>
							{/if}
						</ul>
					</div>
				</div>
			</div>
		</details>
	</main>

	<Footer />
</div>
