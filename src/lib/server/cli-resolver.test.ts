import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveCliBinary } from './cli-resolver';

const originalCodexPath = process.env.CODEX_PATH;
const originalSparkCodexPath = process.env.SPARK_CODEX_PATH;
const originalSpawnerCodexPath = process.env.SPAWNER_CODEX_PATH;
const cleanupPaths: string[] = [];

afterEach(() => {
	process.env.CODEX_PATH = originalCodexPath;
	process.env.SPARK_CODEX_PATH = originalSparkCodexPath;
	process.env.SPAWNER_CODEX_PATH = originalSpawnerCodexPath;
	for (const path of cleanupPaths.splice(0)) {
		rmSync(path, { recursive: true, force: true });
	}
});

describe('resolveCliBinary', () => {
	it('honors CODEX_PATH when it points at an existing file', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-codex-path-'));
		const fakeCodex = join(root, process.platform === 'win32' ? 'codex.cmd' : 'codex');
		writeFileSync(fakeCodex, '', 'utf-8');
		cleanupPaths.push(root);
		process.env.CODEX_PATH = fakeCodex;
		delete process.env.SPARK_CODEX_PATH;
		delete process.env.SPAWNER_CODEX_PATH;

		expect(resolveCliBinary('codex')).toBe(fakeCodex);
	});

	it('does not return missing configured absolute paths', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-codex-missing-'));
		cleanupPaths.push(root);
		process.env.CODEX_PATH = join(root, 'missing-codex');
		delete process.env.SPARK_CODEX_PATH;
		delete process.env.SPAWNER_CODEX_PATH;

		expect(resolveCliBinary('codex')).not.toBe(process.env.CODEX_PATH);
	});
});
