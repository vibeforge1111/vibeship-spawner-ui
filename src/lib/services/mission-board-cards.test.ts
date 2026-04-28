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
});
