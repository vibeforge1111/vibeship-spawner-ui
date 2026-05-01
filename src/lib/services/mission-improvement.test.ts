import { describe, expect, it } from 'vitest';
import { buildMissionImprovementDraft } from './mission-improvement';

describe('buildMissionImprovementDraft', () => {
	it('builds an explicit Spark run payload for the next project iteration', () => {
		const draft = buildMissionImprovementDraft(
			{
				id: 'mission-polish-2',
				name: 'Founder Signal Room polish 2',
				projectLineage: {
					projectId: 'project-founder-signal-room',
					projectPath: 'C:\\Users\\USER\\Desktop\\founder-signal-room',
					previewUrl: 'http://127.0.0.1:5555/preview/token/index.html',
					parentMissionId: 'mission-original',
					iterationNumber: 2,
					improvementFeedback: 'make it more Spark colored'
				}
			},
			'make mobile less cramped'
		);

		expect(draft.payload).toEqual({
			projectId: 'project-founder-signal-room',
			projectPath: 'C:\\Users\\USER\\Desktop\\founder-signal-room',
			previewUrl: 'http://127.0.0.1:5555/preview/token/index.html',
			parentMissionId: 'mission-polish-2',
			iterationNumber: 3,
			improvementFeedback: 'make mobile less cramped'
		});
		expect(draft.goal).toContain('not a new scaffold');
		expect(draft.goal).toContain('User feedback:\nmake mobile less cramped');
		expect(draft.goal).toContain('Parent mission: mission-polish-2');
	});

	it('falls back to iteration 2 for a shipped project without iteration metadata', () => {
		const draft = buildMissionImprovementDraft({
			id: 'mission-original',
			name: 'Founder Signal Room',
			projectLineage: {
				projectId: null,
				projectPath: 'C:\\Users\\USER\\Desktop\\founder-signal-room',
				previewUrl: null,
				parentMissionId: null,
				iterationNumber: null,
				improvementFeedback: null
			}
		});

		expect(draft.payload).toMatchObject({
			projectPath: 'C:\\Users\\USER\\Desktop\\founder-signal-room',
			parentMissionId: 'mission-original',
			iterationNumber: 2
		});
		expect(draft.payload.improvementFeedback).toBeUndefined();
	});
});

