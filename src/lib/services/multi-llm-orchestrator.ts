import type { Mission } from '$lib/services/mcp-client';
import type { MCPCapability } from '$lib/types/mcp';

export type MultiLLMProviderKind = 'terminal_cli' | 'openai_compat' | 'custom';
export type MultiLLMCapability = MCPCapability | 'reasoning' | 'planning' | 'review';

export type MultiLLMStrategy =
	| 'single'
	| 'round_robin'
	| 'parallel_consensus'
	| 'lead_reviewer';

export interface MultiLLMProviderConfig {
	id: string;
	label: string;
	model: string;
	enabled: boolean;
	kind: MultiLLMProviderKind;
	eventSource: string;
	capabilities?: MultiLLMCapability[];
	requiresApiKey?: boolean;
	baseUrl?: string;
	apiKeyEnv?: string;
	commandTemplate?: string;
}

export interface MultiLLMOrchestratorOptions {
	enabled: boolean;
	strategy: MultiLLMStrategy;
	primaryProviderId?: string;
	autoEnableByKeys?: boolean;
	autoRouteByTask?: boolean;
	autoDispatch?: boolean;
	apiKeys?: Record<string, string>;
	keyPresence?: Record<string, boolean>;
	mcpCapabilities?: MultiLLMCapability[];
	mcpTools?: MultiLLMMCPTool[];
	providers: MultiLLMProviderConfig[];
}

export interface MultiLLMMCPTool {
	instanceId: string;
	mcpName: string;
	toolName: string;
	description?: string;
	capabilities: MultiLLMCapability[];
}

export interface MultiLLMMCPToolCallPlan {
	capability: MultiLLMCapability;
	instanceId: string;
	mcpName: string;
	toolName: string;
	description?: string;
	reason: string;
	suggestedArgs: Record<string, unknown>;
}

export interface MultiLLMMCPTaskPlan {
	taskId: string;
	taskTitle: string;
	status: 'not_needed' | 'ready' | 'blocked';
	requiredCapabilities: MultiLLMCapability[];
	toolCalls: MultiLLMMCPToolCallPlan[];
	blockedCapabilities?: MultiLLMCapability[];
	blockedReason?: string;
	fallbackSuggestion?: string;
}

export interface MultiLLMTaskAssignment {
	providerId: string;
	mode: 'execute' | 'review';
	taskIds: string[];
}

export interface MultiLLMExecutionPack {
	enabled: boolean;
	strategy: MultiLLMStrategy;
	primaryProviderId: string;
	providers: MultiLLMProviderConfig[];
	assignments: Record<string, MultiLLMTaskAssignment>;
	mcpTaskPlans: Record<string, MultiLLMMCPTaskPlan>;
	blockedTaskIds: string[];
	masterPrompt: string;
	providerPrompts: Record<string, string>;
	launchCommands: Record<string, string>;
	createdAt: string;
}

export interface MultiLLMBuildInput {
	mission: Mission;
	options: MultiLLMOrchestratorOptions;
	taskSkillMap?: Map<string, string[]>;
	baseUrl?: string;
}

export const DEFAULT_MULTI_LLM_PROVIDERS: MultiLLMProviderConfig[] = [
	{
		id: 'claude',
		label: 'Claude',
		model: 'claude-opus-4-1',
		enabled: true,
		kind: 'terminal_cli',
		eventSource: 'claude-code',
		capabilities: ['reasoning', 'planning', 'review', 'code_analysis'],
		apiKeyEnv: 'ANTHROPIC_API_KEY',
		requiresApiKey: true,
		commandTemplate: 'claude --model {model}'
	},
	{
		id: 'codex',
		label: 'Codex',
		model: 'gpt-5.3-codex',
		enabled: true,
		kind: 'terminal_cli',
		eventSource: 'codex',
		capabilities: ['reasoning', 'planning', 'code_analysis', 'code_exec', 'database', 'deployment'],
		apiKeyEnv: 'OPENAI_API_KEY',
		requiresApiKey: true,
		commandTemplate: 'codex exec --model {model}'
	}
];

