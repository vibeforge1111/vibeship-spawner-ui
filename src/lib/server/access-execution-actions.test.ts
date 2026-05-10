import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	AccessExecutionPolicyError,
	runAccessExecutionAction,
	type AccessExecutionRunner
} from './access-execution-actions';

const originalSparkCliPath = process.env.SPARK_CLI_PATH;

function restoreEnv(name: string, value: string | undefined): void {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

function okRunner(calls: Array<{ command: string; args: string[]; timeoutMs: number }>): AccessExecutionRunner {
	return vi.fn(async (command, args, options) => {
		calls.push({ command, args, timeoutMs: options.timeoutMs });
		return {
			exitCode: 0,
			stdout: JSON.stringify({ ok: true, action: args.join(' ') }),
			stderr: '',
			durationMs: 12
		};
	});
}

afterEach(() => {
	restoreEnv('SPARK_CLI_PATH', originalSparkCliPath);
});

describe('runAccessExecutionAction', () => {
	it('runs the workspace setup action through fixed Spark argv without confirmation', async () => {
		process.env.SPARK_CLI_PATH = 'spark-test-bin';
		const calls: Array<{ command: string; args: string[]; timeoutMs: number }> = [];

		const result = await runAccessExecutionAction('workspace_setup', {
			runner: okRunner(calls)
		});

		expect(result.success).toBe(true);
		expect(result.action).toMatchObject({
			id: 'workspace_setup',
			displayCommand: 'spark access setup',
			runPolicy: 'auto_safe'
		});
		expect(result.result.payload).toMatchObject({ ok: true });
		expect(calls).toEqual([
			{
				command: 'spark-test-bin',
				args: ['access', 'setup', '--json'],
				timeoutMs: 60_000
			}
		]);
	});

	it('blocks confirm-once Docker smoke until the caller confirms', async () => {
		const runner = vi.fn() as AccessExecutionRunner;

		await expect(runAccessExecutionAction('docker_smoke', { runner })).rejects.toMatchObject({
			name: 'AccessExecutionPolicyError',
			status: 428
		});
		expect(runner).not.toHaveBeenCalled();
	});

	it('runs Docker smoke after confirmation with the no-secret smoke command', async () => {
		process.env.SPARK_CLI_PATH = 'spark-test-bin';
		const calls: Array<{ command: string; args: string[]; timeoutMs: number }> = [];

		const result = await runAccessExecutionAction('docker_smoke', {
			confirmed: true,
			runner: okRunner(calls)
		});

		expect(result.action).toMatchObject({
			id: 'docker_smoke',
			runPolicy: 'confirm_once'
		});
		expect(calls[0]).toMatchObject({
			args: ['sandbox', 'docker', 'smoke', '--json'],
			timeoutMs: 180_000
		});
	});

	it('requires exact explicit opt-in text before Level 5 setup', async () => {
		const runner = vi.fn() as AccessExecutionRunner;

		await expect(
			runAccessExecutionAction('level5_enable', {
				confirmed: true,
				explicitOptIn: 'yes',
				runner
			})
		).rejects.toBeInstanceOf(AccessExecutionPolicyError);
		expect(runner).not.toHaveBeenCalled();
	});

	it('runs Level 5 enable and disable through separate fixed actions', async () => {
		process.env.SPARK_CLI_PATH = 'spark-test-bin';
		const calls: Array<{ command: string; args: string[]; timeoutMs: number }> = [];
		const runner = okRunner(calls);

		await runAccessExecutionAction('level5_enable', {
			explicitOptIn: 'Enable whole-computer operator mode',
			runner
		});
		await runAccessExecutionAction('level5_disable', {
			confirmed: true,
			runner
		});

		expect(calls.map((call) => call.args)).toEqual([
			['access', 'setup', '--level', '5', '--enable-high-agency', '--json'],
			['access', 'disable-level5', '--json']
		]);
	});

	it('rejects unsupported action ids instead of executing client-supplied commands', async () => {
		const runner = vi.fn() as AccessExecutionRunner;

		await expect(
			runAccessExecutionAction('spark access setup && whoami', { runner })
		).rejects.toThrow('Unsupported access execution action');
		expect(runner).not.toHaveBeenCalled();
	});
});
