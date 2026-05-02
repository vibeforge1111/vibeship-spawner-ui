import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
	evaluateSkillIds,
	GOLDEN_RECOMMENDATION_CASES,
	type SkillRecommendationEvalCase
} from './skill-recommendation-evals';
import { generatePipeline } from './smart-pipeline';

const staticSkills = JSON.parse(readFileSync(resolve('static/skills.json'), 'utf8'));

function skillIds(result: Awaited<ReturnType<typeof generatePipeline>>): string[] {
	if (!result.success || !result.pipeline) return [];
	return result.pipeline.nodes.map((node) => node.skillId);
}

function edgeIds(result: Awaited<ReturnType<typeof generatePipeline>>): string[] {
	if (!result.success || !result.pipeline) return [];
	return result.pipeline.connections.map((connection) => `${connection.sourceId}->${connection.targetId}`);
}

beforeAll(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string) => {
			if (url === '/skills.json') {
				return new Response(JSON.stringify(staticSkills), { status: 200 });
			}
			return new Response('Not found', { status: 404 });
		})
	);
});

describe('smart pipeline dogfood prompts', () => {
	it.each(GOLDEN_RECOMMENDATION_CASES)(
		'builds a coherent $name pipeline',
		async (testCase: SkillRecommendationEvalCase) => {
			const result = await generatePipeline(testCase.prompt);
			const ids = skillIds(result);
			const evaluation = evaluateSkillIds(testCase, ids);

			expect(result.success).toBe(true);
			expect(evaluation.missingRequired).toEqual([]);
			expect(evaluation.missingAnyOf).toEqual([]);
			expect(evaluation.unwanted).toEqual([]);
			expect(result.pipeline?.nodes.every((node) => ['core', 'supporting', 'related'].includes(node.recommendationTier))).toBe(true);

			if (testCase.name === 'AI art consistency') {
				expect(edgeIds(result)).toContain('art-consistency->ai-image-generation');
			}
		}
	);
});
