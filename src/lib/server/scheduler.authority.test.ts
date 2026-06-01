import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
	createSchedule,
	deleteSchedule,
	listSchedules,
	resetSchedulerForTests
} from './scheduler';
import { buildMachineOriginPolicy, type SparkMutationClass } from './harness-authority';

let testSpawnerDir: string | null = null;

function scheduleAuthority(toolName: string, mutationClass: SparkMutationClass) {
	return buildMachineOriginPolicy({
		origin: 'spawner-ui.test',
		source: 'scheduler-authority-test',
		reason: 'Focused scheduler authority regression.',
		allowedTools: [toolName],
		mutationClassesAllowed: [mutationClass]
	});
}

describe('scheduler Harness authority', () => {
	beforeEach(async () => {
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-scheduler-authority-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		resetSchedulerForTests();
	});

	afterEach(async () => {
		resetSchedulerForTests();
		delete process.env.SPAWNER_STATE_DIR;
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

	it('creates and deletes schedules only with matching Harness authority', async () => {
		const record = await createSchedule({
			cron: '0 3 * * *',
			action: 'mission',
			payload: { goal: 'Run a startup benchmark.' },
			executionAuthority: scheduleAuthority('spawner.schedule.create', 'creates_schedule')
		});

		expect(record.authority).toMatchObject({
			source: 'machine_origin_policy',
			origin: 'spawner-ui.test'
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
});
