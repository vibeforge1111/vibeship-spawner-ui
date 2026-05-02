import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	executeMissionControlAction,
	parseDiscordMissionControlCommand
} from '$lib/server/mission-control-command';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'MissionControlDiscordCommand',
		apiKeyEnvVar: 'SPARK_BRIDGE_API_KEY',
		fallbackApiKeyEnvVars: ['EVENTS_API_KEY', 'MCP_API_KEY'],
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: true,
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
			source
		});

		return json({
			ok: true,
			parsed,
			result,
			reply: `✅ ${parsed.action.toUpperCase()} ${parsed.missionId} executed.`
		});
	} catch (error) {
		return json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Mission control discord command failed',
				help: 'Use: mission <status|pause|resume|kill> <missionId>'
			},
			{ status: 500 }
		);
	}
};
