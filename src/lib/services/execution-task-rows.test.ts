import { describe, expect, it } from 'vitest';
import type { CanvasNode } from '$lib/stores/canvas.svelte';
import type { ExecutionProgress } from './mission-executor';
import type { Mission, MissionTask } from './mcp-client';
import { buildExecutionTaskRows, getNextTaskRow, summarizeTaskRows } from './execution-task-rows';

function node(id: string, name: string, status?: CanvasNode['status']): CanvasNode {
	return {
		id,
		skillId: `skill-${id}`,
		skill: {
			id: `skill-${id}`,
			name,
			description: '',
			category: 'development',
			tier: 'free',
			tags: [],
			triggers: []
		},
		position: { x: 0, y: 0 },
		status
	};
}

function progress(input: Partial<ExecutionProgress>): ExecutionProgress {
	return {
		status: 'running',
		mode: 'live',
		startTime: new Date('2026-04-29T00:00:00.000Z'),
		completedTasks: [],
		failedTasks: [],
		pendingTasks: [],
		reworkTasks: new Map(),
		logs: [],
		taskProgressMap: new Map(),
		taskTransitions: [],
		agentRuntime: new Map(),
		...input
	} as ExecutionProgress;
}

function task(
	id: string,
	title: string,
	status: MissionTask['status']
): MissionTask {
	return {
		id,
		title,
		status,
		description: `${title} description`,
		assignedTo: 'codex',
		handoffType: 'sequential'
	};
}

function mission(tasks: MissionTask[]): Mission {
	return {
		id: 'mission-1',
		user_id: 'user-1',
		name: 'Mission',
		description: '',
		mode: 'multi-llm-orchestrator',
		status: 'running',
		agents: [],
		tasks,
		context: {
			projectPath: '.',
			projectType: 'tool',
			goals: ['Test mission task rows']
		},
		current_task_id: null,
		outputs: {},
		error: null,
		created_at: '2026-04-29T00:00:00.000Z',
		updated_at: '2026-04-29T00:00:00.000Z',
		started_at: '2026-04-29T00:00:00.000Z',
		completed_at: null
	};
}

describe('execution task row helpers', () => {
	it('falls back to canvas node statuses before a mission exists', () => {
		const rows = buildExecutionTaskRows(null, [
			node('node-1', 'Plan', 'success'),
			node('node-2', 'Build', 'running'),
			node('node-3', 'Verify', 'error'),
			node('node-4', 'Ship')
		]);

		expect(rows.map((row) => [row.title, row.status, row.progress])).toEqual([
			['Plan', 'completed', 100],
			['Build', 'running', 8],
			['Verify', 'failed', 100],
			['Ship', 'pending', 0]
		]);
	});

	it('maps mission task statuses and tracked progress into stable rows', () => {
		const rows = buildExecutionTaskRows(
			progress({
				mission: mission([
					task('task-1', 'Done', 'completed'),
					task('task-2', 'Running', 'in_progress'),
					task('task-3', 'Blocked', 'blocked'),
					task('task-4', 'Failed', 'failed')
				]),
				taskProgressMap: new Map([
					[
						'task-2',
						{ taskId: 'task-2', taskName: 'Running', progress: 47, message: 'Halfway there', startedAt: 1 }
					],
					[
						'task-3',
						{
							taskId: 'task-3',
							taskName: 'Blocked',
							progress: 200,
							message: 'Bad external value',
							startedAt: 1
						}
					]
				])
			}),
			[]
		);

		expect(rows.map((row) => [row.id, row.status, row.progress, row.message])).toEqual([
			['task-1', 'completed', 100, undefined],
			['task-2', 'running', 47, 'Halfway there'],
			['task-3', 'blocked', 100, 'Bad external value'],
			['task-4', 'failed', 100, undefined]
		]);
	});

	it('summarizes rows using blocked tasks as pending work', () => {
		const rows = buildExecutionTaskRows(
			progress({
				mission: mission([
					task('task-1', 'Done', 'completed'),
					task('task-2', 'Running', 'in_progress'),
					task('task-3', 'Blocked', 'blocked'),
					task('task-4', 'Pending', 'pending'),
					task('task-5', 'Failed', 'failed')
				])
			}),
			[]
		);

		expect(summarizeTaskRows(rows)).toEqual({
			completed: 1,
			running: 1,
			pending: 2,
			failed: 1
		});
	});

	it('prefers the active task, then the next pending task', () => {
		const pendingOnly = buildExecutionTaskRows(null, [node('node-1', 'Plan'), node('node-2', 'Build')]);
		expect(getNextTaskRow(pendingOnly)?.title).toBe('Plan');

		const running = buildExecutionTaskRows(null, [node('node-1', 'Plan'), node('node-2', 'Build', 'running')]);
		expect(getNextTaskRow(running)?.title).toBe('Build');
	});
});
