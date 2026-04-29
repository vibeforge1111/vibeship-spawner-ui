# Spawner UI Optimization Diagnosis

Date: 2026-04-29

This document records the current optimization and maintainability diagnosis for Spawner UI. It is based on local scans, package audit output, route inventory, and the existing test suite.

## Current Status

- Branch used for this pass: `codex/spawner-maintenance-optimization-pass`.
- Production dependency audit is clean after removing unused `svelvet`.
- The active Spark route surface is covered by `npm run smoke:routes`.
- Mission, Canvas, Kanban, and Trace stitching is covered by `npm run smoke:mission-surfaces`.
- Unit/integration coverage is strong for mission lifecycle, relay, provider runtime, Spark agent bridge, PRD bridge, execution rows, and canvas load rules.

## Root Cause Findings

### 1. Dependency Advisory

Symptom: `npm audit --omit=dev` previously reported a moderate `uuid` advisory through `svelvet`.

Root cause: `svelvet` was installed but not imported anywhere in `src`, `scripts`, or package entrypoints. The installed `svelvet@11.0.5` also carried a nested `svelvet@10.0.2`, which kept the audit noisy.

Fix: remove `svelvet` from `package.json` and `package-lock.json`.

Verification: `npm audit --omit=dev` now reports zero vulnerabilities.

### 2. Type Safety Hotspot

Symptom: scheduled route/server code still used `any` in request parsing and error handling.

Root cause: older schedule API code predated the stricter type-safety cleanup.

Fix: parse unknown JSON into `Record<string, unknown>` and normalize unknown errors with a small helper.

### 3. Logging Consistency

Symptom: PRD analysis code still logged directly to `console`.

Root cause: it was not included in the earlier structured logger migration.

Fix: use scoped `logger` instances in the analysis client/server path.

## Evidence Snapshot

Largest active source files by line count:

| File | Lines | Risk |
| --- | ---: | --- |
| `src/lib/services/mission-executor.ts` | 2150 | High orchestration complexity |
| `src/lib/components/ExecutionPanel.svelte` | 2039 | High UI complexity |
| `src/routes/canvas/+page.svelte` | 1598 | High page-level responsibility |
| `src/lib/services/canvas-sync.ts` | 1223 | Sync and compatibility complexity |
| `src/lib/types/mcp.ts` | 1216 | Large generated/static type surface |
| `src/lib/stores/canvas.svelte.ts` | 1209 | Store responsibility concentration |
| `src/lib/utils/prd-analyzer.ts` | 1177 | Legacy analyzer complexity |
| `src/lib/services/spark-agent-bridge.ts` | 1139 | Bridge state and protocol complexity |
| `src/lib/services/multi-llm-orchestrator.ts` | 1013 | Provider orchestration complexity |

Direct `console.*` calls remain in UI stores, components, route handlers, and server helpers. This is not immediately breaking, but it makes production and test logs less uniform.

## Recommended Next Passes

### P0: Keep Mission Surfaces Inspectable

Goal: make Kanban cards and Canvas completed missions easy to inspect after completion.

Why: this is the user-facing pain with the highest leverage. A user should always be able to click from Kanban to the mission detail, Canvas, Trace, and latest result.

Suggested work:

- Add explicit action buttons/links on Kanban cards for Details, Canvas, Trace, and Result.
- Preserve accordion behavior, but do not make it the only click target.
- Add tests for mission card action URLs and completed-mission inspection.

### P1: Split ExecutionPanel Presentation From Runtime Wiring

Goal: reduce the blast radius of changes to `ExecutionPanel.svelte`.

Why: the file is over 2000 lines and mixes panel state, task rendering, log rendering, controls, settings, and progress summaries.

Suggested work:

- Extract a `TaskStatusList.svelte`.
- Extract an `ExecutionLogList.svelte`.
- Extract a `MissionSettingsPanel.svelte`.
- Keep tested formatting helpers in `src/lib/services/execution-panel-formatting.ts`.

### P1: Split Canvas Page Runtime Effects

Goal: make `/canvas` easier to reason about and harder to regress.

Why: `src/routes/canvas/+page.svelte` owns route loading, polling, Spark agent sync, drag/drop, node rendering, mission execution, and canvas state effects.

Suggested work:

- Move route-query pipeline hydration into a service or Svelte action.
- Move periodic sync/poll timers into a small lifecycle helper.
- Add focused tests around auto-load, no-restart, and mission-scoped URL rules.

### P1: Centralize Direct Console Logging

Goal: route all app/runtime logs through the shared logger.

Why: direct `console.*` calls are still common in stores, route handlers, and components. Some are expected in scripts, but app/runtime logs should be scoped and environment-aware.

Suggested work:

- Leave CLI scripts and smoke scripts alone.
- Convert app/runtime `console.*` to scoped loggers module by module.
- Start with `canvas/+page.svelte`, `stores/skills.svelte.ts`, `stores/pipelines.svelte.ts`, and `sync-client.ts`.

### P2: PRD Analyzer Consolidation

Goal: reduce duplicate analyzer paths.

Why: `prd-analyzer.ts`, `smart-prd-analyzer.ts`, `goal-analyzer.ts`, `skill-matcher.ts`, and `/api/analyze` overlap conceptually. They may be valid layers, but the route between them should be explicit.

Suggested work:

- Document which analyzer path is authoritative for Telegram advanced builds.
- Add tests that prove a vague prompt gets natural clarification and a clear "go" default.
- Deprecate or wrap legacy analyzers that are no longer on the primary path.

### P2: Package Hygiene

Goal: keep dependencies minimal and intentional.

Why: unused dependencies create audit noise and install weight.

Suggested work:

- Add a lightweight dependency usage check to the maintenance checklist.
- Periodically run package import scans before accepting new dependencies.
- Consider moving script-only dependencies to `devDependencies` if they are not needed at runtime.

## Verification Commands

Run these after each optimization pass:

```bash
npm run check
npm run test:run
npm run build
npm run smoke:routes
npm run smoke:mission-surfaces
npm audit --omit=dev
```

For UI-affecting work, also run a browser smoke against:

- `/`
- `/kanban`
- `/canvas`
- `/trace`
- `/missions/<known-mission-id>`

## Principle

Optimize by extracting stable boundaries from proven behavior. Do not rewrite mission orchestration or canvas execution as a single large refactor. The safest path is small extractions with focused tests around each extracted rule.
