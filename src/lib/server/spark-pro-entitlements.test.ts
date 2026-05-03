import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	authorizeSkillAccess,
	clearSparkProEntitlementCache,
	getSkillCatalogTier
} from './spark-pro-entitlements';

const enforceEnv = {
	NODE_ENV: 'production',
	SPARK_PRO_API_BASE_URL: 'https://pro.sparkswarm.ai',
	SPAWNER_PRO_SKILL_ENFORCEMENT: 'enforce'
};

function request(headers: HeadersInit = {}): Request {
	return new Request('http://localhost/api/h70-skills/usage-metering-entitlements', { headers });
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

afterEach(() => {
	clearSparkProEntitlementCache();
	vi.restoreAllMocks();
});

describe('spark-pro-entitlements', () => {
	it('reads free and premium skill tiers from the synced catalog', () => {
		expect(getSkillCatalogTier('frontend-engineer')).toBe('free');
		expect(getSkillCatalogTier('frontend')).toBe('premium');
		expect(getSkillCatalogTier('usage-metering-entitlements')).toBe('premium');
		expect(getSkillCatalogTier('missing-skill')).toBe('unknown');
	});

	it('allows free skills without a Spark Pro call', async () => {
		const fetchMock = vi.fn();

		const result = await authorizeSkillAccess('frontend-engineer', request(), {
			env: enforceEnv,
			fetch: fetchMock
		});

		expect(result).toMatchObject({ ok: true, tier: 'free', source: 'free' });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('keeps premium skills available in local development when enforcement is off', async () => {
		const result = await authorizeSkillAccess('usage-metering-entitlements', request(), {
			env: { NODE_ENV: 'development' },
			fetch: vi.fn()
		});

		expect(result).toMatchObject({ ok: true, tier: 'premium', source: 'local-dev' });
	});

	it('denies premium skills in enforced mode when no member session is present', async () => {
		const result = await authorizeSkillAccess('usage-metering-entitlements', request(), {
			env: enforceEnv,
			fetch: vi.fn()
		});

		expect(result).toMatchObject({
			ok: false,
			status: 401,
			code: 'not_authenticated'
		});
	});

	it('allows premium skills when Spark Pro returns the skill graph entitlement', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ features: ['drop.skills'] }));

		const result = await authorizeSkillAccess(
			'usage-metering-entitlements',
			request({ authorization: 'Bearer member-token' }),
			{ env: enforceEnv, fetch: fetchMock }
		);

		expect(result).toMatchObject({ ok: true, tier: 'premium', source: 'spark-pro' });
		expect(fetchMock).toHaveBeenCalledWith('https://pro.sparkswarm.ai/api/member/entitlements', {
			method: 'GET',
			headers: expect.any(Headers)
		});
	});

	it('allows premium skills when Spark Pro returns the umbrella membership entitlement', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ features: ['spark_pro'] }));

		const result = await authorizeSkillAccess(
			'usage-metering-entitlements',
			request({ cookie: 'spark_pro_session=session-id' }),
			{ env: enforceEnv, fetch: fetchMock }
		);

		expect(result).toMatchObject({ ok: true, tier: 'premium', source: 'spark-pro' });
	});

	it('denies premium skills when the member lacks the skill graph entitlement', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ features: ['tool.xcontent'] }));

		const result = await authorizeSkillAccess(
			'usage-metering-entitlements',
			request({ authorization: 'Bearer member-token' }),
			{ env: enforceEnv, fetch: fetchMock }
		);

		expect(result).toMatchObject({
			ok: false,
			status: 403,
			code: 'not_entitled'
		});
	});

	it('fails closed when the entitlement service cannot verify access', async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'offline' }, 503));

		const result = await authorizeSkillAccess(
			'usage-metering-entitlements',
			request({ authorization: 'Bearer member-token' }),
			{ env: enforceEnv, fetch: fetchMock }
		);

		expect(result).toMatchObject({
			ok: false,
			status: 503,
			code: 'entitlement_service_unavailable'
		});
	});
});
