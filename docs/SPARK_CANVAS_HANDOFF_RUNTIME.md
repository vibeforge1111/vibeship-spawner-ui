# Spark Canvas Handoff Runtime

## Contract

Telegram build handoff should expose Mission Control in two phases:

1. Send the mission Kanban/board link as soon as Spawner accepts the governed build request.
2. Send the Canvas link only after PRD analysis has materialized nodes, skill pairings, and workflow handoff state.

The Canvas link is not proof by itself. A valid handoff needs mission/request identity, board state, materialized nodes, skill pairings, preview or execution evidence when available, and the governing ledger that authorized the build.

## Local Runtime Boundary

Local Canvas reads must not require a login screen or manual access key. The local Spawner UI is the operator surface for the installed runtime, so read-only mission/canvas recovery may use loopback access.

Mutating routes remain control surfaces. Queueing a pipeline load, deleting pending state, mission commands, execution, registry movement, and provider control still require the appropriate Harness/Governor authority path and route auth.

## Legacy CanvasSync Boundary

CanvasSync is an optional local bridge for observing Canvas state from developer tools. It must not become an authority plane.

Allowed without Harness authority:

- current canvas state requests,
- validation requests,
- skill-content reads,
- prompt/export reads.

Blocked unless a future Harness Core/Governor route explicitly authorizes them:

- add/remove/clear/update/connect nodes,
- load templates,
- execute workflows.

Normal local Canvas use should not warn when no sync bridge is running. If no sync URL is configured, CanvasSync stays disabled quietly.

## Spark Agent Canvas-State Boundary

Spark Agent canvas snapshots are recovered runtime state. They can help a bound Spark Agent session redraw its own Canvas, but they must not silently replace the current Canvas just because a newer Spark Agent session exists.

The Canvas page only polls `/api/spark-agent/canvas-state` when the URL includes `sparkAgentSessionId` or `sparkAgentSession`. The API also returns a snapshot only for the requested session id. Unbound reads return `hasUpdate: false`.

This preserves the consumer binding rule: recovered Spark Agent state is evidence until the current Canvas explicitly binds to that Spark Agent session.

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
git -C C:\Users\USER\.spark\modules\spawner-ui\source fetch origin
git -C C:\Users\USER\.spark\modules\spawner-ui\source merge --ff-only origin/main
spark restart spawner-ui --allow-dirty-runtime
npm run sync:check
```

Then open the mission-specific Canvas URL in a real browser and verify:

- task nodes render,
- skill pairings render,
- "No skills on canvas" is absent,
- the URL recovers after a second open or after another mission becomes latest.
