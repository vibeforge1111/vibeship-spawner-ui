import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { _buildFallbackAnalysisResult, _extractPrdBridgeProjectLineage } from './+server';

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

	it('keeps a sparse understanding clarification small and exact', async () => {
		const pendingPrdFile = path.join(testSpawnerDir, 'pending-prd.md');
		await writeFile(pendingPrdFile, 'did you understand what i said', 'utf-8');

		const result = await _buildFallbackAnalysisResult(
			'tg-build-8319079055-2607-1777608553410-clarified-1777608630635',
			'did you understand what i said',
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
		expect(result.requestId).toBe('tg-build-8319079055-2607-1777608553410-clarified-1777608630635');
		expect(result.projectName).toBe('did you understand what i said');
		expect(result.projectType).toBe('clarification-understanding');
		expect(result.executionPrompt).toContain('Original user request: did you understand what i said');
		expect(result.infrastructure).toMatchObject({ needsAuth: false, needsDatabase: false, needsAPI: false });

		const tasks = result.tasks as Array<{ title: string; dependencies: string[]; skills: string[] }>;
		expect(tasks).toHaveLength(2);
		expect(tasks.every((task) => task.dependencies.length === 0)).toBe(true);
		expect(tasks.map((task) => task.title).join('\n')).toContain('Acknowledge the understanding check');
		expect(tasks.map((task) => task.title).join('\n')).not.toMatch(/auth|payment|database|mvp/i);
		expect((result.skills as string[]).length).toBeGreaterThan(0);
	});

	it('extracts complete improvement lineage before mission-created relay', () => {
		const lineage = _extractPrdBridgeProjectLineage(
			[
				'# Loop Lantern polish 2',
				'',
				'Target operating-system folder: `C:/Users/USER/Desktop/loop-lantern`',
				'',
				'Improve the existing shipped project "Loop Lantern" at C:/Users/USER/Desktop/loop-lantern.',
				'',
				'User feedback:',
				'make the Loop Lantern preview feel more Spark colored',
				'',
				'Rules:',
				'- Preserve the current app.',
				'',
				'Project context:',
				'- Parent mission: mission-1777644961054',
				'- Current preview: http://127.0.0.1:5555/preview/example/index.html'
			].join('\n'),
			'Loop Lantern polish 2'
		);

		expect(lineage).toMatchObject({
			projectPath: 'C:/Users/USER/Desktop/loop-lantern',
			parentMissionId: 'mission-1777644961054',
			iterationNumber: 2,
			previewUrl: 'http://127.0.0.1:5555/preview/example/index.html',
			improvementFeedback: 'make the Loop Lantern preview feel more Spark colored'
		});
		expect(lineage?.projectId).toMatch(/^project-loop-lantern-[a-f0-9]{10}$/);

		const inlineRulesLineage = _extractPrdBridgeProjectLineage(
			'Improve the existing shipped project "Loop Lantern" at C:/Users/USER/Desktop/loop-lantern.\nUser feedback:\nmake the Loop Lantern preview feel more Spark colored, but do not rebuild from scratch Rules:\n- Read the existing project files before editing.\nProject context:\n- Parent mission: mission-1777644961054',
			'Loop Lantern polish 2'
		);
		expect(inlineRulesLineage?.improvementFeedback).toBe(
			'make the Loop Lantern preview feel more Spark colored, but do not rebuild from scratch'
		);
	});

	it('keeps one-file static HTML smoke prompts constrained', async () => {
		const pendingPrdFile = path.join(testSpawnerDir, 'pending-prd.md');
		await writeFile(
			pendingPrdFile,
			[
				'Build mode: direct',
				'Build a tiny static HTML page called Spark Production Smoke. It should have one file, index.html, with a dark Mission Control panel, a green "Spark Live OK" status, and the text "Telegram to Spawner relay worked on May 8, 2026".',
				'Do not add package files, do not install dependencies, and keep it simple enough to finish fast.'
			].join('\n'),
			'utf-8'
		);

		const result = await _buildFallbackAnalysisResult(
			'tg-static-one-file-test',
			'Spark Relay Static Smoke',
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

		expect(result.projectType).toBe('static-single-file-html');
		expect(result.complexity).toBe('simple');
		expect(String(result.executionPrompt)).toContain('Create or update only index.html');
		expect(String(result.executionPrompt)).toContain('Do not create a full app');

		const tasks = result.tasks as Array<{ title: string; acceptanceCriteria: string[] }>;
		expect(tasks).toHaveLength(2);
		expect(tasks.map((task) => task.title).join('\n')).not.toMatch(/app shell|core interaction|localStorage|checklist/i);
		expect(tasks.flatMap((task) => task.acceptanceCriteria).join('\n')).toMatch(/No package\.json|Only index\.html/i);
	});
});
