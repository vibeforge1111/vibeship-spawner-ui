# Spark <> Spawner Task

Status: in progress
Date: 2026-04-21

## Goal

Make `Spawner UI` the thin execution plane for `Spark Intelligence` across Telegram and the builder UI, without turning it back into a broad orchestration product.

## Principles

- No features beyond the Spark execution route.
- No new abstractions for one-off glue code.
- No flexibility that the Telegram or builder route does not need.
- No cleanup outside the active Spark/Spawner path unless code is fully orphaned.
- If a simpler endpoint or screen works, use that instead of adding a framework.

## In Scope

- Let `Spark` use `Spawner` as the execution plane.
- Keep `Telegram` and `Spark` as the conversation and planning layer.
- Run `Claude`, `Codex`, `GLM 5.1`, and `MiniMax` directly from Spawner.
- Keep provider keys server-side when possible.
- Support a thin control loop for:
  - start mission
  - status
  - pause
  - resume
  - kill
- Make bot-created missions easy to inspect from the builder UI.

## Out Of Scope

- Full recursive multi-tenant agent runtime redesign.
- Durable distributed worker infrastructure.
- Rich approval workflows unless Telegram actually needs them.
- Paperclip integration in this slice.
- New frontend redesign.
- A full project-management product inside Spawner.

## Vertical Slice

1. Spark receives a task in Telegram.
2. Spark turns it into a structured Spawner request.
3. Spawner creates a mission and dispatches providers.
4. Spawner emits mission-control events back to Spark or the bot.
5. Spark reports progress and lets the user send control commands.

## Current State

### 1. Provider Runtime

- [x] Add `Z.AI / GLM 5.1` as an OpenAI-compatible provider.
- [x] Add `MiniMax` as an OpenAI-compatible provider.
- [x] Expose provider env-key readiness to the UI.
- [x] Smoke test both providers from localhost.

### 2. Skills Source

- [x] Point Spawner runtime skill loading at `spark-skill-graphs`.
- [x] Rebuild the local skill index/catalog from `spark-skill-graphs`.
- [x] Verify one live skill fetch through `/api/h70-skills/:id`.

### 3. Surface Cleanup

- [x] Remove Mind from the startup-critical path.
- [x] Remove legacy Mind and memory UI surfaces.
- [x] Remove orphaned memory service/store code that no longer powers the app.

## Next Slice

### 1. Spark Run Contract

- [ ] Lock one request contract from Spark to Spawner.
  verify: one request shape and one response shape power both Telegram and builder runs
- [ ] Keep `/api/spark/run` limited to fields we actually need:
  - `goal`
  - optional `providers`
  - optional `projectPath`
  - optional `chatId`
  - optional `userId`
  - optional `requestId`
  verify: no second orchestration protocol is introduced

### 2. Event Relay Back To Spark

- [ ] Send mission start, progress, completion, and failure updates back to Spark or the bot.
  verify: a Telegram `/run` can complete without manual polling for normal cases
- [ ] Reuse existing mission-control events instead of inventing a parallel event system.
  verify: the same status/control path still powers `/status`, `/pause`, `/resume`, `/kill`

### 3. Mission Correlation

- [ ] Add `requestId`, `chatId`, and `userId` plumbing for Spark-originated missions.
  verify: every Telegram mission is traceable across bot logs and Spawner status
- [ ] Make retries idempotent where practical for the narrow Spark route.
  verify: a repeated request can be identified without creating silent duplicates

### 4. Builder Visibility

- [ ] Add one simple way to inspect bot-created missions from the UI.
  verify: a Telegram-triggered mission is easy to find without using canvas as the main control surface
- [ ] Keep canvas available, but do not make it the only mission inspection flow.
  verify: a simple filtered mission list or tag-based view is enough

### 5. End-To-End Smoke Test

- [ ] Run one real vertical test:
  - Telegram `/run say exactly OK`
  - Spawner mission created
  - provider executed
  - status visible
  - completion event emitted
  verify: the builder Telegram route works end to end on localhost

## Optional Later

- [ ] Add a lightweight kanban mission board if the mission list becomes hard to scan.
  verify: board columns reflect real mission states, not a second workflow model
- [ ] Only do this if it improves operator visibility for Spark runs.
  verify: no new planning system or issue tracker is introduced

## Acceptance Criteria

- Spawner UI shows `Z.AI` and `MiniMax` as runnable providers.
- Server env keys can mark those providers ready without exposing secrets to the browser.
- A mission can be dispatched to either provider through the existing dispatch path.
- The Spark bridge stays a thin adapter, not a parallel orchestration system.
- A Telegram-created mission can be traced, controlled, and inspected from Spawner.
- Any future kanban view, if added, is only an operator dashboard over mission states.
