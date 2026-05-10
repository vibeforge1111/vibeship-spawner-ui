import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from './+server';

const originalBridgeKey = process.env.SPARK_BRIDGE_API_KEY;
const originalDockerAvailable = process.env.SPARK_DOCKER_AVAILABLE;

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
		}
	};
}

describe('/api/access/execution-lanes', () => {
	beforeEach(() => {
		process.env.SPARK_DOCKER_AVAILABLE = '0';
		delete process.env.SPARK_BRIDGE_API_KEY;
	});

	afterEach(() => {
		restoreEnv('SPARK_BRIDGE_API_KEY', originalBridgeKey);
		restoreEnv('SPARK_DOCKER_AVAILABLE', originalDockerAvailable);
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
					sparkCliAction: 'spark access setup sandbox'
				}
			}
		});
		expect(body.access.recommended.userMessage).toContain('safe Spark workspace');
		expect(body.access.recommended.workspaceRoot).toBeUndefined();
		expect(body.access.lanes.find((lane: { id: string }) => lane.id === 'spark_workspace').workspaceRoot).toBeUndefined();
		expect(body.access.recommended.userMessage).not.toMatch(/[A-Z]:\\|\/Users\/|\/home\//);
	});

	it('includes local workspace paths for existing authenticated control callers', async () => {
		process.env.SPARK_BRIDGE_API_KEY = 'bridge-secret';

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
			setupMode: 'blocked'
		});
	});
});
