# Spawner UI Maintainability Run

Date: 2026-04-29
Branch: `codex/spawner-ui-maintainability-pass`

## Goal

Make Spawner UI easier to maintain without destabilizing the working Mission Control path.

This run focuses on:

- mapping Telegram -> PRD -> Mission -> Canvas -> Dispatch -> Kanban -> Trace
- identifying high-risk modules
- improving lifecycle contracts and tests
- reducing noisy or duplicated maintenance surfaces
- preserving current user-facing mission behavior

## Step Checklist

- [x] Confirm clean starting branch
- [x] Map mission lifecycle surfaces
- [x] Identify highest-risk files and duplicated concepts
- [x] Add/adjust tests for lifecycle and route contracts
- [x] Apply low-risk refactors only where tests can guard behavior
- [x] Run targeted tests
- [x] Run full checks
- [x] Record final evidence

## Findings

- The highest-risk files are concentrated around mission execution and canvas state:
  - `src/lib/components/ExecutionPanel.svelte` (~2348 lines)
  - `src/lib/services/mission-executor.ts` (~2174 lines)
  - `src/routes/canvas/+page.svelte` (~1601 lines)
  - `src/lib/services/canvas-sync.ts` (~1223 lines)
  - `src/lib/stores/canvas.svelte.ts` (~1209 lines)
- Mission/task status vocabulary was repeated across server relay, trace, dispatch, Kanban card shaping, and the canvas execution panel.
- Auto-run guard treated cancelled missions as `failed`. That blocked reruns, but it erased the cancellation reason.
- Root-level one-off scripts and large planning docs make the repo harder to scan. They should be grouped in a follow-up after behavior-sensitive code is stabilized.

## Changes Made

- Added `src/lib/types/mission-control.ts` as the canonical Mission Control lifecycle contract.
- Added `src/lib/types/mission-control.test.ts` to lock mission statuses, task statuses, empty counts, and terminal-state semantics.
- Updated Mission Control relay, trace, board card shaping, and execution panel types to consume the shared lifecycle contract.
- Updated dispatch auto-run guard to return `cancelled` distinctly from `failed`.
- Added regression coverage for cancelled auto-run board history.
- Added `docs/MISSION_LIFECYCLE.md` with the Telegram -> PRD -> Canvas -> Dispatch -> Kanban -> Trace flow and maintenance rules.
- Added `scripts/smoke-routes.mjs` and `npm run smoke:routes` to verify the main human-facing routes and Mission Control APIs against a running local app.

## Verification Log

- Targeted lifecycle tests: PASS via `npm run test:run -- mission-control dispatch.autorun mission-board-cards mission-control.test` (10 files, 64 tests).
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Full unit/integration suite: PASS via `npm run test:run` (40 files, 221 tests).
- Production build: PASS via `npm run build`.
- Local route smoke: PASS via `npm run smoke:routes` against `http://127.0.0.1:5173` for `/`, `/kanban`, `/canvas`, `/trace`, `/api/mission-control/board`, and `/api/mission-control/trace`.
- Build note: Vite still reports the existing `Welcome.svelte`/`prd-bridge.ts` static-plus-dynamic import warning. It does not fail the build, but should be cleaned in a follow-up.

## Follow-Up Candidates

- Split `ExecutionPanel.svelte`, `mission-executor.ts`, `canvas/+page.svelte`, `canvas-sync.ts`, and `canvas.svelte.ts` into smaller behavior-focused modules.
- Move root-level ad hoc scripts and older planning docs into clearer `scripts/`, `docs/archive/`, or `docs/ops/` groupings.
- Add a route-level smoke that exercises mission detail navigation after Kanban cards become project-clickable.

## Continuation: Welcome Import + ExecutionPanel View Model

Branch: `codex/spawner-welcome-import-cleanup`

### Step Checklist

- [x] Remove duplicate static/dynamic `prd-bridge.ts` import path from `Welcome.svelte`.
- [x] Verify production build no longer prints the duplicate-import Vite warning.
- [x] Extract pure Mission Control view-model mapping helpers from `ExecutionPanel.svelte`.
- [x] Add focused tests for board status, task status, log type, and transition state mapping.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Imported `analysisResult` statically in `Welcome.svelte` and removed the runtime dynamic import of the same module.
- Added `src/lib/services/mission-control-view-model.ts` for Mission Control to execution-panel mapping rules.
- Added `src/lib/services/mission-control-view-model.test.ts`.

