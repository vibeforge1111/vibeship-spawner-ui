import type {
	AgentRuntimeStatus,
	ExecutionProgress,
	ExecutionStatus,
	TaskProgress,
	TaskTransitionEvent
} from './mission-executor';
import type { Mission, MissionLog } from './mcp-client';
import type { MultiLLMOrchestratorOptions } from './multi-llm-orchestrator';
import {
	executionStatusFromBoard,
	logTypeFromMissionControlEvent,
	missionTaskStatusFromBoard,
	transitionStateFromMissionControlEvent
} from './mission-control-view-model';
import type { MissionControlBoardEntry } from '$lib/types/mission-control';

export type MissionControlHistoryEvent = {
	eventType: string;
	missionId: string;
	missionName: string | null;
	taskId: string | null;
	taskName: string | null;
	progress?: number | null;
	summary: string;
	timestamp: string;
	source: string;
};

export type MissionControlHydrationInput = {
	missionId: string;
	boardEntry: MissionControlBoardEntry;
	recentEvents: MissionControlHistoryEvent[];
	missionName: string;
	projectPath: string;
	projectType: string;
	goals: string[];
	multiLLMOptions: MultiLLMOrchestratorOptions;
	now?: string;
};

export type MissionControlHydrationSnapshot = {
	status: ExecutionStatus;
	mission: Mission;
	executionProgress: ExecutionProgress;
	logs: MissionLog[];
	completedTasks: string[];
	failedTasks: string[];
	pendingTasks: string[];
};

function taskIdForTitle(title: string, index: number): string {
	return title.match(/^(task-[a-z0-9_-]+)/i)?.[1] || `task-${index + 1}`;
}

function taskProgressMessage(status: MissionControlBoardEntry['tasks'][number]['status']): string {
	if (status === 'completed') return 'Completed';
	if (status === 'running') return 'Running';
	if (status === 'failed' || status === 'cancelled') return status;
	return 'Queued';
}

function taskProgressPercent(task: MissionControlBoardEntry['tasks'][number]): number {
	const status = task.status;
	if (status === 'completed' || status === 'failed' || status === 'cancelled') return 100;
	return 0;
}

function missionProgressPercent(
	tasks: MissionControlBoardEntry['tasks'],
	status: ExecutionStatus
): number {
	if (status === 'completed') return 100;
	if (tasks.length === 0) return 0;
	const completed = tasks.filter((task) => task.status === 'completed').length;
	return Math.round((completed / tasks.length) * 100);
}

function agentRuntimeForStatus(
	status: ExecutionStatus,
	boardEntry: MissionControlBoardEntry
): AgentRuntimeStatus {
	return {
		agentId: 'codex',
		label: 'Codex',
		status:
			status === 'completed'
				? 'completed'
				: status === 'failed'
					? 'failed'
					: status === 'cancelled'
						? 'cancelled'
						: status === 'running'
							? 'running'
							: 'idle',
		progress: status === 'completed' ? 100 : 0,
		message: boardEntry.providerSummary || undefined,
		updatedAt: boardEntry.lastUpdated
	};
}

function taskEventTypeForBoardStatus(
	status: MissionControlBoardEntry['tasks'][number]['status']
): string {
	if (status === 'completed') return 'task_completed';
	if (status === 'failed') return 'task_failed';
	if (status === 'cancelled') return 'task_cancelled';
	if (status === 'running') return 'task_started';
	return 'task_queued';
}

function taskSummaryForBoardStatus(task: MissionControlBoardEntry['tasks'][number]): string {
	if (task.status === 'completed') return `${task.title} completed.`;
	if (task.status === 'failed') return `${task.title} failed.`;
	if (task.status === 'cancelled') return `${task.title} was cancelled.`;
	if (task.status === 'running') return `${task.title} started working on it.`;
	return `${task.title} is queued.`;
}

function missionTerminalEventType(status: MissionControlBoardEntry['status']): string | null {
	if (status === 'completed') return 'mission_completed';
	if (status === 'failed') return 'mission_failed';
	if (status === 'cancelled') return 'mission_cancelled';
	return null;
}

function missionTerminalSummary(boardEntry: MissionControlBoardEntry, missionId: string): string {
	if (boardEntry.lastSummary) return boardEntry.lastSummary;
	if (boardEntry.status === 'completed') return `${boardEntry.missionName || missionId} completed.`;
	if (boardEntry.status === 'failed') return `${boardEntry.missionName || missionId} failed.`;
	return `${boardEntry.missionName || missionId} was cancelled.`;
}

function buildFallbackHistoryEvents(input: MissionControlHydrationInput): MissionControlHistoryEvent[] {
	const { boardEntry, missionId } = input;
	const startedAt =
		boardEntry.startedAt || boardEntry.queuedAt || boardEntry.lastUpdated || input.now || new Date().toISOString();
	const updatedAt = boardEntry.lastUpdated || startedAt;
	const events: MissionControlHistoryEvent[] = [
		{
			eventType: boardEntry.startedAt ? 'mission_started' : 'mission_created',
			missionId,
			missionName: boardEntry.missionName,
			taskId: null,
			taskName: null,
			summary: boardEntry.startedAt ? 'Mission started.' : 'Mission queued.',
			timestamp: startedAt,
			source: 'mission-control'
		}
	];

	boardEntry.tasks.forEach((task, index) => {
		events.push({
			eventType: taskEventTypeForBoardStatus(task.status),
			missionId,
			missionName: boardEntry.missionName,
			taskId: taskIdForTitle(task.title, index),
			taskName: task.title,
			summary: taskSummaryForBoardStatus(task),
			timestamp: updatedAt,
			source: 'mission-control'
		});
	});

	const terminalEventType = missionTerminalEventType(boardEntry.status);
	if (terminalEventType) {
		events.push({
			eventType: terminalEventType,
			missionId,
			missionName: boardEntry.missionName,
			taskId: null,
			taskName: null,
			summary: missionTerminalSummary(boardEntry, missionId),
			timestamp: updatedAt,
			source: 'mission-control'
		});
	}

	return events;
}

