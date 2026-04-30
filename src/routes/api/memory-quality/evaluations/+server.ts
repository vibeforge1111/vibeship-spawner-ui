import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	buildAccuracyBuckets,
	countFailureModes,
	recentRecallEvents,
	rollupSourceHealth,
	summarizeLatency
} from '$lib/services/memory-quality-aggregates';
import { appendManualEvaluation } from '$lib/services/memory-quality-evaluations';

export const POST: RequestHandler = async ({ request }) => {
	const payload = await request.json().catch(() => ({}));
	const result = await appendManualEvaluation(payload);
	const status = result.errors ? 400 : 200;
	return json({
		success: !result.errors,
		errors: result.errors || {},
		event: result.event,
		dataset: result.dataset,
		aggregates: {
			accuracyBuckets: buildAccuracyBuckets(result.dataset.events),
			failureModes: countFailureModes(result.dataset.events),
			latency: summarizeLatency(result.dataset.events),
			sourceHealth: rollupSourceHealth(result.dataset),
			recentEvents: recentRecallEvents(result.dataset.events)
		}
	}, { status });
};
