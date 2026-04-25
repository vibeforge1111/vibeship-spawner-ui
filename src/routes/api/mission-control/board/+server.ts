import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { getMissionControlBoard } from '$lib/server/mission-control-relay';
import { enrichMissionControlBoardWithProviderResults } from '$lib/server/mission-control-results';
import { providerRuntime } from '$lib/server/provider-runtime';

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'MissionControlBoard',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'mission_control_board',
		limit: 240,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	return json({
		ok: true,
		board: enrichMissionControlBoardWithProviderResults(
			getMissionControlBoard(),
			(missionId) => providerRuntime.getMissionResults(missionId)
		),
		serverTime: new Date().toISOString()
	});
};