export function createDefaultMultiLLMOptions(): MultiLLMOrchestratorOptions {
	return {
		enabled: false,
		strategy: 'round_robin',
		primaryProviderId: 'claude',
		autoEnableByKeys: true,
		autoRouteByTask: true,
		autoDispatch: true,
		keyPresence: {},
		mcpCapabilities: [],
		mcpTools: [],
		providers: DEFAULT_MULTI_LLM_PROVIDERS.map((provider) => ({ ...provider }))
	};
}

export function buildMultiLLMExecutionPack(input: MultiLLMBuildInput): MultiLLMExecutionPack {
	const baseUrl = input.baseUrl || 'http://localhost:5173';
	const mcpCapabilities = dedupeCapabilities(input.options.mcpCapabilities || []);
	const mcpTools = dedupeMcpTools(input.options.mcpTools || []);
	const providers = getActiveProviders(input.options);
	const primaryProviderId = resolvePrimaryProviderId(providers, input.options.primaryProviderId);
	const strategy = providers.length <= 1 ? 'single' : input.options.strategy;
	const assignments = assignTasks(
		input.mission,
		providers,
		strategy,
		primaryProviderId,
		input.options.autoRouteByTask !== false,
		input.taskSkillMap,
		mcpCapabilities
	);
	const mcpTaskPlans = buildMcpTaskPlans(input.mission, input.taskSkillMap, mcpCapabilities, mcpTools);
	const blockedTaskIds = Object.values(mcpTaskPlans)
		.filter((plan) => plan.status === 'blocked')
		.map((plan) => plan.taskId);

	const providerPrompts: Record<string, string> = {};
	const launchCommands: Record<string, string> = {};

	for (const provider of providers) {
		const assignment = assignments[provider.id];
		providerPrompts[provider.id] = buildProviderPrompt({
			mission: input.mission,
			provider,
			assignment,
			strategy,
			primaryProviderId,
			baseUrl,
			taskSkillMap: input.taskSkillMap,
			mcpCapabilities,
			mcpTaskPlans
		});
		launchCommands[provider.id] = buildLaunchCommand(provider, input.mission.id);
	}

	return {
		enabled: input.options.enabled,
		strategy,
		primaryProviderId,
		providers,
		assignments,
		mcpTaskPlans,
		blockedTaskIds,
		masterPrompt: buildMasterPrompt(
			input.mission,
			providers,
			assignments,
			mcpTaskPlans,
			strategy,
			primaryProviderId,
			baseUrl,
			{
				...input.options,
				mcpCapabilities,
				mcpTools
			}
		),
		providerPrompts,
		launchCommands,
		createdAt: new Date().toISOString()
	};
}

function getActiveProviders(options: MultiLLMOrchestratorOptions): MultiLLMProviderConfig[] {
	const providers = options.providers.map((provider) => ({ ...provider }));
	if (options.autoEnableByKeys !== false) {
		const keyPresence = options.keyPresence || {};
		for (const provider of providers) {
			const hasKey = keyPresence[provider.id] || false;
			const requiresApiKey = provider.requiresApiKey ?? !!provider.apiKeyEnv;
			if (hasKey && requiresApiKey && !provider.enabled) {
				provider.enabled = true;
			}
		}
	}

	const active = providers.filter((provider) => provider.enabled);
	if (active.length > 0) {
		return active;
	}

	const fallback = DEFAULT_MULTI_LLM_PROVIDERS.find((provider) => provider.id === 'claude');
	return [fallback ? { ...fallback } : { ...DEFAULT_MULTI_LLM_PROVIDERS[0] }];
}

function resolvePrimaryProviderId(
	providers: MultiLLMProviderConfig[],
	requestedPrimary?: string
): string {
	if (requestedPrimary && providers.some((provider) => provider.id === requestedPrimary)) {
		return requestedPrimary;
	}
	return providers[0]?.id || 'claude';
}