export function buildMissionControlHydrationSnapshot(
	input: MissionControlHydrationInput
): MissionControlHydrationSnapshot {
	const { boardEntry, missionId } = input;
	const status = executionStatusFromBoard(boardEntry.status);
	const taskProgressMap = new Map<string, TaskProgress>();
	const taskSkillMap = new Map<string, string[]>();
	const taskStartedAt = Date.parse(
		boardEntry.startedAt || boardEntry.queuedAt || boardEntry.lastUpdated || input.now || new Date().toISOString()
	);

	const missionTasks = boardEntry.tasks.map((task, index) => {
		const id = taskIdForTitle(task.title, index);
		taskSkillMap.set(id, task.skills || []);
		taskProgressMap.set(id, {
			taskId: id,
			taskName: task.title,
			progress: taskProgressPercent(task),
			message: taskProgressMessage(task.status),
			startedAt: taskStartedAt
		});
		return {
			id,
			title: task.title,
			description: task.title,
			assignedTo: 'codex',
			status: missionTaskStatusFromBoard(task.status),
			handoffType: 'sequential' as const,
			handoffTo: [] as string[]
		};
	});

	const historyEvents = input.recentEvents.length > 0 ? input.recentEvents : buildFallbackHistoryEvents(input);

	const logs: MissionLog[] = historyEvents.map((entry, index) => ({
		id: `${entry.missionId}-${entry.timestamp}-${index}`,
		mission_id: entry.missionId,
		agent_id: entry.source || null,
		task_id: entry.taskId,
		type: logTypeFromMissionControlEvent(entry.eventType),
		message: entry.summary,
		data: { eventType: entry.eventType, taskName: entry.taskName },
		created_at: entry.timestamp
	}));

	const taskTransitions: TaskTransitionEvent[] = historyEvents.map((entry, index) => ({
		id: `${entry.missionId}-transition-${entry.timestamp}-${index}`,
		timestamp: entry.timestamp,
		state: transitionStateFromMissionControlEvent(entry.eventType),
		taskId: entry.taskId || undefined,
		taskName: entry.taskName || undefined,
		agentId: entry.source,
		agentLabel: entry.source,
		message: entry.summary,
		progress:
			typeof entry.progress === 'number'
				? entry.progress
				: entry.eventType === 'mission_completed'
					? 100
					: undefined
	}));

	const mission: Mission = {
		id: missionId,
		user_id: 'mission-control',
		name: boardEntry.missionName || input.missionName || missionId,
		description: 'Hydrated from Mission Control history.',
		mode: 'multi-llm-orchestrator',
		status: boardEntry.status === 'cancelled' ? 'failed' : boardEntry.status === 'created' ? 'ready' : boardEntry.status,
		agents: [
			{
				id: 'codex',
				name: 'Codex',
				role: 'builder',
				skills: []
			}
		],
		tasks: missionTasks,
		context: {
			projectPath: boardEntry.projectLineage?.projectPath || input.projectPath,
			projectType: input.projectType,
			goals: input.goals
		},
		current_task_id: [...missionTasks].reverse().find((task) => task.status === 'in_progress')?.id || null,
		outputs: {},
		error: boardEntry.status === 'failed' || boardEntry.status === 'cancelled' ? boardEntry.providerSummary || null : null,
		created_at: boardEntry.queuedAt || boardEntry.startedAt || boardEntry.lastUpdated,
		updated_at: boardEntry.lastUpdated,
		started_at: boardEntry.startedAt,
		completed_at: status === 'completed' || status === 'failed' || status === 'cancelled' ? boardEntry.lastUpdated : null
	};

	const executionProgress: ExecutionProgress = {
		status,
		missionId,
		mission,
		executionPrompt: null,
		multiLLMOptions: input.multiLLMOptions,
		multiLLMExecution: null,
		progress: missionProgressPercent(boardEntry.tasks, status),
		currentTaskId: mission.current_task_id,
		currentTaskName: missionTasks.find((task) => task.id === mission.current_task_id)?.title || null,
		currentTaskProgress:
			taskProgressPercent(
				[...boardEntry.tasks].reverse().find((task) => missionTaskStatusFromBoard(task.status) === 'in_progress') || {
					title: '',
					skills: [],
					status: status === 'completed' ? 'completed' : 'queued'
				}
			),
		currentTaskMessage: boardEntry.providerSummary || null,
		taskProgressMap,
		logs,
		startTime: boardEntry.startedAt ? new Date(boardEntry.startedAt) : null,
		endTime: mission.completed_at ? new Date(mission.completed_at) : null,
		error: mission.error,
		loadedSkills: [],
		taskSkillMap,
		agentRuntime: new Map([['codex', agentRuntimeForStatus(status, boardEntry)]]),
		taskTransitions,
		reconciliation: null,
		checkpoint: null
	};

	return {
		status,
		mission,
		executionProgress,
		logs,
		completedTasks: boardEntry.tasks.filter((task) => task.status === 'completed').map((task) => task.title),
		failedTasks: boardEntry.tasks
			.filter((task) => task.status === 'failed' || task.status === 'cancelled')
			.map((task) => task.title),
		pendingTasks: boardEntry.tasks
			.filter((task) => !task.status || task.status === 'queued' || task.status === 'running')
			.map((task) => task.title)
	};
}
