/**
 * End-of-Project Checkpoint Service
 *
 * Single human verification point AFTER all automated work is done.
 * Generates a comprehensive review summary for human QA.
 */

import type { Mission, MissionTask } from '$lib/services/mcp-client';
import type { TaskCompletionQuality } from './completion-gates';

export interface AutomatedResults {
	tasksCompleted: number;
	tasksFailed: number;
	tasksSkipped: number;
	testsRun: number;
	testsPassed: number;
	buildSucceeded: boolean | null;  // null = not run
	typeCheckPassed: boolean | null;
	lintPassed: boolean | null;
}

export interface QualityMetrics {
	skillUsageRatio: number;      // 0-1 (loaded skills / required skills)
	averageTaskQuality: number;   // 0-100
	completionRate: number;       // 0-1 (completed / total)
}

export interface ManualTestSuggestion {
	category: string;
	tests: string[];
}

export interface ReviewSummary {
	summary: string;
	filesCreated: string[];
	filesModified: string[];
	manualTestSuggestions: ManualTestSuggestion[];
	knownIssues: string[];
}

export interface ProjectCheckpoint {
	missionId: string;
	missionName: string;
	completedAt: Date;
	duration: number;  // in seconds

	// Automated Results
	automated: AutomatedResults;

	// Quality Metrics
	quality: QualityMetrics;

	// For Human Review
	review: ReviewSummary;

	// Task quality details
	taskQualities: TaskCompletionQuality[];

	// Overall status
	status: 'success' | 'partial' | 'failed';
	canShip: boolean;
}

/**
 * Generate a project checkpoint from mission execution
 */
export function generateCheckpoint(
	mission: Mission,
	options: {
		loadedSkills: string[];
		requiredSkills: string[];
		taskQualities: TaskCompletionQuality[];
		startTime: Date;
		endTime: Date;
		logs: Array<{ level: string; message: string }>;
	}
): ProjectCheckpoint {
	const { loadedSkills, requiredSkills, taskQualities, startTime, endTime, logs } = options;

	// Calculate automated results
	const automated = calculateAutomatedResults(mission, logs);

	// Calculate quality metrics
	const quality = calculateQualityMetrics(mission, loadedSkills, requiredSkills, taskQualities);

	// Generate review summary
	const review = generateReviewSummary(mission, taskQualities, logs);

	// Determine overall status
	const status = determineStatus(automated, quality);
	const canShip = status === 'success' && quality.completionRate >= 0.9;

	return {
		missionId: mission.id,
		missionName: mission.name,
		completedAt: endTime,
		duration: Math.round((endTime.getTime() - startTime.getTime()) / 1000),
		automated,
		quality,
		review,
		taskQualities,
		status,
		canShip
	};
}

/**
 * Calculate automated test results from mission state
 */
function calculateAutomatedResults(
	mission: Mission,
	logs: Array<{ level: string; message: string }>
): AutomatedResults {
	const tasks = mission.tasks;

	const tasksCompleted = tasks.filter(t => t.status === 'completed').length;
	const tasksFailed = tasks.filter(t => t.status === 'failed').length;
	const tasksSkipped = tasks.filter(t => t.status === 'pending').length;

	// Parse logs for test/build results
	let testsRun = 0;
	let testsPassed = 0;
	let buildSucceeded: boolean | null = null;
	let typeCheckPassed: boolean | null = null;
	let lintPassed: boolean | null = null;

	for (const log of logs) {
		const msg = log.message.toLowerCase();

		// Detect test results
		if (msg.includes('test') && msg.includes('passed')) {
			const match = msg.match(/(\d+)\s*(tests?|specs?)\s*passed/i);
			if (match) {
				testsPassed += parseInt(match[1], 10);
				testsRun += parseInt(match[1], 10);
			}
		}
		if (msg.includes('test') && msg.includes('failed')) {
			const match = msg.match(/(\d+)\s*(tests?|specs?)\s*failed/i);
			if (match) {
				testsRun += parseInt(match[1], 10);
			}
		}

		// Detect build results
		if (msg.includes('build') && msg.includes('success')) {
			buildSucceeded = true;
		}
		if (msg.includes('build') && msg.includes('failed')) {
			buildSucceeded = false;
		}

		// Detect type check results
		if (msg.includes('tsc') || msg.includes('type')) {
			if (msg.includes('error')) {
				typeCheckPassed = false;
			} else if (msg.includes('success') || msg.includes('no error')) {
				typeCheckPassed = true;
			}
		}

		// Detect lint results
		if (msg.includes('lint')) {
			if (msg.includes('error')) {
				lintPassed = false;
			} else if (msg.includes('success') || msg.includes('no error') || msg.includes('passed')) {
				lintPassed = true;
			}
		}
	}

	return {
		tasksCompleted,
		tasksFailed,
		tasksSkipped,
		testsRun,
		testsPassed,
		buildSucceeded,
		typeCheckPassed,
		lintPassed
	};
}

