import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

describe('/internal/skill-evals route', () => {
	it('loads golden eval results with catalog counts and paired skill details', () => {
		const data = load();

		expect(data.project.catalogSkillCount).toBeGreaterThan(500);
		expect(data.project.evalCaseCount).toBe(50);
		expect(data.summary.passCount).toBe(data.summary.caseCount);
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
