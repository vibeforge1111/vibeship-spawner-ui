import { describe, expect, it } from 'vitest';
import { parseRetryAfterMs as parseRetryAfterMsOpenAI } from './openai-compat-client';
import { parseRetryAfterMs as parseRetryAfterMsAnthropic } from './anthropic-client';

const FALLBACK_MS = 1000;

// Both provider clients carry an identical helper; the parametrised
// suite proves the suffix-trap and HTTP-date traps are closed in both.
describe.each([
	['openai-compat-client', parseRetryAfterMsOpenAI],
	['anthropic-client', parseRetryAfterMsAnthropic]
])('parseRetryAfterMs (%s)', (_label, parseRetryAfterMs) => {
	it('honours a clean non-negative delta-seconds integer (RFC 7231 form)', () => {
		expect(parseRetryAfterMs('30', FALLBACK_MS)).toBe(30_000);
		expect(parseRetryAfterMs('0', FALLBACK_MS)).toBe(0);
		expect(parseRetryAfterMs('120', FALLBACK_MS)).toBe(120_000);
		expect(parseRetryAfterMs('  60  ', FALLBACK_MS)).toBe(60_000); // trim
	});

	it('falls back to caller exponential backoff on RFC 7231 HTTP-date forms (suffix-trap closed)', () => {
		// HTTP-date is the second RFC 7231 form; the previous parseInt-based
		// parse silently yielded NaN, NaN * 1000 = NaN, setTimeout(NaN) -> 1
		// ms -- a tight-loop retry that storms the upstream provider.
		expect(parseRetryAfterMs('Fri, 31 Dec 2026 23:59:59 GMT', FALLBACK_MS)).toBe(FALLBACK_MS);
		expect(parseRetryAfterMs('Wed, 21 Oct 2026 07:28:00 GMT', FALLBACK_MS)).toBe(FALLBACK_MS);
	});

	it('falls back on suffixed and float forms (suffix-trap closed)', () => {
		// Some non-RFC providers emit '30s' or '5m'; previous parseInt would
		// strip the suffix and return 30 or 5 (30 ms / 5 ms total delay).
		expect(parseRetryAfterMs('30s', FALLBACK_MS)).toBe(FALLBACK_MS);
		expect(parseRetryAfterMs('5m', FALLBACK_MS)).toBe(FALLBACK_MS);
		expect(parseRetryAfterMs('1.5', FALLBACK_MS)).toBe(FALLBACK_MS);
		expect(parseRetryAfterMs('1e3', FALLBACK_MS)).toBe(FALLBACK_MS);
		expect(parseRetryAfterMs('-100', FALLBACK_MS)).toBe(FALLBACK_MS);
	});

	it('falls back on null, empty, and whitespace-only headers', () => {
		expect(parseRetryAfterMs(null, FALLBACK_MS)).toBe(FALLBACK_MS);
		expect(parseRetryAfterMs('', FALLBACK_MS)).toBe(FALLBACK_MS);
		expect(parseRetryAfterMs('   ', FALLBACK_MS)).toBe(FALLBACK_MS);
	});
});
