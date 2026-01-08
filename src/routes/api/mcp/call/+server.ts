/**
 * MCP Tool Call API
 *
 * POST /api/mcp/call - Call a tool on a connected MCP server
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callTool, isConnected } from '$lib/services/mcp/client';

export const POST: RequestHandler = async ({ request }) => {
	try {
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

		console.log(`[API] Calling tool: ${toolName} on ${instanceId}`);

		const result = await callTool(instanceId, toolName, args || {});

		return json({
			success: true,
			instanceId,
			toolName,
			result,
		});
	} catch (error) {
		console.error('[API] Tool call error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Tool call failed',
			},
			{ status: 500 }
		);
	}
};
