import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { providerRuntime } from '$lib/server/provider-runtime';
import { buildMissionControlTrace } from '$lib/server/mission-control-trace';

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'MissionControlTrace',
		apiKeyEnvVar: 'SPARK_BRIDGE_API_KEY',
		fallbackApiKeyEnvVars: ['EVENTS_API_KEY', 'MCP_API_KEY'],
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'mission_control_trace',
		limit: 240,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	const missionId =
		event.url.searchParams.get('missionId') ||
		event.url.searchParams.get('mission');
	const requestId = event.url.searchParams.get('requestId');

	const trace = await buildMissionControlTrace({
		missionId,
		requestId,
		getProviderResults: (id) => providerRuntime.getMissionResults(id),
		getDispatchStatus: (id) => providerRuntime.getMissionStatus(id)
	});

	return json(trace);
};
