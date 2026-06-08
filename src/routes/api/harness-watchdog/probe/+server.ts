import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	assertWatchdogPayloadRedacted,
	createWatchdogProbeBoard,
	watchdogProbeBoardSchema
} from '$lib/services/harness-watchdog';
import { collectHarnessWatchdogRuntime } from '$lib/server/harness-watchdog-runtime';
import { collectHarnessWatchdogAuthority } from '$lib/server/harness-watchdog-authority';
import { collectHarnessWatchdogTelegram } from '$lib/server/harness-watchdog-telegram';
import { collectHarnessWatchdogRegistry } from '$lib/server/harness-watchdog-registry';
import { mergeEvidenceRefs } from '$lib/server/harness-watchdog-state';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,180}$/;
const SAFE_MISSION_ID = /^(?:mission|spark)-[A-Za-z0-9][A-Za-z0-9_-]{2,200}$/;
const SAFE_TRACE_REF = /^[A-Za-z0-9][A-Za-z0-9:_-]{2,220}$/;

function safeParam(value: string | null): string | null {
	return value?.trim() || null;
}

function invalidIdResponse(kind: 'requestId' | 'missionId' | 'traceRef'): Response {
	return json(
		{
			error: `Invalid ${kind}`,
			code: `invalid_${kind}`
		},
		{ status: 400 }
	);
}

function hasSpawnerEvidence(evidenceRefs: Array<{ id: string; redaction: string }>): boolean {
	const stateEvidenceIds = new Set([
		'state.pending-request',
		'state.last-canvas-load',
		'state.prd-result',
		'telegram.mission-control-relay',
		'runtime.provider-results',
		'runtime.mission-control-board',
		'authority.execution'
	]);
	return evidenceRefs.some((ref) => ref.redaction === 'metadata_only' && stateEvidenceIds.has(ref.id));
}

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'HarnessWatchdogProbe',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: false,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'harness_watchdog_probe',
		limit: 240,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	const requestId = safeParam(event.url.searchParams.get('requestId'));
	const missionId = safeParam(event.url.searchParams.get('missionId') || event.url.searchParams.get('mission'));
	const traceRef = safeParam(event.url.searchParams.get('traceRef') || event.url.searchParams.get('trace'));

	if (requestId && !SAFE_REQUEST_ID.test(requestId)) return invalidIdResponse('requestId');
	if (missionId && !SAFE_MISSION_ID.test(missionId)) return invalidIdResponse('missionId');
	if (traceRef && !SAFE_TRACE_REF.test(traceRef)) return invalidIdResponse('traceRef');

	try {
		const checkedAt = new Date().toISOString();
		const collectorInput = { requestId, missionId, traceRef, checkedAt };
		const [runtime, authority, telegram, registry] = await Promise.all([
			collectHarnessWatchdogRuntime(collectorInput),
			collectHarnessWatchdogAuthority(collectorInput),
			collectHarnessWatchdogTelegram(collectorInput),
			collectHarnessWatchdogRegistry(collectorInput)
		]);
		const resolvedRequestId = requestId || runtime.requestId || authority.requestId || telegram.requestId || registry.requestId;
		const resolvedMissionId = missionId || runtime.missionId || authority.missionId || telegram.missionId || registry.missionId;
		const resolvedTraceRef = traceRef || runtime.traceRef || authority.traceRef || telegram.traceRef || registry.traceRef;
		const evidenceRefs = mergeEvidenceRefs(
			runtime.evidenceRefs,
			authority.evidenceRefs,
			telegram.evidenceRefs,
			registry.evidenceRefs
		);

		if (!hasSpawnerEvidence(evidenceRefs)) {
			return json(
				{
					error: 'Harness watchdog state not found',
					code: 'watchdog_state_missing',
					requestId: resolvedRequestId,
					missionId: resolvedMissionId,
					traceRef: resolvedTraceRef
				},
				{ status: 404 }
			);
		}

		const board = createWatchdogProbeBoard({
			requestId: resolvedRequestId,
			missionId: resolvedMissionId,
			traceRef: resolvedTraceRef,
			status: 'healthy',
			checkedAt,
			runtimeHealth: runtime.rows,
			authorityGates: authority.rows,
			telegramProof: telegram.rows,
			registryDrift: registry.rows,
			rollbackNotes: registry.rollbackNotes,
			openBlockers: [
				...runtime.openBlockers,
				...authority.openBlockers,
				...telegram.openBlockers,
				...registry.openBlockers
			],
			evidenceRefs
		});
		watchdogProbeBoardSchema.parse(board);
		assertWatchdogPayloadRedacted(board);
		return json(board);
	} catch (error) {
		console.error('[HarnessWatchdogProbe] failed to build probe board:', error);
		return json(
			{
				error: 'Failed to build harness watchdog probe',
				code: 'watchdog_probe_failed'
			},
			{ status: 500 }
		);
	}
};
