/**
 * Task Completion Gates Service
 *
 * Prevents marking tasks complete without verification.
 * v1.1: Blocking quality gates with configurable thresholds and rework feedback.
 */

import type { MissionTask } from '$lib/types/mission';

export type GateType = 'build' | 'test' | 'typecheck' | 'lint' | 'artifacts' | 'manual';

/** Quality threshold for general tasks */
export const QUALITY_THRESHOLD = 60;
/** Stricter threshold for testing/deployment tasks */
export const QUALITY_THRESHOLD_STRICT = 75;
/** Max retries before marking task as failed */
export const MAX_TASK_RETRIES = 2;
/** Strict-mode categories that use the higher threshold */
const STRICT_CATEGORIES = ['testing', 'deployment'];

export interface CompletionGate {
	type: GateType;
	command?: string;
	required: boolean;
	description: string;
}

export interface GateResult {
	gate: CompletionGate;
	passed: boolean;
	message?: string;
	duration?: number;
}

export interface TaskCompletionQuality {
	taskId: string;
	taskName: string;
	skillsLoaded: boolean;      // +25 points
	artifactsCreated: boolean;  // +25 points
	noErrors: boolean;          // +25 points
	gatesPassed: boolean;       // +25 points
	score: number;              // 0-100
	details: string[];
}

export interface ReworkInstruction {
	taskId: string;
	taskName: string;
	score: number;
	threshold: number;
	failedFactors: string[];
	instructions: string;
}

// Category-based gate definitions
const CATEGORY_GATES: Record<string, CompletionGate[]> = {
	'setup': [
		{ type: 'build', command: 'npm run build', required: false, description: 'Project builds successfully' }
	],
	'testing': [
		{ type: 'test', command: 'npm run test', required: true, description: 'Tests pass' }
	],
	'deployment': [
		{ type: 'build', command: 'npm run build', required: true, description: 'Production build succeeds' },
		{ type: 'typecheck', command: 'npx tsc --noEmit', required: true, description: 'No type errors' }
	],
	'auth': [
		{ type: 'typecheck', command: 'npx tsc --noEmit', required: false, description: 'Auth code type-safe' }
	],
	'database': [
		{ type: 'typecheck', command: 'npx tsc --noEmit', required: false, description: 'Schema types valid' }
	],
	'default': []  // Features don't block on gates, but track completion quality
};

/**
 * Get completion gates for a task based on its category
 */
export function getCompletionGates(task: MissionTask): CompletionGate[] {
	// Infer category from task title/description
	const category = inferTaskCategory(task);
	return CATEGORY_GATES[category] || CATEGORY_GATES['default'];
}

/**
 * Infer task category from title and description
 */
function inferTaskCategory(task: MissionTask): string {
	const text = `${task.title} ${task.description}`.toLowerCase();

	if (text.includes('test') || text.includes('spec') || text.includes('coverage')) {
		return 'testing';
	}
	if (text.includes('deploy') || text.includes('production') || text.includes('ci/cd')) {
		return 'deployment';
	}
	if (text.includes('setup') || text.includes('install') || text.includes('configure') || text.includes('initialize')) {
		return 'setup';
	}
	if (text.includes('auth') || text.includes('login') || text.includes('session') || text.includes('oauth')) {
		return 'auth';
	}
	if (text.includes('database') || text.includes('schema') || text.includes('migration') || text.includes('drizzle')) {
		return 'database';
	}

	return 'default';
}

/**
 * Calculate task completion quality score
 */
export function calculateCompletionQuality(
	taskId: string,
	taskName: string,
	factors: {
		skillsLoaded: boolean;
		artifactsCreated: boolean;
		noErrors: boolean;
		gatesPassed: boolean;
	}
): TaskCompletionQuality {
	const details: string[] = [];
	let score = 0;

	if (factors.skillsLoaded) {
		score += 25;
		details.push('Skills loaded');
	} else {
		details.push('Missing: skills not loaded');
	}

	if (factors.artifactsCreated) {
		score += 25;
		details.push('Artifacts created');
	} else {
		details.push('Missing: no artifacts detected');
	}

	if (factors.noErrors) {
		score += 25;
		details.push('No errors');
	} else {
		details.push('Warning: errors occurred');
	}

	if (factors.gatesPassed) {
		score += 25;
		details.push('Gates passed');
	} else {
		details.push('Warning: gates not verified');
	}

	return {
		taskId,
		taskName,
		...factors,
		score,
		details
	};
}

/**
 * Get the quality threshold for a task based on its category.
 * Testing/deployment tasks use the stricter threshold.
 */
