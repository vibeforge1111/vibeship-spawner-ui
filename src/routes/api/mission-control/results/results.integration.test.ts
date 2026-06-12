import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';
import { providerRuntime, type ProviderMissionResultSnapshot } from '$lib/server/provider-runtime';

const TEST_API_KEY = 'mission-control-results-test-secret';
const originalMcpApiKey = process.env.MCP_API_KEY;

function restoreEnv(name: string, value: string | undefined) {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

function event(url: string, options: { auth?: boolean; clientAddress?: string } = {}) {
	const headers = new Headers();
	if (options.auth !== false) headers.set('x-api-key', TEST_API_KEY);
	return {
		request: new Request(url, { headers }),
		url: new URL(url),
		getClientAddress: () => options.clientAddress || '127.0.0.1'
	};
}

function providerResult(overrides: Partial<ProviderMissionResultSnapshot> = {}): ProviderMissionResultSnapshot {
	return {
		providerId: 'codex',
		status: 'completed',
		requestId: 'tg-build-results-test',
		traceRef: 'trace-results-test',
		response: 'private provider output',
		error: 'private provider error',
		durationMs: 1200,
		tokenUsage: { prompt: 10, completion: 20, total: 30 },
		startedAt: '2026-04-28T10:00:00.000Z',
		completedAt: '2026-04-28T10:01:00.000Z',
		...overrides
	};
}

describe('/api/mission-control/results integration', () => {
	beforeEach(() => {
		process.env.MCP_API_KEY = TEST_API_KEY;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		restoreEnv('MCP_API_KEY', originalMcpApiKey);
	});

	it('returns full provider results with control auth', async () => {
		vi.spyOn(providerRuntime, 'getMissionResults').mockReturnValue([providerResult()]);

		const response = await GET(
			event('http://127.0.0.1/api/mission-control/results?missionId=mission-results-test') as never
		);
		expect(response.status).toBe(200);
		const body = await response.json();

		expect(body.authorityBoundary).toBeUndefined();
		expect(body.results[0]).toMatchObject({
			providerId: 'codex',
			response: 'private provider output',
			error: 'private provider error',
			tokenUsage: { prompt: 10, completion: 20, total: 30 }
		});
	});

	it('redacts provider payload details for local no-key reads', async () => {
		vi.spyOn(providerRuntime, 'getMissionResults').mockReturnValue([providerResult()]);

		const response = await GET(
			event('http://127.0.0.1/api/mission-control/results?missionId=mission-results-test', {
				auth: false
			}) as never
		);
		expect(response.status).toBe(200);
		const body = await response.json();

		expect(body.authorityBoundary).toMatchObject({
			payload: 'status_only',
			response: 'requires_control_auth',
			error: 'requires_control_auth',
			tokenUsage: 'requires_control_auth'
		});
		expect(body.results[0]).toMatchObject({
			providerId: 'codex',
			status: 'completed',
			requestId: 'tg-build-results-test',
			traceRef: 'trace-results-test',
			durationMs: 1200,
			responseAvailable: true,
			errorAvailable: true,
			tokenUsageAvailable: true
		});
		expect(body.results[0].response).toBeUndefined();
		expect(body.results[0].error).toBeUndefined();
		expect(body.results[0].tokenUsage).toBeUndefined();
		expect(JSON.stringify(body)).not.toContain('private provider output');
		expect(JSON.stringify(body)).not.toContain('private provider error');
	});

	it('rejects non-local no-key reads before exposing provider result status', async () => {
		const response = await GET(
			event('https://spawner.example.com/api/mission-control/results?missionId=mission-results-test', {
				auth: false,
				clientAddress: '203.0.113.10'
			}) as never
		);

		expect(response.status).toBe(401);
	});
});