function assignTasks(
	mission: Mission,
	providers: MultiLLMProviderConfig[],
	strategy: MultiLLMStrategy,
	primaryProviderId: string,
	autoRouteByTask: boolean,
	taskSkillMap?: Map<string, string[]>,
	mcpCapabilities: MultiLLMCapability[] = []
): Record<string, MultiLLMTaskAssignment> {
	const assignments: Record<string, MultiLLMTaskAssignment> = {};
	const taskIds = mission.tasks.map((task) => task.id);

	for (const provider of providers) {
		assignments[provider.id] = {
			providerId: provider.id,
			mode: 'execute',
			taskIds: []
		};
	}

	if (strategy === 'single') {
		assignments[primaryProviderId].taskIds = taskIds;
		return assignments;
	}

	if (strategy === 'round_robin') {
		const taskById = new Map(mission.tasks.map((task) => [task.id, task]));
		taskIds.forEach((taskId, index) => {
			const task = taskById.get(taskId);
			if (autoRouteByTask && task) {
				const preferredProvider = selectBestProviderForTask(
					task,
					providers,
					taskSkillMap?.get(task.id) || [],
					mcpCapabilities
				);
				assignments[preferredProvider.id].taskIds.push(taskId);
				return;
			}

			const provider = providers[index % providers.length];
			assignments[provider.id].taskIds.push(taskId);
		});
		return assignments;
	}

	if (strategy === 'parallel_consensus') {
		for (const provider of providers) {
			assignments[provider.id].taskIds = [...taskIds];
		}
		return assignments;
	}

	// lead_reviewer
	assignments[primaryProviderId].taskIds = [...taskIds];
	for (const provider of providers) {
		if (provider.id === primaryProviderId) continue;
		assignments[provider.id].mode = 'review';
		assignments[provider.id].taskIds = [...taskIds];
	}
	return assignments;
}

function selectBestProviderForTask(
	task: Mission['tasks'][number],
	providers: MultiLLMProviderConfig[],
	taskSkills: string[],
	mcpCapabilities: MultiLLMCapability[]
): MultiLLMProviderConfig {
	const taskCapabilities = inferTaskCapabilities(task.title, task.description, taskSkills, mcpCapabilities);
	let bestProvider = providers[0];
	let bestScore = -1;

	for (const provider of providers) {
		const providerCaps = provider.capabilities || [];
		const specificCapabilities = taskCapabilities.filter(
			(capability) => capability !== 'reasoning' && capability !== 'planning' && capability !== 'review'
		);
		let directMatches = 0;
		for (const capability of specificCapabilities) {
			if (providerCaps.includes(capability)) directMatches += 1;
		}
		let score = directMatches * 4;
		if (directMatches === 0 && specificCapabilities.length === 0) {
			if (providerCaps.includes('reasoning')) score += 1;
			if (providerCaps.includes('planning')) score += 1;
		}
		if (score > bestScore) {
			bestScore = score;
			bestProvider = provider;
		}
	}

	return bestProvider;
}

function inferTaskCapabilities(
	title: string,
	description: string,
	taskSkills: string[],
	mcpCapabilities: MultiLLMCapability[]
): MultiLLMCapability[] {
	const text = `${title} ${description} ${taskSkills.join(' ')}`.toLowerCase();
	const capabilities = new Set<MultiLLMCapability>(['reasoning']);

	if (/\b(code|api|backend|frontend|implement|refactor|fix|typescript|javascript|python)\b/.test(text)) {
		capabilities.add('code_analysis');
	}
	if (/\b(test|qa|verify|validation|regression|coverage)\b/.test(text)) {
		capabilities.add('code_analysis');
	}
	if (/\b(image|logo|illustration|thumbnail|screenshot|banner|poster|graphic)\b/.test(text)) {
		capabilities.add('image_gen');
	}
	if (/\b(video|reel|animation|clip|cinematic|trailer)\b/.test(text)) {
		capabilities.add('video_gen');
	}
	if (/\b(audio|voice|tts|podcast|music)\b/.test(text)) {
		capabilities.add('audio_gen');
	}
	if (/\b(search|research|crawl|discover|investigate)\b/.test(text)) {
		capabilities.add('web_search');
	}
	if (/\b(database|schema|migration|sql|postgres|mysql|redis)\b/.test(text)) {
		capabilities.add('database');
	}
	if (/\b(deploy|release|production|ci|cd|pipeline|infra|infrastructure)\b/.test(text)) {
		capabilities.add('deployment');
	}

	for (const mcpCapability of mcpCapabilities) {
		if (capabilities.has(mcpCapability)) continue;
		if (mcpCapability === 'database' && /\b(data|db|schema|migration|query)\b/.test(text)) {
			capabilities.add('database');
		}
		if (mcpCapability === 'image_gen' && /\b(image|visual|design)\b/.test(text)) {
			capabilities.add('image_gen');
		}
		if (mcpCapability === 'video_gen' && /\b(video|animation|motion)\b/.test(text)) {
			capabilities.add('video_gen');
		}
		if (mcpCapability === 'web_search' && /\b(research|compare|trend)\b/.test(text)) {
			capabilities.add('web_search');
		}
	}

	return [...capabilities];
}

