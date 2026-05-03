import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

type EnvRecord = Record<string, string | undefined>;
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type SkillCatalogTier = 'free' | 'premium' | 'unknown';

export interface SkillAccessAllowed {
	ok: true;
	tier: SkillCatalogTier;
	source: 'free' | 'spark-pro' | 'local-dev';
}

export interface SkillAccessDenied {
	ok: false;
	tier: 'premium';
	status: 401 | 403 | 503;
	code: 'not_authenticated' | 'not_entitled' | 'entitlement_service_unavailable';
	message: string;
}

export type SkillAccessResult = SkillAccessAllowed | SkillAccessDenied;

interface SkillRecord {
	id: string;
	tier?: string;
}

interface EntitlementsResponse {
	features?: unknown;
}

const PRO_SKILL_FEATURES = new Set(['spark_pro', 'drop.skills']);

let cachedSkillTiers: Map<string, SkillCatalogTier> | null = null;

function configured(value: string | undefined): string {
	return value?.trim() || '';
}

function proApiBaseUrl(env: EnvRecord): string {
	return (
		configured(env.SPAWNER_SPARK_PRO_API_BASE_URL) ||
		configured(env.SPARK_PRO_API_BASE_URL) ||
		configured(env.SPARK_PRO_BASE_URL)
	).replace(/\/+$/, '');
}

function enforcementMode(env: EnvRecord): 'enforce' | 'off' {
	const explicit = (
		configured(env.SPAWNER_PRO_SKILL_ENFORCEMENT) ||
		configured(env.SPARK_PRO_SKILL_ENFORCEMENT)
	).toLowerCase();

	if (['1', 'true', 'enforce', 'strict'].includes(explicit)) return 'enforce';
	if (['0', 'false', 'off', 'disabled'].includes(explicit)) return 'off';

	return env.NODE_ENV === 'production' && proApiBaseUrl(env) ? 'enforce' : 'off';
}

function loadSkillTierMap(): Map<string, SkillCatalogTier> {
	if (cachedSkillTiers) return cachedSkillTiers;

	const path = join(process.cwd(), 'static', 'skills.json');
	const tiers = new Map<string, SkillCatalogTier>();
	if (!existsSync(path)) {
		cachedSkillTiers = tiers;
		return tiers;
	}

	const parsed = JSON.parse(readFileSync(path, 'utf-8')) as SkillRecord[];
	for (const skill of parsed) {
		if (typeof skill?.id !== 'string') continue;
		tiers.set(skill.id, skill.tier === 'free' ? 'free' : 'premium');
	}

	cachedSkillTiers = tiers;
	return tiers;
}

export function clearSparkProEntitlementCache(): void {
	cachedSkillTiers = null;
}

export function getSkillCatalogTier(skillId: string): SkillCatalogTier {
	return loadSkillTierMap().get(skillId) ?? 'unknown';
}

function hasProSkillFeature(body: EntitlementsResponse): boolean {
	const features = Array.isArray(body.features) ? body.features : [];
	return features.some((feature) => typeof feature === 'string' && PRO_SKILL_FEATURES.has(feature));
}

export async function authorizeSkillAccess(
	skillId: string,
	request: Request,
	options: { env?: EnvRecord; fetch?: FetchLike } = {}
): Promise<SkillAccessResult> {
	const env = options.env ?? process.env;
	const tier = getSkillCatalogTier(skillId);
	if (tier !== 'premium') {
		return { ok: true, tier, source: 'free' };
	}

	if (enforcementMode(env) !== 'enforce') {
		return { ok: true, tier, source: 'local-dev' };
	}

	const baseUrl = proApiBaseUrl(env);
	if (!baseUrl) {
		return {
			ok: false,
			tier,
			status: 503,
			code: 'entitlement_service_unavailable',
			message: 'Spark Pro entitlement service is not configured.'
		};
	}

	const cookie = request.headers.get('cookie');
	const authorization = request.headers.get('authorization');
	if (!cookie && !authorization) {
		return {
			ok: false,
			tier,
			status: 401,
			code: 'not_authenticated',
			message: 'Sign in to Spark Pro to load this Pro skill.'
		};
	}

	const headers = new Headers();
	if (cookie) headers.set('cookie', cookie);
	if (authorization) headers.set('authorization', authorization);

	try {
		const response = await (options.fetch ?? fetch)(`${baseUrl}/api/member/entitlements`, {
			method: 'GET',
			headers
		});

		if (response.status === 401) {
			return {
				ok: false,
				tier,
				status: 401,
				code: 'not_authenticated',
				message: 'Sign in to Spark Pro to load this Pro skill.'
			};
		}

		if (!response.ok) {
			return {
				ok: false,
				tier,
				status: 503,
				code: 'entitlement_service_unavailable',
				message: 'Spark Pro entitlement service could not verify this skill.'
			};
		}

		const body = (await response.json()) as EntitlementsResponse;
		if (hasProSkillFeature(body)) {
			return { ok: true, tier, source: 'spark-pro' };
		}

		return {
			ok: false,
			tier,
			status: 403,
			code: 'not_entitled',
			message: 'This Pro skill requires an active Spark Pro membership.'
		};
	} catch {
		return {
			ok: false,
			tier,
			status: 503,
			code: 'entitlement_service_unavailable',
			message: 'Spark Pro entitlement service could not verify this skill.'
		};
	}
}
