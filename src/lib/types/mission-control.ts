export const MISSION_CONTROL_BOARD_STATUSES = [
	'created',
	'running',
	'paused',
	'completed',
	'failed',
	'cancelled'
] as const;

export type MissionControlBoardStatus = (typeof MISSION_CONTROL_BOARD_STATUSES)[number];

export const MISSION_CONTROL_TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'] as const;

export type MissionControlTerminalStatus = (typeof MISSION_CONTROL_TERMINAL_STATUSES)[number];

export const MISSION_CONTROL_TASK_STATUSES = [
	'queued',
	'running',
	'completed',
	'failed',
	'cancelled'
] as const;

export type MissionControlTaskStatus = (typeof MISSION_CONTROL_TASK_STATUSES)[number];

export const MISSION_CONTROL_TRACE_PHASES = [
	'unknown',
	'accepted',
	'planning',
	'canvas_ready',
	'executing',
	'completed',
	'failed',
	'paused',
	'cancelled'
] as const;

export type MissionControlTracePhase = (typeof MISSION_CONTROL_TRACE_PHASES)[number];

export interface MissionControlTaskStatusCounts {
	queued: number;
	running: number;
	completed: number;
	failed: number;
	cancelled: number;
	total: number;
}

export interface MissionControlRelayTarget {
	port: number | null;
	profile: string | null;
	url: string | null;
}

export interface MissionControlBoardTask {
	title: string;
	skills: string[];
	status?: MissionControlTaskStatus;
}

export interface MissionControlProviderResultSummary {
	providerId: string;
	status: string;
	summary: string;
	durationMs?: number | null;
	completedAt?: string | null;
}

export interface MissionControlBoardEntry {
	missionId: string;
	missionName: string | null;
	status: MissionControlBoardStatus;
	lastEventType: string;
	lastUpdated: string;
	queuedAt: string | null;
	startedAt: string | null;
	lastSummary: string;
	taskName: string | null;
	taskCount: number;
	taskNames: string[];
	taskStatusCounts: MissionControlTaskStatusCounts;
	tasks: MissionControlBoardTask[];
	telegramRelay?: MissionControlRelayTarget | null;
	providerSummary?: string | null;
	providerResults?: MissionControlProviderResultSummary[];
}

export function emptyMissionControlTaskStatusCounts(): MissionControlTaskStatusCounts {
	return {
		queued: 0,
		running: 0,
		completed: 0,
		failed: 0,
		cancelled: 0,
		total: 0
	};
}

export function isMissionControlTerminalStatus(
	status: MissionControlBoardStatus | string | null | undefined
): status is MissionControlTerminalStatus {
	return status === 'completed' || status === 'failed' || status === 'cancelled';
}
