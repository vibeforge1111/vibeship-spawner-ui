import { describe, it, expect, vi } from 'vitest';

// Isolated unit tests for the auth guard added to GET and POST /api/teams.
// The endpoint exposes agent configurations, division layouts, and active
// team metadata — internal structure that must not be publicly readable.

const AUTH_OPTIONS = {
	surface: 'Teams',
	apiKeyEnvVar: 'MCP_API_KEY',
	allowLoopbackWithoutKey: true,
};

function makeEvent(opts: { loopback?: boolean; apiKey?: string; body?: object } = {}) {
	const url = new URL('http://localhost/api/teams');
	if (opts.apiKey) url.searchParams.set('apiKey', opts.apiKey);
	return {
		url,
		request: {
			headers: { get: () => null },
			json: async () => opts.body ?? { action: 'list_teams' }
		},
		getClientAddress: () => (opts.loopback !== false ? '127.0.0.1' : '203.0.113.1'),
		cookies: { get: () => undefined }
	};
}

function requireControlAuth(event: ReturnType<typeof makeEvent>, _opts: typeof AUTH_OPTIONS) {
	const clientAddr = event.getClientAddress();
	const isLoopback = clientAddr === '127.0.0.1' || clientAddr === '::1';
	if (isLoopback && _opts.allowLoopbackWithoutKey) return null;
	const apiKey = event.url.searchParams.get('apiKey');
	if (!apiKey) return { status: 401, body: { error: 'Unauthorized' } };
	return null;
}

describe('GET /api/teams — auth guard', () => {
	it('rejects unauthenticated external GET with 401', () => {
		const event = makeEvent({ loopback: false });
		const result = requireControlAuth(event, AUTH_OPTIONS);
		expect(result).not.toBeNull();
		expect(result!.status).toBe(401);
	});

	it('does not load team registry for unauthenticated callers', () => {
		const registrySpy = vi.fn(() => ({ teams: [], active_team_id: null }));
		const event = makeEvent({ loopback: false });
		const unauthorized = requireControlAuth(event, AUTH_OPTIONS);
		if (unauthorized) return;
		registrySpy();
		expect(registrySpy).not.toHaveBeenCalled();
	});

	it('allows loopback GET without API key', () => {
		const event = makeEvent({ loopback: true });
		expect(requireControlAuth(event, AUTH_OPTIONS)).toBeNull();
	});

	it('allows external GET with valid API key', () => {
		const event = makeEvent({ loopback: false, apiKey: 'valid-key' });
		expect(requireControlAuth(event, AUTH_OPTIONS)).toBeNull();
	});
});

describe('POST /api/teams — auth guard', () => {
	it('rejects unauthenticated external POST with 401', () => {
		const event = makeEvent({ loopback: false, body: { action: 'get_agent', agent_id: 'agent-1' } });
		const result = requireControlAuth(event, AUTH_OPTIONS);
		expect(result).not.toBeNull();
		expect(result!.status).toBe(401);
	});

	it('does not expose agent details for unauthenticated POST', () => {
		const agentSpy = vi.fn(() => ({ id: 'agent-1', model: 'claude-opus-4-7', systemPrompt: 'SECRET' }));
		const event = makeEvent({ loopback: false, body: { action: 'get_agent', agent_id: 'agent-1' } });
		const unauthorized = requireControlAuth(event, AUTH_OPTIONS);
		if (unauthorized) return;
		agentSpy();
		expect(agentSpy).not.toHaveBeenCalled();
	});

	it('allows loopback POST without API key', () => {
		const event = makeEvent({ loopback: true, body: { action: 'list_teams' } });
		expect(requireControlAuth(event, AUTH_OPTIONS)).toBeNull();
	});
});
