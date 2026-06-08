import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { DELETE, GET, POST } from './+server';
import { resetSchedulerForTests } from '$lib/server/scheduler';
import {
	buildServerGovernorDecisionAuthority,
	buildServerTurnIntentVNextAuthority,
	type SparkMutationClass
} from '$lib/server/harness-authority';

let testSpawnerDir: string | null = null;
const TEST_API_KEY = 'scheduled-route-authority-test-secret';
const originalMcpApiKey = process.env.MCP_API_KEY;

function event(url: string, body?: unknown, method = 'POST') {
  return {
    request: new Request(url, {
      method,
      headers: { 'content-type': 'application/json', 'x-api-key': TEST_API_KEY },
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
		url: new URL(url),
		getClientAddress: () => '127.0.0.1'
	};
}

function unauthenticatedEvent(url: string, method = 'GET', clientAddress = '127.0.0.1') {
	return {
		request: new Request(url, { method, headers: { accept: 'application/json' } }),
		url: new URL(url),
		getClientAddress: () => clientAddress
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
    process.env.MCP_API_KEY = TEST_API_KEY;
    resetSchedulerForTests();
  });

	afterEach(async () => {
    resetSchedulerForTests();
    delete process.env.SPAWNER_STATE_DIR;
    if (originalMcpApiKey === undefined) delete process.env.MCP_API_KEY;
    else process.env.MCP_API_KEY = originalMcpApiKey;
		if (testSpawnerDir && existsSync(testSpawnerDir)) {
			await rm(testSpawnerDir, { recursive: true, force: true });
		}
		testSpawnerDir = null;
	});

	it('allows local schedule reads without opening schedule mutations', async () => {
		const localRead = await GET(unauthenticatedEvent('http://127.0.0.1:3333/api/scheduled') as never);
		expect(localRead.status).toBe(200);

		const nonLocalRead = await GET(
			unauthenticatedEvent('https://spawner.example.com/api/scheduled', 'GET', '203.0.113.10') as never
		);
		expect(nonLocalRead.status).toBe(401);

		const localCreate = await POST(
			unauthenticatedEvent('http://127.0.0.1:3333/api/scheduled', 'POST') as never
		);
		expect(localCreate.status).toBe(401);
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

  it('blocks source-only Spawner UI schedule actions without Harness authority', async () => {
    const createResponse = await POST(
      event('http://127.0.0.1:3333/api/scheduled', {
        cron: '0 3 * * *',
        action: 'mission',
        payload: { goal: 'Run a startup benchmark.' },
        source: 'mission-board.schedule.create'
      }) as never
    );

    expect(createResponse.status).toBe(409);
    const created = await createResponse.json();
    expect(created.code).toBe('harness_authority_blocked');
    expect(created.authority.reasonCodes).toContain('missing_harness_authority');

    const allowedCreate = await POST(
      event('http://127.0.0.1:3333/api/scheduled', {
        cron: '0 3 * * *',
        action: 'mission',
        payload: { goal: 'Run a startup benchmark.' },
        executionAuthority: authority('spawner.schedule.create', 'creates_schedule')
      }) as never
    );
    const allowed = await allowedCreate.json();

    const deleteResponse = await DELETE(
      event(`http://127.0.0.1:3333/api/scheduled?id=${encodeURIComponent(allowed.schedule.id)}`, {
        source: 'mission-board.schedule.delete'
      }, 'DELETE') as never
    );

    expect(deleteResponse.status).toBe(409);
    const deleted = await deleteResponse.json();
    expect(deleted.code).toBe('harness_authority_blocked');
    expect(deleted.authority.reasonCodes).toContain('missing_harness_authority');
  });
});
