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

function clampNonTerminalProgress(progress: number): number {
	return Math.min(92, clampProgress(progress));
}

export function calculateTaskCompletionProgress(tasks: Array<{ status: MissionTaskStatus }>): number {
	if (tasks.length === 0) return 0;
	const completedTasks = tasks.filter((task) => task.status === 'completed').length;
	return Math.round((completedTasks / tasks.length) * 100);
}

export function calculateGranularMissionProgress(
	tasks: MissionProgressTask[],
	_taskProgressMap: Map<string, MissionTaskProgressValue>
): number {
	return calculateTaskCompletionProgress(tasks);
}

export function distributeProviderProgressAcrossTasks(
	assignedTaskIds: string[],
	providerProgress: number
): Map<string, number> {
	const taskIds = assignedTaskIds.map((taskId) => taskId.trim()).filter(Boolean);
	const distributed = new Map<string, number>();
	if (taskIds.length === 0) return distributed;

	const clampedProviderProgress = clampProgress(providerProgress);
	const taskShare = 100 / taskIds.length;
	taskIds.forEach((taskId, index) => {
		const taskStart = index * taskShare * 0.8;
		const taskEnd = taskStart + taskShare * 1.4;
		const taskProgress = Math.round(((clampedProviderProgress - taskStart) / (taskEnd - taskStart)) * 100);
		distributed.set(taskId, clampNonTerminalProgress(taskProgress));
	});
	return distributed;
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
