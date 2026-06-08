import { json, type RequestEvent } from '@sveltejs/kit';
import { building } from '$app/environment';
import type { RequestHandler } from './$types';
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  startScheduler,
  type ScheduleAction,
} from '$lib/server/scheduler';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { HarnessAuthorityError, buildServerGovernorDecisionAuthority } from '$lib/server/harness-authority';

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

function scheduledAuth(event: RequestEvent) {
  return requireControlAuth(event, {
    surface: 'Scheduled',
    apiKeyEnvVar: 'EVENTS_API_KEY',
    fallbackApiKeyEnvVar: 'MCP_API_KEY',
    apiKeyQueryParam: 'apiKey',
    apiKeyCookieName: 'spawner_events_api_key',
    allowLoopbackWithoutKey: false,
    allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
  });
}

export const GET: RequestHandler = async (event) => {
  const unauthorized = scheduledAuth(event);
  if (unauthorized) return unauthorized;
  const schedules = await listSchedules();
  return json({ ok: true, schedules });
};

export const POST: RequestHandler = async (event) => {
  const unauthorized = scheduledAuth(event);
  if (unauthorized) return unauthorized;
  const rateLimited = enforceRateLimit(event, {
    scope: 'scheduled_create',
    limit: 60,
    windowMs: 60_000
  });
  if (rateLimited) return rateLimited;

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
  const source = body?.source ? String(body.source).trim() : '';
  if (!cron) return json({ ok: false, error: 'cron required' }, { status: 400 });
  if (action !== 'mission' && action !== 'loop') {
    return json({ ok: false, error: "action must be 'mission' or 'loop'" }, { status: 400 });
  }
  try {
    const executionAuthority = body.executionAuthority ?? (
      source === 'mission-board.schedule.create'
        ? buildServerGovernorDecisionAuthority({
            source,
            reason: 'Authenticated Spawner UI schedule creation action.',
            toolName: 'spawner.schedule.create',
            mutationClass: 'creates_schedule',
            target: action,
            requestId: `spawner-ui-schedule-create-${action}`
          })
        : undefined
    );
    const record = await createSchedule({ cron, action, payload, chatId, timezone, executionAuthority });
    return json({ ok: true, schedule: record });
  } catch (err: unknown) {
    if (err instanceof HarnessAuthorityError) {
      return json({ ok: false, error: err.message, code: err.code, authority: err.verdict }, { status: err.status });
    }
    return json({ ok: false, error: errorMessage(err, 'create failed') }, { status: 400 });
  }
};

export const DELETE: RequestHandler = async (event) => {
  const unauthorized = scheduledAuth(event);
  if (unauthorized) return unauthorized;
  const rateLimited = enforceRateLimit(event, {
    scope: 'scheduled_delete',
    limit: 60,
    windowMs: 60_000
  });
  if (rateLimited) return rateLimited;

  const { request, url } = event;
  let body: Record<string, unknown> = {};
  try { body = asRecord(await request.json()); } catch {}
  const id = url.searchParams.get('id') || (body?.id ? String(body.id) : '');
  if (!id) return json({ ok: false, error: 'id required' }, { status: 400 });
  try {
    const source = body?.source ? String(body.source).trim() : '';
    const executionAuthority = body.executionAuthority ?? (
      source === 'mission-board.schedule.delete'
        ? buildServerGovernorDecisionAuthority({
            source,
            reason: 'Authenticated Spawner UI schedule deletion action.',
            toolName: 'spawner.schedule.delete',
            mutationClass: 'deletes_schedule',
            target: id,
            requestId: `spawner-ui-schedule-delete-${id}`
          })
        : undefined
    );
    const ok = await deleteSchedule({ id, executionAuthority });
    return json({ ok, error: ok ? undefined : 'not found' });
  } catch (err: unknown) {
    if (err instanceof HarnessAuthorityError) {
      return json({ ok: false, error: err.message, code: err.code, authority: err.verdict }, { status: err.status });
    }
    return json({ ok: false, error: errorMessage(err, 'delete failed') }, { status: 400 });
  }
};
