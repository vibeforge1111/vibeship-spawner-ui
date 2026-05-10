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

export interface MissionControlAccessInfo {
	mode: 'hosted' | 'lan' | 'local-only';
	url: string | null;
	mobileReachable: boolean;
	message: string;
	privacy: {
		defaultPayload: 'status-metadata';
		privatePayloadsStayLocal: boolean;
	};
}

export interface MissionControlProjectLineage {
	projectId: string | null;
	projectPath: string | null;
	previewUrl: string | null;
	parentMissionId: string | null;
	iterationNumber: number | null;
	improvementFeedback: string | null;
}

export interface MissionControlBoardTask {
	title: string;
	skills: string[];
	status?: MissionControlTaskStatus;
	progress?: number;
}

export interface MissionControlProviderResultSummary {
	providerId: string;
	status: string;
	summary: string;
	durationMs?: number | null;
	completedAt?: string | null;
}

export interface MissionControlCompletionEvidence {
	state: 'complete' | 'incomplete' | 'not_terminal';
	summary: string;
	missing: string[];
	providerResultCount: number;
	providerTerminal: boolean;
	hasTerminalEvent: boolean;
	hasProviderCompletionTime: boolean;
	hasProviderSummary: boolean;
	hasArtifactReference: boolean;
	tasksTerminal: boolean;
}

export interface MissionControlBoardEntry {
	missionId: string;
	traceRef?: string | null;
	missionName: string | null;
	status: MissionControlBoardStatus;
	lastEventType: string;
	lastUpdated: string;
	executionStarted?: boolean;
	queuedAt: string | null;
	startedAt: string | null;
	lastSummary: string;
	taskName: string | null;
	taskCount: number;
	taskNames: string[];
	taskStatusCounts: MissionControlTaskStatusCounts;
	tasks: MissionControlBoardTask[];
	telegramRelay?: MissionControlRelayTarget | null;
	missionControlAccess?: MissionControlAccessInfo | null;
	projectLineage?: MissionControlProjectLineage | null;
	providerSummary?: string | null;
	providerResults?: MissionControlProviderResultSummary[];
	completionEvidence?: MissionControlCompletionEvidence;
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
