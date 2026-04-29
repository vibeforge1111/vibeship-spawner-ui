import type { ExecutionStatus, TaskTransitionEvent } from './mission-executor';
import type { Mission, MissionLog } from './mcp-client';
import type { MissionControlBoardEntry, MissionControlTaskStatus } from '$lib/types/mission-control';

export function executionStatusFromBoard(status: MissionControlBoardEntry['status']): ExecutionStatus {
	if (status === 'created') return 'idle';
	if (status === 'cancelled') return 'cancelled';
	return status;
}

export function missionTaskStatusFromBoard(
	status?: MissionControlTaskStatus
): Mission['tasks'][number]['status'] {
	if (status === 'completed') return 'completed';
	if (status === 'failed' || status === 'cancelled') return 'failed';
	if (status === 'running') return 'in_progress';
	return 'pending';
}

export function logTypeFromMissionControlEvent(eventType: string): MissionLog['type'] {
	if (eventType === 'mission_completed' || eventType === 'task_completed') return 'complete';
	if (eventType === 'mission_failed' || eventType === 'task_failed' || eventType === 'mission_cancelled') {
		return 'error';
	}
	if (eventType === 'mission_started' || eventType === 'task_started' || eventType === 'dispatch_started') {
		return 'start';
	}
	return 'progress';
}

export function transitionStateFromMissionControlEvent(
	eventType: string
): TaskTransitionEvent['state'] {
	if (eventType === 'task_started' || eventType === 'mission_started' || eventType === 'dispatch_started') {
		return 'started';
	}
	if (eventType === 'task_completed' || eventType === 'mission_completed') return 'completed';
	if (eventType === 'task_failed' || eventType === 'mission_failed') return 'failed';
	if (eventType === 'task_cancelled' || eventType === 'mission_cancelled') return 'cancelled';
	if (eventType === 'provider_feedback' || eventType === 'log') return 'info';
	return 'progress';
}
