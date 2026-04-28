import { describe, expect, it } from 'vitest';
import { _terminalBoardStatusForAutoRun } from './+server';
import type { MissionControlBoardEntry } from '$lib/server/mission-control-relay';

function entry(
	missionId: string,
	status: MissionControlBoardEntry['status'] = 'completed'
): MissionControlBoardEntry {
	return {
		missionId,
		missionName: null,
		status,
		lastEventType: status === 'completed' ? 'mission_completed' : 'mission_started',
		lastUpdated: '2026-04-28T00:00:00.000Z',
		queuedAt: null,
		startedAt: null,
		lastSummary: 'done',
		taskName: null,
		taskCount: 0,
		taskNames: [],
		taskStatusCounts: { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0, total: 0 },
		tasks: []
	};
}

describe('dispatch auto-run terminal guard', () => {
	it('skips auto-run dispatch for missions already completed on the board', () => {
		expect(
			_terminalBoardStatusForAutoRun('mission-done', true, {
				completed: [entry('mission-done')],
				failed: [],
				cancelled: [],
				running: [],
				paused: [],
				created: []
			})
		).toBe('completed');
	});

	it('allows manual reruns even when the mission has terminal board history', () => {
		expect(
			_terminalBoardStatusForAutoRun('mission-done', false, {
				completed: [entry('mission-done')],
				failed: [],
				cancelled: [],
				running: [],
				paused: [],
				created: []
			})
		).toBeNull();
	});

	it('skips auto-run dispatch for missions already running on the board', () => {
		expect(
			_terminalBoardStatusForAutoRun('mission-live', true, {
				completed: [],
				failed: [],
				running: [entry('mission-live', 'running')],
				paused: [],
				created: []
			})
		).toBe('running');
	});
});
