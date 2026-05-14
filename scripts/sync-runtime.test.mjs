import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '..');

function syncedPaths() {
	const script = readFileSync(join(repoRoot, 'scripts', 'sync-runtime.cjs'), 'utf8');
	return new Set([...script.matchAll(/'([^']+)'/g)].map((match) => match[1]));
}

function directSparkRunDependencies() {
	const route = readFileSync(join(repoRoot, 'src', 'routes', 'api', 'spark', 'run', '+server.ts'), 'utf8');
	const imports = route
		.split(/\r?\n/)
		.filter((line) => !/^\s*import\s+type\b/.test(line))
		.flatMap((line) => [...line.matchAll(/from\s+['"]\$lib\/(server|services)\/([^'"]+)['"]/g)]);
	return imports
		.map(([, area, modulePath]) => `src/lib/${area}/${modulePath}.ts`)
		.filter((relPath) => existsSync(join(repoRoot, relPath)));
}

describe('sync-runtime coverage', () => {
	it('keeps the Spark run route and its direct runtime dependencies together', () => {
		const paths = syncedPaths();
		expect(paths).toContain('src/routes/api/spark/run/+server.ts');

		for (const dependency of directSparkRunDependencies()) {
			expect(paths, `${dependency} should sync with /api/spark/run`).toContain(dependency);
		}
	});
});