const MCP_REQUIRED_RULES: Array<{ capability: MultiLLMCapability; pattern: RegExp }> = [
	{ capability: 'web_search', pattern: /\b(search|research|crawl|discover|investigate|benchmark|compare|trend)\b/ },
	{ capability: 'database', pattern: /\b(database|schema|migration|sql|postgres|mysql|redis|query|data model)\b/ },
	{ capability: 'deployment', pattern: /\b(deploy|release|production|rollout|infra|infrastructure|ci|cd)\b/ },
	{ capability: 'image_gen', pattern: /\b(image|logo|illustration|thumbnail|banner|poster|graphic|visual)\b/ },
	{ capability: 'video_gen', pattern: /\b(video|animation|clip|cinematic|trailer|motion)\b/ },
	{ capability: 'audio_gen', pattern: /\b(audio|voice|tts|podcast|music)\b/ },
	{ capability: 'payment', pattern: /\b(payment|checkout|billing|invoice|stripe|paypal)\b/ }
];

const MCP_FALLBACK_SUGGESTIONS: Record<string, string> = {
	web_search: 'Fallback: proceed with documented assumptions and flag unknowns for manual verification.',
	database: 'Fallback: design schema and queries locally; defer execution until a database MCP is connected.',
	deployment: 'Fallback: generate deployment plan/scripts only and hand off final release to operator.',
	image_gen: 'Fallback: produce text-only design spec and placeholder assets.',
	video_gen: 'Fallback: provide storyboard/script and defer rendering to a media MCP.',
	audio_gen: 'Fallback: provide transcript/script and defer synthesis to an audio MCP.',
	payment: 'Fallback: stub payment integration with mock adapters until a payment MCP is connected.'
};

function dedupeCapabilities(capabilities: MultiLLMCapability[]): MultiLLMCapability[] {
	return [...new Set(capabilities)];
}

function dedupeMcpTools(tools: MultiLLMMCPTool[]): MultiLLMMCPTool[] {
	const seen = new Set<string>();
	const deduped: MultiLLMMCPTool[] = [];
	for (const tool of tools) {
		const key = `${tool.instanceId}:${tool.toolName}`;
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push({
			...tool,
			capabilities: dedupeCapabilities(tool.capabilities)
		});
	}
	return deduped;
}

function inferRequiredMcpCapabilities(
	title: string,
	description: string,
	taskSkills: string[]
): MultiLLMCapability[] {
	const text = `${title} ${description} ${taskSkills.join(' ')}`.toLowerCase();
	const required = new Set<MultiLLMCapability>();
	for (const rule of MCP_REQUIRED_RULES) {
		if (rule.pattern.test(text)) {
			required.add(rule.capability);
		}
	}
	return [...required];
}

function buildSuggestedArgs(capability: MultiLLMCapability, task: Mission['tasks'][number]): Record<string, unknown> {
	const title = task.title || 'task';
	if (capability === 'web_search') {
		return { query: title, limit: 5 };
	}
	if (capability === 'database') {
		return { operation: 'query', task: title };
	}
	if (capability === 'deployment') {
		return { environment: 'staging', task: title };
	}
	if (capability === 'image_gen') {
		return { prompt: task.description || title, format: 'png' };
	}
	if (capability === 'video_gen') {
		return { prompt: task.description || title, durationSeconds: 8 };
	}
	if (capability === 'audio_gen') {
		return { text: task.description || title, voice: 'default' };
	}
	if (capability === 'payment') {
		return { action: 'simulate_checkout', task: title };
	}
	return { task: title };
}

