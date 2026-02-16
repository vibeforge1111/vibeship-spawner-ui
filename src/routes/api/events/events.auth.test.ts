import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {
		EVENTS_API_KEY: 'events-secret',
		MCP_API_KEY: '',
		EVENTS_ALLOWED_ORIGINS: ''
	}
}));

import { GET, POST } from './+server';

function createEvent(url: string, init?: RequestInit) {
	return {
		request: new Request(url, init),
		getClientAddress: () => '203.0.113.1'
	} as never;
}

describe('/api/events auth', () => {
	it('accepts configured API key through query param for SSE clients', async () => {
		const response = await GET(
			createEvent('https://example.com/api/events?apiKey=events-secret', { method: 'GET' })
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('set-cookie')).toContain('spawner_events_api_key=');
	});

	it('rejects non-local requests without API key when one is configured', async () => {
		const response = await GET(createEvent('https://example.com/api/events', { method: 'GET' }));

		expect(response.status).toBe(401);
	});

	it('accepts POST events with x-api-key and persists auth cookie', async () => {
		const response = await POST(
			createEvent('https://example.com/api/events', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': 'events-secret'
				},
				body: JSON.stringify({
					type: 'progress',
					data: { ok: true }
				})
			})
		);

		expect(response.status).toBe(200);
		expect(response.headers.get('set-cookie')).toContain('spawner_events_api_key=');
	});
});
