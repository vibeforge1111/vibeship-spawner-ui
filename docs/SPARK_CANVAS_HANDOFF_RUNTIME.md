# Spark Canvas Handoff Runtime

## Contract

Telegram build handoff should expose Mission Control in two phases:

1. Send the mission Kanban/board link as soon as Spawner accepts the governed build request.
2. Send the Canvas link only after PRD analysis has materialized nodes, skill pairings, and workflow handoff state.

The Canvas link is not proof by itself. A valid handoff needs mission/request identity, board state, materialized nodes, skill pairings, preview or execution evidence when available, and the governing ledger that authorized the build.

## Local Runtime Boundary

Local Canvas reads must not require a login screen or manual access key. The local Spawner UI is the operator surface for the installed runtime, so read-only mission/canvas recovery may use loopback access.

Mutating routes remain control surfaces. Queueing a pipeline load, deleting pending state, mission commands, execution, registry movement, and provider control still require the appropriate Harness/Governor authority path and route auth.

## Durable Canvas Recovery

`/api/pipeline-loader` writes each queued Canvas load to:

- `pending-load.json` for the one-shot next Canvas mount.
- `last-canvas-load.json` for most-recent recovery.
- `canvas-loads/<pipelineId>.json` for mission-specific durable recovery.

Mission-specific Canvas URLs must request their exact pipeline id. If the one-shot pending load was already consumed, Canvas recovers from the per-pipeline archive instead of showing an empty local canvas or an unrelated latest mission.

## Telegram UX

Do not send Canvas while PRD analysis is still running. During analysis, send the board link and say Canvas will follow once nodes, skill pairings, and workflow handoff are materialized.

When Canvas is ready, include both links:

- Canvas: mission-specific pipeline URL.
- Board: mission-specific Kanban URL.

This keeps the user on a live progress surface first and avoids exposing an empty Canvas as if it were ready.

## Regression Checks

Use these checks after changing the handoff:

```bash
npm run test:run -- src\routes\api\pipeline-loader\pipeline-loader.integration.test.ts src\lib\services\pipeline-loader.test.ts src\lib\services\canvas-pipeline-load-rules.test.ts src\routes\api\prd-bridge\load-to-canvas\load-to-canvas.integration.test.ts
npm run check
npm run sync:runtime
npm run sync:check
```

Then open the mission-specific Canvas URL in a real browser and verify:

- task nodes render,
- skill pairings render,
- "No skills on canvas" is absent,
- the URL recovers after a second open or after another mission becomes latest.
