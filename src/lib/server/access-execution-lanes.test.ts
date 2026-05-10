import { describe, expect, it } from 'vitest';
import { recommendAccessExecutionLane } from './access-execution-lanes';

describe('recommendAccessExecutionLane', () => {
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
			sparkCliAction: 'spark access setup sandbox'
		});
		expect(result.recommended.osHint).toContain('macOS default');
		expect(result.lanes.find((lane) => lane.id === 'docker')).toMatchObject({
			setupMode: 'guided',
			sparkCliAction: 'spark install docker'
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
			sparkCliAction: 'spark access setup docker-sandbox'
		});
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
			sparkCliAction: 'spark access setup ssh-sandbox'
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
			sparkCliAction: 'spark access setup modal-sandbox'
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
			available: false
		});
	});

	it('allows Level 5 whole-computer mode only after explicit opt-in', () => {
		const result = recommendAccessExecutionLane({
			accessLevel: 5,
			env: { SPARK_ALLOW_HIGH_AGENCY_WORKERS: '1' },
			platform: 'linux',
			workspaceRoot: '/home/user/.spark/workspaces'
		});

		expect(result.recommended).toMatchObject({
			id: 'level5_operator',
			setupMode: 'guided',
			available: true
		});
	});
});
