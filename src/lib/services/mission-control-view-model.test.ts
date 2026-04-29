import { describe, expect, it } from 'vitest';
import {
	executionStatusFromBoard,
	logTypeFromMissionControlEvent,
	missionTaskStatusFromBoard,
	transitionStateFromMissionControlEvent
} from './mission-control-view-model';

describe('mission-control view model helpers', () => {
	it('maps board statuses to execution panel statuses', () => {
		expect(executionStatusFromBoard('created')).toBe('idle');
		expect(executionStatusFromBoard('running')).toBe('running');
		expect(executionStatusFromBoard('completed')).toBe('completed');
		expect(executionStatusFromBoard('failed')).toBe('failed');
		expect(executionStatusFromBoard('cancelled')).toBe('cancelled');
	});

	it('maps board task statuses to mission task statuses', () => {
		expect(missionTaskStatusFromBoard('queued')).toBe('pending');
		expect(missionTaskStatusFromBoard('running')).toBe('in_progress');
		expect(missionTaskStatusFromBoard('completed')).toBe('completed');
		expect(missionTaskStatusFromBoard('failed')).toBe('failed');
		expect(missionTaskStatusFromBoard('cancelled')).toBe('failed');
		expect(missionTaskStatusFromBoard()).toBe('pending');
	});

	it('maps Mission Control events to log types', () => {
		expect(logTypeFromMissionControlEvent('mission_completed')).toBe('complete');
		expect(logTypeFromMissionControlEvent('task_completed')).toBe('complete');
		expect(logTypeFromMissionControlEvent('mission_failed')).toBe('error');
		expect(logTypeFromMissionControlEvent('task_failed')).toBe('error');
		expect(logTypeFromMissionControlEvent('mission_cancelled')).toBe('error');
		expect(logTypeFromMissionControlEvent('mission_started')).toBe('start');
		expect(logTypeFromMissionControlEvent('task_started')).toBe('start');
		expect(logTypeFromMissionControlEvent('dispatch_started')).toBe('start');
		expect(logTypeFromMissionControlEvent('provider_feedback')).toBe('progress');
	});

	it('maps Mission Control events to transition states', () => {
		expect(transitionStateFromMissionControlEvent('mission_started')).toBe('started');
		expect(transitionStateFromMissionControlEvent('task_started')).toBe('started');
		expect(transitionStateFromMissionControlEvent('dispatch_started')).toBe('started');
		expect(transitionStateFromMissionControlEvent('mission_completed')).toBe('completed');
		expect(transitionStateFromMissionControlEvent('task_completed')).toBe('completed');
		expect(transitionStateFromMissionControlEvent('mission_failed')).toBe('failed');
		expect(transitionStateFromMissionControlEvent('task_failed')).toBe('failed');
		expect(transitionStateFromMissionControlEvent('mission_cancelled')).toBe('cancelled');
		expect(transitionStateFromMissionControlEvent('provider_feedback')).toBe('info');
		expect(transitionStateFromMissionControlEvent('log')).toBe('info');
		expect(transitionStateFromMissionControlEvent('unknown')).toBe('progress');
	});
});
