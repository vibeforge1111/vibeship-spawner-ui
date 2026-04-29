import { describe, expect, it } from 'vitest';
import { mergeMissionBoardCards, type MissionBoardCard } from './mission-board-cards';

function card(partial: Partial<MissionBoardCard>): MissionBoardCard {
	return {
		id: 'mission-1',
		name: 'Mission',
		status: 'ready',
		mode: 'spark',
		source: 'spark',
		updatedAt: '2026-04-28T10:00:00.000Z',
		createdAt: '2026-04-28T09:55:00.000Z',
		taskCount: 0,
		...partial
	};
}

describe('mergeMissionBoardCards', () => {
	it('keeps live relay status when an older static mission has the same id', () => {
		const live = card({
			id: 'mission-1777211869020',
			status: 'running',
			source: 'spark',
			updatedAt: '2026-04-28T10:05:00.000Z',
			taskCount: 1,
			taskStatusCounts: { queued: 0, running: 1, completed: 0, failed: 0, cancelled: 0, total: 1 },
			tasks: [{ title: 'Build UI', skills: ['canvas'] }]
		});
		const staleStatic = card({
			id: 'mission-1777211869020',
			status: 'ready',
			source: 'mcp',
			mode: 'multi-llm-orchestrator',
			updatedAt: '2026-04-28T10:01:00.000Z',
			taskCount: 3,
			tasks: [
				{ title: 'Create files', skills: [] },
				{ title: 'Build UI', skills: [] },
				{ title: 'Wire controls', skills: [] }
			]
		});

		const [merged] = mergeMissionBoardCards([live], [staleStatic]);

		expect(merged.status).toBe('running');
		expect(merged.source).toBe('spark');
		expect(merged.mode).toBe('spark');
		expect(merged.updatedAt).toBe('2026-04-28T10:05:00.000Z');
		expect(merged.taskCount).toBe(3);
		expect(merged.taskStatusCounts).toEqual({ queued: 0, running: 1, completed: 0, failed: 0, cancelled: 0, total: 1 });
		expect(merged.tasks).toEqual([{ title: 'Build UI', skills: ['canvas'] }]);
	});

	it('uses static task details when the live relay has not received task events yet', () => {
		const live = card({
			id: 'mission-2',
			status: 'running',
			source: 'spark',
			taskCount: 0,
			tasks: []
		});
		const staticCard = card({
			id: 'mission-2',
			status: 'ready',
			source: 'mcp',
			taskCount: 2,
			tasks: [
				{ title: 'Create files', skills: [] },
				{ title: 'Render UI', skills: [] }
			]
		});

		const [merged] = mergeMissionBoardCards([live], [staticCard]);

		expect(merged.status).toBe('running');
		expect(merged.taskCount).toBe(2);
		expect(merged.tasks).toEqual(staticCard.tasks);
	});

	it('keeps completed live progress visible when static mission storage is stale', () => {
		const live = card({
			id: 'mission-3',
			status: 'completed',
			source: 'spark',
			updatedAt: '2026-04-28T10:10:00.000Z',
			taskCount: 3,
			taskStatusCounts: { queued: 0, running: 0, completed: 3, failed: 0, cancelled: 0, total: 3 },
			taskNames: ['Create shell', 'Wire controls', 'Write README'],
			tasks: [
				{ title: 'Create shell', skills: [], status: 'completed' },
				{ title: 'Wire controls', skills: [], status: 'completed' },
				{ title: 'Write README', skills: [], status: 'completed' }
			],
			providerSummary: 'Codex: shipped and verified'
		});
		const staleStatic = card({
			id: 'mission-3',
			status: 'running',
			source: 'mcp',
			mode: 'multi-llm-orchestrator',
			updatedAt: '2026-04-28T10:05:00.000Z',
			taskCount: 3,
			tasks: [
				{ title: 'Create shell', skills: [], status: 'running' },
				{ title: 'Wire controls', skills: [], status: 'queued' },
				{ title: 'Write README', skills: [], status: 'queued' }
			]
		});

		const [merged] = mergeMissionBoardCards([live], [staleStatic]);

		expect(merged.status).toBe('completed');
		expect(merged.updatedAt).toBe('2026-04-28T10:10:00.000Z');
		expect(merged.taskStatusCounts).toEqual({
			queued: 0,
			running: 0,
			completed: 3,
			failed: 0,
			cancelled: 0,
			total: 3
		});
		expect(merged.tasks?.map((task) => task.status)).toEqual(['completed', 'completed', 'completed']);
		expect(merged.providerSummary).toBe('Codex: shipped and verified');
	});

	it('preserves failed provider details over older static task text', () => {
		const live = card({
			id: 'mission-4',
			status: 'failed',
			source: 'spark',
			updatedAt: '2026-04-28T10:20:00.000Z',
			taskCount: 2,
			taskStatusCounts: { queued: 0, running: 0, completed: 0, failed: 2, cancelled: 0, total: 2 },
			tasks: [
				{ title: 'Create shell', skills: [], status: 'failed' },
				{ title: 'Run final smoke verification', skills: [], status: 'failed' }
			],
			providerSummary: 'Codex: command exited 1',
			providerResults: [{ providerId: 'codex', status: 'failed', summary: 'command exited 1' }]
		});
		const staleStatic = card({
			id: 'mission-4',
			status: 'ready',
			source: 'mcp',
			updatedAt: '2026-04-28T10:00:00.000Z',
			taskCount: 2,
			summary: 'Static plan only'
		});

		const [merged] = mergeMissionBoardCards([live], [staleStatic]);

		expect(merged.status).toBe('failed');
		expect(merged.taskStatusCounts).toMatchObject({ failed: 2, total: 2 });
		expect(merged.providerSummary).toBe('Codex: command exited 1');
		expect(merged.providerResults).toEqual([
			{ providerId: 'codex', status: 'failed', summary: 'command exited 1' }
		]);
	});

	it('preserves mission detail links from live relay cards', () => {
		const live = card({
			id: 'mission-5',
			source: 'spark',
			status: 'running',
			detailHref: '/missions/mission-5',
			canvasHref: '/canvas?pipeline=prd-5&mission=mission-5'
		});
		const staticCard = card({
			id: 'mission-5',
			source: 'mcp',
			status: 'ready',
			detailHref: '/missions/static-mission-5'
		});

		const [merged] = mergeMissionBoardCards([live], [staticCard]);

		expect(merged.detailHref).toBe('/missions/mission-5');
		expect(merged.canvasHref).toBe('/canvas?pipeline=prd-5&mission=mission-5');
	});
});
