import { describe, expect, it } from 'vitest';
import { POST } from './+server';

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
});
