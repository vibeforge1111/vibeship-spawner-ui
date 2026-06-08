import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PRIVATE_ENV = vi.hoisted((): Record<string, string | undefined> => ({
	EVENTS_API_KEY: 'events-key',
	MCP_API_KEY: 'mcp-key'
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

import { GET, POST } from './+server';

function resetEnv() {
	PRIVATE_ENV.EVENTS_API_KEY = 'events-key';
	PRIVATE_ENV.MCP_API_KEY = 'mcp-key';
	PRIVATE_ENV.EVENTS_ALLOWED_ORIGINS = '';
}

function event(url: string, init: RequestInit = {}, clientAddress = '127.0.0.1'): RequestEvent {
	const headers = new Headers(init.headers);
	if (!headers.has('accept')) headers.set('accept', 'application/json');
	return {
		request: new Request(url, { ...init, headers }),
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

describe('/api/sentinel/dispatch auth boundary', () => {
	afterEach(resetEnv);

	it('allows local reads without opening local dispatch writes', async () => {
		const localRead = await GET(event('http://127.0.0.1:3333/api/sentinel/dispatch') as never);
		expect(localRead.status).toBe(200);

		const localWrite = await POST(
			event('http://127.0.0.1:3333/api/sentinel/dispatch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ actions: [] })
			}) as never
		);
		expect(localWrite.status).toBe(401);
	});

	it('keeps non-local reads gated without credentials', async () => {
		const response = await GET(
			event('https://spawner.example.com/api/sentinel/dispatch', {}, '203.0.113.10') as never
		);

		expect(response.status).toBe(401);
	});
});
