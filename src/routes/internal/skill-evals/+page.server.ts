import skillCatalog from '$lib/data/skill-matcher-catalog.json';
import { rankSkillsForText, type SkillRecommendationTier } from '$lib/services/h70-skill-matcher';
import {
	evaluateSkillIds,
	GOLDEN_RECOMMENDATION_CASES,
	summarizeSkillRecommendationEvals,
	type SkillRecommendationEvalCase
} from '$lib/services/skill-recommendation-evals';

const DEFAULT_TOP_K = 10;

type CatalogSkill = {
	name?: string;
	category?: string;
};

const catalog = skillCatalog as Record<string, CatalogSkill>;

function expectedLabels(testCase: SkillRecommendationEvalCase): string[] {
	return [
		...(testCase.mustInclude || []),
		...(testCase.anyOf || []).map((group) => `one of ${group.join(' / ')}`),
		...(testCase.mustNotInclude || []).map((id) => `not ${id}`)
	];
}

export function load() {
	const cases = GOLDEN_RECOMMENDATION_CASES.map((testCase) => {
		const topK = testCase.maxResults || DEFAULT_TOP_K;
		const ranks = rankSkillsForText(testCase.prompt, topK);
		const result = evaluateSkillIds(testCase, ranks.map((rank) => rank.skillId));

		return {
			...result,
			topK,
			expected: {
				mustInclude: testCase.mustInclude || [],
				anyOf: testCase.anyOf || [],
				mustNotInclude: testCase.mustNotInclude || [],
				labels: expectedLabels(testCase)
			},
			skills: ranks.map((rank) => ({
				id: rank.skillId,
				name: catalog[rank.skillId]?.name || rank.skillId,
				category: catalog[rank.skillId]?.category || rank.category,
				score: rank.score,
				reason: rank.reason,
				tier: rank.recommendationTier as SkillRecommendationTier,
				isLabeledRelevant: result.relevantReturned.includes(rank.skillId),
				isUnwanted: result.unwanted.includes(rank.skillId)
			}))
		};
	});

	const summary = summarizeSkillRecommendationEvals(cases);
	const returnedRecommendationCount = cases.reduce((sum, testCase) => sum + testCase.ids.length, 0);
	const topKLimitSlots = cases.reduce((sum, testCase) => sum + testCase.topK, 0);
	const tierCounts = cases
		.flatMap((testCase) => testCase.skills)
		.reduce(
			(counts, skill) => {
				counts[skill.tier] += 1;
				return counts;
			},
			{ core: 0, supporting: 0, related: 0 } satisfies Record<SkillRecommendationTier, number>
		);

	return {
		generatedAt: new Date().toISOString(),
		project: {
			name: 'Spawner UI + spark-skill-graphs',
			catalogSkillCount: Object.keys(catalog).length,
			evalCaseCount: GOLDEN_RECOMMENDATION_CASES.length,
			topKLimitSlots,
			returnedRecommendationCount
		},
		summary: {
			...summary,
			tierCounts,
			lowPrecisionCases: cases
				.filter((testCase) => testCase.labeledPrecisionAtK < 0.5)
				.map((testCase) => testCase.name)
		},
		scoring: {
			passRule: 'All required skills present, every any-of group represented, and no must-not skills returned.',
			scoreWeights: [
				{ label: 'required recall', weight: 45 },
				{ label: 'any-of recall', weight: 25 },
				{ label: 'must-not clean rate', weight: 20 },
				{ label: 'labeled precision@K', weight: 10 }
			],
			precisionNote:
				'Precision is conservative: only explicitly labeled expected skills count as relevant, so plausible supporting skills are still treated as unlabeled.'
		},
		cases
	};
}
