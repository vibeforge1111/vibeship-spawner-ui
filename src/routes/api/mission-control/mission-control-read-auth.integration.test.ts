import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PRIVATE_ENV = vi.hoisted((): Record<string, string | undefined> => ({
	EVENTS_API_KEY: 'events-key',
	MCP_API_KEY: 'mcp-key'
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

import { GET as getBoard } from './board/+server';
import { GET as getStatus } from './status/+server';
import { GET as getTrace } from './trace/+server';
import { GET as getResults } from './results/+server';

function resetEnv() {
	PRIVATE_ENV.EVENTS_API_KEY = 'events-key';
	PRIVATE_ENV.MCP_API_KEY = 'mcp-key';
	PRIVATE_ENV.EVENTS_ALLOWED_ORIGINS = '';
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

describe('mission-control read route auth', () => {
	afterEach(resetEnv);

	it('allows local loopback reads without a key', async () => {
		await expect(getBoard(event('http://127.0.0.1:3333/api/mission-control/board') as never)).resolves.toMatchObject({ status: 200 });
		await expect(getStatus(event('http://127.0.0.1:3333/api/mission-control/status') as never)).resolves.toMatchObject({ status: 200 });
		await expect(getTrace(event('http://127.0.0.1:3333/api/mission-control/trace') as never)).resolves.toMatchObject({ status: 200 });

		const missingResults = await getResults(event('http://127.0.0.1:3333/api/mission-control/results') as never);
		expect(missingResults.status).toBe(400);
	});

	it('keeps non-local reads gated without credentials', async () => {
		const response = await getBoard(event('https://spawner.example.com/api/mission-control/board', '203.0.113.10') as never);

		expect(response.status).toBe(401);
	});
});
