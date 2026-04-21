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

## Diligence

- Keep Telegram as a mirror of real Spawner mission state.
- Carry `missionId`, `requestId`, `chatId`, and `userId` together wherever possible.
- Prefer concise lifecycle updates over log spam.
- Keep admin boundaries strict on control commands.
- Make failures say where the bridge broke.

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

## Phases

### Phase 1. Contract + Correlation

- [x] Lock one request contract from Spark to Spawner.
  verify: one request shape and one response shape power both Telegram and builder runs
- [x] Keep `/api/spark/run` limited to fields we actually need:
  - `goal`
  - optional `providers`
  - optional `projectPath`
  - optional `chatId`
  - optional `userId`
  - optional `requestId`
  verify: no second orchestration protocol is introduced
- [x] Store correlation metadata on created missions.
  verify: a Spark-originated mission is traceable from Spawner

### Phase 2. Event Relay

- [x] Send mission start, progress, completion, and failure updates back to Spark or the bot.
  verify: a Telegram `/run` can complete without manual polling for normal cases
- [x] Reuse existing mission-control events instead of inventing a parallel event system.
  verify: the same status/control path still powers `/status`, `/pause`, `/resume`, `/kill`

### Phase 3. Telegram Reporting

- [ ] Add a compact Telegram mission board command.
  verify: Telegram can group real mission states for quick reporting
- [ ] Keep the board message-native, not a second workflow model.
  verify: no separate kanban state is introduced

### Phase 4. Builder Visibility

- [ ] Add one simple way to inspect bot-created missions from the UI.
  verify: a Telegram-triggered mission is easy to find without using canvas as the main control surface
- [ ] Keep canvas available, but do not make it the only mission inspection flow.
  verify: a simple filtered mission list or tag-based view is enough

### Phase 5. End-To-End Smoke Test

- [ ] Run one real vertical test:
  - Telegram `/run say exactly OK`
  - Spawner mission created
  - provider executed
  - status visible
  - completion event emitted
  verify: the builder Telegram route works end to end on localhost

## Acceptance Criteria

- Spawner UI shows `Z.AI` and `MiniMax` as runnable providers.
- Server env keys can mark those providers ready without exposing secrets to the browser.
- A mission can be dispatched to either provider through the existing dispatch path.
- The Spark bridge stays a thin adapter, not a parallel orchestration system.
- A Telegram-created mission can be traced, controlled, and inspected from Spawner.
- Any Telegram board or kanban-like report is only an operator dashboard over real mission states.
