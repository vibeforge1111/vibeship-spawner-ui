/**
 * Pre-Flight Validation Service
 *
 * Validates mission is executable BEFORE starting. Fail fast.
 * KISS: Simple checks that prevent common failures.
 */

import type { Mission } from '$lib/types/mission';
import { getH70Skill } from './h70-skills';

export interface PreFlightCheck {
	name: string;
	passed: boolean;
	message?: string;
	severity: 'error' | 'warning' | 'info';
}

export interface PreFlightResult {
	passed: boolean;
	checks: PreFlightCheck[];
	canProceed: boolean; // true if only warnings, false if errors
	summary: string;
}

/**
 * Run all pre-flight checks before mission execution
 */
export async function runPreFlight(mission: Mission): Promise<PreFlightResult> {
	const checks: PreFlightCheck[] = [];

	// Check 1: Mission has tasks
	const hasTasks = mission.tasks.length > 0;
	checks.push({
		name: 'Has Tasks',
		passed: hasTasks,
		message: hasTasks ? `${mission.tasks.length} tasks ready` : 'No tasks in mission',
		severity: hasTasks ? 'info' : 'error'
	});

	// Check 2: All required skills exist
	const skillCheck = await checkSkillsAvailable(mission);
	checks.push(skillCheck);

	// Check 3: No circular dependencies
	const cycleCheck = checkNoCyclicDependencies(mission);
	checks.push(cycleCheck);

	// Check 4: Tasks have descriptions
	const descCheck = checkTaskDescriptions(mission);
	checks.push(descCheck);

	// Check 5: No question/decision nodes in tasks
	const questionCheck = checkNoQuestionTasks(mission);
	checks.push(questionCheck);

	// Check 6: Reasonable task count
	const countCheck = checkTaskCount(mission);
	checks.push(countCheck);

	// Calculate results
	const errors = checks.filter((c) => !c.passed && c.severity === 'error');
	const warnings = checks.filter((c) => !c.passed && c.severity === 'warning');
	const passed = errors.length === 0;
	const canProceed = errors.length === 0;

	// Generate summary
	let summary: string;
	if (passed && warnings.length === 0) {
		summary = `All ${checks.length} pre-flight checks passed`;
	} else if (passed) {
		summary = `Pre-flight passed with ${warnings.length} warning(s)`;
	} else {
		summary = `Pre-flight failed: ${errors.length} error(s), ${warnings.length} warning(s)`;
	}

	return { passed, checks, canProceed, summary };
}

/**
 * Check that all required skills are available (H70 or MCP)
 * Note: Skills are mapped to tasks externally via taskSkillMap, not stored on tasks
 */
async function checkSkillsAvailable(mission: Mission): Promise<PreFlightCheck> {
	const allSkillIds = new Set<string>();

	// Collect skill IDs from task descriptions that mention skills.
	// Supports flat and tiered formats:
	// "Load H70 Skills: `skill-1`, `skill-2`"
	// "Load H70 Skills: Core: `skill-1` | Supporting: `skill-2`"
	for (const task of mission.tasks) {
		const skillMatch = task.description.match(/Load H70 Skills?:[^\n]*/gi);
		if (skillMatch) {
			for (const match of skillMatch) {
				for (const id of match.match(/`([^`]+)`/g) || []) {
					const skillId = id.replace(/`/g, '').trim();
					if (skillId) allSkillIds.add(skillId);
				}
			}
		}
	}

	if (allSkillIds.size === 0) {
		return {
			name: 'Skills Available',
			passed: true,
			message: 'No skills required',
			severity: 'info'
		};
	}

	// Check a sample of skills (don't check all to avoid latency)
	const skillArray = Array.from(allSkillIds);
	const samplesToCheck = Math.min(5, skillArray.length);
	const sampled = skillArray.slice(0, samplesToCheck);

	const missing: string[] = [];
	for (const skillId of sampled) {
		try {
			const skill = await getH70Skill(skillId);
			if (!skill) {
				missing.push(skillId);
			}
		} catch {
			missing.push(skillId);
		}
	}

	const passed = missing.length === 0;
	return {
		name: 'Skills Available',
		passed,
		message: passed
			? `Checked ${samplesToCheck} of ${allSkillIds.size} skills - all available`
			: `Missing skills: ${missing.join(', ')}`,
		severity: passed ? 'info' : 'warning' // Warning not error - skills might load from MCP
	};
}

