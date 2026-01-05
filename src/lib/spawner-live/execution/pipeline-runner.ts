/**
 * Spawner Live - Pipeline Runner
 * Executes pipeline nodes sequentially with event emission
 */

import { writable, derived, get } from 'svelte/store';
import { eventRouter } from '../orchestrator/event-router';
import { createAgentEvent, type AgentEvent } from '../types/events';
import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';

export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ExecutionState {
	status: ExecutionStatus;
	pipelineId: string | null;
	currentNodeId: string | null;
	currentNodeIndex: number;
	totalNodes: number;
	completedNodes: string[];
	failedNodes: string[];
	skippedNodes: string[];
	startedAt: number | null;
	completedAt: number | null;
	error: string | null;
	results: Map<string, NodeResult>;
}

export interface NodeResult {
	nodeId: string;
	skillId: string;
	status: 'success' | 'error' | 'skipped';
	output: unknown;
	error?: string;
	startedAt: number;
	completedAt: number;
	duration: number;
}

export interface ExecutionOptions {
	pipelineId?: string;
	agentName?: string;
	onNodeStart?: (nodeId: string) => void;
	onNodeComplete?: (nodeId: string, result: NodeResult) => void;
	onNodeError?: (nodeId: string, error: string) => void;
	onProgress?: (nodeId: string, progress: number, message?: string) => void;
	executeNode?: (node: CanvasNode, context: ExecutionContext) => Promise<unknown>;
}

export interface ExecutionContext {
	pipelineId: string;
	nodeIndex: number;
	totalNodes: number;
	previousResults: Map<string, NodeResult>;
	abortSignal: AbortSignal;
}

