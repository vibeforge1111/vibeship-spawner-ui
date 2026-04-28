# Mission Lifecycle

Spawner UI treats a Spark build as one mission that is visible across Telegram, PRD planning, Canvas, Dispatch, Kanban, and Trace.

This document is the shared route map for future maintenance. If behavior changes, update this file and the lifecycle tests in the same change.

## Status Vocabulary

Mission board statuses live in `src/lib/types/mission-control.ts`.

| Status | Meaning | User Surface |
| --- | --- | --- |
| `created` | Mission accepted and queued, usually while PRD/canvas analysis is still happening. | Kanban To do / created |
| `running` | Dispatch or task execution is active. | Kanban In progress, Canvas execution panel |
| `paused` | Operator paused the mission. | Kanban Paused, Trace paused |
| `completed` | Mission is done and all open tasks are closed as completed. | Kanban Done, Canvas completed |
| `failed` | Mission failed or provider failure was reported. | Kanban Failed, Trace failed |
| `cancelled` | Operator cancelled the mission. | Kanban Cancelled, Trace cancelled |

Task statuses are `queued`, `running`, `completed`, `failed`, and `cancelled`.

## Runtime Flow

```mermaid
flowchart TD
    T["Telegram build message"] --> B["spark-telegram-bot"]
    B --> P["/api/prd-bridge/write"]
    P --> A["PRD analysis result"]
    A --> L["/api/prd-bridge/load-to-canvas"]
    L --> C["Canvas pipeline with mission + request ids"]
    C --> D["/api/dispatch auto-run"]
    D --> R["Provider runtime"]
    R --> E["/api/events"]
    E --> M["Mission Control relay"]
    M --> K["/api/mission-control/board"]
    M --> X["/api/mission-control/trace"]
    K --> KB["Kanban"]
    X --> TR["Trace"]
    M --> TG["Telegram progress relay"]
```

## Key Contracts

- Mission and request identifiers must travel together from Telegram to Canvas.
- Canvas links should include both `pipeline=` and `mission=` when available.
- Auto-run must not restart missions that are already `running`, `completed`, `failed`, or `cancelled`.
- `cancelled` is distinct from `failed`; they may both block auto-run, but they should render and trace differently.
- Terminal board statuses close open task rows so users can see completed/failed/cancelled nodes after execution.
- Trace should prefer explicit board/dispatch state over inferred artifact state.

## Guard Tests

- `src/routes/api/mission-control/mission-lifecycle.integration.test.ts`
- `src/lib/server/mission-control-relay.test.ts`
- `src/lib/server/mission-control-trace.test.ts`
- `src/routes/api/dispatch/dispatch.autorun.test.ts`
- `src/lib/types/mission-control.test.ts`

## Maintenance Rules

- Add new mission or task statuses only in `src/lib/types/mission-control.ts`.
- Do not duplicate status unions inside components or route handlers.
- If a route returns mission state, prefer the shared board/trace types or a documented adapter.
- If Telegram wording changes, keep machine-readable state unchanged and update natural-language formatting separately.
