/**
 * Tier-aware skill registry for prompt allowlists.
 *
 * Source of truth is static/skills.json (synced from spark-skill-graphs):
 *  - pro:  every skill in static/skills.json.
 *  - base: the 30 skills marked free in static/skills.json.
 *
 * Used by buildCodexPrompt to constrain emitted skill IDs to a tier the user
 * actually has access to. Without this, the model hallucinates IDs like
 * "vite-project-setup", "phaser-3", "vanilla-javascript" that do not exist.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export type SkillTier = 'base' | 'pro';

interface SkillRecord {
	id: string;
	name?: string;
	category?: string;
	tier?: string;
}

let cached: { base: SkillRecord[]; pro: SkillRecord[] } | null = null;

function staticDir(): string {
	return join(process.cwd(), 'static');
}

async function loadProSkills(): Promise<SkillRecord[]> {
	const path = join(staticDir(), 'skills.json');
	if (!existsSync(path)) return [];
	const raw = await readFile(path, 'utf-8');
	const parsed = JSON.parse(raw) as SkillRecord[];
	return parsed.filter((s): s is SkillRecord => typeof s?.id === 'string');
}

async function loadBaseSkills(pro: SkillRecord[]): Promise<SkillRecord[]> {
	return pro.filter((skill) => skill.tier === 'free');
}

async function loadAll(): Promise<{ base: SkillRecord[]; pro: SkillRecord[] }> {
	if (cached) return cached;
	const pro = await loadProSkills();
	const base = await loadBaseSkills(pro);
	cached = { base, pro };
	return cached;
}

export async function getTierSkills(tier: SkillTier): Promise<SkillRecord[]> {
	const all = await loadAll();
	return tier === 'base' ? all.base : all.pro;
}

export function normalizeTier(value: unknown): SkillTier {
	return value === 'pro' ? 'pro' : value === 'base' ? 'base' : 'pro';
}

export function formatSkillsByCategory(skills: SkillRecord[]): string {
	const grouped = new Map<string, string[]>();
	for (const s of skills) {
		const cat = s.category || 'misc';
		if (!grouped.has(cat)) grouped.set(cat, []);
		grouped.get(cat)!.push(s.id);
	}
	const lines: string[] = [];
	for (const [cat, ids] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
		ids.sort();
		lines.push(`- ${cat}: ${ids.join(', ')}`);
	}
	return lines.join('\n');
}