### Verification Log

- Focused view-model tests: PASS via `npm run test:run -- mission-control-view-model` (1 file, 4 tests).
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Production build: PASS via `npm run build`; duplicate `Welcome.svelte`/`prd-bridge.ts` warning removed.
- Full unit/integration suite: PASS via `npm run test:run` (41 files, 227 tests).
- Local route smoke: PASS via `npm run smoke:routes` against `http://127.0.0.1:5173` for `/`, `/kanban`, `/canvas`, `/trace`, `/api/mission-control/board`, and `/api/mission-control/trace`.

## Continuation: Mission Detail Links

Branch: `codex/spawner-mission-detail-links`

### Step Checklist

- [x] Add explicit mission detail links to Kanban cards.
- [x] Preserve detail links when live Spark relay cards merge with stale MCP cards.
- [x] Let `/missions/[id]` render Spark relay details even when MCP is connected but the mission is not in MCP storage.
- [x] Point the mission detail back link to `/kanban` instead of the redirecting `/missions` route.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Added `detailHref` to Mission Board card data.
- Added a `Details` action next to the existing project `Canvas` action.
- Updated the Spark mission detail route fallback so relay-tracked missions remain inspectable.
- Added `/missions/mission-smoke-route` to the route smoke script.

### Verification Log

- Focused board-card tests: PASS via `npm run test:run -- mission-board-cards` (1 file, 5 tests).
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Full unit/integration suite: PASS via `npm run test:run` (41 files, 228 tests).
- Production build: PASS via `npm run build`.
- Local route smoke: PASS via `npm run smoke:routes` against `http://127.0.0.1:5173` for `/`, `/kanban`, `/missions/mission-smoke-route`, `/canvas`, `/trace`, `/api/mission-control/board`, and `/api/mission-control/trace`.

## Continuation: Mission Detail View Model

Branch: `codex/spawner-mission-detail-view-model`

### Step Checklist

- [x] Extract Spark relay mission detail shaping from `/missions/[id]`.
- [x] Add focused tests for task rollups, mission event status, and empty history.
- [x] Keep the route rendering behavior unchanged while removing inline template logic.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Added `src/lib/services/mission-detail-view-model.ts`.
- Added `src/lib/services/mission-detail-view-model.test.ts`.
- Updated `/missions/[id]` to consume the derived Spark mission detail model.

### Verification Log

- Focused mission detail tests: PASS via `npm run test:run -- mission-detail-view-model` (1 file, 5 tests).
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Full unit/integration suite: PASS via `npm run test:run` (42 files, 233 tests).
- Production build: PASS via `npm run build`.
- Local route smoke: PASS via `npm run smoke:routes` against `http://127.0.0.1:5173` for `/`, `/kanban`, `/missions/mission-smoke-route`, `/canvas`, `/trace`, `/api/mission-control/board`, and `/api/mission-control/trace`.

## Continuation: Execution Hydration Model

Branch: `codex/spawner-execution-hydration-model`

### Step Checklist

- [x] Extract Mission Control history hydration shaping from `ExecutionPanel.svelte`.
- [x] Keep `ExecutionPanel.svelte` responsible for fetching, state assignment, and canvas node status updates.
- [x] Add focused tests for execution progress, logs, transitions, task buckets, completed missions, and cancelled missions.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Added `src/lib/services/mission-control-hydration.ts`.
- Added `src/lib/services/mission-control-hydration.test.ts`.
- Replaced inline hydration model construction in `ExecutionPanel.svelte` with `buildMissionControlHydrationSnapshot`.

### Verification Log

- Focused hydration tests: PASS via `npm run test:run -- mission-control-hydration` (1 file, 5 tests).
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Full unit/integration suite: PASS via `npm run test:run` (43 files, 238 tests).
- Production build: PASS via `npm run build`.
- Local route smoke: PASS via `npm run smoke:routes` against `http://127.0.0.1:5173` for `/`, `/kanban`, `/missions/mission-smoke-route`, `/canvas`, `/trace`, `/api/mission-control/board`, and `/api/mission-control/trace`.

