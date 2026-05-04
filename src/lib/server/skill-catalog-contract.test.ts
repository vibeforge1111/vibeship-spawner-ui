import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';
import { FREE_SKILL_IDS } from '$lib/skill-entitlements';

const sourceDir = resolve(process.env.SPAWNER_H70_SKILLS_DIR || 'C:/Users/USER/Desktop/spark-skill-graphs');
const staticSkillsPath = resolve('static/skills.json');
const staticCollaborationPath = resolve('static/skill-collaboration.json');
const generatedCatalogPath = resolve('src/lib/data/skill-catalog.json');
const compactCatalogPath = resolve('src/lib/data/skill-catalog-compact.json');
const matcherCatalogPath = resolve('src/lib/data/skill-matcher-catalog.json');
const sparkTierPath = join(sourceDir, 'config', 'skill-tiers.json');
const nonSkillDirs = new Set([
	'.git',
	'.github',
	'.husky',
	'benchmark',
	'benchmarks',
	'bundles',
	'config',
	'eval',
	'mcp-server',
	'node_modules',
	'release-artifacts',
	'tools',
	'viz'
]);

function sourceSkillIds(): string[] {
	return sourceSkillRecords().map((skill) => skill.id).sort();
}

function sourceSkillRecords(): Array<{ id: string; parsed: Record<string, unknown> }> {
	if (cachedSourceRecords) return cachedSourceRecords;
	const records: Array<{ id: string; parsed: Record<string, unknown> }> = [];
	for (const category of readdirSync(sourceDir, { withFileTypes: true })) {
		if (
			!category.isDirectory() ||
			category.name.startsWith('.') ||
			category.name.startsWith('_') ||
			nonSkillDirs.has(category.name)
		) {
			continue;
		}

		for (const file of readdirSync(join(sourceDir, category.name), { withFileTypes: true })) {
			if (!file.isFile() || !file.name.endsWith('.yaml')) continue;
			const parsed = parseYaml(readFileSync(join(sourceDir, category.name, file.name), 'utf8'));
			if (parsed?.name && parsed?.description) {
				records.push({ id: basename(file.name, '.yaml'), parsed });
			}
		}
	}
	cachedSourceRecords = records;
	return records;
}

let cachedSourceRecords: Array<{ id: string; parsed: Record<string, unknown> }> | null = null;

