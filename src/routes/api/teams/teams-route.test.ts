import { describe, expect, it } from 'vitest';
import { POST } from './+server';

describe('POST /api/teams', () => {
	it('returns 400 for invalid JSON bodies', async () => {
		const request = new Request('http://localhost:3333/api/teams', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{'
		});

		const response = await POST({ request } as never);
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ success: false, error: 'Invalid JSON body' });
	});

	it('returns 400 for non-object JSON bodies', async () => {
		const request = new Request('http://localhost:3333/api/teams', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(['not-an-object'])
		});

		const response = await POST({ request } as never);
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ success: false, error: 'Invalid request body' });
	});

	it('returns 400 when action is missing', async () => {
		const request = new Request('http://localhost:3333/api/teams', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({})
		});

		const response = await POST({ request } as never);
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ success: false, error: 'Missing action' });
	});

	it('returns 400 when division_id is missing for get_division', async () => {
		const request = new Request('http://localhost:3333/api/teams', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action: 'get_division' })
		});

		const response = await POST({ request } as never);
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ success: false, error: 'Missing division_id' });
	});
});

