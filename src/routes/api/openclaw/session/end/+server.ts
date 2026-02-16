import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openclawBridge } from '$lib/services/openclaw-bridge';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'Openclaw',
		apiKeyEnvVar: 'OPENCLAW_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'OPENCLAW_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'openclaw_session_end',
		limit: 60,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	try {
		const body = (await event.request.json().catch(() => ({}))) as Record<string, unknown>;
		const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
		const reason = typeof body.reason === 'string' ? body.reason : 'requested';
		if (!sessionId) {
			return json({ success: false, error: 'sessionId is required' }, { status: 400 });
		}

		const session = openclawBridge.endSession(sessionId, reason);
		return json({
			success: true,
			session: {
				id: session.id,
				status: session.status,
				endedAt: session.endedAt,
				updatedAt: session.updatedAt
			}
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to end session'
			},
			{ status: 404 }
		);
	}
};
