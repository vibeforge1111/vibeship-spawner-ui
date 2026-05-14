import type { MissionSizeClassification } from './mission-size-classifier';

export interface TaskQualityRubricTask {
	id?: string;
	title?: string;
	summary?: string;
	description?: string;
	skills?: string[];
	dependencies?: string[];
	targets?: string[];
	workspaceTargets?: string[];
	acceptanceCriteria?: string[];
	verificationCommands?: string[];
	verification?: {
		criteria?: string[];
		files?: string[];
		commands?: string[];
	};
}

export type TaskQualityFindingLevel = 'error' | 'warning';

export interface TaskQualityFinding {
	level: TaskQualityFindingLevel;
	code: string;
	message: string;
	taskId?: string;
}

export interface TaskQualityReport {
	passed: boolean;
	score: number;
	taskCount: number;
	weakTaskIds: string[];
	findings: TaskQualityFinding[];
	summary: string;
	suggestedTaskRange?: [number, number];
}

const VAGUE_TITLE_PATTERN =
	/^(build|create|implement|add|wire|polish|test|verify|finish|do|make)(?:\s+(it|this|app|feature|core|stuff|things|everything))?$/i;
const GENERIC_BUCKET_TITLE_PATTERN =
	/^(?:create\s+(?:the\s+)?(?:app|project)\s+shell(?:\s+and\s+project\s+structure)?|implement\s+(?:the\s+)?core\s+interaction(?:\s+and\s+state)?|polish\s+(?:the\s+)?visual\s+system(?:\s+and\s+documentation)?|verify\s+(?:the\s+)?completed\s+build)$/i;

function taskId(task: TaskQualityRubricTask, index: number): string {
	return task.id?.trim() || `task-${index + 1}`;
}

function hasText(value: string | undefined): boolean {
	return Boolean(value?.trim());
}

function hasItems(value: string[] | undefined): boolean {
	return Array.isArray(value) && value.some((item) => item.trim().length > 0);
}

function criteriaFor(task: TaskQualityRubricTask): string[] | undefined {
	return task.acceptanceCriteria || task.verification?.criteria;
}

function commandsFor(task: TaskQualityRubricTask): string[] | undefined {
	return task.verificationCommands || task.verification?.commands;
}

function targetsFor(task: TaskQualityRubricTask): string[] | undefined {
	return task.workspaceTargets || task.targets || task.verification?.files;
}

function clampScore(value: number): number {
	return Math.max(0, Math.min(100, Math.round(value)));
}

function summarizeReport(score: number, findings: TaskQualityFinding[]): string {
	const errors = findings.filter((finding) => finding.level === 'error').length;
	const warnings = findings.filter((finding) => finding.level === 'warning').length;
	if (errors === 0 && warnings === 0) {
		return `Task plan quality ${score}/100. No rubric findings.`;
	}
	return `Task plan quality ${score}/100. ${errors} error(s), ${warnings} warning(s).`;
}

