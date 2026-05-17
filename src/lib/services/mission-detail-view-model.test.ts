import { describe, expect, it } from 'vitest';
import {
	buildMissionDetailTaskRollups,
	buildSparkMissionDetail,
	sparkStatusFromMissionControlEvent,
	taskStatusForMissionControlEvent,
	type MissionControlEntry
} from './mission-detail-view-model';

const baseEvent: MissionControlEntry = {
	eventType: 'mission_started',
	missionId: 'mission-1',
	missionName: 'Spark Detail Test',
	taskId: null,
	taskName: null,
	summary: 'Mission started',
	timestamp: '2026-04-29T10:00:00.000Z',
	source: 'spark'
};

function event(partial: Partial<MissionControlEntry>): MissionControlEntry {
	return { ...baseEvent, ...partial };
}

describe('mission detail view model', () => {
	it('maps task event types to display task statuses', () => {
		expect(taskStatusForMissionControlEvent('task_started')).toBe('running');
		expect(taskStatusForMissionControlEvent('task_completed')).toBe('completed');
		expect(taskStatusForMissionControlEvent('task_failed')).toBe('failed');
		expect(taskStatusForMissionControlEvent('task_cancelled')).toBe('cancelled');
		expect(taskStatusForMissionControlEvent('provider_feedback')).toBeNull();
	});

	it('rolls chronological task events into stable task rows', () => {
		const rollups = buildMissionDetailTaskRollups([
			event({
				eventType: 'task_started',
				taskId: 'task-1',
				taskName: 'Create shell',
				taskSkills: ['frontend'],
				summary: 'Started shell',
				timestamp: '2026-04-29T10:01:00.000Z'
			}),
			event({
				eventType: 'provider_feedback',
				taskId: 'task-1',
				taskName: 'Create shell',
				taskSkills: ['ui'],
				summary: 'Working',
				timestamp: '2026-04-29T10:02:00.000Z'
			}),
			event({
				eventType: 'task_completed',
				taskId: 'task-1',
				taskName: 'Create shell',
				summary: 'Done',
				timestamp: '2026-04-29T10:03:00.000Z'
			}),
			event({
				eventType: 'task_failed',
				taskId: null,
				taskName: 'Run smoke',
				summary: 'Smoke failed',
				timestamp: '2026-04-29T10:04:00.000Z'
			})
		]);

		expect(rollups).toEqual([
			{
				key: 'task-1',
				title: 'Create shell',
				skills: ['frontend'],
				status: 'completed',
				startedAt: '2026-04-29T10:01:00.000Z',
				updatedAt: '2026-04-29T10:03:00.000Z',
				lastSummary: 'Done'
			},
			{
				key: 'Run smoke',
				title: 'Run smoke',
				skills: [],
				status: 'failed',
				startedAt: '2026-04-29T10:04:00.000Z',
				updatedAt: '2026-04-29T10:04:00.000Z',
				lastSummary: 'Smoke failed'
			}
		]);
	});

	it('derives mission status from the latest Mission Control event', () => {
		expect(sparkStatusFromMissionControlEvent('mission_completed')).toBe('completed');
		expect(sparkStatusFromMissionControlEvent('mission_failed')).toBe('failed');
		expect(sparkStatusFromMissionControlEvent('task_started')).toBe('in progress');
	});

	it('builds a Spark mission detail model from reverse chronological relay events', () => {
		const detail = buildSparkMissionDetail('mission-1', [
			event({
				eventType: 'mission_completed',
				summary: 'Mission completed',
				timestamp: '2026-04-29T10:05:00.000Z'
			}),
			event({
				eventType: 'task_completed',
				taskId: 'task-1',
				taskName: 'Create shell',
				taskSkills: ['frontend'],
				summary: 'Done',
				timestamp: '2026-04-29T10:04:00.000Z'
			}),
			event({
				eventType: 'mission_started',
				summary: 'Mission started',
				timestamp: '2026-04-29T10:00:00.000Z'
			})
		]);

		expect(detail).toMatchObject({
			sparkName: 'Spark Detail Test',
			sparkStatus: 'completed'
		});
		expect(detail?.earliest.timestamp).toBe('2026-04-29T10:00:00.000Z');
		expect(detail?.latest.timestamp).toBe('2026-04-29T10:05:00.000Z');
		expect(detail?.missionEvents.map((entry) => entry.eventType)).toEqual([
			'mission_started',
			'mission_completed'
		]);
		expect(detail?.taskRollups).toHaveLength(1);
	});

	it('keeps terminal mission status when later non-terminal relay events arrive', () => {
		const detail = buildSparkMissionDetail('mission-1', [
			event({
				eventType: 'provider_feedback',
				taskId: null,
				taskName: null,
				summary: 'Completion evidence present',
				timestamp: '2026-04-29T10:06:00.000Z'
			}),
			event({
				eventType: 'mission_completed',
				summary: 'Mission completed',
				timestamp: '2026-04-29T10:05:00.000Z'
			}),
			event({
				eventType: 'task_completed',
				taskId: 'task-1',
				taskName: 'Create shell',
				summary: 'Done',
				timestamp: '2026-04-29T10:04:00.000Z'
			})
		]);

		expect(detail?.sparkStatus).toBe('completed');
	});

	it('returns null for empty relay history', () => {
		expect(buildSparkMissionDetail('mission-empty', [])).toBeNull();
	});
});
