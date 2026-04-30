import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { GET } from './+server';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';
import { providerRuntime, type ProviderMissionResultSnapshot } from '$lib/server/provider-runtime';

function event(url: string) {
	return {
		request: new Request(url),
		url: new URL(url),
		getClientAddress: () => '127.0.0.1'
	};
}

function providerResult(overrides: Partial<ProviderMissionResultSnapshot> = {}): ProviderMissionResultSnapshot {
	return {
		providerId: 'codex',
		status: 'running',
		response: null,
		error: null,
		durationMs: null,
		tokenUsage: null,
		startedAt: '2026-04-28T10:00:00.000Z',
		completedAt: null,
		...overrides
	};
}

describe('/api/mission-control/trace integration', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		delete process.env.SPAWNER_STATE_DIR;
	});

	it('stitches request, canvas, dispatch, kanban, provider, and timeline state for a Telegram mission', async () => {
		const stateDir = await mkdtemp(path.join(tmpdir(), 'spawner-trace-'));
		process.env.SPAWNER_STATE_DIR = stateDir;
		const requestId = `tg-build-trace-1777369000000`;
		const missionId = 'mission-1777369000000';

		await mkdir(path.join(stateDir, 'results'), { recursive: true });
		await writeFile(
			path.join(stateDir, 'pending-request.json'),
			JSON.stringify({
				requestId,
				projectName: 'Trace Mission',
				status: 'pending',
				relay: {
					missionId,
					requestId,
					chatId: 'telegram-chat',
					userId: 'telegram-user',
					telegramRelay: { port: 8789, profile: 'spark-agi' }
				}
			}),
			'utf-8'
		);
		await writeFile(
			path.join(stateDir, 'results', `${requestId}.json`),
			JSON.stringify({
				success: true,
				projectName: 'Trace Mission',
				tasks: [{ id: 'task-1', title: 'Create the traceable app' }]
			}),
			'utf-8'
		);
		await writeFile(
			path.join(stateDir, 'last-canvas-load.json'),
			JSON.stringify({
				pipelineId: `prd-${requestId}`,
				pipelineName: 'Trace Mission',
				autoRun: true,
				nodes: [{ id: 'task-1' }],
				relay: { missionId, requestId }
			}),
			'utf-8'
		);

		await relayMissionControlEvent({
			type: 'mission_created',
			missionId,
			source: 'canvas-dispatch',
			data: {
				missionName: 'Trace Mission',
				plannedTasks: [{ title: 'Create the traceable app', skills: ['frontend-engineer'] }],
				telegramRelay: { port: 8789, profile: 'spark-agi' }
			}
		});
		await relayMissionControlEvent({
			type: 'task_started',
			missionId,
			taskName: 'Create the traceable app',
			source: 'codex',
			data: { telegramRelay: { port: 8789, profile: 'spark-agi' } }
		});

		vi.spyOn(providerRuntime, 'getMissionResults').mockImplementation((id) =>
			id === missionId ? [providerResult()] : []
		);
		vi.spyOn(providerRuntime, 'getMissionStatus').mockImplementation((id) => ({
			allComplete: false,
			anyFailed: false,
			paused: false,
			pausedReason: null,
			lastReason: id === missionId ? 'Dispatch started' : null,
			snapshotAvailable: id === missionId,
			resumeable: false,
			resumeBlocker: null,
			providers: id === missionId ? { codex: 'running' } : ({} as Record<string, 'running'>)
		}));

		const response = await GET(
			event(`http://127.0.0.1/api/mission-control/trace?requestId=${requestId}`) as never
		);
		expect(response.status).toBe(200);
		const payload = await response.json();

		expect(payload).toMatchObject({
			ok: true,
			missionId,
			requestId,
			phase: 'executing',
			progress: {
				percent: 0,
				taskCounts: { queued: 0, running: 1, completed: 0, failed: 0, cancelled: 0, total: 1 },
				currentTask: 'Create the traceable app'
			},
			surfaces: {
				telegram: {
					relay: { port: 8789, profile: 'spark-agi', url: null },
					chatId: 'telegram-chat',
					userId: 'telegram-user'
				},
				canvas: {
					pipelineId: `prd-${requestId}`,
					pipelineName: 'Trace Mission',
					autoRun: true,
					nodeCount: 1
				},
				kanban: {
					bucket: 'running'
				},
				dispatch: {
					allComplete: false,
					anyFailed: false,
					providers: { codex: 'running' },
					lastReason: 'Dispatch started'
				}
			},
			providerSummary: 'Codex: running'
		});
		expect(payload.timeline[0]).toMatchObject({
			missionId,
			eventType: 'task_started',
			taskName: 'Create the traceable app'
		});
	});
});
