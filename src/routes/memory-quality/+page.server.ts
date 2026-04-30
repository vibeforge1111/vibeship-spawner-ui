import {
	buildAccuracyBuckets,
	countFailureModes,
	recentRecallEvents,
	rollupSourceHealth,
	summarizeLatency
} from '$lib/services/memory-quality-aggregates';
import { loadMemoryQualityDataset } from '$lib/services/memory-quality';

export async function load() {
	const dataset = await loadMemoryQualityDataset();
	return {
		dataset,
		aggregates: {
			accuracyBuckets: buildAccuracyBuckets(dataset.events),
			failureModes: countFailureModes(dataset.events),
			latency: summarizeLatency(dataset.events),
			sourceHealth: rollupSourceHealth(dataset),
			recentEvents: recentRecallEvents(dataset.events)
		}
	};
}
