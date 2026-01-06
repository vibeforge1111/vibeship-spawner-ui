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

	// Derived states
	let isRunning = $derived(executionProgress?.status === 'running' || executionProgress?.status === 'creating');
	let isPaused = $derived(executionProgress?.status === 'paused');
	let canPause = $derived(executionProgress?.status === 'running');
	let canResume = $derived(executionProgress?.status === 'paused');
	let canCancel = $derived(isRunning || isPaused);
	let canRun = $derived(mcpConnected && !isRunning && !isPaused && currentNodes.length > 0);

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

		// Track task outcomes for reinforcement
		const taskOutcomes: Record<string, boolean> = {};

		// Set up callbacks
		missionExecutor.setCallbacks({
			onStatusChange: (status) => {
				executionProgress = missionExecutor.getProgress();
			},
			onProgress: (progress) => {
				executionProgress = missionExecutor.getProgress();
			},
			onLog: (log) => {
				logs = [...logs, log];
			},
			onTaskStart: (taskId, taskName) => {
				// Find the node matching this task and update its status
				const node = currentNodes.find(n => n.skill.name === taskName || n.id === taskId);
				if (node) {
					updateNodeStatus(node.id, 'running');
					// Update skill/agent IDs for mid-mission guidance
					currentSkillId = node.skill.id;
					currentAgentId = node.skill.id; // Use skill as agent proxy
				}
			},
			onTaskComplete: (taskId, success) => {
				// Track outcome for reinforcement
				taskOutcomes[taskId] = success;

				// Find the node and update its status
				const node = currentNodes.find(n => n.id === taskId);
				if (node) {
					updateNodeStatus(node.id, success ? 'success' : 'error');
				}
			},
			onComplete: async (mission) => {
				executionProgress = missionExecutor.getProgress();
				missionEndTime = new Date();
				completedMission = mission;

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

		<!-- Progress -->
		{#if executionProgress}
			<div class="p-4 border-b border-surface-border">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-text-secondary">
						{#if executionProgress.currentTaskName}
							{executionProgress.currentTaskName}
						{:else}
							Progress
						{/if}
					</span>
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
				<div class="flex justify-between mt-2 text-xs text-text-tertiary">
					<span>{currentNodes.length} nodes</span>
					<span>{getExecutionDuration()}</span>
				</div>
				{#if executionProgress.missionId}
					<div class="mt-2 p-2 bg-surface-secondary rounded text-xs">
						<div class="flex items-center justify-between gap-2">
							<span class="text-text-tertiary">Mission ID:</span>
							<code class="text-accent-primary font-mono select-all">{executionProgress.missionId}</code>
							<button
								class="px-2 py-1 bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary rounded text-xs"
								onclick={() => {
									navigator.clipboard.writeText(`Execute mission ${executionProgress.missionId}`);
									toasts.success('Copied! Paste this to Claude Code');
								}}
							>
								Copy for Claude
							</button>
						</div>
						{#if executionProgress.status === 'running' && executionProgress.progress === 0}
							<p class="mt-2 text-text-tertiary text-xs">
								Tell Claude Code: "Execute mission {executionProgress.missionId}"
							</p>
						{/if}
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
			{#if !mcpConnected}
				<div class="text-center py-8">
					<div class="text-red-400 mb-2">MCP Not Connected</div>
					<p class="text-text-tertiary text-sm">
						Connect to an MCP server to execute workflows.<br/>
						Go to Settings to configure your MCP connection.
					</p>
				</div>
			{:else if logs.length === 0}
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
					title={!mcpConnected ? 'MCP not connected' : currentNodes.length === 0 ? 'No nodes to execute' : ''}
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
