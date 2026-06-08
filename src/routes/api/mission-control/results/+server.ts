import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { providerRuntime } from '$lib/server/provider-runtime';

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'MissionControlResults',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

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
		results,
		serverTime: new Date().toISOString()
	});
};