/**
 * Calculate quality metrics
 */
function calculateQualityMetrics(
	mission: Mission,
	loadedSkills: string[],
	requiredSkills: string[],
	taskQualities: TaskCompletionQuality[]
): QualityMetrics {
	// Skill usage ratio
	const skillUsageRatio = requiredSkills.length > 0
		? loadedSkills.filter(s => requiredSkills.includes(s)).length / requiredSkills.length
		: 1;

	// Average task quality
	const averageTaskQuality = taskQualities.length > 0
		? taskQualities.reduce((sum, q) => sum + q.score, 0) / taskQualities.length
		: 0;

	// Completion rate
	const completedTasks = mission.tasks.filter(t => t.status === 'completed').length;
	const completionRate = mission.tasks.length > 0
		? completedTasks / mission.tasks.length
		: 0;

	return {
		skillUsageRatio,
		averageTaskQuality,
		completionRate
	};
}

/**
 * Generate review summary for human verification
 */
function generateReviewSummary(
	mission: Mission,
	taskQualities: TaskCompletionQuality[],
	logs: Array<{ level: string; message: string }>
): ReviewSummary {
	// Generate summary text
	const completedTasks = mission.tasks.filter(t => t.status === 'completed');
	const failedTasks = mission.tasks.filter(t => t.status === 'failed');

	let summary = `Mission "${mission.name}" `;
	if (failedTasks.length === 0 && completedTasks.length === mission.tasks.length) {
		summary += `completed successfully with all ${mission.tasks.length} tasks.`;
	} else if (failedTasks.length > 0) {
		summary += `completed with ${failedTasks.length} failed task(s) out of ${mission.tasks.length}.`;
	} else {
		summary += `partially completed: ${completedTasks.length}/${mission.tasks.length} tasks done.`;
	}

	// Collect known issues
	const knownIssues: string[] = [];

	// Low quality tasks
	const lowQualityTasks = taskQualities.filter(q => q.score < 50);
	if (lowQualityTasks.length > 0) {
		knownIssues.push(`${lowQualityTasks.length} task(s) completed with low quality score`);
	}

	// Failed tasks
	for (const task of failedTasks) {
		knownIssues.push(`Task failed: ${task.title}`);
	}

	// Error logs
	const errorLogs = logs.filter(l => l.level === 'error');
	if (errorLogs.length > 0) {
		knownIssues.push(`${errorLogs.length} error(s) logged during execution`);
	}

	// Generate manual test suggestions based on completed features
	const manualTestSuggestions = generateManualTestSuggestions(completedTasks);

	return {
		summary,
		filesCreated: [], // Would need file system access
		filesModified: [], // Would need file system access
		manualTestSuggestions,
		knownIssues
	};
}

/**
 * Generate manual test suggestions based on implemented features
 */
function generateManualTestSuggestions(completedTasks: MissionTask[]): ManualTestSuggestion[] {
	const suggestions: ManualTestSuggestion[] = [];
	const addedCategories = new Set<string>();

	for (const task of completedTasks) {
		const text = `${task.title} ${task.description}`.toLowerCase();

		// Auth features
		if ((text.includes('auth') || text.includes('login') || text.includes('session')) && !addedCategories.has('auth')) {
			addedCategories.add('auth');
			suggestions.push({
				category: 'Authentication',
				tests: [
					'Test login flow with valid credentials',
					'Test login with invalid credentials',
					'Test logout functionality',
					'Verify session persists on page refresh',
					'Test password reset flow (if implemented)'
				]
			});
		}

		// Payment features
		if ((text.includes('payment') || text.includes('stripe') || text.includes('checkout')) && !addedCategories.has('payments')) {
			addedCategories.add('payments');
			suggestions.push({
				category: 'Payments',
				tests: [
					'Test checkout with Stripe test card (4242...)',
					'Verify webhook handling for payment events',
					'Test subscription upgrade/downgrade',
					'Verify receipt/invoice generation'
				]
			});
		}

		// Real-time features
		if ((text.includes('realtime') || text.includes('websocket') || text.includes('live')) && !addedCategories.has('realtime')) {
			addedCategories.add('realtime');
			suggestions.push({
				category: 'Real-time Features',
				tests: [
					'Test WebSocket connection establishment',
					'Verify real-time updates across browser tabs',
					'Test reconnection after network disconnect',
					'Verify presence indicators (if implemented)'
				]
			});
		}

		// File upload features
		if ((text.includes('upload') || text.includes('file') || text.includes('storage')) && !addedCategories.has('uploads')) {
			addedCategories.add('uploads');
			suggestions.push({
				category: 'File Uploads',
				tests: [
					'Test file upload with valid file types',
					'Test upload with invalid/oversized files',
					'Verify file preview/download works',
					'Test upload progress indication'
				]
			});
		}

		// API features
		if ((text.includes('api') || text.includes('endpoint') || text.includes('rest')) && !addedCategories.has('api')) {
			addedCategories.add('api');
			suggestions.push({
				category: 'API Endpoints',
				tests: [
					'Test all CRUD operations',
					'Verify authentication on protected routes',
					'Test error responses (400, 401, 404, 500)',
					'Verify rate limiting (if implemented)'
				]
			});
		}

		// Mobile/responsive features
		if ((text.includes('mobile') || text.includes('responsive') || text.includes('expo')) && !addedCategories.has('mobile')) {
			addedCategories.add('mobile');
			suggestions.push({
				category: 'Mobile/Responsive',
				tests: [
					'Test on mobile viewport sizes',
					'Verify touch interactions work correctly',
					'Test landscape orientation',
					'Verify navigation drawer/menu behavior'
				]
			});
		}
	}

	return suggestions;
}

