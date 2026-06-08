import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { POST } from './+server';

const TEST_API_KEY = 'memory-quality-test-secret';
let originalMcpApiKey: string | undefined;
let testDir: string;

function routeEvent(
	body: unknown,
	apiKey: string | null = TEST_API_KEY,
	url = 'http://localhost/api/memory-quality/evaluations',
	clientAddress = '127.0.0.1'
) {
	const headers = new Headers({ 'Content-Type': 'application/json' });
	if (apiKey) headers.set('x-api-key', apiKey);
	return {
		request: new Request(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		}),
		url: new URL(url),
		getClientAddress: () => clientAddress,
		cookies: { get: () => undefined }
	};
}

describe('/api/memory-quality/evaluations integration', () => {
	beforeEach(async () => {
		originalMcpApiKey = process.env.MCP_API_KEY;
		process.env.MCP_API_KEY = TEST_API_KEY;
		testDir = await mkdtemp(path.join(tmpdir(), 'memory-quality-api-'));
		process.env.SPARK_MEMORY_QUALITY_DIR = testDir;
		delete process.env.MEMORY_QUALITY_RECALL_EVENTS_FILE;
		delete process.env.MEMORY_QUALITY_SOURCE_HEALTH_FILE;
		delete process.env.MEMORY_QUALITY_EVALUATIONS_FILE;
	});

	afterEach(async () => {
		if (originalMcpApiKey === undefined) {
			delete process.env.MCP_API_KEY;
		} else {
			process.env.MCP_API_KEY = originalMcpApiKey;
		}
		delete process.env.SPARK_MEMORY_QUALITY_DIR;
		await rm(testDir, { recursive: true, force: true });
	});

	it('rejects unauthenticated non-local manual evaluations before writing memory-quality state', async () => {
		const response = await POST(
			routeEvent(
				{ query: 'manual route query' },
				null,
				'https://spawner.example.com/api/memory-quality/evaluations',
				'203.0.113.10'
			) as never
		);

		expect(response.status).toBe(401);
		expect(existsSync(path.join(testDir, 'evaluations.json'))).toBe(false);
	});

	it('appends a valid evaluation and returns a refreshed dataset', async () => {
		const response = await POST(
			routeEvent({
				query: 'manual route query',
				source: 'domain-chip-memory',
				outcome: 'hit',
				latencyMs: 64,
				notes: 'route ok'
			}) as never
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.success).toBe(true);
		expect(body.dataset.events[0].query).toBe('manual route query');
		expect(body.aggregates.recentEvents[0].query).toBe('manual route query');
		expect(existsSync(path.join(testDir, 'evaluations.json'))).toBe(true);
	});

	it('returns inline validation errors for invalid payloads', async () => {
		const response = await POST(routeEvent({ query: '' }) as never);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.errors.query).toBeTruthy();
		expect(body.dataset.isSampleData).toBe(true);
	});
});
