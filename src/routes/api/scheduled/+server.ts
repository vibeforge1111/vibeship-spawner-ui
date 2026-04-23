import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  startScheduler,
  type ScheduleAction,
} from '$lib/server/scheduler';

startScheduler();

export const GET: RequestHandler = async () => {
  const schedules = await listSchedules();
  return json({ ok: true, schedules });
};

export const POST: RequestHandler = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const action = String(body?.action || '').toLowerCase() as ScheduleAction;
  const cron = String(body?.cron || '').trim();
  const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};
  const chatId = body?.chatId ? String(body.chatId) : null;
  if (!cron) return json({ ok: false, error: 'cron required' }, { status: 400 });
  if (action !== 'mission' && action !== 'loop') {
    return json({ ok: false, error: "action must be 'mission' or 'loop'" }, { status: 400 });
  }
  try {
    const record = await createSchedule({ cron, action, payload, chatId });
    return json({ ok: true, schedule: record });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || 'create failed' }, { status: 400 });
  }
};

export const DELETE: RequestHandler = async ({ request, url }) => {
  const id = url.searchParams.get('id') || '';
  if (!id) {
    let body: any = {};
    try { body = await request.json(); } catch {}
    const bodyId = body?.id ? String(body.id) : '';
    if (!bodyId) return json({ ok: false, error: 'id required' }, { status: 400 });
    const ok = await deleteSchedule(bodyId);
    return json({ ok, error: ok ? undefined : 'not found' });
  }
  const ok = await deleteSchedule(id);
  return json({ ok, error: ok ? undefined : 'not found' });
};
