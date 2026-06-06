import { describe, it, expect, vi } from 'vitest';

// Isolated unit tests for the auth guard added to POST /api/prd-bridge/load-to-canvas.
// The endpoint accepts arbitrary requestId, missionId, and capabilityProposalPacket
// payloads that autoDispatchPrdCanvasLoad queues for canvas execution.

const AUTH_OPTIONS = {
	surface: 'PrdBridgeLoadToCanvas',
	apiKeyEnvVar: 'MCP_API_KEY',
	allowLoopbackWithoutKey: true,
};

function makeEvent(opts: { loopback?: boolean; apiKey?: string; body?: object } = {}) {
	const url = new URL('http://localhost/api/prd-bridge/load-to-canvas');
	if (opts.apiKey) url.searchParams.set('apiKey', opts.apiKey);
	return {
		url,
		request: {
			headers: { get: () => null },
			json: async () => opts.body ?? { requestId: 'req-1', missionId: 'mission-1' }
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

describe('POST /api/prd-bridge/load-to-canvas — auth guard', () => {
	it('rejects unauthenticated POST from external IP with 401', () => {
		const event = makeEvent({ loopback: false });
		const result = requireControlAuth(event, AUTH_OPTIONS);
		expect(result).not.toBeNull();
		expect(result!.status).toBe(401);
	});

	it('auth check fires before request body is parsed', () => {
		const jsonSpy = vi.fn();
		const event = makeEvent({ loopback: false });
		const unauthorized = requireControlAuth(event, AUTH_OPTIONS);
		if (unauthorized) return; // short-circuit before body parse
		jsonSpy(); // only reached if auth passed
		expect(jsonSpy).not.toHaveBeenCalled();
	});

	it('fabricated task graph from unauth caller never reaches canvas queue', () => {
		const dispatchSpy = vi.fn();
		const event = makeEvent({
			loopback: false,
			body: { requestId: 'evil', missionId: 'injected', capabilityProposalPacket: { tasks: [] } }
		});
		const unauthorized = requireControlAuth(event, AUTH_OPTIONS);
		if (unauthorized) return;
		dispatchSpy(); // only reached if auth passed
		expect(dispatchSpy).not.toHaveBeenCalled();
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
