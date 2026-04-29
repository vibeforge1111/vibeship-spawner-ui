import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
	MEMORY_FAILURE_MODES,
	MEMORY_SOURCES,
	loadMemoryQualityDataset,
	type MemoryQualityPaths
} from './memory-quality';

let testDir: string;
let paths: MemoryQualityPaths;

describe('memory quality loader', () => {
	beforeEach(async () => {
		testDir = await mkdtemp(path.join(tmpdir(), 'memory-quality-'));
		paths = {
			baseDir: testDir,
			recallEventsFile: path.join(testDir, 'recall-events.json'),
			sourceHealthFile: path.join(testDir, 'source-health.json'),
			evaluationsFile: path.join(testDir, 'evaluations.json')
		};
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it('returns marked sample data with warnings when live files are missing', async () => {
		const dataset = await loadMemoryQualityDataset(paths);

		expect(dataset.isSampleData).toBe(true);
		expect(dataset.events.length).toBeGreaterThan(0);
		expect(dataset.sourceHealth.map((record) => record.source)).toEqual([...MEMORY_SOURCES]);
		expect(dataset.warnings.some((warning) => warning.source === 'recall events')).toBe(true);
	});

	it('normalizes live event and source health files', async () => {
		await writeFile(paths.recallEventsFile, JSON.stringify({
			events: [
				{
					id: 'live-1',
					timestamp: '2026-04-28T01:00:00Z',
					query: 'live query',
					source: 'domain-chip-memory',
					outcome: 'hit',
					latencyMs: 42,
					failureMode: null,
					notes: 'ok'
				}
			]
		}));
		await writeFile(paths.sourceHealthFile, JSON.stringify([
			{
				source: 'domain-chip-memory',
				status: 'healthy',
				lastSeenAt: '2026-04-28T01:00:00Z',
				successRate: 0.99,
				warningCount: 0,
				notes: 'live'
			}
		]));

		const dataset = await loadMemoryQualityDataset(paths);

		expect(dataset.isSampleData).toBe(false);
		expect(dataset.events).toHaveLength(1);
		expect(dataset.events[0].query).toBe('live query');
		expect(dataset.sourceHealth).toHaveLength(4);
		expect(dataset.sourceHealth[0].status).toBe('healthy');
	});

	it('records unreadable files as warnings and falls back to sample data', async () => {
		await writeFile(paths.recallEventsFile, '{bad json');

		const dataset = await loadMemoryQualityDataset(paths);

		expect(dataset.isSampleData).toBe(true);
		expect(dataset.warnings.some((warning) => warning.path === paths.recallEventsFile)).toBe(true);
	});

	it('keeps the supported failure mode list exact', () => {
		expect(MEMORY_FAILURE_MODES).toEqual([
			'confabulation',
			'omission',
			'drift',
			'stale recall',
			'source unavailable'
		]);
	});
});
