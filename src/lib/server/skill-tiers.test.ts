import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatSkillsByCategory, getTierSkills, normalizeTier } from './skill-tiers';

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

	describe('malformed static catalogs', () => {
		let workdir: string;
		let originalCwd: string;

		beforeEach(() => {
			originalCwd = process.cwd();
			workdir = mkdtempSync(join(tmpdir(), 'skill-tiers-malformed-'));
			mkdirSync(join(workdir, 'static'));
			vi.resetModules();
		});

		afterEach(() => {
			process.chdir(originalCwd);
			rmSync(workdir, { recursive: true, force: true });
			vi.resetModules();
		});

		it('returns an empty pro list when static/skills.json is malformed instead of throwing', async () => {
			writeFileSync(join(workdir, 'static', 'skills.json'), '[{"id":"frontend"},]', 'utf-8');
			process.chdir(workdir);
			const mod = await import('./skill-tiers');
			const skills = await mod.getTierSkills('pro');
			expect(skills).toEqual([]);
		});

		it('falls through to the bundles directory when static/skill-tiers.json is malformed', async () => {
			// Provide a valid skills.json plus a malformed tiers file.
			writeFileSync(
				join(workdir, 'static', 'skills.json'),
				'[{"id":"frontend-engineer"}]',
				'utf-8'
			);
			writeFileSync(join(workdir, 'static', 'skill-tiers.json'), '{"open_source":', 'utf-8');
			// No bundles directory either, so base should resolve to [] without throwing.
			process.chdir(workdir);
			const mod = await import('./skill-tiers');
			const base = await mod.getTierSkills('base');
			expect(base).toEqual([]);
		});
	});
});
