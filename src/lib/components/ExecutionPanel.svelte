<script lang="ts">
	import { missionExecutor, type ExecutionProgress, type ExecutionStatus } from '$lib/services/mission-executor';
	import type { MissionLog, Mission } from '$lib/services/mcp-client';
	import { nodes, connections, updateNodeStatus, resetAllNodeStatus, addConnection } from '$lib/stores/canvas.svelte';
	import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';
	import { isConnected } from '$lib/stores/mcp.svelte';
	import { toasts } from '$lib/stores/toast.svelte';
	import { getPreMissionContext, type PreMissionContext, type PatternSuggestion } from '$lib/services/pre-mission-context';
	import { reinforceMission } from '$lib/services/learning-reinforcement';
	import { validateForMission } from '$lib/services/mission-builder';
	import PreMissionContextPanel from './PreMissionContextPanel.svelte';
	import PostMissionReview from './PostMissionReview.svelte';
	import MidMissionGuidance from './MidMissionGuidance.svelte';
	import { isMemoryConnected } from '$lib/stores/memory-settings.svelte';
	import { memoryClient } from '$lib/services/memory-client';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let currentNodes = $state<CanvasNode[]>([]);
	let currentConnections = $state<Connection[]>([]);
	let executionProgress = $state<ExecutionProgress | null>(null);
	let logs = $state<MissionLog[]>([]);
	let logsContainer: HTMLDivElement;
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
	let mindLogsCount = $state(0);

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

	// Derived states
	let isRunning = $derived(executionProgress?.status === 'running' || executionProgress?.status === 'creating');
	let isPaused = $derived(executionProgress?.status === 'paused');
	let canPause = $derived(executionProgress?.status === 'running');
	let canResume = $derived(executionProgress?.status === 'paused');
	let canCancel = $derived(isRunning || isPaused);
	// Note: MCP not required anymore - we build missions locally and generate copy-pasteable prompts
	let canRun = $derived(!isRunning && !isPaused && currentNodes.length > 0);

	$effect(() => {
		const unsub1 = nodes.subscribe((n) => (currentNodes = n));
		const unsub2 = connections.subscribe((c) => (currentConnections = c));
		const unsub3 = isConnected.subscribe((connected) => (mcpConnected = connected));
		const unsub4 = isMemoryConnected.subscribe((connected) => (memoryConnected = connected));
		return () => {
			unsub1();
			unsub2();
			unsub3();
			unsub4();
		};
	});

	// Check for resumable mission on mount
	$effect(() => {
		const missionInfo = missionExecutor.getResumableMissionInfo();
		if (missionInfo) {
			resumableMission = missionInfo;
			showResumeBanner = true;
			// Also restore the execution progress
			executionProgress = missionExecutor.getProgress();
			logs = executionProgress?.logs || [];
		}
	});

	// Fetch pre-mission context when panel opens and nodes exist
	$effect(() => {
		if (currentNodes.length > 0 && memoryConnected && !executionProgress) {
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

	/**
	 * Log progress to Mind
	 */
	async function logToMind(type: 'progress' | 'decision' | 'learning', message: string) {
		if (!memoryConnected) return;
		try {
			await memoryClient.recordLearning('spawner-ui', {
				content: message,
				missionId: executionProgress?.missionId || undefined,
				patternType: type === 'learning' ? 'success' : undefined,
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

		// Reset review state
		showReview = false;
		completedMission = null;
		missionStartTime = new Date();
		missionEndTime = null;

		// Reset task tracking
		completedTasks = [];
		failedTasks = [];
		pendingTasks = currentNodes.map(n => n.skill.name);
		mindLogsCount = 0;

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

					// Log to Mind
					logToMind('progress', `Starting task: ${taskName}`);
				}
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

				// Update tracking
				if (success) {
					completedTasks = [...completedTasks, taskName];
					logToMind('progress', `Completed task: ${taskName}`);
				} else {
					failedTasks = [...failedTasks, taskName];
					logToMind('progress', `Failed task: ${taskName}`);
				}
			},
			onComplete: async (mission) => {
				executionProgress = missionExecutor.getProgress();
				missionEndTime = new Date();
				completedMission = mission;

				// Clear pending tasks
				pendingTasks = [];

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
		executionProgress = await missionExecutor.execute(currentNodes, currentConnections, {
			mode: 'claude-code',
			name: `Workflow Execution ${new Date().toLocaleString()}`
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
				return '✓';
			case 'error':
				return '✗';
			case 'handoff':
				return '→';
			case 'start':
				return '▶';
			case 'progress':
			default:
				return '•';
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
				return 'text-yellow-400';
			case 'paused':
				return 'text-blue-400';
			case 'cancelled':
				return 'text-gray-400';
			default:
				return 'text-text-secondary';
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
			onClose();
		}
	}
</script>

<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={handleClose} role="button" tabindex="-1">
	<div
		class="bg-bg-secondary border border-surface-border w-full max-w-2xl max-h-[80vh] flex flex-col"
		onclick={(e) => e.stopPropagation()}
		role="dialog"
	>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-surface-border">
			<div class="flex items-center gap-3">
				<h2 class="font-serif text-lg text-text-primary">Workflow Execution</h2>
				{#if executionProgress}
					<span class="text-sm font-mono {getStatusColor(executionProgress.status)}">
						{executionProgress.status.toUpperCase()}
					</span>
				{/if}
			</div>
			<button onclick={handleClose} class="text-text-tertiary hover:text-text-primary" disabled={isRunning}>
				X
			</button>
		</div>

		<!-- Resume Banner (shown when there's a saved mission) -->
		{#if showResumeBanner && resumableMission}
			<div class="p-3 bg-blue-500/10 border-b border-blue-500/30">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
							<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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

		<!-- Progress -->
		{#if executionProgress}
			<div class="p-4 border-b border-surface-border">
				<!-- Overall Progress -->
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-text-secondary">Overall Progress</span>
					<span class="text-sm font-mono text-text-primary">{executionProgress.progress}%</span>
				</div>
				<div class="w-full h-2 bg-surface rounded-full overflow-hidden">
					<div
						class="h-full transition-all duration-300"
						class:bg-accent-primary={executionProgress.status === 'completed'}
						class:bg-yellow-500={executionProgress.status === 'running' || executionProgress.status === 'creating'}
						class:bg-blue-500={executionProgress.status === 'paused'}
						class:bg-red-500={executionProgress.status === 'failed'}
						class:bg-gray-500={executionProgress.status === 'cancelled'}
						style="width: {executionProgress.progress}%"
					></div>
				</div>

				<!-- Current Task Progress (shown during running) -->
				{#if isRunning && executionProgress.currentTaskName}
					<div class="mt-3 p-3 bg-bg-tertiary border border-surface-border rounded">
						<div class="flex items-center justify-between mb-1">
							<span class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Current Task</span>
							<span class="text-xs font-mono text-yellow-400">{currentTaskProgress}%</span>
						</div>
						<div class="flex items-center gap-2 mb-2">
							<div class="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
							<span class="text-sm text-text-primary font-medium">{executionProgress.currentTaskName}</span>
						</div>
						<!-- Task progress bar -->
						<div class="w-full h-1.5 bg-surface rounded-full overflow-hidden">
							<div
								class="h-full bg-yellow-400 transition-all duration-200"
								style="width: {currentTaskProgress}%"
							></div>
						</div>
						{#if currentTaskMessage}
							<p class="mt-2 text-xs text-text-tertiary italic">{currentTaskMessage}</p>
						{/if}
					</div>
				{/if}

				<div class="flex justify-between mt-2 text-xs text-text-tertiary">
					<span>{currentNodes.length} nodes</span>
					<span>{getExecutionDuration()}</span>
				</div>
				{#if executionProgress.executionPrompt}
					<div class="mt-3 p-3 bg-accent-primary/10 border border-accent-primary/30">
						<div class="flex items-center justify-between mb-2">
							<span class="text-xs font-mono text-accent-primary uppercase tracking-wider">Copy to Claude Code</span>
							<button
								class="px-3 py-1.5 bg-accent-primary hover:bg-accent-primary-hover text-bg-primary text-xs font-mono transition-all flex items-center gap-2"
								onclick={() => {
									navigator.clipboard.writeText(executionProgress.executionPrompt || '');
									toasts.success('Copied! Paste this prompt into Claude Code to execute');
								}}
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
								</svg>
								Copy Prompt
							</button>
						</div>
						<div class="max-h-32 overflow-y-auto bg-bg-primary p-2 border border-surface-border text-xs font-mono text-text-secondary select-text">
							<pre class="whitespace-pre-wrap break-all">{executionProgress.executionPrompt.slice(0, 500)}{executionProgress.executionPrompt.length > 500 ? '...' : ''}</pre>
						</div>
						<p class="mt-2 text-xs text-text-tertiary">
							Paste this prompt into Claude Code to execute the workflow. Claude will use the spawner skills to complete each task.
						</p>
					</div>
				{:else if executionProgress.missionId}
					<div class="mt-2 p-2 bg-surface-secondary text-xs">
						<div class="flex items-center justify-between gap-2">
							<span class="text-text-tertiary">Mission ID:</span>
							<code class="text-accent-primary font-mono select-all">{executionProgress.missionId}</code>
						</div>
					</div>
				{/if}

				<!-- Task Status Summary -->
				{#if completedTasks.length > 0 || failedTasks.length > 0 || pendingTasks.length > 0}
					<div class="mt-3 p-3 bg-bg-tertiary border border-surface-border">
						<div class="flex items-center justify-between mb-2">
							<span class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Task Status</span>
							{#if memoryConnected && mindLogsCount > 0}
								<span class="text-xs text-purple-400 flex items-center gap-1">
									<span class="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
									{mindLogsCount} Mind logs
								</span>
							{/if}
						</div>
						<div class="grid grid-cols-3 gap-2 text-center text-xs">
							<div class="p-2 bg-green-500/10 border border-green-500/30 rounded">
								<div class="text-lg font-bold text-green-400">{completedTasks.length}</div>
								<div class="text-green-400/70">Completed</div>
							</div>
							<div class="p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
								<div class="text-lg font-bold text-yellow-400">{pendingTasks.length}</div>
								<div class="text-yellow-400/70">Pending</div>
							</div>
							<div class="p-2 bg-red-500/10 border border-red-500/30 rounded">
								<div class="text-lg font-bold text-red-400">{failedTasks.length}</div>
								<div class="text-red-400/70">Failed</div>
							</div>
						</div>
						{#if completedTasks.length > 0}
							<div class="mt-2 text-xs text-text-tertiary">
								<span class="text-green-400">Completed:</span> {completedTasks.join(', ')}
							</div>
						{/if}
						{#if pendingTasks.length > 0 && isRunning}
							<div class="mt-1 text-xs text-text-tertiary">
								<span class="text-yellow-400">Up next:</span> {pendingTasks[0]}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Completion Summary -->
				{#if executionProgress.status === 'completed'}
					<div class="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded">
						<div class="flex items-center gap-2 mb-2">
							<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-green-400 font-medium">Workflow Completed!</span>
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
				{:else if executionProgress.status === 'failed'}
					<div class="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded">
						<div class="flex items-center gap-2 mb-2">
							<svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-red-400 font-medium">Workflow Failed</span>
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

		<!-- Logs -->
		<div bind:this={logsContainer} class="flex-1 overflow-y-auto p-4 font-mono text-sm bg-bg-primary select-text">
			{#if logs.length === 0}
				<div class="text-center py-8 text-text-tertiary">
					{#if isRunning}
						<div class="animate-pulse">
							{executionProgress?.status === 'creating' ? 'Creating mission...' : 'Starting execution...'}
						</div>
					{:else}
						<p>Click "Run Workflow" to start execution</p>
					{/if}
				</div>
			{:else}
				<!-- Copy all logs button -->
				<div class="flex justify-end mb-2">
					<button
						onclick={() => {
							const logText = logs.map(l => `[${formatTime(l.created_at)}] ${getLogIcon(l.type)} ${l.message}`).join('\n');
							navigator.clipboard.writeText(logText);
							toasts.success('Logs copied to clipboard');
						}}
						class="text-xs text-text-tertiary hover:text-text-secondary px-2 py-1 border border-surface-border hover:border-text-tertiary rounded transition-all"
					>
						Copy All Logs
					</button>
				</div>
				<div class="space-y-1">
					{#each logs as log}
						<div class="flex gap-2 {getLogColor(log.type)} cursor-text hover:bg-surface/30 px-1 -mx-1 rounded group">
							<span class="text-xs text-text-tertiary w-20 flex-shrink-0 select-text">
								{formatTime(log.created_at)}
							</span>
							<span class="w-4 flex-shrink-0">{getLogIcon(log.type)}</span>
							<span class="flex-1 select-text break-all">{log.message}</span>
							<button
								onclick={() => {
									navigator.clipboard.writeText(log.message);
									toasts.success('Copied');
								}}
								class="opacity-0 group-hover:opacity-100 text-xs text-text-tertiary hover:text-text-secondary transition-opacity"
								title="Copy this log"
							>
								📋
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

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
	<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" role="dialog">
		<div class="bg-bg-secondary border border-surface-border w-full max-w-md p-6" onclick={(e) => e.stopPropagation()}>
			<!-- Warning Icon & Title -->
			<div class="flex items-center gap-3 mb-4">
				<div class="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
					<svg class="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
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
							<span class="w-2 h-2 rounded-full bg-amber-400"></span>
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
