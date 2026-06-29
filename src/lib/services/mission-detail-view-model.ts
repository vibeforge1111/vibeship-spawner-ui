import type { MissionControlBoardEntry, MissionControlProjectLineage } from '$lib/types/mission-control';
import { polishMissionTitleForDisplay } from './mission-title';
import
type
{
MissionControlProjectLineage
}
from
'$lib/types/mission-control';

export type MissionControlEntry = {
	eventType: string;
	missionId: string;
	missionName: string | null;
	taskId: string | null;
	taskName: string | null;
	taskSkills?: string[];
	projectLineage?: MissionControlProjectLineage | null;
	summary: string;
	timestamp: string;
	source: string;
};

export type MissionDetailTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type MissionDetailTaskRollup = {
	key: string;
	title: string;
	skills: string[];
	status: MissionDetailTaskStatus;
	startedAt: string;
	updatedAt: string;
	lastSummary: string;
};

export type SparkMissionDetail = {
	recentDesc: MissionControlEntry[];
	chronological: MissionControlEntry[];
	latest: MissionControlEntry;
	earliest: MissionControlEntry;
	sparkName: string;
	taskRollups: MissionDetailTaskRollup[];
	missionEvents: MissionControlEntry[];
	projectLineage: MissionControlProjectLineage | null;
	sparkStatus: string;
};

export type MissionDetailBoardEntry = Pick<
	MissionControlBoardEntry,
	'missionId' | 'missionName' | 'status' | 'lastUpdated' | 'lastSummary' | 'tasks'
> &
	Partial<Pick<MissionControlBoardEntry, 'queuedAt' | 'startedAt' | 'projectLineage'>>;

export function taskStatusForMissionControlEvent(eventType: string): MissionDetailTaskStatus | null {
	if (eventType === 'task_started') return 'running';
	if (eventType === 'task_completed') return 'completed';
	if (eventType === 'task_failed') return 'failed';
	if (eventType === 'task_cancelled') return 'cancelled';
	return null;
}

export function buildMissionDetailTaskRollups(
	chronological: MissionControlEntry[]
): MissionDetailTaskRollup[] {
	const map = new Map<string, MissionDetailTaskRollup>();
	for (const event of chronological) {
		if (!event.taskName && !event.taskId) continue;
		const key = event.taskId ?? event.taskName ?? 'task';
		if (!map.has(key)) {
			map.set(key, {
				key,
				title: event.taskName ?? key,
				skills: event.taskSkills ?? [],
				status: 'pending',
				startedAt: event.timestamp,
				updatedAt: event.timestamp,
				lastSummary: event.summary
			});
		}

		const task = map.get(key)!;
		task.updatedAt = event.timestamp;
		task.lastSummary = event.summary;
		if (event.taskSkills && event.taskSkills.length > 0 && task.skills.length === 0) {
			task.skills = event.taskSkills;
		}

		const nextStatus = taskStatusForMissionControlEvent(event.eventType);
		if (nextStatus) {
			task.status = nextStatus;
		}
	}
	return [...map.values()];
}

export function sparkStatusFromMissionControlEvent(eventType: string): string {
	return eventType.startsWith('mission_') ? eventType.replace('mission_', '') : 'in progress';
}

function terminalSparkStatusFromEvents(eventsDesc: MissionControlEntry[]): string | null {
	const terminal = eventsDesc.find((event) =>
		['mission_completed', 'mission_failed', 'mission_cancelled'].includes(event.eventType)
	);
	return terminal ? sparkStatusFromMissionControlEvent(terminal.eventType) : null;
}

function taskEventTypeForBoardStatus(status: string | null | undefined): string {
	if (status === 'completed') return 'task_completed';
	if (status === 'failed') return 'task_failed';
	if (status === 'cancelled') return 'task_cancelled';
	if (status === 'running') return 'task_started';
	return 'task_queued';
}

