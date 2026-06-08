import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from './+server';
import { buildClientTurnIntentVNextAuthority } from '$lib/services/harness-authority-client';

const TEST_API_KEY = 'mission-control-command-test-secret';
const originalMcpApiKey = process.env.MCP_API_KEY;

function restoreEnv(name: string, value: string | undefined) {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

function event(body: unknown) {
	return {
		request: new Request('http://127.0.0.1:3333/api/mission-control/command', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-api-key': TEST_API_KEY },
			body: JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1:3333/api/mission-control/command'),
		getClientAddress: () => '127.0.0.1'
	};
}

describe('/api/mission-control/command authority contract', () => {
	beforeEach(() => {
		process.env.MCP_API_KEY = TEST_API_KEY;
	});

	afterEach(() => {
		restoreEnv('MCP_API_KEY', originalMcpApiKey);
	});

	it('blocks mutating mission-control commands without Harness authority', async () => {
		const response = await POST(
			event({
				missionId: 'mission-command-route-no-authority',
				action: 'kill',
				source: 'route-test'
			}) as never
		);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.reasonCodes).toContain('missing_harness_authority');
	});

	it('blocks mutating mission-control commands with bare VNext authority', async () => {
		const response = await POST(
			event({
				missionId: 'mission-command-route-vnext-authority',
				action: 'kill',
				source: 'route-test',
				executionAuthority: buildClientTurnIntentVNextAuthority({
					source: 'route-test',
					reason: 'Route regression for strict Governor mission-control authority.',
					toolName: 'spawner.mission_control.command',
					mutationClass: 'controls_mission',
					target: 'mission-command-route-vnext-authority'
				})
			}) as never
		);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.source).toBe('turn_intent_vnext');
		expect(body.authority.reasonCodes).toContain('native_governor_required');
	});

	it('derives server Governor authority for authenticated Spawner UI mission-detail actions', async () => {
		const response = await POST(
			event({
				missionId: 'mission-command-route-ui-action',
				action: 'kill',
				source: 'mission-detail.kill'
			}) as never
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(body.error).toContain('was not found');
	});
});
