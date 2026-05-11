import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { spawnerStateRootAudit } from '$lib/server/spawner-state';

export const GET: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'SpawnerStateRootAudit',
		apiKeyEnvVar: 'SPARK_BRIDGE_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'MCP_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'spawner_state_root_audit',
		limit: 120,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	return json({
		ok: true,
		stateRoot: spawnerStateRootAudit()
	});
};
