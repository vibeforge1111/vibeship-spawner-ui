import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({
	browser: true
}));

import {
	getLatestPipelineLoad,
	getPendingLoad,
	hasPendingLoad,
	queuePipelineLoad,
	type PendingPipelineLoad
} from './pipeline-loader';

describe('pipeline-loader service', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
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

	it('queues pipeline loads with a timestamped payload', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			statusText: 'OK'
		});
		vi.stubGlobal('fetch', fetchMock);

		const queued = await queuePipelineLoad({
			pipelineId: 'pipe-queued',
			pipelineName: 'Queued Pipeline',
			nodes: [],
			connections: [],
			source: 'prd-bridge',
			autoRun: true,
			relay: {
				missionId: 'mission-queued',
				autoRun: true
			}
		});

		expect(queued).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, options] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/pipeline-loader');
		expect(options).toMatchObject({
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});
		const body = JSON.parse(String(options.body));
		expect(body).toMatchObject({
			pipelineId: 'pipe-queued',
			pipelineName: 'Queued Pipeline',
			source: 'prd-bridge',
			autoRun: true,
			relay: {
				missionId: 'mission-queued',
				autoRun: true
			}
		});
		expect(Date.parse(body.timestamp)).not.toBeNaN();
	});

	it('returns false when queueing fails', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error'
		});
		vi.stubGlobal('fetch', fetchMock);

		const queued = await queuePipelineLoad({
			pipelineId: 'pipe-fail',
			pipelineName: 'Failing Pipeline',
			nodes: [],
			connections: [],
			source: 'prd'
		});

		expect(queued).toBe(false);
		expect(consoleError).toHaveBeenCalledWith(
			'[PipelineLoader] Failed to queue load:',
			'Internal Server Error'
		);
	});

	it('fetches the latest load without consuming the pending queue', async () => {
		const mockLoad: PendingPipelineLoad = {
			pipelineId: 'pipe-latest',
			pipelineName: 'Latest Pipeline',
			nodes: [],
			connections: [],
			source: 'prd-bridge',
			timestamp: '2026-04-29T10:00:00.000Z'
		};
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ pending: true, load: mockLoad })
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await getLatestPipelineLoad();

		expect(result).toEqual(mockLoad);
		expect(fetchMock).toHaveBeenCalledWith('/api/pipeline-loader?latest=true', { method: 'GET' });
	});

	it('checks pending loads with peek mode', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ pending: true })
		});
		vi.stubGlobal('fetch', fetchMock);

		await expect(hasPendingLoad()).resolves.toBe(true);
		expect(fetchMock).toHaveBeenCalledWith('/api/pipeline-loader?peek=true');
	});

	it('treats failed pending checks as no pending load', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: false,
			status: 503,
			json: async () => ({ pending: true })
		});
		vi.stubGlobal('fetch', fetchMock);

		await expect(hasPendingLoad()).resolves.toBe(false);
	});
});
