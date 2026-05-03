import skillCatalog from '$lib/data/skill-matcher-catalog.json';
import { rankSkillsForText, type SkillRecommendationTier } from '$lib/services/h70-skill-matcher';
import {
	CHALLENGE_RECOMMENDATION_CASES,
	COVERAGE_GAPS_BY_CASE,
	DASHBOARD_RECOMMENDATION_CASES,
	evaluateSkillIds,
	GOLDEN_RECOMMENDATION_CASES,
	summarizeSkillRecommendationEvals,
	type SkillCoverageGap,
	type SkillRecommendationEvalCase
} from '$lib/services/skill-recommendation-evals';

const DEFAULT_TOP_K = 10;

type CatalogSkill = {
	name?: string;
	category?: string;
};
type DashboardSkill = {
	id: string;
	name: string;
	category: string;
	score: number;
	reason: string;
	tier: SkillRecommendationTier;
	isLabeledRelevant: boolean;
	isUnwanted: boolean;
};
type DashboardCase = ReturnType<typeof evaluateSkillIds> & {
	topK: number;
	expected: {
		mustInclude: string[];
		anyOf: string[][];
		mustNotInclude: string[];
		labels: string[];
	};
	coverageGap?: SkillCoverageGap;
	skills: DashboardSkill[];
};

const catalog = skillCatalog as Record<string, CatalogSkill>;

function expectedLabels(testCase: SkillRecommendationEvalCase): string[] {
	return [
		...(testCase.mustInclude || []),
		...(testCase.anyOf || []).map((group) => `one of ${group.join(' / ')}`),
		...(testCase.mustNotInclude || []).map((id) => `not ${id}`)
	];
}

function buildPrecisionAudit(cases: DashboardCase[]) {
	const noisySkillCounts = new Map<string, { id: string; name: string; count: number; cases: string[] }>();
	const lowPrecisionCases = [...cases]
		.sort((a, b) => a.labeledPrecisionAtK - b.labeledPrecisionAtK || a.score - b.score)
		.slice(0, 12)
		.map((testCase) => ({
			name: testCase.name,
			suite: testCase.suite,
			precision: testCase.labeledPrecisionAtK,
			score: testCase.score,
			unlabeled: testCase.skills
				.filter((skill) => !skill.isLabeledRelevant && !skill.isUnwanted)
				.slice(0, 8)
				.map((skill) => skill.id),
			expected: testCase.relevantReturned,
			coverageGap: testCase.coverageGap
		}));

	for (const testCase of cases) {
		for (const skill of testCase.skills) {
			if (skill.isLabeledRelevant || skill.isUnwanted) continue;
			const existing = noisySkillCounts.get(skill.id) || {
				id: skill.id,
				name: skill.name,
				count: 0,
				cases: []
			};
			existing.count += 1;
			existing.cases.push(testCase.name);
			noisySkillCounts.set(skill.id, existing);
		}
	}

	const noisySkills = [...noisySkillCounts.values()]
		.sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
		.slice(0, 18);

	return { lowPrecisionCases, noisySkills };
}

export function load() {
	const cases = DASHBOARD_RECOMMENDATION_CASES.map((testCase) => {
		const topK = testCase.maxResults || DEFAULT_TOP_K;
		const ranks = rankSkillsForText(testCase.prompt, topK);
		const result = evaluateSkillIds(testCase, ranks.map((rank) => rank.skillId));
		const coverageGap = COVERAGE_GAPS_BY_CASE[testCase.name];
		const activeCoverageGap = coverageGap && !catalog[coverageGap.skillId] ? coverageGap : undefined;

		return {
			...result,
			topK,
			expected: {
				mustInclude: testCase.mustInclude || [],
				anyOf: testCase.anyOf || [],
				mustNotInclude: testCase.mustNotInclude || [],
				labels: expectedLabels(testCase)
			},
			coverageGap: activeCoverageGap,
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
	const goldenSummary = summarizeSkillRecommendationEvals(
		cases.filter((testCase) => testCase.suite === 'golden')
	);
	const challengeSummary = summarizeSkillRecommendationEvals(
		cases.filter((testCase) => testCase.suite === 'challenge')
	);
	const returnedRecommendationCount = cases.reduce((sum, testCase) => sum + testCase.ids.length, 0);
	const topKLimitSlots = cases.reduce((sum, testCase) => sum + testCase.topK, 0);
	const coverageGaps = cases
		.filter((testCase) => testCase.coverageGap)
		.map((testCase) => ({
			caseName: testCase.name,
			precision: testCase.labeledPrecisionAtK,
			suite: testCase.suite,
			...testCase.coverageGap!
		}))
		.sort((a, b) => a.precision - b.precision || a.caseName.localeCompare(b.caseName));
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
			evalCaseCount: cases.length,
			goldenCaseCount: GOLDEN_RECOMMENDATION_CASES.length,
			challengeCaseCount: CHALLENGE_RECOMMENDATION_CASES.length,
			coverageGapCount: coverageGaps.length,
			topKLimitSlots,
			returnedRecommendationCount
		},
		summary: {
			...summary,
			golden: goldenSummary,
			challenge: challengeSummary,
			tierCounts,
			lowPrecisionCases: cases
				.filter((testCase) => testCase.labeledPrecisionAtK < 0.5)
				.map((testCase) => testCase.name)
		},
		coverageGaps,
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
		precisionAudit: buildPrecisionAudit(cases),
		cases
	};
}
