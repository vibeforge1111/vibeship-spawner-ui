import { describe, expect, it } from 'vitest';
import { GET } from '../../routes/api/h70-skills/[skillId]/+server';

async function getSkill(skillId: string) {
	const response = await GET({
		params: { skillId },
		request: new Request(`http://localhost/api/h70-skills/${skillId}`)
	} as never);
	return response.json();
}

function clearCatalogEnv() {
	delete process.env.SPARK_SKILL_CATALOG_TIER;
	delete process.env.SPAWNER_SKILL_CATALOG_TIER;
	delete process.env.SPARK_SKILL_GRAPHS_TOKEN;
	delete process.env.SPAWNER_SKILL_GRAPHS_TOKEN;
}

describe('/api/h70-skills entitlement behavior', () => {
	it('returns full bodies for free skills without Pro access', async () => {
		clearCatalogEnv();

		const payload = await getSkill('llm-architect');

		expect(payload.entitlement).toMatchObject({ tier: 'free', locked: false });
		expect(payload.source).not.toBe('spark-skill-graphs-pro-locked');
		expect(payload.formattedContent).toContain('##');
	});

	it('returns locked metadata for Pro skills until Pro access is enabled', async () => {
		clearCatalogEnv();

		const payload = await getSkill('stripe-subscriptions');

		expect(payload.entitlement).toMatchObject({ tier: 'premium', catalogTier: 'free', locked: true });
		expect(payload.source).toBe('spark-skill-graphs-pro-locked');
		expect(payload.formattedContent).toContain('Pro Skill Body Locked');
	});

	it('returns full Pro skill bodies when Pro catalog access is enabled', async () => {
		clearCatalogEnv();
		process.env.SPARK_SKILL_CATALOG_TIER = 'pro';

		try {
			const payload = await getSkill('stripe-subscriptions');

			expect(payload.entitlement).toMatchObject({ tier: 'premium', catalogTier: 'pro', locked: false });
			expect(payload.source).not.toBe('spark-skill-graphs-pro-locked');
			expect(payload.formattedContent).toContain('##');
		} finally {
			clearCatalogEnv();
		}
	});
});

