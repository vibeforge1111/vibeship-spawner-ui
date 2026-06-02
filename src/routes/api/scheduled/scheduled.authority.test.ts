import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { DELETE, POST } from './+server';
import { resetSchedulerForTests } from '$lib/server/scheduler';
import {
	buildServerGovernorDecisionAuthority,
	buildServerTurnIntentVNextAuthority,
	type SparkMutationClass
} from '$lib/server/harness-authority';

let testSpawnerDir: string | null = null;

function event(url: string, body?: unknown, method = 'POST') {
	return {
		request: new Request(url, {
			method,
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		}),
		url: new URL(url),
		getClientAddress: () => '127.0.0.1'
	};
}

function authority(toolName: string, mutationClass: SparkMutationClass) {
	return buildServerGovernorDecisionAuthority({
		source: 'scheduled-route-authority-test',
		reason: 'Focused scheduled route authority regression.',
		toolName,
		mutationClass,
		requestId: `scheduled-route-authority-test-${toolName}`,
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test'
	});
}

function bareVNextAuthority(toolName: string, mutationClass: SparkMutationClass) {
	return buildServerTurnIntentVNextAuthority({
		source: 'scheduled-route-authority-test',
		reason: 'Focused scheduled route authority regression.',
		toolName,
		mutationClass,
		requestId: `scheduled-route-authority-test-${toolName}`,
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test'
	});
}

describe('/api/scheduled authority contract', () => {
	beforeEach(async () => {
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-scheduled-route-authority-'));
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
		const response = await POST(
			event('http://127.0.0.1:3333/api/scheduled', {
				cron: '0 3 * * *',
				action: 'mission',
				payload: { goal: 'Run a startup benchmark.' }
			}) as never
		);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.reasonCodes).toContain('missing_harness_authority');
	});

	it('blocks schedule creation with bare VNext authority', async () => {
		const response = await POST(
			event('http://127.0.0.1:3333/api/scheduled', {
				cron: '0 3 * * *',
				action: 'mission',
				payload: { goal: 'Run a startup benchmark.' },
				executionAuthority: bareVNextAuthority('spawner.schedule.create', 'creates_schedule')
			}) as never
		);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.source).toBe('turn_intent_vnext');
		expect(body.authority.reasonCodes).toContain('native_governor_required');
	});

	it('allows schedule creation and deletion with matching Governor authority', async () => {
		const createResponse = await POST(
			event('http://127.0.0.1:3333/api/scheduled', {
				cron: '0 3 * * *',
				action: 'mission',
				payload: { goal: 'Run a startup benchmark.' },
				executionAuthority: authority('spawner.schedule.create', 'creates_schedule')
			}) as never
		);

		expect(createResponse.status).toBe(200);
		const created = await createResponse.json();
		expect(created.ok).toBe(true);
		const scheduleId = created.schedule.id;

		const blockedDelete = await DELETE(
			event(`http://127.0.0.1:3333/api/scheduled?id=${encodeURIComponent(scheduleId)}`, undefined, 'DELETE') as never
		);
		expect(blockedDelete.status).toBe(409);

		const deleteResponse = await DELETE(
			event(`http://127.0.0.1:3333/api/scheduled?id=${encodeURIComponent(scheduleId)}`, {
				executionAuthority: authority('spawner.schedule.delete', 'deletes_schedule')
			}, 'DELETE') as never
		);

		expect(deleteResponse.status).toBe(200);
		const deleted = await deleteResponse.json();
		expect(deleted.ok).toBe(true);
	});
});
