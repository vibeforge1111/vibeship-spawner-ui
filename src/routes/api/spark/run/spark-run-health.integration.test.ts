import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PRIVATE_ENV = vi.hoisted((): Record<string, string | undefined> => ({
	SPARK_BRIDGE_API_KEY: 'bridge-key',
	MCP_API_KEY: 'mcp-key'
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

import { GET } from './+server';

function resetEnv() {
	PRIVATE_ENV.SPARK_BRIDGE_API_KEY = 'bridge-key';
	PRIVATE_ENV.MCP_API_KEY = 'mcp-key';
}

function event(url: string, clientAddress = '127.0.0.1'): RequestEvent {
	return {
		request: new Request(url, { headers: { accept: 'application/json' } }),
		url: new URL(url),
		getClientAddress: () => clientAddress,
		cookies: {
			get: vi.fn(),
			getAll: vi.fn(() => []),
			set: vi.fn(),
			delete: vi.fn(),
			serialize: vi.fn()
		}
	} as unknown as RequestEvent;
}

describe('/api/spark/run health auth', () => {
	afterEach(resetEnv);

	it('allows local loopback health checks without a key', async () => {
		const response = await GET(event('http://127.0.0.1:3333/api/spark/run?health=1') as never);

		expect(response.status).toBe(200);
	});

	it('keeps non-local health checks gated without credentials', async () => {
		const response = await GET(event('https://spawner.example.com/api/spark/run?health=1', '203.0.113.10') as never);

		expect(response.status).toBe(401);
	});
});
