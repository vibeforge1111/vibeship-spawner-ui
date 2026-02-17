# Step 2: OpenClaw Runtime Bridge (Codex + Claude only)

## Scope implemented
- `src/lib/server/provider-runtime.ts`
- `src/lib/services/openclaw-bridge.ts`
- `src/routes/api/openclaw/session/start/+server.ts`
- `src/routes/api/openclaw/command/+server.ts`
- `src/routes/api/openclaw/events/+server.ts`
- `src/routes/api/openclaw/session/end/+server.ts`
- `src/lib/services/mission-executor.ts` (event normalization handling only)

## What this step delivers
1. **Real worker lifecycle** via OpenClaw session APIs:
   - start: `POST /api/openclaw/session/start`
   - send command: `POST /api/openclaw/command` (`worker.run`, `worker.cancel`, `worker.status`)
   - stream: `GET /api/openclaw/events?sessionId=...` (SSE)
   - end: `POST /api/openclaw/session/end`
2. **Provider mapping restricted to `claude` + `codex` only** for terminal workers.
3. **Normalized runtime events** emitted on event bridge:
   - `task_started`
   - `task_progress`
   - `task_completed`
   - `task_failed`
   - `task_cancelled`
   Each carries `missionId`, `providerId`, `openclawSessionId`, and `taskId` when available.
4. **Deterministic failure/cancel behavior**:
   - cancellation emits `task_cancelled` exactly once and resolves with `Cancelled`
   - terminal failure emits `task_failed`
   - runtime/session cancellation kills worker process and closes session cleanly

## Runtime flow
1. `/api/dispatch` invokes `providerRuntime.dispatch(...)`.
2. `provider-runtime` routes `terminal_cli` providers (`claude`/`codex`) to `openclawBridge.executeProviderTask(...)`.
3. `openclaw-bridge` creates/uses OpenClaw session, spawns provider process, streams normalized events, and terminates session on completion/failure/cancel.
4. `mission-executor` consumes `task_*` events (including failed/cancelled) to keep UI state/progress synchronized.

## Notes
- This step intentionally excludes OpenCode/Pi and any UI redesign.
- Existing auth/rate-limiting for OpenClaw routes remains intact.
- Local operational playbook: `docs/OPENCLAW_CANVAS_LOCALHOST_RUNBOOK.md`
