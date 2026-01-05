/**
 * Spawner Live - Mock Event Source
 * Simulates agent execution events for testing and demos
 */

import { eventRouter } from '../orchestrator/event-router';
import { createAgentEvent, type AgentEventType } from '../types/events';

interface MockExecutionOptions {
	pipelineId?: string;
	nodeIds: string[];
	agentName?: string;
	delayBetweenNodes?: number;
	progressSteps?: number;
	errorProbability?: number;
	skipProbability?: number;
	onComplete?: () => void;
	onError?: (nodeId: string, error: string) => void;
}

class MockEventSource {
	private running = false;
	private paused = false;
	private currentExecution: AbortController | null = null;

	/**
	 * Simulate a complete pipeline execution
	 */
	async runPipeline(options: MockExecutionOptions): Promise<boolean> {
		if (this.running) {
			console.warn('[MockEventSource] Execution already in progress');
			return false;
		}

		this.running = true;
		this.paused = false;
		this.currentExecution = new AbortController();

		const {
			pipelineId = `pipeline_${Date.now()}`,
			nodeIds,
			agentName = 'Claude',
			delayBetweenNodes = 1000,
			progressSteps = 4,
			errorProbability = 0,
			skipProbability = 0,
			onComplete,
			onError
		} = options;

		try {
			// Pipeline start
			this.emit('pipeline_start', agentName, null, { pipelineId });
			await this.delay(500);

			// Process each node
			for (let i = 0; i < nodeIds.length; i++) {
				if (this.currentExecution?.signal.aborted) {
					throw new Error('Execution cancelled');
				}

				// Wait if paused
				while (this.paused) {
					await this.delay(100);
					if (this.currentExecution?.signal.aborted) {
						throw new Error('Execution cancelled');
					}
				}

				const nodeId = nodeIds[i];
				const shouldError = Math.random() < errorProbability;
				const shouldSkip = Math.random() < skipProbability;

				if (shouldSkip) {
					// Skip this node
					this.emit('agent_skip', agentName, nodeId, {
						reason: 'Conditions not met',
						pipelineId
					});
					await this.delay(delayBetweenNodes / 2);
					continue;
				}

				// Agent enters node
				this.emit('agent_enter', agentName, nodeId, { pipelineId });
				await this.delay(300);

				// Progress updates
				for (let p = 0; p <= 100; p += Math.floor(100 / progressSteps)) {
					if (this.currentExecution?.signal.aborted) {
						throw new Error('Execution cancelled');
					}

					while (this.paused) {
						await this.delay(100);
					}

					// Thinking phase
					if (p < 50) {
						this.emit('agent_thinking', agentName, nodeId, { pipelineId });
					}

					// Progress update
					this.emit('agent_progress', agentName, nodeId, {
						progress: Math.min(p, 100),
						message: this.getProgressMessage(p),
						pipelineId
					});

					await this.delay(delayBetweenNodes / progressSteps);
				}

				// Check for error
				if (shouldError) {
					this.emit('agent_error', agentName, nodeId, {
						error: 'Simulated error occurred',
						errorCode: 'MOCK_ERROR',
						pipelineId
					});
					onError?.(nodeId, 'Simulated error');

					// Pipeline fails
					this.emit('pipeline_failed', agentName, null, {
						error: `Node ${nodeId} failed`,
						nodesCompleted: i,
						nodesFailed: 1,
						pipelineId
					});

					this.running = false;
					return false;
				}

				// Agent output
				this.emit('agent_output', agentName, nodeId, {
					output: { result: 'Success' },
					outputType: 'json',
					pipelineId
				});
				await this.delay(200);

				// Agent exits
				this.emit('agent_exit', agentName, nodeId, { pipelineId });
				await this.delay(200);

				// Handoff to next node
				if (i < nodeIds.length - 1) {
					const nextNodeId = nodeIds[i + 1];

					this.emit('handoff_start', agentName, nodeId, {
						targetNodeId: nextNodeId,
						payload: { previousResult: 'Success' },
						pipelineId
					});

					await this.delay(500);

					this.emit('handoff_complete', agentName, nextNodeId, {
						sourceNodeId: nodeId,
						pipelineId
					});

					await this.delay(300);
				}
			}

			// Pipeline complete
			this.emit('pipeline_complete', agentName, null, {
				nodesCompleted: nodeIds.length,
				nodesSkipped: 0,
				nodesFailed: 0,
				totalDuration: Date.now(),
				pipelineId
			});

			onComplete?.();
			this.running = false;
			return true;
		} catch (error) {
			console.log('[MockEventSource] Execution stopped:', error);
			this.running = false;
			return false;
		}
	}

