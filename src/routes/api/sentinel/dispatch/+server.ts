import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import {
	normalizeSentinelDispatchPayload,
	type SentinelDispatchPayload,
	validateSentinelDispatchPayload
} from '$lib/server/sentinel-dispatch';
import { eventBridge } from '$lib/services/event-bridge';

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'SentinelDispatch',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'sentinel_dispatch_post',
		limit: 60,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	try {
		const payload = await event.request.json();
		const errors = validateSentinelDispatchPayload(payload);
		if (errors.length > 0) {
			return json({ ok: false, errors }, { status: 422 });
		}

		const normalized = normalizeSentinelDispatchPayload(payload as SentinelDispatchPayload);
		const accepted = normalized.actions.length;
		const receivedAt = new Date().toISOString();

		for (const action of normalized.actions.slice(0, 50)) {
			eventBridge.emit({
				type: 'sentinel_action_received',
				missionId: 'sentinel-dispatch',
				taskId: action.id,
				taskName: action.title,
				message: `${action.priority} ${action.kind}`,
				data: action,
				timestamp: receivedAt,
				source: 'spark-pr-sentinel'
			});
		}

		return json({
			ok: true,
			accepted,
			receivedAt,
			summary: normalized.summary,
			message: `Accepted ${accepted} sentinel actions`
		});
	} catch (error) {
		return json(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Sentinel dispatch failed'
			},
			{ status: 500 }
		);
	}
};
