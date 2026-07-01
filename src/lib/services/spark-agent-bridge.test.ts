import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { eventBridge, type BridgeEvent } from './event-bridge';
import { buildServerGovernorDecisionAuthority } from '$lib/server/harness-authority';
import {
	parseProviderCommand,
	prepareProviderWorkingDirectory,
	providerWorkerEnvForCommand,
	providerProcessFailureMessage,
	providerProcessTimeoutMessage,
	providerProcessTimeoutMs,
	sparkAgentBridge
} from './spark-agent-bridge';

const createdDirs: string[] = [];
const originalSparkWorkspaceRoot = process.env.SPARK_WORKSPACE_ROOT;
const originalAllowExternalProjectPaths = process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;

function workerRunAuthority(requestId = 'spark-agent-worker-test') {
	return buildServerGovernorDecisionAuthority({
		source: 'spark-agent-bridge-test',
		reason: 'Focused Spark Agent worker authority regression.',
		toolName: 'spawner.spark_agent.worker.run',
		mutationClass: 'launches_mission',
		requestId,
		target: 'mission-worker-proof',
		externalNetwork: true
	});
}

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
		sparkAgentBridge.resetForTests();
		for (const dir of createdDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('creates a missing new-project workspace before provider spawn', () => {
		const root = mkdtempSync(join(tmpdir(), 'spark-provider-workspace-'));
		const projectName = `new-project-${Date.now()}`;
		const dir = join(root, projectName);
		createdDirs.push(root);
		process.env.SPARK_WORKSPACE_ROOT = root;
		delete process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;

		expect(existsSync(dir)).toBe(false);
		expect(prepareProviderWorkingDirectory(dir)).toBe(join(realpathSync(root), projectName));
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

	it('carries request, trace, provider, and model metadata on worker events', async () => {
		sparkAgentBridge.setWorkerExecutorForTests(async () => ({ success: true, response: 'done' }));
		const emitted: BridgeEvent[] = [];
		const unsubscribe = eventBridge.subscribe((event) => emitted.push(event));

		await sparkAgentBridge.executeProviderTask({
			providerId: 'codex',
			missionId: 'mission-worker-proof',
			prompt: 'metadata proof only',
			executionAuthority: workerRunAuthority('request-worker-proof'),
			model: 'gpt-5.5',
			requestId: 'request-worker-proof',
			traceRef: 'trace:spawner-prd:mission-worker-proof',
			commandTemplate: 'codex exec --model gpt-5.5'
		});
		unsubscribe();

		const completed = emitted.find((event) => event.type === 'task_completed');
		expect(completed?.data).toMatchObject({
			provider: 'codex',
			providerId: 'codex',
			model: 'gpt-5.5',
			requestId: 'request-worker-proof',
			traceRef: 'trace:spawner-prd:mission-worker-proof'
		});
	});

	it('blocks direct provider task execution without native Governor authority', async () => {
		let executorCalled = false;
		sparkAgentBridge.setWorkerExecutorForTests(async () => {
			executorCalled = true;
			return { success: true, response: 'should-not-run' };
		});

		await expect(
			sparkAgentBridge.executeProviderTask({
				providerId: 'codex',
				missionId: 'mission-worker-no-authority',
				prompt: 'metadata proof only'
			} as never)
		).rejects.toThrow('Execution requires Harness Core authority.');

		expect(executorCalled).toBe(false);
	});

	it('blocks direct provider task execution when the Governor tool ledger is missing', async () => {
		let executorCalled = false;
		sparkAgentBridge.setWorkerExecutorForTests(async () => {
			executorCalled = true;
			return { success: true, response: 'should-not-run' };
		});
		const authority = workerRunAuthority('request-worker-missing-ledger');
		const missingLedgerAuthority = JSON.parse(JSON.stringify(authority));
		missingLedgerAuthority.tool_ledgers = [];

		await expect(
			sparkAgentBridge.executeProviderTask({
				providerId: 'codex',
				missionId: 'mission-worker-missing-ledger',
				prompt: 'metadata proof only',
				executionAuthority: missingLedgerAuthority,
				requestId: 'request-worker-missing-ledger'
			})
		).rejects.toThrow('Execution authority blocked this request.');

		expect(executorCalled).toBe(false);
	});
});

describe('parseProviderCommand', () => {
	it('allows codex profile selection while preserving sandbox enforcement', () => {
		const originalSparkHome = process.env.SPARK_HOME;
		const originalHighAgencyWorkers = process.env.SPARK_ALLOW_HIGH_AGENCY_WORKERS;
		const originalExternalPaths = process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;
		const originalCodexSandbox = process.env.SPARK_CODEX_SANDBOX;
		const sparkHome = mkdtempSync(join(tmpdir(), 'spark-provider-no-level5-'));
		createdDirs.push(sparkHome);
		process.env.SPARK_HOME = sparkHome;
		delete process.env.SPARK_ALLOW_HIGH_AGENCY_WORKERS;
		delete process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;
		delete process.env.SPARK_CODEX_SANDBOX;

		try {
			const command = parseProviderCommand(
				'codex',
				'codex exec --model gpt-5.5 --profile speed --sandbox workspace-write'
			);

			expect(command).toMatchObject({
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
		} finally {
			restoreEnv('SPARK_HOME', originalSparkHome);
			restoreEnv('SPARK_ALLOW_HIGH_AGENCY_WORKERS', originalHighAgencyWorkers);
			restoreEnv('SPARK_ALLOW_EXTERNAL_PROJECT_PATHS', originalExternalPaths);
			restoreEnv('SPARK_CODEX_SANDBOX', originalCodexSandbox);
		}
	});

	it('promotes default Codex provider commands from stale read-only env when persisted Level 5 is active', () => {
		const originalSparkHome = process.env.SPARK_HOME;
		const originalHighAgencyWorkers = process.env.SPARK_ALLOW_HIGH_AGENCY_WORKERS;
		const originalExternalPaths = process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;
		const originalCodexSandbox = process.env.SPARK_CODEX_SANDBOX;
		const sparkHome = mkdtempSync(join(tmpdir(), 'spark-provider-default-level5-'));
		createdDirs.push(sparkHome);
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
		process.env.SPARK_HOME = sparkHome;
		process.env.SPARK_ALLOW_HIGH_AGENCY_WORKERS = '0';
		process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS = '0';
		process.env.SPARK_CODEX_SANDBOX = 'read-only';

		try {
			const command = parseProviderCommand('codex', 'codex exec --model gpt-5.5');

			expect(command).toMatchObject({
				binary: 'codex',
				args: ['exec', '--skip-git-repo-check', '--model', 'gpt-5.5', '--sandbox', 'danger-full-access']
			});
		} finally {
			restoreEnv('SPARK_HOME', originalSparkHome);
			restoreEnv('SPARK_ALLOW_HIGH_AGENCY_WORKERS', originalHighAgencyWorkers);
			restoreEnv('SPARK_ALLOW_EXTERNAL_PROJECT_PATHS', originalExternalPaths);
			restoreEnv('SPARK_CODEX_SANDBOX', originalCodexSandbox);
		}
	});

	it('rejects unsupported codex command flags', () => {
		expect(() =>
			parseProviderCommand('codex', 'codex exec --model gpt-5.5 --profile speed --output json')
		).toThrow('Codex provider command must be');
	});

	it('carries persisted Level 5 guardrails into high-agency provider worker env', () => {
		const sparkHome = mkdtempSync(join(tmpdir(), 'spark-agent-worker-level5-'));
		createdDirs.push(sparkHome);
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

		const env = providerWorkerEnvForCommand(
			{
				binary: 'codex',
				resolvedBinary: 'codex',
				args: ['exec', '--skip-git-repo-check', '--model', 'gpt-5.5', '--sandbox', 'danger-full-access']
			},
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
	});
});

describe('providerProcessFailureMessage', () => {
	it('uses stderr first for actionable provider failures', () => {
		expect(providerProcessFailureMessage(1, 'stdout fallback', 'Provider rejected the request')).toBe(
			'Provider rejected the request'
		);
	});

	it('falls back to bounded stdout when stderr is empty', () => {
		expect(providerProcessFailureMessage(1, 'Model unavailable for this provider', '')).toBe(
			'Model unavailable for this provider'
		);
	});

	it('redacts secrets and local paths before surfacing provider output', () => {
		const message = providerProcessFailureMessage(
			1,
			'',
			'Error in C:\\Users\\USER\\private\\app with OPENAI_API_KEY=sk-secretvalue123456 and Bearer ghp_secretvalue1234567890'
		);

		expect(message).toContain('local file');
		expect(message).toContain('[secret]');
		expect(message).not.toContain('C:\\Users\\USER');
		expect(message).not.toContain('sk-secretvalue123456');
		expect(message).not.toContain('ghp_secretvalue1234567890');
	});

	it('falls back to the exit code when no provider output is usable', () => {
		expect(providerProcessFailureMessage(2, '', '')).toBe('Exited with code 2');
	});
});

describe('provider process timeout helpers', () => {
	it('uses the shared agent timeout configuration', () => {
		expect(providerProcessTimeoutMs({ SPAWNER_AGENT_WORK_TIMEOUT_MS: '120000' })).toBe(120000);
	});

	it('renders a bounded timeout message without provider output', () => {
		expect(providerProcessTimeoutMessage('codex', 120000)).toBe('Provider codex timed out after 2 minutes');
	});
});
