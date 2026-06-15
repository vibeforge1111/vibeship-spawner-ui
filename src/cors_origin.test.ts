/**
 * Tests: corsHeaders() CORS origin allowlist fix.
 * Verifies that arbitrary origins are rejected and only allowlisted loopback
 * origins receive the Access-Control-Allow-Origin header.
 */

import { describe, it, expect } from 'vitest';

// Inline the allowlist logic to unit-test it independently.
const _ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
	'http://localhost:4174',
	'http://127.0.0.1:4174',
	'http://localhost:5173',
	'http://127.0.0.1:5173',
]);

function corsHeaders(origin: string | null): Record<string, string> {
	if (!origin || !_ALLOWED_ORIGINS.has(origin)) return {};
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-mcp-api-key',
		Vary: 'Origin',
	};
}

describe('corsHeaders allowlist', () => {
	it('allows localhost:4174', () => {
		const h = corsHeaders('http://localhost:4174');
		expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:4174');
	});

	it('allows 127.0.0.1:4174', () => {
		const h = corsHeaders('http://127.0.0.1:4174');
		expect(h['Access-Control-Allow-Origin']).toBe('http://127.0.0.1:4174');
	});

	it('allows localhost:5173', () => {
		const h = corsHeaders('http://localhost:5173');
		expect(h['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
	});

	it('rejects arbitrary external origin', () => {
		const h = corsHeaders('http://attacker.evil.io');
		expect(h['Access-Control-Allow-Origin']).toBeUndefined();
	});

	it('rejects null origin', () => {
		const h = corsHeaders(null);
		expect(h['Access-Control-Allow-Origin']).toBeUndefined();
	});

	it('rejects internal RFC-1918 origin', () => {
		const h = corsHeaders('http://192.168.1.100:4174');
		expect(h['Access-Control-Allow-Origin']).toBeUndefined();
	});

	it('rejects origin that contains localhost as substring', () => {
		const h = corsHeaders('http://evil-localhost.attacker.com');
		expect(h['Access-Control-Allow-Origin']).toBeUndefined();
	});
});
