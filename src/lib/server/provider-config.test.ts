import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveProviderRuntimeConfiguration } from './provider-config';

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

describe('resolveProviderRuntimeConfiguration', () => {
	it('treats a resolvable terminal CLI provider as configured without an API key', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-provider-config-'));
		const fakeCodex = join(root, process.platform === 'win32' ? 'codex.cmd' : 'codex');
		writeFileSync(fakeCodex, '', 'utf-8');
		cleanupPaths.push(root);
		process.env.CODEX_PATH = fakeCodex;
		delete process.env.SPARK_CODEX_PATH;
		delete process.env.SPAWNER_CODEX_PATH;

		const result = resolveProviderRuntimeConfiguration(
			{ id: 'codex', kind: 'terminal_cli', apiKeyEnv: 'OPENAI_API_KEY' },
			{}
		);

		expect(result).toMatchObject({
			envKeyConfigured: false,
			cliConfigured: true,
			cliPath: fakeCodex,
			configured: true,
			configurationMode: 'cli'
		});
	});

	it('does not count placeholder API keys as configured', () => {
		const result = resolveProviderRuntimeConfiguration(
			{ id: 'zai', kind: 'openai_compat', apiKeyEnv: 'ZAI_API_KEY' },
			{ ZAI_API_KEY: 'your_zai_api_key' }
		);

		expect(result).toMatchObject({
			envKeyConfigured: false,
			cliConfigured: false,
			cliPath: null,
			configured: false,
			configurationMode: 'none'
		});
	});

	it('reports API-key providers as configured when a real key is present', () => {
		const result = resolveProviderRuntimeConfiguration(
			{ id: 'zai', kind: 'openai_compat', apiKeyEnv: 'ZAI_API_KEY' },
			{ ZAI_API_KEY: 'zai-real-key' }
		);

		expect(result).toMatchObject({
			envKeyConfigured: true,
			cliConfigured: false,
			configured: true,
			configurationMode: 'api_key'
		});
	});
});
