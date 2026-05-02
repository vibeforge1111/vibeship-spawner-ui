import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { POST } from './+server';

let testSpawnerDir: string;
const originalProvider = process.env.SPARK_MISSION_LLM_PROVIDER;
const originalStateDir = process.env.SPAWNER_STATE_DIR;

async function resetTestSpawnerDir() {
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
	if (originalStateDir === undefined) delete process.env.SPAWNER_STATE_DIR;
	else process.env.SPAWNER_STATE_DIR = originalStateDir;
	if (originalProvider === undefined) delete process.env.SPARK_MISSION_LLM_PROVIDER;
	else process.env.SPARK_MISSION_LLM_PROVIDER = originalProvider;
}

describe('/api/prd-bridge/write integration', () => {
	beforeEach(async () => {
		await resetTestSpawnerDir();
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-prd-write-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
	});

	afterEach(async () => {
		await resetTestSpawnerDir();
	});

	it('writes deterministic fallback analysis when hosted provider cannot start an auto worker', async () => {
		process.env.SPARK_MISSION_LLM_PROVIDER = 'zai';
		const requestId = 'tg-build-smoke-fallback-test';

		const response = await POST({
			request: new Request('http://localhost/api/prd-bridge/write', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: '# Cafe Landing Page\n\nBuild mode: direct\n\nBuild a tiny static landing page for a cafe with a menu section.',
					requestId,
					projectName: 'Cafe Landing Page',
					buildMode: 'direct',
					tier: 'pro'
				})
			}),
			getClientAddress: () => '127.0.0.1'
		} as never);

		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body.autoAnalysis).toMatchObject({ provider: 'zai', started: false });
		expect(existsSync(path.join(testSpawnerDir, 'results', `${requestId}.json`))).toBe(true);
	});
});
