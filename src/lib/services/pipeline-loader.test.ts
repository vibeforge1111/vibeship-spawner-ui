import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({
	browser: true
}));

import { getPendingLoad, type PendingPipelineLoad } from './pipeline-loader';

describe('pipeline-loader service', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns pending load payload from API', async () => {
		const mockLoad: PendingPipelineLoad = {
			pipelineId: 'pipe-test-1',
			pipelineName: 'Test Pipeline',
			nodes: [],
			connections: [],
			source: 'prd',
			timestamp: new Date().toISOString()
		};

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ pending: true, load: mockLoad })
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await getPendingLoad();

		expect(result).toEqual(mockLoad);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith('/api/pipeline-loader', { method: 'GET' });
	});

	it('passes explicit pipeline filters through to the API', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ pending: false })
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await getPendingLoad('prd-tg-build-123');

		expect(result).toBeNull();
		expect(fetchMock).toHaveBeenCalledWith('/api/pipeline-loader?pipeline=prd-tg-build-123', { method: 'GET' });
	});

	it('returns null when there is no pending load', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ pending: false })
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await getPendingLoad();
		expect(result).toBeNull();
	});
});
