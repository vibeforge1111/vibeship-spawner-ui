import { logger } from '$lib/utils/logger';
/**
 * MCP Tool Call API
 *
 * POST /api/mcp/call - Call a tool on a connected MCP server
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callTool, isConnected } from '$lib/services/mcp/client';
import { requireMcpAuth } from '$lib/server/mcp-auth';

const LOCAL_PATH_PATTERN =
	/\b[A-Z]:\\[^\s`'"]+|(?<![\w.])\/(?:Users|home|tmp|var|private|Volumes|workspace|mnt|root)\/[^\s`'"]+/gi;

function safeToolCallLogDetail(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error || 'Tool call failed');
	return message.replace(LOCAL_PATH_PATTERN, '<local-path>').trim() || 'Tool call failed';
}

export const POST: RequestHandler = async (event) => {
	const unauthorized = requireMcpAuth(event);
	if (unauthorized) {
		return unauthorized;
	}

	try {
		const { request } = event;
		const body = await request.json();
		const { instanceId, toolName, args } = body as {
			instanceId: string;
			toolName: string;
			args?: Record<string, unknown>;
		};

		if (!instanceId) {
			return json({ error: 'instanceId is required' }, { status: 400 });
		}

		if (!toolName) {
			return json({ error: 'toolName is required' }, { status: 400 });
		}

		if (!isConnected(instanceId)) {
			return json({ error: 'MCP not connected' }, { status: 400 });
		}

		logger.info(`[API] Calling tool: ${toolName} on ${instanceId}`);

		const result = await callTool(instanceId, toolName, args || {});

		return json({
			success: true,
			instanceId,
			toolName,
			result,
		});
	} catch (error) {
		console.error('[API] Tool call error:', safeToolCallLogDetail(error));
		return json(
			{
				error: 'MCP tool call failed',
			},
			{ status: 500 }
		);
	}
};
