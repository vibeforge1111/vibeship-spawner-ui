<script lang="ts">
	import {
		missionExecutor,
		type AgentRuntimeStatus,
		type ExecutionProgress,
		type ExecutionStatus,
		type LoadedSkillInfo,
		type TaskTransitionEvent
	} from '$lib/services/mission-executor';
	import type { MissionLog, Mission } from '$lib/services/mcp-client';
	import { nodes, connections, canvasState, updateNodeStatus, resetAllNodeStatus, addConnection } from '$lib/stores/canvas.svelte';
	import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';
	import { isConnected } from '$lib/stores/mcp.svelte';
	import { mcpRuntime } from '$lib/services/mcp-runtime';
	import type { MultiLLMCapability, MultiLLMMCPTool } from '$lib/services/multi-llm-orchestrator';
	import { toasts } from '$lib/stores/toast.svelte';
	import { validateForMission } from '$lib/services/mission-builder';
	import {
		DEFAULT_MULTI_LLM_PROVIDERS,
		createDefaultMultiLLMOptions,
		type MultiLLMOrchestratorOptions,
		type MultiLLMProviderConfig,
		type MultiLLMStrategy
	} from '$lib/services/multi-llm-orchestrator';
	import { resolveRelayMissionProvider } from '$lib/services/relay-mission-provider';
	import CheckpointReview from './CheckpointReview.svelte';
	import ExecutionFooter from './ExecutionFooter.svelte';
	import ExecutionLogList from './ExecutionLogList.svelte';
	import ExecutionProgressHeader from './ExecutionProgressHeader.svelte';
	import MissionSettingsPanel from './MissionSettingsPanel.svelte';
	import ExecutionTaskStatusList from './ExecutionTaskStatusList.svelte';
	import type { ProjectCheckpoint } from '$lib/services/checkpoint';
	import { saveCurrentPipeline } from '$lib/stores/pipelines.svelte';
	import type { MissionControlBoardEntry } from '$lib/types/mission-control';
	import {
		buildMissionControlHydrationSnapshot,
		type MissionControlHistoryEvent
	} from '$lib/services/mission-control-hydration';
	import { buildExecutionTaskRows } from '$lib/services/execution-task-rows';
	import {
		formatExecutionDuration,
		getAgentStatusColor,
		getStatusColor,
		getTransitionBadge
	} from '$lib/services/execution-panel-formatting';
	import { browser } from '$app/environment';
	import { get } from 'svelte/store';

	interface Props {
		onClose: () => void;
		minimized?: boolean;
		onToggleMinimize?: () => void;
		autoRunToken?: number;
		relay?: {
			missionId?: string;
			chatId?: string;
			userId?: string;
			requestId?: string;
			goal?: string;
			telegramRelay?: {
				port?: number;
				profile?: string;
				url?: string;
			};
			autoRun?: boolean;
			buildMode?: 'direct' | 'advanced_prd';
			buildModeReason?: string;
		};
	}

	let { onClose, minimized = false, onToggleMinimize, autoRunToken, relay }: Props = $props();

	let currentNodes = $state<CanvasNode[]>([]);
	let currentConnections = $state<Connection[]>([]);
	let executionProgress = $state<ExecutionProgress | null>(null);
	let logs = $state<MissionLog[]>([]);
	let mcpConnected = $state(false);

	// Checkpoint review state
	let showCheckpointReview = $state(false);
	let missionCheckpoint = $state<ProjectCheckpoint | null>(null);

	// Orphan node warning state
	let showOrphanWarning = $state(false);
	let orphanedNodes = $state<CanvasNode[]>([]);

	// Task tracking for completion summary
	let completedTasks = $state<string[]>([]);
	let failedTasks = $state<string[]>([]);
	let pendingTasks = $state<string[]>([]);
	let reworkTasks = $state<Map<string, { name: string; retry: number; maxRetries: number }>>(new Map());

	// Current task progress tracking
	let currentTaskProgress = $state(0);
	let currentTaskMessage = $state<string | null>(null);

	// Resumable mission state
	let resumableMission = $state<{
		id: string;
		name: string;
		progress: number;
		status: ExecutionStatus;
	} | null>(null);
	let showResumeBanner = $state(false);

	// Copy prompt collapsed state - default to collapsed to save space
	let copyPromptCollapsed = $state(true);
	let multiLLMPanelCollapsed = $state(false);
	let mcpDetailOpen = $state(false);

	// H70 skills collapsed state - show active skill in header when collapsed
	let h70SkillsCollapsed = $state(true);

	// Mission settings (persisted locally)
	const MISSION_DEFAULTS_KEY = 'spawner-mission-defaults';
	let showMissionSettings = $state(false);
	let missionName = $state('Spark Intelligence Launch Readiness');
	let missionDescription = $state('Prepare Spark Intelligence to go live with safety, reliability, docs, and launch comms.');
	let projectPath = $state('C:/Users/USER/Desktop/vibeship-spark-intelligence');
	let projectType = $state('tool');
	let goalsText = $state(
		[
			'All launch gates green (health, security, docs, observability, support readiness)',
			'Clear launch story + distribution plan',
			'Rollback plan + incident readiness'
		].join('\\n')
	);
	let defaultsLoaded = $state(false);
	const defaultMultiLLMOptions = createDefaultMultiLLMOptions();
	const MULTI_LLM_KEYS_STORAGE = 'spawner-multi-llm-api-keys';
	let multiLLMEnabled = $state(defaultMultiLLMOptions.enabled);
	let multiLLMStrategy = $state<MultiLLMStrategy>(defaultMultiLLMOptions.strategy);
	let multiLLMPrimaryProviderId = $state(defaultMultiLLMOptions.primaryProviderId || 'claude');
	let multiLLMAutoEnableByKeys = $state(defaultMultiLLMOptions.autoEnableByKeys ?? true);
	let multiLLMAutoRouteByTask = $state(defaultMultiLLMOptions.autoRouteByTask ?? true);
	let multiLLMAutoDispatch = $state(true);
	let multiLLMApiKeys = $state<Record<string, string>>({});
	let serverProviderKeyPresence = $state<Record<string, boolean>>({});
	let connectedMcpCapabilities = $state<MultiLLMCapability[]>([]);
	let connectedMcpTools = $state<MultiLLMMCPTool[]>([]);
	let connectedMcpToolCount = $state(0);
	let showAdvancedMultiLLM = $state(false);
	let multiLLMProviders = $state<MultiLLMProviderConfig[]>(
		defaultMultiLLMOptions.providers.map((provider) => ({ ...provider }))
	);

	// Guard to ensure mount-only effects run once
	let hasCheckedResumable = $state(false);
	let lastHandledAutoRunToken = $state<number | null>(null);
	let autoRunInFlightToken = $state<number | null>(null);
	let lastAppliedRelayRequestId = $state<string | null>(null);
	let lastHydratedMissionId = $state<string | null>(null);
	let hydrationInFlightMissionId = $state<string | null>(null);
	let autoRunRetryTimer: ReturnType<typeof setTimeout> | null = null;

	// Derived states
	let isRunning = $derived(executionProgress?.status === 'running' || executionProgress?.status === 'creating');
	let isPaused = $derived(executionProgress?.status === 'paused');
	let isTerminal = $derived(
		executionProgress?.status === 'completed' ||
			executionProgress?.status === 'failed' ||
			executionProgress?.status === 'cancelled'
	);
	let canPause = $derived(executionProgress?.status === 'running');
	let canResume = $derived(executionProgress?.status === 'paused');
	let canCancel = $derived(isRunning || isPaused);
	// Note: MCP not required anymore - we build missions locally and run directly by default (copy prompt is fallback)
	let canRun = $derived(!isRunning && !isPaused && !isTerminal && currentNodes.length > 0);
	let runtimeAgents = $derived.by(() => {
		if (!executionProgress?.agentRuntime) return [] as AgentRuntimeStatus[];
		return Array.from(executionProgress.agentRuntime.values()).sort((a, b) =>
			Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
		);
	});
	let recentTaskTransitions = $derived.by(() => {
		if (!executionProgress?.taskTransitions) return [] as TaskTransitionEvent[];
		return executionProgress.taskTransitions.slice(-12).reverse();
	});
	let taskRows = $derived.by(() => buildExecutionTaskRows(executionProgress, currentNodes));

	function taskMatchesNode(node: CanvasNode, taskId: string, taskName?: string): boolean {
		const nodeName = node.skill.name || '';
		const skillId = node.skill.id || '';
		const normalizedTaskName = (taskName || '').trim().toLowerCase();
		const normalizedNodeName = nodeName.trim().toLowerCase();
		return (
			node.id === taskId ||
			skillId === taskId ||
			skillId === `task-${taskId}` ||
			nodeName === taskName ||
			nodeName === taskId ||
			nodeName.startsWith(`${taskId}:`) ||
			(Boolean(taskName) && nodeName.startsWith(`${taskName}:`)) ||
			(Boolean(normalizedTaskName) && normalizedNodeName.includes(normalizedTaskName))
		);
	}

	function findNodeForTask(taskId: string, taskName?: string): CanvasNode | undefined {
		return currentNodes.find((node) => taskMatchesNode(node, taskId, taskName));
	}

	function persistCanvasStatusSnapshot() {
		const state = get(canvasState);
		saveCurrentPipeline({
			nodes: state.nodes,
			connections: state.connections,
			zoom: state.zoom,
			pan: state.pan
		});
	}

	function applyMissionTaskStatuses(mission: Mission) {
		for (const task of mission.tasks || []) {
			const node = findNodeForTask(task.id, task.title);
			if (!node) continue;
			if (task.status === 'completed') {
				updateNodeStatus(node.id, 'success');
			} else if (task.status === 'failed') {
				updateNodeStatus(node.id, 'error');
			} else if (task.status === 'in_progress') {
				updateNodeStatus(node.id, 'running');
			} else {
				updateNodeStatus(node.id, 'queued');
			}
		}
		persistCanvasStatusSnapshot();
	}

	function syncMissionTaskStatusesFromExecutor() {
		const mission = missionExecutor.getProgress().mission;
		if (mission?.tasks?.length) {
			applyMissionTaskStatuses(mission);
		}
	}

	function applyMultiLLMOptions(options?: MultiLLMOrchestratorOptions) {
		const defaults = createDefaultMultiLLMOptions();
		const incoming = options || defaults;
		const incomingProviders = incoming.providers || [];

		const mergedProviders = defaults.providers.map((defaultProvider) => {
			const savedProvider = incomingProviders.find((provider) => provider.id === defaultProvider.id);
			if (!savedProvider) {
				return { ...defaultProvider };
			}
			return {
				...defaultProvider,
				enabled: typeof savedProvider.enabled === 'boolean' ? savedProvider.enabled : defaultProvider.enabled,
				model:
					typeof savedProvider.model === 'string' && savedProvider.model.trim()
						? savedProvider.model
						: defaultProvider.model
			};
		});

		multiLLMEnabled = incoming.enabled ?? defaults.enabled;
		multiLLMStrategy = incoming.strategy ?? defaults.strategy;
		multiLLMPrimaryProviderId = incoming.primaryProviderId ?? defaults.primaryProviderId ?? 'claude';
		multiLLMAutoEnableByKeys = incoming.autoEnableByKeys ?? defaults.autoEnableByKeys ?? true;
		multiLLMAutoRouteByTask = incoming.autoRouteByTask ?? defaults.autoRouteByTask ?? true;
		multiLLMAutoDispatch = incoming.autoDispatch ?? true;
		multiLLMProviders = mergedProviders;
	}

	type MissionControlTask = MissionControlBoardEntry['tasks'][number];

	function applyBoardTaskStatuses(tasks: MissionControlTask[]) {
		for (const task of tasks) {
			const node = findNodeForTask(task.title, task.title);
			if (!node) continue;
			if (task.status === 'completed') {
				updateNodeStatus(node.id, 'success');
			} else if (task.status === 'failed' || task.status === 'cancelled') {
				updateNodeStatus(node.id, 'error');
			} else if (task.status === 'running') {
				updateNodeStatus(node.id, 'running');
			} else {
				updateNodeStatus(node.id, 'queued');
			}
		}
		persistCanvasStatusSnapshot();
	}

	async function loadMissionControlBoardEntry(missionId: string): Promise<MissionControlBoardEntry | null> {
		const response = await fetch('/api/mission-control/board');
		if (!response.ok) return null;
		const data = await response.json();
		const board = data?.board as Record<string, MissionControlBoardEntry[]> | undefined;
		if (!board) return null;
		for (const entries of Object.values(board)) {
			const match = entries.find((entry) => entry.missionId === missionId);
			if (match) return match;
		}
		return null;
	}

	async function hydrateMissionControlHistory(missionId: string) {
		if (!browser || !missionId) return;
		if (hydrationInFlightMissionId === missionId) return;
		if (lastHydratedMissionId === missionId && executionProgress?.missionId === missionId) return;

		hydrationInFlightMissionId = missionId;
		try {
			const [statusResponse, boardEntry] = await Promise.all([
				fetch(`/api/mission-control/status?missionId=${encodeURIComponent(missionId)}`),
				loadMissionControlBoardEntry(missionId)
			]);
			if (!statusResponse.ok || !boardEntry) return;

			const statusData = await statusResponse.json();
			const recent = ((statusData?.snapshot?.recent || []) as MissionControlHistoryEvent[])
				.filter((entry) => entry.missionId === missionId)
				.slice()
				.reverse();
			const snapshot = buildMissionControlHydrationSnapshot({
				missionId,
				boardEntry,
				recentEvents: recent,
				missionName,
				projectPath,
				projectType,
				goals: parseGoals(goalsText || ''),
				multiLLMOptions: getMultiLLMOptions()
			});

			executionProgress = snapshot.executionProgress;
			logs = snapshot.logs;
			completedTasks = snapshot.completedTasks;
			failedTasks = snapshot.failedTasks;
			pendingTasks = snapshot.pendingTasks;
			applyBoardTaskStatuses(boardEntry.tasks);
			lastHydratedMissionId = missionId;
		} catch (error) {
			console.warn('[ExecutionPanel] Failed to hydrate mission-control history:', error);
		} finally {
			if (hydrationInFlightMissionId === missionId) {
				hydrationInFlightMissionId = null;
			}
		}
	}

	function getMultiLLMOptions(): MultiLLMOrchestratorOptions {
		const keyPresence = Object.fromEntries(
			multiLLMProviders.map((provider) => [
				provider.id,
				Boolean((multiLLMApiKeys[provider.id] || '').trim()) || Boolean(serverProviderKeyPresence[provider.id])
			])
		);
		return {
			enabled: multiLLMEnabled,
			strategy: multiLLMStrategy,
			primaryProviderId: multiLLMPrimaryProviderId,
			autoEnableByKeys: multiLLMAutoEnableByKeys,
			autoRouteByTask: multiLLMAutoRouteByTask,
			autoDispatch: multiLLMAutoDispatch,
			apiKeys: multiLLMApiKeys,
			keyPresence,
			mcpCapabilities: connectedMcpCapabilities,
			mcpTools: connectedMcpTools,
			providers: multiLLMProviders.map((provider) => ({ ...provider }))
		};
	}

	function loadMultiLLMApiKeys() {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(MULTI_LLM_KEYS_STORAGE);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === 'object') {
				multiLLMApiKeys = parsed as Record<string, string>;
			}
		} catch {
			// ignore
		}
	}

	function persistMultiLLMApiKeys() {
		if (!browser) return;
		try {
			localStorage.setItem(MULTI_LLM_KEYS_STORAGE, JSON.stringify(multiLLMApiKeys));
		} catch {
			// ignore
		}
	}

	function updateMultiLLMApiKey(providerId: string, apiKey: string) {
		multiLLMApiKeys = {
			...multiLLMApiKeys,
			[providerId]: apiKey
		};
	}

	interface ServerProviderInfo {
		id: string;
		envKeyConfigured?: boolean;
		cliConfigured?: boolean;
		configured?: boolean;
		model?: string;
		baseUrl?: string | null;
	}

	function applySparkSingleProviderSelection(
		providers: ServerProviderInfo[],
		sparkDefaultProvider?: string | null
	) {
		multiLLMProviders = multiLLMProviders.map((provider) => {
			const serverProvider = providers.find((entry) => entry.id === provider.id);
			return {
				...provider,
				enabled: Boolean(sparkDefaultProvider && provider.id === sparkDefaultProvider),
				model:
					typeof serverProvider?.model === 'string' && serverProvider.model.trim()
						? serverProvider.model
						: provider.model,
				baseUrl:
					typeof serverProvider?.baseUrl === 'string' && serverProvider.baseUrl.trim()
						? serverProvider.baseUrl
						: provider.baseUrl
			};
		});

		if (!sparkDefaultProvider) return;

		multiLLMEnabled = true;
		multiLLMStrategy = 'single';
		multiLLMPrimaryProviderId = sparkDefaultProvider;
		multiLLMAutoEnableByKeys = true;
		multiLLMAutoRouteByTask = false;
		multiLLMAutoDispatch = true;
	}

	function applyServerProviderKeyPresence(
		presence: Record<string, boolean>,
		providers: ServerProviderInfo[] = [],
		sparkDefaultProvider?: string | null
	) {
		serverProviderKeyPresence = presence;
		applySparkSingleProviderSelection(providers, sparkDefaultProvider);
		if (sparkDefaultProvider) return;
		if (!multiLLMAutoEnableByKeys) return;

		multiLLMProviders = multiLLMProviders.map((provider) =>
			presence[provider.id] && !provider.enabled ? { ...provider, enabled: true } : provider
		);

		const enabledProviderIds = multiLLMProviders
			.filter((provider) => provider.enabled)
			.map((provider) => provider.id);
		if (enabledProviderIds.length > 0 && !enabledProviderIds.includes(multiLLMPrimaryProviderId)) {
			multiLLMPrimaryProviderId = enabledProviderIds[0];
		}
	}

	async function loadServerProviderKeyPresence() {
		if (!browser) return;
		try {
			const response = await fetch('/api/providers');
			if (!response.ok) return;
			const result = await response.json();
			if (!Array.isArray(result?.providers)) return;

			const presence = Object.fromEntries(
				result.providers.map((provider: ServerProviderInfo) => [
					provider.id,
					Boolean(provider.configured ?? provider.cliConfigured ?? provider.envKeyConfigured)
				])
			);
			applyServerProviderKeyPresence(
				presence,
				result.providers as ServerProviderInfo[],
				typeof result?.sparkDefaultProvider === 'string' ? result.sparkDefaultProvider : null
			);
		} catch {
			// ignore
		}
	}

	function toggleMultiLLMProvider(providerId: string) {
		multiLLMProviders = multiLLMProviders.map((provider) =>
			provider.id === providerId ? { ...provider, enabled: !provider.enabled } : provider
		);

		const enabledProviderIds = multiLLMProviders
			.filter((provider) => provider.enabled)
			.map((provider) => provider.id);
		if (enabledProviderIds.length > 0 && !enabledProviderIds.includes(multiLLMPrimaryProviderId)) {
			multiLLMPrimaryProviderId = enabledProviderIds[0];
		}
	}

	function updateMultiLLMProviderModel(providerId: string, model: string) {
		multiLLMProviders = multiLLMProviders.map((provider) =>
			provider.id === providerId ? { ...provider, model } : provider
		);
	}

	type ExecutionMode = 'single' | 'multi';

	function getExecutionMode(): ExecutionMode {
		if (!multiLLMEnabled) return 'single';
		return multiLLMStrategy === 'single' ? 'single' : 'multi';
	}

	function setSingleProvider(providerId: string) {
		multiLLMPrimaryProviderId = providerId;
		multiLLMProviders = multiLLMProviders.map((provider) => {
			if (provider.id === providerId) {
				return { ...provider, enabled: true };
			}
			return { ...provider, enabled: false };
		});
	}

	function setExecutionMode(mode: ExecutionMode) {
		multiLLMEnabled = true;
		if (mode === 'single') {
			multiLLMStrategy = 'single';
			multiLLMAutoRouteByTask = false;
			const selectedProvider =
				multiLLMProviders.find((provider) => provider.id === multiLLMPrimaryProviderId) ||
				multiLLMProviders.find((provider) => provider.id === 'claude') ||
				multiLLMProviders[0];
			if (selectedProvider) {
				setSingleProvider(selectedProvider.id);
			}
			return;
		}

		if (multiLLMStrategy === 'single') {
			multiLLMStrategy = 'round_robin';
		}
		multiLLMAutoRouteByTask = true;
		multiLLMProviders = multiLLMProviders.map((provider) =>
			provider.id === 'claude' ||
			provider.id === 'codex' ||
			hasProviderApiKey(provider.id)
				? { ...provider, enabled: true }
				: provider
		);
	}

	function hasProviderApiKey(providerId: string): boolean {
		return Boolean((multiLLMApiKeys[providerId] || '').trim()) || Boolean(serverProviderKeyPresence[providerId]);
	}

	function hasDualProviderKeys(): boolean {
		return hasProviderApiKey('claude') && hasProviderApiKey('codex');
	}

	function prepareDualProviderRunIfReady() {
		if (getExecutionMode() !== 'multi') return;
		if (!hasDualProviderKeys()) return;

		multiLLMEnabled = true;
		multiLLMStrategy = 'parallel_consensus';
		multiLLMAutoDispatch = true;
		multiLLMPrimaryProviderId = 'claude';
		multiLLMProviders = multiLLMProviders.map((provider) =>
			provider.id === 'claude' || provider.id === 'codex'
				? { ...provider, enabled: true }
				: provider
		);
	}

	function copyToClipboard(text: string, successMessage: string) {
		navigator.clipboard.writeText(text);
		toasts.success(successMessage);
	}

	// Svelte 5: Use $effect with store subscriptions - run once and cleanup
	$effect(() => {
		const unsub1 = nodes.subscribe((n) => (currentNodes = n));
		const unsub2 = connections.subscribe((c) => (currentConnections = c));
		const unsub3 = isConnected.subscribe((connected) => (mcpConnected = connected));
		const unsub4 = mcpRuntime.subscribe((runtime) => {
			connectedMcpCapabilities = runtime.capabilities as MultiLLMCapability[];
			connectedMcpTools = runtime.tools.map((tool) => ({
				instanceId: tool.instanceId,
				mcpName: tool.mcpName,
				toolName: tool.toolName,
				description: tool.description,
				capabilities: tool.capabilities as MultiLLMCapability[]
			}));
			connectedMcpToolCount = runtime.tools.length;
		});
		return () => {
			unsub1();
			unsub2();
			unsub3();
			unsub4();
		};
	});

	// Check for resumable mission on mount - RUN ONLY ONCE
	// Using guard to prevent infinite loop (getResumableMissionInfo returns new object each call)
	$effect(() => {
		if (hasCheckedResumable) return; // Guard against re-runs
		hasCheckedResumable = true;

		const missionInfo = missionExecutor.getResumableMissionInfo();
		if (missionInfo) {
			resumableMission = missionInfo;
			// Restore the full execution progress
			const progress = missionExecutor.getProgress();
			executionProgress = progress;
			if (progress?.multiLLMOptions) {
				applyMultiLLMOptions(progress.multiLLMOptions);
			}
			logs = progress?.logs || [];

			// Restore task tracking state from mission
			if (progress?.mission?.tasks) {
				const tasks = progress.mission.tasks;
				completedTasks = tasks.filter(t => t.status === 'completed').map(t => t.title);
				failedTasks = tasks.filter(t => t.status === 'failed').map(t => t.title);
				pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').map(t => t.title);
			}

			// Only show resume banner if paused, otherwise auto-continue display
			if (missionInfo.status === 'paused') {
				showResumeBanner = true;
			} else if (missionInfo.status === 'running' || missionInfo.status === 'creating') {
				// Still running/creating - just show the current state without banner
				showResumeBanner = false;
			}
		}
	});

	$effect(() => {
		const missionId = relay?.missionId;
		if (!browser || !missionId) return;
		if (isRunning || isPaused) return;
		void hydrateMissionControlHistory(missionId);
	});

	// Load persisted mission defaults once (browser only)
	$effect(() => {
		if (defaultsLoaded) return;
		defaultsLoaded = true;
		if (!browser) return;
		loadMultiLLMApiKeys();
		void loadServerProviderKeyPresence();
		try {
			const raw = localStorage.getItem(MISSION_DEFAULTS_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (typeof parsed?.missionName === 'string' && parsed.missionName.trim()) missionName = parsed.missionName;
			if (typeof parsed?.missionDescription === 'string') missionDescription = parsed.missionDescription;
			if (typeof parsed?.projectPath === 'string' && parsed.projectPath.trim()) projectPath = parsed.projectPath;
			if (typeof parsed?.projectType === 'string' && parsed.projectType.trim()) projectType = parsed.projectType;
			if (typeof parsed?.goalsText === 'string') goalsText = parsed.goalsText;
			if (
				typeof parsed?.multiLLMEnabled === 'boolean' ||
				typeof parsed?.multiLLMStrategy === 'string' ||
				Array.isArray(parsed?.multiLLMProviders)
			) {
				applyMultiLLMOptions({
					enabled:
						typeof parsed?.multiLLMEnabled === 'boolean'
							? parsed.multiLLMEnabled
							: defaultMultiLLMOptions.enabled,
					strategy:
						typeof parsed?.multiLLMStrategy === 'string'
							? (parsed.multiLLMStrategy as MultiLLMStrategy)
							: defaultMultiLLMOptions.strategy,
					primaryProviderId:
						typeof parsed?.multiLLMPrimaryProviderId === 'string'
							? parsed.multiLLMPrimaryProviderId
							: defaultMultiLLMOptions.primaryProviderId,
					autoEnableByKeys:
						typeof parsed?.multiLLMAutoEnableByKeys === 'boolean'
							? parsed.multiLLMAutoEnableByKeys
							: defaultMultiLLMOptions.autoEnableByKeys,
					autoRouteByTask:
						typeof parsed?.multiLLMAutoRouteByTask === 'boolean'
							? parsed.multiLLMAutoRouteByTask
							: defaultMultiLLMOptions.autoRouteByTask,
					autoDispatch:
						typeof parsed?.multiLLMAutoDispatch === 'boolean'
							? parsed.multiLLMAutoDispatch
							: false,
					providers: Array.isArray(parsed?.multiLLMProviders)
						? (parsed.multiLLMProviders as MultiLLMProviderConfig[])
						: defaultMultiLLMOptions.providers
				});
			}
		} catch {
			// ignore
		}
	});

	function persistDefaults() {
		if (!browser) return;
		try {
			localStorage.setItem(
				MISSION_DEFAULTS_KEY,
				JSON.stringify({
					missionName,
					missionDescription,
					projectPath,
					projectType,
					goalsText,
					multiLLMEnabled,
					multiLLMStrategy,
					multiLLMPrimaryProviderId,
					multiLLMAutoEnableByKeys,
					multiLLMAutoRouteByTask,
					multiLLMAutoDispatch,
					multiLLMProviders
				})
			);
			persistMultiLLMApiKeys();
		} catch {
			// ignore
		}
	}

	function parseGoals(text: string): string[] {
		return text
			.split('\\n')
			.map((l) => l.trim())
			.filter(Boolean);
	}

	function extractTargetWorkspaceFromText(text?: string): string | null {
		if (!text) return null;
		const match = text.match(/Target workspace:\s*`([^`]+)`/i) || text.match(/Target workspace:\s*([^\r\n]+)/i);
		return match?.[1]?.trim().replace(/[.,;]+$/, '') || null;
	}

	function extractMissionTitleFromRelay(text?: string): string | null {
		if (!text) return null;
		const heading = text.match(/^\s*#\s+(.+)$/m);
		if (heading?.[1]?.trim()) return heading[1].trim();
		const project = text.match(/Project:\s*([^\r\n]+)/i);
		return project?.[1]?.trim() || null;
	}

	function forceRelayMissionProvider(providerId = 'codex') {
		const selectedProvider = resolveRelayMissionProvider(DEFAULT_MULTI_LLM_PROVIDERS, providerId);
		if (!selectedProvider) return;

		const providers = DEFAULT_MULTI_LLM_PROVIDERS.map((provider) => ({
			...provider,
			enabled: provider.id === selectedProvider.id
		}));

		multiLLMEnabled = true;
		multiLLMStrategy = 'single';
		multiLLMPrimaryProviderId = selectedProvider.id;
		multiLLMAutoEnableByKeys = true;
		multiLLMAutoRouteByTask = false;
		multiLLMAutoDispatch = true;
		multiLLMProviders = providers;
	}

	function applyRelayMissionDefaults() {
		if (!relay?.requestId || relay.requestId === lastAppliedRelayRequestId) return;
		lastAppliedRelayRequestId = relay.requestId;

		const buildMode = relay.buildMode || 'direct';
		missionName = extractMissionTitleFromRelay(relay.goal) || `Telegram Build ${relay.requestId}`;
		const targetWorkspace = extractTargetWorkspaceFromText(relay.goal);
		if (targetWorkspace) projectPath = targetWorkspace;
		forceRelayMissionProvider();
		missionDescription = [
			`Build mode: ${buildMode}`,
			relay.buildModeReason ? `Reason: ${relay.buildModeReason}` : null,
			relay.goal || ''
		]
			.filter((line): line is string => Boolean(line && line.trim()))
			.join('\n\n');
		goalsText =
			buildMode === 'advanced_prd'
				? [
						'Create or follow a compact PRD before implementation.',
						'Execute the TAS-style task plan with acceptance criteria.',
						'Verify the completed project in the target workspace.'
					].join('\n')
				: ['Complete the requested files exactly.', 'Verify the result in the target workspace.'].join('\n');
	}

	$effect(() => {
		applyRelayMissionDefaults();
	});

	function getCurrentTaskSkills(progress: ExecutionProgress | null): LoadedSkillInfo[] {
		if (!isRunning || !progress?.loadedSkills || !progress.currentTaskId) {
			return [];
		}
		const currentTaskId = progress.currentTaskId;
		return progress.loadedSkills.filter((skill) => skill.taskIds.includes(currentTaskId));
	}

	/**
	 * Dismiss the resume banner and clear the saved mission state
	 */
	function dismissResumeBanner() {
		showResumeBanner = false;
		resumableMission = null;
		missionExecutor.stop();  // This clears the persisted state
		executionProgress = null;
		logs = [];
		toasts.info('Previous mission dismissed');
	}

	/**
	 * Continue with the resumed mission
	 */
	function continueResumableMission() {
		showResumeBanner = false;
		// Mission is already restored, just continue
		if (resumableMission?.status === 'paused') {
			handleResume();
		} else if (resumableMission?.status === 'partial') {
			handleResumePartial();
		}
		toasts.success(`Continuing mission: ${resumableMission?.name}`);
	}

	/**
	 * Find orphaned nodes (nodes not connected to any other node)
	 */
	function findOrphanedNodes(): CanvasNode[] {
		if (currentNodes.length <= 1) return []; // Single node is fine

		const connectedNodes = new Set<string>();
		for (const conn of currentConnections) {
			connectedNodes.add(conn.sourceNodeId);
			connectedNodes.add(conn.targetNodeId);
		}

		return currentNodes.filter((n) => !connectedNodes.has(n.id));
	}

	/**
	 * Auto-connect orphaned nodes to the workflow
	 * Strategy: Connect each orphan to the last connected node in a chain
	 */
	function autoConnectOrphans() {
		const orphans = findOrphanedNodes();
		if (orphans.length === 0) return;

		// Find nodes that are already connected
		const connectedNodes = new Set<string>();
		for (const conn of currentConnections) {
			connectedNodes.add(conn.sourceNodeId);
			connectedNodes.add(conn.targetNodeId);
		}

		// Find terminal nodes (nodes with no outgoing connections)
		const hasOutgoing = new Set<string>();
		for (const conn of currentConnections) {
			hasOutgoing.add(conn.sourceNodeId);
		}

		// Get nodes that have no outgoing connections (terminal nodes)
		let terminalNodes = currentNodes.filter(
			(n) => connectedNodes.has(n.id) && !hasOutgoing.has(n.id)
		);

		// If no terminal nodes, use all connected nodes
		if (terminalNodes.length === 0) {
			terminalNodes = currentNodes.filter((n) => connectedNodes.has(n.id));
		}

		// If still no nodes (all are orphans), connect them in sequence
		if (terminalNodes.length === 0 && orphans.length > 0) {
			// Connect orphans in a chain
			for (let i = 0; i < orphans.length - 1; i++) {
				addConnection(orphans[i].id, 'output', orphans[i + 1].id, 'input');
			}
			toasts.success(`Auto-connected ${orphans.length} orphaned nodes`);
			showOrphanWarning = false;
			return;
		}

		// Connect each orphan to a terminal node, chaining them
		let lastTerminal = terminalNodes[0];
		for (const orphan of orphans) {
			addConnection(lastTerminal.id, 'output', orphan.id, 'input');
			lastTerminal = orphan; // Chain the orphans
		}

		toasts.success(`Auto-connected ${orphans.length} orphaned node${orphans.length > 1 ? 's' : ''}`);
		showOrphanWarning = false;
	}

	/**
	 * Handle "View on Canvas" - close panel so user can fix manually
	 */
	function handleViewOnCanvas() {
		showOrphanWarning = false;
		onClose();
		// Optionally highlight the orphaned nodes
		toasts.info(`${orphanedNodes.length} orphaned node${orphanedNodes.length > 1 ? 's' : ''} need connection`);
	}

	/**
	 * Pre-run validation to check for orphans and errors
	 */
	function checkWorkflowBeforeRun(options: { autoRun?: boolean } = {}): boolean {
		const validation = validateForMission(currentNodes, currentConnections);

		// Check for blocking errors first (circular deps, empty canvas)
		if (validation.errors.length > 0) {
			toasts.error(`Validation failed: ${validation.errors.join(', ')}`);
			return false;
		}

		// Check for orphan warnings - show prompt but allow proceeding
		const orphans = findOrphanedNodes();
		if (orphans.length > 0) {
			if (options.autoRun) {
				return false;
			}
			orphanedNodes = orphans;
			showOrphanWarning = true;
			return false; // Don't run yet, show warning first
		}

		return true;
	}

	/**
	 * Proceed with workflow after orphan warning dismissed
	 */
	function proceedWithOrphans() {
		showOrphanWarning = false;
		executeWorkflow();
	}

	// Cleanup on unmount
	$effect(() => {
		return () => {
			missionExecutor.stop();
		};
	});

	/**
	 * Entry point for running workflow - validates first
	 */
	function runWorkflow(options: { autoRun?: boolean } = {}): boolean {
		if (isTerminal && executionProgress?.missionId) {
			toasts.info(`Mission ${executionProgress.missionId} is already ${executionProgress.status}. Open the logs here or start a fresh mission from Telegram/Kanban.`);
			return false;
		}
		if (!checkWorkflowBeforeRun(options)) {
			return false; // Validation failed, warning shown
		}
		void executeWorkflow();
		return true;
	}

	$effect(() => {
		if (!autoRunToken) return;
		if (autoRunToken === lastHandledAutoRunToken) return;
		if (autoRunToken === autoRunInFlightToken) return;
		if (isTerminal) return;
		if (isRunning || isPaused || currentNodes.length === 0) return;
		if (autoRunRetryTimer) clearTimeout(autoRunRetryTimer);

		const token = autoRunToken;
		const tryAutoRun = (attempt = 0) => {
			if (token !== autoRunToken || token === lastHandledAutoRunToken) return;
			if (token === autoRunInFlightToken) return;
			if (isTerminal) return;
			if (isRunning || isPaused) return;
			if (currentNodes.length === 0) {
				if (attempt < 20) {
					autoRunRetryTimer = setTimeout(() => tryAutoRun(attempt + 1), 250);
				}
				return;
			}

			autoRunInFlightToken = token;
			const started = runWorkflow({ autoRun: true });
			if (started) {
				lastHandledAutoRunToken = token;
				return;
			}
			autoRunInFlightToken = null;

			if (attempt < 20) {
				autoRunRetryTimer = setTimeout(() => tryAutoRun(attempt + 1), 250);
			}
		};

		autoRunRetryTimer = setTimeout(() => tryAutoRun(), 250);
		return () => {
			if (autoRunRetryTimer) clearTimeout(autoRunRetryTimer);
		};
	});

	/**
	 * Actually execute the workflow (called after validation passes)
	 */
	async function executeWorkflow() {
		logs = [];
		resetAllNodeStatus();
		for (const node of currentNodes) {
			updateNodeStatus(node.id, 'queued');
		}
		persistCanvasStatusSnapshot();

		// Reset task tracking
		completedTasks = [];
		failedTasks = [];
		pendingTasks = currentNodes.map(n => n.skill.name);
		reworkTasks = new Map();

		// Set up callbacks
		missionExecutor.setCallbacks({
			onStatusChange: () => {
				executionProgress = missionExecutor.getProgress();
				syncMissionTaskStatusesFromExecutor();
			},
			onProgress: (progress) => {
				executionProgress = missionExecutor.getProgress();
				syncMissionTaskStatusesFromExecutor();
			},
			onTaskProgress: (taskId, progress, message) => {
				// Update task-level progress for smoother UI updates
				currentTaskProgress = progress;
				currentTaskMessage = message || null;
				executionProgress = missionExecutor.getProgress();
				syncMissionTaskStatusesFromExecutor();
			},
			onLog: (log) => {
				logs = [...logs, log];
				executionProgress = missionExecutor.getProgress();
			},
			onTaskStart: (taskId, taskName) => {
				// Reset task progress for new task
				currentTaskProgress = 0;
				currentTaskMessage = null;

				// Find the node matching this task and update its status
				const node = findNodeForTask(taskId, taskName);
				if (node) {
					updateNodeStatus(node.id, 'running');
					persistCanvasStatusSnapshot();

					// Remove from pending, update UI
					pendingTasks = pendingTasks.filter(t => t !== taskName && t !== taskId);
				}

				// Update executionProgress to reflect new current task name
				executionProgress = missionExecutor.getProgress();
			},
			onTaskComplete: (taskId, success) => {
				// Find the node and update its status
				const node = findNodeForTask(taskId);
				const taskName = node?.skill.name || taskId;
				if (node) {
					updateNodeStatus(node.id, success ? 'success' : 'error');
					persistCanvasStatusSnapshot();
				}

				// Clear rework state if task is now truly done
				reworkTasks.delete(taskId);
				reworkTasks = new Map(reworkTasks);

				// Update tracking
				if (success) {
					completedTasks = [...new Set([...completedTasks, taskName])];
				} else {
					failedTasks = [...new Set([...failedTasks, taskName])];
				}
				pendingTasks = pendingTasks.filter(t => t !== taskName && t !== taskId);

				// Update executionProgress to reflect task completion
				executionProgress = missionExecutor.getProgress();
			},
			onTaskRework: (taskId, taskName, retryNumber, maxRetries) => {
				// Track rework state for UI badges
				const node = findNodeForTask(taskId, taskName);
				if (node) {
					updateNodeStatus(node.id, 'idle'); // Reset to idle — task is back to pending
					persistCanvasStatusSnapshot();
				}
				reworkTasks.set(taskId, { name: taskName, retry: retryNumber, maxRetries });
				reworkTasks = new Map(reworkTasks);
				executionProgress = missionExecutor.getProgress();
			},
			onComplete: async (mission) => {
				executionProgress = missionExecutor.getProgress();

				// Clear pending tasks
				pendingTasks = [];

				// Update node statuses based on actual mission task state and persist them.
				applyMissionTaskStatuses(mission);

				// Show checkpoint review if available
				if (executionProgress?.checkpoint) {
					missionCheckpoint = executionProgress.checkpoint;
					showCheckpointReview = true;
				}

				toasts.success('Workflow completed successfully');
			},
			onError: async (error) => {
				executionProgress = missionExecutor.getProgress();

				toasts.error(`Execution failed: ${error}`, {
					label: 'Retry',
					onClick: () => runWorkflow()
				});
			}
		});

		// Execute with claude-code mode
		const name = (missionName || '').trim() || `Workflow Execution ${new Date().toLocaleString()}`;
		const description = (missionDescription || '').trim();
		const path = (projectPath || '').trim() || '.';
		const goals = parseGoals(goalsText || '');

		persistDefaults();

		executionProgress = await missionExecutor.execute(currentNodes, currentConnections, {
			mode: multiLLMEnabled ? 'multi-llm-orchestrator' : 'claude-code',
			name,
			description: description || undefined,
			projectPath: path,
			projectType: (projectType || '').trim() || 'general',
			goals: goals.length ? goals : undefined,
			missionId: relay?.missionId,
			relay,
			orchestratorOptions: getMultiLLMOptions()
		});
	}

	async function handlePause() {
		await missionExecutor.pause();
		executionProgress = missionExecutor.getProgress();
	}

	async function handleResume() {
		await missionExecutor.resume();
		executionProgress = missionExecutor.getProgress();
	}

	async function handleCancel() {
		await missionExecutor.cancel();
		executionProgress = missionExecutor.getProgress();
	}

	async function handleResumePartial() {
		try {
			await missionExecutor.resumePartial();
			executionProgress = missionExecutor.getProgress();
			toasts.success('Resuming pending tasks...');
		} catch (err) {
			toasts.error(`Failed to resume: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	function handleDismissPartial() {
		missionExecutor.stop();
		executionProgress = null;
		logs = [];
		toasts.info('Partial mission dismissed');
	}

	function formatTime(dateStr: string | Date): string {
		const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function getExecutionDuration(): string {
		return formatExecutionDuration(executionProgress?.startTime, executionProgress?.endTime);
	}

	function handleClose() {
		if (!isRunning) {
			missionExecutor.stop();
			persistCanvasStatusSnapshot();
			onClose();
		}
	}
</script>

<!-- Minimized floating widget -->
{#if minimized && (isRunning || isPaused)}
	<button
		onclick={onToggleMinimize}
		class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-bg-secondary border border-surface-border rounded-lg shadow-lg hover:border-accent-primary transition-all group"
	>
		<div class="relative">
			{#if isRunning}
				<div class="w-3 h-3 bg-vibe-teal animate-pulse"></div>
				<div class="absolute inset-0 w-3 h-3 bg-vibe-teal/50 animate-ping"></div>
			{:else if isPaused}
				<div class="w-3 h-3 bg-blue-400"></div>
			{/if}
		</div>
		<div class="text-left">
			<p class="text-xs font-mono text-text-tertiary">WORKFLOW</p>
			<p class="text-sm text-text-primary">{executionProgress?.progress || 0}% - {executionProgress?.currentTaskName || 'Running'}</p>
		</div>
		<svg class="w-4 h-4 text-text-tertiary group-hover:text-accent-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
		</svg>
	</button>
{:else}
<div
	class="fixed z-50 transition-all duration-300 ease-out"
	class:inset-0={!minimized}
	class:right-0={minimized}
	class:top-0={minimized}
	class:bottom-0={minimized}
	class:w-96={minimized}
	role="dialog"
	aria-modal={!minimized ? 'true' : undefined}
>
	{#if !minimized}
		<button class="absolute inset-0 bg-black/50" onclick={handleClose} aria-label="Close execution panel"></button>
	{/if}
	<div
		class="relative bg-bg-secondary border-l border-surface-border flex flex-col h-full overscroll-contain"
		class:max-w-4xl={!minimized}
		class:mx-auto={!minimized}
		class:my-8={!minimized}
		class:max-h-[calc(100vh-4rem)]={!minimized}
		class:overflow-y-auto={!minimized}
		class:overflow-x-hidden={!minimized}
		class:border={!minimized}
	>
		<!-- Header -->
		<div class="flex items-center justify-between px-6 py-5 border-b border-surface-border">
			<div class="flex items-center gap-4">
				<div class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent-primary text-accent-fg">
					{#if isRunning}
						<span class="relative flex h-2 w-2">
							<span class="absolute inline-flex h-full w-full rounded-full bg-accent-fg opacity-60 animate-ping-slow"></span>
							<span class="relative inline-flex rounded-full h-2 w-2 bg-accent-fg"></span>
						</span>
					{/if}
					<span class="text-sm font-mono uppercase tracking-widest font-semibold">Execution</span>
				</div>
				{#if executionProgress}
					<span class="text-base font-mono font-medium {getStatusColor(executionProgress.status)}">
						{executionProgress.status}
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-1">
				{#if (isRunning || isPaused) && onToggleMinimize}
					<button
						onclick={onToggleMinimize}
						class="p-2 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface transition-all"
						title="Minimize to see canvas"
						aria-label="Minimize execution panel"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
				{/if}
				<button onclick={handleClose} class="p-2 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface transition-all" disabled={isRunning} aria-label="Close execution panel">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>


		<!-- Resume Banner (shown when there's a saved mission) -->
		{#if showResumeBanner && resumableMission}
			<div class="p-3 bg-blue-500/10 border-b border-blue-500/30">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
							<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
							</svg>
						</div>
						<div>
							<p class="text-sm font-medium text-text-primary">Previous Mission Found</p>
							<p class="text-xs text-text-secondary">
								<span class="font-mono text-blue-400">{resumableMission.name}</span>
								 - {resumableMission.progress}% complete
								{#if resumableMission.status === 'paused'}
									<span class="ml-1 text-blue-400">(Paused)</span>
								{:else if resumableMission.status === 'running'}
									<span class="ml-1 text-status-warning">(Interrupted)</span>
								{/if}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<button
							onclick={continueResumableMission}
							class="px-3 py-1.5 text-xs font-mono bg-blue-500 text-white hover:bg-blue-600 transition-all"
						>
							Continue
						</button>
						<button
							onclick={dismissResumeBanner}
							class="px-3 py-1.5 text-xs font-mono text-text-secondary border border-surface-border hover:border-text-tertiary rounded-md transition-all"
						>
							Dismiss
						</button>
					</div>
				</div>
			</div>
		{/if}
		<!-- Progress -->
		{#if executionProgress}
			<div class="px-6 py-5 border-b border-surface-border">
				<ExecutionProgressHeader
					{executionProgress}
					nodeCount={currentNodes.length}
					executionDuration={getExecutionDuration()}
					mcpConnectedCount={$mcpRuntime.connectedCount}
					mcpTools={$mcpRuntime.tools}
					{runtimeAgents}
					currentTaskSkills={getCurrentTaskSkills(executionProgress)}
					bind:mcpDetailOpen
					bind:multiLLMPanelCollapsed
					bind:copyPromptCollapsed
					{copyToClipboard}
				/>

				<ExecutionTaskStatusList
					taskRows={taskRows}
					reworkTasks={reworkTasks}
					status={executionProgress.status}
					isRunning={isRunning}
					reconciliation={executionProgress.reconciliation}
					error={executionProgress.error}
					nodeCount={currentNodes.length}
					executionDuration={getExecutionDuration()}
					onResumePartial={handleResumePartial}
					onDismissPartial={handleDismissPartial}
				/>
			</div>
		{/if}

		{#if executionProgress && recentTaskTransitions.length > 0}
			<div class="px-4 py-3 border-b border-surface-border bg-bg-secondary">
				<div class="mb-2 flex items-center justify-between gap-3">
					<div class="flex items-center gap-2">
						<div class="h-2 w-2 bg-vibe-teal animate-pulse"></div>
						<span class="text-xs font-mono text-text-secondary uppercase tracking-wider">Build Activity</span>
					</div>
					<span class="text-[10px] font-mono text-text-tertiary">
						{recentTaskTransitions.length} checkpoint{recentTaskTransitions.length === 1 ? '' : 's'}
					</span>
				</div>
				<div class="grid gap-1.5">
					{#each recentTaskTransitions.slice(0, 5) as item}
						<div class="border border-surface-border bg-bg-primary px-3 py-2">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<span class="px-1.5 py-0.5 text-[10px] font-mono uppercase {getTransitionBadge(item.state)}">
											{item.state}
										</span>
										{#if item.agentLabel}
											<span class="text-[10px] font-mono text-vibe-teal">{item.agentLabel}</span>
										{/if}
										{#if item.taskName}
											<span class="truncate text-xs font-mono text-text-primary">{item.taskName}</span>
										{/if}
									</div>
									<div class="mt-1 text-xs text-text-secondary break-words">{item.message}</div>
								</div>
								<div class="shrink-0 text-right">
									<div class="text-[10px] font-mono text-text-tertiary">{formatTime(item.timestamp)}</div>
									{#if typeof item.progress === 'number'}
										<div class="mt-1 text-[10px] font-mono text-vibe-teal">{item.progress}%</div>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<ExecutionLogList logs={logs} isRunning={isRunning} status={executionProgress?.status} />

		{#if !isRunning && !isPaused}
			<MissionSettingsPanel
				bind:showMissionSettings
				bind:missionName
				bind:missionDescription
				bind:projectPath
				bind:projectType
				bind:goalsText
				bind:multiLLMEnabled
				bind:multiLLMStrategy
				bind:multiLLMPrimaryProviderId
				bind:multiLLMAutoEnableByKeys
				bind:multiLLMAutoRouteByTask
				bind:multiLLMAutoDispatch
				bind:showAdvancedMultiLLM
				{multiLLMApiKeys}
				{serverProviderKeyPresence}
				{connectedMcpCapabilities}
				{connectedMcpToolCount}
				{multiLLMProviders}
				{hasDualProviderKeys}
				{getExecutionMode}
				{setExecutionMode}
				{toggleMultiLLMProvider}
				{updateMultiLLMProviderModel}
				{updateMultiLLMApiKey}
				{persistDefaults}
			/>
		{/if}

		<ExecutionFooter
			{executionProgress}
			{isRunning}
			{isPaused}
			{isTerminal}
			{canCancel}
			{canPause}
			{canResume}
			{canRun}
			currentNodeCount={currentNodes.length}
			{formatTime}
			onCancel={handleCancel}
			onPause={handlePause}
			onResume={handleResume}
			onClose={handleClose}
			onRun={runWorkflow}
		/>
	</div>
</div>
{/if}

<!-- Orphan Node Warning Modal -->
{#if showOrphanWarning && orphanedNodes.length > 0}
	<div class="fixed inset-0 flex items-center justify-center z-[60]" role="dialog" aria-modal="true" aria-label="Orphan node warning">
		<button class="absolute inset-0 bg-black/60" onclick={() => (showOrphanWarning = false)} aria-label="Close orphan warning"></button>
		<div class="relative bg-bg-secondary border border-surface-border w-full max-w-md p-6">
			<!-- Warning Icon & Title -->
			<div class="flex items-center gap-3 mb-4">
				<div class="w-10 h-10 bg-status-warning/20 border border-status-warning/30 flex items-center justify-center">
					<svg class="w-6 h-6 text-status-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
					</svg>
				</div>
				<div>
					<h3 class="font-serif text-lg text-text-primary">Disconnected Nodes</h3>
					<p class="text-sm text-text-secondary">{orphanedNodes.length} node{orphanedNodes.length > 1 ? 's are' : ' is'} not connected</p>
				</div>
			</div>

			<!-- Orphaned Node List -->
			<div class="mb-5 p-3 bg-bg-tertiary border border-surface-border">
				<p class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">Disconnected:</p>
				<ul class="space-y-1">
					{#each orphanedNodes as node}
						<li class="flex items-center gap-2 text-sm text-text-secondary">
							<span class="w-2 h-2 bg-amber-400"></span>
							<span class="font-mono">{node.skill.name}</span>
						</li>
					{/each}
				</ul>
			</div>

			<!-- Question -->
			<p class="text-sm text-text-secondary mb-5">
				Would you like to proceed? You can auto-connect these nodes or view the canvas to connect them manually.
			</p>

			<!-- Action Buttons -->
			<div class="flex flex-col gap-2">
				<!-- Auto-connect Option (Primary) -->
				<button
					onclick={autoConnectOrphans}
					class="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-mono bg-accent-primary text-bg-primary rounded-md hover:bg-accent-primary-hover transition-all"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
					</svg>
					Auto-Connect Nodes
				</button>

				<!-- View on Canvas Option -->
				<button
					onclick={handleViewOnCanvas}
					class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-mono text-text-secondary border border-surface-border hover:border-text-tertiary rounded-md transition-all"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
					</svg>
					View on Canvas
				</button>

				<!-- Proceed Anyway Option -->
				<button
					onclick={proceedWithOrphans}
					class="w-full px-4 py-2 text-sm font-mono text-text-tertiary hover:text-text-secondary transition-all"
				>
					Proceed Anyway
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Checkpoint Review Modal -->
{#if showCheckpointReview && missionCheckpoint}
	<div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
		<div class="w-full max-w-5xl max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain mx-4 border border-surface-border">
			<CheckpointReview
				checkpoint={missionCheckpoint}
				onVerify={() => {
					showCheckpointReview = false;
					toasts.success('Checkpoint verified — mission approved');
				}}
				onReject={() => {
					showCheckpointReview = false;
					toasts.warning('Checkpoint rejected — review needed');
				}}
			/>
		</div>
	</div>
{/if}
