type MissionTaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'failed' | string;

export interface MissionProgressTask {
	id: string;
	title: string;
	status: MissionTaskStatus;
}

export interface MissionTaskProgressValue {
	progress?: number;
}

export interface MissionReconciliationSnapshot {
	totalTasks: number;
	completedTasks: number;
	failedTasks: number;
	pendingTasks: Array<{ id: string; title: string; status: string }>;
	verdict: 'complete' | 'mostly_done' | 'incomplete';
	isFullyComplete: boolean;
}

function isTerminalTaskStatus(status: MissionTaskStatus): boolean {
	return status === 'completed' || status === 'failed';
}

function isUnresolvedTaskStatus(status: MissionTaskStatus): boolean {
	return status === 'pending' || status === 'in_progress' || status === 'blocked';
}

function clampProgress(progress: number): number {
	if (!Number.isFinite(progress)) return 0;
	return Math.min(100, Math.max(0, progress));
}

export function calculateTaskCompletionProgress(tasks: Array<{ status: MissionTaskStatus }>): number {
	if (tasks.length === 0) return 0;
	const completedTasks = tasks.filter((task) => isTerminalTaskStatus(task.status)).length;
	return Math.round((completedTasks / tasks.length) * 100);
}

export function calculateGranularMissionProgress(
	tasks: MissionProgressTask[],
	taskProgressMap: Map<string, MissionTaskProgressValue>
): number {
	if (tasks.length === 0) return 0;

	let progressSum = 0;
	for (const task of tasks) {
		if (isTerminalTaskStatus(task.status)) {
			progressSum += 100;
		} else if (task.status === 'in_progress') {
			progressSum += clampProgress(taskProgressMap.get(task.id)?.progress ?? 50);
		}
	}

	return Math.round(progressSum / tasks.length);
}

export function reconcileMissionTasks(tasks: MissionProgressTask[]): MissionReconciliationSnapshot {
	const totalTasks = tasks.length;
	const completedTasks = tasks.filter((task) => task.status === 'completed').length;
	const failedTasks = tasks.filter((task) => task.status === 'failed').length;
	const pendingTasks = tasks
		.filter((task) => isUnresolvedTaskStatus(task.status))
		.map((task) => ({ id: task.id, title: task.title, status: task.status }));

	if (pendingTasks.length > 0) {
		const completionRatio = totalTasks === 0 ? 1 : completedTasks / totalTasks;
		return {
			totalTasks,
			completedTasks,
			failedTasks,
			pendingTasks,
			verdict: completionRatio >= 0.8 ? 'mostly_done' : 'incomplete',
			isFullyComplete: false
		};
	}

	return {
		totalTasks,
		completedTasks,
		failedTasks,
		pendingTasks: [],
		verdict: 'complete',
		isFullyComplete: true
	};
}
