import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';
import { providerRuntime, type ProviderMissionResultSnapshot } from '$lib/server/provider-runtime';

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

function boardEvent() {
	return {
		request: new Request('http://127.0.0.1/api/mission-control/board'),
		url: new URL('http://127.0.0.1/api/mission-control/board'),
		getClientAddress: () => '127.0.0.1'
	};
}

afterEach(() => {
	vi.restoreAllMocks();
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
			taskNames: ['Build canvas flow', 'Shape build plan'],
			telegramRelay: { port: 8789, profile: 'primary', url: null },
			providerSummary: 'Codex: Built the Telegram canvas mission and updated Kanban.'
		});
		expect(entry.tasks).toEqual([
			{ title: 'Build canvas flow', skills: ['canvas', 'kanban'] },
			{ title: 'Shape build plan', skills: ['planning'] }
		]);
		expect(entry.providerResults).toEqual([
			expect.objectContaining({
				providerId: 'codex',
				status: 'completed',
				summary: 'Built the Telegram canvas mission and updated Kanban.'
			})
		]);
	});
});
