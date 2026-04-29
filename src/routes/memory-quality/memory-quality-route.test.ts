import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';
import path from 'path';
import {
	buildAccuracyBuckets,
	countFailureModes,
	recentRecallEvents,
	rollupSourceHealth,
	summarizeLatency
} from '$lib/services/memory-quality-aggregates';
import { loadMemoryQualityDataset } from '$lib/services/memory-quality';

describe('/memory-quality route', () => {
	it('renders the primary metric groups and sample marker with fallback data', async () => {
		const dataset = await loadMemoryQualityDataset({
			baseDir: 'missing',
			recallEventsFile: 'missing/recall-events.json',
			sourceHealthFile: 'missing/source-health.json',
			evaluationsFile: 'missing/evaluations.json'
		});
		const aggregates = {
			accuracyBuckets: buildAccuracyBuckets(dataset.events),
			failureModes: countFailureModes(dataset.events),
			latency: summarizeLatency(dataset.events),
			sourceHealth: rollupSourceHealth(dataset),
			recentEvents: recentRecallEvents(dataset.events)
		};
		const routeSource = await readFile(path.join(process.cwd(), 'src/routes/memory-quality/+page.svelte'), 'utf-8');

		expect(dataset.isSampleData).toBe(true);
		expect(aggregates.accuracyBuckets.length).toBeGreaterThan(0);
		expect(aggregates.recentEvents.length).toBeGreaterThan(0);
		expect(routeSource).toContain('Sample data');
		expect(routeSource).toContain('Accuracy over time');
		expect(routeSource).toContain('Failure modes');
		expect(routeSource).toContain('Latency metrics');
		expect(routeSource).toContain('Source health');
		expect(routeSource).toContain('Recent recall events');
		expect(routeSource).toContain('Manual evaluation');
	});
});
