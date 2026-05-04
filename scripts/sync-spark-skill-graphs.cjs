/**
 * Sync Spawner UI's public skill metadata from a local spark-skill-graphs checkout.
 *
 * The UI needs a compact catalog for search, tier allowlists, and canvas pairing.
 * Full YAML remains in spark-skill-graphs and is loaded on demand through
 * /api/h70-skills/[skillId].
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('yaml');

const SOURCE_DIR = path.resolve(
	process.env.SPAWNER_H70_SKILLS_DIR ||
		process.env.H70_SKILLS_LAB_DIR ||
		path.join(os.homedir(), 'Desktop', 'spark-skill-graphs')
);
const MANIFEST_PATH = process.env.SPAWNER_SPARK_MANIFEST
	? path.resolve(process.env.SPAWNER_SPARK_MANIFEST)
	: path.join(SOURCE_DIR, 'spark-skill-manifest.json');
const OUTPUT_PATH = path.resolve(__dirname, '..', 'static', 'skills.json');

const DEFAULT_FOUNDATION_FREE_SKILL_IDS = [
	'accessibility',
	'ai-observability',
	'api-design',
	'authentication-oauth',
	'data-pipeline',
	'database-architect',
	'design-systems',
	'devops',
	'error-handling',
	'forms-validation',
	'frontend-engineer',
	'llm-architect',
	'observability',
	'playwright-testing',
	'prompt-engineer',
	'queue-workers',
	'rag-engineer',
	'rate-limiting',
	'react-patterns',
	'redis-specialist',
	'responsive-mobile-first',
	'security-owasp',
	'stripe-integration',
	'structured-output',
	'subscription-billing',
	'testing-strategies',
	'ui-design',
	'ux-design',
	'vector-specialist',
	'webhook-processing'
];

function readJsonIfExists(filePath) {
	try {
		if (!fs.existsSync(filePath)) return null;
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch {
		return null;
	}
}

function loadConfiguredFreeSkillIds(sourceDir = SOURCE_DIR) {
	const tiers = readJsonIfExists(path.join(sourceDir, 'config', 'skill-tiers.json'));
	const configuredIds = tiers?.open_source?.canonical_starter_skill_ids;
	if (Array.isArray(configuredIds) && configuredIds.length > 0) {
		return new Set(configuredIds.filter((id) => typeof id === 'string' && id.trim()));
	}
	return new Set(DEFAULT_FOUNDATION_FREE_SKILL_IDS);
}

const FOUNDATION_FREE_SKILL_IDS = loadConfiguredFreeSkillIds();

const NON_SKILL_DIRS = new Set([
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

function shouldReadCategory(entry) {
	return (
		entry.isDirectory() &&
		!entry.name.startsWith('.') &&
		!entry.name.startsWith('_') &&
		!NON_SKILL_DIRS.has(entry.name)
	);
}

function remapCategory(category) {
	return category;
}

function normalizeSkillTier(id, explicitTier, freeSkillIds = FOUNDATION_FREE_SKILL_IDS) {
	const normalized = typeof explicitTier === 'string' ? explicitTier.trim().toLowerCase() : '';
	if (normalized === 'pro' || normalized === 'premium') return 'premium';
	if (normalized === 'free') return 'free';
	return freeSkillIds.has(id) ? 'free' : 'premium';
}

function collectSkillFiles() {
	if (!fs.existsSync(SOURCE_DIR) || !fs.statSync(SOURCE_DIR).isDirectory()) {
		throw new Error(`spark-skill-graphs source directory not found: ${SOURCE_DIR}`);
	}

	const files = [];
	for (const category of fs.readdirSync(SOURCE_DIR, { withFileTypes: true }).filter(shouldReadCategory)) {
		const categoryPath = path.join(SOURCE_DIR, category.name);
		for (const file of fs.readdirSync(categoryPath, { withFileTypes: true })) {
			if (!file.isFile() || !file.name.endsWith('.yaml')) continue;
			files.push({
				category: category.name,
				id: path.basename(file.name, '.yaml'),
				path: path.join(categoryPath, file.name)
			});
		}
	}
	return files;
}

function termsFrom(values) {
	const tags = new Set();
	for (const value of values) {
		if (typeof value !== 'string') continue;
		const terms = value.toLowerCase().match(/\b[a-z][a-z0-9-]{2,}\b/g) || [];
		for (const term of terms.slice(0, 4)) tags.add(term);
		if (tags.size >= 10) break;
	}
	return [...tags];
}

function triggersFor(skill, id) {
	const triggers = new Set();
	if (Array.isArray(skill.triggers)) {
		for (const trigger of skill.triggers) {
			if (typeof trigger === 'string' && trigger.trim()) triggers.add(trigger.trim());
		}
	}
	if (typeof skill.name === 'string') triggers.add(skill.name.toLowerCase());
	triggers.add(id.replace(/-/g, ' '));
	return [...triggers].slice(0, 12);
}

function toSummary({ id, category, parsed }, validIds) {
	const owns = Array.isArray(parsed.owns) ? parsed.owns : [];
	const handoffs = Array.isArray(parsed.delegates)
		? parsed.delegates
				.filter((delegate) => delegate && validIds.has(delegate.skill))
				.map((delegate) => ({
					trigger: String(delegate.when || 'handoff'),
					to: delegate.skill
				}))
		: [];
	const pairsWell = Array.isArray(parsed.pairs_with)
		? parsed.pairs_with.filter((skillId) => typeof skillId === 'string' && validIds.has(skillId))
		: [];

	return {
		id,
		name: parsed.name || id,
		description: parsed.description || '',
		category: remapCategory(parsed.category || category),
		tier: normalizeSkillTier(id, parsed.tier),
		layer: Number.isFinite(parsed.layer) ? parsed.layer : 1,
		tags: Array.isArray(parsed.tags) && parsed.tags.length ? parsed.tags : termsFrom(owns),
		triggers: triggersFor(parsed, id),
		handoffs,
		pairsWell,
		selectionHints: parsed.selection_hints || {}
	};
}

function triggersFromManifestSkill(skill) {
	const triggers = new Set();
	if (Array.isArray(skill.triggers)) {
		for (const trigger of skill.triggers) {
			if (typeof trigger === 'string' && trigger.trim()) triggers.add(trigger.trim());
		}
	}
	if (typeof skill.name === 'string') triggers.add(skill.name.toLowerCase());
	triggers.add(String(skill.id || '').replace(/-/g, ' '));
	const hints = skill.selection_hints || {};
	if (Array.isArray(hints.aliases)) {
		for (const alias of hints.aliases) {
			if (typeof alias === 'string' && alias.trim()) triggers.add(alias.trim());
		}
	}
	return [...triggers].filter(Boolean).slice(0, 12);
}

function summaryFromManifestSkill(skill, validIds) {
	const delegates = Array.isArray(skill.delegates) ? skill.delegates : [];
	const handoffs = delegates
		.map((delegate) => ({
			trigger: String(delegate.when || 'handoff'),
			to: delegate.target_id || delegate.skill
		}))
		.filter((delegate) => validIds.has(delegate.to));
	const pairsWell = Array.isArray(skill.pairs_with)
		? skill.pairs_with.filter((skillId) => typeof skillId === 'string' && validIds.has(skillId))
		: [];

	return {
		id: skill.id,
		name: skill.name || skill.id,
		description: skill.description || '',
		category: remapCategory(skill.category || 'general'),
		tier: normalizeSkillTier(skill.id, skill.tier),
		layer: 1,
		tags: Array.isArray(skill.tags) && skill.tags.length
			? skill.tags.filter((tag) => typeof tag === 'string' && tag.trim())
		: termsFrom([...(Array.isArray(skill.owns) ? skill.owns : []), skill.description || '']),
		triggers: triggersFromManifestSkill(skill),
		handoffs,
		pairsWell,
		selectionHints: skill.selection_hints || {}
	};
}

function summariesFromManifest(manifest) {
	if (!manifest || manifest.schema_version !== 'spark.skill.manifest.v1' || !Array.isArray(manifest.skills)) {
		throw new Error('Invalid Spark skill manifest');
	}
	const valid = manifest.skills.filter((skill) => skill?.id && skill?.name && skill?.description);
	const validIds = new Set(valid.map((skill) => skill.id));
	return valid
		.map((skill) => summaryFromManifestSkill(skill, validIds))
		.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
}

function summariesFromYamlSource() {
	const files = collectSkillFiles();
	const parsed = files.map((file) => ({
		...file,
		parsed: yaml.parse(fs.readFileSync(file.path, 'utf8'))
	}));
	const valid = parsed.filter((skill) => skill.parsed?.name && skill.parsed?.description);
	const validIds = new Set(valid.map((skill) => skill.id));
	const summaries = valid
		.map((skill) => toSummary(skill, validIds))
		.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
	return summaries;
}

function main() {
	let summaries;
	if (fs.existsSync(MANIFEST_PATH)) {
		const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
		summaries = summariesFromManifest(manifest);
		console.log(`Synced ${summaries.length} skills from manifest ${MANIFEST_PATH}`);
	} else {
		summaries = summariesFromYamlSource();
		console.log(`Synced ${summaries.length} skills from ${SOURCE_DIR}`);
	}

	fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(summaries, null, 2)}\n`);
	console.log(`Wrote ${OUTPUT_PATH}`);
}

if (require.main === module) {
	main();
}

module.exports = {
	FOUNDATION_FREE_SKILL_IDS,
	loadConfiguredFreeSkillIds,
	normalizeSkillTier,
	summariesFromManifest,
	summaryFromManifestSkill,
	triggersFromManifestSkill
};
