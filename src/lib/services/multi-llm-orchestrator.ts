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
	keyPresence?: Record<string, boolean>;
	mcpCapabilities?: MultiLLMCapability[];
	providers: MultiLLMProviderConfig[];
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
		commandTemplate: 'codex exec --model {model}'
	},
	{
		id: 'openai',
		label: 'OpenAI',
		model: 'gpt-4.1',
		enabled: false,
		kind: 'openai_compat',
		eventSource: 'openai',
		capabilities: ['reasoning', 'planning', 'code_analysis', 'image_gen', 'audio_gen', 'web_search'],
		baseUrl: 'https://api.openai.com/v1',
		apiKeyEnv: 'OPENAI_API_KEY',
		requiresApiKey: true
	},
	{
		id: 'minimax',
		label: 'Minimax',
		model: 'MiniMax-Text-01',
		enabled: false,
		kind: 'openai_compat',
		eventSource: 'minimax',
		capabilities: ['reasoning', 'planning', 'code_analysis'],
		baseUrl: 'https://api.minimax.chat/v1',
		apiKeyEnv: 'MINIMAX_API_KEY',
		requiresApiKey: true
	},
	{
		id: 'kimi',
		label: 'Kimi',
		model: 'kimi-k2.5',
		enabled: false,
		kind: 'openai_compat',
		eventSource: 'kimi',
		capabilities: ['reasoning', 'planning', 'code_analysis', 'web_search'],
		baseUrl: 'https://api.moonshot.cn/v1',
		apiKeyEnv: 'KIMI_API_KEY',
		requiresApiKey: true
	},
	{
		id: 'openrouter',
		label: 'OpenRouter',
		model: 'anthropic/claude-3.5-sonnet',
		enabled: false,
		kind: 'openai_compat',
		eventSource: 'openrouter',
		capabilities: ['reasoning', 'planning', 'code_analysis', 'image_gen'],
		baseUrl: 'https://openrouter.ai/api/v1',
		apiKeyEnv: 'OPENROUTER_API_KEY',
		requiresApiKey: true
	},
	{
		id: 'ollama',
		label: 'Ollama',
		model: 'qwen2.5-coder:latest',
		enabled: false,
		kind: 'openai_compat',
		eventSource: 'ollama',
		capabilities: ['reasoning', 'planning', 'code_analysis'],
		baseUrl: 'http://127.0.0.1:11434/v1',
		apiKeyEnv: 'OLLAMA_API_KEY',
		requiresApiKey: false
	},
	{
		id: 'replicate',
		label: 'Replicate',
		model: 'black-forest-labs/flux-1.1-pro',
		enabled: false,
		kind: 'custom',
		eventSource: 'replicate',
		capabilities: ['image_gen', 'video_gen'],
		apiKeyEnv: 'REPLICATE_API_TOKEN',
		requiresApiKey: true,
		commandTemplate: 'echo "Use Replicate API with model {model} and provider prompt payload"'
	},
	{
		id: 'runway',
		label: 'Runway',
		model: 'gen-4-turbo',
		enabled: false,
		kind: 'custom',
		eventSource: 'runway',
		capabilities: ['video_gen'],
		apiKeyEnv: 'RUNWAY_API_KEY',
		requiresApiKey: true,
		commandTemplate: 'echo "Use Runway API with model {model} and provider prompt payload"'
	}
];

export function createDefaultMultiLLMOptions(): MultiLLMOrchestratorOptions {
	return {
		enabled: false,
		strategy: 'round_robin',
		primaryProviderId: 'claude',
		autoEnableByKeys: true,
		autoRouteByTask: true,
		keyPresence: {},
		mcpCapabilities: [],
		providers: DEFAULT_MULTI_LLM_PROVIDERS.map((provider) => ({ ...provider }))
	};
}

export function buildMultiLLMExecutionPack(input: MultiLLMBuildInput): MultiLLMExecutionPack {
	const baseUrl = input.baseUrl || 'http://localhost:5173';
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
		input.options.mcpCapabilities || []
	);

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
			mcpCapabilities: input.options.mcpCapabilities || []
		});
		launchCommands[provider.id] = buildLaunchCommand(provider, input.mission.id);
	}

	return {
		enabled: input.options.enabled,
		strategy,
		primaryProviderId,
		providers,
		assignments,
		masterPrompt: buildMasterPrompt(
			input.mission,
			providers,
			assignments,
			strategy,
			primaryProviderId,
			baseUrl,
			input.options
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

function buildMasterPrompt(
	mission: Mission,
	providers: MultiLLMProviderConfig[],
	assignments: Record<string, MultiLLMTaskAssignment>,
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

Providers and assignments:
${providerLines.join('\n')}

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
}

function buildProviderPrompt(input: BuildProviderPromptInput): string {
	const { mission, provider, assignment, strategy, primaryProviderId, baseUrl, taskSkillMap, mcpCapabilities } = input;
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
					? `\n   Load H70 skills: ${recommendedSkills.map((skill) => `\`${skill}\``).join(', ')}`
					: '';
			return `${index + 1}. ${task.title} (id: ${task.id}${deps})\n   ${task.description}${skillsLine}`;
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

H70 skill loading:
- Use /api/h70-skills/<skill-id> to fetch full skill YAML and patterns.
- Apply anti-pattern and disaster guidance before implementation.

Execution expectations:
- Work only on your assigned tasks.
- Keep file changes focused and production-safe.
- If blocked, emit a progress event with the blocker.
- If a task needs external tools (image/video/data/deploy), use matching connected MCP capabilities first.

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
