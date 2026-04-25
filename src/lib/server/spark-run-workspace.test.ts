import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveSparkRunProjectPath } from './spark-run-workspace';

const originalSparkWorkspaceRoot = process.env.SPARK_WORKSPACE_ROOT;
const originalSpawnerWorkspaceRoot = process.env.SPAWNER_WORKSPACE_ROOT;
const cleanupPaths: string[] = [];

afterEach(() => {
	process.env.SPARK_WORKSPACE_ROOT = originalSparkWorkspaceRoot;
	process.env.SPAWNER_WORKSPACE_ROOT = originalSpawnerWorkspaceRoot;
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

		expect(resolved).toBe(join(root, 'default'));
		expect(existsSync(resolved)).toBe(true);
		expect(resolved).not.toContain('C:/Users/USER/Desktop');
	});

	it('creates and returns explicit absolute project paths', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-explicit-'));
		const target = join(root, 'project');
		cleanupPaths.push(root);

		const resolved = resolveSparkRunProjectPath(target);

		expect(resolved).toBe(target);
		expect(isAbsolute(resolved)).toBe(true);
		expect(existsSync(resolved)).toBe(true);
	});
});
