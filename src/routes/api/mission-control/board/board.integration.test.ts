import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';
import { providerRuntime, type ProviderMissionResultSnapshot } from '$lib/server/provider-runtime';

const TEST_API_KEY = 'mission-control-board-test-secret';
const originalMcpApiKey = process.env.MCP_API_KEY;

function restoreEnv(name: string, value: string | undefined) {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

function providerResult(overrides: Partial<ProviderMissionResultSnapshot> = {}): ProviderMissionResultSnapshot {
	return {
		providerId: 'codex',
		status: 'completed',
		response: 'Built the Telegram canvas mission and updated Kanban.',
		error: null,
		durationMs: 1200,
		tokenUsage: null,
		startedAt: '2026-04-26T10:00:00.000Z',
		completedAt: '2026-04-26T10:00:01.200Z',
		...overrides
	};
}

function boardEvent(options: { auth?: boolean } = {}) {
	const headers = new Headers();
	if (options.auth !== false) headers.set('x-api-key', TEST_API_KEY);
	return {
		request: new Request('http://127.0.0.1/api/mission-control/board', {
			headers
		}),
		url: new URL('http://127.0.0.1/api/mission-control/board'),
		getClientAddress: () => '127.0.0.1'
	};
}

beforeEach(() => {
	process.env.MCP_API_KEY = TEST_API_KEY;
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.useRealTimers();
	restoreEnv('MCP_API_KEY', originalMcpApiKey);
});

describe('/api/mission-control/board integration', () => {
	it('returns canvas-created Telegram missions with task names, provider summary, and relay target', async () => {
		const missionId = `mission-board-api-${Date.now()}`;
		vi.spyOn(providerRuntime, 'getMissionResults').mockImplementation((requestedMissionId) =>
			requestedMissionId === missionId ? [providerResult()] : []
		);

		await relayMissionControlEvent({
			type: 'mission_created',
			missionId,
			missionName: 'Telegram Canvas Build',
			source: 'spawner-ui',
			timestamp: '2026-04-26T10:00:00.000Z',
			data: {
				telegramRelay: { port: 8789, profile: 'primary' }
			}
		});
		await relayMissionControlEvent({
			type: 'task_started',
			missionId,
			taskId: 'task-plan',
			taskName: 'Shape build plan',
			source: 'spawner-ui',
			timestamp: '2026-04-26T10:00:05.000Z',
			data: {
				skills: ['planning'],
				telegramRelay: { port: 8789, profile: 'primary' }
			}
		});
		await relayMissionControlEvent({
			type: 'task_started',
			missionId,
			taskId: 'task-build',
			taskName: 'Build canvas flow',
			source: 'spawner-ui',
			timestamp: '2026-04-26T10:00:10.000Z',
			data: {
				skills: ['canvas', 'kanban'],
				telegramRelay: { port: 8789, profile: 'primary' }
			}
		});
		await relayMissionControlEvent({
			type: 'mission_completed',
			missionId,
			missionName: 'Telegram Canvas Build',
			source: 'spawner-ui',
			timestamp: '2026-04-26T10:01:00.000Z',
			data: {
				telegramRelay: { port: 8789, profile: 'primary' }
			}
		});

		const response = await GET(boardEvent() as never);
		expect(response.status).toBe(200);
		const payload = await response.json();
		const entry = payload.board.completed.find((candidate: { missionId: string }) => candidate.missionId === missionId);

		expect(entry).toMatchObject({
			missionId,
			missionName: 'Telegram Canvas Build',
			status: 'completed',
			lastEventType: 'mission_completed',
			taskCount: 2,
			taskStatusCounts: { queued: 0, running: 0, completed: 2, failed: 0, cancelled: 0, total: 2 },
			taskNames: ['Build canvas flow', 'Shape build plan'],
			telegramRelay: { port: 8789, profile: 'primary', url: null },
			providerSummary: 'Codex: Built the Telegram canvas mission and updated Kanban.'
		});
		expect(entry.tasks).toEqual([
			{ title: 'Build canvas flow', skills: ['canvas', 'kanban'], status: 'completed' },
			{ title: 'Shape build plan', skills: ['planning'], status: 'completed' }
		]);
		expect(entry.providerResults).toEqual([
			expect.objectContaining({
				providerId: 'codex',
				status: 'completed',
				summary: 'Built the Telegram canvas mission and updated Kanban.'
			})
		]);
	});

	it('returns metadata-only board entries for local no-key reads', async () => {
		const missionId = `mission-board-redacted-${Date.now()}`;
		vi.spyOn(providerRuntime, 'getMissionResults').mockImplementation((requestedMissionId) =>
			requestedMissionId === missionId
				? [
						providerResult({
							response: JSON.stringify({
								summary: 'private provider output',
								project_path: 'C:/Users/USER/private/spark-app',
								preview_url: 'http://127.0.0.1:4999'
							})
						})
					]
				: []
		);

		await relayMissionControlEvent({
			type: 'mission_completed',
			missionId,
			missionName: 'Private Board Mission',
			source: 'spawner-ui',
			timestamp: '2026-04-26T10:01:00.000Z',
			data: {
				telegramRelay: { port: 8789, profile: 'primary', url: 'http://127.0.0.1:8789' },
				projectLineage: {
					projectId: 'project-private',
					projectPath: 'C:/Users/USER/private/spark-app',
					previewUrl: 'http://127.0.0.1:4999',
					parentMissionId: null,
					iterationNumber: 1,
					improvementFeedback: 'private feedback'
				},
				plannedTasks: [{ title: 'Private execution task', skills: ['private-skill'] }]
			}
		});

		const response = await GET(boardEvent({ auth: false }) as never);
		expect(response.status).toBe(200);
		const payload = await response.json();
		const entry = payload.board.completed.find((candidate: { missionId: string }) => candidate.missionId === missionId);

		expect(entry).toMatchObject({
			missionId,
			missionName: 'Private Board Mission',
			status: 'completed',
			telegramRelay: null,
			traceRef: null,
			providerSummary: 'Provider summary requires control auth.',
			providerResults: [],
			projectLineage: {
				projectPath: null,
				previewUrl: 'http://127.0.0.1:4999',
				improvementFeedback: null
			}
		});
		expect(entry.tasks).toEqual([{ title: 'Private execution task', skills: [], status: 'completed' }]);
		expect(JSON.stringify(entry)).not.toContain('private provider output');
		expect(JSON.stringify(entry)).not.toContain('C:/Users/USER/private');
		expect(JSON.stringify(entry)).not.toContain('primary');
		expect(JSON.stringify(entry)).not.toContain('private-skill');
	});

	it('moves started-only missions out of running when no task or provider evidence appears', async () => {
		const missionId = `spark-board-orphan-start-${Date.now()}`;
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-05-23T13:20:00.000Z'));
		vi.spyOn(providerRuntime, 'getMissionResults').mockImplementation(() => []);
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));

		await relayMissionControlEvent({
			type: 'mission_started',
			missionId,
			missionName: 'Build a Tiny Telegram Smoke App',
			source: 'spark-run',
			timestamp: '2026-05-23T13:13:45.000Z'
		});

		const response = await GET(boardEvent() as never);
		expect(response.status).toBe(200);
		const payload = await response.json();

		expect(payload.board.running.find((candidate: { missionId: string }) => candidate.missionId === missionId)).toBeUndefined();
		expect(payload.board.failed.find((candidate: { missionId: string }) => candidate.missionId === missionId)).toMatchObject({
			missionId,
			status: 'failed',
			lastEventType: 'provider_stalled',
			taskStatusCounts: { queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0, total: 0 },
			providerSummary: null
		});
	});
});
