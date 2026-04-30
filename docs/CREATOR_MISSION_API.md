# Creator Mission API

Spawner UI exposes a creator mission surface for domain-chip, benchmark, specialization-path, autoloop, and Spark Swarm planning work.

The route is intentionally small in this pass. It creates a `spark-creator-trace.v1` record by calling Spark Intelligence Builder's `creator plan` command, persists the trace, and emits normal Mission Control events so Kanban can show the mission.

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
  "trace": {
    "schema_version": "spark-creator-trace.v1",
    "creator_mode": "full_path",
    "stage_status": "validated",
    "intent_packet": {
      "schema_version": "spark-creator-intent.v1"
    }
  }
}
```

## Read

```http
GET /api/creator/mission?missionId=mission-creator-...
GET /api/creator/mission?requestId=...
```

## State

Traces are stored under:

```text
$SPAWNER_STATE_DIR/creator-missions/<missionId>.json
```

When `SPAWNER_STATE_DIR` is unset, Spawner uses `.spawner` in the working directory.

## Mission Control

The API emits:

- `mission_created`
- `task_started`
- `task_completed`
- `mission_completed`

The mission id uses `mission-creator-*` so existing Mission Control and Kanban board logic accepts it as a normal mission.

## Builder Dependency

Spawner resolves Builder through:

- `SPARK_BUILDER_REPO`
- `SPARK_BUILDER_PYTHON`

If `SPARK_BUILDER_REPO` is unset, Spawner looks for a sibling `spark-intelligence-builder` checkout.

