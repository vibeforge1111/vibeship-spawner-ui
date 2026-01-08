/**
 * MCP Connection API
 *
 * Server-side API for managing MCP connections.
 * The MCP SDK requires Node.js (stdio transport), so connections
 * are managed server-side and exposed via HTTP.
 *
 * Endpoints:
 * POST /api/mcp - Connect to an MCP
 * DELETE /api/mcp - Disconnect from an MCP
 * GET /api/mcp - Get connection status
 * POST /api/mcp/call - Call a tool
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	connectMCP,
	disconnectMCP,
	callTool,
	isConnected,
	getTools,
	getConnectionInfo,
	PRECONFIGURED_MCPS,
	type MCPClientConfig,
} from '$lib/services/mcp/client';

/**
 * POST - Connect to an MCP server
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { instanceId, mcpId, config } = body as {
			instanceId: string;
			mcpId?: string;
			config?: MCPClientConfig;
		};

		if (!instanceId) {
			return json({ error: 'instanceId is required' }, { status: 400 });
		}

		// Get config from preconfigured MCPs or use provided config
		let mcpConfig: MCPClientConfig;
		if (mcpId && PRECONFIGURED_MCPS[mcpId]) {
			mcpConfig = PRECONFIGURED_MCPS[mcpId];
		} else if (config) {
			mcpConfig = config;
		} else {
			return json({ error: 'Either mcpId or config is required' }, { status: 400 });
		}

		console.log(`[API] Connecting MCP: ${instanceId}`, mcpConfig);

		const connection = await connectMCP(instanceId, mcpConfig);

		return json({
			success: true,
			instanceId,
			serverInfo: connection.serverInfo,
			tools: connection.tools.map((t) => ({
				name: t.name,
				description: t.description,
				inputSchema: t.inputSchema,
			})),
		});
	} catch (error) {
		console.error('[API] MCP connection error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Connection failed',
			},
			{ status: 500 }
		);
	}
};

/**
 * DELETE - Disconnect from an MCP server
 */
export const DELETE: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { instanceId } = body as { instanceId: string };

		if (!instanceId) {
			return json({ error: 'instanceId is required' }, { status: 400 });
		}

		await disconnectMCP(instanceId);

		return json({ success: true, instanceId });
	} catch (error) {
		console.error('[API] MCP disconnect error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Disconnect failed',
			},
			{ status: 500 }
		);
	}
};

/**
 * GET - Get MCP connection status and tools
 */
export const GET: RequestHandler = async ({ url }) => {
	const instanceId = url.searchParams.get('instanceId');

	if (!instanceId) {
		return json({ error: 'instanceId is required' }, { status: 400 });
	}

	const connected = isConnected(instanceId);
	const tools = getTools(instanceId);
	const info = getConnectionInfo(instanceId);

	return json({
		instanceId,
		connected,
		serverInfo: info?.serverInfo || null,
		tools: tools.map((t) => ({
			name: t.name,
			description: t.description,
			inputSchema: t.inputSchema,
		})),
	});
};
