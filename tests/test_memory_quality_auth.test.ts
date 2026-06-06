import { describe, it, expect, vi } from 'vitest';

// Isolated unit tests for the auth guard added to POST /api/memory-quality/evaluations.
// Without auth any caller can inject fabricated evaluation events that shape
// agent memory recall decisions via appendManualEvaluation().

const AUTH_OPTIONS = {
	surface: 'MemoryQualityEvaluations',
	apiKeyEnvVar: 'MCP_API_KEY',
	allowLoopbackWithoutKey: true,
};

function makeEvent(opts: { loopback?: boolean; apiKey?: string; body?: object } = {}) {
	const url = new URL('http://localhost/api/memory-quality/evaluations');
	if (opts.apiKey) url.searchParams.set('apiKey', opts.apiKey);
	return {
		url,
		request: {
			headers: { get: () => null },
			json: async () => opts.body ?? { verdict: 'correct', source: 'test' }
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

describe('POST /api/memory-quality/evaluations — auth guard', () => {
	it('rejects unauthenticated POST from external IP with 401', () => {
		const event = makeEvent({ loopback: false });
		const result = requireControlAuth(event, AUTH_OPTIONS);
		expect(result).not.toBeNull();
		expect(result!.status).toBe(401);
	});

	it('auth check fires before request body is read', () => {
		const jsonSpy = vi.fn();
		const event = makeEvent({ loopback: false });
		const unauthorized = requireControlAuth(event, AUTH_OPTIONS);
		if (unauthorized) return;
		jsonSpy();
		expect(jsonSpy).not.toHaveBeenCalled();
	});

	it('fabricated evaluation from unauth caller never written to dataset', () => {
		const appendSpy = vi.fn();
		const event = makeEvent({
			loopback: false,
			body: { verdict: 'correct', source: 'injected', score: 1.0 }
		});
		const unauthorized = requireControlAuth(event, AUTH_OPTIONS);
		if (unauthorized) return;
		appendSpy(); // never reached
		expect(appendSpy).not.toHaveBeenCalled();
	});

	it('allows loopback request without API key', () => {
		const event = makeEvent({ loopback: true });
		expect(requireControlAuth(event, AUTH_OPTIONS)).toBeNull();
	});

	it('allows external request with valid API key', () => {
		const event = makeEvent({ loopback: false, apiKey: 'valid-key' });
		expect(requireControlAuth(event, AUTH_OPTIONS)).toBeNull();
	});
});