	/**
	 * Emit a single event
	 */
	emit(
		type: AgentEventType,
		agentId: string,
		nodeId: string | null,
		data?: Record<string, unknown>
	): void {
		const event = createAgentEvent(type, agentId, nodeId, data);
		eventRouter.dispatch(event);
	}

	/**
	 * Simulate a deviation
	 */
	emitDeviation(agentId: string, nodeId: string | null, message: string, severity: 'info' | 'warning' | 'error' = 'warning'): void {
		this.emit('deviation_warn', agentId, nodeId, {
			message,
			severity,
			timestamp: Date.now()
		});
	}

	/**
	 * Pause execution
	 */
	pause(): void {
		this.paused = true;
		console.log('[MockEventSource] Execution paused');
	}

	/**
	 * Resume execution
	 */
	resume(): void {
		this.paused = false;
		console.log('[MockEventSource] Execution resumed');
	}

	/**
	 * Stop execution
	 */
	stop(): void {
		if (this.currentExecution) {
			this.currentExecution.abort();
			this.currentExecution = null;
		}
		this.running = false;
		this.paused = false;
		console.log('[MockEventSource] Execution stopped');
	}

	/**
	 * Check if running
	 */
	isRunning(): boolean {
		return this.running;
	}

	/**
	 * Check if paused
	 */
	isPaused(): boolean {
		return this.paused;
	}

	/**
	 * Get progress message
	 */
	private getProgressMessage(progress: number): string {
		if (progress < 25) return 'Analyzing input...';
		if (progress < 50) return 'Processing...';
		if (progress < 75) return 'Generating output...';
		if (progress < 100) return 'Finalizing...';
		return 'Complete';
	}

	/**
	 * Delay helper
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Quick demo - single node execution
	 */
	async demoSingleNode(nodeId: string, agentName: string = 'Claude'): Promise<void> {
		this.emit('agent_enter', agentName, nodeId);
		await this.delay(300);

		for (let p = 0; p <= 100; p += 25) {
			this.emit('agent_progress', agentName, nodeId, { progress: p });
			await this.delay(400);
		}

		this.emit('agent_exit', agentName, nodeId);
	}

	/**
	 * Quick demo - error on node
	 */
	async demoError(nodeId: string, agentName: string = 'Claude'): Promise<void> {
		this.emit('agent_enter', agentName, nodeId);
		await this.delay(300);

		for (let p = 0; p <= 50; p += 25) {
			this.emit('agent_progress', agentName, nodeId, { progress: p });
			await this.delay(300);
		}

		this.emit('agent_error', agentName, nodeId, {
			error: 'Something went wrong',
			errorCode: 'DEMO_ERROR'
		});
	}

	/**
	 * Quick demo - handoff between two nodes
	 */
	async demoHandoff(sourceNodeId: string, targetNodeId: string, agentName: string = 'Claude'): Promise<void> {
		// Complete source
		this.emit('agent_enter', agentName, sourceNodeId);
		await this.delay(500);
		this.emit('agent_exit', agentName, sourceNodeId);
		await this.delay(200);

		// Handoff
		this.emit('handoff_start', agentName, sourceNodeId, { targetNodeId });
		await this.delay(800);
		this.emit('handoff_complete', agentName, targetNodeId, { sourceNodeId });
		await this.delay(200);

		// Start target
		this.emit('agent_enter', agentName, targetNodeId);
	}
}

// Export singleton instance
export const mockEventSource = new MockEventSource();

// Export class for testing
export { MockEventSource };
