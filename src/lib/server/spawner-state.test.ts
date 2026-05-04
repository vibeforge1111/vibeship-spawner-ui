import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { spawnerBaseStateDir, spawnerStateDir, workspaceStateSegment } from './spawner-state';

describe('spawner state directory', () => {
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
});