export function assessTaskQuality(
	tasks: TaskQualityRubricTask[],
	classification?: Pick<MissionSizeClassification, 'suggestedTaskRange' | 'verificationDepth'>
): TaskQualityReport {
	const findings: TaskQualityFinding[] = [];
	const ids = tasks.map((task, index) => taskId(task, index));
	const idSet = new Set(ids);
	const warningCounts = new Map<string, number>();
	const errorTaskIds = new Set<string>();

	function addFinding(finding: TaskQualityFinding): void {
		findings.push(finding);
		if (!finding.taskId) return;
		if (finding.level === 'error') {
			errorTaskIds.add(finding.taskId);
			return;
		}
		warningCounts.set(finding.taskId, (warningCounts.get(finding.taskId) || 0) + 1);
	}

	if (tasks.length === 0) {
		addFinding({
			level: 'error',
			code: 'empty_plan',
			message: 'The analysis produced no executable tasks.'
		});
	}

	if (classification) {
		const [minTasks, maxTasks] = classification.suggestedTaskRange;
		if (tasks.length > 0 && tasks.length < minTasks) {
			addFinding({
				level: 'warning',
				code: 'task_count_low',
				message: `Task count ${tasks.length} is below the suggested ${minTasks}-${maxTasks} range for this mission.`
			});
		}
		if (tasks.length > maxTasks) {
			addFinding({
				level: 'warning',
				code: 'task_count_high',
				message: `Task count ${tasks.length} is above the suggested ${minTasks}-${maxTasks} range for this mission.`
			});
		}
	}

	tasks.forEach((task, index) => {
		const id = ids[index];
		const title = task.title?.trim() || '';
		const description = task.description || task.summary;
		const acceptanceCriteria = criteriaFor(task);
		const verificationCommands = commandsFor(task);
		const targets = targetsFor(task);

		if (!hasText(title)) {
			addFinding({
				level: 'error',
				code: 'missing_title',
				taskId: id,
				message: 'Task needs a clear title.'
			});
		} else if (VAGUE_TITLE_PATTERN.test(title) || GENERIC_BUCKET_TITLE_PATTERN.test(title)) {
			addFinding({
				level: 'warning',
				code: 'vague_title',
				taskId: id,
				message: `Task title "${title}" is too vague to drive execution.`
			});
		}

		if (!hasText(description)) {
			addFinding({
				level: 'warning',
				code: 'missing_description',
				taskId: id,
				message: 'Task needs a summary or description that states the concrete outcome.'
			});
		}

		if (!hasItems(task.skills)) {
			addFinding({
				level: 'warning',
				code: 'missing_skills',
				taskId: id,
				message: 'Task needs at least one matched skill ID.'
			});
		} else if ((task.skills?.length || 0) > 5) {
			addFinding({
				level: 'warning',
				code: 'too_many_skills',
				taskId: id,
				message: 'Task has more than five skills, which usually means the task is too broad.'
			});
		}

		if (!hasItems(acceptanceCriteria)) {
			addFinding({
				level: 'error',
				code: 'missing_acceptance_criteria',
				taskId: id,
				message: 'Task needs at least one acceptance criterion.'
			});
		}

		if (!hasItems(verificationCommands)) {
			addFinding({
				level: 'error',
				code: 'missing_verification',
				taskId: id,
				message: 'Task needs at least one verification command.'
			});
		}

		if (!hasItems(targets)) {
			addFinding({
				level: 'warning',
				code: 'missing_targets',
				taskId: id,
				message: 'Task should name the file or workspace target it owns.'
			});
		}

		for (const dependency of task.dependencies || []) {
			if (dependency === id) {
				addFinding({
					level: 'error',
					code: 'self_dependency',
					taskId: id,
					message: 'Task cannot depend on itself.'
				});
			} else if (!idSet.has(dependency)) {
				addFinding({
					level: 'error',
					code: 'unknown_dependency',
					taskId: id,
					message: `Task depends on unknown task "${dependency}".`
				});
			}
		}
	});

	const errorCount = findings.filter((finding) => finding.level === 'error').length;
	const warningCount = findings.filter((finding) => finding.level === 'warning').length;
	const score = clampScore(100 - errorCount * 15 - warningCount * 7);
	const warningTaskIds = [...warningCounts.entries()]
		.filter(([, count]) => count >= 2)
		.map(([id]) => id);
	const weakTaskIds = [...new Set([...errorTaskIds, ...warningTaskIds])];

	const report: TaskQualityReport = {
		passed: errorCount === 0 && score >= 70,
		score,
		taskCount: tasks.length,
		weakTaskIds,
		findings,
		summary: summarizeReport(score, findings)
	};
	if (classification) {
		report.suggestedTaskRange = classification.suggestedTaskRange;
	}
	return report;
}

export function formatTaskQualityGuidance(): string {
	return [
		'Task quality requirements:',
		'- Each task must own one concrete outcome, not a vague bucket.',
		'- Each task needs 1-5 valid skills, a file or workspace target, acceptance criteria, and verification commands.',
		'- Split tasks by real skill set, dependency, and verification boundary.',
		'- Avoid generic titles like "Build app", "Implement core", or "Polish everything".',
		'- Avoid template bucket titles like "Create the app shell and project structure", "Implement the core interaction and state", "Polish the visual system and documentation", or "Verify the completed build"; name the actual product/workflow being changed.',
		'- If a task cannot be verified independently, merge it into a task that can be verified.'
	].join('\n');
}
