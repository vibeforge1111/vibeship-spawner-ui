import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { POST } from './+server';

vi.mock('$lib/server/provider-runtime', () => ({
	providerRuntime: {
		dispatch: vi.fn(async ({ executionPack }) => ({
			success: true,
			missionId: executionPack.missionId,
			sessions: { codex: { status: 'running' } },
			startedAt: new Date().toISOString()
		})),
		getMissionResults: vi.fn(() => [])
	}
}));

let testSpawnerDir: string;

async function resetTestSpawnerDir() {
	delete process.env.SPAWNER_STATE_DIR;
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
}

describe('/api/prd-bridge/load-to-canvas integration', () => {
	beforeEach(async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
		await resetTestSpawnerDir();
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-load-to-canvas-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		await mkdir(path.join(testSpawnerDir, 'results'), { recursive: true });
	});

	afterEach(async () => {
		vi.unstubAllGlobals();
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
		const body = await response.json();
		expect(body.canvasUrl).toBe('/canvas?pipeline=prd-tg-contract-test&mission=mission-tg-contract-test');
		const pendingRaw = await readFile(path.join(testSpawnerDir, 'pending-load.json'), 'utf-8');
		const pending = JSON.parse(pendingRaw);
		expect(pending.requestId).toBe(requestId);
		expect(pending.missionId).toBe('mission-tg-contract-test');
		expect(pending.nodes[0].skill).toMatchObject({
			id: 'task-1-static-shell',
			name: 'Create static shell',
			tags: ['frontend-ui-implementation', 'responsive-css'],
			skillChain: ['frontend-ui-implementation', 'responsive-css']
		});
		const description = pending.nodes[0].skill.description;
		expect(description).toContain('Build the direct-launch app shell.');
		expect(description).toContain('Workspace targets:');
		expect(description).toContain('Opening index.html directly renders the app.');
		expect(description).toContain('No package.json or build step is introduced.');
		expect(description).toContain('Verification commands:');
		expect(description).toContain('Select-String');
	});

	it('preserves Telegram relay target metadata for canvas auto-run dispatch', async () => {
		const requestId = 'tg-relay-target-test';
		await writeFile(
			path.join(testSpawnerDir, 'results', `${requestId}.json`),
			JSON.stringify({
				requestId,
				success: true,
				projectName: 'Spark Relay Target Test',
				tasks: [
					{
						id: 'task-1',
						title: 'Build relay target',
						summary: 'Confirm Telegram relay metadata survives PRD bridge loading.',
						skills: ['telegram-relay']
					}
				],
				executionPrompt: 'Build the relay target test.'
			}),
			'utf-8'
		);
		await writeFile(
			path.join(testSpawnerDir, 'pending-request.json'),
			JSON.stringify({
				requestId,
				buildMode: 'advanced_prd',
				buildModeReason: 'Multi-agent Telegram relay test.',
				relay: {
					chatId: '8319079055',
					userId: '8319079055',
					requestId,
					goal: 'Build through the primary Telegram relay.',
					telegramRelay: { port: 8789, profile: 'primary' }
				}
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
		expect(pending.relay).toMatchObject({
			missionId: 'mission-tg-relay-target-test',
			chatId: '8319079055',
			userId: '8319079055',
			requestId,
			autoRun: true,
			buildMode: 'advanced_prd',
			buildModeReason: 'Multi-agent Telegram relay test.',
			telegramRelay: { port: 8789, profile: 'primary' }
		});
		const requestRaw = await readFile(path.join(testSpawnerDir, 'pending-request.json'), 'utf-8');
		const requestMeta = JSON.parse(requestRaw);
		expect(requestMeta).toMatchObject({
			requestId,
			status: 'canvas_loaded',
			pipelineId: `prd-${requestId}`,
			canvasUrl: `/canvas?pipeline=prd-${requestId}&mission=mission-tg-relay-target-test`
		});
	});

	it('builds relay metadata from request body when pending request metadata is stale', async () => {
		const requestId = 'tg-build-123-456-1777211869020';
		await writeFile(
			path.join(testSpawnerDir, 'results', `${requestId}.json`),
			JSON.stringify({
				requestId,
				success: true,
				projectName: 'Spark Body Relay Test',
				tasks: [{ id: 'task-1', title: 'Build body relay', summary: 'Use body fallback.', skills: [] }],
				executionPrompt: 'Build with body relay.'
			}),
			'utf-8'
		);

		const response = await POST({
			request: new Request('http://localhost/api/prd-bridge/load-to-canvas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					requestId,
					autoRun: true,
					chatId: '8319079055',
					userId: '8319079055',
					goal: 'Build through body relay metadata.',
					telegramRelay: { port: 8789, profile: 'spark-agi' }
				})
			})
		} as never);

		expect(response.status).toBe(200);
		const pendingRaw = await readFile(path.join(testSpawnerDir, 'pending-load.json'), 'utf-8');
		const pending = JSON.parse(pendingRaw);
		expect(pending.relay).toMatchObject({
			missionId: 'mission-1777211869020',
			chatId: '8319079055',
			userId: '8319079055',
			requestId,
			autoRun: true,
			telegramRelay: { port: 8789, profile: 'spark-agi' }
		});
	});

	it('queues a full advanced PRD canvas contract with nodes, dependencies, autorun, and Telegram relay', async () => {
		const requestId = 'tg-build-8319079055-777-1777300000000';
		await writeFile(
			path.join(testSpawnerDir, 'results', `${requestId}.json`),
			JSON.stringify({
				requestId,
				success: true,
				projectName: 'Spark Mission Arcade',
				tasks: [
					{
						id: 'task-1',
						title: 'Create project shell',
						summary: 'Create the static app workspace and base files.',
						skills: ['frontend-engineer'],
						acceptanceCriteria: ['index.html, styles.css, app.js, and README.md exist.'],
						verificationCommands: ['Get-ChildItem']
					},
					{
						id: 'task-2',
						title: 'Implement game-like mission UI',
						summary: 'Build playful mission cards, energy, streak, and launch states.',
						skills: ['ui-design', 'javascript-state'],
						dependencies: ['task-1'],
						acceptanceCriteria: ['The first screen shows active mission status and launch controls.'],
						verificationCommands: ['Select-String -Path app.js -Pattern "localStorage","launch"']
					},
					{
						id: 'task-3',
						title: 'Write smoke-test README',
						summary: 'Document direct launch and refresh persistence checks.',
						skills: ['technical-writer'],
						dependencies: ['task-1'],
						acceptanceCriteria: ['README explains direct index.html launch and manual smoke tests.'],
						verificationCommands: ['Get-Content README.md']
					}
				],
				executionPrompt: 'Advanced PRD: build Spark Mission Arcade with TAS-style verification.'
			}),
			'utf-8'
		);
		await writeFile(
			path.join(testSpawnerDir, 'pending-request.json'),
			JSON.stringify({
				requestId,
				buildMode: 'advanced_prd',
				buildModeReason: 'Request looks like a new project or systematic feature that benefits from PRD-to-task planning.',
				relay: {
					chatId: '8319079055',
					userId: '8319079055',
					requestId,
					goal: '# Spark Mission Arcade\n\nTarget operating-system folder: `/root/spark-mission-arcade`\n\nBuild the project.',
					telegramRelay: { port: 8788, profile: 'spark-agi' }
				}
			}),
			'utf-8'
		);

		const response = await POST({
			request: new Request('http://localhost/api/prd-bridge/load-to-canvas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ requestId, autoRun: true, telegramRelay: { port: 8788, profile: 'spark-agi' } })
			})
		} as never);

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload).toMatchObject({
			success: true,
			pipelineId: `prd-${requestId}`,
			pipelineName: 'Spark Mission Arcade',
			taskCount: 3,
			connectionCount: 2,
			canvasUrl: `/canvas?pipeline=prd-${requestId}&mission=mission-1777300000000`
		});

		const pendingRaw = await readFile(path.join(testSpawnerDir, 'pending-load.json'), 'utf-8');
		const pending = JSON.parse(pendingRaw);
		expect(pending).toMatchObject({
			pipelineId: `prd-${requestId}`,
			pipelineName: 'Spark Mission Arcade',
			source: 'prd-bridge',
			autoRun: true,
			buildMode: 'advanced_prd',
			buildModeReason: 'Request looks like a new project or systematic feature that benefits from PRD-to-task planning.',
			executionPrompt: 'Advanced PRD: build Spark Mission Arcade with TAS-style verification.'
		});
		expect(pending.nodes).toHaveLength(3);
		expect(pending.nodes.map((node: any) => node.skill.name)).toEqual([
			'Create project shell',
			'Implement game-like mission UI',
			'Write smoke-test README'
		]);
		expect(pending.nodes.map((node: any) => node.skill.id)).toEqual(['task-1', 'task-2', 'task-3']);
		expect(pending.nodes[1].skill.skillChain).toEqual(['ui-design', 'javascript-state']);
		expect(pending.connections).toEqual([
			{ sourceIndex: 0, targetIndex: 1 },
			{ sourceIndex: 0, targetIndex: 2 }
		]);
		expect(pending.relay).toMatchObject({
			missionId: 'mission-1777300000000',
			chatId: '8319079055',
			userId: '8319079055',
			requestId,
			autoRun: true,
			buildMode: 'advanced_prd',
			telegramRelay: { port: 8788, profile: 'spark-agi' }
		});
		expect(pending.relay.goal).toContain('/root/spark-mission-arcade');
	});
});
