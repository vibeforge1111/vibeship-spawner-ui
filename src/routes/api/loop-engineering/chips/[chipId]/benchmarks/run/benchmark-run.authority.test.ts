import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServerGovernorDecisionAuthority, buildServerTurnIntentVNextAuthority } from '$lib/server/harness-authority';
import { listPersistedLoopEngineeringEvents, stageBenchmarkCase } from '$lib/server/loop-engineering-control-plane';
import { getMissionControlRelaySnapshot } from '$lib/server/mission-control-relay';
import { POST } from './+server';

const originalSpawnerStateDir = process.env.SPAWNER_STATE_DIR;
let cleanupDir: string | null = null;

function event(body?: unknown) {
	return {
		params: { chipId: 'domain-chip-prd-writing-proof-loop' },
		request: new Request('http://127.0.0.1:3333/api/loop-engineering/chips/domain-chip-prd-writing-proof-loop/benchmarks/run', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1:3333/api/loop-engineering/chips/domain-chip-prd-writing-proof-loop/benchmarks/run'),
		getClientAddress: () => '127.0.0.1'
	};
}

function governorAuthority(mutationClass: 'launches_mission' | 'writes_files' = 'launches_mission') {
	return buildServerGovernorDecisionAuthority({
		source: 'loop-engineering-benchmark-run-test',
		reason: 'Focused Loop Engineering benchmark run regression.',
		toolName: 'spawner.loop_engineering.benchmark.run',
		mutationClass,
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test'
	});
}

function bareVNextAuthority() {
	return buildServerTurnIntentVNextAuthority({
		source: 'loop-engineering-benchmark-run-test',
		reason: 'Focused Loop Engineering benchmark run regression.',
		toolName: 'spawner.loop_engineering.benchmark.run',
		mutationClass: 'launches_mission',
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test'
	});
}

describe('/api/loop-engineering/chips/[chipId]/benchmarks/run', () => {
	beforeEach(async () => {
		cleanupDir = await mkdtemp(path.join(os.tmpdir(), 'spawner-loop-benchmark-run-route-'));
		process.env.SPAWNER_STATE_DIR = cleanupDir;
	});

	afterEach(async () => {
		if (originalSpawnerStateDir) process.env.SPAWNER_STATE_DIR = originalSpawnerStateDir;
		else delete process.env.SPAWNER_STATE_DIR;
		if (cleanupDir) await rm(cleanupDir, { recursive: true, force: true });
		cleanupDir = null;
	});

	it('blocks benchmark launches without native Governor authority', async () => {
		const response = await POST(event({ objective: 'Run a PRD benchmark.' }) as never);
		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.reasonCodes).toContain('missing_harness_authority');
	});

	it('blocks bare VNext benchmark launch authority', async () => {
		const response = await POST(event({
			objective: 'Run a PRD benchmark.',
			executionAuthority: bareVNextAuthority()
		}) as never);
		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.authority.source).toBe('turn_intent_vnext');
		expect(body.authority.reasonCodes).toContain('native_governor_required');
	});

	it('queues a private benchmark mission and ledger event with Governor authority', async () => {
		const staged = await stageBenchmarkCase({
			chipKey: 'domain-chip-prd-writing-proof-loop',
			kind: 'held_out',
			prompt: 'Write a PRD for a billing reminder workflow.',
			expectedBehavior: 'Include decision owner, users, success metric, acceptance criteria, risks, and evidence refs.'
		});
		const response = await POST(event({
			objective: 'Score PRD quality against held-out cases.',
			benchmarkCaseIds: [staged.caseRecord.id],
			sourceSurface: 'telegram',
			executionAuthority: governorAuthority()
		}) as never);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.commandResult).toMatchObject({
			action: 'benchmark_run_queued',
			changed: true,
			launchedMission: true,
			missionId: body.mission.id,
			eventId: body.event.id
		});
		expect(body.event).toMatchObject({
			eventType: 'benchmark_run',
			status: 'queued',
			sourceSurface: 'telegram'
		});
		expect(body.mission.goal).toContain('Generator output must not grade itself');
		expect(body.commandResult.userMessage).not.toMatch(/approved|activated/i);

		const events = await listPersistedLoopEngineeringEvents('domain-chip-prd-writing-proof-loop');
		expect(events.some((eventRecord) => eventRecord.missionId === body.mission.id)).toBe(true);
		expect(getMissionControlRelaySnapshot(body.mission.id).recent[0].eventType).toBe('mission_created');
	});

	it('executes staged benchmark cases when explicitly requested', async () => {
		const staged = await stageBenchmarkCase({
			chipKey: 'domain-chip-prd-writing-proof-loop',
			kind: 'visible',
			prompt: 'Write a PRD for a billing reminder workflow.',
			expectedBehavior: 'Include decision owner, users, success metric, acceptance criteria, risks, and evidence refs.'
		});

		const response = await POST(event({
			objective: 'Run the staged PRD Writing benchmark now with separated evaluator scoring.',
			benchmarkCaseIds: [staged.caseRecord.id],
			executeNow: true,
			sourceSurface: 'telegram',
			executionAuthority: governorAuthority('writes_files')
		}) as never);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.commandResult).toMatchObject({
			action: 'benchmark_run_executed',
			changed: true,
			launchedMission: false,
			missionId: body.mission.id,
			eventId: body.event.id,
			benchmarkRunId: body.benchmarkRun.runId,
			caseCount: 1
		});
		expect(body.benchmarkRun).toMatchObject({
			status: 'passed',
			blindComparison: true,
			evaluatorSeparated: true,
			evaluatorModel: 'spark.local.separated-evaluator.v1'
		});
		expect(body.benchmarkRun.candidateScore).toBeGreaterThan(body.benchmarkRun.previousScore);
		expect(body.event).toMatchObject({
			eventType: 'benchmark_run',
			status: 'passed',
			sourceSurface: 'telegram',
			evaluatorSeparated: true,
			evaluatorVerdictRef: body.benchmarkRun.evaluatorVerdictRef,
			commandResult: { action: 'benchmark_run_executed' }
		});
		expect(body.commandResult.userMessage).not.toMatch(/activated|published|approved/i);

		const events = await listPersistedLoopEngineeringEvents('domain-chip-prd-writing-proof-loop');
		expect(events.find((eventRecord) => eventRecord.id === body.event.id)).toMatchObject({
			status: 'passed',
			previousScore: body.benchmarkRun.previousScore,
			candidateScore: body.benchmarkRun.candidateScore,
			utilityDelta: body.benchmarkRun.utilityDelta,
			evaluatorSeparated: true
		});
		expect(getMissionControlRelaySnapshot(body.mission.id).recent[0].eventType).toBe('mission_completed');
	});
});
