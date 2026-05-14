import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { createH70SkillAccessToken, verifyH70SkillAccessToken } from './h70-skill-access-token';

let testSpawnerDir: string | null = null;

describe('h70-skill-access-token', () => {
	beforeEach(async () => {
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-h70-access-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
	});

	afterEach(async () => {
		delete process.env.SPAWNER_STATE_DIR;
		if (testSpawnerDir && existsSync(testSpawnerDir)) {
			await rm(testSpawnerDir, { recursive: true, force: true });
		}
		testSpawnerDir = null;
	});

	it('creates scoped bearer tokens for selected pro skills', async () => {
		const token = await createH70SkillAccessToken({
			missionId: 'mission-pro-skill-test',
			skillIds: ['threejs-3d-graphics', 'qa-engineering'],
			now: new Date('2026-05-14T10:00:00Z')
		});
		expect(token).toMatch(/^spark-h70-/);
		const request = new Request('http://127.0.0.1:3333/api/h70-skills/threejs-3d-graphics', {
			headers: { authorization: `Bearer ${token}` }
		});

		await expect(
			verifyH70SkillAccessToken(request, 'threejs-3d-graphics', {
				now: new Date('2026-05-14T10:01:00Z')
			})
		).resolves.toBe(true);
		await expect(
			verifyH70SkillAccessToken(request, 'smart-contract-auditor', {
				now: new Date('2026-05-14T10:01:00Z')
			})
		).resolves.toBe(false);
	});

	it('rejects expired scoped tokens', async () => {
		const token = await createH70SkillAccessToken({
			missionId: 'mission-expired-token-test',
			skillIds: ['threejs-3d-graphics'],
			ttlMs: 1_000,
			now: new Date('2026-05-14T10:00:00Z')
		});
		const request = new Request('http://127.0.0.1:3333/api/h70-skills/threejs-3d-graphics', {
			headers: { authorization: `Bearer ${token}` }
		});

		await expect(
			verifyH70SkillAccessToken(request, 'threejs-3d-graphics', {
				now: new Date('2026-05-14T10:00:02Z')
			})
		).resolves.toBe(false);
	});
});
