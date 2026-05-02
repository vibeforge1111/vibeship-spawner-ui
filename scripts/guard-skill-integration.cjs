#!/usr/bin/env node
/**
 * End-to-end guard for Spawner UI + spark-skill-graphs skill pairing.
 *
 * This intentionally runs the same generation path used by development:
 * validate Spark, sync skills, rebuild generated catalogs, run the scored
 * recommendation eval, and run the focused matcher/pipeline contract tests.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const sparkDir = path.resolve(
	process.env.SPAWNER_H70_SKILLS_DIR ||
		process.env.H70_SKILLS_LAB_DIR ||
		path.join(os.homedir(), 'Desktop', 'spark-skill-graphs')
);

const checkClean = process.argv.includes('--check-clean') || process.env.CI === 'true';
const env = {
	...process.env,
	SPAWNER_H70_SKILLS_DIR: sparkDir
};

const generatedPaths = [
	'reports/skill-recommendation-eval.json',
	'reports/skill-recommendation-eval.md',
	'static/skills.json',
	'static/skill-collaboration.json',
	'src/lib/data/skill-catalog-compact.json',
	'src/lib/data/skill-catalog.json',
	'src/lib/data/skill-details.json',
	'src/lib/data/skill-index-ultra.json',
	'src/lib/data/skill-index.json',
	'src/lib/data/skill-matcher-catalog.json'
];

function run(label, command, args, cwd) {
	console.log(`\n[skill-guard] ${label}`);
	const useWindowsShell = process.platform === 'win32' && ['npm', 'npx'].includes(command);
	const commandLine = [command, ...args].map((part) => {
		if (!/[\s"]/g.test(part)) return part;
		return `"${part.replace(/"/g, '\\"')}"`;
	}).join(' ');
	const result = spawnSync(useWindowsShell ? commandLine : command, useWindowsShell ? [] : args, {
		cwd,
		env,
		shell: useWindowsShell,
		stdio: 'inherit'
	});

	if (result.error) {
		console.error(`[skill-guard] Failed to start ${command}: ${result.error.message}`);
		process.exit(1);
	}

	if (result.status !== 0) {
		process.exit(result.status || 1);
	}
}

function assertDirectory(label, directory) {
	if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
		console.error(`[skill-guard] ${label} not found: ${directory}`);
		process.exit(1);
	}
}

assertDirectory('spawner-ui', rootDir);
assertDirectory('spark-skill-graphs', sparkDir);

run('validate spark-skill-graphs', 'npm', ['run', 'validate:all'], sparkDir);
run('sync static skills from spark-skill-graphs', 'node', ['scripts/sync-spark-skill-graphs.cjs'], rootDir);
run('rebuild skill catalog', 'node', ['scripts/build-skill-catalog.cjs'], rootDir);
run('rebuild skill matcher index', 'node', ['scripts/build-skill-index.cjs'], rootDir);
run('score recommendation golden set', 'npx', ['tsx', 'scripts/evaluate-skill-recommendations.ts'], rootDir);
run(
	'run focused matcher integration tests',
	'npm',
	[
		'run',
		'test:run',
		'--',
		'src/lib/services/skill-recommendation-evals.test.ts',
		'src/lib/services/smart-pipeline.integration.test.ts',
		'src/lib/services/h70-skill-matcher.test.ts',
		'src/lib/server/skill-catalog-contract.test.ts'
	],
	rootDir
);

if (checkClean) {
	run('verify generated skill artifacts are committed', 'git', ['diff', '--exit-code', '--', ...generatedPaths], rootDir);
}

console.log('\n[skill-guard] OK');
