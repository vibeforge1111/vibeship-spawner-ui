import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCreatorMission, readCreatorMissionTrace, type CreatorPrivacyMode, type CreatorRiskLevel } from '$lib/server/creator-mission';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';

interface CreatorMissionBody {
	brief?: string;
	requestId?: string;
	missionId?: string;
	privacyMode?: CreatorPrivacyMode;
	riskLevel?: CreatorRiskLevel;
}

function isPrivacyMode(value: unknown): value is CreatorPrivacyMode {
	return value === 'local_only' || value === 'github_pr' || value === 'swarm_shared';
}

function isRiskLevel(value: unknown): value is CreatorRiskLevel {
	return value === 'low' || value === 'medium' || value === 'high';
}

function emitCreatorEvent(type: string, trace: Awaited<ReturnType<typeof createCreatorMission>>, message: string, data: Record<string, unknown> = {}) {
	void relayMissionControlEvent({
		type,
		missionId: trace.mission_id,
		missionName: `Creator Mission: ${trace.intent_packet.target_domain}`,
		source: 'creator-mission',
		timestamp: new Date().toISOString(),
		message,
		taskName: type.startsWith('task_') ? 'Create creator intent packet' : undefined,
		data: {
			requestId: trace.request_id,
			creatorMode: trace.creator_mode,
			targetDomain: trace.intent_packet.target_domain,
			artifacts: trace.artifacts,
			plannedTasks: [
				{ title: 'Create creator intent packet', skills: ['spark-intelligence-builder', 'creator-system'] }
			],
			...data
		}
	});
}

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'CreatorMission',
		apiKeyEnvVar: 'SPARK_BRIDGE_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'creator_mission',
		limit: 30,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	try {
		const body = (await event.request.json().catch(() => ({}))) as CreatorMissionBody;
		const brief = body.brief?.trim();
		if (!brief) {
			return json({ ok: false, error: 'brief is required' }, { status: 400 });
		}
		if (body.privacyMode !== undefined && !isPrivacyMode(body.privacyMode)) {
			return json({ ok: false, error: 'privacyMode must be local_only, github_pr, or swarm_shared' }, { status: 400 });
		}
		if (body.riskLevel !== undefined && !isRiskLevel(body.riskLevel)) {
			return json({ ok: false, error: 'riskLevel must be low, medium, or high' }, { status: 400 });
		}

		const trace = await createCreatorMission({
			brief,
			requestId: body.requestId,
			missionId: body.missionId,
			privacyMode: body.privacyMode,
			riskLevel: body.riskLevel,
			baseUrl: new URL(event.request.url).origin
		});

		emitCreatorEvent('mission_created', trace, `Creator mission created for ${trace.intent_packet.target_domain}.`);
		emitCreatorEvent('task_started', trace, 'Creating creator intent packet.');
		emitCreatorEvent('task_completed', trace, 'Creator intent packet created.', { intentPacket: trace.intent_packet });
		emitCreatorEvent('mission_completed', trace, `Creator mission planned ${trace.artifacts.length} artifact type(s).`);

		return json({ ok: true, missionId: trace.mission_id, requestId: trace.request_id, trace });
	} catch (error) {
		return json(
			{ ok: false, error: error instanceof Error ? error.message : 'creator mission failed' },
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'CreatorMission',
		apiKeyEnvVar: 'SPARK_BRIDGE_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		allowLoopbackWithoutKey: true
	});
	if (unauthorized) return unauthorized;

	const trace = await readCreatorMissionTrace({
		missionId: event.url.searchParams.get('missionId') || event.url.searchParams.get('mission'),
		requestId: event.url.searchParams.get('requestId')
	});
	if (!trace) {
		return json({ ok: false, error: 'creator mission trace not found' }, { status: 404 });
	}
	return json({ ok: true, trace });
};

