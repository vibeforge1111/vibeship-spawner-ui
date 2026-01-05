/**
 * Spawner Live - Compliance Tracker
 * Tracks whether Claude follows the pipeline
 */

import { writable, derived, get } from 'svelte/store';
import { eventRouter } from '../orchestrator/event-router';
import type { AgentEvent } from '../types/events';
import {
	type ComplianceState,
	type ComplianceStatus,
	type Deviation,
	type DeviationType,
	type DeviationSeverity,
	type ComplianceSummary,
	createDeviation,
	createDefaultComplianceState,
	calculateComplianceSummary
} from '../types/compliance';

class ComplianceTracker {
	private state: ComplianceState = createDefaultComplianceState();
	private unsubscribe: (() => void) | null = null;

	// Svelte stores
	public compliance = writable<ComplianceState>(createDefaultComplianceState());
	public summary = derived(this.compliance, ($c) => calculateComplianceSummary($c));

	// Derived convenience stores
	public score = derived(this.compliance, ($c) => $c.score);
	public status = derived(this.compliance, ($c) => $c.status);
	public deviations = derived(this.compliance, ($c) => $c.deviations);
	public isHealthy = derived(this.compliance, ($c) => $c.score >= 80);

	/**
	 * Initialize tracker with a pipeline
	 */
	init(pipelineId: string, nodeIds: string[]): void {
		// Stop any existing subscription
		if (this.unsubscribe) {
			this.unsubscribe();
		}

		// Reset state
		this.state = {
			...createDefaultComplianceState(),
			pipelineId,
			expectedSteps: nodeIds,
			status: 'not_started',
			startedAt: null,
			lastUpdated: new Date().toISOString()
		};

		this.updateStore();

		// Subscribe to events
		this.unsubscribe = eventRouter.subscribe({
			id: 'compliance-tracker',
			callback: (event) => this.handleEvent(event)
		});

		console.log(`[ComplianceTracker] Initialized with ${nodeIds.length} expected steps`);
	}

	/**
	 * Handle incoming events
	 */
	private handleEvent(event: AgentEvent): void {
		// Skip if wrong pipeline
		if (event.pipelineId && event.pipelineId !== this.state.pipelineId) {
			return;
		}

		this.state.lastUpdated = new Date().toISOString();

		switch (event.type) {
			case 'pipeline_start':
				this.onPipelineStart(event);
				break;
			case 'agent_enter':
				this.onNodeEnter(event);
				break;
			case 'agent_exit':
				this.onNodeExit(event);
				break;
			case 'agent_skip':
				this.onNodeSkip(event);
				break;
			case 'agent_error':
				this.onNodeError(event);
				break;
			case 'deviation_warn':
				this.onDeviation(event);
				break;
			case 'pipeline_complete':
				this.onPipelineComplete(event);
				break;
			case 'pipeline_failed':
				this.onPipelineFailed(event);
				break;
		}

		this.updateScore();
		this.updateStore();
	}

	/**
	 * Pipeline started
	 */
	private onPipelineStart(event: AgentEvent): void {
		this.state.status = 'following';
		this.state.startedAt = event.timestamp;
	}

	/**
	 * Node entered
	 */
	private onNodeEnter(event: AgentEvent): void {
		if (!event.nodeId) return;

		this.state.currentStep = event.nodeId;

		// Check if this is the expected next step
		const expectedIndex = this.state.completedSteps.length;
		const expectedNode = this.state.expectedSteps[expectedIndex];

		if (event.nodeId !== expectedNode) {
			// Check if it's out of order vs completely unexpected
			if (this.state.expectedSteps.includes(event.nodeId)) {
				// Out of order
				this.addDeviation(
					'out_of_order',
					`Expected "${expectedNode}" but agent entered "${event.nodeId}"`,
					event.nodeId,
					'warning'
				);
			} else {
				// Unexpected step (not in pipeline)
				this.addDeviation(
					'unexpected_step',
					`Agent working on "${event.nodeId}" which is not in the pipeline`,
					event.nodeId,
					'info'
				);
			}
			this.state.status = 'deviated';
		}
	}

	/**
	 * Node exited successfully
	 */
	private onNodeExit(event: AgentEvent): void {
		if (!event.nodeId) return;

		// Add to completed if not already there
		if (!this.state.completedSteps.includes(event.nodeId)) {
			this.state.completedSteps.push(event.nodeId);
		}

		this.state.currentStep = null;

		// Check if back on track
		if (this.state.status === 'deviated' && this.isOnTrack()) {
			this.state.status = 'following';
		}
	}

