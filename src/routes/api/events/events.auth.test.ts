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

import { GET, POST } from './+server';

let testSpawnerDir: string | null = null;

afterEach(async () => {
	delete process.env.SPAWNER_STATE_DIR;
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
});
