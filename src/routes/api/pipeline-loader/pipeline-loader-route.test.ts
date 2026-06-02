import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import * as state from '$lib/server/spawner-state';

describe('POST /api/pipeline-loader', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(state, 'spawnerStateDir').mockReturnValue('C:\\tmp\\spark-spawner-state');
	});

	it('returns 400 for invalid JSON', async () => {
		const request = new Request('http://localhost:3333/api/pipeline-loader', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{'
		});

		const response = await POST({ request } as never);
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: 'invalid json' });
	});

	it('returns 400 for non-object JSON bodies', async () => {
		const request = new Request('http://localhost:3333/api/pipeline-loader', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify([])
		});

		const response = await POST({ request } as never);
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: 'invalid request body' });
	});

	it('returns 400 when pipelineId/pipelineName are missing', async () => {
		const request = new Request('http://localhost:3333/api/pipeline-loader', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pipelineId: '', pipelineName: '  ' })
		});

		const response = await POST({ request } as never);
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: 'pipelineId and pipelineName are required' });
	});
});

