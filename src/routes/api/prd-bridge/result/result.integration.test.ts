import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { GET, POST } from './+server';

let testSpawnerDir: string;

async function resetTestSpawnerDir() {
	delete process.env.SPAWNER_STATE_DIR;
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
}

describe('/api/prd-bridge/result integration', () => {
	beforeEach(async () => {
		await resetTestSpawnerDir();
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-prd-result-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
	});

	afterEach(async () => {
		await resetTestSpawnerDir();
	});

	it('stores and reads PRD results from the configured Spawner state directory', async () => {
		const requestId = 'tg-build-state-dir-test';
		const result = {
			success: true,
			projectName: 'State Dir Test',
			tasks: [{ id: 'TAS-1', title: 'Keep state aligned' }]
		};

		const postResponse = await POST({
			request: new Request('http://localhost/api/prd-bridge/result', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ requestId, result })
			})
		} as never);

		expect(postResponse.status).toBe(200);
		expect(existsSync(path.join(testSpawnerDir, 'results', `${requestId}.json`))).toBe(true);

		const getResponse = await GET({
			url: new URL(`http://localhost/api/prd-bridge/result?requestId=${requestId}`)
		} as never);
		const body = await getResponse.json();

		expect(getResponse.status).toBe(200);
		expect(body.found).toBe(true);
		expect(body.result).toMatchObject(result);
	});
});
