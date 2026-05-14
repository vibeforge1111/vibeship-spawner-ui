import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '..');

function syncedPaths() {
	const script = readFileSync(join(repoRoot, 'scripts', 'sync-runtime.cjs'), 'utf8');
	return new Set([...script.matchAll(/'([^']+)'/g)].map((match) => match[1]));
}

describe('sync-runtime coverage', () => {
	it('syncs the Spark health command used by live status', () => {
		expect(syncedPaths()).toContain('scripts/health-spark.mjs');
	});
});
