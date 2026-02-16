import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { mcpStore, runInstanceSmokeTest } from './mcps.svelte';

describe('mcps smoke tests', () => {
	beforeEach(() => {
		mcpStore.set({
			registry: [
				{
					id: 'test-server',
					name: 'Test MCP Server',
					description: 'test',
					category: 'Development',
					subcategory: 'Testing',
					official: false,
					popularity: 100,
					skills: [],
					capabilities: ['custom']
				}
			],
			loadingRegistry: false,
			instances: [],
			loadingInstances: false,
			pendingFeedback: [],
			processedFeedback: [],
			feedbackLoading: false,
			skillBindings: [],
			teamBindings: [],
			selectedMCPId: null,
			filterCategory: 'all',
			filterSubcategory: null,
			searchQuery: '',
			error: null
		});
		vi.restoreAllMocks();
	});

	it('marks smoke test as passed when one tool call succeeds', async () => {
		mcpStore.update((state) => ({
			...state,
			instances: [
				{
					id: 'mcp-1',
					definitionId: 'test-server',
					name: 'Test MCP',
					status: 'connected',
					config: {},
					usageCount: 0,
					feedbackCount: 0,
					attachedToSkills: [],
					attachedToTeams: [],
					attachedToMissions: [],
					autoFeedback: true,
					enabled: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					tools: [{ name: 'echo', description: 'Echoes text' }]
				}
			]
		}));

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ success: true, result: { ok: true } })
			})
		);

		const result = await runInstanceSmokeTest('mcp-1');
		expect(result.ok).toBe(true);
		expect(result.toolName).toBe('echo');

		const instance = get(mcpStore).instances.find((item) => item.id === 'mcp-1');
		expect(instance?.lastSmokeTestStatus).toBe('passed');
		expect(instance?.lastSmokeTestMessage).toContain('echo');
	});

	it('marks smoke test as failed when no tools are available', async () => {
		mcpStore.update((state) => ({
			...state,
			instances: [
				{
					id: 'mcp-2',
					definitionId: 'test-server',
					name: 'Test MCP',
					status: 'connected',
					config: {},
					usageCount: 0,
					feedbackCount: 0,
					attachedToSkills: [],
					attachedToTeams: [],
					attachedToMissions: [],
					autoFeedback: true,
					enabled: true,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					tools: []
				}
			]
		}));

		const result = await runInstanceSmokeTest('mcp-2');
		expect(result.ok).toBe(false);
		expect(result.message).toContain('no tools');

		const instance = get(mcpStore).instances.find((item) => item.id === 'mcp-2');
		expect(instance?.lastSmokeTestStatus).toBe('failed');
	});
});
