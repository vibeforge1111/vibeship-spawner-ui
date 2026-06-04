import { json } from '@sveltejs/kit';
import { building } from '$app/environment';
import type { RequestHandler } from './$types';
import { requireControlAuth, enforceRateLimit } from '$lib/server/mcp-auth';
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  startScheduler,
  type ScheduleAction,
} from '$lib/server/scheduler';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

if (!building) {
  startScheduler();
}

export const GET: RequestHandler = async (event) => {
  const unauthorized = requireControlAuth(event);
  if (unauthorized) return unauthorized;
  enforceRateLimit(event);
  const schedules = await listSchedules();
  return json({ ok: true, schedules });
};

export const POST: RequestHandler = async (event) => {
  const unauthorized = requireControlAuth(event);
  if (unauthorized) return unauthorized;
  enforceRateLimit(event);
  const { request } = event;
  let body: Record<string, unknown>;
  try {
    body = asRecord(await request.json());
  } catch {
    return json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const action = String(body?.action || '').toLowerCase() as ScheduleAction;
  const cron = String(body?.cron || '').trim();
  const payload = asRecord(body.payload);
  const chatId = body?.chatId ? String(body.chatId) : null;
  const timezone = body?.timezone ? String(body.timezone) : null;
  if (!cron) return json({ ok: false, error: 'cron required' }, { status: 400 });
  if (action !== 'mission' && action !== 'loop') {
    return json({ ok: false, error: "action must be 'mission' or 'loop'" }, { status: 400 });
  }
  try {
    const record = await createSchedule({ cron, action, payload, chatId, timezone });
    return json({ ok: true, schedule: record });
  } catch (err: unknown) {
    return json({ ok: false, error: errorMessage(err, 'create failed') }, { status: 400 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const unauthorized = requireControlAuth(event);
  if (unauthorized) return unauthorized;
  enforceRateLimit(event);
  const { request, url } = event;
  const id = url.searchParams.get('id') || '';
  if (!id) {
    let body: Record<string, unknown> = {};
    try { body = asRecord(await request.json()); } catch {}
    const bodyId = body?.id ? String(body.id) : '';
    if (!bodyId) return json({ ok: false, error: 'id required' }, { status: 400 });
    const ok = await deleteSchedule(bodyId);
    return json({ ok, error: ok ? undefined : 'not found' });
  }
  const ok = await deleteSchedule(id);
  return json({ ok, error: ok ? undefined : 'not found' });
};
