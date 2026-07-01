import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServerGovernorDecisionAuthority, buildServerTurnIntentVNextAuthority } from '$lib/server/harness-authority';
import {
	listLoopSchedules,
	stageBenchmarkCase,
	stageLoopSchedule
} from '$lib/server/loop-engineering-control-plane';
import { POST } from './+server';

const originalSpawnerStateDir = process.env.SPAWNER_STATE_DIR;
let cleanupDir: string | null = null;

function event(scheduleId: string, body?: unknown) {
	return {
		params: { chipId: 'domain-chip-prd-writing-proof-loop', scheduleId },
		request: new Request(`http://127.0.0.1:3333/api/loop-engineering/chips/domain-chip-prd-writing-proof-loop/schedules/${scheduleId}/fire`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		}),
		url: new URL(`http://127.0.0.1:3333/api/loop-engineering/chips/domain-chip-prd-writing-proof-loop/schedules/${scheduleId}/fire`),
		getClientAddress: () => '127.0.0.1'
	};
}

function governorAuthority(requestId?: string) {
	return buildServerGovernorDecisionAuthority({
		source: 'loop-engineering-schedule-fire-test',
		reason: 'Focused Loop Engineering schedule fire regression.',
		toolName: 'spawner.loop_engineering.schedule.fire',
		mutationClass: 'launches_mission',
		requestId,
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test'
	});
}

function bareVNextAuthority() {
	return buildServerTurnIntentVNextAuthority({
		source: 'loop-engineering-schedule-fire-test',
		reason: 'Focused Loop Engineering schedule fire regression.',
		toolName: 'spawner.loop_engineering.schedule.fire',
		mutationClass: 'launches_mission',
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test'
	});
}

async function stagedSchedule(): Promise<{ scheduleId: string; caseId: string }> {
	const stagedCase = await stageBenchmarkCase({
		chipKey: 'domain-chip-prd-writing-proof-loop',
		kind: 'visible',
		prompt: 'Write a PRD for an approval-gated scheduler.',
		expectedBehavior: 'Include owner, affected users, success metric, acceptance criteria, risks, rollback, and evidence refs.'
	});
	const staged = await stageLoopSchedule({
		chipKey: 'domain-chip-prd-writing-proof-loop',
		name: 'PRD Writing scheduled loop',
		mode: 'round_count',
		roundLimit: 3,
		benchmarkCaseIds: [stagedCase.caseRecord.id]
	});
	return { scheduleId: staged.schedule.id, caseId: stagedCase.caseRecord.id };
}

describe('/api/loop-engineering/chips/[chipId]/schedules/[scheduleId]/fire', () => {
	beforeEach(async () => {
		cleanupDir = await mkdtemp(path.join(os.tmpdir(), 'spawner-loop-schedule-fire-route-'));
		process.env.SPAWNER_STATE_DIR = cleanupDir;
	});

	afterEach(async () => {
		if (originalSpawnerStateDir) process.env.SPAWNER_STATE_DIR = originalSpawnerStateDir;
		else delete process.env.SPAWNER_STATE_DIR;
		if (cleanupDir) await rm(cleanupDir, { recursive: true, force: true });
		cleanupDir = null;
	});

	it('blocks schedule fire without native Governor authority', async () => {
		const { scheduleId } = await stagedSchedule();
		const response = await POST(event(scheduleId, {}) as never);
		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.reasonCodes).toContain('missing_harness_authority');
	});

	it('blocks bare VNext schedule fire authority', async () => {
		const { scheduleId } = await stagedSchedule();
		const response = await POST(event(scheduleId, { executionAuthority: bareVNextAuthority() }) as never);
		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.authority.source).toBe('turn_intent_vnext');
		expect(body.authority.reasonCodes).toContain('native_governor_required');
	});

	it('fires a staged schedule as a private capped loop with Governor authority', async () => {
		const { scheduleId, caseId } = await stagedSchedule();
		const requestId = 'schedule-fire-route-test';
		const response = await POST(event(scheduleId, {
			sourceSurface: 'scheduler',
			requestId,
			executionAuthority: governorAuthority(requestId)
		}) as never);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.commandResult).toMatchObject({
			action: 'schedule_loop_executed',
			changed: true,
			launchedMission: true,
			eventId: body.event.id,
			missionId: body.mission.id,
			loopRunId: body.loopRun.runId,
			evaluatorVerdictRef: body.loopRun.evaluatorVerdictRef
		});
		expect(body.event).toMatchObject({
			eventType: 'loop_batch',
			status: 'passed',
			sourceSurface: 'scheduler',
			scheduleId,
			roundsObserved: 3,
			evaluatorSeparated: true,
			sourceRef: body.loopRun.sourceRef,
			evaluatorVerdictRef: body.loopRun.evaluatorVerdictRef
		});
		expect(body.schedule).toMatchObject({
			id: scheduleId,
			benchmarkCaseIds: [caseId],
			runCount: 1,
			lastEventId: body.event.id
		});
		const schedules = await listLoopSchedules('domain-chip-prd-writing-proof-loop');
		expect(schedules[0]).toMatchObject({
			id: scheduleId,
			runCount: 1,
			lastEventId: body.event.id
		});
	});
});
