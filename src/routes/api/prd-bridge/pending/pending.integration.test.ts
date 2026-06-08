import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { DELETE, GET } from './+server';

let testSpawnerDir = '';
const TEST_API_KEY = 'prd-bridge-pending-test-secret';
const originalMcpApiKey = process.env.MCP_API_KEY;
const originalStateDir = process.env.SPAWNER_STATE_DIR;

function restoreEnv(name: string, value: string | undefined) {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

function routeEvent(
	method: string,
	apiKey: string | null = TEST_API_KEY,
	url = 'http://localhost/api/prd-bridge/pending',
	clientAddress = '127.0.0.1'
) {
	const headers: Record<string, string> = {};
	if (apiKey) headers['x-api-key'] = apiKey;
	const parsedUrl = new URL(url);
	return {
		request: new Request(parsedUrl, { method, headers }),
		url: parsedUrl,
		getClientAddress: () => clientAddress
	};
}

async function resetTestSpawnerDir() {
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
	restoreEnv('SPAWNER_STATE_DIR', originalStateDir);
}

describe('/api/prd-bridge/pending integration', () => {
	beforeEach(async () => {
		await resetTestSpawnerDir();
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-prd-pending-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		process.env.MCP_API_KEY = TEST_API_KEY;
	});

	afterEach(async () => {
		await resetTestSpawnerDir();
		restoreEnv('MCP_API_KEY', originalMcpApiKey);
	});

	it('requires auth before returning pending PRD content to non-local callers', async () => {
		const response = await GET(
			routeEvent('GET', null, 'https://spawner.example.com/api/prd-bridge/pending', '203.0.113.10') as never
		);

		expect(response.status).toBe(401);
	});

	it('returns pending PRD content to an authenticated worker', async () => {
		await writeFile(
			path.join(testSpawnerDir, 'pending-request.json'),
			JSON.stringify({
				status: 'pending',
				requestId: 'tg-build-pending-auth',
				missionId: 'mission-pending-auth',
				projectName: 'Pending Auth Board',
				options: { includeSkills: false }
			}),
			'utf-8'
		);
		await writeFile(path.join(testSpawnerDir, 'pending-prd.md'), '# Pending Auth Board', 'utf-8');

		const response = await GET(routeEvent('GET') as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			pending: true,
			requestId: 'tg-build-pending-auth',
			prdContent: '# Pending Auth Board',
			options: { includeSkills: false }
		});
	});

	it('requires auth before marking pending PRD processed from non-local callers', async () => {
		await writeFile(
			path.join(testSpawnerDir, 'pending-request.json'),
			JSON.stringify({ status: 'pending', requestId: 'tg-build-pending-delete' }),
			'utf-8'
		);

		const response = await DELETE(
			routeEvent('DELETE', null, 'https://spawner.example.com/api/prd-bridge/pending', '203.0.113.10') as never
		);
		const pending = JSON.parse(await readFile(path.join(testSpawnerDir, 'pending-request.json'), 'utf-8'));

		expect(response.status).toBe(401);
		expect(pending.status).toBe('pending');
	});

	it('requires auth before marking pending PRD processed from local loopback callers', async () => {
		await writeFile(
			path.join(testSpawnerDir, 'pending-request.json'),
			JSON.stringify({ status: 'pending', requestId: 'tg-build-pending-delete-local' }),
			'utf-8'
		);

		const response = await DELETE(routeEvent('DELETE', null) as never);
		const pending = JSON.parse(await readFile(path.join(testSpawnerDir, 'pending-request.json'), 'utf-8'));

		expect(response.status).toBe(401);
		expect(pending.status).toBe('pending');
	});

	it('marks pending PRD processed for authenticated workers', async () => {
		await writeFile(
			path.join(testSpawnerDir, 'pending-request.json'),
			JSON.stringify({ status: 'pending', requestId: 'tg-build-pending-delete' }),
			'utf-8'
		);

		const response = await DELETE(routeEvent('DELETE') as never);
		const pending = JSON.parse(await readFile(path.join(testSpawnerDir, 'pending-request.json'), 'utf-8'));

		expect(response.status).toBe(200);
		expect(pending.status).toBe('processed');
		expect(typeof pending.processedAt).toBe('string');
	});
});
