import { describe, expect, it } from 'vitest';
import type { Mission } from '$lib/services/mcp-client';
import {
	buildMultiLLMExecutionPack,
	createDefaultMultiLLMOptions
} from './multi-llm-orchestrator';

function createMission(taskCount = 3): Mission {
	return {
		id: 'mission-test',
		user_id: 'local',
		name: 'Test Mission',
		description: 'Mission for orchestrator tests',
		mode: 'claude-code',
		status: 'ready',
		agents: [],
		tasks: Array.from({ length: taskCount }, (_, index) => ({
			id: `task-${index + 1}`,
			title: `Task ${index + 1}`,
			description: `Description for task ${index + 1}`,
			assignedTo: 'agent-1',
			status: 'pending',
			handoffType: 'sequential' as const
		})),
		context: {
			projectPath: '.',
			projectType: 'tool',
			goals: ['Ship the feature']
		},
		current_task_id: null,
		outputs: {},
		error: null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		started_at: null,
		completed_at: null
	};
}

describe('multi-llm-orchestrator', () => {
	it('creates default options with providers', () => {
		const options = createDefaultMultiLLMOptions();
		expect(options.enabled).toBe(false);
		expect(options.strategy).toBe('round_robin');
		expect(options.providers.length).toBeGreaterThan(1);
		expect(options.providers.some((provider) => provider.id === 'claude')).toBe(true);
	});

	it('assigns tasks round-robin across enabled providers', () => {
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'round_robin';
		options.autoRouteByTask = false;
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: provider.id === 'claude' || provider.id === 'codex'
		}));

		const pack = buildMultiLLMExecutionPack({
			mission: createMission(4),
			options,
			baseUrl: 'http://localhost:5173'
		});

		expect(pack.strategy).toBe('round_robin');
		expect(pack.providers.map((provider) => provider.id)).toEqual(['claude', 'codex']);
		expect(pack.assignments.claude.taskIds).toEqual(['task-1', 'task-3']);
		expect(pack.assignments.codex.taskIds).toEqual(['task-2', 'task-4']);
		expect(pack.providerPrompts.claude).toContain('Assigned tasks:');
		expect(pack.providerPrompts.codex).toContain('Assigned tasks:');
	});

	it('falls back to claude when no providers are enabled', () => {
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.providers = options.providers.map((provider) => ({ ...provider, enabled: false }));

		const pack = buildMultiLLMExecutionPack({
			mission: createMission(2),
			options
		});

		expect(pack.providers).toHaveLength(1);
		expect(pack.providers[0].id).toBe('claude');
		expect(pack.strategy).toBe('single');
		expect(pack.assignments.claude.taskIds).toEqual(['task-1', 'task-2']);
	});

	it('uses lead-reviewer mode for non-primary providers', () => {
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'lead_reviewer';
		options.primaryProviderId = 'codex';
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: provider.id === 'claude' || provider.id === 'codex'
		}));

		const pack = buildMultiLLMExecutionPack({
			mission: createMission(2),
			options
		});

		expect(pack.primaryProviderId).toBe('codex');
		expect(pack.assignments.codex.mode).toBe('execute');
		expect(pack.assignments.codex.taskIds).toEqual(['task-1', 'task-2']);
		expect(pack.assignments.claude.mode).toBe('review');
		expect(pack.providerPrompts.claude).toContain('provider_feedback');
	});

	it('generates openai-compatible launch command for minimax', () => {
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'single';
		options.primaryProviderId = 'minimax';
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: provider.id === 'minimax'
		}));

		const pack = buildMultiLLMExecutionPack({
			mission: createMission(1),
			options
		});

		expect(pack.providers[0].id).toBe('minimax');
		expect(pack.launchCommands.minimax).toContain('/chat/completions');
		expect(pack.launchCommands.minimax).toContain('$MINIMAX_API_KEY');
		expect(pack.launchCommands.minimax).toContain('minimax-request.json');
	});

	it('auto-enables providers when matching API keys are present', () => {
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'single';
		options.autoEnableByKeys = true;
		options.keyPresence = { minimax: true };
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: false
		}));
		options.primaryProviderId = 'minimax';

		const pack = buildMultiLLMExecutionPack({
			mission: createMission(1),
			options
		});

		expect(pack.providers.map((provider) => provider.id)).toContain('minimax');
		expect(pack.primaryProviderId).toBe('minimax');
	});

	it('routes image tasks to image-capable providers when auto-route is enabled', () => {
		const mission = createMission(2);
		mission.tasks[0].title = 'Generate hero image';
		mission.tasks[0].description = 'Create marketing banner visuals and thumbnails';
		mission.tasks[1].title = 'Implement API handler';
		mission.tasks[1].description = 'Build backend endpoint and validation';

		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'round_robin';
		options.autoRouteByTask = true;
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: provider.id === 'codex' || provider.id === 'replicate'
		}));
		options.primaryProviderId = 'codex';
		options.keyPresence = { replicate: true };

		const pack = buildMultiLLMExecutionPack({
			mission,
			options
		});

		expect(pack.assignments.replicate.taskIds).toContain('task-1');
		expect(pack.assignments.codex.taskIds).toContain('task-2');
	});

	it('builds explicit MCP tool plans for matching tasks', () => {
		const mission = createMission(1);
		mission.tasks[0].title = 'Research competitor pricing';
		mission.tasks[0].description = 'Search recent market updates and benchmark pricing trends';

		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'single';
		options.primaryProviderId = 'claude';
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: provider.id === 'claude'
		}));
		options.mcpCapabilities = ['web_search'];
		options.mcpTools = [
			{
				instanceId: 'search-instance',
				mcpName: 'search-mcp',
				toolName: 'web.search',
				capabilities: ['web_search']
			}
		];

		const pack = buildMultiLLMExecutionPack({ mission, options });
		const plan = pack.mcpTaskPlans['task-1'];

		expect(plan.status).toBe('ready');
		expect(plan.toolCalls[0]?.toolName).toBe('web.search');
		expect(plan.toolCalls[0]?.capability).toBe('web_search');
		expect(pack.providerPrompts.claude).toContain('MCP plan');
		expect(pack.providerPrompts.claude).toContain('search-mcp.web.search');
	});

	it('marks tasks blocked with deterministic fallback when required MCP capability is missing', () => {
		const mission = createMission(1);
		mission.tasks[0].title = 'Deploy to production';
		mission.tasks[0].description = 'Release this service to production infrastructure';

		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'single';
		options.primaryProviderId = 'codex';
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: provider.id === 'codex'
		}));
		options.mcpCapabilities = [];
		options.mcpTools = [];

		const pack = buildMultiLLMExecutionPack({ mission, options });
		const plan = pack.mcpTaskPlans['task-1'];

		expect(plan.status).toBe('blocked');
		expect(plan.blockedReason).toContain('deployment');
		expect(plan.fallbackSuggestion).toContain('Fallback');
		expect(pack.blockedTaskIds).toContain('task-1');
		expect(pack.providerPrompts.codex).toContain('MCP plan: BLOCKED');
	});
});
