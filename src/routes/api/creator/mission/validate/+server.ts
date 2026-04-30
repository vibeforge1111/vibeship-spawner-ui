import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateCreatorMission } from '$lib/server/creator-mission';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';

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

		const validationStartedAt = new Date().toISOString();
		const result = await validateCreatorMission({
			missionId,
			requestId,
			maxCommands: typeof body.maxCommands === 'number' ? body.maxCommands : undefined
		});
		const validationTask = result.trace.tasks.find((task) => task.id === 'creator-validation') || result.trace.tasks[0];
		void relayMissionControlEvent({
			type: 'task_started',
			missionId: result.trace.mission_id,
			missionName: `Creator Mission: ${result.trace.intent_packet.target_domain}`,
			source: 'creator-mission',
			timestamp: validationStartedAt,
			taskId: validationTask?.id || 'creator-validation',
			taskName: validationTask?.title || 'Run creator validation gates',
			message: 'Running creator validation gates.',
			data: {
				requestId: result.trace.request_id,
				creatorMode: result.trace.creator_mode,
				targetDomain: result.trace.intent_packet.target_domain,
				validationStatus: 'running',
				suppressExternalRelay: true
			}
		});
		void relayMissionControlEvent({
			type: result.run.status === 'passed' ? 'task_completed' : 'task_failed',
			missionId: result.trace.mission_id,
			missionName: `Creator Mission: ${result.trace.intent_packet.target_domain}`,
			source: 'creator-mission',
			timestamp: result.run.completed_at,
			taskId: validationTask?.id || 'creator-validation',
			taskName: validationTask?.title || 'Run creator validation gates',
			message: `Creator validation ${result.run.status}: ${result.run.results.length} command(s) checked.`,
			data: {
				requestId: result.trace.request_id,
				creatorMode: result.trace.creator_mode,
				targetDomain: result.trace.intent_packet.target_domain,
				validationStatus: result.run.status,
				validationRunId: result.run.run_id,
				validationCommandCount: result.run.results.length,
				validationFailures: result.run.results.filter((item) => item.status === 'failed').length,
				validationSkipped: result.run.results.filter((item) => item.status === 'skipped').length,
				suppressExternalRelay: true
			}
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
