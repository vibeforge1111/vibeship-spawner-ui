import type { CanvasNode } from '$lib/stores/canvas.svelte';
import type { ExecutionProgress } from './mission-executor';

export type TaskRowStatus = 'completed' | 'running' | 'pending' | 'failed' | 'blocked';

export interface TaskStatusRow {
	id: string;
	index: number;
	title: string;
	status: TaskRowStatus;
	progress: number;
	message?: string;
}

export interface TaskSummary {
	completed: number;
	running: number;
	pending: number;
	failed: number;
}

function clampProgress(value: number): number {
	return Math.max(0, Math.min(100, value));
}

function rowStatusFromCanvasNode(node: CanvasNode): TaskRowStatus {
	if (node.status === 'success') return 'completed';
	if (node.status === 'error') return 'failed';
	if (node.status === 'running') return 'running';
	return 'pending';
}

function rowProgressFromStatus(status: TaskRowStatus): number {
	if (status === 'completed' || status === 'failed') return 100;
	if (status === 'running') return 8;
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
				status,
				progress: rowProgressFromStatus(status)
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
			status,
			progress: clampProgress(tracked?.progress ?? inferredProgress),
			message: tracked?.message
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

export function getNextTaskRow(rows: TaskStatusRow[]): TaskStatusRow | undefined {
	return rows.find((task) => task.status === 'running') || rows.find((task) => task.status === 'pending');
}
