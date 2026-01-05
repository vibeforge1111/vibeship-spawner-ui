<script lang="ts">
	import { missionExecutor, type ExecutionProgress, type ExecutionStatus } from '$lib/services/mission-executor';
	import type { MissionLog } from '$lib/services/mcp-client';
	import { nodes, connections, updateNodeStatus, resetAllNodeStatus } from '$lib/stores/canvas.svelte';
	import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';
	import { isConnected } from '$lib/stores/mcp.svelte';
	import { toasts } from '$lib/stores/toast.svelte';
	import { executionBridge, isLiveEnabled } from '$lib/spawner-live';

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
		return () => {
			unsub1();
			unsub2();
			unsub3();
		};
	});

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

	async function runWorkflow() {
		logs = [];
		resetAllNodeStatus();

		// Build node map for the execution bridge
		const nodeMap = new Map<string, { id: string; name: string }>();
		for (const node of currentNodes) {
			nodeMap.set(node.id, { id: node.id, name: node.skill.name });
		}

		// Base callbacks for UI updates
		const baseCallbacks = {
			onStatusChange: (status: string) => {
				executionProgress = missionExecutor.getProgress();
			},
			onProgress: (progress: number) => {
				executionProgress = missionExecutor.getProgress();
			},
			onLog: (log: MissionLog) => {
				logs = [...logs, log];
			},
			onTaskStart: (taskId: string, taskName: string) => {
				// Find the node matching this task and update its status
				const node = currentNodes.find(n => n.skill.name === taskName || n.id === taskId);
				if (node) {
					updateNodeStatus(node.id, 'running');
				}
			},
			onTaskComplete: (taskId: string, success: boolean) => {
				// Find the node and update its status
				const node = currentNodes.find(n => n.id === taskId);
				if (node) {
					updateNodeStatus(node.id, success ? 'success' : 'error');
				}
			},
			onComplete: (mission: any) => {
				executionProgress = missionExecutor.getProgress();
				toasts.success('Workflow completed successfully');
			},
			onError: (error: string) => {
				executionProgress = missionExecutor.getProgress();
				toasts.error(`Execution failed: ${error}`, {
					label: 'Retry',
					onClick: () => runWorkflow()
				});
			}
		};

		// Wrap callbacks with execution bridge for Spawner Live visualization
		const wrappedCallbacks = executionBridge.wrapCallbacks(baseCallbacks, nodeMap);
		missionExecutor.setCallbacks(wrappedCallbacks);

		// Activate the bridge for this execution
		const missionId = `workflow-${Date.now()}`;
		executionBridge.activate(missionId);

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
					<span>{currentNodes.length} nodes • {executionProgress.missionId ? `Mission: ${executionProgress.missionId.slice(0, 8)}...` : ''}</span>
					<span>{getExecutionDuration()}</span>
				</div>
			</div>
		{/if}

		<!-- Logs -->
		<div bind:this={logsContainer} class="flex-1 overflow-y-auto p-4 font-mono text-sm bg-bg-primary">
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
				<div class="space-y-1">
					{#each logs as log}
						<div class="flex gap-2 {getLogColor(log.type)}">
							<span class="text-xs text-text-tertiary w-20 flex-shrink-0">
								{formatTime(log.created_at)}
							</span>
							<span class="w-4 flex-shrink-0">{getLogIcon(log.type)}</span>
							<span class="flex-1">{log.message}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="p-4 border-t border-surface-border flex justify-between items-center">
			<div class="text-xs text-text-tertiary">
				{#if executionProgress?.endTime}
					Finished at {formatTime(executionProgress.endTime)}
				{:else if executionProgress?.startTime}
					Started at {formatTime(executionProgress.startTime)}
				{:else}
					Ready to run
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
