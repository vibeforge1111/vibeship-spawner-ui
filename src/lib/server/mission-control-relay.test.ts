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
			skills: ['frontend'],
			status: 'running'
		});
		expect(entry?.taskStatusCounts).toMatchObject({ running: 1, completed: 0, failed: 0, total: 1 });
	});

	it('does not add provider-level completion events as anonymous board tasks', async () => {
		const missionId = `mission-provider-completion-${Date.now()}`;

		await relayMissionControlEvent({
			type: 'task_completed',
			missionId,
			source: 'codex',
			message: 'Codex completed with final response',
			data: {
				provider: 'codex',
				response: 'done',
				telegramRelay: { port: 8789, profile: 'spark-agi' }
			}
		});
		await relayMissionControlEvent({
			type: 'mission_completed',
			missionId,
			source: 'codex',
			data: { telegramRelay: { port: 8789, profile: 'spark-agi' } }
		});

		const board = getMissionControlBoard();
		const entry = board.completed.find((candidate) => candidate.missionId === missionId);
		expect(entry?.tasks).toEqual([]);
		expect(entry?.taskStatusCounts).toMatchObject({ completed: 0, total: 0 });
	});

	it('deduplicates task labels that differ only by generated T-prefixes', async () => {
		const missionId = `mission-task-prefix-${Date.now()}`;

		await relayMissionControlEvent({
			type: 'task_completed',
			missionId,
			source: 'codex',
			taskId: 'node-1',
			taskName: 'T1: Scaffold static Mission Control app'
		});
		await relayMissionControlEvent({
			type: 'task_completed',
			missionId,
			source: 'codex',
			taskId: 'node-1',
			taskName: 'Scaffold static Mission Control app'
		});

		const board = getMissionControlBoard();
		const entry = board.running.find((candidate) => candidate.missionId === missionId);
		expect(entry?.taskCount).toBe(1);
		expect(entry?.taskStatusCounts).toMatchObject({ completed: 1, total: 1 });
	});

	it('seeds planned canvas tasks as queued before task execution starts', async () => {
		const missionId = `mission-planned-tasks-${Date.now()}`;

		await relayMissionControlEvent({
			type: 'mission_created',
			missionId,
			source: 'canvas-dispatch',
			data: {
				missionName: 'Planned Task Mission',
				plannedTasks: [
					{ title: 'Create app shell', skills: ['frontend-engineer'] },
					{ title: 'Wire interactions', skills: ['state-management'] }
				]
			}
		});

		let board = getMissionControlBoard();
		let entry = board.created.find((candidate) => candidate.missionId === missionId);
		expect(entry?.taskStatusCounts).toMatchObject({ queued: 2, running: 0, completed: 0, total: 2 });
		expect(entry?.tasks).toEqual([
			{ title: 'Create app shell', skills: ['frontend-engineer'], status: 'queued' },
			{ title: 'Wire interactions', skills: ['state-management'], status: 'queued' }
		]);

		await relayMissionControlEvent({
			type: 'task_started',
			missionId,
			source: 'codex',
			taskName: 'Create app shell'
		});

		board = getMissionControlBoard();
		entry = board.running.find((candidate) => candidate.missionId === missionId);
		expect(entry?.taskStatusCounts).toMatchObject({ queued: 1, running: 1, completed: 0, total: 2 });

		await relayMissionControlEvent({
			type: 'task_completed',
			missionId,
			source: 'codex',
			taskName: 'Create app shell'
		});

		board = getMissionControlBoard();
		entry = board.running.find((candidate) => candidate.missionId === missionId);
		expect(entry?.taskStatusCounts).toMatchObject({ queued: 1, running: 0, completed: 1, total: 2 });
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
				data: { telegramRelay: { port: 8789, profile: 'primary' } }
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
						profile: 'primary'
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
				telegramRelay: { port: 8788, profile: 'primary' }
			}
		});
		const body = payload.payload as Record<string, unknown>;
		const data = body.data as Record<string, unknown>;
		const raw = body.raw as Record<string, unknown>;

		expect(data.telegramRelay).toEqual({ port: 8788, profile: 'primary' });
		expect((raw.data as Record<string, unknown>).telegramRelay).toEqual({ port: 8788, profile: 'primary' });
	});

	it('keeps Telegram relay target metadata in relay snapshots and board entries', async () => {
		const missionId = `mission-relay-target-board-${Date.now()}`;

		await relayMissionControlEvent({
			type: 'mission_started',
			missionId,
			source: 'spark-run',
			data: {
				telegramRelay: { port: 8789, profile: 'primary', url: 'http://127.0.0.1:8789/spawner-events' }
			}
		});

		const snapshot = getMissionControlRelaySnapshot(missionId);
		expect(snapshot.recent[0].telegramRelay).toEqual({
			port: 8789,
			profile: 'primary',
			url: 'http://127.0.0.1:8789/spawner-events'
		});

		const board = getMissionControlBoard();
		const entry = board.running.find((candidate) => candidate.missionId === missionId);
		expect(entry?.telegramRelay).toEqual({
			port: 8789,
			profile: 'primary',
			url: 'http://127.0.0.1:8789/spawner-events'
		});
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
		expect(entry?.taskStatusCounts).toMatchObject({
			completed: 2,
			running: 0,
			failed: 0,
			cancelled: 0,
			total: 2
		});
		expect(entry?.taskNames).toEqual([
			'Build Kanban and canvas updates',
			'Turn chat request into mission plan'
		]);
		expect(entry?.tasks[0]).toEqual({
			title: 'Build Kanban and canvas updates',
			skills: ['kanban', 'canvas'],
			status: 'completed'
		});
	});

	it('tracks explicit task completion and failure states on Kanban board entries', async () => {
		const missionId = `mission-task-states-${Date.now()}`;

		await relayMissionControlEvent({
			type: 'mission_started',
			missionId,
			missionName: 'Build a stateful canvas mission',
			source: 'spark-run',
			timestamp: '2026-04-28T10:00:00.000Z',
			data: { telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'task_started',
			missionId,
			taskId: 'task-shell',
			taskName: 'Create static app shell',
			source: 'codex',
			timestamp: '2026-04-28T10:00:05.000Z',
			data: { skills: ['frontend'], telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'task_completed',
			missionId,
			taskId: 'task-shell',
			taskName: 'Create static app shell',
			source: 'codex',
			timestamp: '2026-04-28T10:00:30.000Z',
			data: { telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'task_started',
			missionId,
			taskId: 'task-ui',
			taskName: 'Implement animated UI',
			source: 'codex',
			timestamp: '2026-04-28T10:00:40.000Z',
			data: { skills: ['ui'], telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'task_failed',
			missionId,
			taskId: 'task-readme',
			taskName: 'Write README smoke test',
			source: 'codex',
			timestamp: '2026-04-28T10:00:50.000Z',
			data: { skills: ['docs'], telegramRelay: { port: 1 } }
		});

		const board = getMissionControlBoard();
		const entry = board.running.find((candidate) => candidate.missionId === missionId);

		expect(entry?.taskStatusCounts).toMatchObject({
			completed: 1,
			running: 1,
			failed: 1,
			cancelled: 0,
			total: 3
		});
		expect(entry?.tasks).toEqual([
			{ title: 'Write README smoke test', skills: ['docs'], status: 'failed' },
			{ title: 'Implement animated UI', skills: ['ui'], status: 'running' },
			{ title: 'Create static app shell', skills: ['frontend'], status: 'completed' }
		]);
	});

	it('deduplicates PRD task titles across canvas and provider label formats', async () => {
		const missionId = `mission-prd-dedupe-${Date.now()}`;

		const plannedTasks = [
			{ title: 'Create static app file structure', skills: [] },
			{ title: 'Implement playful first-screen trace dashboard', skills: [] },
			{ title: 'Implement progress, persistence, and trace lock behavior', skills: [] },
			{ title: 'Document launch steps and manual smoke test', skills: [] }
		];

		await relayMissionControlEvent({
			type: 'mission_created',
			missionId,
			source: 'canvas-dispatch',
			timestamp: '2026-04-28T10:00:00.000Z',
			data: { plannedTasks, telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'dispatch_started',
			missionId,
			source: 'canvas-dispatch',
			timestamp: '2026-04-28T10:00:01.000Z',
			data: {
				plannedTasks: [
					{ title: 'task-1-scaffold-static-app: Create static app file structure', skills: [] },
					{
						title: 'task-2-build-trace-dashboard-ui: Implement playful first-screen trace dashboard',
						skills: []
					},
					{
						title: 'task-3-implement-state-and-launch-logic: Implement progress, persistence, and trace lock behavior',
						skills: []
					},
					{ title: 'task-4-write-readme-and-smoke-test: Document launch steps and manual smoke test', skills: [] }
				],
				telegramRelay: { port: 1 }
			}
		});
		await relayMissionControlEvent({
			type: 'task_started',
			missionId,
			taskName: 'task-1-scaffold-static-app',
			source: 'codex',
			timestamp: '2026-04-28T10:00:02.000Z',
			data: { telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'mission_completed',
			missionId,
			source: 'canvas-dispatch',
			timestamp: '2026-04-28T10:01:00.000Z',
			data: { plannedTasks, telegramRelay: { port: 1 } }
		});

		const board = getMissionControlBoard();
		const completed = board.completed.find((candidate) => candidate.missionId === missionId);

		expect(completed?.taskCount).toBe(4);
		expect(completed?.taskStatusCounts).toMatchObject({ completed: 4, total: 4 });
		expect(completed?.taskNames).toEqual([
			'Create static app file structure',
			'Implement playful first-screen trace dashboard',
			'Implement progress, persistence, and trace lock behavior',
			'Document launch steps and manual smoke test'
		]);
	});

	it('keeps completed missions completed when stale canvas task events replay later', async () => {
		const missionId = `mission-terminal-wins-${Date.now()}`;

		await relayMissionControlEvent({
			type: 'task_started',
			missionId,
			taskId: 'task-original',
			taskName: 'Original task before completion',
			source: 'spawner-ui',
			timestamp: '2026-04-28T09:59:00.000Z',
			data: { skills: ['canvas'], telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'mission_completed',
			missionId,
			missionName: 'Completed mission should stay done',
			source: 'codex',
			timestamp: '2026-04-28T10:00:00.000Z',
			data: { telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'task_started',
			missionId,
			taskId: 'task-replayed',
			taskName: 'Replayed task after completion',
			source: 'spawner-ui',
			timestamp: '2026-04-28T10:01:00.000Z',
			data: { skills: ['canvas'], telegramRelay: { port: 1 } }
		});
		await relayMissionControlEvent({
			type: 'mission_created',
			missionId,
			missionName: 'Replayed mission after completion',
			source: 'spawner-ui',
			timestamp: '2026-04-28T10:02:00.000Z',
			data: { telegramRelay: { port: 1 } }
		});

		const board = getMissionControlBoard();
		const completed = board.completed.find((candidate) => candidate.missionId === missionId);

		expect(board.running.find((candidate) => candidate.missionId === missionId)).toBeUndefined();
		expect(board.created.find((candidate) => candidate.missionId === missionId)).toBeUndefined();
		expect(completed?.status).toBe('completed');
		expect(completed?.taskStatusCounts).toMatchObject({ completed: 1, running: 0, total: 1 });
		expect(completed?.tasks[0]).toEqual({
			title: 'Original task before completion',
			skills: ['canvas'],
			status: 'completed'
		});
		expect(completed?.taskNames).not.toContain('Replayed task after completion');
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
