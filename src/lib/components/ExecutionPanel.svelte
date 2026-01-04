<script lang="ts">
	import { executeWorkflow, getExecutionDuration, type ExecutionState, type ExecutionLog } from '$lib/services/executor';
	import { nodes, connections, updateNodeStatus, resetAllNodeStatus } from '$lib/stores/canvas.svelte';
	import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let currentNodes = $state<CanvasNode[]>([]);
	let currentConnections = $state<Connection[]>([]);
	let executionState = $state<ExecutionState | null>(null);
	let isRunning = $state(false);
	let logs = $state<ExecutionLog[]>([]);
	let logsContainer: HTMLDivElement;

	$effect(() => {
		const unsub1 = nodes.subscribe((n) => (currentNodes = n));
		const unsub2 = connections.subscribe((c) => (currentConnections = c));
		return () => {
			unsub1();
			unsub2();
		};
	});

	// Auto-scroll logs
	$effect(() => {
		if (logs.length > 0 && logsContainer) {
			logsContainer.scrollTop = logsContainer.scrollHeight;
		}
	});

	async function runWorkflow() {
		isRunning = true;
		logs = [];
		resetAllNodeStatus();

		executionState = await executeWorkflow(currentNodes, currentConnections, {
			onNodeStart: (nodeId) => {
				updateNodeStatus(nodeId, 'running');
			},
			onNodeComplete: (nodeId, result) => {
				updateNodeStatus(nodeId, result.status === 'success' ? 'success' : 'error');
			},
			onLog: (log) => {
				logs = [...logs, log];
			},
			onProgress: (progress) => {
				if (executionState) {
					executionState.progress = progress;
				}
			}
		});

		isRunning = false;
	}

	function getLogColor(level: ExecutionLog['level']): string {
		switch (level) {
			case 'success':
				return 'text-accent-primary';
			case 'error':
				return 'text-red-400';
			case 'warning':
				return 'text-yellow-400';
			default:
				return 'text-text-secondary';
		}
	}

	function getLogIcon(level: ExecutionLog['level']): string {
		switch (level) {
			case 'success':
				return '✓';
			case 'error':
				return '✗';
			case 'warning':
				return '⚠';
			default:
				return '•';
		}
	}

	function formatTime(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	function getStatusColor(status: ExecutionState['status']): string {
		switch (status) {
			case 'completed':
				return 'text-accent-primary';
			case 'failed':
				return 'text-red-400';
			case 'running':
				return 'text-yellow-400';
			default:
				return 'text-text-secondary';
		}
	}

	function handleClose() {
		if (!isRunning) {
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
				{#if executionState}
					<span class="text-sm font-mono {getStatusColor(executionState.status)}">
						{executionState.status.toUpperCase()}
					</span>
				{/if}
			</div>
			<button onclick={handleClose} class="text-text-tertiary hover:text-text-primary" disabled={isRunning}>
				X
			</button>
		</div>

		<!-- Progress -->
		{#if executionState}
			<div class="p-4 border-b border-surface-border">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-text-secondary">Progress</span>
					<span class="text-sm font-mono text-text-primary">{executionState.progress}%</span>
				</div>
				<div class="w-full h-2 bg-surface rounded-full overflow-hidden">
					<div
						class="h-full transition-all duration-300"
						class:bg-accent-primary={executionState.status === 'completed'}
						class:bg-yellow-500={executionState.status === 'running'}
						class:bg-red-500={executionState.status === 'failed'}
						style="width: {executionState.progress}%"
					></div>
				</div>
				<div class="flex justify-between mt-2 text-xs text-text-tertiary">
					<span>{currentNodes.length} nodes</span>
					<span>{getExecutionDuration(executionState)}</span>
				</div>
			</div>
		{/if}

		<!-- Logs -->
		<div bind:this={logsContainer} class="flex-1 overflow-y-auto p-4 font-mono text-sm bg-bg-primary">
			{#if logs.length === 0}
				<div class="text-center py-8 text-text-tertiary">
					{#if isRunning}
						<div class="animate-pulse">Starting execution...</div>
					{:else}
						<p>Click "Run Workflow" to start execution</p>
					{/if}
				</div>
			{:else}
				<div class="space-y-1">
					{#each logs as log}
						<div class="flex gap-2 {getLogColor(log.level)}">
							<span class="text-xs text-text-tertiary w-20 flex-shrink-0">
								{formatTime(log.timestamp)}
							</span>
							<span class="w-4 flex-shrink-0">{getLogIcon(log.level)}</span>
							<span class="flex-1">{log.message}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="p-4 border-t border-surface-border flex justify-between items-center">
			<div class="text-xs text-text-tertiary">
				{#if executionState?.endTime}
					Finished at {formatTime(executionState.endTime)}
				{:else if executionState?.startTime}
					Started at {formatTime(executionState.startTime)}
				{:else}
					Ready to run
				{/if}
			</div>
			<div class="flex gap-2">
				{#if !isRunning && executionState?.status !== 'running'}
					<button
						onclick={handleClose}
						class="px-4 py-1.5 text-sm font-mono text-text-secondary border border-surface-border hover:border-text-tertiary transition-all"
					>
						Close
					</button>
				{/if}
				<button
					onclick={runWorkflow}
					disabled={isRunning || currentNodes.length === 0}
					class="px-4 py-1.5 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if isRunning}
						Running...
					{:else if executionState?.status === 'completed' || executionState?.status === 'failed'}
						Run Again
					{:else}
						Run Workflow
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>
