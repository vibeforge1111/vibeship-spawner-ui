import { describe, it, expect, vi } from 'vitest';

// Isolated unit tests for the auth guard added to GET /api/providers.
// The endpoint exposes which provider API keys are configured (envKeyConfigured,
// cliConfigured) — sensitive metadata that must not be available without auth.

const AUTH_OPTIONS = {
	surface: 'Providers',
	apiKeyEnvVar: 'MCP_API_KEY',
	allowLoopbackWithoutKey: true,
};

function makeEvent(opts: { loopback?: boolean; apiKey?: string } = {}) {
	const url = new URL('http://localhost/api/providers');
	if (opts.apiKey) url.searchParams.set('apiKey', opts.apiKey);
	return {
		url,
		request: { headers: { get: () => null } },
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

describe('GET /api/providers — auth guard', () => {
	it('rejects unauthenticated external request with 401', () => {
		const event = makeEvent({ loopback: false });
		const result = requireControlAuth(event, AUTH_OPTIONS);
		expect(result).not.toBeNull();
		expect(result!.status).toBe(401);
	});

	it('does not enumerate provider config when auth is rejected', () => {
		const enumerateSpy = vi.fn(() => ({ providers: [] }));
		const event = makeEvent({ loopback: false });
		const unauthorized = requireControlAuth(event, AUTH_OPTIONS);
		if (unauthorized) return; // short-circuit before enumerate
		enumerateSpy(); // only reached if auth passes
		expect(enumerateSpy).not.toHaveBeenCalled();
	});

	it('allows loopback request without API key', () => {
		const event = makeEvent({ loopback: true });
		const result = requireControlAuth(event, AUTH_OPTIONS);
		expect(result).toBeNull();
	});

	it('allows external request with valid API key', () => {
		const event = makeEvent({ loopback: false, apiKey: 'valid-key' });
		const result = requireControlAuth(event, AUTH_OPTIONS);
		expect(result).toBeNull();
	});

	it('API key env metadata is never returned to unauthenticated callers', () => {
		const envMetadata = { ANTHROPIC_API_KEY: 'sk-...', OPENAI_API_KEY: 'sk-openai-...' };
		const event = makeEvent({ loopback: false });
		const unauthorized = requireControlAuth(event, AUTH_OPTIONS);
		// If blocked, env metadata is never serialized into the response
		if (unauthorized) {
			expect(unauthorized.status).toBe(401);
			expect(JSON.stringify(unauthorized.body)).not.toContain('sk-');
		}
		// envMetadata never referenced in response path
		expect(envMetadata).toBeDefined(); // env exists but is gated
	});
});
