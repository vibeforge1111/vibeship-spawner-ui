import { describe, expect, it } from 'vitest';
import {
	buildSparkMissionControlEvent,
	getMissionControlRelaySnapshot,
	relayMissionControlEvent,
	shouldRelayMissionControlEvent,
	summarizeMissionControlEvent
} from './mission-control-relay';

describe('mission-control-relay', () => {
	it('filters unsupported event types', () => {
		expect(shouldRelayMissionControlEvent({ type: 'progress' })).toBe(false);
		expect(shouldRelayMissionControlEvent({ type: 'task_completed' })).toBe(true);
	});

	it('does not relay self-originated spawner-ui events', () => {
		expect(shouldRelayMissionControlEvent({ type: 'mission_started', source: 'spawner-ui' })).toBe(false);
	});

	it('builds a valid SparkEventV1 payload', () => {
		const payload = buildSparkMissionControlEvent({
			id: 'evt-123',
			type: 'task_completed',
			missionId: 'mission-1',
			taskId: 'task-8',
			taskName: 'Build connector',
			source: 'claude-code',
			message: 'done'
		});

		expect(payload.v).toBe(1);
		expect(payload.source).toBe('spawner-ui');
		expect(payload.kind).toBe('system');
		expect(payload.session_id).toBe('mission-control:mission-1');
		expect(payload.trace_id).toBe('evt-123');
		expect((payload.payload as Record<string, unknown>).mission_event_type).toBe('task_completed');
		expect((payload.payload as Record<string, unknown>).summary).toContain('Task completed');
	});

	it('creates readable summaries', () => {
		const text = summarizeMissionControlEvent({ type: 'mission_failed', missionId: 'm-22' });
		expect(text).toContain('Mission failed');
		expect(text).toContain('m-22');
	});

	it('tracks relay snapshot stats and recent entries', async () => {
		await relayMissionControlEvent({
			type: 'mission_started',
			missionId: 'mission-xyz',
			source: 'claude-code'
		});

		const filtered = getMissionControlRelaySnapshot('mission-xyz');
		expect(filtered.stats.perMission['mission-xyz']).toBeGreaterThanOrEqual(1);
		expect(filtered.recent.length).toBeGreaterThanOrEqual(1);
		expect(filtered.recent[0].summary).toContain('Mission started');
	});
});
