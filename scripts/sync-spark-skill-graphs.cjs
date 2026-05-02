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
const OUTPUT_PATH = path.resolve(__dirname, '..', 'static', 'skills.json');

const FREE_SKILL_IDS = new Set([
	'ai-chatbot-builder',
	'llm-architect',
	'prompt-engineer',
	'rag-engineer',
	'agent-tool-builder',
	'agent-evaluation',
	'conversation-memory',
	'browser-automation',
	'structured-output',
	'openai-api-patterns',
	'claude-api-integration',
	'ai-observability',
	'prompt-caching',
	'prompt-injection-defense',
	'frontend-engineer',
	'sveltekit',
	'react-patterns',
	'tailwind-css',
	'design-systems',
	'ui-design',
	'backend-engineer',
	'api-designer',
	'database-architect',
	'postgres-wizard',
	'authentication-oauth',
	'security-owasp',
	'docker-specialist',
	'railway-deployment',
	'playwright-testing',
	'git-workflow'
]);

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
		tier: FREE_SKILL_IDS.has(id) ? 'free' : 'premium',
		requiresAuth: !FREE_SKILL_IDS.has(id),
		fallbackAvailable: true,
		layer: Number.isFinite(parsed.layer) ? parsed.layer : 1,
		tags: Array.isArray(parsed.tags) && parsed.tags.length ? parsed.tags : termsFrom(owns),
		triggers: triggersFor(parsed, id),
		handoffs,
		pairsWell,
		selectionHints: parsed.selection_hints || {}
	};
}

function main() {
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

	fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(summaries, null, 2)}\n`);
	console.log(`Synced ${summaries.length} skills from ${SOURCE_DIR}`);
	console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
