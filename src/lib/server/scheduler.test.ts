import { describe, expect, it } from 'vitest';
import { _computeNext, _validTimezone } from './scheduler';

// Regression test for the scheduled-mission timezone mismatch: _computeNext built
// `new Cron(cron, { paused: true })` with no timezone, so cron fields were
// evaluated in the SERVER process timezone (UTC on Railway/Docker) while the
// Kanban UI labels schedules "(in your timezone, <browser tz>)". Now the
// operator's IANA timezone is threaded through so the fire time matches the
// label. These tests fail on the pre-fix code (timezone ignored) and pass after.

function hourInZone(tz: string, iso: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date(iso));
  return Number(parts.find((p) => p.type === 'hour')?.value);
}

describe('_computeNext timezone handling', () => {
  it('evaluates cron fields in the supplied IANA timezone', () => {
    const iso = _computeNext('0 9 * * *', 'America/New_York');
    expect(iso).toBeTruthy();
    // "0 9 * * *" must fire at 09:00 wall-clock in the requested zone.
    expect(hourInZone('America/New_York', iso as string)).toBe(9);
  });

  it('produces different fire instants for the same cron in different timezones', () => {
    // Pre-fix the timezone arg was ignored, so both evaluated in the process
    // timezone and were identical. After the fix they must differ.
    const ny = _computeNext('0 9 * * *', 'America/New_York');
    const tokyo = _computeNext('0 9 * * *', 'Asia/Tokyo');
    expect(ny).toBeTruthy();
    expect(tokyo).toBeTruthy();
    expect(ny).not.toBe(tokyo);
  });

  it('still works with no timezone (process timezone) and rejects invalid zones', () => {
    expect(_computeNext('0 9 * * *')).toBeTruthy();
    expect(_validTimezone('Europe/Zurich')).toBe('Europe/Zurich');
    expect(_validTimezone('  Asia/Tokyo  ')).toBe('Asia/Tokyo');
    expect(_validTimezone('Not/AZone')).toBeNull();
    expect(_validTimezone('')).toBeNull();
    expect(_validTimezone(undefined)).toBeNull();
  });
});
