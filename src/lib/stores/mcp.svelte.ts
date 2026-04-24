/**
 * MCP Connection Store
 *
 * Manages connection state to the Spawner MCP server
 */
import { writable, derived } from 'svelte/store';
import { mcpClient, type McpToolDefinition } from '$lib/services/mcp-client';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
const DEFAULT_MCP_URL = import.meta.env.PUBLIC_MCP_URL?.trim() ?? '';
const PRODUCTION_MCP_URL = import.meta.env.PUBLIC_PRODUCTION_MCP_URL?.trim() ?? 'https://mcp.vibeship.co';

export interface McpState {
	status: ConnectionStatus;
	serverInfo: { name: string; version: string } | null;
	tools: McpToolDefinition[];
	error: string | null;
	baseUrl: string;
}

// State
const initialState: McpState = {
	status: 'disconnected',
	serverInfo: null,
	tools: [],
	error: null,
	baseUrl: DEFAULT_MCP_URL
};

export const mcpState = writable<McpState>(initialState);

// Derived stores
export const isConnected = derived(mcpState, ($state) => $state.status === 'connected');
export const isConnecting = derived(mcpState, ($state) => $state.status === 'connecting');
export const connectionError = derived(mcpState, ($state) => $state.error);
export const availableTools = derived(mcpState, ($state) => $state.tools);

// Actions

/**
 * Set the MCP server URL
 */
export function setMcpUrl(url: string) {
	mcpClient.configure({ baseUrl: url });
	mcpState.update((s) => ({ ...s, baseUrl: url, status: 'disconnected', error: null }));
}

/**
 * Connect to the MCP server
 */
export async function connect(): Promise<boolean> {
	mcpState.update((s) => ({ ...s, status: 'connecting', error: null }));

	try {
		// First ping to check availability
		const isAvailable = await mcpClient.ping();
		if (!isAvailable) {
			mcpState.update((s) => ({
				...s,
				status: 'error',
				error: 'MCP server is not responding. Make sure spawner-v2 is running (wrangler dev)'
			}));
			return false;
		}

		// Initialize connection
		const initResult = await mcpClient.initialize();
		if (!initResult.success) {
			mcpState.update((s) => ({
				...s,
				status: 'error',
				error: initResult.error ?? 'Failed to initialize MCP connection'
			}));
			return false;
		}

		// List available tools
		const toolsResult = await mcpClient.listTools();
		const tools = toolsResult.success ? toolsResult.data ?? [] : [];

		mcpState.update((s) => ({
			...s,
			status: 'connected',
			serverInfo: initResult.data?.serverInfo ?? null,
			tools,
			error: null
		}));

		return true;
	} catch (e) {
		const errorMsg = e instanceof Error ? e.message : 'Failed to connect to MCP server';
		mcpState.update((s) => ({
			...s,
			status: 'error',
			error: errorMsg
		}));
		return false;
	}
}

/**
 * Disconnect from the MCP server
 */
export function disconnect() {
	mcpState.set(initialState);
}

/**
 * Quick connect to local dev server
 */
export async function connectLocal(): Promise<boolean> {
	if (!DEFAULT_MCP_URL) {
		mcpState.update((s) => ({
			...s,
			status: 'error',
			error: 'Local MCP URL is not configured for this launch build.'
		}));
		return false;
	}
	setMcpUrl(DEFAULT_MCP_URL);
	return connect();
}

/**
 * Connect to production server
 */
export async function connectProduction(): Promise<boolean> {
	setMcpUrl(PRODUCTION_MCP_URL);
	return connect();
}
