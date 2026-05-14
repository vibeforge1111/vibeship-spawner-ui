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

	it('syncs Mission Control lineage helpers used by the relay board', () => {
		expect(syncedPaths()).toContain('src/lib/server/mission-control-relay.ts');
		expect(syncedPaths()).toContain('src/lib/server/mission-control-lineage.ts');
		expect(syncedPaths()).toContain('src/lib/server/project-path-extraction.ts');
	});

	it('syncs the provider prompt orchestrator used by live Spawner missions', () => {
		expect(syncedPaths()).toContain('src/lib/services/multi-llm-orchestrator.ts');
	});
});
