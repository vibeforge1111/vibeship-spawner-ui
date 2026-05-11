import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import path from 'node:path';
import {
	spawnerBaseStateDir,
	spawnerStateArchiveReadiness,
	spawnerStateDir,
	spawnerStateRootAudit,
	spawnerStateSourceReferenceAudit,
	workspaceStateSegment
} from './spawner-state';

describe('spawner state directory', () => {
	const originalStateDir = process.env.SPAWNER_STATE_DIR;
	const originalSparkHome = process.env.SPARK_HOME;

	beforeEach(() => {
		delete process.env.SPAWNER_STATE_DIR;
		delete process.env.SPARK_HOME;
	});

	afterEach(() => {
		if (originalStateDir === undefined) {
			delete process.env.SPAWNER_STATE_DIR;
		} else {
			process.env.SPAWNER_STATE_DIR = originalStateDir;
		}
		if (originalSparkHome === undefined) {
			delete process.env.SPARK_HOME;
		} else {
			process.env.SPARK_HOME = originalSparkHome;
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
		).toBe(path.win32.join('C:\\spark-state\\spawner-ui', 'workspaces', 'founder-private-workspace'));
	});

	it('sanitizes workspace ids before using them as path segments', () => {
		expect(workspaceStateSegment('../Founder Workspace!!')).toBe('founder-workspace');
	});

	it('uses Spark home state when no explicit Spawner state dir is configured', () => {
		expect(spawnerBaseStateDir({ SPARK_HOME: 'C:\\spark-home' })).toBe(
			path.win32.join('C:\\spark-home', 'state', 'spawner-ui')
		);
	});

	it('uses the working directory fallback only when no state root is configured', () => {
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
			spark_home_state_dir_present: false,
			fallback_state_dir: path.resolve('C:\\repo\\spawner-ui', '.spawner'),
			fallback_used: false,
			spark_home_state_fallback_used: false,
			cwd_fallback_used: false,
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
			process.cwd(),
			(candidate) => path.resolve(String(candidate)) === path.resolve(process.cwd(), '.spawner')
		);

		expect(audit.classification).toBe('active_legacy_present');
		expect(audit.warnings.join(' ')).toContain('Module-local .spawner exists');
		expect(audit.archive_readiness.archive_candidate).toBe(false);
		expect(audit.archive_readiness.blockers).toContain('module_local_state_exists_without_archive_proof');
		expect(audit.archive_readiness.blockers).toContain('cwd_spawner_fallback_still_supported_by_state_helper');
		expect(audit.source_reference_audit.redaction).toContain('file contents');
	});

	it('classifies Spark home state as canonical when explicit state dir is missing', () => {
		const audit = spawnerStateRootAudit({ SPARK_HOME: 'C:\\spark-home' }, 'C:\\repo\\spawner-ui', () => false);

		expect(audit.classification).toBe('canonical_spark_home');
		expect(audit.base_state_dir).toBe(path.win32.join('C:\\spark-home', 'state', 'spawner-ui'));
		expect(audit.configured_state_dir_present).toBe(false);
		expect(audit.spark_home_state_dir_present).toBe(true);
		expect(audit.fallback_used).toBe(true);
		expect(audit.spark_home_state_fallback_used).toBe(true);
		expect(audit.cwd_fallback_used).toBe(false);
		expect(audit.warnings).toEqual([]);
	});

	it('classifies missing configured state as canonical fallback', () => {
		const audit = spawnerStateRootAudit({}, 'C:\\repo\\spawner-ui', () => true);

		expect(audit.classification).toBe('canonical_fallback');
		expect(audit.fallback_used).toBe(true);
		expect(audit.spark_home_state_fallback_used).toBe(false);
		expect(audit.cwd_fallback_used).toBe(true);
		expect(audit.warnings.join(' ')).toContain('SPAWNER_STATE_DIR is not configured');
		expect(audit.archive_readiness.blockers).toContain('current_runtime_uses_cwd_spawner_fallback');
	});

	it('reports source reference counts without exporting file contents', () => {
		const audit = spawnerStateSourceReferenceAudit(process.cwd());

		expect(audit.schema_version).toBe('spark.spawner_state_source_reference_audit.v1');
		expect(audit.scanned_roots).toEqual(['src', 'scripts', 'tests']);
		expect(audit.reference_file_count).toBeGreaterThan(0);
		expect(audit.cwd_spawner_fallback_helper_present).toBe(true);
		expect(audit.redaction).toContain('mission bodies');
	});

	it('marks archive readiness candidate only when no blockers remain', () => {
		const readiness = spawnerStateArchiveReadiness(
			{
				configured_state_dir_present: true,
				spark_home_state_dir_present: false,
				cwd_fallback_used: false,
				legacy_local_state_exists: false,
				state_dir: 'C:\\spark-state\\spawner-ui',
				fallback_state_dir: 'C:\\repo\\spawner-ui\\.spawner'
			},
			{
				schema_version: 'spark.spawner_state_source_reference_audit.v1',
				source_root: 'C:\\repo\\spawner-ui',
				scanned_roots: ['src', 'scripts', 'docs', 'tests'],
				reference_file_count: 0,
				reference_family_counts: {},
				cwd_spawner_fallback_helper_present: false,
				spark_home_state_fallback_helper_present: true,
				redaction: 'metadata only'
			}
		);

		expect(readiness.classification).toBe('candidate');
		expect(readiness.archive_candidate).toBe(true);
		expect(readiness.required_proofs.join(' ')).toContain('Telegram -> Builder -> Spawner trace proof');
	});
});
