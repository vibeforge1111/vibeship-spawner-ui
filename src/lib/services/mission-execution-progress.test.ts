import { describe, expect, it } from 'vitest';
import {
	calculateGranularMissionProgress,
	calculateTaskCompletionProgress,
	distributeProviderProgressAcrossTasks,
	reconcileMissionTasks,
	type MissionProgressTask
} from './mission-execution-progress';

function task(id: string, status: MissionProgressTask['status']): MissionProgressTask {
	return {
		id,
		title: `Task ${id}`,
		status
	};
}

describe('mission-execution-progress', () => {
	it('calculates completion progress from terminal task statuses', () => {
		expect(calculateTaskCompletionProgress([])).toBe(0);
		expect(
			calculateTaskCompletionProgress([
				{ status: 'completed' },
				{ status: 'failed' },
				{ status: 'pending' },
				{ status: 'in_progress' }
			])
		).toBe(25);
	});

	it('keeps mission progress tied to completed task count', () => {
		const progress = calculateGranularMissionProgress(
			[task('one', 'completed'), task('two', 'in_progress'), task('three', 'pending')],
			new Map([['two', { progress: 25 }]])
		);

		expect(progress).toBe(33);
	});

	it('does not invent progress for untracked in-progress tasks', () => {
		expect(calculateGranularMissionProgress([task('one', 'in_progress')], new Map())).toBe(0);
	});

	it('ignores tracked pending task progress for overall mission progress', () => {
		const progress = calculateGranularMissionProgress(
			[task('one', 'in_progress'), task('two', 'pending'), task('three', 'pending')],
			new Map([
				['one', { progress: 55 }],
				['two', { progress: 30 }],
				['three', { progress: 10 }]
			])
		);

		expect(progress).toBe(0);
	});

	it('reserves full progress for completed tasks rather than malformed tracked values', () => {
		expect(
			calculateGranularMissionProgress(
				[task('too-high', 'in_progress'), task('too-low', 'in_progress')],
				new Map([
					['too-high', { progress: 180 }],
					['too-low', { progress: -20 }]
				])
			)
		).toBe(0);
	});

	it('does not invent per-task progress from a provider heartbeat', () => {
		const distributed = distributeProviderProgressAcrossTasks(['one', 'two', 'three', 'four'], 50);

		expect(distributed.get('one')).toBe(0);
		expect(distributed.get('two')).toBe(0);
		expect(distributed.get('three')).toBe(0);
		expect(distributed.get('four')).toBe(0);
	});

	it('marks pending, running, and blocked tasks as unresolved', () => {
		const snapshot = reconcileMissionTasks([
			task('done-1', 'completed'),
			task('done-2', 'completed'),
			task('done-3', 'completed'),
			task('done-4', 'completed'),
			task('blocked-1', 'blocked')
		]);

		expect(snapshot).toEqual({
			totalTasks: 5,
			completedTasks: 4,
			failedTasks: 0,
			pendingTasks: [{ id: 'blocked-1', title: 'Task blocked-1', status: 'blocked' }],
			verdict: 'mostly_done',
			isFullyComplete: false
		});
	});

	it('treats completed and failed terminal tasks as reconciled', () => {
		const snapshot = reconcileMissionTasks([
			task('done', 'completed'),
			task('failed-but-terminal', 'failed')
		]);

		expect(snapshot).toMatchObject({
			totalTasks: 2,
			completedTasks: 1,
			failedTasks: 1,
			pendingTasks: [],
			verdict: 'complete',
			isFullyComplete: true
		});
	});
});