function getFallbackSuggestion(blockedCapabilities: MultiLLMCapability[]): string {
	if (blockedCapabilities.length === 0) {
		return 'Fallback: continue with standard provider reasoning flow.';
	}
	return blockedCapabilities
		.map((capability) => MCP_FALLBACK_SUGGESTIONS[capability] || `Fallback: continue without MCP capability "${capability}".`)
		.join(' ');
}

function buildMcpTaskPlans(
	mission: Mission,
	taskSkillMap: Map<string, string[]> | undefined,
	mcpCapabilities: MultiLLMCapability[],
	mcpTools: MultiLLMMCPTool[]
): Record<string, MultiLLMMCPTaskPlan> {
	const plans: Record<string, MultiLLMMCPTaskPlan> = {};
	const mcpCapabilitySet = new Set(mcpCapabilities);

	for (const task of mission.tasks) {
		const taskSkills = taskSkillMap?.get(task.id) || [];
		const requiredCapabilities = inferRequiredMcpCapabilities(task.title, task.description, taskSkills);
		if (requiredCapabilities.length === 0) {
			plans[task.id] = {
				taskId: task.id,
				taskTitle: task.title,
				status: 'not_needed',
				requiredCapabilities: [],
				toolCalls: []
			};
			continue;
		}

		const toolCalls: MultiLLMMCPToolCallPlan[] = [];
		const blockedCapabilities: MultiLLMCapability[] = [];

		for (const capability of requiredCapabilities) {
			const matchingTools = mcpTools.filter((tool) => tool.capabilities.includes(capability));
			const selectedTool = matchingTools[0];
			if (selectedTool) {
				toolCalls.push({
					capability,
					instanceId: selectedTool.instanceId,
					mcpName: selectedTool.mcpName,
					toolName: selectedTool.toolName,
					description: selectedTool.description,
					reason: `Task requires "${capability}" capability.`,
					suggestedArgs: buildSuggestedArgs(capability, task)
				});
				continue;
			}

			// Deterministic blocked classification:
			// if capability appears required and no matching MCP tool is connected, emit blocked metadata.
			if (!mcpCapabilitySet.has(capability) || matchingTools.length === 0) {
				blockedCapabilities.push(capability);
			}
		}

		if (blockedCapabilities.length > 0) {
			const blockedLabel = blockedCapabilities.join(', ');
			plans[task.id] = {
				taskId: task.id,
				taskTitle: task.title,
				status: 'blocked',
				requiredCapabilities,
				toolCalls,
				blockedCapabilities,
				blockedReason: `Task "${task.title}" requires MCP capabilities not currently available: ${blockedLabel}.`,
				fallbackSuggestion: getFallbackSuggestion(blockedCapabilities)
			};
			continue;
		}

		plans[task.id] = {
			taskId: task.id,
			taskTitle: task.title,
			status: 'ready',
			requiredCapabilities,
			toolCalls
		};
	}

	return plans;
}

function formatTaskMcpPlan(plan: MultiLLMMCPTaskPlan | undefined): string {
	if (!plan || plan.status === 'not_needed') {
		return '\n   MCP plan: not required';
	}
	if (plan.status === 'blocked') {
		return `\n   MCP plan: BLOCKED\n   - ${plan.blockedReason}\n   - ${plan.fallbackSuggestion}`;
	}
	if (plan.toolCalls.length === 0) {
		return '\n   MCP plan: ready (no explicit tool calls)';
	}

	const toolLines = plan.toolCalls.map((call) => {
		const args = JSON.stringify(call.suggestedArgs);
		return `\n   - ${call.capability}: ${call.mcpName}.${call.toolName} args=${args}`;
	});
	return `\n   MCP plan:${toolLines.join('')}`;
}

