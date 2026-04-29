import { describe, expect, it } from 'vitest';
import { createDefaultMultiLLMOptions } from './multi-llm-orchestrator';
import {
	buildMissionControlHydrationSnapshot,
	type MissionControlHistoryEvent
} from './mission-control-hydration';
import type { MissionControlBoardEntry } from '$lib/types/mission-control';

const boardEntry: MissionControlBoardEntry = {
	missionId: 'mission-1',
	missionName: 'Hydration Test',
	status: 'running',
	lastEventType: 'task_started',
	lastUpdated: '2026-04-29T11:05:00.000Z',
	queuedAt: '2026-04-29T11:00:00.000Z',
	startedAt: '2026-04-29T11:01:00.000Z',
	lastSummary: 'Task started',
	taskName: 'task-2: Build UI',
	taskCount: 3,
	taskNames: ['task-1: Scaffold', 'task-2: Build UI', 'task-3: Verify'],
	taskStatusCounts: {
		queued: 1,
		running: 1,
		completed: 1,
		failed: 0,
		cancelled: 0,
		total: 3
	},
	tasks: [
		{ title: 'task-1: Scaffold', skills: ['frontend'], status: 'completed' },
		{ title: 'task-2: Build UI', skills: ['ui'], status: 'running' },
		{ title: 'task-3: Verify', skills: ['testing'], status: 'queued' }
	],
	providerSummary: 'Codex is building'
};

const recentEvents: MissionControlHistoryEvent[] = [
	{
		eventType: 'mission_started',
		missionId: 'mission-1',
		missionName: 'Hydration Test',
		taskId: null,
		taskName: null,
		summary: 'Mission started',
		timestamp: '2026-04-29T11:01:00.000Z',
		source: 'spark'
	},
	{
		eventType: 'task_completed',
		missionId: 'mission-1',
		missionName: 'Hydration Test',
		taskId: 'task-1',
		taskName: 'task-1: Scaffold',
		summary: 'Scaffold done',
		timestamp: '2026-04-29T11:03:00.000Z',
		source: 'codex'
	},
	{
		eventType: 'task_started',
		missionId: 'mission-1',
		missionName: 'Hydration Test',
		taskId: 'task-2',
		taskName: 'task-2: Build UI',
		summary: 'Build UI started',
		timestamp: '2026-04-29T11:05:00.000Z',
		source: 'codex'
	}
];

function hydrate(entry: MissionControlBoardEntry = boardEntry) {
	return buildMissionControlHydrationSnapshot({
		missionId: entry.missionId,
		boardEntry: entry,
		recentEvents,
		missionName: 'Fallback Mission',
		projectPath: 'C:/tmp/project',
		projectType: 'web-app',
		goals: ['ship the UI'],
		multiLLMOptions: createDefaultMultiLLMOptions()
	});
}

describe('mission-control hydration', () => {
	it('builds execution progress from a Mission Control board entry', () => {
		const snapshot = hydrate();

		expect(snapshot.status).toBe('running');
		expect(snapshot.executionProgress.status).toBe('running');
		expect(snapshot.executionProgress.missionId).toBe('mission-1');
		expect(snapshot.executionProgress.progress).toBe(33);
		expect(snapshot.executionProgress.currentTaskId).toBe('task-2');
		expect(snapshot.executionProgress.currentTaskName).toBe('task-2: Build UI');
		expect(snapshot.mission.name).toBe('Hydration Test');
		expect(snapshot.mission.context).toMatchObject({
			projectPath: 'C:/tmp/project',
			projectType: 'web-app',
			goals: ['ship the UI']
		});
	});

	it('hydrates task progress, skill maps, and task tracking buckets', () => {
		const snapshot = hydrate();

		expect(snapshot.executionProgress.taskProgressMap.get('task-1')).toMatchObject({
			taskName: 'task-1: Scaffold',
			progress: 100,
			message: 'Completed'
		});
		expect(snapshot.executionProgress.taskProgressMap.get('task-2')).toMatchObject({
			taskName: 'task-2: Build UI',
			progress: 20,
			message: 'Running'
		});
		expect(snapshot.executionProgress.taskSkillMap.get('task-2')).toEqual(['ui']);
		expect(snapshot.completedTasks).toEqual(['task-1: Scaffold']);
		expect(snapshot.failedTasks).toEqual([]);
		expect(snapshot.pendingTasks).toEqual(['task-2: Build UI', 'task-3: Verify']);
	});

	it('turns Mission Control events into logs and transitions', () => {
		const snapshot = hydrate();

		expect(snapshot.logs.map((log) => log.type)).toEqual(['start', 'complete', 'start']);
		expect(snapshot.logs[1]).toMatchObject({
			task_id: 'task-1',
			message: 'Scaffold done',
			data: { eventType: 'task_completed', taskName: 'task-1: Scaffold' }
		});
		expect(snapshot.executionProgress.taskTransitions.map((transition) => transition.state)).toEqual([
			'started',
			'completed',
			'started'
		]);
	});

	it('marks completed missions as 100 percent with an end time', () => {
		const snapshot = hydrate({
			...boardEntry,
			status: 'completed',
			tasks: boardEntry.tasks.map((task) => ({ ...task, status: 'completed' }))
		});

		expect(snapshot.executionProgress.status).toBe('completed');
		expect(snapshot.executionProgress.progress).toBe(100);
		expect(snapshot.executionProgress.endTime?.toISOString()).toBe('2026-04-29T11:05:00.000Z');
		expect(snapshot.executionProgress.agentRuntime.get('codex')?.status).toBe('completed');
	});

	it('keeps cancelled missions visible as cancelled execution while MCP mission status remains failed-compatible', () => {
		const snapshot = hydrate({
			...boardEntry,
			status: 'cancelled',
			providerSummary: 'Operator cancelled',
			tasks: [{ title: 'task-1: Scaffold', skills: [], status: 'cancelled' }]
		});

		expect(snapshot.executionProgress.status).toBe('cancelled');
		expect(snapshot.mission.status).toBe('failed');
		expect(snapshot.mission.error).toBe('Operator cancelled');
		expect(snapshot.failedTasks).toEqual(['task-1: Scaffold']);
		expect(snapshot.executionProgress.agentRuntime.get('codex')?.status).toBe('cancelled');
	});
});
