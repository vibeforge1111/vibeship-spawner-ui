import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { POST } from './+server';

let testSpawnerDir: string;

async function resetTestSpawnerDir() {
	delete process.env.SPAWNER_STATE_DIR;
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
}

describe('/api/prd-bridge/load-to-canvas integration', () => {
	beforeEach(async () => {
		await resetTestSpawnerDir();
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-load-to-canvas-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		await mkdir(path.join(testSpawnerDir, 'results'), { recursive: true });
	});

	afterEach(async () => {
		await resetTestSpawnerDir();
	});

	it('preserves PRD task acceptance criteria and verification commands in canvas nodes', async () => {
		const requestId = 'tg-contract-test';
		await writeFile(
			path.join(testSpawnerDir, 'results', `${requestId}.json`),
			JSON.stringify({
				requestId,
				success: true,
				projectName: 'Spark Contract Test',
				tasks: [
					{
						id: 'task-1-static-shell',
						title: 'Create static shell',
						summary: 'Build the direct-launch app shell.',
						skills: ['frontend-ui-implementation', 'responsive-css'],
						workspaceTargets: ['C:\\Users\\USER\\Desktop\\spark-contract-test\\index.html'],
						acceptanceCriteria: [
							'Opening index.html directly renders the app.',
							'No package.json or build step is introduced.'
						],
						verificationCommands: [
							'Test-Path C:\\Users\\USER\\Desktop\\spark-contract-test\\index.html',
							'Select-String -Path C:\\Users\\USER\\Desktop\\spark-contract-test\\index.html -Pattern "styles.css","app.js"'
						]
					}
				],
				executionPrompt: 'Build a vanilla JS app. No build step.'
			}),
			'utf-8'
		);

		const response = await POST({
			request: new Request('http://localhost/api/prd-bridge/load-to-canvas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ requestId, autoRun: true })
			})
		} as never);

		expect(response.status).toBe(200);
		const pendingRaw = await readFile(path.join(testSpawnerDir, 'pending-load.json'), 'utf-8');
		const pending = JSON.parse(pendingRaw);
		const description = pending.nodes[0].skill.description;
		expect(description).toContain('Build the direct-launch app shell.');
		expect(description).toContain('Workspace targets:');
		expect(description).toContain('Opening index.html directly renders the app.');
		expect(description).toContain('No package.json or build step is introduced.');
		expect(description).toContain('Verification commands:');
		expect(description).toContain('Select-String');
	});
});
