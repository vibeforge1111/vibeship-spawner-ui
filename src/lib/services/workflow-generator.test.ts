import { describe, expect, it } from 'vitest';
import type { AnalyzedGoal, MatchedSkill } from '$lib/types/goal';
import { generateWorkflow } from './workflow-generator';

const goal: AnalyzedGoal = {
	original: 'Create an AI art workflow',
	sanitized: 'Create an AI art workflow',
	inputType: 'short',
	keywords: ['ai', 'art'],
	domains: ['creative'],
	features: [],
	technologies: [],
	confidence: 0.9,
	needsClarification: false
};

function matchedSkill(skillId: string, tier: 1 | 2 | 3): MatchedSkill {
	return {
		skillId,
		name: skillId,
		description: skillId,
		category: 'creative',
		score: 0.8,
		matchReason: 'test',
		tier,
		tags: []
	};
}

describe('workflow generator', () => {
	it('infers connections from generated Spark delegates and pairsWell relationships', () => {
		const workflow = generateWorkflow(
			[
				matchedSkill('art-consistency', 1),
				matchedSkill('ai-image-generation', 2),
				matchedSkill('ai-video-generation', 2)
			],
			goal
		);

		expect(workflow.connections).toEqual(
			expect.arrayContaining([
				{ sourceId: 'art-consistency', targetId: 'ai-image-generation' },
				{ sourceId: 'art-consistency', targetId: 'ai-video-generation' }
			])
		);
	});
});
