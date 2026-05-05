import { describe, expect, it, vi } from 'vitest';
import {
	sparkProBaseUrl,
	sparkProProofHeaders,
	verifySparkProSkillAccess
} from './spark-pro-entitlements';

describe('spark-pro-entitlements', () => {
	it('uses bearer proof headers before cookies', () => {
		const headers = sparkProProofHeaders(
			new Request('https://spawner.sparkswarm.ai/api/h70-skills/frontend-engineer', {
				headers: {
					authorization: 'Bearer member-token',
					cookie: 'spark_pro_session=session-token'
				}
			})
		);

		expect(headers?.get('authorization')).toBe('Bearer member-token');
		expect(headers?.has('cookie')).toBe(false);
	});

	it('extracts the Spark Pro session cookie as proof when no bearer token exists', () => {
		const headers = sparkProProofHeaders(
			new Request('https://spawner.sparkswarm.ai/api/h70-skills/frontend-engineer', {
				headers: {
					cookie: 'theme=dark; spark_pro_session=session-token; other=value'
				}
			})
		);

		expect(headers?.get('cookie')).toBe('spark_pro_session=session-token');
	});

	it('accepts Spark Pro or skill-drop entitlements', async () => {
		const fetchImpl = vi.fn(async (url, init) => {
			expect(String(url)).toBe('https://pro.example/api/member/entitlements');
			expect((init?.headers as Headers).get('authorization')).toBe('Bearer member-token');
			return Response.json({ features: ['drop.skills'] });
		}) as unknown as typeof fetch;

		const verdict = await verifySparkProSkillAccess(
			new Request('https://spawner.sparkswarm.ai/api/h70-skills/frontend-engineer', {
				headers: { authorization: 'Bearer member-token' }
			}),
			{ envRecord: { SPARK_PRO_API_BASE_URL: 'https://pro.example/' }, fetchImpl }
		);

		expect(verdict).toBe('ok');
		expect(fetchImpl).toHaveBeenCalledOnce();
	});

	it('rejects sessions without the Spark Skill Graphs feature', async () => {
		const verdict = await verifySparkProSkillAccess(
			new Request('https://spawner.sparkswarm.ai/api/h70-skills/frontend-engineer', {
				headers: { authorization: 'Bearer member-token' }
			}),
			{
				envRecord: { SPARK_PRO_API_BASE_URL: 'https://pro.example' },
				fetchImpl: async () => Response.json({ features: ['tool.xcontent'] })
			}
		);

		expect(verdict).toBe('forbidden');
	});

	it('fails closed when proof is absent', async () => {
		await expect(
			verifySparkProSkillAccess(new Request('https://spawner.sparkswarm.ai/api/h70-skills/frontend-engineer'))
		).resolves.toBe('missing');
	});

	it('normalizes configured Spark Pro base URLs', () => {
		expect(sparkProBaseUrl({ SPARK_PRO_BASE_URL: 'https://pro.example.test///' })).toBe(
			'https://pro.example.test'
		);
	});
});
