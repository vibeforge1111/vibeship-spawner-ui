import { json } from '@sveltejs/kit';
import { building } from '$app/environment';
import type { RequestHandler } from './$types';
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  startScheduler,
  type ScheduleAction,
} from '$lib/server/scheduler';
import { HarnessAuthorityError } from '$lib/server/harness-authority';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

if (!building && process.env.NODE_ENV !== 'test') {
  startScheduler();
}

export const GET: RequestHandler = async () => {
  const schedules = await listSchedules();
  return json({ ok: true, schedules });
};

export const POST: RequestHandler = async ({ request }) => {
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
  if (!cron) return json({ ok: false, error: 'cron required' }, { status: 400 });
  if (action !== 'mission' && action !== 'loop') {
    return json({ ok: false, error: "action must be 'mission' or 'loop'" }, { status: 400 });
  }
  try {
    const record = await createSchedule({ cron, action, payload, chatId, executionAuthority: body.executionAuthority });
    return json({ ok: true, schedule: record });
  } catch (err: unknown) {
    if (err instanceof HarnessAuthorityError) {
      return json({ ok: false, error: err.message, code: err.code, authority: err.verdict }, { status: err.status });
    }
    return json({ ok: false, error: errorMessage(err, 'create failed') }, { status: 400 });
  }
};

export const DELETE: RequestHandler = async ({ request, url }) => {
  let body: Record<string, unknown> = {};
  try { body = asRecord(await request.json()); } catch {}
  const id = url.searchParams.get('id') || (body?.id ? String(body.id) : '');
  if (!id) return json({ ok: false, error: 'id required' }, { status: 400 });
  try {
    const ok = await deleteSchedule({ id, executionAuthority: body.executionAuthority });
    return json({ ok, error: ok ? undefined : 'not found' });
  } catch (err: unknown) {
    if (err instanceof HarnessAuthorityError) {
      return json({ ok: false, error: err.message, code: err.code, authority: err.verdict }, { status: err.status });
    }
    return json({ ok: false, error: errorMessage(err, 'delete failed') }, { status: 400 });
  }
};