// Default node executor (simulated)
async function defaultExecuteNode(
	node: CanvasNode,
	context: ExecutionContext,
	emitProgress: (progress: number, message?: string) => void
): Promise<unknown> {
	// Simulate execution with progress updates
	const steps = 4;
	for (let i = 1; i <= steps; i++) {
		if (context.abortSignal.aborted) {
			throw new Error('Execution cancelled');
		}

		const progress = Math.round((i / steps) * 100);
		const messages = [
			'Analyzing input...',
			'Processing with ' + node.skill.name + '...',
			'Generating output...',
			'Finalizing...'
		];

		emitProgress(progress, messages[i - 1]);
		await delay(500 + Math.random() * 500);
	}

	// Return simulated result
	return {
		skillId: node.skill.id,
		skillName: node.skill.name,
		output: `Processed by ${node.skill.name}`,
		timestamp: Date.now()
	};
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

class PipelineRunner {
	private abortController: AbortController | null = null;
	private pausePromise: { resolve: () => void; promise: Promise<void> } | null = null;

	// Svelte store for execution state
	public state = writable<ExecutionState>({
		status: 'idle',
		pipelineId: null,
		currentNodeId: null,
		currentNodeIndex: -1,
		totalNodes: 0,
		completedNodes: [],
		failedNodes: [],
		skippedNodes: [],
		startedAt: null,
		completedAt: null,
		error: null,
		results: new Map()
	});

	// Derived stores
	public status = derived(this.state, ($s) => $s.status);
	public progress = derived(this.state, ($s) =>
		$s.totalNodes > 0 ? ($s.completedNodes.length / $s.totalNodes) * 100 : 0
	);
	public isRunning = derived(this.state, ($s) => $s.status === 'running');
	public isPaused = derived(this.state, ($s) => $s.status === 'paused');
	public currentNode = derived(this.state, ($s) => $s.currentNodeId);

	/**
	 * Execute a pipeline
	 */
	async run(
		nodes: CanvasNode[],
		connections: Connection[],
		options: ExecutionOptions = {}
	): Promise<boolean> {
		const currentState = get(this.state);
		if (currentState.status === 'running' || currentState.status === 'paused') {
			console.warn('[PipelineRunner] Execution already in progress');
			return false;
		}

		// Sort nodes by execution order (topological sort based on connections)
		const orderedNodes = this.topologicalSort(nodes, connections);
		if (orderedNodes.length === 0) {
			console.warn('[PipelineRunner] No nodes to execute');
			return false;
		}

		const pipelineId = options.pipelineId || `pipeline_${Date.now()}`;
		const agentName = options.agentName || 'Claude';
		const executeNode = options.executeNode || defaultExecuteNode;

		// Initialize
		this.abortController = new AbortController();
		const results = new Map<string, NodeResult>();

		this.updateState({
			status: 'running',
			pipelineId,
			currentNodeId: null,
			currentNodeIndex: -1,
			totalNodes: orderedNodes.length,
			completedNodes: [],
			failedNodes: [],
			skippedNodes: [],
			startedAt: Date.now(),
			completedAt: null,
			error: null,
			results
		});

		// Emit pipeline start
		this.emit('pipeline_start', agentName, null, { pipelineId });

		try {
			// Execute each node
			for (let i = 0; i < orderedNodes.length; i++) {
				const node = orderedNodes[i];

				// Check for cancellation
				if (this.abortController.signal.aborted) {
					throw new Error('Execution cancelled');
				}

				// Wait if paused
				await this.waitIfPaused();

				// Update state
				this.updateState({
					currentNodeId: node.id,
					currentNodeIndex: i
				});

				// Emit agent enter
				this.emit('agent_enter', agentName, node.id, {
					pipelineId,
					skillId: node.skill.id,
					skillName: node.skill.name
				});
				options.onNodeStart?.(node.id);

				const startedAt = Date.now();

				try {
					// Create progress emitter
					const emitProgress = (progress: number, message?: string) => {
						this.emit('agent_progress', agentName, node.id, {
							progress,
							message,
							pipelineId
						});
						options.onProgress?.(node.id, progress, message);
					};

					// Create execution context
					const context: ExecutionContext = {
						pipelineId,
						nodeIndex: i,
						totalNodes: orderedNodes.length,
						previousResults: results,
						abortSignal: this.abortController.signal
					};

					// Emit thinking
					this.emit('agent_thinking', agentName, node.id, { pipelineId });

					// Execute node
					const output = await executeNode(node, context, emitProgress);

					const completedAt = Date.now();
					const result: NodeResult = {
						nodeId: node.id,
						skillId: node.skill.id,
						status: 'success',
						output,
						startedAt,
						completedAt,
						duration: completedAt - startedAt
					};

					results.set(node.id, result);

					// Emit output and exit
					this.emit('agent_output', agentName, node.id, {
						output,
						outputType: typeof output,
						pipelineId
					});

					this.emit('agent_exit', agentName, node.id, { pipelineId });

					// Update completed
					this.updateState({
						completedNodes: [...get(this.state).completedNodes, node.id],
						results
					});

					options.onNodeComplete?.(node.id, result);

					// Emit handoff to next node
					if (i < orderedNodes.length - 1) {
						const nextNode = orderedNodes[i + 1];
						this.emit('handoff_start', agentName, node.id, {
							targetNodeId: nextNode.id,
							pipelineId
						});

						await delay(300);

						this.emit('handoff_complete', agentName, nextNode.id, {
							sourceNodeId: node.id,
							pipelineId
						});
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';

					const result: NodeResult = {
						nodeId: node.id,
						skillId: node.skill.id,
						status: 'error',
						output: null,
						error: errorMessage,
						startedAt,
						completedAt: Date.now(),
						duration: Date.now() - startedAt
					};

					results.set(node.id, result);

					// Emit error
					this.emit('agent_error', agentName, node.id, {
						error: errorMessage,
						pipelineId
					});

					this.updateState({
						failedNodes: [...get(this.state).failedNodes, node.id],
						results
					});

					options.onNodeError?.(node.id, errorMessage);

					// Pipeline fails on first error
					throw error;
				}
			}

			// Pipeline complete
			const state = get(this.state);
			this.emit('pipeline_complete', agentName, null, {
				pipelineId,
				nodesCompleted: state.completedNodes.length,
				nodesSkipped: state.skippedNodes.length,
				nodesFailed: 0,
				totalDuration: Date.now() - (state.startedAt || Date.now())
			});

			this.updateState({
				status: 'completed',
				completedAt: Date.now(),
				currentNodeId: null
			});

			return true;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			const isCancelled = errorMessage === 'Execution cancelled';

			const state = get(this.state);
			this.emit('pipeline_failed', agentName, null, {
				pipelineId,
				error: errorMessage,
				nodesCompleted: state.completedNodes.length,
				nodesFailed: state.failedNodes.length
			});

			this.updateState({
				status: isCancelled ? 'cancelled' : 'failed',
				completedAt: Date.now(),
				error: errorMessage,
				currentNodeId: null
			});

			return false;
		} finally {
			this.abortController = null;
			this.pausePromise = null;
		}
	}

	/**
	 * Pause execution
	 */
	pause(): void {
		const state = get(this.state);
		if (state.status !== 'running') return;

		this.pausePromise = (() => {
			let resolve!: () => void;
			const promise = new Promise<void>((r) => {
				resolve = r;
			});
			return { resolve, promise };
		})();

		this.updateState({ status: 'paused' });
		console.log('[PipelineRunner] Execution paused');
	}

	/**
	 * Resume execution
	 */
	resume(): void {
		const state = get(this.state);
		if (state.status !== 'paused') return;

		if (this.pausePromise) {
			this.pausePromise.resolve();
			this.pausePromise = null;
		}

		this.updateState({ status: 'running' });
		console.log('[PipelineRunner] Execution resumed');
	}

	/**
	 * Cancel execution
	 */
	cancel(): void {
		if (this.abortController) {
			this.abortController.abort();
		}

		// Also resume if paused
		if (this.pausePromise) {
			this.pausePromise.resolve();
			this.pausePromise = null;
		}

		console.log('[PipelineRunner] Execution cancelled');
	}

	/**
	 * Reset state
	 */
	reset(): void {
		this.cancel();
		this.updateState({
			status: 'idle',
			pipelineId: null,
			currentNodeId: null,
			currentNodeIndex: -1,
			totalNodes: 0,
			completedNodes: [],
			failedNodes: [],
			skippedNodes: [],
			startedAt: null,
			completedAt: null,
			error: null,
			results: new Map()
		});
	}

	/**
	 * Wait if paused
	 */
	private async waitIfPaused(): Promise<void> {
		if (this.pausePromise) {
			await this.pausePromise.promise;
		}
	}

	/**
	 * Topological sort nodes based on connections
	 */
	private topologicalSort(nodes: CanvasNode[], connections: Connection[]): CanvasNode[] {
		if (nodes.length === 0) return [];

		// Build adjacency list and in-degree count
		const adjList = new Map<string, string[]>();
		const inDegree = new Map<string, number>();

		// Initialize
		for (const node of nodes) {
			adjList.set(node.id, []);
			inDegree.set(node.id, 0);
		}

		// Build graph
		for (const conn of connections) {
			const sourceAdj = adjList.get(conn.sourceNodeId);
			if (sourceAdj) {
				sourceAdj.push(conn.targetNodeId);
			}
			inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) || 0) + 1);
		}

		// Find nodes with no incoming edges
		const queue: string[] = [];
		for (const [nodeId, degree] of inDegree) {
			if (degree === 0) {
				queue.push(nodeId);
			}
		}

		// Process queue
		const result: CanvasNode[] = [];
		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		while (queue.length > 0) {
			const nodeId = queue.shift()!;
			const node = nodeMap.get(nodeId);
			if (node) {
				result.push(node);
			}

			for (const targetId of adjList.get(nodeId) || []) {
				const newDegree = (inDegree.get(targetId) || 0) - 1;
				inDegree.set(targetId, newDegree);
				if (newDegree === 0) {
					queue.push(targetId);
				}
			}
		}

		// If result doesn't include all nodes, there's a cycle - fall back to position order
		if (result.length !== nodes.length) {
			console.warn('[PipelineRunner] Cycle detected, using position-based order');
			return [...nodes].sort((a, b) => a.position.x - b.position.x);
		}

		return result;
	}

	/**
	 * Emit event
	 */
	private emit(
		type: AgentEvent['type'],
		agentId: string,
		nodeId: string | null,
		data?: Record<string, unknown>
	): void {
		const event = createAgentEvent(type, agentId, nodeId, data);
		eventRouter.dispatch(event);
	}

	/**
	 * Update state
	 */
	private updateState(partial: Partial<ExecutionState>): void {
		this.state.update((s) => ({ ...s, ...partial }));
	}

	/**
	 * Get current state
	 */
	getState(): ExecutionState {
		return get(this.state);
	}
}

// Export singleton instance
export const pipelineRunner = new PipelineRunner();

// Export class for testing
export { PipelineRunner };
