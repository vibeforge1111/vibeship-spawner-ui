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
	it('creates default options with local CLI providers plus disabled API providers', () => {
		const options = createDefaultMultiLLMOptions();
		expect(options.enabled).toBe(true);
		expect(options.strategy).toBe('round_robin');
		expect(options.providers.map((provider) => provider.id)).toEqual(['claude', 'codex', 'zai', 'minimax']);
		expect(options.providers.find((provider) => provider.id === 'zai')?.enabled).toBe(false);
		expect(options.providers.find((provider) => provider.id === 'minimax')?.enabled).toBe(false);
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

	it('keeps generic tasks balanced when auto-route is enabled', () => {
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'round_robin';
		options.autoRouteByTask = true;
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: provider.id === 'claude' || provider.id === 'codex'
		}));

		const pack = buildMultiLLMExecutionPack({
			mission: createMission(4),
			options
		});

		expect(pack.assignments.claude.taskIds).toEqual(['task-1', 'task-3']);
		expect(pack.assignments.codex.taskIds).toEqual(['task-2', 'task-4']);
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

	it('generates terminal launch command for codex', () => {
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'single';
		options.primaryProviderId = 'codex';
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: provider.id === 'codex'
		}));

		const pack = buildMultiLLMExecutionPack({
			mission: createMission(1),
			options
		});

		expect(pack.providers[0].id).toBe('codex');
		expect(pack.launchCommands.codex).toContain('codex exec --model gpt-5.5');
	});

	it('auto-enables providers when matching API keys are present', () => {
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'single';
		options.autoEnableByKeys = true;
		options.keyPresence = { codex: true };
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: false
		}));
		options.primaryProviderId = 'codex';

		const pack = buildMultiLLMExecutionPack({
			mission: createMission(1),
			options
		});

		expect(pack.providers.map((provider) => provider.id)).toContain('codex');
		expect(pack.primaryProviderId).toBe('codex');
	});

	it('auto-enables API-backed providers when matching keys are present', () => {
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'single';
		options.autoEnableByKeys = true;
		options.keyPresence = { zai: true };
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: false
		}));
		options.primaryProviderId = 'zai';

		const pack = buildMultiLLMExecutionPack({
			mission: createMission(1),
			options
		});

		expect(pack.providers.map((provider) => provider.id)).toEqual(['zai']);
		expect(pack.primaryProviderId).toBe('zai');
		expect(pack.launchCommands.zai).toContain('https://api.z.ai/api/coding/paas/v4/chat/completions');
	});

	it('keeps single-provider runs on the selected provider even when other keys are present', () => {
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'single';
		options.autoEnableByKeys = true;
		options.primaryProviderId = 'zai';
		options.keyPresence = { zai: true, minimax: true, codex: true };
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: false
		}));

		const pack = buildMultiLLMExecutionPack({
			mission: createMission(3),
			options
		});

		expect(pack.strategy).toBe('single');
		expect(pack.providers.map((provider) => provider.id)).toEqual(['zai']);
		expect(pack.assignments.zai.taskIds).toEqual(['task-1', 'task-2', 'task-3']);
	});

	it('routes deployment-heavy tasks to codex when auto-route is enabled', () => {
		const mission = createMission(2);
		mission.tasks[0].title = 'Deploy backend service';
		mission.tasks[0].description = 'Release to production and verify deployment pipeline';
		mission.tasks[1].title = 'Write release notes';
		mission.tasks[1].description = 'Summarize changes and rollout guidance';

		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'round_robin';
		options.autoRouteByTask = true;
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: provider.id === 'codex' || provider.id === 'claude'
		}));
		options.primaryProviderId = 'codex';

		const pack = buildMultiLLMExecutionPack({
			mission,
			options
		});

		expect(pack.assignments.codex.taskIds).toContain('task-1');
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

	it('honors a forced single-provider task preference', () => {
		const mission = createMission(2);
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'single';
		options.primaryProviderId = 'codex';
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: provider.id === 'codex' || provider.id === 'claude'
		}));
		options.taskProviderPreferences = { 'task-1': 'claude' };

		const pack = buildMultiLLMExecutionPack({ mission, options });

		expect(pack.assignments.claude.taskIds).toContain('task-1');
		expect(pack.assignments.codex.taskIds).not.toContain('task-1');
		expect(pack.assignments.codex.taskIds).toContain('task-2');
	});

	it('honors a forced both-provider task preference', () => {
		const mission = createMission(2);
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'single';
		options.primaryProviderId = 'claude';
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: provider.id === 'codex' || provider.id === 'claude'
		}));
		options.taskProviderPreferences = { 'task-1': 'both' };

		const pack = buildMultiLLMExecutionPack({ mission, options });

		expect(pack.assignments.claude.taskIds).toContain('task-1');
		expect(pack.assignments.codex.taskIds).toContain('task-1');
		expect(pack.assignments.claude.taskIds).toContain('task-2');
	});

	it('honors a forced arbitrary provider task preference', () => {
		const mission = createMission(2);
		const options = createDefaultMultiLLMOptions();
		options.enabled = true;
		options.strategy = 'single';
		options.primaryProviderId = 'claude';
		options.providers = options.providers.map((provider) => ({
			...provider,
			enabled: provider.id === 'claude' || provider.id === 'zai'
		}));
		options.taskProviderPreferences = { 'task-1': 'zai' };

		const pack = buildMultiLLMExecutionPack({ mission, options });

		expect(pack.assignments.zai.taskIds).toContain('task-1');
		expect(pack.assignments.claude.taskIds).not.toContain('task-1');
		expect(pack.assignments.claude.taskIds).toContain('task-2');
	});

	it('does not treat shell cd preflight commands as deployment requirements', () => {
		const mission = createMission(1);
		mission.tasks[0].title = 'CB-030 Nightly review';
		mission.tasks[0].description =
			'Preflight: cd C:\\Users\\USER\\Desktop\\repo | git rev-parse --show-toplevel';

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

		expect(plan.status).toBe('not_needed');
		expect(plan.requiredCapabilities).not.toContain('deployment');
		expect(pack.providerPrompts.codex).not.toContain('requires MCP capabilities not currently available');
	});
});
