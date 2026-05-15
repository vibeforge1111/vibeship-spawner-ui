import type { CanvasNode } from '$lib/stores/canvas.svelte';
import type { ExecutionProgress } from './mission-executor';

export type TaskRowStatus = 'completed' | 'running' | 'pending' | 'failed' | 'blocked';
export type TaskRowKind = 'preparation' | 'build';

export interface TaskStatusRow {
	id: string;
	index: number;
	title: string;
	kind: TaskRowKind;
	status: TaskRowStatus;
	progress: number;
	message?: string;
	skills: string[];
}

export interface TaskSummary {
	completed: number;
	running: number;
	pending: number;
	failed: number;
}

export interface TaskRowBreakdown {
	preparationRows: TaskStatusRow[];
	buildRows: TaskStatusRow[];
	preparationSummary: TaskSummary;
	buildSummary: TaskSummary;
}

export function isPreparationTaskTitle(title: string | null | undefined): boolean {
	const normalized = (title || '').toLowerCase().replace(/\s+/g, ' ').trim();
	return normalized === 'prd analysis' || normalized === 'prd draft' || normalized === 'preparing canvas';
}

function rowStatusFromCanvasNode(node: CanvasNode): TaskRowStatus {
	if (node.status === 'success') return 'completed';
	if (node.status === 'error') return 'failed';
	if (node.status === 'running') return 'running';
	return 'pending';
}

function rowProgressFromStatus(status: TaskRowStatus): number {
	if (status === 'completed' || status === 'failed') return 100;
	return 0;
}

function rowStatusFromMissionTask(status: string | undefined): TaskRowStatus {
	if (status === 'completed') return 'completed';
	if (status === 'failed') return 'failed';
	if (status === 'blocked') return 'blocked';
	if (status === 'in_progress') return 'running';
	return 'pending';
}

export function buildExecutionTaskRows(
	executionProgress: ExecutionProgress | null,
	currentNodes: CanvasNode[]
): TaskStatusRow[] {
	const missionTasks = executionProgress?.mission?.tasks;
	if (!missionTasks?.length) {
		return currentNodes.map((node, index) => {
			const status = rowStatusFromCanvasNode(node);
			return {
				id: node.id,
				index: index + 1,
				title: node.skill.name,
				kind: 'build',
				status,
				progress: rowProgressFromStatus(status),
				skills: node.skill.tags || []
			};
		});
	}

	return missionTasks.map((task, index) => {
		const tracked = executionProgress?.taskProgressMap?.get(task.id);
		const status = rowStatusFromMissionTask(task.status);
		const inferredProgress = rowProgressFromStatus(status);
		return {
			id: task.id,
			index: index + 1,
			title: task.title,
			kind: isPreparationTaskTitle(task.title) ? 'preparation' : 'build',
			status,
			progress: inferredProgress,
			message: tracked?.message,
			skills: executionProgress?.taskSkillMap?.get(task.id) || []
		};
	});
}

export function summarizeTaskRows(rows: TaskStatusRow[]): TaskSummary {
	return {
		completed: rows.filter((task) => task.status === 'completed').length,
		running: rows.filter((task) => task.status === 'running').length,
		pending: rows.filter((task) => task.status === 'pending' || task.status === 'blocked').length,
		failed: rows.filter((task) => task.status === 'failed').length
	};
}

export function buildTaskRowBreakdown(rows: TaskStatusRow[]): TaskRowBreakdown {
	const preparationRows = rows.filter((task) => task.kind === 'preparation');
	const buildRows = rows.filter((task) => task.kind !== 'preparation');
	return {
		preparationRows,
		buildRows,
		preparationSummary: summarizeTaskRows(preparationRows),
		buildSummary: summarizeTaskRows(buildRows)
	};
}

export function getNextTaskRow(rows: TaskStatusRow[]): TaskStatusRow | undefined {
	const runningTasks = rows.filter((task) => task.status === 'running');
	return runningTasks[runningTasks.length - 1] || rows.find((task) => task.status === 'pending');
}
