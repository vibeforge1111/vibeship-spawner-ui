import type { CanvasNode } from '$lib/stores/canvas.svelte';
import type { MissionControlBoardEntry, MissionControlTaskStatus } from '$lib/types/mission-control';

type CanvasNodeStatus = CanvasNode['status'];
type MissionControlBoard = Record<string, MissionControlBoardEntry[]>;

export interface CanvasMissionStatusUpdate {
	nodeId: string;
	status: CanvasNodeStatus;
	taskTitle: string;
}

export interface CanvasMissionBoardLookup {
	missionId?: string | null;
	pipelineId?: string | null;
	pipelineName?: string | null;
}

function normalizeLabel(value: string | null | undefined): string {
	return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function latestFirst(a: MissionControlBoardEntry, b: MissionControlBoardEntry): number {
	return Date.parse(b.lastUpdated || '') - Date.parse(a.lastUpdated || '');
}

function missionNumericSuffix(missionId: string | null | undefined): string | null {
	return missionId?.match(/\d{10,}/)?.[0] || null;
}

export function flattenMissionControlBoard(board: MissionControlBoard | null | undefined): MissionControlBoardEntry[] {
	if (!board) return [];
	return Object.values(board).flat().sort(latestFirst);
}

export function findMissionControlBoardEntryForCanvas(
	board: MissionControlBoard | null | undefined,
	lookup: CanvasMissionBoardLookup
): MissionControlBoardEntry | null {
	const entries = flattenMissionControlBoard(board);
	const missionId = lookup.missionId?.trim();
	if (missionId) {
		const exact = entries.find((entry) => entry.missionId === missionId);
		if (exact) return exact;
	}

	const pipelineId = lookup.pipelineId?.trim().toLowerCase() || '';
	if (pipelineId) {
		const pipelineMatch = entries.find((entry) => {
			const missionId = entry.missionId.toLowerCase();
			const numericSuffix = missionNumericSuffix(entry.missionId);
			return pipelineId.includes(missionId) || Boolean(numericSuffix && pipelineId.includes(numericSuffix));
		});
		if (pipelineMatch) return pipelineMatch;
	}

	const pipelineName = normalizeLabel(lookup.pipelineName);
	if (pipelineName) {
		const exactName = entries.find((entry) => normalizeLabel(entry.missionName) === pipelineName);
		if (exactName) return exactName;

		const partialName = entries.find((entry) => {
			const missionName = normalizeLabel(entry.missionName);
			return Boolean(missionName && (pipelineName.includes(missionName) || missionName.includes(pipelineName)));
		});
		if (partialName) return partialName;
	}

	return null;
}

export function taskMatchesCanvasNode(node: CanvasNode, taskId: string, taskName?: string): boolean {
	const nodeName = node.skill.name || '';
	const skillId = node.skill.id || '';
	const normalizedTaskName = normalizeLabel(taskName);
	const normalizedTaskId = normalizeLabel(taskId);
	const normalizedNodeName = normalizeLabel(nodeName);
	return (
		node.id === taskId ||
		skillId === taskId ||
		skillId === `task-${taskId}` ||
		nodeName === taskName ||
		nodeName === taskId ||
		nodeName.startsWith(`${taskId}:`) ||
		(Boolean(taskName) && nodeName.startsWith(`${taskName}:`)) ||
		(Boolean(normalizedTaskName) && normalizedNodeName.includes(normalizedTaskName)) ||
		(Boolean(normalizedTaskId) && normalizedNodeName.includes(normalizedTaskId))
	);
}

export function canvasStatusForMissionControlTask(status: MissionControlTaskStatus | undefined): CanvasNodeStatus {
	if (status === 'completed') return 'success';
	if (status === 'failed' || status === 'cancelled') return 'error';
	if (status === 'running') return 'running';
	return 'queued';
}

export function buildCanvasMissionStatusUpdates(
	canvasNodes: CanvasNode[],
	tasks: MissionControlBoardEntry['tasks']
): CanvasMissionStatusUpdate[] {
	const updates: CanvasMissionStatusUpdate[] = [];
	const matchedNodeIds = new Set<string>();

	for (const task of tasks) {
		const node = canvasNodes.find(
			(candidate) => !matchedNodeIds.has(candidate.id) && taskMatchesCanvasNode(candidate, task.title, task.title)
		);
		if (!node) continue;
		matchedNodeIds.add(node.id);
		updates.push({
			nodeId: node.id,
			status: canvasStatusForMissionControlTask(task.status),
			taskTitle: task.title
		});
	}

	return updates;
}
