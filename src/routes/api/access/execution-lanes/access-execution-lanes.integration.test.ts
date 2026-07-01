import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { PRIVATE_ENV, runAccessExecutionActionMock } = vi.hoisted(() => ({
	PRIVATE_ENV: {
		SPARK_BRIDGE_API_KEY: '',
		MCP_API_KEY: ''
	} as Record<string, string>,
	runAccessExecutionActionMock: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

vi.mock('$lib/server/access-execution-actions', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/access-execution-actions')>();
	return {
		...actual,
		runAccessExecutionAction: runAccessExecutionActionMock
	};
});

import { GET, POST } from './+server';
import {
	ACCESS_EXECUTION_ACTIONS,
	AccessExecutionPolicyError
} from '$lib/server/access-execution-actions';

const originalBridgeKey = process.env.SPARK_BRIDGE_API_KEY;
const originalDockerAvailable = process.env.SPARK_DOCKER_AVAILABLE;
const originalHighAgencyWorkers = process.env.SPARK_ALLOW_HIGH_AGENCY_WORKERS;
const originalExternalProjectPaths = process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;
const originalCodexSandbox = process.env.SPARK_CODEX_SANDBOX;
const originalSparkHome = process.env.SPARK_HOME;
let testSparkHome: string | null = null;

function restoreEnv(name: string, value: string | undefined) {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

function routeEvent(url: string, init?: RequestInit) {
	return {
		request: new Request(url, init),
		url: new URL(url),
		cookies: {
			get: () => undefined
		},
		getClientAddress: () => '127.0.0.1'
	};
}

describe('/api/access/execution-lanes', () => {
	beforeEach(() => {
		PRIVATE_ENV.SPARK_BRIDGE_API_KEY = '';
		PRIVATE_ENV.MCP_API_KEY = '';
		runAccessExecutionActionMock.mockReset();
		testSparkHome = mkdtempSync(join(tmpdir(), 'spawner-access-lanes-'));
		process.env.SPARK_HOME = testSparkHome;
		process.env.SPARK_DOCKER_AVAILABLE = '0';
		delete process.env.SPARK_BRIDGE_API_KEY;
		delete process.env.SPARK_ALLOW_HIGH_AGENCY_WORKERS;
		delete process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS;
		delete process.env.SPARK_CODEX_SANDBOX;
	});

	afterEach(() => {
		restoreEnv('SPARK_BRIDGE_API_KEY', originalBridgeKey);
		restoreEnv('SPARK_DOCKER_AVAILABLE', originalDockerAvailable);
		restoreEnv('SPARK_ALLOW_HIGH_AGENCY_WORKERS', originalHighAgencyWorkers);
		restoreEnv('SPARK_ALLOW_EXTERNAL_PROJECT_PATHS', originalExternalProjectPaths);
		restoreEnv('SPARK_CODEX_SANDBOX', originalCodexSandbox);
		restoreEnv('SPARK_HOME', originalSparkHome);
		if (testSparkHome) rmSync(testSparkHome, { recursive: true, force: true });
		testSparkHome = null;
	});

	it('returns a nontechnical Level 4 execution-lane status by default', async () => {
		const response = await GET(routeEvent('http://127.0.0.1/api/access/execution-lanes') as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			success: true,
			access: {
				recommended: {
					id: 'spark_workspace',
					setupMode: 'automatic',
					sparkCliAction: 'spark access setup',
					runPolicy: 'auto_safe'
				}
			}
		});
		expect(body.access.recommended.userMessage).toContain('safe Spark workspace');
		expect(body.access.recommended.workspaceRoot).toBeUndefined();
		expect(body.access.lanes.find((lane: { id: string }) => lane.id === 'spark_workspace').workspaceRoot).toBeUndefined();
		expect(body.access.recommended.userMessage).not.toMatch(/[A-Z]:\\|\/Users\/|\/home\//);
		expect(body.actions.find((action: { id: string }) => action.id === 'docker_smoke')).toMatchObject({
			displayCommand: 'spark sandbox docker smoke --json',
			runPolicy: 'confirm_once',
			confirmation: 'Run Docker sandbox test'
		});
	});

	it('includes local workspace paths for existing authenticated control callers', async () => {
		process.env.SPARK_BRIDGE_API_KEY = 'bridge-secret';
		PRIVATE_ENV.SPARK_BRIDGE_API_KEY = 'bridge-secret';

		const response = await GET(
			routeEvent('http://127.0.0.1/api/access/execution-lanes', {
				headers: { 'x-api-key': 'bridge-secret' }
			}) as never
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.access.recommended.workspaceRoot).toBeTruthy();
		expect(body.access.recommended.userMessage).toContain(body.access.recommended.workspaceRoot);
	});

	it('returns Level 5 as blocked unless operator guardrails are enabled', async () => {
		const response = await GET(
			routeEvent('http://127.0.0.1/api/access/execution-lanes?accessLevel=5') as never
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.access.recommended.id).toBe('spark_workspace');
		expect(body.access.lanes[0]).toMatchObject({
			id: 'level5_operator',
			available: false,
			setupMode: 'blocked',
			sparkCliAction: 'spark access setup --level 5 --enable-high-agency',
			runPolicy: 'explicit_opt_in'
		});
	});

	it('returns active Level 5 as an automatic full-access lane when operator guardrails are enabled', async () => {
		process.env.SPARK_ALLOW_HIGH_AGENCY_WORKERS = '1';
		process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS = '1';
		process.env.SPARK_CODEX_SANDBOX = 'danger-full-access';

		const response = await GET(
			routeEvent('http://127.0.0.1/api/access/execution-lanes?accessLevel=5') as never
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.access.recommended).toMatchObject({
			id: 'level5_operator',
			available: true,
			setupMode: 'automatic',
			sparkCliAction: 'spark access status --level 5',
			runPolicy: 'auto_safe'
		});
		expect(body.access.recommended.userMessage).toContain('trusted local machine access');
	});

	it('executes an authenticated fixed access action through POST', async () => {
		PRIVATE_ENV.SPARK_BRIDGE_API_KEY = 'bridge-secret';
		runAccessExecutionActionMock.mockResolvedValueOnce({
			success: true,
			action: ACCESS_EXECUTION_ACTIONS.workspace_setup,
			result: {
				exitCode: 0,
				stdout: '{"ok":true}',
				stderr: '',
				durationMs: 8,
				payload: { ok: true }
			}
		});

		const response = await POST(
			routeEvent('http://127.0.0.1/api/access/execution-lanes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-api-key': 'bridge-secret' },
				body: JSON.stringify({ actionId: 'workspace_setup' })
			}) as never
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			success: true,
			action: {
				id: 'workspace_setup',
				displayCommand: 'spark access setup',
				runPolicy: 'auto_safe'
			},
			result: {
				exitCode: 0,
				payload: { ok: true }
			}
		});
		expect(runAccessExecutionActionMock).toHaveBeenCalledWith('workspace_setup', {
			confirmed: false,
			explicitOptIn: undefined
		});
	});

	it('requires control auth before running access actions', async () => {
		const response = await POST(
			routeEvent('http://127.0.0.1/api/access/execution-lanes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ actionId: 'workspace_setup' })
			}) as never
		);

		expect(response.status).toBe(401);
		expect(runAccessExecutionActionMock).not.toHaveBeenCalled();
	});

	it('returns policy errors without running confirmation-gated actions silently', async () => {
		PRIVATE_ENV.SPARK_BRIDGE_API_KEY = 'bridge-secret';
		runAccessExecutionActionMock.mockRejectedValueOnce(
			new AccessExecutionPolicyError(
				'Action docker_smoke requires confirmation: Run Docker sandbox test',
				ACCESS_EXECUTION_ACTIONS.docker_smoke
			)
		);

		const response = await POST(
			routeEvent('http://127.0.0.1/api/access/execution-lanes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-api-key': 'bridge-secret' },
				body: JSON.stringify({ actionId: 'docker_smoke' })
			}) as never
		);
		const body = await response.json();

		expect(response.status).toBe(428);
		expect(body).toMatchObject({
			success: false,
			confirmationRequired: true,
			action: {
				id: 'docker_smoke',
				runPolicy: 'confirm_once',
				confirmation: 'Run Docker sandbox test'
			}
		});
	});
});
