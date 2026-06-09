import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from './+server';

const TEST_API_KEY = 'mission-control-discord-command-test-secret';
const originalMcpApiKey = process.env.MCP_API_KEY;

function restoreEnv(name: string, value: string | undefined) {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

function event(body: unknown) {
	return {
		request: new Request('http://127.0.0.1:3333/api/mission-control/discord-command', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-api-key': TEST_API_KEY },
			body: JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1:3333/api/mission-control/discord-command'),
		getClientAddress: () => '127.0.0.1'
	};
}

describe('/api/mission-control/discord-command truthfulness', () => {
	beforeEach(() => {
		process.env.MCP_API_KEY = TEST_API_KEY;
	});

	afterEach(() => {
		restoreEnv('MCP_API_KEY', originalMcpApiKey);
	});

	it('does not wrap missing mission status as an executed command', async () => {
		const response = await POST(
			event({
				text: 'mission status mission-discord-command-missing',
				source: 'discord-command-route-test'
			}) as never
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(body.result.ok).toBe(false);
		expect(body.reply).toContain('Could not status mission-discord-command-missing');
		expect(body.reply).not.toMatch(/executed|accepted/i);
	});

	it('keeps parse failures explicit', async () => {
		const response = await POST(
			event({
				text: 'pause mission-discord-command-missing',
				source: 'discord-command-route-test'
			}) as never
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(body.error).toBe('Command must start with "mission".');
		expect(body.help).toBe('Use: mission <status|pause|resume|kill> <missionId>');
	});
});
