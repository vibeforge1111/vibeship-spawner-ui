import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { creatorMissionPath, executeCreatorMission } from '$lib/server/creator-mission';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';

interface ExecuteCreatorMissionBody {
	missionId?: string;
	requestId?: string;
}

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'CreatorMissionExecute',
		apiKeyEnvVar: 'SPARK_BRIDGE_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'creator_mission_execute',
		limit: 20,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	try {
		const body = (await event.request.json().catch(() => ({}))) as ExecuteCreatorMissionBody;
		const missionId = body.missionId?.trim();
		const requestId = body.requestId?.trim();
		if (!missionId && !requestId) {
			return json({ ok: false, error: 'missionId or requestId is required' }, { status: 400 });
		}

		const result = await executeCreatorMission({ missionId, requestId });
		return json({
			ok: true,
			missionId: result.trace.mission_id,
			requestId: result.trace.request_id,
			canvasUrl: result.trace.links.canvas,
			tracePath: creatorMissionPath(result.trace.mission_id),
			started: result.dispatch.started,
			skipped: result.dispatch.skipped === true,
			reason: result.dispatch.reason,
			providerId: result.dispatch.providerId,
			projectPath: result.dispatch.projectPath,
			error: result.dispatch.error,
			trace: result.trace
		});
	} catch (error) {
		return json(
			{ ok: false, error: error instanceof Error ? error.message : 'creator mission execution failed' },
			{ status: 500 }
		);
	}
};
