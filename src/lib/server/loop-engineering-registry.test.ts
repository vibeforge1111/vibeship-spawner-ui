import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLoopEngineeringChipDetail, listLoopEngineeringChips } from './loop-engineering-registry';

const originalSpawnerStateDir = process.env.SPAWNER_STATE_DIR;
let cleanupDirs: string[] = [];

async function writeJson(filePath: string, value: unknown): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

beforeEach(async () => {
	const stateDir = await mkdtemp(path.join(os.tmpdir(), 'spark-loop-registry-state-'));
	process.env.SPAWNER_STATE_DIR = stateDir;
	cleanupDirs.push(stateDir);
});

afterEach(async () => {
	if (originalSpawnerStateDir) process.env.SPAWNER_STATE_DIR = originalSpawnerStateDir;
	else delete process.env.SPAWNER_STATE_DIR;
	await Promise.all(cleanupDirs.map((dir) => rm(dir, { recursive: true, force: true })));
	cleanupDirs = [];
});

describe('loop-engineering-registry', () => {
	it('summarizes benchmark, loop, gate, runtime, and blocker evidence for domain chips', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'spark-loop-registry-'));
		const chip = path.join(root, 'domain-chip-prd-writing-proof-loop');
		await writeJson(path.join(chip, 'spark-chip.json'), {
			chip_name: 'domain-chip-prd-writing-proof-loop',
			commands: {
				'loop-round': ['python3', 'chip-runner.py', 'loop-round'],
				'long-loop-trend': ['python3', 'chip-runner.py', 'long-loop-trend']
			}
		});
		await writeJson(path.join(chip, 'reports', 'chip-benefit-ab.json'), {
			ab_status: 'pass',
			domain: 'PRD Writing Proof Loop',
			primary_metric: 'prd_quality_score',
			no_chip_score: 72,
			chip_assisted_score: 88,
			effective_utility_delta: 16,
			blind_evaluation_verified: true,
			meaningful_utility_delta: true,
			promotion_blocked: true
		});
		await writeJson(path.join(chip, 'reports', 'long-loop-trend.json'), {
			trend_status: 'pass',
			long_loop_supported: true,
			rounds_observed: 5,
			required_rounds: 5,
			score_deltas: [8, 11, 13, 15, 16]
		});
		await writeJson(path.join(chip, 'reports', 'loop-gate-check.json'), {
			private_candidate_supported: true,
			sealed_evaluation_supported: true,
			watchtower_executed: true,
			rollback_executed: true,
			consumer_transfer_passed: true,
			proof_auditor_passed: true,
			ux_readability_score: 10,
			promotion_blocked: true,
			hard_blockers: ['operator_publication_approval_missing']
		});
		await writeJson(path.join(chip, 'reports', 'watchtower-check.json'), { watchtower_status: 'passed', watchtower_executed: true });
		await writeJson(path.join(chip, 'reports', 'rollback-check.json'), { rollback_status: 'passed', rollback_executed: true });
		await writeJson(path.join(chip, 'reports', 'consumer-transfer-trial-binding.json'), { consumer_transfer_passed: true });
		await writeJson(path.join(chip, 'reports', 'proof-auditor-check.json'), { proof_auditor_passed: true });
		await writeJson(path.join(chip, 'reports', 'r30-controlled-loop', 'sealed-evaluator-report-v2.json'), { evaluation_status: 'pass' });
		await writeJson(path.join(chip, 'reports', 'r30-controlled-loop', 'final-allowed-disallowed-claims-matrix.json'), {
			allowed_claims: [{ claim: 'private pass' }],
			disallowed_claims: [{ claim: 'published' }, { claim: 'live proven' }]
		});
		await writeJson(path.join(chip, 'distilled-runtime', 'prd-writing-fast-path.json'), {
			runtime_state: 'private_candidate_supported_local_telegram_handler_passed_live_telegram_unproven',
			telegram_first: true,
			reloop_triggers: ['benchmark delta regresses'],
			runtime_modes: {
				quick_answer: { allowed_now: false },
				review_packet: { allowed_now: false },
				loop_mode: { allowed_now: true }
			},
			runtime_path: 'distilled-runtime/prd-writing-fast-path.json'
		});

		const registry = await listLoopEngineeringChips({ chipsRoot: root });
		expect(registry.summary.total).toBe(1);
		expect(registry.summary.resultEvents).toBe(7);
		expect(registry.summary.localFastPaths).toBe(1);
		expect(registry.summary.benchmarkPasses).toBe(1);
		expect(registry.summary.longLoopPasses).toBe(1);
		expect(registry.summary.liveTelegramProven).toBe(0);
		expect(registry.summary.blocked).toBe(1);

		const summary = registry.chips[0];
		expect(summary.domain).toBe('PRD Writing Proof Loop');
		expect(summary.status).toBe('local_fast_path');
		expect(summary.benchmark.utilityDelta).toBe(16);
		expect(summary.loop.roundsObserved).toBe(5);
		expect(summary.gates.watchtower).toBe(true);
		expect(summary.gates.rollback).toBe(true);
		expect(summary.activation.loopModeAllowed).toBe(true);
		expect(summary.activation.liveTelegramProven).toBe(false);
		expect(summary.scheduling.supportedModes).toEqual(['round_count', 'score_plateau', 'telegram_triggered', 'triggered_reloop']);
		expect(summary.nextAction).toContain('operator_publication_approval_missing');
		expect(registry.events.map((event) => event.eventType)).toEqual([
			'activation_gate',
			'benchmark_run',
			'loop_batch',
			'evaluator_review',
			'watchtower_check',
			'rollback_check',
			'schedule_contract'
		]);
		const benchmarkEvent = registry.events.find((event) => event.eventType === 'benchmark_run');
		expect(benchmarkEvent?.status).toBe('passed');
		expect(benchmarkEvent?.previousScore).toBe(72);
		expect(benchmarkEvent?.candidateScore).toBe(88);
		expect(benchmarkEvent?.utilityDelta).toBe(16);
		expect(benchmarkEvent?.evaluatorSeparated).toBe(true);
		const activationEvent = registry.events.find((event) => event.eventType === 'activation_gate');
		expect(activationEvent?.status).toBe('blocked');
		expect(activationEvent?.nextAction).toContain('operator_publication_approval_missing');

		const detail = await getLoopEngineeringChipDetail('domain-chip-prd-writing-proof-loop', { chipsRoot: root });
		expect(detail?.readiness.status).toBe('telegram_activation_blocked');
		expect(detail?.events).toHaveLength(7);
		expect(detail?.readiness.passCount).toBe(10);
		expect(detail?.readiness.blockedCount).toBe(2);
		expect(detail?.readiness.checks.find((check) => check.id === 'live_telegram_proof')?.status).toBe('blocked');
		expect(detail?.claims.allowed[0]?.claim).toBe('private pass');
		expect(detail?.claims.disallowed).toHaveLength(2);
		expect(detail?.runtime.distilledLessons).toEqual([]);
		expect(detail?.evidenceArtifacts.find((artifact) => artifact.ref === 'reports/chip-benefit-ab.json')?.present).toBe(true);
	});

	it('returns an empty registry when the chip root is missing', async () => {
		const registry = await listLoopEngineeringChips({ chipsRoot: path.join(os.tmpdir(), 'missing-spark-chip-root') });
		expect(registry.summary.total).toBe(0);
		expect(registry.chips).toEqual([]);
	});

	it('imports benchmark-pack cases from an explicit chip root in detail views', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'spark-loop-explicit-root-'));
		const chip = path.join(root, 'domain-chip-daily-schedule-reliability-r30-persisted-context-qa');
		await writeJson(path.join(chip, 'spark-chip.json'), {
			chip_name: 'domain-chip-daily-schedule-reliability-r30-persisted-context-qa',
			domain: 'Daily Schedule Reliability'
		});
		await mkdir(path.join(chip, 'benchmark'), { recursive: true });
		await writeFile(path.join(chip, 'benchmark', 'cases.jsonl'), JSON.stringify({
			case_id: 'daily-schedule-explicit-root-001',
			lane: 'held_out',
			prompt: 'Resolve tomorrow morning across Dubai and New York calendars.',
			expected_behavior: 'Name the timezone ambiguity and ask for approval before changing reminders.'
		}), 'utf-8');

		const detail = await getLoopEngineeringChipDetail('domain-chip-daily-schedule-reliability-r30-persisted-context-qa', { chipsRoot: root });
		expect(detail?.benchmarkCases).toEqual([
			expect.objectContaining({
				id: 'artifact-case-daily-schedule-explicit-root-001',
				kind: 'held_out',
				createdBy: 'import',
				evidenceRefs: ['benchmark/cases.jsonl#daily-schedule-explicit-root-001']
			})
		]);
	});

	it('treats supported positive chip-benefit reports as meaningful even without the legacy meaningful flag', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'spark-loop-benefit-supported-'));
		const chip = path.join(root, 'domain-chip-project-maintenance-steward-r30-usefulness-loop');
		await writeJson(path.join(chip, 'spark-chip.json'), {
			chip_name: 'domain-chip-project-maintenance-steward-r30-usefulness-loop'
		});
		await writeJson(path.join(chip, 'reports', 'chip-benefit-ab.json'), {
			ab_status: 'pass',
			domain: 'Project Maintenance Steward',
			no_chip_score: 65.7,
			chip_assisted_score: 86.4,
			effective_utility_delta: 20.7,
			blind_evaluation_verified: true,
			chip_benefit_supported: true,
			promotion_blocked: true
		});
		await writeJson(path.join(chip, 'reports', 'long-loop-trend.json'), {
			trend_status: 'pass',
			long_loop_supported: true,
			rounds_observed: 5,
			required_rounds: 5,
			score_deltas: [10, 12, 14, 18, 20]
		});
		await writeJson(path.join(chip, 'reports', 'loop-gate-check.json'), {
			private_candidate_supported: true,
			promotion_blocked: true,
			hard_blockers: ['operator_publication_approval_missing']
		});

		const detail = await getLoopEngineeringChipDetail('domain-chip-project-maintenance-steward-r30-usefulness-loop', { chipsRoot: root });
		const benchmarkEvent = detail?.events.find((event) => event.eventType === 'benchmark_run');
		expect(detail?.summary.benchmark.meaningfulDelta).toBe(true);
		expect(detail?.readiness.checks.find((check) => check.id === 'benchmark_ab')?.status).toBe('passed');
		expect(benchmarkEvent?.status).toBe('passed');
	});

	it('orders fresh persisted Spawner results before older artifact gates', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'spark-loop-fresh-events-'));
		const chip = path.join(root, 'domain-chip-project-maintenance-steward-r30-usefulness-loop');
		await writeJson(path.join(chip, 'spark-chip.json'), {
			chip_name: 'domain-chip-project-maintenance-steward-r30-usefulness-loop'
		});
		await writeJson(path.join(chip, 'reports', 'chip-benefit-ab.json'), {
			ab_status: 'pass',
			domain: 'Project Maintenance Steward',
			no_chip_score: 65,
			chip_assisted_score: 86,
			effective_utility_delta: 21,
			blind_evaluation_verified: true,
			chip_benefit_supported: true
		});
		await writeJson(path.join(chip, 'reports', 'loop-gate-check.json'), {
			private_candidate_supported: true,
			promotion_blocked: true,
			hard_blockers: ['operator_publication_approval_missing']
		});
		await writeJson(path.join(process.env.SPAWNER_STATE_DIR!, 'loop-engineering', 'control-plane.json'), {
			schema_version: 'spark.loop_engineering_control_plane.v1',
			updated_at: '2026-07-02T14:28:37.057Z',
			events: [
				{
					id: 'lee-1782916117015-706534',
					chipId: 'domain-chip-project-maintenance-steward-r30-usefulness-loop',
					chipName: 'Project Maintenance Steward',
					domain: 'Project Maintenance Steward',
					eventType: 'benchmark_run',
					label: 'Private benchmark run queued',
					status: 'passed',
					sourceSurface: 'spawner',
					previousScore: 3.89,
					candidateScore: 9.77,
					utilityDelta: 5.88,
					roundsObserved: null,
					evaluatorSeparated: true,
					evidenceRefs: ['control-plane:benchmark_runs:benchrun-lee-1782916117015-706534:summary.json'],
					completedAt: '2026-07-02T14:28:37.054Z',
					nextAction: 'Review the packet before distillation.',
					updatedAt: '2026-07-02T14:28:37.057Z'
				}
			],
			benchmark_cases: [],
			schedules: [],
			activation_rules: [],
			distillations: []
		});

		const detail = await getLoopEngineeringChipDetail('domain-chip-project-maintenance-steward-r30-usefulness-loop', { chipsRoot: root });
		expect(detail?.events[0]).toEqual(expect.objectContaining({
			id: 'lee-1782916117015-706534',
			sourceSurface: 'spawner',
			eventType: 'benchmark_run'
		}));
		expect(detail?.events.findIndex((event) => event.eventType === 'activation_gate')).toBeGreaterThan(0);
	});

	it('rejects unsafe chip detail ids', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'spark-loop-registry-'));
		await expect(getLoopEngineeringChipDetail('../domain-chip-x', { chipsRoot: root })).resolves.toBeNull();
		await expect(getLoopEngineeringChipDetail('not-a-domain-chip', { chipsRoot: root })).resolves.toBeNull();
	});
});
