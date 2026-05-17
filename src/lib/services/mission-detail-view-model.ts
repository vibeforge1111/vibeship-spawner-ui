import type { MissionControlProjectLineage } from '$lib/types/mission-control';
import { polishMissionTitleForDisplay } from './mission-title';

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
