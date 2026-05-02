import { describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted(() => ({
	SPARK_BRIDGE_API_KEY: '',
	EVENTS_API_KEY: '',
	MCP_API_KEY: ''
}));

vi.mock('$env/dynamic/private', () => ({
	env: privateEnv
}));

import { requireControlAuth } from './mcp-auth';

function createEvent(headers: Record<string, string> = {}) {
	return {
		request: new Request('https://spawner.example.test/api/mission-control/board', {
			headers
		}),
		getClientAddress: () => '203.0.113.10'
	} as never;
}

describe('requireControlAuth', () => {
	it('accepts an ordered list of hosted service keys', () => {
		privateEnv.SPARK_BRIDGE_API_KEY = '';
		privateEnv.EVENTS_API_KEY = '';
		privateEnv.MCP_API_KEY = 'mcp-secret';

		const unauthorized = requireControlAuth(createEvent({ 'x-api-key': 'mcp-secret' }), {
			surface: 'MissionControlBoard',
			apiKeyEnvVar: 'SPARK_BRIDGE_API_KEY',
			fallbackApiKeyEnvVars: ['EVENTS_API_KEY', 'MCP_API_KEY'],
			allowLoopbackWithoutKey: false
		});

		expect(unauthorized).toBeNull();
	});

	it('keeps existing configured hosted service keys valid when a bridge key is added', () => {
		privateEnv.SPARK_BRIDGE_API_KEY = 'bridge-secret';
		privateEnv.EVENTS_API_KEY = 'events-secret';
		privateEnv.MCP_API_KEY = 'mcp-secret';

		const eventsUnauthorized = requireControlAuth(createEvent({ 'x-api-key': 'events-secret' }), {
			surface: 'MissionControlBoard',
			apiKeyEnvVar: 'SPARK_BRIDGE_API_KEY',
			fallbackApiKeyEnvVars: ['EVENTS_API_KEY', 'MCP_API_KEY'],
			allowLoopbackWithoutKey: false
		});
		const bridgeUnauthorized = requireControlAuth(createEvent({ 'x-api-key': 'bridge-secret' }), {
			surface: 'MissionControlBoard',
			apiKeyEnvVar: 'SPARK_BRIDGE_API_KEY',
			fallbackApiKeyEnvVars: ['EVENTS_API_KEY', 'MCP_API_KEY'],
			allowLoopbackWithoutKey: false
		});

		expect(eventsUnauthorized).toBeNull();
		expect(bridgeUnauthorized).toBeNull();
	});
});
