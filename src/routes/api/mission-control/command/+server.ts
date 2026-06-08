import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	executeMissionControlAction,
	isMissionControlAction
} from '$lib/server/mission-control-command';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { HarnessAuthorityError, buildServerGovernorDecisionAuthority } from '$lib/server/harness-authority';

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'MissionControlCommand',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: false,
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

		const executionAuthority = body.executionAuthority ?? (
			source.startsWith('mission-detail.')
				? buildServerGovernorDecisionAuthority({
						source,
						reason: 'Authenticated Spawner UI mission-control action.',
						toolName: 'spawner.mission_control.command',
						mutationClass: 'controls_mission',
						target: missionId,
						requestId: `spawner-ui-${action}-${missionId}`
					})
				: undefined
		);
		const result = await executeMissionControlAction({ missionId, action, source, executionAuthority });
		return json(result);
	} catch (error) {
		if (error instanceof HarnessAuthorityError) {
			return json({ ok: false, error: error.message, code: error.code, authority: error.verdict }, { status: error.status });
		}
		return json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Mission control command failed'
			},
			{ status: 500 }
		);
	}
};
