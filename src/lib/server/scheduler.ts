import { logger } from '$lib/utils/logger';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { Cron } from 'croner';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { env as privateEnv } from '$env/dynamic/private';
import { resolveSparkRunProjectPath } from './spark-run-workspace';
import { spawnerStateDir } from './spawner-state';
import {
  assertNativeGovernorHarnessAuthority,
  buildServerGovernorDecisionAuthority,
  resolveExecutionAuthority,
  type HarnessAuthorityVerdict
} from './harness-authority';
import { parseJsonResponse, responseTextSnippet } from '$lib/services/http-response';
import { parseJsonOrFallback } from '$lib/utils/safe-json';

const execFileAsync = promisify(execFile);

function _envVar(name: string): string | undefined {
  const v = (privateEnv as Record<string, string | undefined>)[name];
  if (v && v.trim()) return v;
  const p = process.env[name];
  if (p && p.trim()) return p;
  return undefined;
}

function errorMessage(error: unknown, fallback = 'unknown'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function errorCode(error: unknown): string | null {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : null;
}

function redactSensitiveSnippet(text: string): string {
  return text
    .replace(/\b(Bearer\s+)[^\s]+/gi, '$1[redacted]')
    .replace(/\b(?:sk|gh[pousr]|xox[baprs])-[-_a-z0-9]{8,}\b/gi, '[redacted]');
}

const TICK_MS = 30_000;

function schedulesFile(): string {
  return path.resolve(spawnerStateDir(privateEnv), 'schedules.json');
}

export type ScheduleAction = 'mission' | 'loop';

export interface ScheduleRecord {
  id: string;
  cron: string;
  action: ScheduleAction;
  payload: Record<string, unknown>;
  chatId?: string | null;
  /** IANA timezone the cron fields are evaluated in (e.g. "Europe/Zurich"). Null = server/process timezone (legacy records). */
  timezone?: string | null;
  authority?: {
    source: HarnessAuthorityVerdict['source'];
    reasonCodes: string[];
    traceId?: string;
    origin?: string;
  };
  createdAt: string;
  lastFiredAt: string | null;
  nextFireAt: string | null;
  fireCount: number;
  lastStatus: string | null;
  enabled: boolean;
}

interface StoreShape {
  schedules: ScheduleRecord[];
}

let _store: StoreShape | null = null;
let _tickTimer: NodeJS.Timeout | null = null;
let _starting = false;

function _id(): string {
  return 'sched-' + randomBytes(4).toString('hex');
}

async function _load(): Promise<StoreShape> {
  if (_store) return _store;
  try {
    const raw = await fs.readFile(schedulesFile(), 'utf-8');
    const parsed = parseJsonOrFallback<Partial<StoreShape> | null>(raw, null, 'scheduler-state');
    if (parsed && Array.isArray(parsed.schedules)) {
      _store = { schedules: parsed.schedules };
      return _store;
    }
    await backupCorruptSchedulesFile('unexpected shape');
  } catch (err: unknown) {
    if (errorCode(err) !== 'ENOENT') {
      await backupCorruptSchedulesFile(errorMessage(err, String(err)));
    }
  }
  _store = { schedules: [] };
  return _store;
}

async function backupCorruptSchedulesFile(reason: string): Promise<void> {
  const file = schedulesFile();
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) return;
    const backupPath = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    await fs.copyFile(file, backupPath);
    logger.warn('[scheduler] schedules.json could not be loaded; backed up to', backupPath, 'reason', reason);
  } catch (backupError: unknown) {
    if (errorCode(backupError) !== 'ENOENT') {
      logger.warn('[scheduler] failed to back up schedules.json before reset', errorMessage(backupError));
    }
  }
}

async function _save(): Promise<void> {
  if (!_store) return;
  const file = schedulesFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(_store, null, 2), 'utf-8');
  try {
    await fs.rename(tmp, file);
  } catch (renameError) {
    try {
      await fs.copyFile(tmp, file);
      await fs.unlink(tmp);
    } catch (copyError) {
      logger.warn('[scheduler] failed to save schedules.json after rename fallback', errorMessage(copyError));
      throw renameError;
    }
  }
}

