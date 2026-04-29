import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _buildFallbackAnalysisResult } from './+server';

let testSpawnerDir = '';

describe('PRD bridge fallback analysis', () => {
	beforeEach(async () => {
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-prd-write-'));
		await mkdir(path.join(testSpawnerDir, 'results'), { recursive: true });
	});

	afterEach(async () => {
		if (testSpawnerDir && existsSync(testSpawnerDir)) {
			await rm(testSpawnerDir, { recursive: true, force: true });
		}
	});

	it('creates a canvas-ready fallback plan for direct static builds', async () => {
		const pendingPrdFile = path.join(testSpawnerDir, 'pending-prd.md');
		await writeFile(
			pendingPrdFile,
			[
				'Build this at C:\\Users\\USER\\Desktop\\spark-telegram-unit-smoke: a vanilla-JS static app.',
				'Files: index.html, styles.css, app.js, README.md. No build step.',
				'Add checklist state, localStorage persistence, launch/reset controls, and a README smoke test.'
			].join('\n'),
			'utf-8'
		);

		const result = await _buildFallbackAnalysisResult(
			'tg-build-fallback-test',
			'Spark Telegram Unit Smoke',
			'direct',
			'pro',
			{
				spawnerDir: testSpawnerDir,
				resultsDir: path.join(testSpawnerDir, 'results'),
				pendingPrdFile,
				pendingRequestFile: path.join(testSpawnerDir, 'pending-request.json'),
				prdAutoTraceFile: path.join(testSpawnerDir, 'prd-auto-trace.jsonl')
			}
		);

		expect(result.success).toBe(true);
		expect(result.requestId).toBe('tg-build-fallback-test');
		expect(result.projectName).toBe('Spark Telegram Unit Smoke');
		expect(result.projectType).toBe('static-web-app');
		expect(result.techStack).toMatchObject({ framework: 'Vanilla JavaScript' });

		const tasks = result.tasks as Array<{
			id: string;
			title: string;
			summary: string;
			dependencies: string[];
			workspaceTargets: string[];
			verificationCommands: string[];
		}>;
		expect(tasks).toHaveLength(4);
		expect(new Set(tasks.map((task) => task.id)).size).toBe(4);
		expect(tasks[0].summary).toContain('index.html');
		expect(tasks[1].dependencies).toContain(tasks[0].id);
		expect(tasks[3].dependencies).toEqual(expect.arrayContaining([tasks[1].id, tasks[2].id]));
		expect(tasks.every((task) => task.workspaceTargets.includes('C:\\Users\\USER\\Desktop\\spark-telegram-unit-smoke'))).toBe(true);
		expect(tasks.flatMap((task) => task.verificationCommands).join('\n')).toContain('node --check');
	});
});
