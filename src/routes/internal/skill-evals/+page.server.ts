import skillCatalog from '$lib/data/skill-matcher-catalog.json';
import { rankSkillsForText, type SkillRecommendationTier } from '$lib/services/h70-skill-matcher';
import {
	CHALLENGE_RECOMMENDATION_CASES,
	DASHBOARD_RECOMMENDATION_CASES,
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
type CoverageGap = {
	skillId: string;
	path: string;
	why: string;
};
type DashboardCase = ReturnType<typeof evaluateSkillIds> & {
	topK: number;
	expected: {
		mustInclude: string[];
		anyOf: string[][];
		mustNotInclude: string[];
		labels: string[];
	};
	coverageGap?: CoverageGap;
	skills: DashboardSkill[];
};

const catalog = skillCatalog as Record<string, CatalogSkill>;
const COVERAGE_GAPS_BY_CASE: Record<string, CoverageGap> = {
	'Notification preferences': {
		skillId: 'notification-preferences',
		path: 'backend/notification-preferences.yaml',
		why: 'Current matches use push, email, forms, and accessibility proxies instead of a dedicated preference-center skill.'
	},
	'Outgoing webhook platform': {
		skillId: 'webhook-provider-platform',
		path: 'backend/webhook-provider-platform.yaml',
		why: 'Current webhook skill is mostly inbound processing; outgoing subscriptions, signing, and delivery logs deserve their own surface.'
	},
	'Bulk admin actions': {
		skillId: 'bulk-actions-safety',
		path: 'frontend/bulk-actions-safety.yaml',
		why: 'Current matches cover tables and audit logs, but not partial failure, undo, and confirmation ergonomics.'
	},
	'Data retention deletion': {
		skillId: 'data-retention-deletion',
		path: 'security/data-retention-deletion.yaml',
		why: 'Current matches are privacy and cron proxies; retention policy implementation is a distinct recurring request.'
	},
	'Usage metering entitlements': {
		skillId: 'usage-metering-entitlements',
		path: 'backend/usage-metering-entitlements.yaml',
		why: 'Current matches cover billing and analytics, but not runtime quotas, feature gates, and entitlement enforcement.'
	},
	'Onboarding checklist': {
		skillId: 'feature-onboarding-checklists',
		path: 'product/feature-onboarding-checklists.yaml',
		why: 'Current matches cover analytics and onboarding broadly, but not checklist state, activation tasks, and completion UX.'
	},
	'Permissioned file sharing': {
		skillId: 'permissioned-file-sharing',
		path: 'backend/permissioned-file-sharing.yaml',
		why: 'Current matches cover uploads and RBAC separately; share links, expiry, and file ACLs need one focused skill.'
	},
	'Product feedback board': {
		skillId: 'product-feedback-roadmapping',
		path: 'product/product-feedback-roadmapping.yaml',
		why: 'Current matches use social, analytics, and changelog proxies instead of feedback capture and roadmap workflow.'
	},
	'App store release ops': {
		skillId: 'app-store-release-ops',
		path: 'mobile/app-store-release-ops.yaml',
		why: 'Current matches cover Expo and push, but not TestFlight, Play Console, metadata, and rollout operations.'
	},
	'Accessibility QA pass': {
		skillId: 'web-accessibility-qa',
		path: 'testing/web-accessibility-qa.yaml',
		why: 'Current matches cover accessibility and Playwright separately; QA pass structure should be its own skill.'
	},
	'Privacy consent manager': {
		skillId: 'privacy-consent-management',
		path: 'security/privacy-consent-management.yaml',
		why: 'Current matches cover GDPR and analytics, but not cookie consent, tracking preferences, and consent records.'
	},
	'Realtime collaboration conflicts': {
		skillId: 'realtime-collab-conflict-resolution',
		path: 'backend/realtime-collab-conflict-resolution.yaml',
		why: 'Current matches cover realtime and local-first primitives, not conflict-resolution decisions.'
	}
};

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

		return {
			...result,
			topK,
			expected: {
				mustInclude: testCase.mustInclude || [],
				anyOf: testCase.anyOf || [],
				mustNotInclude: testCase.mustNotInclude || [],
				labels: expectedLabels(testCase)
			},
			coverageGap: COVERAGE_GAPS_BY_CASE[testCase.name],
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
