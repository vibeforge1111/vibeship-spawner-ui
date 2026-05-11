import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

const privateEnv = vi.hoisted(() => ({
	EVENTS_API_KEY: 'events-secret',
	MCP_API_KEY: '',
	EVENTS_ALLOWED_ORIGINS: '',
	SPARK_LIVE_CONTAINER: undefined as string | undefined
}));

vi.mock('$env/dynamic/private', () => ({
	env: privateEnv
}));

vi.mock('$lib/server/mission-control-relay', () => ({
	relayMissionControlEvent: vi.fn()
}));

vi.mock('$lib/server/provider-runtime', () => ({
	providerRuntime: {
		markMissionTerminalFromLifecycleEvent: vi.fn()
	}
}));

import { GET, OPTIONS, POST } from './+server';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';

let testSpawnerDir: string | null = null;

afterEach(async () => {
	delete process.env.SPAWNER_STATE_DIR;
	privateEnv.SPARK_LIVE_CONTAINER = undefined;
	vi.mocked(relayMissionControlEvent).mockClear();
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
	testSpawnerDir = null;
});

function createEvent(url: string, init?: RequestInit, clientAddress = '203.0.113.1') {
	return {
		request: new Request(url, init),
		getClientAddress: () => clientAddress
	} as never;
}

describe('/api/events auth', () => {
	it('accepts configured API key through query param for SSE clients', async () => {
		const response = await GET(
			createEvent('https://example.com/api/events?apiKey=events-secret', { method: 'GET' })
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('set-cookie')).toContain('spawner_events_api_key=');
	});

	it('rejects query API keys in hosted deployments', async () => {
		privateEnv.SPARK_LIVE_CONTAINER = '1';

		const response = await GET(
			createEvent('https://example.com/api/events?apiKey=events-secret', { method: 'GET' })
		);

		expect(response.status).toBe(401);
		expect(response.headers.get('set-cookie')).toBeNull();
	});

	it('accepts header API keys in hosted deployments', async () => {
		privateEnv.SPARK_LIVE_CONTAINER = '1';

		const response = await GET(
			createEvent('https://example.com/api/events', {
				method: 'GET',
				headers: { 'x-api-key': 'events-secret' }
			})
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('set-cookie')).toContain('spawner_events_api_key=');
	});

	it('rejects non-local requests without API key when one is configured', async () => {
		const response = await GET(createEvent('https://example.com/api/events', { method: 'GET' }));

		expect(response.status).toBe(401);
	});

	it('accepts the generic hosted UI events cookie', async () => {
		const response = await GET(
			createEvent('https://example.com/api/events', {
				method: 'GET',
				headers: {
					cookie: 'spawner_events_api_key=events-secret'
				}
			})
		);

		expect(response.status).toBe(200);
	});

	it('accepts a loopback theatre SSE origin without an events key', async () => {
		const response = await GET(
			createEvent(
				'http://localhost:3333/api/events',
				{
					method: 'GET',
					headers: {
						origin: 'http://localhost:5600'
					}
				},
				'127.0.0.1'
			)
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5600');
	});

	it('answers loopback theatre preflight for event posts', async () => {
		const response = await OPTIONS(
			createEvent(
				'http://localhost:3333/api/events',
				{
					method: 'OPTIONS',
					headers: {
						origin: 'http://localhost:5600',
						'access-control-request-method': 'POST',
						'access-control-request-headers': 'content-type'
					}
				},
				'127.0.0.1'
			)
		);

		expect(response.status).toBe(204);
		expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5600');
		expect(response.headers.get('access-control-allow-methods')).toContain('POST');
	});

	it('accepts POST events with x-api-key and persists auth cookie', async () => {
		const response = await POST(
			createEvent('https://example.com/api/events', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': 'events-secret'
				},
				body: JSON.stringify({
					type: 'progress',
					data: { ok: true }
				})
			})
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('set-cookie')).toContain('spawner_events_api_key=');
	});

	it('stores PRD analysis results under configured Spawner state directory', async () => {
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-events-state-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		const requestId = 'events-state-dir-test';
		const traceRef = 'trace:spawner-prd:events-state-dir-test';
		await writeFile(path.join(testSpawnerDir, 'pending-request.json'), JSON.stringify({ requestId, traceRef }), 'utf-8');

		const response = await POST(
			createEvent('https://example.com/api/events', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': 'events-secret'
				},
				body: JSON.stringify({
					type: 'prd_analysis_complete',
					source: 'codex-auto',
					data: {
						requestId,
						result: {
							success: true,
							projectName: 'Events State Dir Test',
							projectType: 'clarification-understanding',
							complexity: 'simple',
							infrastructure: { needsAuth: false, needsDatabase: false, needsAPI: false },
							techStack: { framework: 'Existing Spawner UI', language: 'TypeScript' },
							tasks: [{ id: 'TAS-1', title: 'Store result consistently', skills: [], dependencies: [] }],
							skills: [],
							executionPrompt: 'Store result consistently.'
						}
					}
				})
			})
		);

		expect(response.status).toBe(200);
		expect(existsSync(path.join(testSpawnerDir, 'results', `${requestId}.json`))).toBe(true);
		const stored = await readFile(path.join(testSpawnerDir, 'results', `${requestId}.json`), 'utf-8');
		const storedJson = JSON.parse(stored);
		expect(storedJson.traceRef).toBe(traceRef);
		expect(storedJson.metadata.traceRef).toBe(traceRef);
		expect(stored).not.toContain('executionPrompt');
		expect(stored).not.toContain('Store result consistently.');
	});

	it('adds Telegram relay metadata to provider lifecycle events from the current canvas load', async () => {
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-events-relay-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		await import('fs/promises').then(({ writeFile }) =>
			writeFile(
				path.join(testSpawnerDir!, 'last-canvas-load.json'),
				JSON.stringify({
					relay: {
						missionId: 'mission-relay-test',
						chatId: '8319079055',
						userId: '8319079055',
						requestId: 'tg-build-test',
						goal: 'Build a tiny app',
						telegramRelay: { port: 8789, profile: 'spark-agi' }
					}
				}),
				'utf-8'
			)
		);

		const response = await POST(
			createEvent('https://example.com/api/events', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': 'events-secret'
				},
				body: JSON.stringify({
					type: 'task_started',
					missionId: 'mission-relay-test',
					source: 'codex',
					taskId: 'T1',
					taskName: 'Scaffold'
				})
			})
		);

		expect(response.status).toBe(200);
		expect(relayMissionControlEvent).toHaveBeenCalledWith(
			expect.objectContaining({
				missionId: 'mission-relay-test',
				data: expect.objectContaining({
					chatId: '8319079055',
					userId: '8319079055',
					requestId: 'tg-build-test',
					telegramRelay: { port: 8789, profile: 'spark-agi' }
				})
			})
		);
	});
});
