import { describe, expect, it, vi } from 'vitest';
import {
	sparkProBaseUrl,
	sparkProProofHeaders,
	verifySparkProSkillAccess
} from './spark-pro-entitlements';

describe('spark-pro-entitlements', () => {
	it('uses bearer proof headers before cookies', () => {
		const headers = sparkProProofHeaders(
			new Request('https://spawner.local/api/h70-skills/langgraph', {
				headers: {
					authorization: 'Bearer proof-token',
					cookie: 'spark_pro_session=cookie-token'
				}
			})
		);

		expect(headers?.get('authorization')).toBe('Bearer proof-token');
		expect(headers?.has('cookie')).toBe(false);
	});

	it('extracts the Spark Pro session cookie as proof when no bearer token exists', () => {
		const headers = sparkProProofHeaders(
			new Request('https://spawner.local/api/h70-skills/langgraph', {
				headers: {
					cookie: 'theme=dark; spark_pro_session=cookie-token; other=value'
				}
			})
		);

		expect(headers?.get('cookie')).toBe('spark_pro_session=cookie-token');
	});

	it('verifies accepted Pro entitlement features', async () => {
		const fetchImpl = vi.fn(async () =>
			new Response(JSON.stringify({ features: ['drop.skills'] }), { status: 200 })
		) as unknown as typeof fetch;
		const verdict = await verifySparkProSkillAccess(
			new Request('https://spawner.local/api/h70-skills/langgraph', {
				headers: { authorization: 'Bearer proof-token' }
			}),
			{ envRecord: { SPARK_PRO_BASE_URL: 'https://pro.example.test/' }, fetchImpl }
		);

		expect(verdict).toBe('ok');
		expect(fetchImpl).toHaveBeenCalledWith(new URL('https://pro.example.test/api/member/entitlements'), {
			method: 'GET',
			headers: expect.any(Headers)
		});
	});

	it('fails closed when proof or entitlement is absent', async () => {
		expect(
			await verifySparkProSkillAccess(new Request('https://spawner.local/api/h70-skills/langgraph'))
		).toBe('missing');

		const fetchImpl = vi.fn(async () =>
			new Response(JSON.stringify({ features: ['other'] }), { status: 200 })
		) as unknown as typeof fetch;

		expect(
			await verifySparkProSkillAccess(
				new Request('https://spawner.local/api/h70-skills/langgraph', {
					headers: { authorization: 'Bearer proof-token' }
				}),
				{ fetchImpl }
			)
		).toBe('forbidden');
	});

	it('normalizes configured Spark Pro base URLs', () => {
		expect(sparkProBaseUrl({ SPARK_PRO_BASE_URL: 'https://pro.example.test///' })).toBe(
			'https://pro.example.test'
		);
	});
});
