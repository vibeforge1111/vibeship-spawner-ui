import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

vi.mock('$env/dynamic/private', () => ({
	env: {
		EVENTS_API_KEY: 'events-secret',
		MCP_API_KEY: '',
		EVENTS_ALLOWED_ORIGINS: ''
	}
}));

vi.mock('$lib/server/mission-control-relay', () => ({
	relayMissionControlEvent: vi.fn()
}));

vi.mock('$lib/server/provider-runtime', () => ({
	providerRuntime: {
		markMissionTerminalFromLifecycleEvent: vi.fn()
	}
}));

import { GET, POST } from './+server';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';

let testSpawnerDir: string | null = null;

afterEach(async () => {
	delete process.env.SPAWNER_STATE_DIR;
	vi.mocked(relayMissionControlEvent).mockClear();
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
	testSpawnerDir = null;
});

function createEvent(url: string, init?: RequestInit) {
	return {
		request: new Request(url, init),
		getClientAddress: () => '203.0.113.1'
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
							tasks: [{ id: 'TAS-1', title: 'Store result consistently' }]
						}
					}
				})
			})
		);

		expect(response.status).toBe(200);
		expect(existsSync(path.join(testSpawnerDir, 'results', `${requestId}.json`))).toBe(true);
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
