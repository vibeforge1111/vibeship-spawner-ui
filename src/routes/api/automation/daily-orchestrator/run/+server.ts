import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireControlAuth, enforceRateLimit } from '$lib/server/mcp-auth';
import { mcpClient } from '$lib/services/mcp-client';
import { executeMissionControlAction } from '$lib/server/mission-control-command';
import { buildDailyTopMissions, runMissionControlRegression } from '$lib/server/daily-orchestrator';

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'DailyOrchestratorRun',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'daily_orchestrator_run',
		limit: 30,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	try {
		const body = (await event.request.json().catch(() => ({}))) as Record<string, unknown>;
		const missionId = typeof body.missionId === 'string' && body.missionId.trim() ? body.missionId.trim() : 'mission-123';
		const includeKill = Boolean(body.includeKill);

		const list = await mcpClient.listMissions({ limit: 25 });
		const missions = list.success && list.data?.missions ? list.data.missions : [];
		const topMissions = buildDailyTopMissions(missions, 3);

		const regression = await runMissionControlRegression({
			missionId,
			execute: executeMissionControlAction,
			source: 'daily-orchestrator',
			includeKill
		});

		return json({
			ok: true,
			runAt: new Date().toISOString(),
			topMissions,
			regression,
			summary: {
				topMissionCount: topMissions.length,
				regressionPass: regression.pass,
				regressionNotes: regression.notes
			}
		});
	} catch (error) {
		return json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Daily orchestrator run failed'
			},
			{ status: 500 }
		);
	}
};