export function getQualityThreshold(task?: MissionTask): number {
	if (!task) return QUALITY_THRESHOLD;
	const category = inferTaskCategory(task);
	return STRICT_CATEGORIES.includes(category) ? QUALITY_THRESHOLD_STRICT : QUALITY_THRESHOLD;
}

/**
 * Check if a task completion should be flagged as low quality.
 * Uses configurable thresholds: 60 (general) or 75 (testing/deployment).
 */
export function isLowQualityCompletion(quality: TaskCompletionQuality, task?: MissionTask): boolean {
	const threshold = getQualityThreshold(task);
	return quality.score < threshold;
}

/**
 * Build a rework instruction for a rejected task.
 * Provides actionable feedback so the agent knows exactly what to fix.
 */
export function buildReworkInstruction(quality: TaskCompletionQuality, task?: MissionTask): ReworkInstruction {
	const threshold = getQualityThreshold(task);
	const failedFactors: string[] = [];
	const fixes: string[] = [];

	if (!quality.skillsLoaded) {
		failedFactors.push('skillsLoaded');
		fixes.push('Load required H70 skills before starting the task (emit SKILL_LOADED event)');
	}
	if (!quality.artifactsCreated) {
		failedFactors.push('artifactsCreated');
		fixes.push('Create or modify files — the task produced no detectable file changes');
	}
	if (!quality.noErrors) {
		failedFactors.push('noErrors');
		fixes.push('Fix reported errors before marking the task complete');
	}
	if (!quality.gatesPassed) {
		failedFactors.push('gatesPassed');
		fixes.push('Ensure build and typecheck pass (run npm run build and npx tsc --noEmit)');
	}

	const instructions = [
		`Task "${quality.taskName}" scored ${quality.score}/100 (threshold: ${threshold}).`,
		'',
		'Required fixes:',
		...fixes.map((f, i) => `${i + 1}. ${f}`),
		'',
		'Re-attempt the task addressing all issues above, then report task_completed again.'
	].join('\n');

	return {
		taskId: quality.taskId,
		taskName: quality.taskName,
		score: quality.score,
		threshold,
		failedFactors,
		instructions
	};
}

/**
 * Generate completion quality report
 */
export function formatQualityReport(qualities: TaskCompletionQuality[]): string {
	const lines: string[] = [];

	lines.push('## Task Completion Quality Report');
	lines.push('');

	const avgScore = qualities.reduce((sum, q) => sum + q.score, 0) / qualities.length;
	lines.push(`**Average Score:** ${Math.round(avgScore)}/100`);
	lines.push('');

	const lowQuality = qualities.filter(q => q.score < 50);
	if (lowQuality.length > 0) {
		lines.push(`⚠️ **${lowQuality.length} tasks with low quality completion:**`);
		for (const q of lowQuality) {
			lines.push(`- ${q.taskName}: ${q.score}/100`);
		}
		lines.push('');
	}

	lines.push('### Task Details');
	lines.push('');
	lines.push('| Task | Score | Skills | Artifacts | Errors | Gates |');
	lines.push('|------|-------|--------|-----------|--------|-------|');

	for (const q of qualities) {
		const icon = q.score >= 75 ? '✅' : q.score >= 50 ? '⚠️' : '❌';
		lines.push(
			`| ${q.taskName} | ${icon} ${q.score} | ${q.skillsLoaded ? '✓' : '✗'} | ${q.artifactsCreated ? '✓' : '✗'} | ${q.noErrors ? '✓' : '✗'} | ${q.gatesPassed ? '✓' : '✗'} |`
		);
	}

	return lines.join('\n');
}

/**
 * Validate that a task can be marked as complete
 * Returns issues that should be addressed
 */
export function validateTaskCompletion(
	task: MissionTask,
	loadedSkills: string[],
	requiredSkills: string[],
	hasErrors: boolean
): { canComplete: boolean; issues: string[] } {
	const issues: string[] = [];

	// Check if required skills were loaded
	const missingSkills = requiredSkills.filter(s => !loadedSkills.includes(s));
	if (missingSkills.length > 0) {
		issues.push(`Skills not loaded: ${missingSkills.join(', ')}`);
	}

	// Check for errors
	if (hasErrors) {
		issues.push('Task reported errors');
	}

	// Get gates and check if any are required
	const gates = getCompletionGates(task);
	const requiredGates = gates.filter(g => g.required);
	if (requiredGates.length > 0) {
		issues.push(`Required gates not verified: ${requiredGates.map(g => g.type).join(', ')}`);
	}

	return {
		canComplete: issues.length === 0,
		issues
	};
}
