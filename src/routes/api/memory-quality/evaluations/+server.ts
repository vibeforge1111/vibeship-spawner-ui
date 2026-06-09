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
import { requireControlAuth } from '$lib/server/mcp-auth';

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'MemoryQualityEvaluations',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: false,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const { request } = event;
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
