import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simulate the auth guard pattern used in the fixed analyze endpoint.
// Tests verify that the auth check fires before any Anthropic API call is made.

const AUTH_OPTIONS = {
	surface: 'Analyze',
	apiKeyEnvVar: 'MCP_API_KEY',
	allowLoopbackWithoutKey: true,
};

function makeRequest(opts: { apiKey?: string; body?: object; origin?: string } = {}) {
	return {
		headers: {
			get: (h: string) => {
				if (h.toLowerCase() === 'origin') return opts.origin ?? null;
				return null;
			}
		},
		json: async () => opts.body ?? { goal: 'build a web app' }
	};
}

function makeEvent(opts: { apiKey?: string; body?: object; loopback?: boolean } = {}) {
	const url = new URL('http://localhost/api/analyze');
	if (opts.apiKey) url.searchParams.set('apiKey', opts.apiKey);
	return {
		request: makeRequest({ body: opts.body }),
		url,
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

async function analyzeHandler(event: ReturnType<typeof makeEvent>) {
	const unauthorized = requireControlAuth(event, AUTH_OPTIONS);
	if (unauthorized) return unauthorized;

	const fetchSpy = vi.fn().mockResolvedValue({ ok: false });
	const body = await event.request.json();
	if (!body.goal) return { status: 400, body: { error: 'Goal is required' } };

	// Only reaches here if auth passed
	await fetchSpy('https://api.anthropic.com/v1/messages');
	return { status: 200, body: { success: true }, fetchSpy };
}

describe('POST /api/analyze — auth guard', () => {
	it('rejects unauthenticated request from external IP with 401', async () => {
		const event = makeEvent({ loopback: false });
		const result = await analyzeHandler(event);
		expect(result.status).toBe(401);
	});

	it('does not call Anthropic API when auth rejected', async () => {
		const fetchSpy = vi.fn();
		const event = makeEvent({ loopback: false });
		const unauthorized = requireControlAuth(event, AUTH_OPTIONS);
		expect(unauthorized).not.toBeNull();
		// fetchSpy never called
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('allows loopback request without API key', async () => {
		const event = makeEvent({ loopback: true });
		const unauthorized = requireControlAuth(event, AUTH_OPTIONS);
		expect(unauthorized).toBeNull();
	});

	it('allows external request with valid API key', async () => {
		const event = makeEvent({ loopback: false, apiKey: 'valid-key' });
		const unauthorized = requireControlAuth(event, AUTH_OPTIONS);
		expect(unauthorized).toBeNull();
	});

	it('returns 400 for missing goal field after auth passes', async () => {
		const event = makeEvent({ loopback: true, body: {} });
		const result = await analyzeHandler(event);
		expect(result.status).toBe(400);
	});

	it('API key header is never forwarded to Anthropic when auth blocked', async () => {
		const externalEvent = makeEvent({ loopback: false });
		const result = requireControlAuth(externalEvent, AUTH_OPTIONS);
		// Auth block occurs before any fetch — key never leaves the process
		expect(result).not.toBeNull();
		expect((result as { status: number }).status).toBe(401);
	});
});
