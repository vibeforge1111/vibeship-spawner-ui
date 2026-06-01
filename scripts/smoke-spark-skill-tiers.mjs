import { readFile } from 'node:fs/promises';

async function readJsonFile(path) {
	const text = await readFile(path, 'utf-8');
	try {
		return JSON.parse(text);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`${path} contains malformed JSON: ${message}`);
	}
}

const skills = await readJsonFile('static/skills.json');
const tiers = await readJsonFile('static/skill-tiers.json');
const canonicalFreeIds = tiers.open_source?.canonical_starter_skill_ids ?? [];
const freeIdSet = new Set(canonicalFreeIds);
const freeSkills = skills.filter((skill) => skill.tier === 'free');
const premiumSkills = skills.filter((skill) => skill.tier === 'premium');
const missingFree = canonicalFreeIds.filter((id) => !skills.some((skill) => skill.id === id && skill.tier === 'free'));
const strayFree = freeSkills.filter((skill) => !freeIdSet.has(skill.id)).map((skill) => skill.id);

if (canonicalFreeIds.length !== 30) throw new Error(`expected 30 canonical free skills, found ${canonicalFreeIds.length}`);
if (skills.length < 600) throw new Error(`expected full Pro corpus to have at least 600 skills, found ${skills.length}`);
if (premiumSkills.length < 580) throw new Error(`expected at least 580 premium skills, found ${premiumSkills.length}`);
if (freeSkills.length !== canonicalFreeIds.length) throw new Error(`free skill count mismatch: ${freeSkills.length} != ${canonicalFreeIds.length}`);
if (missingFree.length > 0) throw new Error(`canonical free skills missing from static catalog: ${missingFree.join(', ')}`);
if (strayFree.length > 0) throw new Error(`non-canonical skills marked free: ${strayFree.join(', ')}`);

console.log(JSON.stringify({
	ok: true,
	total: skills.length,
	free: freeSkills.length,
	premium: premiumSkills.length
}, null, 2));