## Continuation: Hydration Fallback Logs

Branch: `codex/spawner-hydration-fallback-logs`

### Step Checklist

- [x] Preserve completed/running mission inspectability when trace history is empty.
- [x] Synthesize readable execution logs and task transitions from the Mission Control board entry.
- [x] Run focused hydration tests.
- [x] Run typecheck.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Updated `src/lib/services/mission-control-hydration.ts` to build fallback mission/task events from board state when `/api/mission-control/status` has no matching recent events.
- Added regression coverage in `src/lib/services/mission-control-hydration.test.ts`.

### Verification Log

- Focused hydration tests: PASS via `npm run test:run -- mission-control-hydration` (1 file, 6 tests).
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Full unit/integration suite: PASS via `npm run test:run` (43 files, 239 tests).
- Production build: PASS via `npm run build`.
- Local route smoke: PASS via `npm run smoke:routes` against `http://127.0.0.1:5173` for `/`, `/kanban`, `/missions/mission-smoke-route`, `/canvas`, `/trace`, `/api/mission-control/board`, and `/api/mission-control/trace`.

## Continuation: Lifecycle Event Dedupe

Branch: `codex/spawner-dedupe-lifecycle-events`

### Step Checklist

- [x] Suppress repeated mission/task lifecycle statuses before they spam Telegram, trace, or hydrated logs.
- [x] Preserve real status transitions such as started -> completed.
- [x] Run focused relay tests.
- [x] Run typecheck.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Added lifecycle transition state tracking in `src/lib/server/mission-control-relay.ts`.
- Added regression coverage in `src/lib/server/mission-control-relay.test.ts` for repeated task lifecycle events.

### Verification Log

- Focused relay tests: PASS via `npm run test:run -- mission-control-relay` (1 file, 29 tests).
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Full unit/integration suite: PASS via `npm run test:run` (43 files, 240 tests).
- Production build: PASS via `npm run build`.
- Local route smoke: PASS via `npm run smoke:routes` against `http://127.0.0.1:5173` for `/`, `/kanban`, `/missions/mission-smoke-route`, `/canvas`, `/trace`, `/api/mission-control/board`, and `/api/mission-control/trace`.

## Continuation: Quiet Green Tests

Branch: `codex/spawner-quiet-green-tests`

### Step Checklist

- [x] Keep `logger.info`/`logger.debug` quiet under Vitest while preserving warnings and errors.
- [x] Move noisy success-path logs in pipeline-loader, PRD result storage, EventBridge result storage, and MCP client tool calls onto `logger.info`.
- [x] Run focused noisy-path tests.
- [x] Run typecheck.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Updated `src/lib/utils/logger.ts` to treat `import.meta.env.MODE === 'test'` as warning-only.
- Replaced success-path `console.log` calls in the known noisy green-test paths with scoped `logger.info`.

### Verification Log

- Focused noisy-path/auth tests after rebasing onto origin/main: PASS via `npm run test:run -- pipeline-loader prd-bridge/result events.auth sparkAgent hosted-ui-auth` (8 files, 37 tests) with success-path stdout quiet.
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Full unit/integration suite after rebasing onto origin/main: PASS via `npm run test:run` (43 files, 242 tests) with the targeted success-path stdout noise removed.
- Production build: PASS via `npm run build`.
- Local route smoke: PASS via `npm run smoke:routes` against `http://127.0.0.1:5173` for `/`, `/kanban`, `/missions/mission-smoke-route`, `/canvas`, `/trace`, `/api/mission-control/board`, and `/api/mission-control/trace`.

## Continuation: Canvas Execution Action

Branch: `codex/spawner-canvas-execution-action`

### Step Checklist

- [x] Make mission-scoped canvases bias toward inspection instead of looking like a fresh run.
- [x] Keep regular canvases in Run mode.
- [x] Add focused tests for toolbar execution action selection.
- [x] Run focused tests.
- [x] Run typecheck.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Added `src/lib/services/canvas-execution-action.ts`.
- Added `src/lib/services/canvas-execution-action.test.ts`.
- Updated `/canvas` toolbar to show `Inspect` for mission-linked canvases and open the mission history execution panel key.

