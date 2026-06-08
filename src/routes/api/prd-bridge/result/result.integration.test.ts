import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'path';
import { existsSync } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { GET, POST } from './+server';

let testSpawnerDir: string;
const TEST_API_KEY = 'prd-bridge-result-test-secret';
const originalMcpApiKey = process.env.MCP_API_KEY;

function restoreEnv(name: string, value: string | undefined) {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

function postResultEvent(body: unknown, apiKey: string | null = TEST_API_KEY) {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (apiKey) headers['x-api-key'] = apiKey;
	const url = new URL('http://localhost/api/prd-bridge/result');
	return {
		request: new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		}),
		url,
		getClientAddress: () => '127.0.0.1'
	};
}

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
		process.env.MCP_API_KEY = TEST_API_KEY;
	});

	afterEach(async () => {
		await resetTestSpawnerDir();
		restoreEnv('MCP_API_KEY', originalMcpApiKey);
	});

	it('stores and reads PRD results from the configured Spawner state directory', async () => {
		const requestId = 'tg-build-state-dir-test';
		const result = {
			success: true,
			projectName: 'State Dir Test',
			projectType: 'clarification-understanding',
			complexity: 'simple',
			infrastructure: { needsAuth: false, needsDatabase: false, needsAPI: false },
			techStack: { framework: 'Existing Spawner UI', language: 'TypeScript' },
			tasks: [{ id: 'TAS-1', title: 'Keep state aligned', skills: [], dependencies: [] }],
			skills: [],
			executionPrompt: 'Acknowledge understanding and ask for missing details.'
		};

		const postResponse = await POST({
			...postResultEvent({ requestId, result })
		} as never);

		expect(postResponse.status).toBe(200);
		expect(existsSync(path.join(testSpawnerDir, 'results', `${requestId}.json`))).toBe(true);

		const getResponse = await GET({
			url: new URL(`http://localhost/api/prd-bridge/result?requestId=${requestId}`)
		} as never);
		const body = await getResponse.json();

		expect(getResponse.status).toBe(200);
		expect(body.found).toBe(true);
		expect(body.result).toMatchObject({
			requestId,
			success: true,
			projectName: 'State Dir Test',
			tasks: result.tasks,
			instructionTextRedacted: true
		});
		const stored = await readFile(path.join(testSpawnerDir, 'results', `${requestId}.json`), 'utf-8');
		expect(stored).not.toContain('executionPrompt');
		expect(stored).not.toContain('Acknowledge understanding');
	});

	it('rejects malformed result JSON with a useful error', async () => {
		const requestId = 'tg-build-malformed-result-test';
		const postResponse = await POST({
			...postResultEvent({ requestId, result: { success: true, projectName: 'Broken' } })
		} as never);
		const body = await postResponse.json();

		expect(postResponse.status).toBe(400);
		expect(body.error).toContain('Invalid PRD analysis result');
		expect(existsSync(path.join(testSpawnerDir, 'results', `${requestId}.json`))).toBe(false);
	});

	it('rejects unauthenticated canonical result writes without storing artifacts', async () => {
		const requestId = 'tg-build-unauth-result-test';
		const postResponse = await POST({
			...postResultEvent(
				{
					requestId,
					result: {
						success: true,
						projectName: 'Unauthorized Result',
						projectType: 'direct-build',
						complexity: 'simple',
						infrastructure: { needsAuth: false, needsDatabase: false, needsAPI: false },
						techStack: { framework: 'Existing Spawner UI', language: 'TypeScript' },
						tasks: [{ id: 'TAS-1', title: 'Should not store', skills: [], dependencies: [] }],
						skills: []
					}
				},
				null
			)
		} as never);

		expect(postResponse.status).toBe(401);
		expect(existsSync(path.join(testSpawnerDir, 'results', `${requestId}.json`))).toBe(false);
	});

	it('uses pending request tier to strip pro skills from base result storage', async () => {
		const requestId = 'tg-base-skill-gate-test';
		await writeFile(
			path.join(testSpawnerDir, 'pending-request.json'),
			JSON.stringify({ requestId, tier: 'base' }),
			'utf-8'
		);

		const postResponse = await POST({
			...postResultEvent({
				requestId,
				result: {
					success: true,
					projectName: 'Base Skill Gate',
					projectType: 'direct-build',
					complexity: 'simple',
					infrastructure: { needsAuth: false, needsDatabase: false, needsAPI: false },
					techStack: { framework: 'Existing Spawner UI', language: 'TypeScript' },
					tasks: [
						{
							id: 'TAS-1',
							title: 'Build the base surface',
							skills: ['frontend-engineer', 'threejs-3d-graphics'],
							dependencies: []
						}
					],
					skills: ['frontend-engineer', 'threejs-3d-graphics']
				}
			})
		} as never);

		expect(postResponse.status).toBe(200);
		const stored = JSON.parse(await readFile(path.join(testSpawnerDir, 'results', `${requestId}.json`), 'utf-8'));
		expect(stored.tasks[0].skills).toEqual(['frontend-engineer']);
		expect(stored.skills).toEqual(['frontend-engineer']);
		expect(stored.metadata.skillGate).toMatchObject({
			applied: true,
			tier: 'base'
		});
	});
});
