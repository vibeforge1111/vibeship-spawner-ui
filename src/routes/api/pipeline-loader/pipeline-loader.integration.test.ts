import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { GET, POST, DELETE } from './+server';

let testSpawnerDir: string;
let pendingLoadFile: string;
let lastLoadFile: string;

async function resetTestSpawnerDir() {
	delete process.env.SPAWNER_STATE_DIR;
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
}

describe('/api/pipeline-loader integration', () => {
	beforeEach(async () => {
		await resetTestSpawnerDir();
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-pipeline-loader-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		pendingLoadFile = path.join(testSpawnerDir, 'pending-load.json');
		lastLoadFile = path.join(testSpawnerDir, 'last-canvas-load.json');
	});

	afterEach(async () => {
		await resetTestSpawnerDir();
	});

	it('consumes pending load on GET and preserves queued pipeline ID', async () => {
		const payload = {
			pipelineId: 'pipe-fixed-id',
			pipelineName: 'Queued Pipeline',
			nodes: [{ skill: { id: 'api-design' }, position: { x: 100, y: 100 } }],
			connections: [],
			source: 'prd',
			autoRun: true
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
		expect(existsSync(lastLoadFile)).toBe(true);

		const firstGet = await GET({
			url: new URL('http://localhost/api/pipeline-loader')
		} as never);
		expect(firstGet.status).toBe(200);
		const firstBody = await firstGet.json();
		expect(firstBody.pending).toBe(true);
		expect(firstBody.load.pipelineId).toBe('pipe-fixed-id');
		expect(firstBody.load.autoRun).toBe(true);
		expect(existsSync(pendingLoadFile)).toBe(false);
		expect(existsSync(lastLoadFile)).toBe(true);

		const latestGet = await GET({
			url: new URL('http://localhost/api/pipeline-loader?latest=true')
		} as never);
		expect(latestGet.status).toBe(200);
		const latestBody = await latestGet.json();
		expect(latestBody.pending).toBe(true);
		expect(latestBody.load.pipelineId).toBe('pipe-fixed-id');
		expect(existsSync(lastLoadFile)).toBe(true);

		const secondGet = await GET({
			url: new URL('http://localhost/api/pipeline-loader')
		} as never);
		expect(secondGet.status).toBe(200);
		const secondBody = await secondGet.json();
		expect(secondBody.pending).toBe(false);
	});

	it('does not consume a pending load when an explicit pipeline filter does not match', async () => {
		const payload = {
			pipelineId: 'pipe-target-project',
			pipelineName: 'Target Project Pipeline',
			nodes: [],
			connections: [],
			source: 'prd-bridge',
			autoRun: true
		};

		const postResponse = await POST({
			request: new Request('http://localhost/api/pipeline-loader', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
		} as never);
		expect(postResponse.status).toBe(200);

		const mismatchGet = await GET({
			url: new URL('http://localhost/api/pipeline-loader?pipeline=pipe-other-project')
		} as never);
		expect(mismatchGet.status).toBe(200);
		const mismatchBody = await mismatchGet.json();
		expect(mismatchBody.pending).toBe(false);
		expect(existsSync(pendingLoadFile)).toBe(true);

		const matchGet = await GET({
			url: new URL('http://localhost/api/pipeline-loader?pipeline=pipe-target-project')
		} as never);
		expect(matchGet.status).toBe(200);
		const matchBody = await matchGet.json();
		expect(matchBody.pending).toBe(true);
		expect(matchBody.load.pipelineId).toBe('pipe-target-project');
		expect(existsSync(pendingLoadFile)).toBe(false);
	});

	it('preserves Spark relay and build metadata for canvas auto-run', async () => {
		const payload = {
			pipelineId: 'pipe-spark-relay',
			pipelineName: 'Spark Relay Pipeline',
			nodes: [{ skill: { id: 'frontend', name: 'Frontend', category: 'frontend' }, position: { x: 100, y: 100 } }],
			connections: [],
			source: 'prd-bridge',
			buildMode: 'advanced_prd',
			buildModeReason: 'User explicitly requested advanced PRD mode.',
			executionPrompt: 'Build the relay project.',
			autoRun: true,
			relay: {
				chatId: '8319079055',
				userId: 'spark-user',
				requestId: 'tg-build-test',
				goal: 'Build the relay project.',
				autoRun: true,
				buildMode: 'advanced_prd',
				buildModeReason: 'User explicitly requested advanced PRD mode.'
			}
		};

		const postResponse = await POST({
			request: new Request('http://localhost/api/pipeline-loader', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
		} as never);
		expect(postResponse.status).toBe(200);

		const latestGet = await GET({
			url: new URL('http://localhost/api/pipeline-loader?latest=true')
		} as never);
		expect(latestGet.status).toBe(200);
		const latestBody = await latestGet.json();
		expect(latestBody.pending).toBe(true);
		expect(latestBody.load.pipelineId).toBe('pipe-spark-relay');
		expect(latestBody.load.source).toBe('prd-bridge');
		expect(latestBody.load.buildMode).toBe('advanced_prd');
		expect(latestBody.load.buildModeReason).toBe('User explicitly requested advanced PRD mode.');
		expect(latestBody.load.executionPrompt).toBe('Build the relay project.');
		expect(latestBody.load.relay).toMatchObject(payload.relay);
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
