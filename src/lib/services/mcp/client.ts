/**
 * MCP Client Service
 *
 * Handles real MCP connections using the MCP SDK.
 * Supports stdio transport for local MCP servers.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface MCPClientConfig {
	/** Command to run the MCP server */
	command: string;
	/** Arguments for the command */
	args?: string[];
	/** Environment variables */
	env?: Record<string, string>;
}

export interface ConnectedMCP {
	client: Client;
	transport: StdioClientTransport;
	tools: Tool[];
	serverInfo: {
		name: string;
		version: string;
	};
}

// Active connections
const connections = new Map<string, ConnectedMCP>();

/**
 * Connect to an MCP server via stdio
 */
export async function connectMCP(
	instanceId: string,
	config: MCPClientConfig
): Promise<ConnectedMCP> {
	// Check if already connected
	if (connections.has(instanceId)) {
		const existing = connections.get(instanceId)!;
		return existing;
	}

	console.log(`[MCP] Connecting to: ${config.command} ${config.args?.join(' ') || ''}`);

	// Create transport
	const transport = new StdioClientTransport({
		command: config.command,
		args: config.args || [],
		env: {
			...process.env,
			...config.env,
		} as Record<string, string>,
	});

	// Create client
	const client = new Client(
		{
			name: 'spawner-ui',
			version: '1.0.0',
		},
		{
			capabilities: {},
		}
	);

	// Connect
	await client.connect(transport);

	// Get server info
	const serverInfo = client.getServerVersion() || { name: 'unknown', version: '0.0.0' };

	// List available tools
	const toolsResult = await client.listTools();
	const tools = toolsResult.tools || [];

	console.log(`[MCP] Connected to ${serverInfo.name} v${serverInfo.version}`);
	console.log(`[MCP] Available tools: ${tools.map((t) => t.name).join(', ')}`);

	const connection: ConnectedMCP = {
		client,
		transport,
		tools,
		serverInfo: {
			name: serverInfo.name || 'unknown',
			version: serverInfo.version || '0.0.0',
		},
	};

	connections.set(instanceId, connection);
	return connection;
}

/**
 * Disconnect from an MCP server
 */
export async function disconnectMCP(instanceId: string): Promise<void> {
	const connection = connections.get(instanceId);
	if (!connection) {
		console.log(`[MCP] No connection found for ${instanceId}`);
		return;
	}

	try {
		await connection.client.close();
		console.log(`[MCP] Disconnected from ${connection.serverInfo.name}`);
	} catch (e) {
		console.error(`[MCP] Error disconnecting:`, e);
	}

	connections.delete(instanceId);
}

/**
 * Call a tool on an MCP server
 */
export async function callTool(
	instanceId: string,
	toolName: string,
	args: Record<string, unknown> = {}
): Promise<unknown> {
	const connection = connections.get(instanceId);
	if (!connection) {
		throw new Error(`Not connected to MCP: ${instanceId}`);
	}

	console.log(`[MCP] Calling tool: ${toolName}`, args);

	const result = await connection.client.callTool({
		name: toolName,
		arguments: args,
	});

	console.log(`[MCP] Tool result:`, result);
	return result;
}

/**
 * Get tools for a connected MCP
 */
export function getTools(instanceId: string): Tool[] {
	const connection = connections.get(instanceId);
	return connection?.tools || [];
}

/**
 * Check if an MCP is connected
 */
export function isConnected(instanceId: string): boolean {
	return connections.has(instanceId);
}

/**
 * Get all active connections
 */
export function getConnections(): Map<string, ConnectedMCP> {
	return connections;
}

/**
 * Get connection info for an instance
 */
export function getConnectionInfo(instanceId: string): ConnectedMCP | undefined {
	return connections.get(instanceId);
}

// Pre-configured MCP servers (no auth required)
export const PRECONFIGURED_MCPS: Record<string, MCPClientConfig> = {
	'test-server': {
		command: 'npx',
		args: ['tsx', 'src/lib/services/mcp/test-server.ts'],
	},
	'filesystem': {
		command: 'npx',
		args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
	},
};