### Verification Log

- Focused canvas execution action tests: PASS via `npm run test:run -- canvas-execution-action` (1 file, 3 tests).
- Post-rebase focused tests with hosted auth coverage: PASS via `npm run test:run -- canvas-execution-action hosted-ui-auth` (2 files, 10 tests).
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Full unit/integration suite: PASS via `npm run test:run` (44 files, 245 tests).
- Production build: PASS via `npm run build`.
- Local route smoke: PASS via `npm run smoke:routes` against `http://127.0.0.1:5173` for `/`, `/kanban`, `/missions/mission-smoke-route`, `/canvas`, `/trace`, `/api/mission-control/board`, and `/api/mission-control/trace`.

## Continuation: Kanban Mission Inspection Links

Branch: `codex/spawner-kanban-mission-links`

### Step Checklist

- [x] Restore direct mission detail route rendering for `/missions/[id]`.
- [x] Make route smoke fail if mission detail silently redirects back to `/kanban`.
- [x] Make Kanban card actions readable as `Open mission` and `Open canvas`.
- [x] Run typecheck.
- [x] Run route smoke.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Updated `src/routes/missions/[id]/+page.server.ts` so mission detail pages render instead of redirecting.
- Updated `scripts/smoke-routes.mjs` to verify `/missions/mission-smoke-route` stays on the mission detail route.
- Updated `src/lib/components/MissionBoard.svelte` to show clear card-level inspection actions below each mission card.

### Verification Log

- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Local route smoke: PASS via `npm run smoke:routes`; `/missions/mission-smoke-route` now returns 200 without redirecting away.
- Full unit/integration suite: PASS via `npm run test:run` (44 files, 245 tests).
- Production build: PASS via `npm run build`.

## Continuation: Spark Agent Bridge Naming And Logging Cleanup

Branch: `codex/spawner-logging-boundary-cleanup`

### Step Checklist

- [x] Remove the legacy bridge name from source paths, imports, routes, tests, headers, env vars, event names, and user-facing strings.
- [x] Rename bridge/API surface to Spark agent bridge (`/api/spark-agent/*`).
- [x] Move remaining app/runtime `console.log` calls behind the shared logger while leaving CLI script output intact.
- [x] Add Spark agent canvas-state to route smoke coverage.
- [x] Run focused bridge tests.
- [x] Run typecheck.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Renamed the old worker bridge service to `src/lib/services/spark-agent-bridge.ts` and updated provider runtime/canvas callers.
- Renamed the old worker API surface to `/api/spark-agent/*` and updated integration tests.
- Updated control auth env/header naming to `SPARK_AGENT_*` and `x-spark-agent-*`.
- Replaced app/runtime `console.log` usage with `logger.info` across PRD, canvas, sync, MCP, scheduler, pipeline, and mission-builder paths.
- Extended `scripts/smoke-routes.mjs` to cover `/api/spark-agent/canvas-state`.

### Verification Log

- Legacy naming scan: PASS across `src`, `scripts`, and `test.md` with no remaining old bridge-name matches.
- Runtime console scan: PASS via `rg -n "console\.log" src/routes src/lib --glob '!src/lib/data/**'` returning no matches.
- Focused Spark agent bridge tests: PASS via `npm run test:run -- spark-agent provider-runtime.spark-agent spark-agent-bridge` (3 files, 16 tests).
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Full unit/integration suite: PASS via `npm run test:run` (44 files, 245 tests).
- Production build: PASS via `npm run build`.
- Local route smoke: PASS via `npm run smoke:routes`, including `/api/spark-agent/canvas-state`.

## Continuation: Mission Surface Smoke

Branch: `codex/spawner-mission-surface-smoke`

### Step Checklist

