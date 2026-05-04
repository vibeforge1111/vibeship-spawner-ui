/**
 * Server-only skill catalog entitlement helpers.
 */

import { isFreeSkill, normalizeCatalogTier } from '$lib/skill-entitlements';
export { FREE_SKILL_IDS, FREE_SKILL_ID_SET, applySkillEntitlements, isFreeSkill } from '$lib/skill-entitlements';
import type { SkillCatalogTier } from '$lib/skill-entitlements';

export function skillCatalogTierFromEnv(env: NodeJS.ProcessEnv = process.env): SkillCatalogTier {
	if (normalizeCatalogTier(env.SPARK_SKILL_CATALOG_TIER) === 'pro') return 'pro';
	if (normalizeCatalogTier(env.SPAWNER_SKILL_CATALOG_TIER) === 'pro') return 'pro';
	if (env.SPARK_SKILL_GRAPHS_TOKEN || env.SPAWNER_SKILL_GRAPHS_TOKEN) return 'pro';
	return 'free';
}

export function canLoadFullSkillBody(skillId: string, env: NodeJS.ProcessEnv = process.env): boolean {
	return isFreeSkill(skillId) || skillCatalogTierFromEnv(env) === 'pro';
}

export function entitlementForSkill(skillId: string, env: NodeJS.ProcessEnv = process.env) {
	const tier = isFreeSkill(skillId) ? 'free' : 'premium';
	const catalogTier = skillCatalogTierFromEnv(env);
	return {
		tier,
		catalogTier,
		locked: tier === 'premium' && catalogTier !== 'pro',
		requiresAuth: tier === 'premium',
		fallbackAvailable: true
	};
}