describe('synced skill catalog', () => {
	it.runIf(existsSync(sourceDir))('matches the local spark-skill-graphs skill ids', () => {
		const sourceIds = sourceSkillIds();
		const staticIds = JSON.parse(readFileSync(staticSkillsPath, 'utf8'))
			.map((skill: { id: string }) => skill.id)
			.sort();

		expect(staticIds).toEqual(sourceIds);
	}, 15000);

	it.runIf(existsSync(sourceDir))('preserves valid spark pairs_with relationships as pairsWell', () => {
		const sourceRecords = sourceSkillRecords();
		const sourceIds = new Set(sourceRecords.map((skill) => skill.id));
		const staticById = new Map(
			(
				JSON.parse(readFileSync(staticSkillsPath, 'utf8')) as Array<{
					id: string;
					pairsWell?: string[];
				}>
			).map((skill) => [skill.id, skill])
		);

		for (const sourceSkill of sourceRecords) {
			const expectedPairs = Array.isArray(sourceSkill.parsed.pairs_with)
				? sourceSkill.parsed.pairs_with
						.filter((skillId): skillId is string => typeof skillId === 'string' && sourceIds.has(skillId))
						.sort()
				: [];
			const staticSkill = staticById.get(sourceSkill.id);
			expect(staticSkill?.pairsWell?.slice().sort() || []).toEqual(expectedPairs);
		}
	}, 15000);

	it('does not publish dangling handoffs or pairs', () => {
		const staticSkills: Array<{
			id: string;
			handoffs?: Array<{ to?: string }>;
			pairsWell?: string[];
		}> = JSON.parse(readFileSync(staticSkillsPath, 'utf8'));
		const staticIds = new Set(staticSkills.map((skill) => skill.id));

		for (const skill of staticSkills) {
			for (const handoff of skill.handoffs || []) {
				expect(staticIds.has(handoff.to || '')).toBe(true);
			}
			for (const pairedSkillId of skill.pairsWell || []) {
				expect(staticIds.has(pairedSkillId)).toBe(true);
			}
		}
	});

	it('does not publish dangling skill collaboration references', () => {
		const staticSkills: Array<{ id: string }> = JSON.parse(readFileSync(staticSkillsPath, 'utf8'));
		const staticIds = new Set(staticSkills.map((skill) => skill.id));
		const collaboration: {
			core_skills?: Record<string, { receives_from?: string[] }>;
			domain_packs?: Record<string, { skills?: string[] }>;
			skill_chains?: Record<string, { chain?: string[] }>;
		} = JSON.parse(readFileSync(staticCollaborationPath, 'utf8'));

		for (const [skillId, skill] of Object.entries(collaboration.core_skills || {})) {
			expect(staticIds.has(skillId)).toBe(true);
			for (const sourceSkillId of skill.receives_from || []) {
				expect(staticIds.has(sourceSkillId)).toBe(true);
			}
		}

		for (const pack of Object.values(collaboration.domain_packs || {})) {
			for (const skillId of pack.skills || []) {
				expect(staticIds.has(skillId)).toBe(true);
			}
		}

		for (const chain of Object.values(collaboration.skill_chains || {})) {
			for (const skillId of chain.chain || []) {
				expect(staticIds.has(skillId)).toBe(true);
			}
		}
	});

	it('keeps every generated Spawner skill catalog aligned to static/skills.json', () => {
		const staticSkills: Array<{ id: string }> = JSON.parse(readFileSync(staticSkillsPath, 'utf8'));
		const staticIds = staticSkills.map((skill) => skill.id).sort();

		const generatedCatalog = JSON.parse(readFileSync(generatedCatalogPath, 'utf8')) as {
			totalSkills?: number;
			skills?: Array<{ id: string }>;
		};
		const compactCatalog = JSON.parse(readFileSync(compactCatalogPath, 'utf8')) as Array<{ id: string }>;
		const matcherCatalog = JSON.parse(readFileSync(matcherCatalogPath, 'utf8')) as Record<string, unknown>;

		expect(generatedCatalog.totalSkills).toBe(staticSkills.length);
		expect((generatedCatalog.skills || []).map((skill) => skill.id).sort()).toEqual(staticIds);
		expect(compactCatalog.map((skill) => skill.id).sort()).toEqual(staticIds);
		expect(Object.keys(matcherCatalog).sort()).toEqual(staticIds);
	});

	it.runIf(existsSync(sparkTierPath))('uses Spark tier manifest for the 30 free Spawner skills', () => {
		const staticSkills: Array<{ id: string; tier?: string }> = JSON.parse(readFileSync(staticSkillsPath, 'utf8'));
		const tierConfig = JSON.parse(readFileSync(sparkTierPath, 'utf8')) as {
			open_source?: { canonical_starter_skill_ids?: string[] };
		};
		const expectedFreeIds = [...(tierConfig.open_source?.canonical_starter_skill_ids || [])].sort();
		const actualFreeIds = staticSkills
			.filter((skill) => skill.tier === 'free')
			.map((skill) => skill.id)
			.sort();

		expect(actualFreeIds).toEqual(expectedFreeIds);
		expect(actualFreeIds).toHaveLength(30);
	});

	it('publishes exactly the public foundation skills as free and gates the rest as Pro', () => {
		const staticSkills: Array<{
			id: string;
			tier?: string;
			requiresAuth?: boolean;
			fallbackAvailable?: boolean;
		}> = JSON.parse(readFileSync(staticSkillsPath, 'utf8'));
		const freeIds = new Set<string>(FREE_SKILL_IDS);
		const freeSkills = staticSkills.filter((skill) => skill.tier === 'free');
		const proSkills = staticSkills.filter((skill) => skill.tier === 'premium');

		expect(freeSkills.map((skill) => skill.id).sort()).toEqual([...freeIds].sort());
		expect(freeSkills).toHaveLength(30);
		expect(proSkills.length).toBeGreaterThan(500);

		for (const skill of staticSkills) {
			const isFree = freeIds.has(skill.id);
			expect(skill.tier).toBe(isFree ? 'free' : 'premium');
			expect(skill.requiresAuth).toBe(!isFree);
			expect(skill.fallbackAvailable).toBe(true);
		}
	});
});
