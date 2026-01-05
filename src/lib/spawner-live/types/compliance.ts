/**
 * Spawner Live - Compliance Types
 * Types for pipeline compliance tracking and deviation detection
 */

// Compliance status
export type ComplianceStatus =
	| 'not_started' // Pipeline hasn't begun
	| 'following' // Claude is following the pipeline
	| 'deviated' // Claude has deviated from the pipeline
	| 'completed' // Pipeline completed (with or without deviations)
	| 'failed'; // Pipeline failed

// Deviation types
export type DeviationType =
	| 'unexpected_step' // Working on something not in pipeline
	| 'skipped_step' // Skipped a pipeline step
	| 'out_of_order' // Executed step in wrong order
	| 'unknown_action' // Unrecognized action
	| 'critical_skip'; // Skipped a required step

// Deviation severity
export type DeviationSeverity = 'info' | 'warning' | 'error';

// Deviation record
export interface Deviation {
	id: string;
	timestamp: string;
	type: DeviationType;
	nodeId: string | null;
	message: string;
	severity: DeviationSeverity;
	expectedNodeId?: string;
	actualNodeId?: string;
	reason?: string;
	acknowledged: boolean;
}

// Full compliance state
export interface ComplianceState {
	pipelineId: string | null;
	expectedSteps: string[];
	completedSteps: string[];
	currentStep: string | null;
	deviations: Deviation[];
	score: number; // 0-100
	status: ComplianceStatus;
	startedAt: string | null;
	lastUpdated: string | null;
}

// Compliance event for UI updates
export interface ComplianceEvent {
	type: 'status_change' | 'deviation' | 'step_complete' | 'score_update';
	timestamp: string;
	data: {
		previousStatus?: ComplianceStatus;
		newStatus?: ComplianceStatus;
		deviation?: Deviation;
		stepId?: string;
		score?: number;
	};
}

// Step status for tracking
export interface StepStatus {
	nodeId: string;
	status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
	required: boolean;
	order: number;
	dependencies: string[];
	completedAt?: string;
	skippedReason?: string;
	errorMessage?: string;
}

// Compliance configuration
export interface ComplianceConfig {
	strictMode: boolean; // Fail on any deviation
	allowExtraSteps: boolean; // Allow steps not in pipeline
	allowOutOfOrder: boolean; // Allow non-sequential execution
	requiredSteps: string[]; // Steps that cannot be skipped
	scoreWeights: {
		completedStep: number;
		skippedStep: number;
		outOfOrder: number;
		unexpectedStep: number;
	};
}

// Default compliance config
export const defaultComplianceConfig: ComplianceConfig = {
	strictMode: false,
	allowExtraSteps: true,
	allowOutOfOrder: false,
	requiredSteps: [],
	scoreWeights: {
		completedStep: 10,
		skippedStep: -5,
		outOfOrder: -3,
		unexpectedStep: -1
	}
};

// Compliance summary for display
export interface ComplianceSummary {
	score: number;
	status: ComplianceStatus;
	totalSteps: number;
	completedSteps: number;
	skippedSteps: number;
	deviationCount: number;
	deviationsByType: Record<DeviationType, number>;
	deviationsBySeverity: Record<DeviationSeverity, number>;
	isHealthy: boolean; // score >= 80
}

// Helper functions
export function createDeviation(
	type: DeviationType,
	message: string,
	nodeId: string | null = null,
	severity: DeviationSeverity = 'warning'
): Deviation {
	return {
		id: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
		timestamp: new Date().toISOString(),
		type,
		nodeId,
		message,
		severity,
		acknowledged: false
	};
}

export function createDefaultComplianceState(): ComplianceState {
	return {
		pipelineId: null,
		expectedSteps: [],
		completedSteps: [],
		currentStep: null,
		deviations: [],
		score: 100,
		status: 'not_started',
		startedAt: null,
		lastUpdated: null
	};
}

export function calculateComplianceSummary(state: ComplianceState): ComplianceSummary {
	const deviationsByType: Record<DeviationType, number> = {
		unexpected_step: 0,
		skipped_step: 0,
		out_of_order: 0,
		unknown_action: 0,
		critical_skip: 0
	};

	const deviationsBySeverity: Record<DeviationSeverity, number> = {
		info: 0,
		warning: 0,
		error: 0
	};

	state.deviations.forEach((d) => {
		deviationsByType[d.type]++;
		deviationsBySeverity[d.severity]++;
	});

	const skippedSteps = state.expectedSteps.filter(
		(step) => !state.completedSteps.includes(step)
	).length;

	return {
		score: state.score,
		status: state.status,
		totalSteps: state.expectedSteps.length,
		completedSteps: state.completedSteps.length,
		skippedSteps,
		deviationCount: state.deviations.length,
		deviationsByType,
		deviationsBySeverity,
		isHealthy: state.score >= 80
	};
}

// Severity color mapping
export const severityColors: Record<DeviationSeverity, string> = {
	info: '#3b82f6', // blue-500
	warning: '#f59e0b', // amber-500
	error: '#ef4444' // red-500
};

// Deviation type labels
export const deviationTypeLabels: Record<DeviationType, string> = {
	unexpected_step: 'Unexpected Step',
	skipped_step: 'Skipped Step',
	out_of_order: 'Out of Order',
	unknown_action: 'Unknown Action',
	critical_skip: 'Critical Skip'
};
