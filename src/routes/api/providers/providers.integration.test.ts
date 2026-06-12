import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from './+server';

const TEST_API_KEY = 'providers-route-test-secret';
const originalMcpApiKey = process.env.MCP_API_KEY;

function routeEvent(
	options: {
		apiKey?: string | null;
		url?: string;
		clientAddress?: string;
	} = {}
) {
	const headers = new Headers();
	if (options.apiKey !== null) headers.set('x-api-key', options.apiKey || TEST_API_KEY);
	const url = options.url || 'http://localhost/api/providers';
	return {
		request: new Request(url, { headers }),
		url: new URL(url),
		getClientAddress: () => options.clientAddress || '127.0.0.1',
		cookies: { get: () => undefined }
	};
}

describe('/api/providers integration', () => {
	beforeEach(() => {
		process.env.MCP_API_KEY = TEST_API_KEY;
	});

	afterEach(() => {
		if (originalMcpApiKey === undefined) delete process.env.MCP_API_KEY;
		else process.env.MCP_API_KEY = originalMcpApiKey;
	});

	it('returns full provider operator details with control auth', async () => {
		const response = await GET(routeEvent() as never);
		expect(response.status).toBe(200);
		const body = await response.json();

		expect(body.authorityBoundary).toBeUndefined();
		expect(Array.isArray(body.providers)).toBe(true);
		expect(body.providers.length).toBeGreaterThan(0);
		expect(body.providers[0]).toHaveProperty('baseUrl');
		expect(body.providers[0]).toHaveProperty('commandTemplate');
		expect(body.providers[0]).toHaveProperty('sparkExecutionBridge');
		expect(body.providers[0]).toHaveProperty('executesFilesystem');
		expect(body.providers[0]).toHaveProperty('apiKeyEnv');
		expect(body.providers[0]).toHaveProperty('cliPath');
	});

	it('redacts launch and secret-location details for local no-key reads', async () => {
		const response = await GET(routeEvent({ apiKey: null }) as never);
		expect(response.status).toBe(200);
		const body = await response.json();

		expect(body.authorityBoundary).toMatchObject({
			payload: 'status_only',
			commandTemplate: 'requires_control_auth',
			sparkExecutionBridge: 'requires_control_auth',
			apiKeyEnv: 'requires_control_auth',
			cliPath: 'requires_control_auth',
			baseUrl: 'requires_control_auth',
			executesFilesystem: 'requires_control_auth'
		});
		expect(Array.isArray(body.providers)).toBe(true);
		expect(body.providers.length).toBeGreaterThan(0);
		for (const provider of body.providers) {
			expect(provider).toHaveProperty('id');
			expect(provider).toHaveProperty('configured');
			expect(provider.commandTemplate).toBeUndefined();
			expect(provider.sparkExecutionBridge).toBeUndefined();
			expect(provider.apiKeyEnv).toBeUndefined();
			expect(provider.cliPath).toBeUndefined();
			expect(provider.baseUrl).toBeUndefined();
			expect(provider.executesFilesystem).toBeUndefined();
		}
	});

	it('rejects non-local no-key reads before exposing provider status', async () => {
		const response = await GET(
			routeEvent({
				apiKey: null,
				url: 'https://spawner.example.com/api/providers',
				clientAddress: '203.0.113.10'
			}) as never
		);

		expect(response.status).toBe(401);
	});
});