- [x] Add a live smoke that creates a synthetic PRD result.
- [x] Load the synthetic result into a mission-scoped canvas without auto-running a provider.
- [x] Relay mission/task lifecycle events through `/api/events`.
- [x] Verify Kanban, mission detail, canvas, trace, and Spark agent bridge surfaces.
- [x] Run the new smoke against the local Spawner server.
- [x] Run typecheck.
- [x] Run route smoke.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Added `scripts/smoke-mission-surfaces.mjs`.
- Added `npm run smoke:mission-surfaces`.
- The smoke stores a tiny PRD result, loads `/canvas?pipeline=...&mission=...` with `autoRun: false`, injects lifecycle events, and verifies the mission reaches completed state across board and trace.

### Verification Log

- Mission surface smoke: PASS via `npm run smoke:mission-surfaces` against `http://127.0.0.1:5173`.
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Local route smoke: PASS via `npm run smoke:routes`, including `/missions/mission-smoke-route` and `/api/spark-agent/canvas-state`.
- Full unit/integration suite: PASS via `npm run test:run` (44 files, 245 tests).
- Production build: PASS via `npm run build`.

## Continuation: Execution Task Rows

Branch: `codex/spawner-execution-task-rows`

### Step Checklist

- [x] Extract execution task row/status summary mapping from `ExecutionPanel.svelte`.
- [x] Add focused tests for canvas fallback rows, mission task rows, progress clamping, task summary, and next-task selection.
- [x] Run focused tests.
- [x] Run typecheck.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Added `src/lib/services/execution-task-rows.ts`.
- Added `src/lib/services/execution-task-rows.test.ts`.
- Replaced inline task-row derivation in `ExecutionPanel.svelte` with tested service helpers.

### Verification Log

- Focused task-row tests: PASS via `npm run test:run -- execution-task-rows` (1 file, 4 tests).
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Full unit/integration suite after rebasing onto origin/main: PASS via `npm run test:run` (46 files, 252 tests).
- Production build: PASS via `npm run build`.
- Local route smoke: PASS via `npm run smoke:routes`.
- Mission surface smoke: PASS via `npm run smoke:mission-surfaces`.

## Continuation: Execution Panel Formatting

Branch: `codex/spawner-execution-formatting`

### Step Checklist

- [x] Extract execution panel presentation mapping helpers from `ExecutionPanel.svelte`.
- [x] Add focused tests for log colors/icons, status classes, task badge classes, transition badges, and duration formatting.
- [x] Run focused tests.
- [x] Run typecheck.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Added `src/lib/services/execution-panel-formatting.ts`.
- Added `src/lib/services/execution-panel-formatting.test.ts`.
- Replaced inline presentation helper implementations in `ExecutionPanel.svelte` with tested service helpers.

### Verification Log

- Focused formatting tests: PASS via `npm run test:run -- execution-panel-formatting` (1 file, 4 tests).
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Full unit/integration suite: PASS via `npm run test:run` (47 files, 256 tests).
- Production build: PASS via `npm run build`.
- Local route smoke: PASS via `npm run smoke:routes`.
- Mission surface smoke: PASS via `npm run smoke:mission-surfaces`.

## Continuation: Canvas Pipeline Load Rules

Branch: `codex/spawner-canvas-load-rules`

### Step Checklist

- [x] Extract pure canvas pipeline-load key, signature, readable-name, and auto-apply decision rules.
- [x] Add focused tests for duplicate protection, requested pipeline filtering, unchanged active canvases, and valid PRD bridge auto-run loads.
- [x] Run focused tests.
- [x] Run typecheck.
- [x] Run full checks.
- [x] Commit and push.

### Changes Made

- Added `src/lib/services/canvas-pipeline-load-rules.ts`.
- Added `src/lib/services/canvas-pipeline-load-rules.test.ts`.
- Updated `/canvas` to use the shared load-rule helpers while keeping session/store side effects in the page.

### Verification Log

- Focused canvas load-rule tests: PASS via `npm run test:run -- canvas-pipeline-load-rules` (1 file, 6 tests).
- Typecheck: PASS via `npm run check` (0 errors, 0 warnings).
- Full unit/integration suite: PASS via `npm run test:run` (48 files, 262 tests).
- Production build: PASS via `npm run build`.
- Local route smoke: PASS via `npm run smoke:routes`.
- Mission surface smoke: PASS via `npm run smoke:mission-surfaces`.
