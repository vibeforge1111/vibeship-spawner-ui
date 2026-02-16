import { derived, get } from 'svelte/store';
import { mcpStore, type MCPState } from '$lib/stores/mcps.svelte';
import type { MCPCapability } from '$lib/types/mcp';

export interface MCPRuntimeTool {
	instanceId: string;
	definitionId: string;
	mcpName: string;
	toolName: string;
	description?: string;
	capabilities: MCPCapability[];
}

export interface MCPRuntimeSnapshot {
	connected: boolean;
	connectedCount: number;
	capabilities: MCPCapability[];
	tools: MCPRuntimeTool[];
}

function buildSnapshot(state: MCPState): MCPRuntimeSnapshot {
	const connectedInstances = state.instances.filter((instance) => instance.status === 'connected');
	const capabilities = new Set<MCPCapability>();
	const tools: MCPRuntimeTool[] = [];

	for (const instance of connectedInstances) {
		const registryItem = state.registry.find((item) => item.id === instance.definitionId);
		const mcpCapabilities = (registryItem?.capabilities || []) as MCPCapability[];
		for (const capability of mcpCapabilities) {
			capabilities.add(capability);
		}

		for (const tool of instance.tools || []) {
			tools.push({
				instanceId: instance.id,
				definitionId: instance.definitionId,
				mcpName: instance.name,
				toolName: tool.name,
				description: tool.description,
				capabilities: [...mcpCapabilities]
			});
		}
	}

	return {
		connected: connectedInstances.length > 0,
		connectedCount: connectedInstances.length,
		capabilities: [...capabilities],
		tools
	};
}

export const mcpRuntime = derived(mcpStore, (state) => buildSnapshot(state));

export function getMcpRuntimeSnapshot(): MCPRuntimeSnapshot {
	return buildSnapshot(get(mcpStore));
}
