import { spawnSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recommendAccessExecutionLane, resetDockerAvailabilityCacheForTests } from './access-execution-lanes';

vi.mock('node:child_process', () => {
	const childProcess = { spawnSync: vi.fn() };
	return {
		default: childProcess,
		...childProcess
	};
});

const mockSpawnSync = vi.mocked(spawnSync);

describe('recommendAccessExecutionLane', () => {
	beforeEach(() => {
		resetDockerAvailabilityCacheForTests();
		mockSpawnSync.mockReset();
		mockSpawnSync.mockReturnValue({ status: 1 } as never);
	});

	it('defaults Level 4 to an automatic Spark workspace sandbox', () => {
		const result = recommendAccessExecutionLane({
			accessLevel: 4,
			env: {},
			platform: 'darwin',
			dockerAvailable: false,
			workspaceRoot: '/Users/alchemistab/.spark/workspaces'
		});

		expect(result.osFamily).toBe('macos');
		expect(result.recommended).toMatchObject({
			id: 'spark_workspace',
			setupMode: 'automatic',
			available: true,
			recommended: true,
			sparkCliAction: 'spark access setup',
			runPolicy: 'auto_safe'
		});
		expect(result.recommended.osHint).toContain('macOS default');
		expect(result.lanes.find((lane) => lane.id === 'docker')).toMatchObject({
			setupMode: 'guided',
			sparkCliAction: 'spark sandbox docker doctor --json',
			runPolicy: 'auto_read_only'
		});
	});

	it('uses Docker for Level 4 isolation goals only when Docker is available', () => {
		const unavailable = recommendAccessExecutionLane({
			accessLevel: 4,
			env: {},
			platform: 'win32',
			dockerAvailable: false,
			userGoal: 'I need a reproducible linux container',
			workspaceRoot: 'C:\\Spark\\workspaces'
		});
		const available = recommendAccessExecutionLane({
			accessLevel: 4,
			env: {},
			platform: 'win32',
			dockerAvailable: true,
			userGoal: 'I need a reproducible linux container',
			workspaceRoot: 'C:\\Spark\\workspaces'
		});

		expect(unavailable.osFamily).toBe('windows');
		expect(unavailable.recommended.id).toBe('spark_workspace');
		expect(unavailable.lanes.find((lane) => lane.id === 'docker')?.osHint).toContain('Windows');
		expect(available.recommended).toMatchObject({
			id: 'docker',
			setupMode: 'automatic',
			sparkCliAction: 'spark access setup --with docker',
			runPolicy: 'auto_safe'
		});
	});

	it('uses SPARK_DOCKER_AVAILABLE as an explicit Docker availability override', () => {
		const forcedAvailable = recommendAccessExecutionLane({
			accessLevel: 4,
			env: { SPARK_DOCKER_AVAILABLE: '1' },
			platform: 'linux',
			userGoal: 'I need a container',
			workspaceRoot: '/home/user/.spark/workspaces'
		});
		const forcedUnavailable = recommendAccessExecutionLane({
			accessLevel: 4,
			env: { SPARK_DOCKER_AVAILABLE: '0' },
			platform: 'linux',
			userGoal: 'I need a container',
			workspaceRoot: '/home/user/.spark/workspaces'
		});

		expect(forcedAvailable.recommended.id).toBe('docker');
		expect(forcedUnavailable.recommended.id).toBe('spark_workspace');
		expect(mockSpawnSync).not.toHaveBeenCalled();
	});

	it('probes the Docker CLI and daemon once when no env override is set', () => {
		mockSpawnSync.mockReturnValue({ status: 0 } as never);

		const first = recommendAccessExecutionLane({
			accessLevel: 4,
			env: {},
			platform: 'linux',
			userGoal: 'I need a container',
			workspaceRoot: '/home/user/.spark/workspaces'
		});
		const second = recommendAccessExecutionLane({
			accessLevel: 4,
			env: {},
			platform: 'linux',
			userGoal: 'I need a container',
			workspaceRoot: '/home/user/.spark/workspaces'
		});

		expect(first.recommended.id).toBe('docker');
		expect(second.recommended.id).toBe('docker');
		expect(mockSpawnSync).toHaveBeenCalledTimes(1);
		expect(mockSpawnSync).toHaveBeenCalledWith(
			'docker',
			['info', '--format', '{{json .ServerVersion}}'],
			expect.objectContaining({
				stdio: 'ignore',
				timeout: 1_500,
				windowsHide: true
			})
		);
	});

	it('uses SSH when a trusted remote target is configured and the task asks for it', () => {
		const result = recommendAccessExecutionLane({
			accessLevel: 4,
			env: { SPARK_SSH_HOST: 'spark-devbox' },
			platform: 'linux',
			userGoal: 'run this on my remote server',
			workspaceRoot: '/home/user/.spark/workspaces'
		});

		expect(result.osFamily).toBe('linux');
		expect(result.recommended).toMatchObject({
			id: 'ssh',
			setupMode: 'automatic',
			sparkCliAction: 'spark sandbox ssh list --json',
			runPolicy: 'auto_read_only'
		});
	});

	it('uses Modal when credentials are configured and the task asks for cloud compute', () => {
		const result = recommendAccessExecutionLane({
			accessLevel: 4,
			env: { MODAL_TOKEN_ID: 'token-id', MODAL_TOKEN_SECRET: 'token-secret' },
			platform: 'darwin',
			userGoal: 'use a gpu cloud sandbox for this large job',
			workspaceRoot: '/Users/alchemistab/.spark/workspaces'
		});

		expect(result.recommended).toMatchObject({
			id: 'modal',
			setupMode: 'automatic',
			sparkCliAction: 'spark sandbox modal doctor --json',
			runPolicy: 'auto_read_only'
		});
	});

	it('blocks Level 5 whole-computer mode unless high-agency workers are enabled', () => {
		const result = recommendAccessExecutionLane({
			accessLevel: 5,
			env: {},
			platform: 'darwin',
			workspaceRoot: '/Users/alchemistab/.spark/workspaces'
		});

		expect(result.recommended.id).toBe('spark_workspace');
		expect(result.lanes[0]).toMatchObject({
			id: 'level5_operator',
			setupMode: 'blocked',
			available: false,
			sparkCliAction: 'spark access setup --level 5 --enable-high-agency',
			runPolicy: 'explicit_opt_in'
		});
	});

	it('keeps Level 5 blocked when only one guardrail flag is present', () => {
		const result = recommendAccessExecutionLane({
			accessLevel: 5,
			env: { SPARK_ALLOW_HIGH_AGENCY_WORKERS: '1' },
			platform: 'linux',
			workspaceRoot: '/home/user/.spark/workspaces'
		});

		expect(result.recommended.id).toBe('spark_workspace');
		expect(result.lanes[0]).toMatchObject({
			id: 'level5_operator',
			setupMode: 'blocked',
			available: false
		});
	});

	it('allows Level 5 whole-computer mode only after all runtime guardrails are active', () => {
		const result = recommendAccessExecutionLane({
			accessLevel: 5,
			env: {
				SPARK_ALLOW_HIGH_AGENCY_WORKERS: '1',
				SPARK_ALLOW_EXTERNAL_PROJECT_PATHS: '1',
				SPARK_CODEX_SANDBOX: 'danger-full-access'
			},
			platform: 'linux',
			workspaceRoot: '/home/user/.spark/workspaces'
		});

		expect(result.recommended).toMatchObject({
			id: 'level5_operator',
			setupMode: 'automatic',
			available: true,
			sparkCliAction: 'spark access status --level 5',
			runPolicy: 'auto_read_only',
			rollback: 'spark access disable-level5'
		});
	});
});
