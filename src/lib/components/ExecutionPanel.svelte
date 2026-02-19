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
	import { nodes, connections, updateNodeStatus, resetAllNodeStatus, addConnection } from '$lib/stores/canvas.svelte';
	import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';
	import { isConnected } from '$lib/stores/mcp.svelte';
	import { mcpRuntime } from '$lib/services/mcp-runtime';
	import type { MultiLLMCapability, MultiLLMMCPTool } from '$lib/services/multi-llm-orchestrator';
	import { toasts } from '$lib/stores/toast.svelte';
	import { getPreMissionContext, type PreMissionContext, type PatternSuggestion } from '$lib/services/pre-mission-context';
	import { reinforceMission } from '$lib/services/learning-reinforcement';
	import { validateForMission } from '$lib/services/mission-builder';
	import {
		createDefaultMultiLLMOptions,
		type MultiLLMOrchestratorOptions,
		type MultiLLMProviderConfig,
		type MultiLLMStrategy
	} from '$lib/services/multi-llm-orchestrator';
	import PreMissionContextPanel from './PreMissionContextPanel.svelte';
	import PostMissionReview from './PostMissionReview.svelte';
	import CheckpointReview from './CheckpointReview.svelte';
	import MidMissionGuidance from './MidMissionGuidance.svelte';
	import type { ProjectCheckpoint } from '$lib/services/checkpoint';
	import { isMemoryConnected } from '$lib/stores/memory-settings.svelte';
	import { memoryClient } from '$lib/services/memory-client';
	import { browser } from '$app/environment';

	interface Props {
		onClose: () => void;
		minimized?: boolean;
		onToggleMinimize?: () => void;
		autoRunToken?: number;
	}

	let { onClose, minimized = false, onToggleMinimize, autoRunToken }: Props = $props();

	let currentNodes = $state<CanvasNode[]>([]);
	let currentConnections = $state<Connection[]>([]);
	let executionProgress = $state<ExecutionProgress | null>(null);
	let logs = $state<MissionLog[]>([]);
	let logsContainer = $state<HTMLDivElement | undefined>(undefined);
	let mcpConnected = $state(false);

	// Pre-mission context state
	let preMissionContext = $state<PreMissionContext | null>(null);
	let contextLoading = $state(false);
	let contextCollapsed = $state(false);
	let memoryConnected = $state(false);

	// Post-mission review state
	let showReview = $state(false);
	let completedMission = $state<Mission | null>(null);
	let missionStartTime = $state<Date | null>(null);
	let missionEndTime = $state<Date | null>(null);

	// Checkpoint review state
	let showCheckpointReview = $state(false);
	let missionCheckpoint = $state<ProjectCheckpoint | null>(null);

	// Mid-mission guidance state
	let guidanceCollapsed = $state(true);
	let currentSkillId = $state<string | undefined>(undefined);
	let currentAgentId = $state<string | undefined>(undefined);

	// Orphan node warning state
	let showOrphanWarning = $state(false);
	let orphanedNodes = $state<CanvasNode[]>([]);

	// Task tracking for completion summary
	let completedTasks = $state<string[]>([]);
	let failedTasks = $state<string[]>([]);
	let pendingTasks = $state<string[]>([]);
	let reworkTasks = $state<Map<string, { name: string; retry: number; maxRetries: number }>>(new Map());
	let mindLogsCount = $state(0);

	// Tab state - workflow vs mind
	let activeTab = $state<'workflow' | 'mind'>('workflow');

	// Mind activity tracking - all Mind categories supported
	interface MindActivity {
		id: string;
		type: 'decision' | 'learning' | 'pattern' | 'progress' | 'issue' | 'session' | 'improvement';
		content: string;
		timestamp: Date;
		taskName?: string;
	}
	let mindActivities = $state<MindActivity[]>([]);

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
	let showMissionSettings = $state(true);
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
	let isDispatching = $state(false);
	let dispatchStatus = $state<Record<string, string>>({});
	let connectedMcpCapabilities = $state<MultiLLMCapability[]>([]);
	let connectedMcpTools = $state<MultiLLMMCPTool[]>([]);
	let connectedMcpToolCount = $state(0);
	let multiLLMProviders = $state<MultiLLMProviderConfig[]>(
		defaultMultiLLMOptions.providers.map((provider) => ({ ...provider }))
	);

	// Guard to ensure mount-only effects run once
	let hasCheckedResumable = $state(false);
	let lastHandledAutoRunToken = $state<number | null>(null);

	// Derived states
	let isRunning = $derived(executionProgress?.status === 'running' || executionProgress?.status === 'creating');
	let isPaused = $derived(executionProgress?.status === 'paused');
	let canPause = $derived(executionProgress?.status === 'running');
	let canResume = $derived(executionProgress?.status === 'paused');
	let canCancel = $derived(isRunning || isPaused);
	// Note: MCP not required anymore - we build missions locally and run directly by default (copy prompt is fallback)
	let canRun = $derived(!isRunning && !isPaused && currentNodes.length > 0);
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

	function getMultiLLMOptions(): MultiLLMOrchestratorOptions {
		const keyPresence = Object.fromEntries(
			multiLLMProviders.map((provider) => [provider.id, Boolean((multiLLMApiKeys[provider.id] || '').trim())])
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

	function hasProviderApiKey(providerId: string): boolean {
		return Boolean((multiLLMApiKeys[providerId] || '').trim());
	}

	function hasDualProviderKeys(): boolean {
		return hasProviderApiKey('claude') && hasProviderApiKey('codex');
	}

	function prepareDualProviderRunIfReady() {
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
		const unsub4 = isMemoryConnected.subscribe((connected) => (memoryConnected = connected));
		const unsub5 = mcpRuntime.subscribe((runtime) => {
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
			unsub5();
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

	// Load persisted mission defaults once (browser only)
	$effect(() => {
		if (defaultsLoaded) return;
		defaultsLoaded = true;
		if (!browser) return;
		loadMultiLLMApiKeys();
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

	function getCurrentTaskSkills(progress: ExecutionProgress | null): LoadedSkillInfo[] {
		if (!isRunning || !progress?.loadedSkills || !progress.currentTaskId) {
			return [];
		}
		const currentTaskId = progress.currentTaskId;
		return progress.loadedSkills.filter((skill) => skill.taskIds.includes(currentTaskId));
	}

	// Fetch pre-mission context when panel opens and nodes exist
	// Guard prevents multiple fetches - only fetch once when conditions are first met
	let hasAttemptedContextFetch = $state(false);
	$effect(() => {
		if (hasAttemptedContextFetch) return;
		if (currentNodes.length > 0 && memoryConnected && !executionProgress) {
			hasAttemptedContextFetch = true;
			fetchContext();
		}
	});

	async function fetchContext() {
		if (contextLoading || currentNodes.length === 0) return;

		contextLoading = true;
		try {
			// Build goal description from node names
			const goalDescription = currentNodes.map(n => n.skill.name).join(', ');
			preMissionContext = await getPreMissionContext(goalDescription, currentNodes);
		} catch (error) {
			console.error('[ExecutionPanel] Failed to fetch context:', error);
		} finally {
			contextLoading = false;
		}
	}

	function handleApplyPattern(pattern: PatternSuggestion) {
		// For now, just show a toast - in future could auto-arrange nodes
		toasts.info(`Pattern applied: ${pattern.content.slice(0, 50)}...`);
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
	function checkWorkflowBeforeRun(): boolean {
		const validation = validateForMission(currentNodes, currentConnections);

		// Check for blocking errors first (circular deps, empty canvas)
		if (validation.errors.length > 0) {
			toasts.error(`Validation failed: ${validation.errors.join(', ')}`);
			return false;
		}

		// Check for orphan warnings - show prompt but allow proceeding
		const orphans = findOrphanedNodes();
		if (orphans.length > 0) {
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

	// Auto-scroll logs
	$effect(() => {
		if (logs.length > 0 && logsContainer) {
			logsContainer.scrollTop = logsContainer.scrollHeight;
		}
	});

	// Cleanup on unmount
	$effect(() => {
		return () => {
			missionExecutor.stop();
		};
	});

	/**
	 * Entry point for running workflow - validates first
	 */
	function runWorkflow() {
		if (!checkWorkflowBeforeRun()) {
			return; // Validation failed, warning shown
		}
		executeWorkflow();
	}

	$effect(() => {
		if (!autoRunToken) return;
		if (autoRunToken === lastHandledAutoRunToken) return;
		if (isRunning || isPaused || currentNodes.length === 0) return;
		lastHandledAutoRunToken = autoRunToken;
		runWorkflow();
	});

	/**
	 * Log progress to Mind and track activity for UI
	 * Supports all Mind activity types: progress, decision, learning, issue, session, improvement, pattern
	 */
	async function logToMind(
		type: 'progress' | 'decision' | 'learning' | 'issue' | 'session' | 'improvement' | 'pattern',
		message: string,
		taskName?: string
	) {
		// Track activity for UI regardless of Mind connection
		const activity: MindActivity = {
			id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			type,
			content: message,
			timestamp: new Date(),
			taskName
		};
		mindActivities = [...mindActivities, activity];

		if (!memoryConnected) return;
		try {
			// Map activity types to appropriate Mind content types
			const patternType = type === 'learning' ? 'success' : type === 'issue' ? 'failure' : 'optimization';

			await memoryClient.recordLearning('spawner-ui', {
				content: message,
				missionId: executionProgress?.missionId || undefined,
				patternType,
				confidence: 0.8
			});
			mindLogsCount++;
		} catch (e) {
			console.error('[ExecutionPanel] Failed to log to Mind:', e);
		}
	}

	/**
	 * Actually execute the workflow (called after validation passes)
	 */
	async function executeWorkflow() {
		logs = [];
		resetAllNodeStatus();
		prepareDualProviderRunIfReady();

		// Reset review state
		showReview = false;
		completedMission = null;
		missionStartTime = new Date();
		missionEndTime = null;

		// Reset task tracking
		completedTasks = [];
		failedTasks = [];
		pendingTasks = currentNodes.map(n => n.skill.name);
		reworkTasks = new Map();
		mindLogsCount = 0;
		mindActivities = [];

		// Track task outcomes for reinforcement
		const taskOutcomes: Record<string, boolean> = {};

		// Log mission start to Mind
		logToMind('progress', `Starting workflow execution with ${currentNodes.length} tasks: ${currentNodes.map(n => n.skill.name).join(', ')}`);

		// Set up callbacks
		missionExecutor.setCallbacks({
			onStatusChange: (status) => {
				executionProgress = missionExecutor.getProgress();
				// Log status changes to Mind
				if (status === 'running') {
					logToMind('progress', 'Workflow execution started');
				} else if (status === 'paused') {
					logToMind('progress', 'Workflow execution paused');
				}
			},
			onProgress: (progress) => {
				executionProgress = missionExecutor.getProgress();
			},
			onTaskProgress: (taskId, progress, message) => {
				// Update task-level progress for smoother UI updates
				currentTaskProgress = progress;
				currentTaskMessage = message || null;
				executionProgress = missionExecutor.getProgress();
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
				const node = currentNodes.find(n => n.skill.name === taskName || n.id === taskId);
				if (node) {
					updateNodeStatus(node.id, 'running');
					// Update skill/agent IDs for mid-mission guidance
					currentSkillId = node.skill.id;
					currentAgentId = node.skill.id; // Use skill as agent proxy

					// Remove from pending, update UI
					pendingTasks = pendingTasks.filter(t => t !== taskName);

					// Log to Mind with task context
					logToMind('decision', `Executing skill: ${taskName}`, taskName);
				}

				// Update executionProgress to reflect new current task name
				executionProgress = missionExecutor.getProgress();
			},
			onTaskComplete: (taskId, success) => {
				// Track outcome for reinforcement
				taskOutcomes[taskId] = success;

				// Find the node and update its status
				const node = currentNodes.find(n => n.id === taskId);
				const taskName = node?.skill.name || taskId;
				if (node) {
					updateNodeStatus(node.id, success ? 'success' : 'error');
				}

				// Clear rework state if task is now truly done
				reworkTasks.delete(taskId);
				reworkTasks = new Map(reworkTasks);

				// Update tracking
				if (success) {
					completedTasks = [...completedTasks, taskName];
					logToMind('learning', `Task completed successfully: ${taskName}`, taskName);
				} else {
					failedTasks = [...failedTasks, taskName];
					logToMind('learning', `Task failed: ${taskName}`, taskName);
				}

				// Update executionProgress to reflect task completion
				executionProgress = missionExecutor.getProgress();
			},
			onTaskRework: (taskId, taskName, retryNumber, maxRetries) => {
				// Track rework state for UI badges
				const node = currentNodes.find(n => n.id === taskId);
				if (node) {
					updateNodeStatus(node.id, 'idle'); // Reset to idle — task is back to pending
				}
				reworkTasks.set(taskId, { name: taskName, retry: retryNumber, maxRetries });
				reworkTasks = new Map(reworkTasks);
				logToMind('issue', `Task rework required: ${taskName} (retry ${retryNumber}/${maxRetries})`, taskName);
				executionProgress = missionExecutor.getProgress();
			},
			onComplete: async (mission) => {
				executionProgress = missionExecutor.getProgress();
				missionEndTime = new Date();
				completedMission = mission;

				// Clear pending tasks
				pendingTasks = [];

				// Update node statuses based on ACTUAL task status, not blanket success
				if (mission.tasks) {
					for (const task of mission.tasks) {
						const node = currentNodes.find(n => n.id === task.id);
						if (node) {
							if (task.status === 'completed') {
								updateNodeStatus(node.id, 'success');
							} else if (task.status === 'failed') {
								updateNodeStatus(node.id, 'error');
							} else {
								// Task never started or still pending — mark as idle (not success)
								updateNodeStatus(node.id, 'idle');
							}
						}
					}
				}

				// Show checkpoint review if available
				if (executionProgress?.checkpoint) {
					missionCheckpoint = executionProgress.checkpoint;
					showCheckpointReview = true;
				}

				// Log completion to Mind with summary
				const duration = missionEndTime.getTime() - (missionStartTime?.getTime() || 0);
				const durationStr = duration < 60000 ? `${Math.round(duration / 1000)}s` : `${Math.round(duration / 60000)}m`;
				logToMind('learning', `Workflow completed successfully in ${durationStr}. Completed ${completedTasks.length} tasks: ${completedTasks.join(', ')}`);

				// Run reinforcement if memory is connected
				if (memoryConnected) {
					try {
						const result = await reinforceMission(mission.id, taskOutcomes);
						console.log('[ExecutionPanel] Reinforcement result:', result);
					} catch (error) {
						console.error('[ExecutionPanel] Reinforcement failed:', error);
					}
				}

				toasts.success('Workflow completed successfully', {
					label: 'View Review',
					onClick: () => {
						showReview = true;
					}
				});
			},
			onError: async (error) => {
				executionProgress = missionExecutor.getProgress();
				missionEndTime = new Date();

				// Log failure to Mind
				logToMind('learning', `Workflow failed: ${error}. Completed ${completedTasks.length}/${currentNodes.length} tasks before failure.`);

				// Still run reinforcement for partial results
				if (memoryConnected && executionProgress?.missionId) {
					try {
						await reinforceMission(executionProgress.missionId, taskOutcomes);
					} catch (e) {
						console.error('[ExecutionPanel] Reinforcement failed:', e);
					}
				}

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

	function getLogColor(type: MissionLog['type']): string {
		switch (type) {
			case 'complete':
				return 'text-accent-primary';
			case 'error':
				return 'text-red-400';
			case 'handoff':
				return 'text-yellow-400';
			case 'start':
			case 'progress':
			default:
				return 'text-text-secondary';
		}
	}

	function getLogIcon(type: MissionLog['type']): string {
		switch (type) {
			case 'complete':
				return '■';  // Sharp square checkmark style
			case 'error':
				return '✕';  // Sharp X
			case 'handoff':
				return '▸';  // Sharp arrow
			case 'start':
				return '▶';
			case 'progress':
			default:
				return '▪';  // Small sharp square
		}
	}

	function formatTime(dateStr: string | Date): string {
		const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function getStatusColor(status: ExecutionStatus): string {
		switch (status) {
			case 'completed':
				return 'text-accent-primary';
			case 'failed':
				return 'text-red-400';
			case 'running':
			case 'creating':
				return 'text-vibe-teal';
			case 'paused':
				return 'text-blue-400';
			case 'cancelled':
				return 'text-gray-400';
			default:
				return 'text-text-secondary';
		}
	}

	function getAgentStatusColor(status: AgentRuntimeStatus['status']): string {
		switch (status) {
			case 'running':
				return 'text-vibe-teal border-vibe-teal/40 bg-vibe-teal/10';
			case 'completed':
				return 'text-green-400 border-green-500/30 bg-green-500/10';
			case 'failed':
				return 'text-red-400 border-red-500/30 bg-red-500/10';
			case 'cancelled':
				return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
			default:
				return 'text-text-tertiary border-surface-border bg-bg-tertiary';
		}
	}

	function getTransitionBadge(state: TaskTransitionEvent['state']): string {
		switch (state) {
			case 'started':
				return 'bg-blue-500/20 text-blue-300';
			case 'progress':
				return 'bg-vibe-teal/20 text-vibe-teal';
			case 'completed':
				return 'bg-green-500/20 text-green-300';
			case 'failed':
				return 'bg-red-500/20 text-red-300';
			case 'cancelled':
				return 'bg-amber-500/20 text-amber-300';
			case 'handoff':
				return 'bg-purple-500/20 text-purple-300';
			default:
				return 'bg-surface text-text-secondary';
		}
	}

	function getExecutionDuration(): string {
		if (!executionProgress?.startTime) return '0s';
		const end = executionProgress.endTime || new Date();
		const durationMs = end.getTime() - executionProgress.startTime.getTime();
		if (durationMs < 1000) return `${durationMs}ms`;
		const seconds = Math.floor(durationMs / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	}

	function handleClose() {
		if (!isRunning) {
			missionExecutor.stop();
			// Reset all node statuses when closing panel (prevents "stuck" visual states)
			resetAllNodeStatus();
			onClose();
		}
	}
</script>

<!-- Minimized floating widget -->
{#if minimized && (isRunning || isPaused)}
	<button
		onclick={onToggleMinimize}
		class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-bg-secondary border border-surface-border shadow-lg hover:border-accent-primary transition-all group"
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
		class="relative bg-bg-secondary border-l border-surface-border flex flex-col h-full"
		class:max-w-2xl={!minimized}
		class:mx-auto={!minimized}
		class:my-auto={!minimized}
		class:max-h-[80vh]={!minimized}
		class:inset-y-[10vh]={!minimized}
		class:border={!minimized}
	>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-surface-border">
			<div class="flex items-center gap-4">
				<!-- Tab Selector -->
				<div class="flex bg-bg-tertiary border border-surface-border">
					<button
						onclick={() => activeTab = 'workflow'}
						class="px-4 py-1.5 text-xs font-mono uppercase tracking-wider transition-all {activeTab === 'workflow' ? 'bg-accent-primary text-bg-primary' : 'text-text-secondary hover:text-text-primary'}"
					>
						Workflow
					</button>
					<button
						onclick={() => activeTab = 'mind'}
						class="px-4 py-1.5 text-xs font-mono uppercase tracking-wider transition-all flex items-center gap-2 {activeTab === 'mind' ? 'bg-purple-500 text-white' : 'text-text-secondary hover:text-text-primary'}"
					>
						Mind
						{#if mindActivities.length > 0}
							<span class="w-5 h-5 flex items-center justify-center text-[10px] {activeTab === 'mind' ? 'bg-white/20' : 'bg-purple-500/20 text-purple-400'}">
								{mindActivities.length}
							</span>
						{/if}
					</button>
				</div>
				{#if executionProgress}
					<span class="text-sm font-mono {getStatusColor(executionProgress.status)}">
						{executionProgress.status.toUpperCase()}
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				<!-- Minimize button - shown when running -->
				{#if (isRunning || isPaused) && onToggleMinimize}
					<button
						onclick={onToggleMinimize}
						class="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface transition-all"
						title="Minimize to see canvas"
						aria-label="Minimize execution panel"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
				{/if}
				<button onclick={handleClose} class="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-surface transition-all" disabled={isRunning} aria-label="Close execution panel">
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
									<span class="ml-1 text-yellow-400">(Interrupted)</span>
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
							class="px-3 py-1.5 text-xs font-mono text-text-secondary border border-surface-border hover:border-text-tertiary transition-all"
						>
							Dismiss
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Tab Content -->
		{#if activeTab === 'workflow'}
		<!-- Progress -->
		{#if executionProgress}
			<div class="p-4 border-b border-surface-border">
				<!-- Overall Progress -->
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-text-secondary">Overall Progress</span>
					<span class="text-sm font-mono text-text-primary">{executionProgress.progress}%</span>
				</div>
				<div class="w-full h-2 bg-surface overflow-hidden">
					<div
						class="h-full transition-all duration-300"
						class:bg-accent-primary={executionProgress.status === 'completed'}
						class:bg-yellow-500={executionProgress.status === 'partial'}
						class:bg-vibe-teal={executionProgress.status === 'running' || executionProgress.status === 'creating'}
						class:bg-blue-500={executionProgress.status === 'paused'}
						class:bg-red-500={executionProgress.status === 'failed'}
						class:bg-gray-500={executionProgress.status === 'cancelled'}
						style="width: {executionProgress.progress}%"
					></div>
				</div>

				<!-- Current Task Progress (shown during running) -->
				{#if isRunning && executionProgress.currentTaskName}
					<div class="mt-3 p-3 bg-vibe-teal/5 border border-vibe-teal/30">
						<div class="flex items-center justify-between mb-1">
							<span class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Current Task</span>
							<span class="text-xs font-mono text-vibe-teal">{currentTaskProgress}%</span>
						</div>
						<div class="flex items-center gap-2 mb-2">
							<div class="relative">
								<div class="w-2 h-2 bg-vibe-teal"></div>
								<div class="absolute inset-0 w-2 h-2 bg-vibe-teal animate-ping opacity-75"></div>
							</div>
							<span class="text-sm text-text-primary font-medium">{executionProgress.currentTaskName}</span>
						</div>
						<!-- Task progress bar -->
						<div class="w-full h-1.5 bg-surface overflow-hidden">
							<div
								class="h-full bg-vibe-teal transition-all duration-200"
								style="width: {currentTaskProgress}%"
							></div>
						</div>
						{#if currentTaskMessage}
							<p class="mt-2 text-xs text-text-tertiary italic">{currentTaskMessage}</p>
						{/if}
					</div>
				{/if}

				{#if runtimeAgents.length > 0}
					<div class="mt-3 border border-surface-border">
						<div class="px-3 py-2 bg-bg-tertiary border-b border-surface-border text-xs font-mono text-text-tertiary uppercase tracking-wider">
							Live Agent Activity
						</div>
						<div class="divide-y divide-surface-border bg-bg-primary">
							{#each runtimeAgents as agent}
								<div class="px-3 py-2 text-xs">
									<div class="flex items-center justify-between gap-2">
										<div class="font-mono text-text-primary">{agent.label}</div>
										<span class="px-1.5 py-0.5 border font-mono uppercase text-[10px] {getAgentStatusColor(agent.status)}">{agent.status}</span>
									</div>
									<div class="mt-1 text-text-secondary">
										{agent.currentTaskName || 'Waiting for task'}
									</div>
									<div class="mt-1 h-1 bg-surface overflow-hidden">
										<div class="h-full bg-vibe-teal transition-all duration-200" style="width: {Math.max(0, Math.min(100, agent.progress || 0))}%"></div>
									</div>
									{#if agent.message}
										<div class="mt-1 text-[11px] text-text-tertiary italic">{agent.message}</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if recentTaskTransitions.length > 0}
					<div class="mt-3 border border-surface-border bg-bg-primary">
						<div class="px-3 py-2 bg-bg-tertiary border-b border-surface-border flex items-center justify-between">
							<span class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Task Event Stream</span>
							<span class="text-[10px] text-text-tertiary">latest {recentTaskTransitions.length}</span>
						</div>
						<div class="max-h-40 overflow-y-auto divide-y divide-surface-border">
							{#each recentTaskTransitions as transition}
								<div class="px-3 py-2 text-xs">
									<div class="flex items-center gap-2">
										<span class="text-[10px] text-text-tertiary font-mono w-14">{formatTime(transition.timestamp)}</span>
										<span class="px-1.5 py-0.5 text-[10px] font-mono uppercase {getTransitionBadge(transition.state)}">{transition.state}</span>
										{#if transition.agentLabel}
											<span class="text-[10px] text-vibe-teal font-mono">{transition.agentLabel}</span>
										{/if}
										{#if typeof transition.progress === 'number'}
											<span class="text-[10px] text-text-tertiary font-mono">{transition.progress}%</span>
										{/if}
									</div>
									<div class="mt-1 text-text-secondary">{transition.message}</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<div class="flex justify-between mt-2 text-xs text-text-tertiary">
					<span>{currentNodes.length} nodes{#if $mcpRuntime.connectedCount > 0} &bull; <span class="text-accent-primary">{$mcpRuntime.connectedCount} MCP{$mcpRuntime.connectedCount > 1 ? 's' : ''}</span>{/if}</span>
					<span>{getExecutionDuration()}</span>
				</div>
				{#if $mcpRuntime.connectedCount > 0}
					<button
						class="mt-1 text-[10px] font-mono text-text-tertiary hover:text-accent-primary transition-colors text-left"
						onclick={() => mcpDetailOpen = !mcpDetailOpen}
					>
						{mcpDetailOpen ? '\u25BE' : '\u25B8'} {$mcpRuntime.tools.length} tools across {$mcpRuntime.connectedCount} MCP{$mcpRuntime.connectedCount > 1 ? 's' : ''}
					</button>
					{#if mcpDetailOpen}
						<div class="mt-1 pl-2 border-l border-accent-primary/30 space-y-0.5">
							{#each [...new Map($mcpRuntime.tools.map(t => [t.mcpName, t])).keys()] as mcpName}
								{@const tools = $mcpRuntime.tools.filter(t => t.mcpName === mcpName)}
								<div class="text-[10px] font-mono">
									<span class="text-accent-primary">{mcpName}</span>
									<span class="text-text-tertiary">: {tools.map(t => t.toolName).join(', ')}</span>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
				{#if executionProgress?.multiLLMExecution?.enabled}
					{@const multiPack = executionProgress.multiLLMExecution}
					<div class="mt-3 border border-vibe-teal/30">
						<div
							onclick={() => (multiLLMPanelCollapsed = !multiLLMPanelCollapsed)}
							onkeydown={(e) => e.key === 'Enter' && (multiLLMPanelCollapsed = !multiLLMPanelCollapsed)}
							role="button"
							tabindex="0"
							class="w-full flex items-center justify-between px-3 py-2 bg-vibe-teal/10 hover:bg-vibe-teal/15 transition-colors cursor-pointer"
						>
							<div class="flex items-center gap-2">
								<svg class="w-4 h-4 text-vibe-teal transition-transform {multiLLMPanelCollapsed ? '' : 'rotate-90'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
								</svg>
								<span class="text-xs font-mono text-vibe-teal uppercase tracking-wider">Multi-LLM Orchestrator</span>
								<span class="text-[10px] font-mono text-text-tertiary">
									{multiPack.strategy} • {multiPack.providers.length} provider(s)
								</span>
							</div>
							<div class="flex items-center gap-1">
								<button
									class="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-mono transition-all disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={isDispatching}
									onclick={async (e) => {
										e.stopPropagation();
										isDispatching = true;
										dispatchStatus = {};
										try {
											const response = await fetch('/api/dispatch', {
												method: 'POST',
												headers: { 'Content-Type': 'application/json' },
												body: JSON.stringify({
													executionPack: multiPack,
													apiKeys: multiLLMApiKeys,
													workingDirectory: projectPath
												})
											});
											const result = await response.json();
											if (result.success) {
												dispatchStatus = Object.fromEntries(
													Object.entries(result.sessions || {}).map(([id, s]) => [id, (s as {status: string}).status])
												);
											}
										} catch (err) {
											console.error('[Dispatch] Error:', err);
										} finally {
											isDispatching = false;
										}
									}}
								>
									{isDispatching ? 'Dispatching...' : 'Dispatch All'}
								</button>
								<button
									class="px-3 py-1 bg-vibe-teal hover:bg-vibe-teal/90 text-bg-primary text-xs font-mono transition-all"
									onclick={(e) => {
										e.stopPropagation();
										copyToClipboard(
											multiPack.masterPrompt,
											'Master orchestration prompt copied'
										);
									}}
								>
									Copy Master
								</button>
							</div>
						</div>
						{#if !multiLLMPanelCollapsed}
							<div class="p-3 bg-vibe-teal/5 space-y-2">
								{#each multiPack.providers as provider}
									{@const assignment = multiPack.assignments[provider.id]}
									{@const pStatus = dispatchStatus[provider.id]}
									<div class="p-2 border border-surface-border bg-bg-primary {pStatus === 'running' ? 'border-l-2 border-l-yellow-400' : pStatus === 'completed' ? 'border-l-2 border-l-green-400' : pStatus === 'failed' ? 'border-l-2 border-l-red-400' : ''}">
										<div class="flex items-center justify-between gap-2">
											<div class="text-xs">
												<div class="font-mono text-text-primary flex items-center gap-1.5">
													{provider.label} ({provider.id})
													{#if pStatus === 'running'}
														<span class="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
													{:else if pStatus === 'completed'}
														<span class="inline-block w-1.5 h-1.5 rounded-full bg-green-400"></span>
													{:else if pStatus === 'failed'}
														<span class="inline-block w-1.5 h-1.5 rounded-full bg-red-400"></span>
													{/if}
												</div>
												<div class="text-text-tertiary">
													{provider.model} • {assignment?.mode || 'execute'} • {assignment?.taskIds?.length || 0} task(s)
													{#if pStatus}
														<span class="ml-1 {pStatus === 'completed' ? 'text-green-400' : pStatus === 'failed' ? 'text-red-400' : 'text-yellow-400'}">
															[{pStatus}]
														</span>
													{/if}
												</div>
											</div>
											<div class="flex items-center gap-1">
												<button
													onclick={() =>
														copyToClipboard(
															multiPack.providerPrompts[provider.id] || '',
															`Copied ${provider.label} prompt`
														)}
													class="px-2 py-1 text-[10px] font-mono text-text-secondary border border-surface-border hover:border-vibe-teal/60 transition-all"
												>
													Copy Prompt
												</button>
												<button
													onclick={() =>
														copyToClipboard(
															multiPack.launchCommands[provider.id] || '',
															`Copied ${provider.label} launch command`
														)}
													class="px-2 py-1 text-[10px] font-mono text-text-secondary border border-surface-border hover:border-vibe-teal/60 transition-all"
												>
													Copy Launch
												</button>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
				{#if executionProgress?.executionPrompt && !executionProgress?.multiLLMExecution?.enabled}
					<div class="mt-3 border border-accent-primary/30">
						<!-- Collapsible Header -->
						<div
							onclick={() => copyPromptCollapsed = !copyPromptCollapsed}
							onkeydown={(e) => e.key === 'Enter' && (copyPromptCollapsed = !copyPromptCollapsed)}
							role="button"
							tabindex="0"
							class="w-full flex items-center justify-between px-3 py-2 bg-accent-primary/10 hover:bg-accent-primary/15 transition-colors cursor-pointer"
						>
							<div class="flex items-center gap-2">
								<svg class="w-4 h-4 text-accent-primary transition-transform {copyPromptCollapsed ? '' : 'rotate-90'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
								</svg>
								<span class="text-xs font-mono text-accent-primary uppercase tracking-wider">Single-LLM Prompt</span>
							</div>
							<button
								class="px-3 py-1 bg-accent-primary hover:bg-accent-primary-hover text-bg-primary text-xs font-mono transition-all flex items-center gap-2"
								onclick={(e) => {
									e.stopPropagation();
									copyToClipboard(
										executionProgress?.executionPrompt || '',
										'Copied single-LLM prompt'
									);
								}}
							>
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
								</svg>
								Copy
							</button>
						</div>
						<!-- Collapsible Content -->
						{#if !copyPromptCollapsed}
							<div class="p-3 bg-accent-primary/5">
								<div class="max-h-32 overflow-y-auto bg-bg-primary p-2 border border-surface-border text-xs font-mono text-text-secondary select-text">
									<pre class="whitespace-pre-wrap break-all">{(executionProgress?.executionPrompt || '').slice(0, 500)}{(executionProgress?.executionPrompt || '').length > 500 ? '...' : ''}</pre>
								</div>
								<p class="mt-2 text-xs text-text-tertiary">
									Optional fallback only. Direct auto-run does not require copy/paste.
								</p>
							</div>
						{/if}
					</div>
				{:else if executionProgress.missionId}
					<div class="mt-2 p-2 bg-surface-secondary text-xs">
						<div class="flex items-center justify-between gap-2">
							<span class="text-text-tertiary">Mission ID:</span>
							<code class="text-accent-primary font-mono select-all">{executionProgress.missionId}</code>
						</div>
					</div>
				{/if}

				<!-- H70 Skills - Compact with Working Animation -->
				{#if executionProgress?.loadedSkills && executionProgress.loadedSkills.length > 0}
					{@const currentTaskSkills = getCurrentTaskSkills(executionProgress)}
					<div class="mt-3 flex items-center gap-3 px-3 py-2 bg-indigo-500/10 border border-indigo-500/30">
						<!-- Skill Icon with Hammering Animation when active -->
						<div class="relative">
							{#if currentTaskSkills.length > 0}
								<svg class="w-5 h-5 text-indigo-400 animate-[hammer_0.4s_ease-in-out_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
								</svg>
								<!-- Spark effects -->
								<span class="absolute -top-0.5 -right-0.5 w-1 h-1 bg-amber-400 animate-ping"></span>
								<span class="absolute -bottom-0.5 -left-0.5 w-1 h-1 bg-indigo-300 animate-ping" style="animation-delay: 0.2s"></span>
							{:else}
								<svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
								</svg>
							{/if}
						</div>
						<!-- Active Skill Name or Count -->
						<div class="flex-1 flex items-center gap-2">
							{#if currentTaskSkills.length > 0}
								<span class="text-xs font-mono text-indigo-200 font-medium">{currentTaskSkills[0].name}</span>
								<span class="text-xs text-indigo-400/60">working...</span>
							{:else}
								<span class="text-xs font-mono text-indigo-400">{executionProgress.loadedSkills.length} skills loaded</span>
							{/if}
						</div>
						<!-- Skill count badge -->
						<span class="px-2 py-0.5 bg-indigo-500/30 text-xs font-mono text-indigo-300">{executionProgress.loadedSkills.length}</span>
					</div>
				{/if}

				<!-- Task Status Summary -->
				{#if completedTasks.length > 0 || failedTasks.length > 0 || pendingTasks.length > 0}
					<div class="mt-4 border border-surface-border">
						<div class="flex items-center justify-between px-3 py-2 bg-bg-tertiary border-b border-surface-border">
							<span class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Task Status</span>
							{#if mindActivities.length > 0}
								<button
									onclick={() => activeTab = 'mind'}
									class="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors"
								>
									<span class="w-1.5 h-1.5 bg-purple-400"></span>
									<span class="font-mono">{mindActivities.length}</span> Mind events
								</button>
							{/if}
						</div>
						<div class="grid grid-cols-3">
							<div class="p-3 text-center border-r border-surface-border bg-green-500/5">
								<div class="text-2xl font-mono font-bold text-green-400">{completedTasks.length}</div>
								<div class="text-xs font-mono text-green-400/70 uppercase tracking-wider">Completed</div>
							</div>
							<div class="p-3 text-center border-r border-surface-border bg-amber-500/5">
								<div class="text-2xl font-mono font-bold text-amber-400">{pendingTasks.length}</div>
								<div class="text-xs font-mono text-amber-400/70 uppercase tracking-wider">Pending</div>
							</div>
							<div class="p-3 text-center bg-red-500/5">
								<div class="text-2xl font-mono font-bold text-red-400">{failedTasks.length}</div>
								<div class="text-xs font-mono text-red-400/70 uppercase tracking-wider">Failed</div>
							</div>
						</div>
						{#if reworkTasks.size > 0}
							<div class="px-3 py-2 bg-orange-500/5 border-t border-orange-500/20">
								{#each [...reworkTasks.entries()] as [taskId, rework]}
									<div class="flex items-center gap-2 py-0.5">
										<span class="px-1.5 py-0.5 bg-orange-500/20 border border-orange-500/40 text-orange-400 text-[10px] font-mono uppercase tracking-wider">Rework</span>
										<span class="text-xs text-text-primary font-mono">{rework.name}</span>
										<span class="text-[10px] text-orange-400/60 font-mono">retry {rework.retry}/{rework.maxRetries}</span>
									</div>
								{/each}
							</div>
						{/if}
						{#if pendingTasks.length > 0 && isRunning}
							<div class="px-3 py-2 bg-amber-500/5 border-t border-amber-500/20 flex items-center gap-2">
								<span class="text-xs font-mono text-amber-400 uppercase tracking-wider">Next →</span>
								<span class="text-sm text-text-primary font-mono">{pendingTasks[0]}</span>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Completion Summary -->
				{#if executionProgress.status === 'completed'}
					<div class="mt-3 p-3 bg-accent-primary/10 border border-accent-primary/30">
						<div class="flex items-center gap-2 mb-2">
							<div class="w-5 h-5 flex items-center justify-center bg-accent-primary/20 border border-accent-primary/50">
								<svg class="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="3" d="M5 13l4 4L19 7" />
								</svg>
							</div>
							<span class="text-accent-primary font-medium font-mono uppercase tracking-wide text-sm">Workflow Completed</span>
						</div>
						<p class="text-xs text-text-secondary">
							Successfully completed {completedTasks.length} task{completedTasks.length !== 1 ? 's' : ''} in {getExecutionDuration()}.
							{#if memoryConnected}
								{mindLogsCount} events logged to Mind.
							{/if}
						</p>
						{#if !memoryConnected}
							<p class="text-xs text-amber-400 mt-1">
								Connect Mind to save learnings from this workflow.
							</p>
						{/if}
					</div>
				{:else if executionProgress.status === 'partial'}
					<div class="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30">
						<div class="flex items-center gap-2 mb-2">
							<div class="w-5 h-5 flex items-center justify-center bg-yellow-500/20 border border-yellow-500/50">
								<svg class="w-3 h-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.194-.833-2.964 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
								</svg>
							</div>
							<span class="text-yellow-400 font-medium font-mono uppercase tracking-wide text-sm">Mission Partially Complete</span>
						</div>
						{#if executionProgress.reconciliation}
							<p class="text-xs text-text-secondary">
								{executionProgress.reconciliation.completedTasks}/{executionProgress.reconciliation.totalTasks} tasks completed
								{#if executionProgress.reconciliation.failedTasks > 0}
									, {executionProgress.reconciliation.failedTasks} failed
								{/if}
							</p>
							{#if executionProgress.reconciliation.pendingTasks.length > 0}
								<div class="mt-2 text-xs text-yellow-400/70">
									<span class="font-mono uppercase text-[10px] tracking-wider">Incomplete:</span>
									{#each executionProgress.reconciliation.pendingTasks as task}
										<div class="ml-2 mt-0.5 text-text-tertiary">- {task.title} <span class="text-yellow-400/50">({task.status})</span></div>
									{/each}
								</div>
								<div class="mt-3 flex gap-2">
									<button
										class="px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-xs font-mono uppercase tracking-wider hover:bg-yellow-500/30 transition-colors"
										onclick={handleResumePartial}
									>
										Resume {executionProgress.reconciliation.pendingTasks.length} Pending Task{executionProgress.reconciliation.pendingTasks.length !== 1 ? 's' : ''}
									</button>
									<button
										class="px-3 py-1.5 bg-surface-secondary border border-surface-border text-text-secondary text-xs font-mono uppercase tracking-wider hover:bg-surface-hover transition-colors"
										onclick={handleDismissPartial}
									>
										Dismiss
									</button>
								</div>
							{/if}
						{:else}
							<p class="text-xs text-text-secondary">
								Agent reported completion but some tasks were not finished.
							</p>
						{/if}
					</div>
				{:else if executionProgress.status === 'failed'}
					<div class="mt-3 p-3 bg-red-500/10 border border-red-500/30">
						<div class="flex items-center gap-2 mb-2">
							<div class="w-5 h-5 flex items-center justify-center bg-red-500/20 border border-red-500/50">
								<svg class="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="3" d="M6 6l12 12M6 18L18 6" />
								</svg>
							</div>
							<span class="text-red-400 font-medium font-mono uppercase tracking-wide text-sm">Workflow Failed</span>
						</div>
						<p class="text-xs text-text-secondary">
							Completed {completedTasks.length} of {currentNodes.length} tasks before failure.
							{#if executionProgress.error}
								<br/>Error: {executionProgress.error}
							{/if}
						</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Pre-Mission Context (Mind Suggestions) -->
		{#if memoryConnected && !isRunning && !isPaused}
			<div class="border-b border-surface-border">
				<PreMissionContextPanel
					context={preMissionContext}
					loading={contextLoading}
					collapsed={contextCollapsed}
					onToggle={() => (contextCollapsed = !contextCollapsed)}
					onApplyPattern={handleApplyPattern}
				/>
			</div>
		{/if}

		<!-- Mid-Mission Guidance (during execution) -->
		{#if memoryConnected && isRunning && executionProgress?.currentTaskName}
			<div class="border-b border-surface-border">
				<MidMissionGuidance
					currentTaskName={executionProgress.currentTaskName}
					skillId={currentSkillId}
					agentId={currentAgentId}
					collapsed={guidanceCollapsed}
					onToggle={() => (guidanceCollapsed = !guidanceCollapsed)}
				/>
			</div>
		{/if}

		<!-- Logs Section - Main Focus Area -->
		<div class="flex-1 flex flex-col min-h-0 border-t border-surface-border">
			<!-- Logs Header -->
			<div class="flex items-center justify-between px-4 py-2 bg-bg-tertiary border-b border-surface-border sticky top-0 z-10">
				<div class="flex items-center gap-2">
					<svg class="w-4 h-4 text-vibe-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
					</svg>
					<span class="text-xs font-mono text-text-secondary uppercase tracking-wider">Execution Logs</span>
					{#if logs.length > 0}
						<span class="px-1.5 py-0.5 bg-vibe-teal/20 text-xs font-mono text-vibe-teal">{logs.length}</span>
					{/if}
				</div>
				{#if logs.length > 0}
					<button
						onclick={() => {
							const logText = logs.map(l => `[${formatTime(l.created_at)}] ${getLogIcon(l.type)} ${l.message}`).join('\n');
							navigator.clipboard.writeText(logText);
							toasts.success('Logs copied to clipboard');
						}}
						class="text-xs text-text-tertiary hover:text-text-secondary px-2 py-1 border border-surface-border hover:border-vibe-teal/50 transition-all flex items-center gap-1"
					>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
						Copy
					</button>
				{/if}
			</div>
			<!-- Logs Content -->
			<div bind:this={logsContainer} class="flex-1 overflow-y-auto p-3 font-mono text-sm bg-bg-primary select-text">
				{#if logs.length === 0}
					<div class="flex flex-col items-center justify-center h-full py-8 text-text-tertiary">
						{#if isRunning}
							<div class="flex items-center gap-2">
								<div class="w-2 h-2 bg-vibe-teal animate-pulse"></div>
								<span>{executionProgress?.status === 'creating' ? 'Creating mission...' : 'Starting execution...'}</span>
							</div>
						{:else}
							<svg class="w-8 h-8 mb-2 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16m-7 6h7" />
							</svg>
							<p class="text-sm">Click "Run Workflow" to start execution</p>
							<p class="text-xs text-text-muted mt-1">Logs will appear here</p>
						{/if}
					</div>
				{:else}
					<div class="space-y-0.5">
						{#each logs as log}
							<div class="flex gap-2 {getLogColor(log.type)} cursor-text hover:bg-vibe-teal/5 px-2 py-1 -mx-2 group transition-colors">
								<span class="text-xs text-text-tertiary w-16 flex-shrink-0 select-text tabular-nums">
									{formatTime(log.created_at)}
								</span>
								<span class="w-4 flex-shrink-0 text-center">{getLogIcon(log.type)}</span>
								<span class="flex-1 select-text break-all">{log.message}</span>
								<button
									onclick={() => {
										navigator.clipboard.writeText(log.message);
										toasts.success('Copied');
									}}
									class="opacity-0 group-hover:opacity-100 text-xs text-text-tertiary hover:text-vibe-teal transition-all px-1"
									title="Copy this log"
								>
									<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
		{:else}
		<!-- Mind Activity Tab -->
		<div class="flex-1 overflow-y-auto bg-bg-primary">
			{#if mindActivities.length === 0}
				<div class="flex flex-col items-center justify-center h-full py-12 text-center px-4">
					<div class="w-16 h-16 mb-4 flex items-center justify-center bg-purple-500/10 border border-purple-500/30">
						<svg class="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
						</svg>
					</div>
					<h3 class="text-lg font-serif text-text-primary mb-2">No Mind Activity Yet</h3>
					<p class="text-sm text-text-secondary max-w-xs">
						{#if !isRunning}
							Start a workflow execution to see decisions and learnings being recorded.
						{:else}
							Mind will track decisions and learnings as tasks execute.
						{/if}
					</p>
					{#if !memoryConnected}
						<p class="text-xs text-amber-400 mt-3">
							Connect Mind to persist learnings across sessions.
						</p>
					{/if}
				</div>
			{:else}
				<!-- Mind Activity Header -->
				<div class="px-4 py-3 bg-bg-tertiary border-b border-surface-border sticky top-0">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-xs font-mono text-purple-400 uppercase tracking-wider">Mind Activity</span>
							<span class="text-xs text-text-tertiary">({mindActivities.length} events)</span>
						</div>
						{#if memoryConnected}
							<span class="text-xs text-accent-primary flex items-center gap-1">
								<span class="w-1.5 h-1.5 bg-accent-primary"></span>
								Syncing to Mind
							</span>
						{:else}
							<span class="text-xs text-amber-400 flex items-center gap-1">
								<span class="w-1.5 h-1.5 bg-amber-400"></span>
								Local only
							</span>
						{/if}
					</div>
				</div>

				<!-- Activity List -->
				<div class="divide-y divide-surface-border">
					{#each [...mindActivities].reverse() as activity}
						<div class="px-4 py-3 hover:bg-surface/30 transition-colors">
							<div class="flex items-start gap-3">
								<!-- Activity Type Icon -->
								<div class="flex-shrink-0 mt-0.5">
									{#if activity.type === 'decision'}
										<div class="w-6 h-6 flex items-center justify-center bg-blue-500/20 border border-blue-500/30">
											<svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M9 5l7 7-7 7" />
											</svg>
										</div>
									{:else if activity.type === 'learning'}
										<div class="w-6 h-6 flex items-center justify-center bg-accent-primary/20 border border-accent-primary/30">
											<svg class="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="3" d="M5 13l4 4L19 7" />
											</svg>
										</div>
									{:else if activity.type === 'pattern'}
										<div class="w-6 h-6 flex items-center justify-center bg-purple-500/20 border border-purple-500/30">
											<svg class="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
											</svg>
										</div>
									{:else if activity.type === 'issue'}
										<div class="w-6 h-6 flex items-center justify-center bg-red-500/20 border border-red-500/30">
											<svg class="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
											</svg>
										</div>
									{:else if activity.type === 'session'}
										<div class="w-6 h-6 flex items-center justify-center bg-amber-500/20 border border-amber-500/30">
											<svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
										</div>
									{:else if activity.type === 'improvement'}
										<div class="w-6 h-6 flex items-center justify-center bg-emerald-500/20 border border-emerald-500/30">
											<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
											</svg>
										</div>
									{:else}
										<div class="w-6 h-6 flex items-center justify-center bg-vibe-teal/20 border border-vibe-teal/30">
											<svg class="w-3.5 h-3.5 text-vibe-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="square" stroke-linejoin="miter" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
											</svg>
										</div>
									{/if}
								</div>

								<!-- Activity Content -->
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<span class="text-xs font-mono uppercase tracking-wider {
											activity.type === 'decision' ? 'text-blue-400' :
											activity.type === 'learning' ? 'text-accent-primary' :
											activity.type === 'pattern' ? 'text-purple-400' :
											activity.type === 'issue' ? 'text-red-400' :
											activity.type === 'session' ? 'text-amber-400' :
											activity.type === 'improvement' ? 'text-emerald-400' :
											'text-vibe-teal'
										}">
											{activity.type}
										</span>
										{#if activity.taskName}
											<span class="text-xs text-text-tertiary">• {activity.taskName}</span>
										{/if}
									</div>
									<p class="text-sm text-text-primary">{activity.content}</p>
									<p class="text-xs text-text-tertiary mt-1">{formatTime(activity.timestamp)}</p>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
		{/if}

		<!-- Mission Settings (shown when not running) -->
		{#if !isRunning && !isPaused}
			<div class="px-4 py-3 border-t border-surface-border bg-bg-tertiary">
				<div class="flex items-center justify-between">
					<div class="text-xs font-mono text-text-tertiary uppercase tracking-wider">
						Mission Settings
					</div>
					<button
						onclick={() => showMissionSettings = !showMissionSettings}
						class="text-xs font-mono text-accent-primary hover:text-accent-primary-hover transition-colors"
					>
						{showMissionSettings ? 'Hide' : 'Show'}
					</button>
				</div>

				{#if showMissionSettings}
					<div class="mt-3 grid grid-cols-1 gap-3">
						<label class="block">
							<div class="text-xs font-mono text-text-tertiary mb-1">Mission Name</div>
							<input class="input" bind:value={missionName} placeholder="Spark Intelligence Launch Readiness" />
						</label>

						<label class="block">
							<div class="text-xs font-mono text-text-tertiary mb-1">Project Path</div>
							<input class="input" bind:value={projectPath} placeholder="C:/path/to/repo" />
						</label>

						<label class="block">
							<div class="text-xs font-mono text-text-tertiary mb-1">Project Type</div>
							<input class="input" bind:value={projectType} placeholder="tool | saas | marketplace | general" />
						</label>

						<label class="block">
							<div class="text-xs font-mono text-text-tertiary mb-1">Mission Description</div>
							<textarea
								class="input"
								rows="2"
								bind:value={missionDescription}
								placeholder="What success looks like for this run..."
							></textarea>
						</label>

						<label class="block">
							<div class="text-xs font-mono text-text-tertiary mb-1">Goals (one per line)</div>
							<textarea class="input" rows="3" bind:value={goalsText}></textarea>
						</label>

						<div class="p-3 border border-surface-border bg-bg-primary">
							<div class="flex items-center justify-between">
								<div class="text-xs font-mono text-text-tertiary uppercase tracking-wider">
									Multi-LLM Orchestrator
								</div>
								<label class="flex items-center gap-2 text-xs text-text-secondary">
									<input
										type="checkbox"
										checked={multiLLMEnabled}
										onchange={(e) => (multiLLMEnabled = (e.currentTarget as HTMLInputElement).checked)}
									/>
									Enable
								</label>
							</div>

							{#if hasDualProviderKeys()}
								<div class="mt-2 p-2 border border-vibe-teal/30 bg-vibe-teal/10 text-xs text-vibe-teal font-mono">
									Run flow will auto-launch Codex + Claude in parallel consensus mode.
								</div>
							{/if}

							{#if multiLLMEnabled}
								<div class="mt-3 grid grid-cols-1 gap-2">
									<div class="grid grid-cols-2 gap-2">
										<label class="flex items-center gap-2 text-xs text-text-secondary p-2 border border-surface-border">
											<input
												type="checkbox"
												checked={multiLLMAutoEnableByKeys}
												onchange={(e) =>
													(multiLLMAutoEnableByKeys = (e.currentTarget as HTMLInputElement).checked)}
											/>
											Auto-enable by API keys
										</label>
										<label class="flex items-center gap-2 text-xs text-text-secondary p-2 border border-surface-border">
											<input
												type="checkbox"
												checked={multiLLMAutoRouteByTask}
												onchange={(e) =>
													(multiLLMAutoRouteByTask = (e.currentTarget as HTMLInputElement).checked)}
											/>
											Auto-route by task type
										</label>
										<label class="flex items-center gap-2 text-xs text-text-secondary p-2 border border-green-600/30 bg-green-600/5">
											<input
												type="checkbox"
												checked={multiLLMAutoDispatch}
												onchange={(e) =>
													(multiLLMAutoDispatch = (e.currentTarget as HTMLInputElement).checked)}
											/>
											Direct run (no copy/paste)
										</label>
									</div>

									<label class="block">
										<div class="text-xs font-mono text-text-tertiary mb-1">Strategy</div>
										<select
											class="input"
											value={multiLLMStrategy}
											onchange={(e) =>
												(multiLLMStrategy = (e.currentTarget as HTMLSelectElement).value as MultiLLMStrategy)}
										>
											<option value="single">Single</option>
											<option value="round_robin">Round Robin</option>
											<option value="parallel_consensus">Parallel Consensus</option>
											<option value="lead_reviewer">Lead + Reviewers</option>
										</select>
									</label>

									<div class="p-2 border border-surface-border bg-bg-tertiary">
										<div class="text-xs font-mono text-text-tertiary mb-1">Connected MCP Capabilities</div>
										<div class="text-xs text-text-secondary">
											{connectedMcpCapabilities.length > 0
												? connectedMcpCapabilities.join(', ')
												: 'No connected MCP capabilities detected'}
										</div>
										<div class="text-[11px] text-text-tertiary mt-1">
											Detected tools: {connectedMcpToolCount}
										</div>
									</div>

									<label class="block">
										<div class="text-xs font-mono text-text-tertiary mb-1">Primary Provider</div>
										<select
											class="input"
											value={multiLLMPrimaryProviderId}
											onchange={(e) => (multiLLMPrimaryProviderId = (e.currentTarget as HTMLSelectElement).value)}
										>
											{#each multiLLMProviders.filter((provider) => provider.enabled) as provider}
												<option value={provider.id}>{provider.label}</option>
											{/each}
										</select>
									</label>

									<div>
										<div class="text-xs font-mono text-text-tertiary mb-1">Providers</div>
										<div class="space-y-1">
											{#each multiLLMProviders as provider}
												<div class="flex items-center gap-2 p-2 border border-surface-border">
													<label class="flex items-center gap-2 min-w-28">
														<input
															type="checkbox"
															checked={provider.enabled}
															onchange={() => toggleMultiLLMProvider(provider.id)}
														/>
														<span class="text-xs font-mono text-text-secondary">{provider.label}</span>
													</label>
													<input
														class="input flex-1 !py-1"
														value={provider.model}
														oninput={(e) =>
															updateMultiLLMProviderModel(
																provider.id,
																(e.currentTarget as HTMLInputElement).value
															)}
														placeholder="Model"
													/>
													{#if provider.apiKeyEnv}
														<input
															type="password"
															class="input flex-1 !py-1"
															value={multiLLMApiKeys[provider.id] || ''}
															oninput={(e) =>
																updateMultiLLMApiKey(
																	provider.id,
																	(e.currentTarget as HTMLInputElement).value
																)}
															placeholder={`${provider.apiKeyEnv} (local only)`}
														/>
													{/if}
												</div>
											{/each}
										</div>
										<p class="mt-1 text-[11px] text-text-tertiary">
											Keys are stored in this browser only and used for provider readiness/auto-routing.
										</p>
									</div>
								</div>
							{/if}
						</div>

						<div class="flex items-center justify-between">
							<div class="text-xs text-text-tertiary">
								Saved locally on Run.
							</div>
							<button
								onclick={persistDefaults}
								class="px-3 py-1.5 text-xs font-mono text-text-secondary border border-surface-border hover:border-text-tertiary transition-all"
							>
								Save Now
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Footer -->
		<div class="p-4 border-t border-surface-border flex justify-between items-center">
			<div class="flex items-center gap-3 text-xs text-text-tertiary">
				{#if executionProgress?.endTime}
					Finished at {formatTime(executionProgress.endTime)}
				{:else if executionProgress?.startTime}
					Started at {formatTime(executionProgress.startTime)}
				{:else}
					Ready to run
				{/if}
				<!-- View Review button after completion -->
				{#if completedMission && memoryConnected && !isRunning}
					<button
						onclick={() => showReview = true}
						class="text-accent-secondary hover:text-accent-secondary-hover transition-colors"
					>
						View Review
					</button>
				{/if}
			</div>
			<div class="flex gap-2">
				<!-- Cancel button -->
				{#if canCancel}
					<button
						onclick={handleCancel}
						class="px-4 py-1.5 text-sm font-mono text-red-400 border border-red-400/50 hover:bg-red-400/10 transition-all"
					>
						Cancel
					</button>
				{/if}

				<!-- Pause/Resume buttons -->
				{#if canPause}
					<button
						onclick={handlePause}
						class="px-4 py-1.5 text-sm font-mono text-blue-400 border border-blue-400/50 hover:bg-blue-400/10 transition-all"
					>
						Pause
					</button>
				{/if}
				{#if canResume}
					<button
						onclick={handleResume}
						class="px-4 py-1.5 text-sm font-mono text-blue-400 border border-blue-400/50 hover:bg-blue-400/10 transition-all"
					>
						Resume
					</button>
				{/if}

				<!-- Close button -->
				{#if !isRunning && !isPaused}
					<button
						onclick={handleClose}
						class="px-4 py-1.5 text-sm font-mono text-text-secondary border border-surface-border hover:border-text-tertiary transition-all"
					>
						Close
					</button>
				{/if}

				<!-- Run button -->
				<button
					onclick={runWorkflow}
					disabled={!canRun}
					class="px-4 py-1.5 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					title={currentNodes.length === 0 ? 'No nodes to execute' : ''}
				>
					{#if isRunning}
						Running...
					{:else if executionProgress?.status === 'completed' || executionProgress?.status === 'failed' || executionProgress?.status === 'cancelled'}
						Run Again
					{:else}
						Run Workflow
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>
{/if}

<!-- Post-Mission Review Modal -->
{#if showReview && completedMission && missionStartTime && missionEndTime}
	<PostMissionReview
		mission={completedMission}
		startTime={missionStartTime}
		endTime={missionEndTime}
		onClose={() => showReview = false}
		onViewLearnings={() => {
			showReview = false;
			// Navigate to mind learnings page
			window.location.href = '/mind';
		}}
	/>
{/if}

<!-- Orphan Node Warning Modal -->
{#if showOrphanWarning && orphanedNodes.length > 0}
	<div class="fixed inset-0 flex items-center justify-center z-[60]" role="dialog" aria-modal="true" aria-label="Orphan node warning">
		<button class="absolute inset-0 bg-black/60" onclick={() => (showOrphanWarning = false)} aria-label="Close orphan warning"></button>
		<div class="relative bg-bg-secondary border border-surface-border w-full max-w-md p-6">
			<!-- Warning Icon & Title -->
			<div class="flex items-center gap-3 mb-4">
				<div class="w-10 h-10 bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
					<svg class="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
					class="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
					</svg>
					Auto-Connect Nodes
				</button>

				<!-- View on Canvas Option -->
				<button
					onclick={handleViewOnCanvas}
					class="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-mono text-text-secondary border border-surface-border hover:border-text-tertiary transition-all"
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
		<div class="max-w-2xl w-full max-h-[80vh] overflow-y-auto mx-4">
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
