import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { PRIVATE_ENV } = vi.hoisted(() => ({
	PRIVATE_ENV: {
		SPARK_BRIDGE_API_KEY: '',
		MCP_API_KEY: '',
		MCP_ALLOWED_ORIGINS: ''
	} as Record<string, string>
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

import { GET } from './+server';

const originalBridgeKey = process.env.SPARK_BRIDGE_API_KEY;
const originalStateDir = process.env.SPAWNER_STATE_DIR;
const originalSparkHome = process.env.SPARK_HOME;

function restoreEnv(name: string, value: string | undefined) {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

function routeEvent(url: string, init?: RequestInit, clientAddress = '127.0.0.1') {
	return {
		request: new Request(url, init),
		url: new URL(url),
		cookies: {
			get: () => undefined
		},
		getClientAddress: () => clientAddress
	};
}

describe('/api/system/state-root', () => {
	beforeEach(() => {
		PRIVATE_ENV.SPARK_BRIDGE_API_KEY = '';
		PRIVATE_ENV.MCP_API_KEY = '';
		PRIVATE_ENV.MCP_ALLOWED_ORIGINS = '';
		delete process.env.SPARK_BRIDGE_API_KEY;
		delete process.env.SPAWNER_STATE_DIR;
		delete process.env.SPARK_HOME;
	});

	afterEach(() => {
		restoreEnv('SPARK_BRIDGE_API_KEY', originalBridgeKey);
		restoreEnv('SPAWNER_STATE_DIR', originalStateDir);
		restoreEnv('SPARK_HOME', originalSparkHome);
	});

	it('returns metadata-only state-root audit evidence on loopback', async () => {
		process.env.SPAWNER_STATE_DIR = 'C:\\spark-state\\spawner-ui';

		const response = await GET(routeEvent('http://127.0.0.1/api/system/state-root') as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			ok: true,
			stateRoot: {
				schema_version: 'spark.spawner_state_root_audit.v1',
				base_state_dir: 'C:\\spark-state\\spawner-ui',
				state_dir: 'C:\\spark-state\\spawner-ui',
				configured_state_dir_present: true,
				spark_home_state_dir_present: false,
				fallback_used: false
			}
		});
		expect(body.stateRoot).not.toHaveProperty('prompt');
		expect(body.stateRoot).not.toHaveProperty('providerOutput');
		expect(body.stateRoot).not.toHaveProperty('chatId');
		expect(body.stateRoot).not.toHaveProperty('userId');
		expect(body.stateRoot.redaction).toContain('mission bodies');
		expect(body.stateRoot.archive_readiness.schema_version).toBe('spark.spawner_state_archive_readiness.v1');
		expect(body.stateRoot.archive_readiness.archive_candidate).toBe(false);
		expect(body.stateRoot.archive_readiness.blockers).toContain(
			'cwd_spawner_fallback_still_supported_by_state_helper'
		);
		expect(body.stateRoot.source_reference_audit.schema_version).toBe(
			'spark.spawner_state_source_reference_audit.v1'
		);
		expect(body.stateRoot.source_reference_audit).not.toHaveProperty('files');
		expect(body.stateRoot.source_reference_audit.redaction).toContain('file contents');
	});

	it('requires control auth outside loopback when a bridge key is configured', async () => {
		PRIVATE_ENV.SPARK_BRIDGE_API_KEY = 'bridge-secret';

		const response = await GET(
			routeEvent('https://example.com/api/system/state-root', undefined, '203.0.113.10') as never
		);

		expect(response.status).toBe(401);
	});

	it('accepts bridge auth outside loopback without widening to mutation', async () => {
		PRIVATE_ENV.SPARK_BRIDGE_API_KEY = 'bridge-secret';

		const response = await GET(
			routeEvent(
				'https://example.com/api/system/state-root',
				{ headers: { 'x-api-key': 'bridge-secret' } },
				'203.0.113.10'
			) as never
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.stateRoot.schema_version).toBe('spark.spawner_state_root_audit.v1');
	});
});
