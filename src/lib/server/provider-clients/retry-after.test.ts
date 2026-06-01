import { describe, expect, it } from 'vitest';
import { parseRetryAfterMs } from './retry-after';

const fallbackMs = 1000;
const nowMs = Date.UTC(2026, 0, 1, 0, 0, 0);

describe('parseRetryAfterMs', () => {
	it('honors delta-seconds values', () => {
		expect(parseRetryAfterMs('0', fallbackMs, nowMs)).toBe(0);
		expect(parseRetryAfterMs('30', fallbackMs, nowMs)).toBe(30_000);
		expect(parseRetryAfterMs(' 60 ', fallbackMs, nowMs)).toBe(60_000);
	});

	it('honors HTTP-date values', () => {
		expect(parseRetryAfterMs('Thu, 01 Jan 2026 00:01:00 GMT', fallbackMs, nowMs)).toBe(60_000);
		expect(parseRetryAfterMs('Thu, 01 Jan 2026 00:00:00 GMT', fallbackMs, nowMs)).toBe(0);
		expect(parseRetryAfterMs('Wed, 31 Dec 2025 23:59:00 GMT', fallbackMs, nowMs)).toBe(0);
	});

	it('falls back on missing or unsupported forms', () => {
		expect(parseRetryAfterMs(null, fallbackMs, nowMs)).toBe(fallbackMs);
		expect(parseRetryAfterMs('', fallbackMs, nowMs)).toBe(fallbackMs);
		expect(parseRetryAfterMs('   ', fallbackMs, nowMs)).toBe(fallbackMs);
		expect(parseRetryAfterMs('30s', fallbackMs, nowMs)).toBe(fallbackMs);
		expect(parseRetryAfterMs('1.5', fallbackMs, nowMs)).toBe(fallbackMs);
		expect(parseRetryAfterMs('-100', fallbackMs, nowMs)).toBe(fallbackMs);
	});
});
