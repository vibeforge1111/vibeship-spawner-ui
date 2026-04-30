# Creator Mission API

Spawner UI exposes a creator mission surface for domain-chip, benchmark, specialization-path, autoloop, and Spark Swarm planning work.

The route creates a `spark-creator-trace.v1` record by calling Spark Intelligence Builder's `creator plan` command, expands that intent into a gated creator task graph, persists the trace, queues the graph into Canvas, and emits normal Mission Control events so Kanban can show the mission.

## Create

```http
POST /api/creator/mission
Content-Type: application/json

{
  "brief": "Create a Startup YC specialization path with benchmarked autoloop from Telegram and Spark Swarm",
  "requestId": "optional-stable-request-id",
  "missionId": "optional-mission-creator-id",
  "privacyMode": "local_only | github_pr | swarm_shared",
  "riskLevel": "low | medium | high"
}
```

Response:

```json
{
  "ok": true,
  "missionId": "mission-creator-...",
  "requestId": "mission-creator-...",
  "taskCount": 8,
  "canvasUrl": "http://127.0.0.1:5173/canvas?pipeline=creator-...&mission=mission-creator-...",
  "trace": {
    "schema_version": "spark-creator-trace.v1",
    "creator_mode": "full_path",
    "stage_status": "queued",
    "intent_packet": {
      "schema_version": "spark-creator-intent.v1"
    },
    "tasks": [
      {
        "id": "benchmark-pack",
        "title": "Build startup-yc benchmark pack",
        "validation_gates": ["benchmark_gate", "schema_gate"]
      }
    ],
    "validation_gates": [
      {
        "id": "benchmark_gate",
        "status": "pending",
        "blocks_promotion": true
      }
    ]
  }
}
```

## Read

```http
GET /api/creator/mission?missionId=mission-creator-...
GET /api/creator/mission?requestId=...
```

## Execute

```http
POST /api/creator/mission/execute
Content-Type: application/json

{
  "missionId": "mission-creator-..."
}
```

You can also execute by `requestId`.

Response:

```json
{
  "ok": true,
  "missionId": "mission-creator-...",
  "started": true,
  "providerId": "codex",
  "projectPath": "C:\\Users\\USER\\Desktop",
  "trace": {
    "current_stage": "execution_started",
    "stage_status": "running"
  }
}
```

Execution intentionally uses the same mission id instead of creating a second invisible run. The dispatcher is allowed to continue a non-terminal creator mission because planning already placed it on Kanban, but it still blocks terminal missions and active provider sessions.

## Kanban Operation

Creator missions appear on `/kanban` like normal Spark missions. Planning may show the card as in progress because the intent/task-graph task has already started and completed, but real provider execution is tracked separately.

For planned creator missions, Kanban shows a `Run` action. That action calls `POST /api/creator/mission/execute`, updates the card from the same mission id, and disappears after Mission Control records provider execution start. This keeps the operator flow visible without requiring a manual HTTP call.

## State

Traces are stored under:

```text
$SPAWNER_STATE_DIR/creator-missions/<missionId>.json
```

When `SPAWNER_STATE_DIR` is unset, Spawner uses `.spawner` in the working directory.

The mission-scoped Canvas graph is also queued through the existing Pipeline Loader files:

```text
$SPAWNER_STATE_DIR/pending-load.json
$SPAWNER_STATE_DIR/last-canvas-load.json
```

Creator loads use `source: "creator-mission"` and `autoRun: false` by default. They are inspectable first because creator artifacts can affect benchmark rules, memory policy, and Swarm publication.

When execution is requested, the same Canvas load is rewritten with `autoRun: true` and dispatched through the existing provider runtime. The working directory defaults to the parent of the Spawner checkout, or `SPARK_CREATOR_WORKSPACE_ROOT` when configured.

## Task Graph

Creator missions expand into explicit tasks instead of a single planning row. The exact graph depends on requested outputs, but a full path usually includes:

- lock creator intent and task graph
- create domain chip contract
- build benchmark pack
- assemble specialization path
- define benchmark-gated autoloop
- wire Telegram, Builder, and Spawner flow
- validate creator artifacts
- prepare Swarm publish packet

Validation gates follow the recursive-evolution protocol:

- `schema_gate`
- `lineage_gate`
- `benchmark_gate`
- `complexity_gate`
- `transfer_gate`
- `memory_hygiene_gate`
- `publish_review_gate`

## Mission Control

The API emits:

- `mission_created`
- `task_started`
- `task_completed`

The API does not emit `mission_completed` at planning time. Only the initial intent/task-graph task is completed. Remaining creator tasks stay queued on Kanban until an agent executes or updates them. The mission id uses `mission-creator-*` so existing Mission Control and Kanban board logic accepts it as a normal mission.

## Builder Dependency

Spawner resolves Builder through:

- `SPARK_BUILDER_REPO`
- `SPARK_BUILDER_PYTHON`

If `SPARK_BUILDER_REPO` is unset, Spawner looks for a sibling `spark-intelligence-builder` checkout.
