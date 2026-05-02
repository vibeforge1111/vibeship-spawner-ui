export type SkillCatalogTier = 'free' | 'pro';

export interface SkillEntitlementRecord {
	id: string;
	tier?: string;
	requiresAuth?: boolean;
	fallbackAvailable?: boolean;
}

export const FREE_SKILL_IDS = [
	'ai-chatbot-builder',
	'llm-architect',
	'prompt-engineer',
	'rag-engineer',
	'agent-tool-builder',
	'agent-evaluation',
	'conversation-memory',
	'browser-automation',
	'structured-output',
	'openai-api-patterns',
	'claude-api-integration',
	'ai-observability',
	'prompt-caching',
	'prompt-injection-defense',
	'frontend-engineer',
	'sveltekit',
	'react-patterns',
	'tailwind-css',
	'design-systems',
	'ui-design',
	'backend-engineer',
	'api-designer',
	'database-architect',
	'postgres-wizard',
	'authentication-oauth',
	'security-owasp',
	'docker-specialist',
	'railway-deployment',
	'playwright-testing',
	'git-workflow'
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
		const tier = isFreeSkill(skill.id) ? 'free' : 'premium';
		return {
			...skill,
			tier,
			requiresAuth: tier === 'premium',
			fallbackAvailable: true
		};
	});
}

