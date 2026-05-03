import { describe, expect, it } from 'vitest';
import { CHALLENGE_RECOMMENDATION_CASES, GOLDEN_RECOMMENDATION_CASES } from '$lib/services/skill-recommendation-evals';
import { load } from './+page.server';

describe('/internal/skill-evals route', () => {
	it('loads honest eval health with catalog counts and paired skill details', () => {
		const data = load();

		expect(data.project.catalogSkillCount).toBeGreaterThan(500);
		expect(data.project.goldenCaseCount).toBe(GOLDEN_RECOMMENDATION_CASES.length);
		expect(data.project.challengeCaseCount).toBe(CHALLENGE_RECOMMENDATION_CASES.length);
		expect(data.project.evalCaseCount).toBe(
			GOLDEN_RECOMMENDATION_CASES.length + CHALLENGE_RECOMMENDATION_CASES.length
		);
		expect(data.project.coverageGapCount).toBe(0);
		expect(data.summary.golden.passRate).toBe(1);
		expect(data.summary.challenge.passRate).toBe(1);
		expect(data.summary.failures.length).toBe(0);
		expect(data.summary.lowPrecisionCases.length).toBeGreaterThan(0);
		expect(data.project.returnedRecommendationCount).toBeGreaterThan(400);
		expect(data.cases[0].skills[0]).toEqual(
			expect.objectContaining({
				id: expect.any(String),
				name: expect.any(String),
				score: expect.any(Number),
				tier: expect.stringMatching(/^(core|supporting|related)$/)
			})
		);
	});
});
