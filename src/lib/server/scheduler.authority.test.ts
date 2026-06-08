import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
	createSchedule,
	deleteSchedule,
	listSchedules,
	resetSchedulerForTests,
	runSchedulerTickForTests
} from './scheduler';
import {
	buildServerGovernorDecisionAuthority,
	buildServerTurnIntentVNextAuthority,
	type SparkMutationClass
} from './harness-authority';

let testSpawnerDir: string | null = null;

function scheduleAuthority(toolName: string, mutationClass: SparkMutationClass) {
	return buildServerGovernorDecisionAuthority({
		source: 'scheduler-authority-test',
		reason: 'Focused scheduler authority regression.',
		toolName,
		mutationClass,
		requestId: `scheduler-authority-test-${toolName}`,
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test'
	});
}

function bareVNextScheduleAuthority(toolName: string, mutationClass: SparkMutationClass) {
	return buildServerTurnIntentVNextAuthority({
		source: 'scheduler-authority-test',
		reason: 'Focused scheduler authority regression.',
		toolName,
		mutationClass,
		requestId: `scheduler-authority-test-${toolName}`,
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test'
	});
}

describe('scheduler Harness authority', () => {
	beforeEach(async () => {
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-scheduler-authority-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		resetSchedulerForTests();
	});

	afterEach(async () => {
		vi.unstubAllGlobals();
		resetSchedulerForTests();
		delete process.env.SPAWNER_STATE_DIR;
		delete process.env.SPARK_WORKSPACE_ROOT;
		if (testSpawnerDir && existsSync(testSpawnerDir)) {
			await rm(testSpawnerDir, { recursive: true, force: true });
		}
		testSpawnerDir = null;
	});

	it('blocks schedule creation without Harness authority', async () => {
		await expect(
			createSchedule({
				cron: '0 3 * * *',
				action: 'mission',
				payload: { goal: 'Run a startup benchmark.' }
			})
		).rejects.toMatchObject({
			code: 'harness_authority_blocked',
			verdict: expect.objectContaining({
				reasonCodes: expect.arrayContaining(['missing_harness_authority'])
			})
		});
	});

	it('blocks schedule creation with bare VNext authority', async () => {
		await expect(
			createSchedule({
				cron: '0 3 * * *',
				action: 'mission',
				payload: { goal: 'Run a startup benchmark.' },
				executionAuthority: bareVNextScheduleAuthority('spawner.schedule.create', 'creates_schedule')
			})
		).rejects.toMatchObject({
			code: 'harness_authority_blocked',
			verdict: expect.objectContaining({
				source: 'turn_intent_vnext',
				reasonCodes: expect.arrayContaining(['native_governor_required'])
			})
		});
	});

	it('creates and deletes schedules only with matching Governor authority', async () => {
		const record = await createSchedule({
			cron: '0 3 * * *',
			action: 'mission',
			payload: { goal: 'Run a startup benchmark.' },
			executionAuthority: scheduleAuthority('spawner.schedule.create', 'creates_schedule')
		});

		expect(record.authority).toMatchObject({
			source: 'governor_decision',
			reasonCodes: []
		});
		expect(await listSchedules()).toHaveLength(1);

		await expect(deleteSchedule(record.id)).rejects.toMatchObject({
			code: 'harness_authority_blocked'
		});
		expect(await listSchedules()).toHaveLength(1);

		const ok = await deleteSchedule({
			id: record.id,
			executionAuthority: scheduleAuthority('spawner.schedule.delete', 'deletes_schedule')
		});
		expect(ok).toBe(true);
		expect(await listSchedules()).toHaveLength(0);
	});

	it('does not mint Governor authority when persisted scheduled missions fire', async () => {
		if (!testSpawnerDir) throw new Error('test state dir missing');
		process.env.SPARK_WORKSPACE_ROOT = testSpawnerDir;
		await mkdir(testSpawnerDir, { recursive: true });
		await writeFile(
			path.join(testSpawnerDir, 'schedules.json'),
			JSON.stringify({
				schedules: [
					{
						id: 'sched-governor-fire',
						cron: '0 3 * * *',
						action: 'mission',
						payload: { goal: 'Run a no-edit startup benchmark.', projectPath: 'scheduled-governor-test' },
						chatId: null,
						authority: {
							source: 'turn_intent_vnext',
							reasonCodes: [],
							traceId: 'turn-schedule-create'
						},
						createdAt: '2026-06-01T00:00:00.000Z',
						lastFiredAt: null,
						nextFireAt: '2000-01-01T00:00:00.000Z',
						fireCount: 0,
						lastStatus: null,
						enabled: true
					}
				]
			}),
			'utf-8'
		);

		const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
			new Response(JSON.stringify({ success: true, missionId: 'mission-governor-fire' }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		await runSchedulerTickForTests();

		expect(fetchMock).not.toHaveBeenCalled();

		const [record] = await listSchedules();
		expect(record.fireCount).toBe(1);
		expect(record.lastStatus).toContain('fail: scheduled mission fire requires fresh Governor authority');
	});
});
