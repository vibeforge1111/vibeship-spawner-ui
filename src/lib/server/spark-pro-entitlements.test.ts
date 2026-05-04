import { describe, expect, it } from 'vitest';
import { sparkProProofHeaders, verifySparkProSkillAccess } from './spark-pro-entitlements';

describe('spark-pro-entitlements', () => {
	it('extracts bearer proof before cookies', () => {
		const request = new Request('https://spawner.sparkswarm.ai/api/h70-skills/frontend-engineer', {
			headers: {
				authorization: 'Bearer member-token',
				cookie: 'spark_pro_session=session-token'
			}
		});

		const headers = sparkProProofHeaders(request);
		expect(headers?.get('authorization')).toBe('Bearer member-token');
		expect(headers?.has('cookie')).toBe(false);
	});

	it('accepts Spark Pro or skill-drop entitlements', async () => {
		const request = new Request('https://spawner.sparkswarm.ai/api/h70-skills/frontend-engineer', {
			headers: { authorization: 'Bearer member-token' }
		});
		const verdict = await verifySparkProSkillAccess(request, {
			envRecord: { SPARK_PRO_API_BASE_URL: 'https://pro.example' },
			fetchImpl: async (url, init) => {
				expect(String(url)).toBe('https://pro.example/api/member/entitlements');
				expect((init?.headers as Headers).get('authorization')).toBe('Bearer member-token');
				return Response.json({ features: ['drop.skills'] });
			}
		});

		expect(verdict).toBe('ok');
	});

	it('rejects sessions without the Spark Skill Graphs feature', async () => {
		const request = new Request('https://spawner.sparkswarm.ai/api/h70-skills/frontend-engineer', {
			headers: { authorization: 'Bearer member-token' }
		});
		const verdict = await verifySparkProSkillAccess(request, {
			envRecord: { SPARK_PRO_API_BASE_URL: 'https://pro.example' },
			fetchImpl: async () => Response.json({ features: ['tool.xcontent'] })
		});

		expect(verdict).toBe('forbidden');
	});

	it('returns missing when no member proof is present', async () => {
		const request = new Request('https://spawner.sparkswarm.ai/api/h70-skills/frontend-engineer');
		await expect(verifySparkProSkillAccess(request)).resolves.toBe('missing');
	});
});

