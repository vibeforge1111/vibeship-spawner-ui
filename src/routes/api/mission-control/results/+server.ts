import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { providerRuntime } from '$lib/server/provider-runtime';

function resultsReadAuthPayload(event: Parameters<typeof requireControlAuth>[0]) {
	const openRead = requireControlAuth(event, {
		surface: 'MissionControlResults',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (openRead) return { openRead, hasControlAuth: false };

	const strictRead = requireControlAuth(event, {
		surface: 'MissionControlResults',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: false,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});

	return { openRead: null, hasControlAuth: strictRead === null };
}

export const GET: RequestHandler = async (event) => {
	const { openRead, hasControlAuth } = resultsReadAuthPayload(event);
	if (openRead) return openRead;

	const rateLimited = enforceRateLimit(event, {
		scope: 'mission_control_results',
		limit: 120,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	const missionId = event.url.searchParams.get('missionId');
	if (!missionId) {
		return json({ ok: false, error: 'missionId query parameter is required' }, { status: 400 });
	}

	const results = providerRuntime.getMissionResults(missionId);
	if (results.length === 0) {
		return json({ ok: false, error: 'mission not found or no provider sessions' }, { status: 404 });
	}

	return json({
		ok: true,
		missionId,
		results: hasControlAuth
			? results
			: results.map((result) => ({
					providerId: result.providerId,
					status: result.status,
					requestId: result.requestId || null,
					traceRef: result.traceRef || null,
					durationMs: result.durationMs,
					startedAt: result.startedAt,
					completedAt: result.completedAt,
					responseAvailable: Boolean(result.response),
					errorAvailable: Boolean(result.error),
					tokenUsageAvailable: Boolean(result.tokenUsage)
				})),
		...(hasControlAuth
			? {}
			: {
					authorityBoundary: {
						payload: 'status_only',
						response: 'requires_control_auth',
						error: 'requires_control_auth',
						tokenUsage: 'requires_control_auth'
					}
				}),
		serverTime: new Date().toISOString()
	});
};
