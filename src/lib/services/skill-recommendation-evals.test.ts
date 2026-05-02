import { describe, expect, it } from 'vitest';
import {
	evaluateSkillIds,
	evaluateSkillRecommendations,
	CHALLENGE_RECOMMENDATION_CASES,
	GOLDEN_RECOMMENDATION_CASES,
	summarizeSkillRecommendationEvals
} from './skill-recommendation-evals';

describe('skill recommendation eval scoring', () => {
	it('passes the current golden recommendation set', () => {
		const results = evaluateSkillRecommendations();
		const summary = summarizeSkillRecommendationEvals(results);

		expect(summary.caseCount).toBe(GOLDEN_RECOMMENDATION_CASES.length);
		expect(summary.passCount).toBe(summary.caseCount);
		expect(summary.passRate).toBe(1);
		expect(summary.averageRequiredRecall).toBe(1);
		expect(summary.averageAnyOfRecall).toBe(1);
		expect(summary.averageMustNotCleanRate).toBe(1);
		expect(summary.averageLabeledPrecisionAtK).toBeGreaterThanOrEqual(0.55);
		expect(results.reduce((sum, result) => sum + result.ids.length, 0)).toBeGreaterThan(400);
	});

	it('keeps harder everyday challenge cases visible as a non-blocking improvement queue', () => {
		const results = evaluateSkillRecommendations(CHALLENGE_RECOMMENDATION_CASES);
		const summary = summarizeSkillRecommendationEvals(results);

		expect(summary.caseCount).toBe(12);
		expect(summary.passCount).toBeGreaterThan(0);
		expect(summary.passCount).toBeLessThan(summary.caseCount);
		expect(summary.failures).toContain('AI meeting notes');
	});

	it('reports missing required, missing any-of, and unwanted skills', () => {
		const result = evaluateSkillIds(
			{
				name: 'synthetic miss',
				prompt: 'synthetic',
				mustInclude: ['auth-specialist'],
				anyOf: [['stripe-integration', 'subscription-billing']],
				mustNotInclude: ['nft-engineer']
			},
			['nft-engineer', 'copywriting']
		);

		expect(result.pass).toBe(false);
		expect(result.missingRequired).toEqual(['auth-specialist']);
		expect(result.missingAnyOf).toEqual([['stripe-integration', 'subscription-billing']]);
		expect(result.unwanted).toEqual(['nft-engineer']);
		expect(result.requiredRecall).toBe(0);
		expect(result.anyOfRecall).toBe(0);
		expect(result.mustNotCleanRate).toBe(0);
	});
});
