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
  "tracePath": "C:\\path\\to\\.spawner\\creator-missions\\mission-creator-....json",
  "trace": {
    "schema_version": "spark-creator-trace.v1",
    "trace_id": "creator-trace-mission-creator-...",
    "intent_id": "creator-intent-startup-yc-...",
    "creator_mode": "full_path",
    "stage_status": "queued",
    "publish_readiness": "private_draft",
    "artifact_manifests": [
      {
        "schema_version": "spark-artifact-manifest.v1",
        "artifact_id": "startup-yc-benchmark-pack-v1",
        "artifact_type": "benchmark_pack",
        "repo": "startup-bench",
        "validation_commands": ["python -m thestartupbench run-suite ..."],
        "promotion_gates": ["schema_gate", "benchmark_gate", "risk_gate", "rollback_gate"]
      }
    ],
    "artifact_manifest_validation_issues": [],
    "intent_packet": {
      "schema_version": "spark-creator-intent.v1"
    },
    "specialization_entry": {
      "telegram_command": "/creator plan --domain startup-yc --surface telegram --benchmark held-out",
      "required_artifacts": ["domain_chip", "benchmark_pack", "specialization_path", "autoloop_policy"],
      "evaluation_loop": {
        "baseline": "Run the benchmark pack before specialization practice and record the baseline score.",
        "held_out": "Run held-out cases that were not used as mutation prompts before any keep or publish decision.",
        "keep_rule": "Keep a mutation only when candidate score beats baseline, held-out passes, and the lesson improves agent-facing behavior rather than wording alone."
      }
    },
    "improvement_evidence": {
      "status": "missing",
      "held_out_required": true,
      "validation_run_id": null
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
  "tracePath": "C:\\path\\to\\.spawner\\creator-missions\\mission-creator-....json",
  "trace": {
    "current_stage": "execution_started",
    "stage_status": "running"
  }
}
```

Execution intentionally uses the same mission id instead of creating a second invisible run. The dispatcher is allowed to continue a non-terminal creator mission because planning already placed it on Kanban, but it still blocks terminal missions and active provider sessions.

## Validate

```http
POST /api/creator/mission/validate
Content-Type: application/json

{
  "missionId": "mission-creator-...",
  "maxCommands": 20
}
```

You can also validate by `requestId`.

The validation runner executes manifest `validation_commands` without a shell, from the declared repo root, and only for allowlisted executables: `python`, `python3`, `py`, `npm`, `npx`, and `spark-intelligence`. Results are appended to `trace.validation_runs`; a fully passing run moves the trace to `stage_status: "validated"` and `publish_readiness: "workspace_validated"`.

If a validation command writes `validation-ledger.json` in a manifest repo with `benchmark_evidence`, Spawner records it into `trace.benchmark_summary` and `trace.improvement_evidence`. A valid ledger should include baseline score, candidate score, delta, held-out pass/fail, benchmark references, and short notes for reasoning/tool-use/ability gains.

Spawner also reads the Labs product adapter packet at `reports/creator-mission-status.json` or `creator-mission-status.json` when present. That packet becomes the canonical source for `trace.canonical`, `trace.publication`, and `trace.creator_mission_status` so Telegram, Canvas, Kanban, and Mission Control can say the same thing. Product surfaces keep `network_absorbable=false` and `swarm.payload_ready=false`; a local Swarm contribution packet can be review-ready without being network-absorbed.

Validation does not mark the mission `published` or set `swarm.payload_ready`; Swarm contribution still requires review/publish gates.

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
