import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { PRIVATE_ENV } = vi.hoisted(() => ({
	PRIVATE_ENV: {
		SPARK_BRIDGE_API_KEY: '',
		MCP_API_KEY: '',
		MCP_ALLOWED_ORIGINS: ''
	} as Record<string, string>
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

import { GET } from './+server';

function routeEvent(url: string, init?: RequestInit, clientAddress = '127.0.0.1') {
	return {
		request: new Request(url, init),
		url: new URL(url),
		cookies: {
			get: () => undefined
		},
		getClientAddress: () => clientAddress
	};
}

describe('/api/providers', () => {
	beforeEach(() => {
		PRIVATE_ENV.SPARK_BRIDGE_API_KEY = '';
		PRIVATE_ENV.MCP_API_KEY = '';
		PRIVATE_ENV.MCP_ALLOWED_ORIGINS = '';
	});

	it('returns provider catalog on loopback without auth', async () => {
		const response = await GET(routeEvent('http://127.0.0.1/api/providers') as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(Array.isArray(body.providers)).toBe(true);
		expect(body.providers.length).toBeGreaterThan(0);
		expect(body).toHaveProperty('sparkDefaultProvider');
	});

	it('requires control auth outside loopback when a bridge key is configured', async () => {
		PRIVATE_ENV.SPARK_BRIDGE_API_KEY = 'bridge-secret';

		const response = await GET(
			routeEvent('https://example.com/api/providers', undefined, '203.0.113.10') as never
		);

		expect(response.status).toBe(401);
	});

	it('accepts bridge auth outside loopback', async () => {
		PRIVATE_ENV.SPARK_BRIDGE_API_KEY = 'bridge-secret';

		const response = await GET(
			routeEvent(
				'https://example.com/api/providers',
				{ headers: { 'x-api-key': 'bridge-secret' } },
				'203.0.113.10'
			) as never
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(Array.isArray(body.providers)).toBe(true);
	});
});
