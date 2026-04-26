import { describe, expect, it } from 'vitest';
import {
	buildSparkMissionControlEvent,
	getMissionControlPersistPath,
	getMissionControlBoard,
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

	it('records self-originated canvas events for Kanban without relaying them externally', async () => {
		const missionId = `mission-canvas-local-${Date.now()}`;

		await relayMissionControlEvent({
			type: 'mission_created',
			missionId,
			source: 'spawner-ui',
			data: {
				mission: {
					name: 'Canvas-created Galaxy Garden'
				}
			}
		});
		await relayMissionControlEvent({
			type: 'task_started',
			missionId,
			source: 'spawner-ui',
			data: {
				taskId: 'TAS-1',
				taskName: 'Create static app shell',
				skills: ['frontend']
			}
		});

		expect(shouldRelayMissionControlEvent({ type: 'mission_created', missionId, source: 'spawner-ui' })).toBe(false);

		const board = getMissionControlBoard();
		const entry = board.running.find((candidate) => candidate.missionId === missionId);
		expect(entry?.missionName).toBe('Canvas-created Galaxy Garden');
		expect(entry?.taskNames).toContain('Create static app shell');
		expect(entry?.tasks[0]).toEqual({
			title: 'Create static app shell',
			skills: ['frontend']
		});
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

	it('persists Mission Control state under configured Spawner state directory', () => {
		const previous = process.env.SPAWNER_STATE_DIR;
		process.env.SPAWNER_STATE_DIR = 'C:\\spark-state\\spawner-ui';
		try {
			expect(getMissionControlPersistPath()).toBe('C:\\spark-state\\spawner-ui\\mission-control.json');
		} finally {
			if (previous === undefined) {
				delete process.env.SPAWNER_STATE_DIR;
			} else {
				process.env.SPAWNER_STATE_DIR = previous;
			}
		}
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

	it('prefers an explicit Telegram relay URL over a matching port', () => {
		const urls = [
			'http://127.0.0.1:8788/spawner-events',
			'http://127.0.0.1:8789/spawner-events'
		];

		expect(
			selectWebhookUrlsForMissionEvent({
				type: 'mission_started',
				missionId: 'spark-url-target',
				data: {
					telegramRelay: {
						url: 'http://127.0.0.1:8788/spawner-events',
						port: 8789,
						profile: 'spark-agi'
					}
				}
			}, urls)
		).toEqual(['http://127.0.0.1:8788/spawner-events']);
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

	it('preserves Telegram relay target metadata in Spark ingest payloads', () => {
		const payload = buildSparkMissionControlEvent({
			id: 'evt-relay-target',
			type: 'mission_started',
			missionId: 'spark-relay-target',
			source: 'spark-run',
			data: {
				goal: 'Build through Telegram and show the Kanban board.',
				telegramRelay: { port: 8788, profile: 'default' }
			}
		});
		const body = payload.payload as Record<string, unknown>;
		const data = body.data as Record<string, unknown>;
		const raw = body.raw as Record<string, unknown>;

		expect(data.telegramRelay).toEqual({ port: 8788, profile: 'default' });
		expect((raw.data as Record<string, unknown>).telegramRelay).toEqual({ port: 8788, profile: 'default' });
	});

	it('creates readable summaries', () => {
		const text = summarizeMissionControlEvent({ type: 'mission_failed', missionId: 'm-22' });
		expect(text).toContain('Mission failed');
		expect(text).toContain('m-22');
	});

	it('tracks relay snapshot stats and recent entries', async () => {
		await relayMissionControlEvent({
			type: 'mission_started',
			missionId: 'spark-relay-xyz',
			source: 'claude-code',
			data: { telegramRelay: { port: 1 } }
		});

		const filtered = getMissionControlRelaySnapshot('spark-relay-xyz');
		expect(filtered.stats.perMission['spark-relay-xyz']).toBeGreaterThanOrEqual(1);
		expect(filtered.recent.length).toBeGreaterThanOrEqual(1);
		expect(filtered.recent[0].summary).toContain('Mission started');
	});

	it('does not keep malformed mission ids on the board', async () => {
		await relayMissionControlEvent({
			type: 'mission_paused',
			missionId: 'not-spark-id',
			source: 'telegram',
			data: { telegramRelay: { port: 1 } }
		});

		const board = getMissionControlBoard();
		expect(board.paused.find((entry) => entry.missionId === 'not-spark-id')).toBeUndefined();
		expect(getMissionControlRelaySnapshot('not-spark-id').recent).toEqual([]);
	});

	it('does not keep stale non-terminal missions on the board', async () => {
		const missionId = `spark-stale-running-${Date.now()}`;

		await relayMissionControlEvent({
			type: 'mission_started',
			missionId,
			source: 'spark-run',
			timestamp: '2000-01-01T00:00:00.000Z',
			data: { telegramRelay: { port: 1 } }
		});

		const board = getMissionControlBoard();
		expect(board.running.find((entry) => entry.missionId === missionId)).toBeUndefined();
	});

	it('builds a Kanban board view from natural mission progress events', async () => {
		const missionId = `spark-natural-language-${Date.now()}`;

		await relayMissionControlEvent({
			type: 'mission_created',
			missionId,
			missionName: 'Build a Telegram-led mission canvas',
			source: 'spark-run',
			timestamp: '2026-04-26T10:00:00.000Z',
			data: { telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'task_started',
			missionId,
			taskId: 'task-plan',
			taskName: 'Turn chat request into mission plan',
			source: 'codex',
			timestamp: '2026-04-26T10:00:05.000Z',
			data: { skills: ['telegram-relay', 'mission-control'], telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'task_started',
			missionId,
			taskId: 'task-build',
			taskName: 'Build Kanban and canvas updates',
			source: 'codex',
			timestamp: '2026-04-26T10:00:15.000Z',
			data: { skills: ['kanban', 'canvas'], telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'task_progress',
			missionId,
			taskId: 'task-build',
			taskName: 'Build Kanban and canvas updates',
			source: 'codex',
			message: 'Generated cards from the Telegram request.',
			timestamp: '2026-04-26T10:00:25.000Z',
			data: { telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'mission_completed',
			missionId,
			missionName: 'Build a Telegram-led mission canvas',
			source: 'codex',
			timestamp: '2026-04-26T10:01:00.000Z',
			data: { telegramRelay: { port: 1 } }
		});

		const board = getMissionControlBoard();
		const entry = board.completed.find((candidate) => candidate.missionId === missionId);

		expect(entry).toBeDefined();
		expect(entry?.lastEventType).toBe('mission_completed');
		expect(entry?.lastSummary).toContain('Mission completed');
		expect(entry?.taskCount).toBe(2);
		expect(entry?.taskNames).toEqual([
			'Build Kanban and canvas updates',
			'Turn chat request into mission plan'
		]);
		expect(entry?.tasks[0]).toEqual({
			title: 'Build Kanban and canvas updates',
			skills: ['kanban', 'canvas']
		});
	});

	it('redacts local paths from board display fields', async () => {
		const missionId = `spark-local-path-display-${Date.now()}`;

		await relayMissionControlEvent({
			type: 'task_progress',
			missionId,
			missionName: 'Inspect C:/Users/USER/.spark/modules/spawner-ui/source',
			taskName: '/Users/leventcem/.spark/logs/spawner-ui.log',
			source: 'codex',
			message: 'Read C:\\Users\\USER\\.spark\\logs\\spark-telegram-bot.log',
			timestamp: new Date().toISOString(),
			data: { telegramRelay: { port: 1 } }
		});

		const board = getMissionControlBoard();
		const entry = board.running.find((candidate) => candidate.missionId === missionId);

		expect(entry?.missionName).toBe('Inspect [local path]');
		expect(entry?.taskName).toBe('[local path]');
		expect(entry?.lastSummary).toContain('[local path]');
		expect(entry?.lastSummary).not.toContain('C:\\Users\\USER');
		expect(entry?.lastSummary).not.toContain('/Users/leventcem');
	});
});