/** Returns the trimmed IANA timezone if it is valid, otherwise null. */
export function _validTimezone(tz: unknown): string | null {
  if (typeof tz !== 'string' || !tz.trim()) return null;
  const trimmed = tz.trim();
  try {
    // Throws RangeError for unknown time zones.
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * Next fire time for a cron expression. When `timezone` (an IANA zone) is given
 * the cron fields are evaluated in that zone; otherwise croner uses the server
 * process timezone. Exported for unit testing.
 */
export function _computeNext(cronExpr: string, timezone?: string | null): string | null {
  try {
    const options: { paused: true; timezone?: string } = { paused: true };
    if (timezone) options.timezone = timezone;
    const c = new Cron(cronExpr, options);
    const next = c.nextRun();
    c.stop();
    return next ? next.toISOString() : null;
  } catch {
    return null;
  }
}

export async function listSchedules(): Promise<ScheduleRecord[]> {
  const store = await _load();
  return store.schedules.map((s) => ({ ...s }));
}

export async function createSchedule(input: {
  cron: string;
  action: ScheduleAction;
  payload: Record<string, unknown>;
  chatId?: string | null;
  executionAuthority?: unknown;
  timezone?: string | null;
}): Promise<ScheduleRecord> {
  const store = await _load();
  const timezone = _validTimezone(input.timezone);
  const nextFireAt = _computeNext(input.cron, timezone);
  if (!nextFireAt) {
    throw new Error(`Invalid cron expression: ${input.cron}`);
  }
  const authority = assertNativeGovernorHarnessAuthority({
    authority: resolveExecutionAuthority(input.executionAuthority),
    toolName: 'spawner.schedule.create',
    ownerSystem: 'spawner-ui',
    mutationClass: 'creates_schedule'
  });
  const record: ScheduleRecord = {
    id: _id(),
    cron: input.cron,
    action: input.action,
    payload: input.payload,
    chatId: input.chatId ?? null,
    timezone,
    authority: {
      source: authority.source,
      reasonCodes: authority.reasonCodes,
      traceId: authority.traceId,
      origin: authority.origin
    },
    createdAt: new Date().toISOString(),
    lastFiredAt: null,
    nextFireAt,
    fireCount: 0,
    lastStatus: null,
    enabled: true,
  };
  store.schedules.push(record);
  await _save();
  return { ...record };
}

export async function deleteSchedule(input: string | { id: string; executionAuthority?: unknown }): Promise<boolean> {
  const id = typeof input === 'string' ? input : input.id;
  assertNativeGovernorHarnessAuthority({
    authority: resolveExecutionAuthority(typeof input === 'string' ? undefined : input.executionAuthority),
    toolName: 'spawner.schedule.delete',
    ownerSystem: 'spawner-ui',
    mutationClass: 'deletes_schedule'
  });
  const store = await _load();
  const before = store.schedules.length;
  store.schedules = store.schedules.filter((s) => s.id !== id);
  if (store.schedules.length === before) return false;
  await _save();
  return true;
}

async function _fire(record: ScheduleRecord): Promise<{ ok: boolean; summary: string }> {
  if (record.action === 'mission') {
    const goal = String(record.payload.goal ?? '');
    if (!goal) return { ok: false, summary: 'mission has no goal' };
    const requestId = `sched-${record.id}-${Date.now()}`;
    const baseUrl = (_envVar('SPAWNER_UI_URL') || 'http://127.0.0.1:3333').replace(/\/$/, '');
    const requestedProjectPath =
      typeof record.payload.projectPath === 'string' ? record.payload.projectPath : undefined;
    const executionAuthority = buildServerGovernorDecisionAuthority({
      source: `schedule:${record.id}`,
      reason: 'Authorized scheduled mission fire from a persisted Spawner schedule.',
      toolName: 'spawner.run',
      mutationClass: 'launches_mission',
      requestId,
      actorKind: 'system',
      actorIdRef: 'spawner-ui.scheduler',
      target: String(record.payload.goal ?? 'scheduled mission')
    });
    const res = await fetch(`${baseUrl}/api/spark/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal,
        chatId: String(record.chatId || 'scheduler'),
        userId: 'scheduler',
        requestId,
        projectPath: resolveSparkRunProjectPath(requestedProjectPath),
        executionAuthority,
      }),
    });
    if (!res.ok) {
      const detail = redactSensitiveSnippet(await responseTextSnippet(res, 200));
      return {
        ok: false,
        summary: `spark/run HTTP ${res.status}${detail ? `: ${detail}` : ''}`,
      };
    }
    const body = await parseJsonResponse<{ success?: boolean; missionId?: string; error?: string }>(res, {});
    return {
      ok: Boolean(body.success),
      summary: body.success ? `mission ${body.missionId}` : `error: ${body.error || 'unknown'}`,
    };
  }
  if (record.action === 'loop') {
    const chipKey = String(record.payload.chipKey ?? '');
    const rounds = Math.max(1, Number(record.payload.rounds ?? 2));
    if (!chipKey) return { ok: false, summary: 'loop has no chipKey' };
    const builderRepo =
      process.env.SPARK_BUILDER_REPO || path.resolve(process.cwd(), '..', 'spark-intelligence-builder');
    const home =
      process.env.SPARK_BUILDER_HOME || path.join(homedir(), '.spark', 'state', 'spark-intelligence');
    const python = process.env.SPARK_BUILDER_PYTHON || 'python';
    try {
      assertNativeGovernorHarnessAuthority({
        authority: buildServerGovernorDecisionAuthority({
          source: `schedule:${record.id}`,
          reason: 'Authorized scheduled loop fire from a persisted Spawner schedule.',
          toolName: 'spawner.scheduler.loop',
          mutationClass: 'launches_mission',
          requestId: `sched-loop-${record.id}-${Date.now()}`,
          actorKind: 'system',
          actorIdRef: 'spawner-ui.scheduler',
          target: chipKey
        }),
        toolName: 'spawner.scheduler.loop',
        ownerSystem: 'spawner-ui',
        mutationClass: 'launches_mission'
      });
      const { stdout } = await execFileAsync(python, [
        '-m',
        'spark_intelligence.cli',
        'loops',
        'run',
        '--home',
        home,
        '--chip',
        chipKey,
        '--rounds',
        String(rounds),
        '--json',
      ], {
        cwd: builderRepo,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        maxBuffer: 10 * 1024 * 1024,
        timeout: 900_000,
      });
      let parsed: { ok?: boolean; rounds_completed?: number; error?: string };
      try {
        parsed = JSON.parse(stdout) as { ok?: boolean; rounds_completed?: number; error?: string };
      } catch (parseError) {
        throw new Error(`subprocess returned non-JSON output (length=${stdout.length}): ${errorMessage(parseError)}`);
      }
      return {
        ok: Boolean(parsed.ok),
        summary: parsed.ok
          ? `loop ${chipKey} rounds=${parsed.rounds_completed}`
          : `loop error: ${parsed.error || 'unknown'}`,
      };
    } catch (err: unknown) {
      return { ok: false, summary: `loop exec failed: ${errorMessage(err)}` };
    }
  }
  return { ok: false, summary: `unknown action ${record.action}` };
}

async function _relayToTelegram(record: ScheduleRecord, result: { ok: boolean; summary: string }): Promise<void> {
  if (!record.chatId) {
    logger.info('[scheduler] relay skipped: no chatId on', record.id);
    return;
  }
  const token = _envVar('TELEGRAM_BOT_TOKEN') || _envVar('BOT_TOKEN');
  if (!token) {
    logger.info('[scheduler] relay skipped: no TELEGRAM_BOT_TOKEN or BOT_TOKEN in env');
    return;
  }
  const text = `[sched ${record.id}] ${record.action} ${result.ok ? 'ok' : 'fail'}\n${result.summary}`;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: record.chatId, text }),
    });
    const bodyText = await resp.text();
    if (resp.ok) {
      logger.info('[scheduler] relay', record.id, 'status', resp.status, 'body', bodyText.slice(0, 200));
    } else {
      logger.warn('[scheduler] relay', record.id, 'failed HTTP', resp.status, 'body', bodyText.slice(0, 200));
    }
  } catch (err: unknown) {
    logger.info('[scheduler] relay fetch error on', record.id, errorMessage(err, String(err)));
  }
}

async function _tick(): Promise<void> {
  const store = await _load();
  const now = new Date();
  let dirty = false;
  for (const rec of store.schedules) {
    if (!rec.enabled) continue;
    if (!rec.nextFireAt) {
      rec.nextFireAt = _computeNext(rec.cron, rec.timezone);
      dirty = true;
      continue;
    }
    if (new Date(rec.nextFireAt) > now) continue;
    const nextFireAt = _computeNext(rec.cron, rec.timezone);
    try {
      const result = await _fire(rec);
      rec.lastFiredAt = new Date().toISOString();
      rec.fireCount += 1;
      rec.lastStatus = (result.ok ? 'ok: ' : 'fail: ') + result.summary.slice(0, 200);
      await _relayToTelegram(rec, result);
    } catch (err: unknown) {
      rec.lastFiredAt = new Date().toISOString();
      rec.fireCount += 1;
      rec.lastStatus = 'crash: ' + errorMessage(err);
    }
    rec.nextFireAt = nextFireAt;
    dirty = true;
  }
  if (dirty) await _save();
}

export function startScheduler(): void {
  if (_tickTimer || _starting) return;
  _starting = true;
  _tick()
    .catch((err) => {
      logger.error('[scheduler] initial tick failed', errorMessage(err));
    })
    .finally(() => {
      _tickTimer = setInterval(() => {
        _tick().catch((err) => {
          logger.error('[scheduler] tick failed', errorMessage(err));
        });
      }, TICK_MS);
      _starting = false;
    });
}

export function stopScheduler(): void {
  if (_tickTimer) {
    clearInterval(_tickTimer);
    _tickTimer = null;
  }
}

export function resetSchedulerForTests(): void {
  stopScheduler();
  _store = null;
  _starting = false;
}

export async function runSchedulerTickForTests(): Promise<void> {
  await _tick();
}

export const _schedulerInternalsForTests = {
  fire: _fire,
  load: _load,
  tick: _tick,
  reset(): void {
    _store = null;
    stopScheduler();
  },
};
