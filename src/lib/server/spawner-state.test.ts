import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import { spawnerBaseStateDir, spawnerStateDir, spawnerStateRootAudit, workspaceStateSegment } from './spawner-state';

describe('spawner state directory', () => {
	const originalStateDir = process.env.SPAWNER_STATE_DIR;

	beforeEach(() => {
		delete process.env.SPAWNER_STATE_DIR;
	});

	afterEach(() => {
		if (originalStateDir === undefined) {
			delete process.env.SPAWNER_STATE_DIR;
		} else {
			process.env.SPAWNER_STATE_DIR = originalStateDir;
		}
	});

	it('keeps local development on the existing base state directory', () => {
		expect(spawnerStateDir({ SPAWNER_STATE_DIR: 'C:\\spark-state\\spawner-ui' })).toBe('C:\\spark-state\\spawner-ui');
	});

	it('scopes hosted private preview state by workspace', () => {
		expect(
			spawnerStateDir({
				SPAWNER_STATE_DIR: 'C:\\spark-state\\spawner-ui',
				SPARK_LIVE_CONTAINER: '1',
				SPARK_WORKSPACE_ID: 'Founder Private Workspace'
			})
		).toBe(path.join('C:\\spark-state\\spawner-ui', 'workspaces', 'founder-private-workspace'));
	});

	it('sanitizes workspace ids before using them as path segments', () => {
		expect(workspaceStateSegment('../Founder Workspace!!')).toBe('founder-workspace');
	});

	it('uses the working directory fallback when no state dir is configured', () => {
		expect(spawnerBaseStateDir({})).toBe(path.resolve(process.cwd(), '.spawner'));
	});

	it('audits configured state without reading mission bodies', () => {
		const audit = spawnerStateRootAudit(
			{ SPAWNER_STATE_DIR: 'C:\\spark-state\\spawner-ui' },
			'C:\\repo\\spawner-ui',
			() => false
		);

		expect(audit).toMatchObject({
			schema_version: 'spark.spawner_state_root_audit.v1',
			base_state_dir: 'C:\\spark-state\\spawner-ui',
			state_dir: 'C:\\spark-state\\spawner-ui',
			configured_state_dir_present: true,
			fallback_state_dir: path.resolve('C:\\repo\\spawner-ui', '.spawner'),
			fallback_used: false,
			hosted_workspace_scoped: false,
			legacy_local_state_exists: false,
			classification: 'canonical_configured',
			warnings: []
		});
		expect(audit.redaction).toContain('mission bodies');
	});

	it('classifies module-local state as active legacy when configured state is separate', () => {
		const audit = spawnerStateRootAudit(
			{ SPAWNER_STATE_DIR: 'C:\\spark-state\\spawner-ui' },
			'C:\\repo\\spawner-ui',
			(candidate) => String(candidate).endsWith(`${path.sep}.spawner`) || String(candidate).endsWith('\\.spawner')
		);

		expect(audit.classification).toBe('active_legacy_present');
		expect(audit.warnings.join(' ')).toContain('Module-local .spawner exists');
	});

	it('classifies missing configured state as canonical fallback', () => {
		const audit = spawnerStateRootAudit({}, 'C:\\repo\\spawner-ui', () => true);

		expect(audit.classification).toBe('canonical_fallback');
		expect(audit.fallback_used).toBe(true);
		expect(audit.warnings.join(' ')).toContain('SPAWNER_STATE_DIR is not configured');
	});
});
