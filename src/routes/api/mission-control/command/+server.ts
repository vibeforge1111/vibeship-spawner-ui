import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	executeMissionControlAction,
	isMissionControlAction
} from '$lib/server/mission-control-command';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'MissionControlCommand',
		apiKeyEnvVar: 'SPARK_BRIDGE_API_KEY',
		fallbackApiKeyEnvVars: ['EVENTS_API_KEY', 'MCP_API_KEY'],
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'mission_control_command',
		limit: 180,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	try {
		const body = (await event.request.json().catch(() => ({}))) as Record<string, unknown>;
		const missionId = typeof body.missionId === 'string' ? body.missionId.trim() : '';
		const action = body.action;
		const source = typeof body.source === 'string' ? body.source.trim() || 'mission-control' : 'mission-control';

		if (!missionId) {
			return json({ ok: false, error: 'missionId is required' }, { status: 400 });
		}
		if (!isMissionControlAction(action)) {
			return json({ ok: false, error: 'action must be pause|resume|kill|status' }, { status: 400 });
		}

		const result = await executeMissionControlAction({ missionId, action, source });
		return json(result);
	} catch (error) {
		return json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Mission control command failed'
			},
			{ status: 500 }
		);
	}
};
