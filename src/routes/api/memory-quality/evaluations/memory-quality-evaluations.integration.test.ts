import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { POST } from './+server';

let testDir: string;

describe('/api/memory-quality/evaluations integration', () => {
	beforeEach(async () => {
		testDir = await mkdtemp(path.join(tmpdir(), 'memory-quality-api-'));
		process.env.SPARK_MEMORY_QUALITY_DIR = testDir;
		delete process.env.MEMORY_QUALITY_RECALL_EVENTS_FILE;
		delete process.env.MEMORY_QUALITY_SOURCE_HEALTH_FILE;
		delete process.env.MEMORY_QUALITY_EVALUATIONS_FILE;
	});

	afterEach(async () => {
		delete process.env.SPARK_MEMORY_QUALITY_DIR;
		await rm(testDir, { recursive: true, force: true });
	});

	it('appends a valid evaluation and returns a refreshed dataset', async () => {
		const response = await POST({
			request: new Request('http://localhost/api/memory-quality/evaluations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query: 'manual route query',
					source: 'domain-chip-memory',
					outcome: 'hit',
					latencyMs: 64,
					notes: 'route ok'
				})
			})
		} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.success).toBe(true);
		expect(body.dataset.events[0].query).toBe('manual route query');
		expect(body.aggregates.recentEvents[0].query).toBe('manual route query');
		expect(existsSync(path.join(testDir, 'evaluations.json'))).toBe(true);
	});

	it('returns inline validation errors for invalid payloads', async () => {
		const response = await POST({
			request: new Request('http://localhost/api/memory-quality/evaluations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ query: '' })
			})
		} as never);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.errors.query).toBeTruthy();
		expect(body.dataset.isSampleData).toBe(true);
	});
});