function taskSummaryForBoardStatus(task: MissionDetailBoardEntry['tasks'][number]): string {
	if (task.status === 'completed') return `${task.title} completed.`;
	if (task.status === 'failed') return `${task.title} failed.`;
	if (task.status === 'cancelled') return `${task.title} was cancelled.`;
	if (task.status === 'running') return `${task.title} started.`;
	return `${task.title} is queued.`;
}

function terminalEventTypeForBoardStatus(status: MissionDetailBoardEntry['status']): string | null {
	if (status === 'completed') return 'mission_completed';
	if (status === 'failed') return 'mission_failed';
	if (status === 'cancelled') return 'mission_cancelled';
	return null;
}

function timestampMs(value: string): number | null {
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function nextTimestamp(previous: string, candidate: string): string {
	const previousMs = timestampMs(previous);
	const candidateMs = timestampMs(candidate);
	if (previousMs === null || candidateMs === null) return candidate;
	return new Date(Math.max(candidateMs, previousMs + 1)).toISOString();
}

export function missionControlEntriesFromBoardEntry(
	missionId: string,
	boardEntry: MissionDetailBoardEntry
): MissionControlEntry[] {
	const startedAt = boardEntry.startedAt || boardEntry.queuedAt || boardEntry.lastUpdated;
	const events: MissionControlEntry[] = [
		{
			eventType: boardEntry.startedAt ? 'mission_started' : 'mission_created',
			missionId,
			missionName: boardEntry.missionName,
			taskId: null,
			taskName: null,
			summary: boardEntry.startedAt ? 'Mission started.' : 'Mission queued.',
			timestamp: startedAt,
			source: 'mission-control',
			projectLineage: boardEntry.projectLineage ?? null
		}
	];

	let eventTimestamp = startedAt;
	boardEntry.tasks.forEach((task, index) => {
		eventTimestamp = nextTimestamp(eventTimestamp, boardEntry.lastUpdated);
		events.push({
			eventType: taskEventTypeForBoardStatus(task.status),
			missionId,
			missionName: boardEntry.missionName,
			taskId: `task-${index + 1}`,
			taskName: task.title,
			taskSkills: task.skills,
			summary: taskSummaryForBoardStatus(task),
			timestamp: eventTimestamp,
			source: 'mission-control'
		});
	});

	const terminalEventType = terminalEventTypeForBoardStatus(boardEntry.status);
	if (terminalEventType) {
		eventTimestamp = nextTimestamp(eventTimestamp, boardEntry.lastUpdated);
		events.push({
			eventType: terminalEventType,
			missionId,
			missionName: boardEntry.missionName,
			taskId: null,
			taskName: null,
			summary: boardEntry.lastSummary || `${boardEntry.missionName || missionId} ${boardEntry.status}.`,
			timestamp: eventTimestamp,
			source: 'mission-control',
			projectLineage: boardEntry.projectLineage ?? null
		});
	}

	return [...events].reverse();
}

export function buildSparkMissionDetail(
	missionId: string,
	recentDesc: MissionControlEntry[]
): SparkMissionDetail | null {
	if (recentDesc.length === 0) return null;
	const chronological = [...recentDesc].reverse();
	const latest = recentDesc[0];
	const earliest = chronological[0];
	return {
		recentDesc,
		chronological,
		latest,
		earliest,
		sparkName: polishMissionTitleForDisplay(chronological.find((event) => event.missionName)?.missionName ?? missionId),
		taskRollups: buildMissionDetailTaskRollups(chronological),
		missionEvents: chronological.filter((event) => event.eventType.startsWith('mission_')),
		projectLineage: recentDesc.find((event) => event.projectLineage)?.projectLineage ?? null,
		sparkStatus: terminalSparkStatusFromEvents(recentDesc) ?? sparkStatusFromMissionControlEvent(latest.eventType)
	};
}

export function buildSparkMissionDetailFromBoardEntry(
	missionId: string,
	boardEntry: MissionDetailBoardEntry | null | undefined
): SparkMissionDetail | null {
	if (!boardEntry) return null;
	return buildSparkMissionDetail(missionId, missionControlEntriesFromBoardEntry(missionId, boardEntry));
}
