# Kanban Scheduler — Handoff for Tomorrow

**Status:** planned, not implemented. Deferred from the phase-2 session on 2026-04-21.

This doc captures the agreed design so tomorrow's work can pick up without re-litigating decisions.

---

## 1. What this adds

A **Scheduled** tab on `/kanban` that runs recurring missions on a cadence. Cards created by scheduled runs appear on the main **Board** tab like any other mission — this tab is only for managing *templates* (what to run, how often, whether it's on).

The Scheduled pane already exists as a placeholder at `src/routes/kanban/+page.svelte` — the copy there is the anchor for what's coming.

---

## 2. Model (keep tight)

```ts
type Schedule = {
  id: string;              // uuid
  name: string;            // display label
  goal: string;            // mission goal, sent as the `goal` field on /api/spark/run
  intervalMinutes: number; // fire every N minutes. Start here; cron strings later.
  providers?: string[];    // optional subset of spark providers
  active: boolean;         // pause without deleting
  createdAt: string;
  lastRunAt: string | null;
  lastMissionId: string | null;
  runCount: number;
};
```

**Why interval-minutes, not cron:** cron is a dependency + mental-model cost we don't need for v1. 90% of "every 15 min", "hourly", "daily" intents are covered by an integer. Add a raw-cron field later if needed.

---

## 3. Storage

`.spawner/schedules.json` — array of Schedule. Matches the existing pending-prd.md / pending-load.json pattern already in this repo (see `src/routes/api/prd-bridge/`).

---

## 4. API surface

| Route | Verb | Behavior |
|---|---|---|
| `/api/schedules` | GET | list all |
| `/api/schedules` | POST | create (body: name, goal, intervalMinutes, providers?) |
| `/api/schedules/[id]` | DELETE | remove |
| `/api/schedules/[id]/pause` | POST | set `active = false` |
| `/api/schedules/[id]/resume` | POST | set `active = true` |
| `/api/schedules/[id]/run` | POST | fire immediately (ignores due check) |
| `/api/schedules/tick` | POST | iterate all active schedules, fire every one where `lastRunAt + intervalMinutes*60_000 <= now` |

All routes use the same `requireControlAuth` + `allowLoopbackWithoutKey` pattern as `/api/spark/run`.

---

## 5. Firing a schedule

Each fire is a thin wrapper around the existing `/api/spark/run`:

```ts
POST /api/spark/run {
  goal: schedule.goal,
  providers: schedule.providers,
  chatId: undefined,
  userId: `schedule-${schedule.id}`,
  requestId: `sched-${schedule.id}-${Date.now()}`
}
```

Outcome: mission-control-relay picks it up, `/kanban` Board tab shows it as any other Spark mission. No new plumbing needed on the mission side.

After dispatch, update the schedule's `lastRunAt`, `lastMissionId`, `runCount`.

---

## 6. Where the tick comes from

Two options, pick one tomorrow:

**A. In-process timer (simplest)**
- `src/hooks.server.ts` starts `setInterval` on server boot, runs every 60s, calls the same logic as `/api/schedules/tick`.
- Works only while `npm run dev` / build server is running.
- Zero external dependencies. Fine for local dev and single-instance deployment.

**B. External cron hits `/api/schedules/tick`**
- System cron, GitHub Actions, or Spark Intelligence Builder's own cron loop calls the endpoint every minute.
- Survives server restarts cleanly. Multi-instance safe if we add a lock later.
- Needs one external piece.

**Recommendation:** ship A *and* expose the tick endpoint. The endpoint lets us swap to B or belt-and-suspenders without refactoring.

---

## 7. UI scope for the Scheduled tab

Replace the placeholder with:

**Top bar**
- Overline "Scheduled" + count of active schedules.
- `+ New schedule` button → opens inline form.

**Form (inline, collapsible)**
- Name (text input, required)
- Goal (textarea, required)
- Every (number) + unit select (minutes / hours / days → convert to minutes)
- Providers (optional multi-select; default = all configured)
- Create button

**List**
- One row per schedule, matching the Board card visual language:
  - Name + goal preview
  - Cadence badge (e.g. `every 30m`)
  - Last run: relative time + link to the resulting mission
  - Next run: countdown
  - Run count
  - Actions: **Run now** · **Pause** / **Resume** · **Delete**
- Paused schedules grayed out, still visible.

**Empty state**
- "No scheduled missions yet. Create one to have Spark run it on a cadence."

---

## 8. What to deliberately skip in v1

- Full cron expressions. Interval-only. Add cron as a second field later if needed.
- Concurrency locks. Single-writer assumption on `.spawner/schedules.json` is fine locally.
- Per-schedule run history UI. Last-run link is enough; mission-control-relay already retains the trail.
- Back-pressure / max-parallel. Ticks fire whatever's due; downstream rate-limit on `/api/spark/run` already exists (30/min).
- Auth UI. Auth follows the same loopback-allow pattern as the rest of the Spark surface.

---

## 9. Telegram / Spark Intelligence Builder integration

No extra work needed on this side. Scheduled runs go through `/api/spark/run` like everything else, which means `mission-control-relay` pushes their events to:

- Spark ingest URL (if configured) → Spark Intelligence Builder sees them and can react.
- Configured webhooks → Telegram bridge notifies the allowlisted user.

If the Spark Intelligence Builder needs to *create* a schedule (bot user types "run X every hour"), route that command through the bot's gateway to `POST /api/schedules` with the same auth header it uses for everything else.

---

## 10. Files to touch tomorrow

- **New**: `src/lib/server/schedules.ts` — storage + due-check + fire logic
- **New**: `src/routes/api/schedules/+server.ts` (GET, POST)
- **New**: `src/routes/api/schedules/[id]/+server.ts` (DELETE)
- **New**: `src/routes/api/schedules/[id]/run/+server.ts`
- **New**: `src/routes/api/schedules/[id]/pause/+server.ts`
- **New**: `src/routes/api/schedules/[id]/resume/+server.ts`
- **New**: `src/routes/api/schedules/tick/+server.ts`
- **New**: `src/hooks.server.ts` — in-process 60s interval
- **Edit**: `src/routes/kanban/+page.svelte` — replace the placeholder Scheduled tab with the form + list
- **Optional**: add `.spawner/schedules.json` to `.gitignore` (runtime state)

---

## 11. Open decisions for tomorrow

1. **Tick strategy**: go with in-process only, or ship both? (Recommended: both.)
2. **Cadence precision**: minute-level good enough, or need second-level? (Recommended: minute.)
3. **Max schedules**: cap at some number (e.g., 50) to avoid runaway? (Recommended: yes, soft cap with error.)
4. **Display timezone**: everything in UTC or local? (Recommended: local for display, UTC for storage.)
5. **Schedule the Spark Intelligence Builder flow explicitly**: should any schedules auto-create when the Telegram bot user says "every X"? (Probably yes, but that's a v2 integration — out of scope for tomorrow.)

---

## 12. Today's work that made this possible

- `/kanban` route with Board + Scheduled tabs landed 2026-04-21 (`8c57014`).
- Board merges MCP missions + mission-control-relay Spark runs into one view (`ce93a44`).
- `/api/spark/run` is verified end-to-end — POSTing a goal dispatches, relays, and surfaces on the kanban within one 4s poll tick.

Everything downstream of "fire a mission" works. The scheduler only needs to decide *when* to fire.
