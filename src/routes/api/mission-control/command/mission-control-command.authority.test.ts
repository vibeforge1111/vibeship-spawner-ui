import { describe, expect, it } from 'vitest';
import { POST } from './+server';
import { buildClientTurnIntentVNextAuthority } from '$lib/services/harness-authority-client';

function event(body: unknown) {
	return {
		request: new Request('http://127.0.0.1:3333/api/mission-control/command', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1:3333/api/mission-control/command'),
		getClientAddress: () => '127.0.0.1'
	};
}

describe('/api/mission-control/command authority contract', () => {
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
});
