import { describe, expect, it } from 'vitest';
import {
	FREE_SKILL_IDS,
	applySkillEntitlements,
	canLoadFullSkillBody,
	entitlementForSkill,
	skillCatalogTierFromEnv
} from './skill-entitlements';

describe('skill entitlements', () => {
	it('keeps the public starter catalog to exactly 30 free skills', () => {
		expect(FREE_SKILL_IDS).toHaveLength(30);
		expect(new Set(FREE_SKILL_IDS).size).toBe(30);
	});

	it('marks the starter skills free and the rest premium', () => {
		const skills = applySkillEntitlements([
			{ id: 'llm-architect' },
			{ id: 'stripe-subscriptions' }
		]);

		expect(skills).toEqual([
			{ id: 'llm-architect', tier: 'free', requiresAuth: false, fallbackAvailable: true },
			{ id: 'stripe-subscriptions', tier: 'premium', requiresAuth: true, fallbackAvailable: true }
		]);
	});

	it('loads full premium skill bodies only when Pro catalog access is enabled', () => {
		expect(skillCatalogTierFromEnv({})).toBe('free');
		expect(skillCatalogTierFromEnv({ SPARK_SKILL_CATALOG_TIER: 'pro' })).toBe('pro');
		expect(skillCatalogTierFromEnv({ SPARK_SKILL_GRAPHS_TOKEN: 'token' })).toBe('pro');

		expect(canLoadFullSkillBody('llm-architect', {})).toBe(true);
		expect(canLoadFullSkillBody('stripe-subscriptions', {})).toBe(false);
		expect(canLoadFullSkillBody('stripe-subscriptions', { SPARK_SKILL_CATALOG_TIER: 'pro' })).toBe(true);
	});

	it('returns a clear locked entitlement for premium skills in free mode', () => {
		expect(entitlementForSkill('stripe-subscriptions', {})).toMatchObject({
			tier: 'premium',
			catalogTier: 'free',
			locked: true,
			requiresAuth: true
		});
	});
});

