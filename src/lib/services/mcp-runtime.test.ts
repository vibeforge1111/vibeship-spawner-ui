import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { mcpStore } from '$lib/stores/mcps.svelte';
import { getMcpRuntimeSnapshot, mcpRuntime } from './mcp-runtime';

describe('mcp-runtime', () => {
	it('builds capabilities and tool catalog from connected instances', () => {
		mcpStore.set({
			registry: [
				{
					id: 'postgresql',
					name: 'PostgreSQL MCP',
					description: 'DB tools',
					category: 'Databases',
					subcategory: 'SQL',
					official: true,
					popularity: 90,
					skills: [],
					capabilities: ['database']
				},
				{
					id: 'replicate',
					name: 'Replicate MCP',
					description: 'Media generation',
					category: 'Media',
					subcategory: 'Image',
					official: false,
					popularity: 80,
					skills: [],
					capabilities: ['image_gen', 'video_gen']
				}
			],
			loadingRegistry: false,
			instances: [
				{
					id: 'mcp-1',
					definitionId: 'postgresql',
					name: 'Postgres Local',
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
					tools: [{ name: 'query', description: 'Run SQL' }]
				},
				{
					id: 'mcp-2',
					definitionId: 'replicate',
					name: 'Replicate',
					status: 'disconnected',
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
					tools: [{ name: 'generate_image', description: 'Generate image' }]
				}
			],
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

		const snapshot = getMcpRuntimeSnapshot();
		expect(snapshot.connected).toBe(true);
		expect(snapshot.connectedCount).toBe(1);
		expect(snapshot.capabilities).toEqual(['database']);
		expect(snapshot.tools).toHaveLength(1);
		expect(snapshot.tools[0].toolName).toBe('query');

		const derivedSnapshot = get(mcpRuntime);
		expect(derivedSnapshot.connectedCount).toBe(1);
		expect(derivedSnapshot.capabilities).toEqual(['database']);
	});
});
