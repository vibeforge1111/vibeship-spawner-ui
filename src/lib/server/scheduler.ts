import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Cron } from 'croner';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const SCHEDULES_FILE = path.resolve(process.cwd(), '.spawner', 'schedules.json');
const TICK_MS = 30_000;

export type ScheduleAction = 'mission' | 'loop';

export interface ScheduleRecord {
  id: string;
  cron: string;
  action: ScheduleAction;
  payload: Record<string, unknown>;
  chatId?: string | null;
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
    const raw = await fs.readFile(SCHEDULES_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.schedules)) {
      _store = { schedules: parsed.schedules };
      return _store;
    }
  } catch {
    // file missing or invalid - start fresh
  }
  _store = { schedules: [] };
  return _store;
}

async function _save(): Promise<void> {
  if (!_store) return;
  await fs.mkdir(path.dirname(SCHEDULES_FILE), { recursive: true });
  const tmp = SCHEDULES_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(_store, null, 2), 'utf-8');
  await fs.rename(tmp, SCHEDULES_FILE);
}

function _computeNext(cronExpr: string): string | null {
  try {
    const c = new Cron(cronExpr, { paused: true });
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
}): Promise<ScheduleRecord> {
  const store = await _load();
  const nextFireAt = _computeNext(input.cron);
  if (!nextFireAt) {
    throw new Error(`Invalid cron expression: ${input.cron}`);
  }
  const record: ScheduleRecord = {
    id: _id(),
    cron: input.cron,
    action: input.action,
    payload: input.payload,
    chatId: input.chatId ?? null,
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

export async function deleteSchedule(id: string): Promise<boolean> {
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
    const res = await fetch('http://127.0.0.1:4174/api/spark/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal,
        chatId: String(record.chatId || 'scheduler'),
        userId: 'scheduler',
        requestId,
        projectPath: 'C:/Users/USER/Desktop',
      }),
    });
    const body = (await res.json()) as { success?: boolean; missionId?: string; error?: string };
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
      process.env.SPARK_BUILDER_REPO || 'C:/Users/USER/Desktop/spark-intelligence-builder';
    const home =
      process.env.SPARK_BUILDER_HOME || path.join(builderRepo, '.tmp-home-live-telegram-real');
    const python = process.env.SPARK_BUILDER_PYTHON || 'python';
    const cmd = `"${python}" -m spark_intelligence.cli loops run --home "${home}" --chip "${chipKey}" --rounds ${rounds} --json`;
    try {
      const { stdout } = await execAsync(cmd, {
        cwd: builderRepo,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        maxBuffer: 10 * 1024 * 1024,
        timeout: 900_000,
      });
      const parsed = JSON.parse(stdout);
      return {
        ok: Boolean(parsed.ok),
        summary: parsed.ok
          ? `loop ${chipKey} rounds=${parsed.rounds_completed}`
          : `loop error: ${parsed.error || 'unknown'}`,
      };
    } catch (err: any) {
      return { ok: false, summary: `loop exec failed: ${err?.message || 'unknown'}` };
    }
  }
  return { ok: false, summary: `unknown action ${record.action}` };
}

async function _relayToTelegram(record: ScheduleRecord, result: { ok: boolean; summary: string }): Promise<void> {
  if (!record.chatId) return;
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  if (!token) return;
  const text = `[sched ${record.id}] ${record.action} ${result.ok ? 'ok' : 'fail'}\n${result.summary}`;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: record.chatId, text }),
    });
  } catch {
    // best-effort
  }
}

async function _tick(): Promise<void> {
  const store = await _load();
  const now = new Date();
  let dirty = false;
  for (const rec of store.schedules) {
    if (!rec.enabled) continue;
    if (!rec.nextFireAt) {
      rec.nextFireAt = _computeNext(rec.cron);
      dirty = true;
      continue;
    }
    if (new Date(rec.nextFireAt) > now) continue;
    try {
      const result = await _fire(rec);
      rec.lastFiredAt = new Date().toISOString();
      rec.fireCount += 1;
      rec.lastStatus = (result.ok ? 'ok: ' : 'fail: ') + result.summary.slice(0, 200);
      await _relayToTelegram(rec, result);
    } catch (err: any) {
      rec.lastFiredAt = new Date().toISOString();
      rec.lastStatus = 'crash: ' + (err?.message || 'unknown');
    }
    rec.nextFireAt = _computeNext(rec.cron);
    dirty = true;
  }
  if (dirty) await _save();
}

export function startScheduler(): void {
  if (_tickTimer || _starting) return;
  _starting = true;
  _tick()
    .catch(() => {})
    .finally(() => {
      _tickTimer = setInterval(() => {
        _tick().catch(() => {});
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
