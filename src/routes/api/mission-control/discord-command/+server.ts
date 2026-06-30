import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	executeMissionControlAction,
	parseDiscordMissionControlCommand
} from '$lib/server/mission-control-command';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { HarnessAuthorityError } from '$lib/server/harness-authority';

function missionControlReply(parsed: { action: string; missionId: string }, result: Record<string, unknown>): string {
	if (result.ok === false) {
		const error = typeof result.error === 'string' && result.error.trim() ? result.error.trim() : 'command failed';
		return `Could not ${parsed.action} ${parsed.missionId}: ${error}`;
	}
	if (parsed.action === 'status') {
		return `Status for ${parsed.missionId} is available.`;
	}
	return `${parsed.action.toUpperCase()} ${parsed.missionId} accepted.`;
}

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'MissionControlDiscordCommand',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: false,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'mission_control_discord_command',
		limit: 240,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	try {
		const body = (await event.request.json().catch(() => ({}))) as Record<string, unknown>;
		const text = typeof body.text === 'string' ? body.text : '';
		const source = typeof body.source === 'string' ? body.source : 'discord';

		const parsed = parseDiscordMissionControlCommand(text);
		if (!parsed.ok) {
			return json({
				ok: false,
				error: parsed.error,
				help: parsed.help
			});
		}

		const result = await executeMissionControlAction({
			missionId: parsed.missionId,
			action: parsed.action,
			source,
			executionAuthority: body.executionAuthority
		});
		const ok = result.ok !== false;

		return json({
			ok,
			parsed,
			result,
			reply: missionControlReply(parsed, result)
		});
	} catch (error) {
		console.error('[MissionControl] Discord command failed:', error);
		return json(
			{
				ok: false,
				error: 'Internal error',
				help: 'Use: mission <status|pause|resume|kill> <missionId>'
			},
			{ status: 500 }
		);
	}
};
