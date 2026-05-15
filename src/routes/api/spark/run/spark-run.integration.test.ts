import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/provider-runtime', () => ({
	providerRuntime: {
		dispatch: vi.fn(async ({ executionPack }) => ({
			success: true,
			missionId: executionPack.missionId,
			sessions: { codex: { status: 'running' } },
			startedAt: '2026-05-04T10:00:00.000Z'
		})),
		getMissionResults: vi.fn(() => [])
	}
}));

import { GET, POST } from './+server';
import { providerRuntime } from '$lib/server/provider-runtime';

function routeEvent(body: unknown, method = 'POST') {
	return {
		request: new Request('http://127.0.0.1/api/spark/run', {
			method,
			headers: { 'Content-Type': 'application/json' },
			...(method === 'POST' ? { body: JSON.stringify(body) } : {})
		}),
		url: new URL('http://127.0.0.1/api/spark/run'),
		getClientAddress: () => '127.0.0.1'
	};
}

describe('/api/spark/run integration', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		delete process.env.SPAWNER_MISSION_CONTROL_PUBLIC_URL;
	});

	it('returns local-only Mission Control access for Telegram callers by default', async () => {
		const response = await POST(routeEvent({
			goal: 'Build a tiny Telegram smoke app.',
			providers: ['codex'],
			requestId: 'tg-spark-run-local',
			traceRef: 'trace:telegram-run:tg-spark-run-local'
		}) as never);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			success: true,
			requestId: 'tg-spark-run-local',
			traceRef: 'trace:telegram-run:tg-spark-run-local',
			providers: ['codex'],
			missionControlAccess: {
				mode: 'local-only',
				url: null,
				mobileReachable: false
			}
		});
	});

	it('exposes a non-dispatching route health probe', async () => {
		const dispatch = vi.mocked(providerRuntime.dispatch);
		dispatch.mockClear();

		const response = await GET(routeEvent(null, 'GET') as never);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			ok: true,
			route: '/api/spark/run',
			check: 'route-loaded',
			dispatchesMission: false
		});
		expect(dispatch).not.toHaveBeenCalled();
	});

	it('returns hosted Mission Control access when a mobile URL is configured', async () => {
		process.env.SPAWNER_MISSION_CONTROL_PUBLIC_URL = 'https://mission.sparkswarm.ai';

		const response = await POST(routeEvent({
			goal: 'Build a tiny Telegram hosted smoke app.',
			providers: ['codex'],
			requestId: 'tg-spark-run-hosted'
		}) as never);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.missionControlAccess).toMatchObject({
			mode: 'hosted',
			mobileReachable: true
		});
		expect(body.missionControlAccess.url).toBe(`https://mission.sparkswarm.ai/missions/${body.missionId}`);
	});

	it('uses a provided missionName instead of deriving the board title from the goal', async () => {
		const dispatch = vi.mocked(providerRuntime.dispatch);
		dispatch.mockClear();

		const response = await POST(routeEvent({
			goal: 'Deeply analyze the local Spark stack before creating the chip.',
			missionName: 'Spark Bug Recognition Domain Chip',
			providers: ['codex'],
			requestId: 'tg-context-title'
		}) as never);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.missionName).toBe('Spark Bug Recognition Domain Chip');
		expect(dispatch).toHaveBeenCalledTimes(1);
	});
});