	/**
	 * Node skipped
	 */
	private onNodeSkip(event: AgentEvent): void {
		if (!event.nodeId) return;

		const reason = (event.data?.reason as string) || 'No reason provided';

		this.addDeviation(
			'skipped_step',
			`Skipped "${event.nodeId}": ${reason}`,
			event.nodeId,
			'warning'
		);
	}

	/**
	 * Node error
	 */
	private onNodeError(event: AgentEvent): void {
		if (!event.nodeId) return;

		// Mark current step as failed (not skipped)
		this.state.currentStep = null;
	}

	/**
	 * Explicit deviation warning
	 */
	private onDeviation(event: AgentEvent): void {
		const message = (event.data?.message as string) || 'Unknown deviation';
		const severity = (event.data?.severity as DeviationSeverity) || 'warning';

		this.addDeviation('unknown_action', message, event.nodeId, severity);
		this.state.status = 'deviated';
	}

	/**
	 * Pipeline completed
	 */
	private onPipelineComplete(event: AgentEvent): void {
		// Check for any steps that were never executed
		const skipped = this.state.expectedSteps.filter(
			(step) => !this.state.completedSteps.includes(step)
		);

		skipped.forEach((nodeId) => {
			this.addDeviation(
				'skipped_step',
				`Step "${nodeId}" was never executed`,
				nodeId,
				'warning'
			);
		});

		this.state.status = this.state.deviations.length > 0 ? 'deviated' : 'completed';
	}

	/**
	 * Pipeline failed
	 */
	private onPipelineFailed(event: AgentEvent): void {
		this.state.status = 'failed';
	}

	/**
	 * Add a deviation to the record
	 */
	private addDeviation(
		type: DeviationType,
		message: string,
		nodeId: string | null,
		severity: DeviationSeverity
	): void {
		const deviation = createDeviation(type, message, nodeId, severity);
		this.state.deviations.push(deviation);
	}

	/**
	 * Check if we're back on the expected track
	 */
	private isOnTrack(): boolean {
		if (this.state.completedSteps.length === 0) return true;

		const lastCompleted = this.state.completedSteps[this.state.completedSteps.length - 1];
		const expectedIndex = this.state.expectedSteps.indexOf(lastCompleted);

		// We're on track if the last completed step is at the expected position
		return expectedIndex === this.state.completedSteps.length - 1;
	}

	/**
	 * Calculate and update compliance score
	 */
	private updateScore(): void {
		const totalSteps = this.state.expectedSteps.length;
		if (totalSteps === 0) {
			this.state.score = 100;
			return;
		}

		// Count completed expected steps
		const completedExpected = this.state.completedSteps.filter((step) =>
			this.state.expectedSteps.includes(step)
		).length;

		// Base score from completion
		let score = (completedExpected / totalSteps) * 100;

		// Penalty for deviations
		this.state.deviations.forEach((d) => {
			switch (d.severity) {
				case 'error':
					score -= 15;
					break;
				case 'warning':
					score -= 5;
					break;
				case 'info':
					score -= 1;
					break;
			}
		});

		this.state.score = Math.max(0, Math.round(score));
	}

	/**
	 * Acknowledge a deviation
	 */
	acknowledgeDeviation(deviationId: string): void {
		const deviation = this.state.deviations.find((d) => d.id === deviationId);
		if (deviation) {
			deviation.acknowledged = true;
			this.updateStore();
		}
	}

	/**
	 * Acknowledge all deviations
	 */
	acknowledgeAll(): void {
		this.state.deviations.forEach((d) => {
			d.acknowledged = true;
		});
		this.updateStore();
	}

	/**
	 * Get progress (0-1)
	 */
	getProgress(): number {
		if (this.state.expectedSteps.length === 0) return 0;
		return this.state.completedSteps.length / this.state.expectedSteps.length;
	}

	/**
	 * Get current step index
	 */
	getCurrentStepIndex(): number {
		if (!this.state.currentStep) return -1;
		return this.state.expectedSteps.indexOf(this.state.currentStep);
	}

	/**
	 * Get unacknowledged deviations
	 */
	getUnacknowledged(): Deviation[] {
		return this.state.deviations.filter((d) => !d.acknowledged);
	}

	/**
	 * Update the Svelte store
	 */
	private updateStore(): void {
		this.compliance.set({ ...this.state });
	}

	/**
	 * Reset tracker
	 */
	reset(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}

		this.state = createDefaultComplianceState();
		this.updateStore();
	}

	/**
	 * Get current state (non-reactive)
	 */
	getState(): ComplianceState {
		return { ...this.state };
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.reset();
	}
}

// Export singleton instance
export const complianceTracker = new ComplianceTracker();

// Export class for testing
export { ComplianceTracker };
