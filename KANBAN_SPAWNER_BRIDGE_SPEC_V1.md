# Kanban ↔ Spawner Bridge Spec (v1)

Goal: let Spawner UI ingest Kanban tasks as a live mission-control canvas with minimal new code.

## 1) Source of truth
- **Primary:** Kanban JSON (`terminal_build_queue.json`)
- **Consumer:** Spawner pipeline-loader (`/api/pipeline-loader`)
- **Policy (v1):** one-way sync (Kanban -> Spawner)

## 2) Required input schema (Kanban side)

```json
{
  "schema": "observability-kanban.terminal-build-queue.v1",
  "tasks": [
    {
      "id": "CB-004",
      "execution_order": 1,
      "priority": "P0",
      "status": "ready",
      "task": "Capture noise filtering",
      "intent": "Stop low-value memory ingress",
      "kpi": "memory_noise_ratio",
      "baseline": 0.356,
      "target": 0.2,
      "importance_score": 8.2
    }
  ]
}
```

## 3) Spawner payload target (existing)

```json
{
  "pipelineId": "kanban-main",
  "pipelineName": "Kanban Mission Board",
  "nodes": [
    {
      "skill": {
        "id": "task-CB-004",
        "name": "CB-004 · Capture noise filtering",
        "description": "Intent: Stop low-value memory ingress",
        "category": "strategy",
        "tier": "free",
        "tags": ["kanban", "task", "p0"],
        "triggers": ["kanban-import"]
      },
      "position": { "x": 120, "y": 160 }
    }
  ],
  "connections": [
    { "sourceIndex": 0, "targetIndex": 1 }
  ],
  "source": "goal"
}
```

## 4) Mapping rules

### Task -> Node
- `skill.id`: `task-{task.id}`
- `skill.name`: `{task.id} · {task.task}`
- `skill.description`: `Intent: {intent}\nKPI: {kpi} ({baseline} -> {target})`
- `skill.tags`: include `priority`, `status`, `kpi`, `source`
- `position`: auto-layout by `execution_order`

### Dependencies
- If explicit `depends_on` exists: connect by dependency
- Else: connect by `execution_order` sequentially

### Visual grouping
- Lanes by status:
  - `in_progress` x=120
  - `ready` x=520
  - `backlog` x=920
  - `needs_review` x=1320
  - `blocked` x=1720
  - `done` x=2120

## 5) New minimal API in Spawner

### POST `/api/kanban/import`
- Input: Kanban JSON (or file path)
- Action:
  1) validate schema
  2) map tasks -> pipeline-loader payload
  3) queue via existing `/api/pipeline-loader`
- Output:
  - `queued: true`
  - counts `{nodes, connections}`
  - `pipelineId`

### GET `/api/kanban/import/preview`
- Returns mapped payload without queuing (debug/preview)

## 6) Identity + update behavior (v1.1)
- Maintain `taskId -> nodeId` map in `.spawner/kanban-sync-map.json`
- Re-import should:
  - update existing task nodes by `taskId`
  - add missing nodes
  - mark removed nodes with tag `stale` (do not hard-delete in v1)

## 7) Mission-control extensions
- Node metadata fields to carry:
  - `taskId`, `priority`, `status`, `importance_score`, `kpi`, `baseline`, `target`, `execution_order`
- Enables filtered views:
  - P0 only
  - Needs-review only
  - KPI-specific focus

## 8) Acceptance criteria
1. Import button in Spawner queues Kanban board and opens canvas.
2. Canvas reflects task order and status lanes.
3. Re-import updates existing nodes without duplication.
4. At least 1 test for schema validation + 1 test for mapping correctness.

## 9) Implementation order
1) `lib/services/kanban-bridge.ts` mapper
2) `/api/kanban/import` route
3) UI import action/button
4) preview endpoint
5) taskId-nodeId sync map
