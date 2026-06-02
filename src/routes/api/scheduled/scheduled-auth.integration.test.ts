import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST, DELETE } from './+server';

function reqEvent(method: string, url: string, body?: unknown) {
	const request = new Request(url, {
		method,
		headers: body ? { 'Content-Type': 'application/json' } : {},
		body: body ? JSON.stringify(body) : undefined
	});
	return { request, url: new URL(url) };
}

describe('/api/scheduled', () => {
	describe('auth', () => {
		it('rejects non-loopback GET without auth', async () => {
			const response = await GET(reqEvent('GET', 'http://example.com/api/scheduled') as never);
			expect(response.status).toBe(401);
		});

		it('rejects non-loopback POST without auth', async () => {
			const response = await POST(reqEvent('POST', 'http://example.com/api/scheduled', {
				action: 'mission',
				cron: '0 9 * * *'
			}) as never);
			expect(response.status).toBe(401);
		});

		it('rejects non-loopback DELETE without auth', async () => {
			const response = await DELETE(reqEvent('DELETE', 'http://example.com/api/scheduled?id=test') as never);
			expect(response.status).toBe(401);
		});

		it('allows loopback GET (bypass)', async () => {
			const response = await GET(reqEvent('GET', 'http://localhost/api/scheduled') as never);
			expect(response.status).toBe(200);
		});
	});
});
