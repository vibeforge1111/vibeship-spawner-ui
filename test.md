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
