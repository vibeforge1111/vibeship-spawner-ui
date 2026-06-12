# Spark Harness Core Contract Adoption

Status: native Governor consumer adoption active

## Role Of This Repo

`spawner-ui` is Spark's mission, provider, Canvas, Kanban, trace, scheduler,
creator-mission, and execution-plane owner.

Spawner should:

- execute only work that has current `GovernorDecisionV1` authority or an
  explicitly documented machine-origin policy
- reject bare `TurnIntentEnvelopeVNext` for high-agency execution
- treat `autoRun` as a request flag, not authority
- bind mission execution, PRD write/load, Canvas execution, provider dispatch,
  creator mission execution, schedule create/delete/fire, Mission Control
  commands, browser/computer-use, publish, and deploy flows to owner/tool/action
  policy
- preserve `requestId`, `missionId`, `traceRef`, `pipelineId`, authority,
  ledger, and side-effect evidence
- expose Kanban, Canvas, Trace, and Result as local read/operator surfaces
  without a local login wall

Spawner should not:

- launch from raw words
- treat Builder payloads as authority without Governor verification
- treat hosted UI auth or local loopback as execution authority
- publish or deploy when the Governor did not authorize that exact action
- execute stale pending state, stored schedules, recovered snapshots, or relay
  metadata as fresh intent

## Current Contract

The canonical contract source is:

`work/repos/spark-harness-core`

The vendored runtime package is:

`vendor/harness-core`

Current high-agency execution requires:

```text
GovernorDecisionV1
+ matching AuthorizationDecisionV1
+ matching ToolCallLedgerV1
+ owner route consumer verification
+ side-effect proof
```

`TurnIntentEnvelopeV1` and the old private `spark-harness-contracts` repo are
historical predecessor references. They are not current source truth.

## Access Versus Authority

Local Mission Control is not a login system.

- Local loopback reads may show sanitized Kanban, Canvas, Trace, Result, and
  status data.
- Hosted/private-preview access may use workspace ID, UI key, and server-side
  cookies.
- Neither path creates execution authority.
- Mutating APIs require API/session access plus Harness/Governor authority.

## Acceptance

- explicit no-edit probes can run only when authorized for that exact read or
  bounded probe
- no-action prompts cannot launch
- `autoRun` alone cannot launch
- local-only canary cannot publish
- missing, stale, copied, owner-mismatched, or tool-mismatched Governor
  authority blocks before provider dispatch
- Canvas links are handed to Telegram only after materialized nodes/skill
  pairings exist
