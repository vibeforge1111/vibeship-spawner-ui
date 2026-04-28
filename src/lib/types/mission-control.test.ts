import { describe, expect, it } from 'vitest';
import {
	MISSION_CONTROL_BOARD_STATUSES,
	MISSION_CONTROL_TASK_STATUSES,
	emptyMissionControlTaskStatusCounts,
	isMissionControlTerminalStatus
} from './mission-control';

describe('mission-control lifecycle contract', () => {
	it('keeps board statuses explicit and ordered by user-facing lifecycle', () => {
		expect(MISSION_CONTROL_BOARD_STATUSES).toEqual([
			'created',
			'running',
			'paused',
			'completed',
			'failed',
			'cancelled'
		]);
	});

	it('keeps task statuses explicit and aligned with board counts', () => {
		expect(MISSION_CONTROL_TASK_STATUSES).toEqual([
			'queued',
			'running',
			'completed',
			'failed',
			'cancelled'
		]);
		expect(emptyMissionControlTaskStatusCounts()).toEqual({
			queued: 0,
			running: 0,
			completed: 0,
			failed: 0,
			cancelled: 0,
			total: 0
		});
	});

	it('treats completed, failed, and cancelled as terminal but not paused', () => {
		expect(isMissionControlTerminalStatus('completed')).toBe(true);
		expect(isMissionControlTerminalStatus('failed')).toBe(true);
		expect(isMissionControlTerminalStatus('cancelled')).toBe(true);
		expect(isMissionControlTerminalStatus('paused')).toBe(false);
		expect(isMissionControlTerminalStatus('running')).toBe(false);
	});
});
