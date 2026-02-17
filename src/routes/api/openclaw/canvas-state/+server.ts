import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openclawBridge } from '$lib/services/openclaw-bridge';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'Openclaw',
		apiKeyEnvVar: 'OPENCLAW_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'OPENCLAW_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'openclaw_canvas_state',
		limit: 180,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	const since = event.url.searchParams.get('since') || undefined;
	const snapshot = openclawBridge.getLatestCanvasSnapshot(since);

	return json({
		success: true,
		hasUpdate: !!snapshot,
		snapshot
	});
};
