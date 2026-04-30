import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateCreatorMission } from '$lib/server/creator-mission';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';

interface ValidateCreatorMissionBody {
	missionId?: string;
	requestId?: string;
	maxCommands?: number;
}

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'CreatorMissionValidate',
		apiKeyEnvVar: 'SPARK_BRIDGE_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'creator_mission_validate',
		limit: 10,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	try {
		const body = (await event.request.json().catch(() => ({}))) as ValidateCreatorMissionBody;
		const missionId = body.missionId?.trim();
		const requestId = body.requestId?.trim();
		if (!missionId && !requestId) {
			return json({ ok: false, error: 'missionId or requestId is required' }, { status: 400 });
		}

		const result = await validateCreatorMission({
			missionId,
			requestId,
			maxCommands: typeof body.maxCommands === 'number' ? body.maxCommands : undefined
		});
		return json({
			ok: true,
			missionId: result.trace.mission_id,
			requestId: result.trace.request_id,
			status: result.run.status,
			run: result.run,
			trace: result.trace
		});
	} catch (error) {
		return json(
			{ ok: false, error: error instanceof Error ? error.message : 'creator mission validation failed' },
			{ status: 500 }
		);
	}
};
