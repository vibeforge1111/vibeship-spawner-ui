import { describe, expect, it } from 'vitest';
import {
	buildSparkMissionControlEvent,
	getMissionControlRelaySnapshot,
	relayMissionControlEvent,
	selectWebhookUrlsForMissionEvent,
	shouldRelayMissionControlEvent,
	summarizeMissionControlEvent
} from './mission-control-relay';

describe('mission-control-relay', () => {
	it('filters unsupported event types', () => {
		expect(shouldRelayMissionControlEvent({ type: 'debug_noise' })).toBe(false);
		expect(shouldRelayMissionControlEvent({ type: 'task_completed' })).toBe(true);
	});

	it('does not relay self-originated spawner-ui events', () => {
		expect(shouldRelayMissionControlEvent({ type: 'mission_started', source: 'spawner-ui' })).toBe(false);
	});

	it('does not relay diagnostic-only Spark run events', () => {
		expect(
			shouldRelayMissionControlEvent({
				type: 'mission_started',
				source: 'spark-run',
				data: { suppressRelay: true }
			})
		).toBe(false);
	});

	it('routes Telegram mission events only to the originating relay port', () => {
		const urls = [
			'http://127.0.0.1:8788/spawner-events',
			'http://127.0.0.1:8789/spawner-events'
		];

		expect(
			selectWebhookUrlsForMissionEvent({
				type: 'mission_started',
				missionId: 'spark-1',
				data: { telegramRelay: { port: 8789, profile: 'spark-agi' } }
			}, urls)
		).toEqual(['http://127.0.0.1:8789/spawner-events']);
	});

	it('keeps legacy broadcast behavior when no Telegram relay target is present', () => {
		const urls = [
			'http://127.0.0.1:8788/spawner-events',
			'http://127.0.0.1:8789/spawner-events'
		];

		expect(
			selectWebhookUrlsForMissionEvent({
				type: 'mission_started',
				missionId: 'spark-1'
			}, urls)
		).toEqual(urls);
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
