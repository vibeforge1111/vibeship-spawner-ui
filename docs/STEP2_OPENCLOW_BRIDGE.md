# Step 2 — OpenClaw Runtime Bridge (Codex + Claude)

## What changed

- `provider-runtime` now dispatches terminal providers (`claude`, `codex`) through OpenClaw worker sessions via `openclawBridge.executeProviderTask(...)`.
- Added real worker lifecycle in `openclaw-bridge`:
  - start worker session
  - execute provider prompt through provider-specific command path
  - emit normalized events (`task_started`, `task_progress`, `task_completed`, `task_failed`, `task_cancelled`)
  - deterministic end-session cleanup on success/failure/cancel
- Added OpenClaw worker commands to command surface:
  - `worker.run`
  - `worker.cancel`
  - `worker.status`
- Mission executor now handles `task_failed` and `task_cancelled` events from bridge/runtime.

## Event normalization contract

Each worker lifecycle event includes stable identifiers in `data`:

- `missionId`
- `providerId`
- `openclawSessionId`
- `taskId` (if available)

These are emitted into existing `/api/events` consumers through the shared event bridge.

## Env/config

No new required envs beyond existing bridge auth/config:

- `OPENCLAW_API_KEY` (recommended)
- `OPENCLAW_ALLOWED_ORIGINS` (optional hardening)

Provider readiness remains from Step 1:

- `ANTHROPIC_API_KEY` (Claude)
- `OPENAI_API_KEY` (Codex)

## Quick run / verify

```bash
# from repo root
npm run test -- --run src/lib/server/provider-runtime.openclaw.test.ts src/routes/api/openclaw/openclaw.integration.test.ts
```

Manual smoke check:
1. Run a mission with Multi-LLM enabled (`claude` + `codex`).
2. Enable auto-dispatch.
3. Confirm live task lifecycle events appear in existing execution logs.
4. Cancel mission and verify worker sessions emit `task_cancelled` and terminate cleanly.
