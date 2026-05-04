import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { getMissionControlBoard, getMissionControlRelaySnapshot } from '$lib/server/mission-control-relay';
import { summarizeProviderResults } from '$lib/server/mission-control-results';
import { providerRuntime } from '$lib/server/provider-runtime';
import type { MissionControlProjectLineage } from '$lib/types/mission-control';
import {
	missionControlPathForMission,
	resolveMissionControlAccess
} from '$lib/server/mission-control-access';

function findProjectLineage(missionId: string | undefined): MissionControlProjectLineage | null {
	if (!missionId) return null;
	const board = getMissionControlBoard();
	for (const entries of Object.values(board)) {
		const entry = entries.find((candidate) => candidate.missionId === missionId);
		if (entry?.projectLineage) return entry.projectLineage;
	}
	return null;
}

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'MissionControlStatus',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'mission_control_status',
		limit: 240,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	const missionId = event.url.searchParams.get('missionId') || undefined;
	const snapshot = getMissionControlRelaySnapshot(missionId);
	const providerResultSummary = missionId
		? summarizeProviderResults(providerRuntime.getMissionResults(missionId))
		: { providerResults: [], providerSummary: null };
	const projectLineage = findProjectLineage(missionId);
	const missionControlAccess = resolveMissionControlAccess(missionControlPathForMission(missionId));

	return json({
		ok: true,
		missionId: missionId || null,
		missionControlAccess,
		snapshot: {
			...snapshot,
			...providerResultSummary,
			projectLineage
		},
		serverTime: new Date().toISOString()
	});
};