function buildMasterPrompt(
	mission: Mission,
	providers: MultiLLMProviderConfig[],
	assignments: Record<string, MultiLLMTaskAssignment>,
	mcpTaskPlans: Record<string, MultiLLMMCPTaskPlan>,
	strategy: MultiLLMStrategy,
	primaryProviderId: string,
	baseUrl: string,
	options: MultiLLMOrchestratorOptions
): string {
	const providerLines = providers.map((provider) => {
		const assignment = assignments[provider.id];
		const role = assignment.mode === 'review' ? 'reviewer' : 'executor';
		const tasks = assignment.taskIds.length;
		return `- ${provider.label} (${provider.id}, ${provider.model}) -> ${role}, ${tasks} task(s)`;
	});
	const mcpCapabilities = (options.mcpCapabilities || []).join(', ') || 'none detected';
	const keyConnectedProviders = providers
		.filter((provider) => (options.keyPresence || {})[provider.id])
		.map((provider) => provider.id)
		.join(', ') || 'none';
	const taskPlans = Object.values(mcpTaskPlans);
	const readyCount = taskPlans.filter((plan) => plan.status === 'ready').length;
	const blockedPlans = taskPlans.filter((plan) => plan.status === 'blocked');
	const blockedLines =
		blockedPlans.length > 0
			? blockedPlans
					.map(
						(plan) =>
							`- ${plan.taskId}: ${plan.blockedReason} ${plan.fallbackSuggestion || ''}`.trim()
					)
					.join('\n')
			: '- none';

	return `# Multi-LLM Orchestrator

Mission: ${mission.name}
Mission ID: ${mission.id}
Strategy: ${strategy}
Primary provider: ${primaryProviderId}
Event endpoint: ${baseUrl}/api/events
Auto enable by keys: ${options.autoEnableByKeys !== false ? 'enabled' : 'disabled'}
Auto route by task: ${options.autoRouteByTask !== false ? 'enabled' : 'disabled'}
API-key-ready providers: ${keyConnectedProviders}
Connected MCP capabilities: ${mcpCapabilities}
MCP tool catalog size: ${(options.mcpTools || []).length}
MCP plans ready: ${readyCount}
MCP plans blocked: ${blockedPlans.length}

Providers and assignments:
${providerLines.join('\n')}

Blocked MCP plans:
${blockedLines}

Execution rules:
1. Use each provider prompt as generated by Spawner.
2. Keep all providers on the same mission ID and task IDs.
3. Report events with the provider-specific source field.
4. For review providers, send provider_feedback events instead of task status updates.
5. Mark mission complete only after executor tasks are all done.
`;
}

interface BuildProviderPromptInput {
	mission: Mission;
	provider: MultiLLMProviderConfig;
	assignment: MultiLLMTaskAssignment;
	strategy: MultiLLMStrategy;
	primaryProviderId: string;
	baseUrl: string;
	taskSkillMap?: Map<string, string[]>;
	mcpCapabilities: MultiLLMCapability[];
	mcpTaskPlans: Record<string, MultiLLMMCPTaskPlan>;
}