/**
 * Check for circular dependencies in task graph
 */
function checkNoCyclicDependencies(mission: Mission): PreFlightCheck {
	const visited = new Set<string>();
	const stack = new Set<string>();
	let hasCycle = false;

	function visit(taskId: string): boolean {
		if (stack.has(taskId)) return true; // Cycle detected
		if (visited.has(taskId)) return false;

		visited.add(taskId);
		stack.add(taskId);

		const task = mission.tasks.find((t) => t.id === taskId);
		if (task?.dependsOn) {
			for (const depId of task.dependsOn) {
				if (visit(depId)) return true;
			}
		}

		stack.delete(taskId);
		return false;
	}

	for (const task of mission.tasks) {
		if (visit(task.id)) {
			hasCycle = true;
			break;
		}
	}

	return {
		name: 'No Circular Dependencies',
		passed: !hasCycle,
		message: hasCycle ? 'Circular dependency detected in task graph' : 'Task dependencies are valid',
		severity: hasCycle ? 'error' : 'info'
	};
}

/**
 * Check that tasks have meaningful descriptions
 */
function checkTaskDescriptions(mission: Mission): PreFlightCheck {
	const emptyDesc = mission.tasks.filter((t) => {
		const desc = t.description?.trim();
		const title = t.title?.trim();
		return !desc || desc === title || desc.length < 10;
	});

	const passed = emptyDesc.length === 0;
	return {
		name: 'Task Descriptions',
		passed,
		message: passed
			? 'All tasks have descriptions'
			: `${emptyDesc.length} task(s) have empty/minimal descriptions`,
		severity: passed ? 'info' : 'warning'
	};
}

/**
 * Check for question/decision tasks that aren't executable
 */
function checkNoQuestionTasks(mission: Mission): PreFlightCheck {
	const questionTasks = mission.tasks.filter((t) => {
		const title = t.title.toLowerCase();
		return (
			title.endsWith('?') ||
			title.startsWith('should we') ||
			title.startsWith('do we') ||
			title.startsWith('can we') ||
			/^(what|how|why|when|where|which)\s/i.test(title)
		);
	});

	const passed = questionTasks.length === 0;
	return {
		name: 'Executable Tasks',
		passed,
		message: passed
			? 'All tasks are executable'
			: `${questionTasks.length} task(s) appear to be questions: ${questionTasks.map((t) => t.title).slice(0, 2).join(', ')}`,
		severity: passed ? 'info' : 'warning'
	};
}

/**
 * Check task count is reasonable
 */
function checkTaskCount(mission: Mission): PreFlightCheck {
	const count = mission.tasks.length;

	if (count === 0) {
		return {
			name: 'Task Count',
			passed: false,
			message: 'No tasks in mission',
			severity: 'error'
		};
	}

	if (count > 50) {
		return {
			name: 'Task Count',
			passed: false,
			message: `Too many tasks (${count}) - consider breaking into multiple missions`,
			severity: 'warning'
		};
	}

	if (count > 30) {
		return {
			name: 'Task Count',
			passed: true,
			message: `${count} tasks - this is a large mission`,
			severity: 'warning'
		};
	}

	return {
		name: 'Task Count',
		passed: true,
		message: `${count} tasks`,
		severity: 'info'
	};
}

/**
 * Format pre-flight results for display
 */
export function formatPreFlightReport(result: PreFlightResult): string {
	const lines: string[] = [];

	lines.push('## Pre-Flight Check Results');
	lines.push('');
	lines.push(`**Status:** ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
	lines.push(`**Summary:** ${result.summary}`);
	lines.push('');
	lines.push('### Checks');
	lines.push('');

	for (const check of result.checks) {
		const icon = check.passed ? '✅' : check.severity === 'error' ? '❌' : '⚠️';
		lines.push(`${icon} **${check.name}**: ${check.message || (check.passed ? 'OK' : 'Failed')}`);
	}

	if (!result.canProceed) {
		lines.push('');
		lines.push('> ⛔ Cannot proceed - fix errors above before executing mission');
	}

	return lines.join('\n');
}
