import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { POST } from './+server';
import { HarnessAuthorityError } from '$lib/server/harness-authority';

vi.mock('$lib/services/mcp/client', () => ({
	callTool: vi.fn(),
	isConnected: vi.fn()
}));

vi.mock('$lib/server/mcp-auth', () => ({
	requireMcpAuth: vi.fn()
}));

vi.mock('$lib/server/harness-authority', () => ({
	HarnessAuthorityError: class HarnessAuthorityError extends Error {
		constructor(
			message: string,
			public code: string,
			public status: number,
			public verdict: Record<string, unknown>
		) {
			super(message);
			this.name = 'HarnessAuthorityError';
		}
	},
	assertNativeGovernorHarnessAuthority: vi.fn(),
	resolveExecutionAuthority: vi.fn()
}));

import { requireMcpAuth } from '$lib/server/mcp-auth';
import { callTool, isConnected } from '$lib/services/mcp/client';
import { assertNativeGovernorHarnessAuthority } from '$lib/server/harness-authority';

function makeRequest(body: string | undefined, contentType = 'application/json'): Request {
	const init: RequestInit = { method: 'POST' };
	if (body !== undefined) {
		init.headers = { 'content-type': contentType };
		init.body = body;
	}
	return new Request('http://localhost/api/mcp/call', init);
}

function makeEvent(body: string | undefined) {
	return {
		request: makeRequest(body),
		url: new URL('http://localhost/api/mcp/call'),
		params: {},
		cookies: {} as never,
		fetch: globalThis.fetch,
		getClientAddress: () => '127.0.0.1',
		locals: {} as never,
		platform: {} as never,
		routeId: '/api/mcp/call',
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false
	} as unknown as Parameters<typeof POST>[0];
}

describe('POST /api/mcp/call — empty body handling', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(requireMcpAuth).mockReturnValue(null);
		vi.mocked(isConnected).mockReturnValue(true);
		vi.mocked(assertNativeGovernorHarnessAuthority).mockReturnValue({
			allowed: true,
			source: 'test',
			traceId: 't-1',
			governorOutcome: 'pass'
		});
		vi.mocked(callTool).mockResolvedValue({ ok: true });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns 400 Invalid JSON body for empty POST', async () => {
		const res = await POST(makeEvent(''));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toEqual({ error: 'Invalid JSON body' });
	});

	it('returns 400 Invalid JSON body for malformed JSON', async () => {
		const res = await POST(makeEvent('{"instanceId":'));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toEqual({ error: 'Invalid JSON body' });
	});

	it('returns 400 for JSON that is not an object (array)', async () => {
		const res = await POST(makeEvent('[1,2,3]'));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toEqual({ error: 'Invalid JSON body' });
	});

	it('returns 400 for plain string body', async () => {
		const res = await POST(makeEvent('hello'));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toEqual({ error: 'Invalid JSON body' });
	});

	it('does NOT leak raw SyntaxError message to client', async () => {
		const res = await POST(makeEvent(''));
		const text = await res.text();
		expect(text).not.toContain('Unexpected end of JSON input');
		expect(text).not.toContain('SyntaxError');
	});

	it('still returns 500 with sanitized message for non-SyntaxError tool failures', async () => {
		vi.mocked(callTool).mockRejectedValue(new Error('backend exploded'));
		const res = await POST(makeEvent('{"instanceId":"i1","toolName":"t1"}'));
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body).toEqual({ error: 'Tool call failed' });
		expect(JSON.stringify(body)).not.toContain('backend exploded');
	});

	it('still returns 400 instanceId for valid JSON missing fields', async () => {
		const res = await POST(makeEvent('{}'));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body).toEqual({ error: 'instanceId is required' });
	});

	it('preserves HarnessAuthorityError path (status from error)', async () => {
		vi.mocked(assertNativeGovernorHarnessAuthority).mockImplementation(() => {
			throw new HarnessAuthorityError('blocked', 'BLOCK', 403, { blocked: true });
		});
		const res = await POST(makeEvent('{"instanceId":"i1","toolName":"t1"}'));
		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.error).toBe('blocked');
		expect(body.code).toBe('BLOCK');
	});
});
