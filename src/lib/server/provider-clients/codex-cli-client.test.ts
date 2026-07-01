import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codexWorkerEnvForCommand, parseCodexCliCommand } from './codex-cli-client';

describe('parseCodexCliCommand', () => {
	it('adds skip-git-repo-check for model-based Codex exec commands', () => {
		expect(parseCodexCliCommand('codex exec --model gpt-5.5', { env: {} })).toEqual({
			binary: 'codex',
			args: ['exec', '--skip-git-repo-check', '--model', 'gpt-5.5', '--sandbox', 'workspace-write']
		});
	});

	it('uses danger-full-access for model-based Codex exec commands when Level 5 guardrails are active', () => {
		expect(
			parseCodexCliCommand('codex exec --model gpt-5.5', {
				env: {
					SPARK_ALLOW_HIGH_AGENCY_WORKERS: '1',
					SPARK_ALLOW_EXTERNAL_PROJECT_PATHS: '1',
					SPARK_CODEX_SANDBOX: 'danger-full-access'
				}
			})
		).toEqual({
			binary: 'codex',
			args: ['exec', '--skip-git-repo-check', '--model', 'gpt-5.5', '--sandbox', 'danger-full-access']
		});
	});

	it('uses persisted Level 5 guardrails for default Codex exec even when the process env is stale read-only', () => {
		const sparkHome = mkdtempSync(join(tmpdir(), 'spark-codex-default-level5-'));
		try {
			mkdirSync(join(sparkHome, 'config', 'modules'), { recursive: true });
			writeFileSync(
				join(sparkHome, 'config', 'modules', 'spawner-ui.env'),
				[
					'SPARK_ALLOW_HIGH_AGENCY_WORKERS=1',
					'SPARK_ALLOW_EXTERNAL_PROJECT_PATHS=1',
					'SPARK_CODEX_SANDBOX=danger-full-access',
					''
				].join('\n')
			);

			expect(
				parseCodexCliCommand('codex exec --model gpt-5.5', {
					env: {
						SPARK_HOME: sparkHome,
						SPARK_ALLOW_HIGH_AGENCY_WORKERS: '0',
						SPARK_ALLOW_EXTERNAL_PROJECT_PATHS: '0',
						SPARK_CODEX_SANDBOX: 'read-only'
					}
				})
			).toEqual({
				binary: 'codex',
				args: ['exec', '--skip-git-repo-check', '--model', 'gpt-5.5', '--sandbox', 'danger-full-access']
			});
		} finally {
			rmSync(sparkHome, { recursive: true, force: true });
		}
	});

	it('preserves explicit profile selection while adding sandbox enforcement', () => {
		expect(parseCodexCliCommand('codex exec --model gpt-5.5 --profile speed', { env: {} })).toEqual({
			binary: 'codex',
			args: [
				'exec',
				'--skip-git-repo-check',
				'--model',
				'gpt-5.5',
				'--profile',
				'speed',
				'--sandbox',
				'workspace-write'
			]
		});
	});

	it('adds skip-git-repo-check for yolo Codex exec commands', () => {
		expect(parseCodexCliCommand('codex exec --yolo', { allowHighAgency: true })).toEqual({
			binary: 'codex',
			args: ['exec', '--skip-git-repo-check', '--yolo']
		});
	});

	it('carries persisted Level 5 guardrails into danger-full-access worker env', () => {
		const sparkHome = mkdtempSync(join(tmpdir(), 'spark-codex-worker-level5-'));
		try {
			mkdirSync(join(sparkHome, 'config', 'modules'), { recursive: true });
			writeFileSync(
				join(sparkHome, 'config', 'modules', 'spawner-ui.env'),
				[
					'SPARK_ALLOW_HIGH_AGENCY_WORKERS=1',
					'SPARK_ALLOW_EXTERNAL_PROJECT_PATHS=1',
					'SPARK_CODEX_SANDBOX=danger-full-access',
					''
				].join('\n')
			);
			const env = codexWorkerEnvForCommand(
				{ binary: 'codex', args: ['exec', '--skip-git-repo-check', '--model', 'gpt-5.5', '--sandbox', 'danger-full-access'] },
				{
					SPARK_HOME: sparkHome,
					SPARK_ALLOW_HIGH_AGENCY_WORKERS: '0',
					SPARK_ALLOW_EXTERNAL_PROJECT_PATHS: '0',
					SPARK_CODEX_SANDBOX: 'workspace-write'
				}
			);

			expect(env.SPARK_ALLOW_HIGH_AGENCY_WORKERS).toBe('1');
			expect(env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS).toBe('1');
			expect(env.SPARK_CODEX_SANDBOX).toBe('danger-full-access');
		} finally {
			rmSync(sparkHome, { recursive: true, force: true });
		}
	});
});
