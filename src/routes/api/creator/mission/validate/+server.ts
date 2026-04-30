import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	readCreatorMissionTrace,
	validateCreatorMission,
	type CreatorMissionTrace,
	type CreatorValidationCommandProgress
} from '$lib/server/creator-mission';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';

interface ValidateCreatorMissionBody {
	missionId?: string;
	requestId?: string;
	maxCommands?: number;
	async?: boolean;
}

function validationProgressPercent(progress: CreatorValidationCommandProgress): number {
	if (progress.total <= 0) return 0;
	const completedUnits = progress.phase === 'completed' ? progress.index : progress.index - 1;
	return Math.max(0, Math.min(99, Math.round((completedUnits / progress.total) * 100)));
}

function emitValidationProgress(
	trace: CreatorMissionTrace,
	validationTask: CreatorMissionTrace['tasks'][number] | undefined,
	progress: CreatorValidationCommandProgress
) {
	const status = progress.result?.status || 'running';
	void relayMissionControlEvent({
		type: 'task_progress',
		missionId: trace.mission_id,
		missionName: `Creator Mission: ${trace.intent_packet.target_domain}`,
		source: 'creator-mission',
		timestamp: new Date().toISOString(),
		taskId: validationTask?.id || 'creator-validation',
		taskName: validationTask?.title || 'Run creator validation gates',
		message:
			progress.phase === 'started'
				? `Validation ${progress.index}/${progress.total} started: ${progress.manifest.repo}`
				: `Validation ${progress.index}/${progress.total} ${status}: ${progress.manifest.repo}`,
		data: {
			requestId: trace.request_id,
			creatorMode: trace.creator_mode,
			targetDomain: trace.intent_packet.target_domain,
			validationStatus: status,
			validationPhase: progress.phase,
			validationCommandIndex: progress.index,
			validationCommandTotal: progress.total,
			validationArtifactId: progress.manifest.artifact_id,
			validationArtifactType: progress.manifest.artifact_type,
			validationRepo: progress.manifest.repo,
			validationCommand: progress.command,
			validationCommandStatus: progress.result?.status || null,
			progress: validationProgressPercent(progress),
			suppressExternalRelay: true
		}
	});
}

function emitValidationFailed(trace: CreatorMissionTrace, error: unknown) {
	const validationTask = trace.tasks.find((task) => task.id === 'creator-validation') || trace.tasks[0];
	const message = error instanceof Error ? error.message : 'creator mission validation failed';
	void relayMissionControlEvent({
		type: 'task_failed',
		missionId: trace.mission_id,
		missionName: `Creator Mission: ${trace.intent_packet.target_domain}`,
		source: 'creator-mission',
		timestamp: new Date().toISOString(),
		taskId: validationTask?.id || 'creator-validation',
		taskName: validationTask?.title || 'Run creator validation gates',
		message,
		data: {
			requestId: trace.request_id,
			creatorMode: trace.creator_mode,
			targetDomain: trace.intent_packet.target_domain,
			validationStatus: 'failed',
			error: message,
			suppressExternalRelay: true
		}
	});
}

async function runCreatorMissionValidationWithEvents(
	input: { missionId?: string; requestId?: string; maxCommands?: number },
	pendingTrace: CreatorMissionTrace
) {
	const pendingValidationTask = pendingTrace.tasks.find((task) => task.id === 'creator-validation') || pendingTrace.tasks[0];
	const result = await validateCreatorMission(input, {
		onCommandProgress: (progress) => emitValidationProgress(pendingTrace, pendingValidationTask, progress)
	});
	const validationTask = result.trace.tasks.find((task) => task.id === 'creator-validation') || result.trace.tasks[0];
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
	return result;
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
		const pendingTrace = await readCreatorMissionTrace({ missionId, requestId });
		if (!pendingTrace) {
			return json({ ok: false, error: 'creator mission trace not found' }, { status: 404 });
		}
		const pendingValidationTask = pendingTrace.tasks.find((task) => task.id === 'creator-validation') || pendingTrace.tasks[0];
		void relayMissionControlEvent({
			type: 'task_started',
			missionId: pendingTrace.mission_id,
			missionName: `Creator Mission: ${pendingTrace.intent_packet.target_domain}`,
			source: 'creator-mission',
			timestamp: validationStartedAt,
			taskId: pendingValidationTask?.id || 'creator-validation',
			taskName: pendingValidationTask?.title || 'Run creator validation gates',
			message: 'Running creator validation gates.',
			data: {
				requestId: pendingTrace.request_id,
				creatorMode: pendingTrace.creator_mode,
				targetDomain: pendingTrace.intent_packet.target_domain,
				validationStatus: 'running',
				suppressExternalRelay: true
			}
		});

		const validationInput = {
			missionId,
			requestId,
			maxCommands: typeof body.maxCommands === 'number' ? body.maxCommands : undefined
		};
		if (body.async === true) {
			void runCreatorMissionValidationWithEvents(validationInput, pendingTrace).catch((error) => {
				emitValidationFailed(pendingTrace, error);
			});
			return json({
				ok: true,
				accepted: true,
				status: 'running',
				missionId: pendingTrace.mission_id,
				requestId: pendingTrace.request_id
			}, { status: 202 });
		}

		const result = await runCreatorMissionValidationWithEvents(validationInput, pendingTrace);
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
