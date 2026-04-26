import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import { existsSync } from 'fs';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { GET, POST, DELETE } from './+server';

let testSpawnerDir: string;
let missionFile: string;

async function resetTestSpawnerDir() {
	delete process.env.SPAWNER_STATE_DIR;
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
}

describe('/api/mission/active integration', () => {
	beforeEach(async () => {
		await resetTestSpawnerDir();
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-active-mission-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		missionFile = path.join(testSpawnerDir, 'active-mission.json');
	});

	afterEach(async () => {
		await resetTestSpawnerDir();
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

		const postResponse = await POST({
			request: new Request('http://localhost/api/mission/active', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			})
		} as never);
		expect(postResponse.status).toBe(200);

		const getResponse = await GET({
			url: new URL('http://localhost/api/mission/active')
		} as never);
		expect(getResponse.status).toBe(200);
		const body = await getResponse.json();

		expect(body.active).toBe(true);
		expect(body.multiLLMExecution?.enabled).toBe(true);
		expect(body.multiLLMExecution?.providers?.length).toBe(2);
		expect(body.mission?.id).toBe('mission-integration-test');
		expect(body.resumeInstructions).toContain('Multi-LLM Orchestrator');
		expect(body.resumeInstructions).toContain('Strategy: round_robin');
	});

	it('clears mission state via DELETE', async () => {
		const postResponse = await POST({
			request: new Request('http://localhost/api/mission/active', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					missionId: 'mission-delete-test',
					missionName: 'Delete test',
					status: 'running',
					progress: 10,
					executionPrompt: 'prompt',
					tasks: [],
					completedTasks: [],
					failedTasks: []
				})
			})
		} as never);
		expect(postResponse.status).toBe(200);
		expect(existsSync(missionFile)).toBe(true);

		const deleteResponse = await DELETE({} as never);
		expect(deleteResponse.status).toBe(200);
		expect(existsSync(missionFile)).toBe(false);
	});

	it('reports stale mission state as inactive by default', async () => {
		await writeFile(missionFile, JSON.stringify({
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
		}, null, 2));

		const getResponse = await GET({
			url: new URL('http://localhost/api/mission/active')
		} as never);
		expect(getResponse.status).toBe(200);
		const body = await getResponse.json();

		expect(body.active).toBe(false);
		expect(body.stale).toBe(true);
		expect(body.staleMission?.id).toBe('mission-stale-test');
		expect(body.mission).toBeUndefined();
	});
});
