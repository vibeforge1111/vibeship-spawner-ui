import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import { existsSync } from 'fs';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { DELETE, GET, POST } from './+server';

const TEST_API_KEY = 'active-mission-test-secret';
let originalMcpApiKey: string | undefined;
let testSpawnerDir: string;
let missionFile: string;

function routeEvent(
	options: {
		method?: string;
		body?: unknown;
		url?: string;
		apiKey?: string | null;
		clientAddress?: string;
	} = {}
) {
	const url = options.url || 'http://localhost/api/mission/active';
	const headers = new Headers();
	if (options.body !== undefined) headers.set('Content-Type', 'application/json');
	if (options.apiKey !== null) headers.set('x-api-key', options.apiKey || TEST_API_KEY);
	return {
		request: new Request(url, {
			method: options.method || (options.body !== undefined ? 'POST' : 'GET'),
			headers,
			body: options.body === undefined ? undefined : JSON.stringify(options.body)
		}),
		url: new URL(url),
		getClientAddress: () => options.clientAddress || '127.0.0.1',
		cookies: { get: () => undefined }
	};
}

async function resetTestSpawnerDir() {
	delete process.env.SPAWNER_STATE_DIR;
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
}

describe('/api/mission/active integration', () => {
	beforeEach(async () => {
		originalMcpApiKey = process.env.MCP_API_KEY;
		process.env.MCP_API_KEY = TEST_API_KEY;
		await resetTestSpawnerDir();
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-active-mission-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		missionFile = path.join(testSpawnerDir, 'active-mission.json');
	});

	afterEach(async () => {
		if (originalMcpApiKey === undefined) {
			delete process.env.MCP_API_KEY;
		} else {
			process.env.MCP_API_KEY = originalMcpApiKey;
		}
		await resetTestSpawnerDir();
	});

	it('rejects unauthenticated non-local reads before exposing active mission state', async () => {
		const response = await GET(
			routeEvent({
				apiKey: null,
				url: 'https://spawner.example.com/api/mission/active',
				clientAddress: '203.0.113.10'
			}) as never
		);
		expect(response.status).toBe(401);
	});

	it('rejects unauthenticated non-local writes before persisting active mission state', async () => {
		const response = await POST(
			routeEvent({
				apiKey: null,
				url: 'https://spawner.example.com/api/mission/active',
				clientAddress: '203.0.113.10',
				body: {
					missionId: 'mission-unauth-test',
					missionName: 'Unauth test',
					status: 'running',
					tasks: [],
					completedTasks: [],
					failedTasks: []
				}
			}) as never
		);
		expect(response.status).toBe(401);
		expect(existsSync(missionFile)).toBe(false);
	});

	it('rejects unauthenticated local writes before persisting active mission state', async () => {
		const response = await POST(
			routeEvent({
				apiKey: null,
				body: {
					missionId: 'mission-local-unauth-test',
					missionName: 'Local unauth test',
					status: 'running',
					tasks: [],
					completedTasks: [],
					failedTasks: []
				}
			}) as never
		);
		expect(response.status).toBe(401);
		expect(existsSync(missionFile)).toBe(false);
	});

	it('round-trips multi-llm execution state and resume instructions', async () => {
		const payload = {
			missionId: 'mission-integration-test',
			missionName: 'Integration Mission',
			status: 'running',
			progress: 50,
			currentTaskId: 'task-1',
			currentTaskName: 'Generate hero image',
			executionPrompt: 'single prompt',
			multiLLMExecution: {
				enabled: true,
				strategy: 'round_robin',
				primaryProviderId: 'codex',
				providers: [
					{
						id: 'codex',
						label: 'Codex',
						model: 'gpt-5.5',
						enabled: true,
						kind: 'terminal_cli',
						eventSource: 'codex'
					},
					{
						id: 'replicate',
						label: 'Replicate',
						model: 'black-forest-labs/flux-1.1-pro',
						enabled: true,
						kind: 'custom',
						eventSource: 'replicate'
					}
				],
				assignments: {
					codex: { providerId: 'codex', mode: 'execute', taskIds: ['task-2'] },
					replicate: { providerId: 'replicate', mode: 'execute', taskIds: ['task-1'] }
				},
				masterPrompt: 'master prompt',
				providerPrompts: {
					codex: 'codex prompt',
					replicate: 'replicate prompt'
				},
				launchCommands: {
					codex: 'codex launch',
					replicate: 'replicate launch'
				},
				createdAt: new Date().toISOString()
			},
			tasks: [
				{
					id: 'task-1',
					title: 'Generate hero image',
					status: 'in_progress',
					skills: ['ai-image-generation']
				},
				{
					id: 'task-2',
					title: 'Implement backend API',
					status: 'pending',
					skills: ['backend']
				}
			],
			completedTasks: [],
			failedTasks: []
		};

		const postResponse = await POST(routeEvent({ body: payload }) as never);
		expect(postResponse.status).toBe(200);

		const getResponse = await GET(routeEvent() as never);
		expect(getResponse.status).toBe(200);
		const body = await getResponse.json();

		expect(body.active).toBe(true);
		expect(body.multiLLMExecution?.enabled).toBe(true);
		expect(body.multiLLMExecution?.providers?.length).toBe(2);
		expect(body.mission?.id).toBe('mission-integration-test');
		expect(body.authorityBoundary).toMatchObject({
			source: 'active-mission-state',
			authority: 'evidence_only'
		});
		expect(body.resumeInstructions).toContain('This active mission state is recovery evidence only.');
		expect(body.resumeInstructions).toContain('Before any action, reacquire fresh user intent through Harness Core');
		expect(body.resumeInstructions).toContain('Multi-LLM Orchestrator');
		expect(body.resumeInstructions).toContain('Strategy: round_robin');
	});

	it('clears mission state via DELETE', async () => {
		const postResponse = await POST(
			routeEvent({
				body: {
					missionId: 'mission-delete-test',
					missionName: 'Delete test',
					status: 'running',
					progress: 10,
					executionPrompt: 'prompt',
					tasks: [],
					completedTasks: [],
					failedTasks: []
				}
			}) as never
		);
		expect(postResponse.status).toBe(200);
		expect(existsSync(missionFile)).toBe(true);

		const deleteResponse = await DELETE(routeEvent({ method: 'DELETE' }) as never);
		expect(deleteResponse.status).toBe(200);
		expect(existsSync(missionFile)).toBe(false);
	});

	it('rejects unauthenticated local clears before deleting active mission state', async () => {
		await writeFile(
			missionFile,
			JSON.stringify(
				{
					missionId: 'mission-local-clear-test',
					missionName: 'Local clear test',
					status: 'running',
					progress: 10,
					tasks: [],
					completedTasks: [],
					failedTasks: [],
					lastUpdated: new Date().toISOString(),
					resumeInstructions: 'resume'
				},
				null,
				2
			)
		);

		const deleteResponse = await DELETE(routeEvent({ method: 'DELETE', apiKey: null }) as never);

		expect(deleteResponse.status).toBe(401);
		expect(existsSync(missionFile)).toBe(true);
	});

	it('clears active file instead of persisting terminal mission states', async () => {
		await writeFile(
			missionFile,
			JSON.stringify(
				{
					missionId: 'mission-old-running',
					missionName: 'Old running mission',
					status: 'running',
					progress: 40,
					tasks: [],
					completedTasks: [],
					failedTasks: [],
					lastUpdated: new Date().toISOString(),
					resumeInstructions: 'old'
				},
				null,
				2
			)
		);

		const postResponse = await POST(
			routeEvent({
				body: {
					missionId: 'mission-old-running',
					missionName: 'Old running mission',
					status: 'completed',
					progress: 100,
					tasks: [],
					completedTasks: [],
					failedTasks: []
				}
			}) as never
		);
		expect(postResponse.status).toBe(200);
		const body = await postResponse.json();

		expect(body.active).toBe(false);
		expect(existsSync(missionFile)).toBe(false);
	});

	it('clears stale active state when Mission Control already has a terminal event', async () => {
		await writeFile(
			path.join(testSpawnerDir, 'mission-control.json'),
			JSON.stringify(
				{
					totalRelayed: 1,
					perMission: { 'mission-terminal-history': 1 },
					recent: [
						{
							eventType: 'mission_completed',
							missionId: 'mission-terminal-history',
							timestamp: new Date().toISOString()
						}
					]
				},
				null,
				2
			)
		);
		await writeFile(
			missionFile,
			JSON.stringify(
				{
					missionId: 'mission-terminal-history',
					missionName: 'Already done',
					status: 'running',
					progress: 0,
					currentTaskId: 'task-replayed',
					currentTaskName: 'Replayed task',
					executionPrompt: 'old prompt',
					tasks: [],
					completedTasks: [],
					failedTasks: [],
					lastUpdated: new Date().toISOString(),
					resumeInstructions: 'old resume instructions'
				},
				null,
				2
			)
		);

		const getResponse = await GET(routeEvent() as never);
		expect(getResponse.status).toBe(200);
		const body = await getResponse.json();

		expect(body.active).toBe(false);
		expect(body.terminal).toBe(true);
		expect(existsSync(missionFile)).toBe(false);
	});

	it('ignores stale running updates after a terminal Mission Control event', async () => {
		await writeFile(
			path.join(testSpawnerDir, 'mission-control.json'),
			JSON.stringify(
				{
					totalRelayed: 1,
					perMission: { 'mission-terminal-post': 1 },
					recent: [
						{
							eventType: 'mission_completed',
							missionId: 'mission-terminal-post',
							timestamp: new Date().toISOString()
						}
					]
				},
				null,
				2
			)
		);

		const postResponse = await POST(
			routeEvent({
				body: {
					missionId: 'mission-terminal-post',
					missionName: 'Already done',
					status: 'running',
					progress: 0,
					tasks: [],
					completedTasks: [],
					failedTasks: []
				}
			}) as never
		);
		expect(postResponse.status).toBe(200);
		const body = await postResponse.json();

		expect(body.active).toBe(false);
		expect(body.terminal).toBe(true);
		expect(existsSync(missionFile)).toBe(false);
	});

	it('reports stale mission state as inactive by default', async () => {
		await writeFile(
			missionFile,
			JSON.stringify(
				{
					missionId: 'mission-stale-test',
					missionName: 'Stale test',
					status: 'running',
					progress: 40,
					currentTaskId: 'task-old',
					currentTaskName: 'Old task',
					executionPrompt: 'old prompt',
					tasks: [],
					completedTasks: [],
					failedTasks: [],
					lastUpdated: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
					resumeInstructions: 'old resume instructions'
				},
				null,
				2
			)
		);

		const getResponse = await GET(routeEvent() as never);
		expect(getResponse.status).toBe(200);
		const body = await getResponse.json();

		expect(body.active).toBe(false);
		expect(body.stale).toBe(true);
		expect(body.staleMission?.id).toBe('mission-stale-test');
		expect(body.mission).toBeUndefined();
	});

	it('clears corrupted active mission state as not resumable', async () => {
		await writeFile(missionFile, '{not-valid-json', 'utf-8');

		const getResponse = await GET(routeEvent() as never);
		expect(getResponse.status).toBe(200);
		const body = await getResponse.json();

		expect(body.active).toBe(false);
		expect(body.corrupt).toBe(true);
		expect(body.message).toBe('Active mission state is corrupted and cannot be resumed.');
		expect(body.error).toBeUndefined();
		expect(existsSync(missionFile)).toBe(false);
	});
});
