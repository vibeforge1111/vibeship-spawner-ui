import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareProviderWorkingDirectory } from './spark-agent-bridge';

const createdDirs: string[] = [];
const originalSparkWorkspaceRoot = process.env.SPARK_WORKSPACE_ROOT;
const originalAllowExternalProjectPaths = process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;

function restoreEnv(name: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[name];
		return;
	}
	process.env[name] = value;
}

describe('prepareProviderWorkingDirectory', () => {
	afterEach(() => {
		restoreEnv('SPARK_WORKSPACE_ROOT', originalSparkWorkspaceRoot);
		restoreEnv('SPARK_ALLOW_EXTERNAL_PROJECT_PATHS', originalAllowExternalProjectPaths);
		for (const dir of createdDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('creates a missing new-project workspace before provider spawn', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-provider-workspace-'));
		const dir = join(root, `new-project-${Date.now()}`);
		createdDirs.push(root);
		process.env.SPARK_WORKSPACE_ROOT = root;
		delete process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;

		expect(existsSync(dir)).toBe(false);
		expect(prepareProviderWorkingDirectory(dir)).toBe(dir);
		expect(existsSync(dir)).toBe(true);
	});

	it('rejects explicit provider workspaces outside Spark workspace by default', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-provider-root-'));
		const external = mkdtempSync(join(tmpdir(), 'spark-provider-external-'));
		createdDirs.push(root, external);
		process.env.SPARK_WORKSPACE_ROOT = root;
		delete process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;

		expect(() => prepareProviderWorkingDirectory(join(external, 'project'))).toThrow(
			'Project path must stay inside Spark workspace root'
		);
	});

	it('uses the process cwd when no workspace is provided', () => {
		expect(prepareProviderWorkingDirectory()).toBe(process.cwd());
	});
});
