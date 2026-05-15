// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { createH70SkillAccessToken } from './h70-skill-access-token';
import { sparkProBaseUrl, verifySparkProSkillAccess } from './spark-pro-entitlements';
import { GET, HEAD } from '../../routes/api/h70-skills/[skillId]/+server';

let previousSparkProBaseUrl: string | undefined;
let previousSpawnerStateDir: string | undefined;
let testSpawnerDir: string | null = null;

beforeEach(() => {
	previousSparkProBaseUrl = process.env.SPARK_PRO_API_BASE_URL;
	previousSpawnerStateDir = process.env.SPAWNER_STATE_DIR;
});

afterEach(async () => {
	if (previousSparkProBaseUrl === undefined) {
		delete process.env.SPARK_PRO_API_BASE_URL;
	} else {
		process.env.SPARK_PRO_API_BASE_URL = previousSparkProBaseUrl;
	}
	if (previousSpawnerStateDir === undefined) {
		delete process.env.SPAWNER_STATE_DIR;
	} else {
		process.env.SPAWNER_STATE_DIR = previousSpawnerStateDir;
	}
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
	testSpawnerDir = null;
	vi.clearAllMocks();
});

describe('/api/h70-skills/[skillId]', () => {
	it('serves open-source skill content without Spark Pro proof', async () => {
		const response = await GET({
			params: { skillId: 'frontend-engineer' },
			request: new Request('https://spawner.sparkswarm.ai/api/h70-skills/frontend-engineer')
		} as never);

		expect(response.status).toBe(200);
	});

	it('locks premium skill content without Spark Pro proof', async () => {
		const response = await GET({
			params: { skillId: 'usage-metering-entitlements' },
			request: new Request('https://spawner.sparkswarm.ai/api/h70-skills/usage-metering-entitlements')
		} as never);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(response.headers.get('www-authenticate')).toContain('drop.skills');
		expect(body.error.code).toBe('spark_pro_proof_required');
	});

	it('locks premium skill existence checks without Spark Pro proof', async () => {
		const response = await HEAD({
			params: { skillId: 'usage-metering-entitlements' },
			request: new Request('https://spawner.sparkswarm.ai/api/h70-skills/usage-metering-entitlements')
		} as never);

		expect(response.status).toBe(401);
	});

	it('serves premium skill content with Spark Pro skill entitlement', async () => {
		process.env.SPARK_PRO_API_BASE_URL = 'https://pro.example';
		expect(sparkProBaseUrl()).toBe('https://pro.example');
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: URL | string, init?: RequestInit) => {
				expect(String(url)).toBe('https://pro.example/api/member/entitlements');
				expect((init?.headers as Headers).get('authorization')).toBe('Bearer member-token');
				return Response.json({ features: ['drop.skills'] });
			})
		);
		const request = new Request('https://spawner.sparkswarm.ai/api/h70-skills/usage-metering-entitlements', {
			headers: { authorization: 'Bearer member-token' }
		});

		await expect(verifySparkProSkillAccess(request)).resolves.toBe('ok');

		const response = await GET({
			params: { skillId: 'usage-metering-entitlements' },
			request
		} as never);

		expect(response.status).toBe(200);
	});

	it('serves scoped premium mission skill content with an H70 access token', async () => {
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-h70-route-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		const token = await createH70SkillAccessToken({
			missionId: 'mission-h70-route-test',
			skillIds: ['usage-metering-entitlements']
		});

		const response = await GET({
			params: { skillId: 'usage-metering-entitlements' },
			request: new Request('https://spawner.sparkswarm.ai/api/h70-skills/usage-metering-entitlements', {
				headers: { authorization: `Bearer ${token}` }
			})
		} as never);

		expect(response.status).toBe(200);
	});
});
