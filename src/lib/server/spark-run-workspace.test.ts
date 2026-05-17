import { existsSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveSparkRunProjectPath, SparkRunWorkspaceError } from './spark-run-workspace';

const originalSparkWorkspaceRoot = process.env.SPARK_WORKSPACE_ROOT;
const originalSpawnerWorkspaceRoot = process.env.SPAWNER_WORKSPACE_ROOT;
const originalSparkHome = process.env.SPARK_HOME;
const originalAllowExternalProjectPaths = process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;
const cleanupPaths: string[] = [];

function expectedContainedPath(root: string, ...segments: string[]): string {
	return join(realpathSync(root), ...segments);
}

afterEach(() => {
	process.env.SPARK_WORKSPACE_ROOT = originalSparkWorkspaceRoot;
	process.env.SPAWNER_WORKSPACE_ROOT = originalSpawnerWorkspaceRoot;
	process.env.SPARK_HOME = originalSparkHome;
	process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS = originalAllowExternalProjectPaths;
	for (const path of cleanupPaths.splice(0)) {
		rmSync(path, { recursive: true, force: true });
	}
});

describe('resolveSparkRunProjectPath', () => {
	it('uses a platform-local Spark workspace when no project path is provided', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-workspace-'));
		cleanupPaths.push(root);
		process.env.SPARK_WORKSPACE_ROOT = root;
		delete process.env.SPAWNER_WORKSPACE_ROOT;

		const resolved = resolveSparkRunProjectPath();

		expect(resolved).toBe(expectedContainedPath(root, 'default'));
		expect(existsSync(resolved)).toBe(true);
		expect(resolved).not.toContain('C:/Users/USER/Desktop');
	});

	it('uses SPARK_HOME workspaces for sandboxed installs when no explicit root is set', () => {
		const sparkHome = mkdtempSync(join(tmpdir(), 'spark-home-'));
		cleanupPaths.push(sparkHome);
		delete process.env.SPARK_WORKSPACE_ROOT;
		delete process.env.SPAWNER_WORKSPACE_ROOT;
		process.env.SPARK_HOME = sparkHome;

		const resolved = resolveSparkRunProjectPath();

		expect(resolved).toBe(expectedContainedPath(sparkHome, 'workspaces', 'default'));
		expect(existsSync(resolved)).toBe(true);
	});

	it('creates and returns explicit project paths inside the Spark workspace root', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-explicit-'));
		const target = join(root, 'project');
		cleanupPaths.push(root);
		process.env.SPARK_WORKSPACE_ROOT = root;

		const resolved = resolveSparkRunProjectPath(target);

		expect(resolved).toBe(expectedContainedPath(root, 'project'));
		expect(isAbsolute(resolved)).toBe(true);
		expect(existsSync(resolved)).toBe(true);
	});

	it('resolves relative project names under the Spark workspace root', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-relative-'));
		cleanupPaths.push(root);
		process.env.SPARK_WORKSPACE_ROOT = root;

		const resolved = resolveSparkRunProjectPath('telegram-project');

		expect(resolved).toBe(expectedContainedPath(root, 'telegram-project'));
		expect(existsSync(resolved)).toBe(true);
	});

	it('rejects external project paths by default', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-root-'));
		const external = mkdtempSync(join(tmpdir(), 'spark-external-'));
		cleanupPaths.push(root, external);
		process.env.SPARK_WORKSPACE_ROOT = root;
		delete process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;

		expect(() => resolveSparkRunProjectPath(join(external, 'project'))).toThrow(SparkRunWorkspaceError);
	});

	it('rejects project paths that escape through a workspace symlink', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-root-'));
		const external = mkdtempSync(join(tmpdir(), 'spark-external-'));
		const link = join(root, 'linked-out');
		cleanupPaths.push(root, external);
		process.env.SPARK_WORKSPACE_ROOT = root;
		delete process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;
		try {
			symlinkSync(external, link, process.platform === 'win32' ? 'junction' : 'dir');
		} catch {
			return;
		}

		expect(() => resolveSparkRunProjectPath(join(link, 'project'))).toThrow(SparkRunWorkspaceError);
	});

	it('allows external project paths only when explicitly enabled', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-root-'));
		const external = mkdtempSync(join(tmpdir(), 'spark-external-'));
		const target = join(external, 'project');
		cleanupPaths.push(root, external);
		process.env.SPARK_WORKSPACE_ROOT = root;
		process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS = '1';

		const resolved = resolveSparkRunProjectPath(target);

		expect(resolved).toBe(resolve(target));
		expect(existsSync(resolved)).toBe(true);
	});
});
