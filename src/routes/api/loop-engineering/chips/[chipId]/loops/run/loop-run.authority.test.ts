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
		request: new Request('http://127.0.0.1:3333/api/loop-engineering/chips/domain-chip-prd-writing-proof-loop/loops/run', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1:3333/api/loop-engineering/chips/domain-chip-prd-writing-proof-loop/loops/run'),
		getClientAddress: () => '127.0.0.1'
	};
}

function governorAuthority(mutationClass: 'launches_mission' | 'writes_files' = 'launches_mission') {
	return buildServerGovernorDecisionAuthority({
		source: 'loop-engineering-loop-run-test',
		reason: 'Focused Loop Engineering loop run regression.',
		toolName: 'spawner.loop_engineering.loop.run',
		mutationClass,
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test'
	});
}

function bareVNextAuthority() {
	return buildServerTurnIntentVNextAuthority({
		source: 'loop-engineering-loop-run-test',
		reason: 'Focused Loop Engineering loop run regression.',
		toolName: 'spawner.loop_engineering.loop.run',
		mutationClass: 'launches_mission',
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test'
	});
}

describe('/api/loop-engineering/chips/[chipId]/loops/run', () => {
	beforeEach(async () => {
		cleanupDir = await mkdtemp(path.join(os.tmpdir(), 'spawner-loop-run-route-'));
		process.env.SPAWNER_STATE_DIR = cleanupDir;
	});

	afterEach(async () => {
		if (originalSpawnerStateDir) process.env.SPAWNER_STATE_DIR = originalSpawnerStateDir;
		else delete process.env.SPAWNER_STATE_DIR;
		if (cleanupDir) await rm(cleanupDir, { recursive: true, force: true });
		cleanupDir = null;
	});

	it('blocks loop launches without native Governor authority', async () => {
		const response = await POST(event({ objective: 'Improve PRD writing.', roundLimit: 3 }) as never);
		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.reasonCodes).toContain('missing_harness_authority');
	});

	it('blocks bare VNext loop launch authority', async () => {
		const response = await POST(event({
			objective: 'Improve PRD writing.',
			roundLimit: 3,
			executionAuthority: bareVNextAuthority()
		}) as never);
		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.authority.source).toBe('turn_intent_vnext');
		expect(body.authority.reasonCodes).toContain('native_governor_required');
	});

	it('queues a capped private loop mission and does not accept generator improvements', async () => {
		const response = await POST(event({
			objective: 'Improve PRD drafting speed and evidence quality.',
			roundLimit: 3,
			executionAuthority: governorAuthority()
		}) as never);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.commandResult).toMatchObject({
			action: 'loop_run_queued',
			changed: true,
			launchedMission: true,
			missionId: body.mission.id,
			eventId: body.event.id
		});
		expect(body.event).toMatchObject({
			eventType: 'loop_batch',
			status: 'queued',
			roundsObserved: 3,
			evaluatorSeparated: true
		});
		expect(body.mission.goal).toContain('Run up to 3 private improvement round(s)');
		expect(body.mission.goal).toContain('A separated evaluator must score the work');
		expect(body.commandResult.userMessage).not.toMatch(/approved|activated/i);

		const events = await listPersistedLoopEngineeringEvents('domain-chip-prd-writing-proof-loop');
		expect(events.some((eventRecord) => eventRecord.missionId === body.mission.id)).toBe(true);
		expect(getMissionControlRelaySnapshot(body.mission.id).recent[0].eventType).toBe('mission_created');
	});

	it('executes selected benchmark cases into a private loop verdict when requested', async () => {
		const staged = await stageBenchmarkCase({
			chipKey: 'domain-chip-prd-writing-proof-loop',
			kind: 'held_out',
			prompt: 'Write a PRD for a billing reminder workflow.',
			expectedBehavior: 'Include owner, affected users, success metric, acceptance criteria, risks, rollback, and evidence refs.',
			evidenceRefs: ['reports/loop-route-case.md']
		});

		const response = await POST(event({
			objective: 'Execute a private loop improvement over the clean case.',
			roundLimit: 3,
			executeNow: true,
			benchmarkCaseIds: [staged.caseRecord.id],
			sourceSurface: 'telegram',
			executionAuthority: governorAuthority('writes_files')
		}) as never);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.commandResult).toMatchObject({
			action: 'loop_run_executed',
			changed: true,
			launchedMission: false,
			missionId: body.mission.id,
			eventId: body.event.id,
			loopRunId: body.loopRun.runId,
			caseCount: 1,
			roundsObserved: 3
		});
		expect(body.loopRun).toMatchObject({
			status: 'passed',
			blindComparison: true,
			evaluatorSeparated: true,
			roundsObserved: 3,
			evaluatorModel: 'spark.local.separated-evaluator.v1'
		});
		expect(body.loopRun.candidateScore).toBeGreaterThan(body.loopRun.previousScore);
		expect(body.event).toMatchObject({
			eventType: 'loop_batch',
			status: 'passed',
			sourceSurface: 'telegram',
			evaluatorSeparated: true,
			evaluatorVerdictRef: body.loopRun.evaluatorVerdictRef,
			commandResult: { action: 'loop_run_executed' }
		});
		expect(body.commandResult.userMessage).not.toMatch(/activated|published|approved/i);

		const events = await listPersistedLoopEngineeringEvents('domain-chip-prd-writing-proof-loop');
		expect(events.find((eventRecord) => eventRecord.id === body.event.id)).toMatchObject({
			status: 'passed',
			previousScore: body.loopRun.previousScore,
			candidateScore: body.loopRun.candidateScore,
			utilityDelta: body.loopRun.utilityDelta,
			roundsObserved: 3,
			evaluatorSeparated: true
		});
		expect(getMissionControlRelaySnapshot(body.mission.id).recent[0].eventType).toBe('mission_completed');
	});
});
