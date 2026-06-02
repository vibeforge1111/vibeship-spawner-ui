import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _computeNext, _schedulerInternalsForTests, _validTimezone, listSchedules } from './scheduler';

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

const originalSpawnerStateDir = process.env.SPAWNER_STATE_DIR;
const originalSpawnerUiUrl = process.env.SPAWNER_UI_URL;
let tempDirs: string[] = [];

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function tempStateDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'spawner-scheduler-'));
  tempDirs.push(dir);
  process.env.SPAWNER_STATE_DIR = dir;
  _schedulerInternalsForTests.reset();
  return dir;
}

function record(overrides: Partial<Parameters<typeof _schedulerInternalsForTests.fire>[0]> = {}): Parameters<typeof _schedulerInternalsForTests.fire>[0] {
  return {
    id: 'sched-test',
    cron: '* * * * *',
    action: 'mission',
    payload: { goal: 'run a scheduled mission' },
    chatId: null,
    timezone: null,
    createdAt: new Date().toISOString(),
    lastFiredAt: null,
    nextFireAt: new Date(Date.now() - 60_000).toISOString(),
    fireCount: 0,
    lastStatus: null,
    enabled: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  restoreEnv('SPAWNER_STATE_DIR', originalSpawnerStateDir);
  restoreEnv('SPAWNER_UI_URL', originalSpawnerUiUrl);
  _schedulerInternalsForTests.reset();
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

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

describe('scheduler reliability guards', () => {
  it('backs up corrupt schedules before resetting the in-memory store', async () => {
    const dir = await tempStateDir();
    await writeFile(path.join(dir, 'schedules.json'), '{bad json', 'utf-8');

    await expect(listSchedules()).resolves.toEqual([]);

    const backups = (await readdir(dir)).filter((file) => file.startsWith('schedules.json.corrupt-'));
    expect(backups).toHaveLength(1);
    await expect(readFile(path.join(dir, backups[0]), 'utf-8')).resolves.toBe('{bad json');
  });

  it('surfaces bounded HTTP status details for scheduled mission fires', async () => {
    process.env.SPAWNER_UI_URL = 'http://scheduler.test';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream failed Bearer placeholder-token-value', { status: 502 })));

    const result = await _schedulerInternalsForTests.fire(record());

    expect(result.ok).toBe(false);
    expect(result.summary).toContain('spark/run HTTP 502');
    expect(result.summary).toContain('[redacted]');
    expect(result.summary).not.toContain('placeholder-token-value');
  });

  it('continues with an error summary when scheduled mission success responses are not JSON', async () => {
    process.env.SPAWNER_UI_URL = 'http://scheduler.test';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not-json', { status: 200 })));

    await expect(_schedulerInternalsForTests.fire(record())).resolves.toEqual({
      ok: false,
      summary: 'error: unknown',
    });
  });

  it('increments fireCount and persists crash status when a tick fire throws', async () => {
    const dir = await tempStateDir();
    await writeFile(
      path.join(dir, 'schedules.json'),
      JSON.stringify({ schedules: [record()] }, null, 2),
      'utf-8'
    );
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));

    await _schedulerInternalsForTests.tick();

    const [saved] = await listSchedules();
    expect(saved.fireCount).toBe(1);
    expect(saved.lastStatus).toBe('crash: network down');
    expect(saved.nextFireAt).toBeTruthy();
  });
});
