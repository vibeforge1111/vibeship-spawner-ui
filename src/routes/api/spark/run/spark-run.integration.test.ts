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

import { POST } from './+server';

function routeEvent(body: unknown) {
	return {
		request: new Request('http://127.0.0.1/api/spark/run', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
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
			requestId: 'tg-spark-run-local'
		}) as never);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			success: true,
			requestId: 'tg-spark-run-local',
			providers: ['codex'],
			missionControlAccess: {
				mode: 'local-only',
				url: null,
				mobileReachable: false
			}
		});
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
});