/**
 * Determine overall status based on results
 */
function determineStatus(automated: AutomatedResults, quality: QualityMetrics): 'success' | 'partial' | 'failed' {
	// Failed if any critical failures
	if (automated.buildSucceeded === false) return 'failed';
	if (automated.tasksFailed > 0) return 'failed';
	if (quality.completionRate < 0.5) return 'failed';

	// Partial if not fully complete
	if (quality.completionRate < 1) return 'partial';
	if (automated.tasksSkipped > 0) return 'partial';
	if (quality.averageTaskQuality < 50) return 'partial';

	return 'success';
}

/**
 * Format checkpoint for display
 */
export function formatCheckpointReport(checkpoint: ProjectCheckpoint): string {
	const lines: string[] = [];

	// Header
	const statusIcon = checkpoint.status === 'success' ? '✅' : checkpoint.status === 'partial' ? '⚠️' : '❌';
	lines.push(`# ${statusIcon} Project Checkpoint: ${checkpoint.missionName}`);
	lines.push('');
	lines.push(`**Completed:** ${checkpoint.completedAt.toLocaleString()}`);
	lines.push(`**Duration:** ${formatDuration(checkpoint.duration)}`);
	lines.push(`**Status:** ${checkpoint.status.toUpperCase()}`);
	lines.push(`**Ship Ready:** ${checkpoint.canShip ? 'Yes ✅' : 'No ❌'}`);
	lines.push('');

	// Automated Results
	lines.push('## Automated Results');
	lines.push('');
	lines.push(`| Metric | Result |`);
	lines.push(`|--------|--------|`);
	lines.push(`| Tasks Completed | ${checkpoint.automated.tasksCompleted} |`);
	lines.push(`| Tasks Failed | ${checkpoint.automated.tasksFailed} |`);
	lines.push(`| Tasks Skipped | ${checkpoint.automated.tasksSkipped} |`);
	lines.push(`| Tests Run | ${checkpoint.automated.testsRun} |`);
	lines.push(`| Tests Passed | ${checkpoint.automated.testsPassed} |`);
	lines.push(`| Build | ${formatBoolResult(checkpoint.automated.buildSucceeded)} |`);
	lines.push(`| Type Check | ${formatBoolResult(checkpoint.automated.typeCheckPassed)} |`);
	lines.push(`| Lint | ${formatBoolResult(checkpoint.automated.lintPassed)} |`);
	lines.push('');

	// Quality Metrics
	lines.push('## Quality Metrics');
	lines.push('');
	lines.push(`- **Skill Usage:** ${Math.round(checkpoint.quality.skillUsageRatio * 100)}%`);
	lines.push(`- **Average Task Quality:** ${Math.round(checkpoint.quality.averageTaskQuality)}/100`);
	lines.push(`- **Completion Rate:** ${Math.round(checkpoint.quality.completionRate * 100)}%`);
	lines.push('');

	// Known Issues
	if (checkpoint.review.knownIssues.length > 0) {
		lines.push('## Known Issues');
		lines.push('');
		for (const issue of checkpoint.review.knownIssues) {
			lines.push(`- ⚠️ ${issue}`);
		}
		lines.push('');
	}

	// Manual Test Suggestions
	if (checkpoint.review.manualTestSuggestions.length > 0) {
		lines.push('## Manual Testing Checklist');
		lines.push('');
		for (const suggestion of checkpoint.review.manualTestSuggestions) {
			lines.push(`### ${suggestion.category}`);
			for (const test of suggestion.tests) {
				lines.push(`- [ ] ${test}`);
			}
			lines.push('');
		}
	}

	// Summary
	lines.push('---');
	lines.push('');
	lines.push(`**Summary:** ${checkpoint.review.summary}`);

	return lines.join('\n');
}

function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	const hours = Math.floor(seconds / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	return `${hours}h ${mins}m`;
}

function formatBoolResult(value: boolean | null): string {
	if (value === null) return '—';
	return value ? '✅ Passed' : '❌ Failed';
}
