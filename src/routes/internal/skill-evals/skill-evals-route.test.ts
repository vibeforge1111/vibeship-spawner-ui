import { describe, expect, it } from 'vitest';
import { CHALLENGE_RECOMMENDATION_CASES, GOLDEN_RECOMMENDATION_CASES } from '$lib/services/skill-recommendation-evals';
import { load } from './+page.server';

describe('/internal/skill-evals route', () => {
	it('loads golden eval results with catalog counts and paired skill details', () => {
		const data = load();

		expect(data.project.catalogSkillCount).toBeGreaterThan(500);
		expect(data.project.goldenCaseCount).toBe(GOLDEN_RECOMMENDATION_CASES.length);
		expect(data.project.challengeCaseCount).toBe(CHALLENGE_RECOMMENDATION_CASES.length);
		expect(data.project.evalCaseCount).toBe(
			GOLDEN_RECOMMENDATION_CASES.length + CHALLENGE_RECOMMENDATION_CASES.length
		);
		expect(data.project.coverageGapCount).toBe(12);
		expect(data.coverageGaps[0]).toEqual(
			expect.objectContaining({
				caseName: expect.any(String),
				skillId: expect.any(String),
				path: expect.stringMatching(/\.yaml$/),
				why: expect.any(String)
			})
		);
		expect(data.summary.golden.passCount).toBe(data.summary.golden.caseCount);
		expect(data.summary.challenge.passCount).toBe(data.summary.challenge.caseCount);
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
