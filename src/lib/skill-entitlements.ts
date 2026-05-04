export type SkillCatalogTier = 'free' | 'pro';

export interface SkillEntitlementRecord {
	id: string;
	tier?: string;
	requiresAuth?: boolean;
	fallbackAvailable?: boolean;
}

export const FREE_SKILL_IDS = [
	'api-design',
	'authentication-oauth',
	'database-architect',
	'error-handling',
	'observability',
	'structured-output',
	'webhook-processing',
	'queue-workers',
	'rate-limiting',
	'redis-specialist',
	'data-pipeline',
	'vector-specialist',
	'rag-engineer',
	'llm-architect',
	'prompt-engineer',
	'ai-observability',
	'frontend-engineer',
	'react-patterns',
	'responsive-mobile-first',
	'forms-validation',
	'accessibility',
	'ui-design',
	'ux-design',
	'design-systems',
	'stripe-integration',
	'subscription-billing',
	'testing-strategies',
	'playwright-testing',
	'security-owasp',
	'devops'
] as const;

export const FREE_SKILL_ID_SET = new Set<string>(FREE_SKILL_IDS);

export function normalizeCatalogTier(value: unknown): SkillCatalogTier {
	return value === 'pro' || value === 'premium' || value === 'full' ? 'pro' : 'free';
}

export function isFreeSkill(skillId: string): boolean {
	return FREE_SKILL_ID_SET.has(skillId);
}

export function applySkillEntitlements<T extends SkillEntitlementRecord>(skills: T[]): T[] {
	return skills.map((skill) => {
		const tier =
			skill.tier === 'free' || skill.tier === 'premium'
				? skill.tier
				: isFreeSkill(skill.id)
					? 'free'
					: 'premium';
		return {
			...skill,
			tier,
			requiresAuth: tier === 'premium',
			fallbackAvailable: true
		};
	});
}

