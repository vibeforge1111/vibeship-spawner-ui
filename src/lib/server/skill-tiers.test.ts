import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatSkillsByCategory, getTierSkills, normalizeTier, resetSkillTierCacheForTests } from './skill-tiers';

const originalCwd = process.cwd();

afterEach(async () => {
	process.chdir(originalCwd);
	resetSkillTierCacheForTests();
});

describe('skill-tiers', () => {
	it('defaults unknown tier values to base while preserving explicit base/pro', () => {
		expect(normalizeTier('base')).toBe('base');
		expect(normalizeTier('pro')).toBe('pro');
		expect(normalizeTier('free')).toBe('base');
		expect(normalizeTier('basic')).toBe('base');
		expect(normalizeTier('premium')).toBe('pro');
		expect(normalizeTier(undefined)).toBe('base');
	});

	it('formats skills by category with sorted categories and sorted ids', () => {
		const formatted = formatSkillsByCategory([
			{ id: 'zeta', category: 'backend' },
			{ id: 'alpha', category: 'backend' },
			{ id: 'ui-design', category: 'frontend' },
			{ id: 'uncategorized' }
		]);

		expect(formatted).toBe(
			['- backend: alpha, zeta', '- frontend: ui-design', '- misc: uncategorized'].join('\n')
		);
	});

	it('loads pro skills from the synced static skill catalog', async () => {
		const skills = await getTierSkills('pro');
		const ids = new Set(skills.map((skill) => skill.id));

		expect(skills.length).toBeGreaterThan(100);
		expect(ids.has('frontend')).toBe(true);
		expect(ids.has('test-architect')).toBe(true);
	});

	it('loads base skills from the canonical open-source tier manifest', async () => {
		const [base, pro] = await Promise.all([getTierSkills('base'), getTierSkills('pro')]);
		const baseIds = new Set(base.map((skill) => skill.id));
		const proIds = new Set(pro.map((skill) => skill.id));

		expect(base).toHaveLength(30);
		expect(base.length).toBeLessThan(pro.length);
		expect(baseIds.has('frontend-engineer')).toBe(true);
		expect(baseIds.has('stripe-integration')).toBe(true);
		expect(baseIds.has('ai-agent-permissions-sandboxing')).toBe(false);
		expect(baseIds.has('authentication-oauth')).toBe(true);
		expect(baseIds.has('subscription-billing')).toBe(true);
		expect(baseIds.has('threejs-3d-graphics')).toBe(false);
		for (const id of baseIds) {
			expect(proIds.has(id)).toBe(true);
		}
	});

	it('treats malformed static JSON catalogs as missing instead of crashing', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'spawner-skill-tiers-'));
		try {
			await mkdir(path.join(root, 'static', 'bundles'), { recursive: true });
			await writeFile(path.join(root, 'static', 'skills.json'), '{not valid json', 'utf-8');
			await writeFile(path.join(root, 'static', 'skill-tiers.json'), '{not valid json', 'utf-8');
			await writeFile(
				path.join(root, 'static', 'bundles', 'starter.yaml'),
				['id: starter', 'required_skills:', '  - frontend-engineer'].join('\n'),
				'utf-8'
			);

			process.chdir(root);
			resetSkillTierCacheForTests();

			const [base, pro] = await Promise.all([getTierSkills('base'), getTierSkills('pro')]);

			expect(pro).toEqual([]);
			expect(base.map((skill) => skill.id)).toEqual(['frontend-engineer']);
		} finally {
			process.chdir(originalCwd);
			resetSkillTierCacheForTests();
			await rm(root, { recursive: true, force: true });
		}
	});
});