function buildProviderPrompt(input: BuildProviderPromptInput): string {
	const {
		mission,
		provider,
		assignment,
		strategy,
		primaryProviderId,
		baseUrl,
		taskSkillMap,
		mcpCapabilities,
		mcpTaskPlans
	} = input;
	const isPrimary = provider.id === primaryProviderId;
	const canReportTaskLifecycle =
		assignment.mode === 'execute' &&
		(strategy === 'single' ||
			strategy === 'round_robin' ||
			(strategy === 'parallel_consensus' && isPrimary) ||
			(strategy === 'lead_reviewer' && isPrimary));

	const eventSource = provider.eventSource || provider.id;
	const assignedTasks = mission.tasks.filter((task) => assignment.taskIds.includes(task.id));

	const taskList = assignedTasks
		.map((task, index) => {
			const deps = task.dependsOn?.length ? ` after: ${task.dependsOn.join(', ')}` : '';
			const recommendedSkills = taskSkillMap?.get(task.id) || [];
				const skillsLine =
					recommendedSkills.length > 0
						? `\n   Required H70 skills (load BEFORE task_started): ${recommendedSkills.map((skill) => `\`${skill}\``).join(', ')}`
						: '';
				const mcpPlanLine = formatTaskMcpPlan(mcpTaskPlans[task.id]);
				return `${index + 1}. ${task.title} (id: ${task.id}${deps})\n   ${task.description}${skillsLine}${mcpPlanLine}`;
			})
			.join('\n\n');

	const reportingBlock = canReportTaskLifecycle
		? `Report lifecycle events:
curl -X POST ${baseUrl}/api/events -H "Content-Type: application/json" -d '{"type":"task_started","missionId":"${mission.id}","taskId":"TASK_ID","taskName":"TASK_NAME","source":"${eventSource}"}'
curl -X POST ${baseUrl}/api/events -H "Content-Type: application/json" -d '{"type":"progress","missionId":"${mission.id}","taskId":"TASK_ID","progress":50,"message":"Working...","source":"${eventSource}"}'
curl -X POST ${baseUrl}/api/events -H "Content-Type: application/json" -d '{"type":"task_completed","missionId":"${mission.id}","taskId":"TASK_ID","taskName":"TASK_NAME","data":{"success":true},"source":"${eventSource}"}'

When all assigned tasks are complete:
curl -X POST ${baseUrl}/api/events -H "Content-Type: application/json" -d '{"type":"mission_completed","missionId":"${mission.id}","source":"${eventSource}"}'`
		: `Send review feedback events only (do not emit task_started/task_completed):
curl -X POST ${baseUrl}/api/events -H "Content-Type: application/json" -d '{"type":"provider_feedback","missionId":"${mission.id}","taskId":"TASK_ID","source":"${eventSource}","data":{"provider":"${provider.id}","summary":"feedback here","approved":true}}'`;

	const roleLine = assignment.mode === 'review' ? 'Role: Reviewer' : 'Role: Executor';
	const providerCaps = (provider.capabilities || []).join(', ') || 'reasoning';
	const mcpCapsLine = mcpCapabilities.length > 0 ? mcpCapabilities.join(', ') : 'none';

	return `# Provider Prompt: ${provider.label}

Mission: ${mission.name}
Mission ID: ${mission.id}
Provider: ${provider.id}
Model: ${provider.model}
Provider capabilities: ${providerCaps}
${roleLine}
Strategy: ${strategy}
Connected MCP capabilities: ${mcpCapsLine}

Assigned tasks:
${taskList || '- none'}

H70 skill loading (mandatory):
- For each assigned task with listed skills, fetch every required skill via /api/h70-skills/<skill-id> BEFORE starting the task.
- Do not start task execution until required task skills are loaded.
- Emit one progress event documenting loaded skills before task_started (message format: "SKILL_LOADED:<taskId>:<skillId,...>").
- Apply anti-pattern and disaster guidance from loaded skills before implementation.

Execution expectations:
- Work only on your assigned tasks.
- Keep file changes focused and production-safe.
- If blocked, emit a progress event with the blocker.
- If a task needs external tools (image/video/data/deploy), use matching connected MCP capabilities first.
- Treat task completion as valid only after task-level DoD checks pass (implementation + verification + tests).

${reportingBlock}
`;
}

function buildLaunchCommand(provider: MultiLLMProviderConfig, missionId: string): string {
	const promptFile = `.spawner/prompts/${missionId}-${provider.id}.md`;

	if (provider.kind === 'terminal_cli') {
		const command = (provider.commandTemplate || '').replace('{model}', provider.model).trim();
		return [
			`# ${provider.label} terminal launch`,
			`# 1) Save this provider prompt to ${promptFile}`,
			`# 2) Run command and paste prompt if your CLI does not accept stdin`,
			command || `# No command template configured for ${provider.id}`
		].join('\n');
	}

	if (provider.kind === 'openai_compat') {
		const baseUrl = provider.baseUrl || '<BASE_URL>';
		const apiKeyEnv = provider.apiKeyEnv || 'API_KEY';
		return [
			`# ${provider.label} OpenAI-compatible launch`,
			`# 1) Save this provider prompt to ${promptFile}`,
			`# 2) Build a request JSON using model "${provider.model}" and prompt content`,
			`curl -sS ${baseUrl}/chat/completions \\`,
			`  -H "Authorization: Bearer $${apiKeyEnv}" \\`,
			`  -H "Content-Type: application/json" \\`,
			`  -d @${provider.id}-request.json`
		].join('\n');
	}

	if (provider.kind === 'custom') {
		const customCommand = (provider.commandTemplate || '').replace('{model}', provider.model).trim();
		return [
			`# ${provider.label} custom launch`,
			`# 1) Save this provider prompt to ${promptFile}`,
			`# 2) Use your provider SDK/API with model "${provider.model}"`,
			customCommand || `# No custom command template configured for ${provider.id}`
		].join('\n');
	}

	return `# Launch required for provider "${provider.id}"`;
}
