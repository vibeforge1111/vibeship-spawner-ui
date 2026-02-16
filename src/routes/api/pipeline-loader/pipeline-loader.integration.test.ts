import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { GET, POST, DELETE } from './+server';

const pendingLoadFile = path.join(process.cwd(), '.spawner', 'pending-load.json');

async function cleanupPendingLoadFile() {
	if (existsSync(pendingLoadFile)) {
		await unlink(pendingLoadFile);
	}
}

describe('/api/pipeline-loader integration', () => {
	beforeEach(async () => {
		await cleanupPendingLoadFile();
	});

	afterEach(async () => {
		await cleanupPendingLoadFile();
	});

	it('consumes pending load on GET and preserves queued pipeline ID', async () => {
		const payload = {
			pipelineId: 'pipe-fixed-id',
			pipelineName: 'Queued Pipeline',
			nodes: [{ skill: { id: 'api-design' }, position: { x: 100, y: 100 } }],
			connections: [],
			source: 'prd'
		};

		const postResponse = await POST({
			request: new Request('http://localhost/api/pipeline-loader', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
		} as never);
		expect(postResponse.status).toBe(200);
		expect(existsSync(pendingLoadFile)).toBe(true);

		const firstGet = await GET({
			url: new URL('http://localhost/api/pipeline-loader')
		} as never);
		expect(firstGet.status).toBe(200);
		const firstBody = await firstGet.json();
		expect(firstBody.pending).toBe(true);
		expect(firstBody.load.pipelineId).toBe('pipe-fixed-id');
		expect(existsSync(pendingLoadFile)).toBe(false);

		const secondGet = await GET({
			url: new URL('http://localhost/api/pipeline-loader')
		} as never);
		expect(secondGet.status).toBe(200);
		const secondBody = await secondGet.json();
		expect(secondBody.pending).toBe(false);
	});

	it('clears pending load with DELETE', async () => {
		const postResponse = await POST({
			request: new Request('http://localhost/api/pipeline-loader', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pipelineId: 'pipe-delete-id',
					pipelineName: 'Delete Pipeline'
				})
			})
		} as never);
		expect(postResponse.status).toBe(200);
		expect(existsSync(pendingLoadFile)).toBe(true);

		const deleteResponse = await DELETE({} as never);
		expect(deleteResponse.status).toBe(200);
		expect(existsSync(pendingLoadFile)).toBe(false);
	});
});
