import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from './+server';

const TEST_API_KEY = 'mission-control-status-test-secret';
const originalMcpApiKey = process.env.MCP_API_KEY;

function restoreEnv(name: string, value: string | undefined) {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

function event(url: string) {
	return {
		request: new Request(url, { headers: { 'x-api-key': TEST_API_KEY } }),
		url: new URL(url),
		getClientAddress: () => '127.0.0.1'
	};
}

describe('/api/mission-control/status integration', () => {
	beforeEach(() => {
		process.env.MCP_API_KEY = TEST_API_KEY;
	});

	afterEach(() => {
		delete process.env.SPAWNER_MISSION_CONTROL_PUBLIC_URL;
		restoreEnv('MCP_API_KEY', originalMcpApiKey);
	});

	it('returns local-only Mission Control access by default', async () => {
		const response = await GET(
			event('http://127.0.0.1/api/mission-control/status?missionId=mission-status-local') as never
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.missionControlAccess).toMatchObject({
			mode: 'local-only',
			url: null,
			mobileReachable: false
		});
	});

	it('returns hosted Mission Control access when a public URL is configured', async () => {
		process.env.SPAWNER_MISSION_CONTROL_PUBLIC_URL = 'https://mission.sparkswarm.ai/app';

		const response = await GET(
			event('http://127.0.0.1/api/mission-control/status?missionId=mission-status-hosted') as never
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.missionControlAccess).toMatchObject({
			mode: 'hosted',
			url: 'https://mission.sparkswarm.ai/app/missions/mission-status-hosted',
			mobileReachable: true
		});
	});
});
