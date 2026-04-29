import { logger } from '$lib/utils/logger';
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
	isConnected,
	getTools,
	getConnectionInfo,
	PRECONFIGURED_MCPS,
	buildConfigFromRegistry,
	type MCPClientConfig,
} from '$lib/services/mcp/client';
import { requireMcpAuth } from '$lib/server/mcp-auth';

/**
 * POST - Connect to an MCP server
 */
export const POST: RequestHandler = async (event) => {
	const unauthorized = requireMcpAuth(event);
	if (unauthorized) {
		return unauthorized;
	}

	try {
		const { request } = event;
		const body = await request.json();
		const { instanceId, mcpId, config, npmPackage, defaultArgs, envVars, command, args } = body as {
			instanceId: string;
			mcpId?: string;
			config?: MCPClientConfig;
			npmPackage?: string;
			defaultArgs?: string[];
			envVars?: Record<string, string>;
			command?: string;
			args?: string[];
		};

		if (!instanceId) {
			return json({ error: 'instanceId is required' }, { status: 400 });
		}

		// Build config: preconfigured > registry npmPackage > explicit config
		let mcpConfig: MCPClientConfig | null = null;

		if (mcpId) {
			mcpConfig = buildConfigFromRegistry(mcpId, npmPackage, defaultArgs, envVars);
		}

		if (!mcpConfig && config) {
			mcpConfig = config;
		}

		// Fallback: explicit command/args from the client
		if (!mcpConfig && command) {
			mcpConfig = {
				command,
				args: args || [],
				env: envVars
			};
		}

		if (!mcpConfig) {
			return json({ error: 'Cannot determine how to connect. Provide mcpId with npmPackage, or explicit command/args.' }, { status: 400 });
		}

		logger.info(`[API] Connecting MCP: ${instanceId} (${mcpConfig.command} ${mcpConfig.args?.join(' ') || ''})`);

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
export const DELETE: RequestHandler = async (event) => {
	const unauthorized = requireMcpAuth(event);
	if (unauthorized) {
		return unauthorized;
	}

	try {
		const { request } = event;
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
export const GET: RequestHandler = async (event) => {
	const unauthorized = requireMcpAuth(event);
	if (unauthorized) {
		return unauthorized;
	}

	const { url } = event;
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
