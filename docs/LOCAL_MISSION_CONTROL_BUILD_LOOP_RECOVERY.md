# Local Mission Control Build Loop Recovery

Last updated: 2026-06-09

This note records the local Spawner regressions that caused Mission Control to show a hosted access form, caused Telegram/PRD builds to fail with a workspace-boundary error, and later left completed canonical PRD results behind stale `pending-request.json` state.

## Contract

Local loopback Mission Control is not a login system.

These local URLs must open the operator surfaces directly:

```text
http://127.0.0.1:3333/kanban
http://localhost:3333/kanban
http://0.0.0.0:3333/kanban
http://127.0.0.1:3333/canvas
```

Hosted/private preview may still require workspace ID plus access key. That hosted UI gate is only a browser-access gate. It is not Harness authority and must not authorize execution, mutation, registry changes, mission control, memory writes, or publication.

## Root Causes Fixed

1. `0.0.0.0` was not treated as a local operator host, so local browser access could fall into hosted-login behavior.
2. The local login route could persist a `spawner_ui_session` cookie for loopback access, making local Mission Control look like a hosted authenticated surface.
3. PRD auto-analysis inherited `process.cwd()` as the provider working directory. In installed runtime, that was:

```text
C:\Users\USER\.spark\modules\spawner-ui\source
```

The Spark workspace guard correctly rejected that path because provider mission work must stay under:

```text
C:\Users\USER\.spark\workspaces
```

4. `pending-request.json` could remain `status=pending` and `autoAnalysis.status=running` after the canonical provider result already existed in `results/<requestId>.json`. That made Mission Control and Telegram-facing status paths keep reporting an active or failed mission while the real canonical artifact was already written.

## Current Fix

Local operator access is stateless request classification. Loopback browser access should not mint or require a UI session cookie.

PRD auto-analysis now launches provider work from a Spark-owned workspace:

```text
C:\Users\USER\.spark\workspaces\prd-auto-analysis\<requestId>
```

Do not fix workspace-boundary failures by setting `SPARK_ALLOW_EXTERNAL_PROJECT_PATHS=1` for release, installer, Telegram, or production-like local proof. That flag is for trusted development exceptions only.

Canonical PRD result artifacts now reconcile pending state through `src/lib/server/prd-canonical-result-reconciliation.ts`. Recovery and pending-poll paths must treat `results/<requestId>.json` as the terminal canonical artifact for that request and mark matching pending state as:

```text
status=processed
autoAnalysis.status=complete
autoAnalysis.canonicalResultAvailable=true
```

This is not permission minting. It does not promote provisional drafts, route history, UI state, or stale missions into authority. It only repairs duplicate runtime truth once a canonical provider result is present.

## Verified Proof

Focused test suite:

```text
npm run test:run -- src\lib\server\hosted-ui-auth.test.ts src\hooks.server.test.ts src\routes\spark-live\login\login.server.test.ts src\routes\api\prd-bridge\write\write.integration.test.ts src\lib\server\spark-run-workspace.test.ts src\lib\server\high-agency-workers.test.ts
```

Mission surface audit:

```text
npm run test:run -- src\routes\api\prd-bridge\write\write.integration.test.ts src\routes\api\prd-bridge\load-to-canvas\load-to-canvas.integration.test.ts src\lib\server\prd-auto-dispatch.test.ts src\lib\server\provider-runtime.spark-agent.test.ts src\routes\api\dispatch\dispatch.authority.test.ts src\routes\api\mission-control\mission-lifecycle.integration.test.ts src\lib\server\provider-clients\spark-harness-client.test.ts
```

Static checks:

```text
npm run check
npm run build
npm run sync:check
npm run health:spark
```

Runtime route probes after sync:

```text
http://127.0.0.1:3333/kanban -> 200 without login wall
http://localhost:3333/kanban -> 200 without login wall
http://0.0.0.0:3333/kanban -> 200 without login wall
http://127.0.0.1:3333/spark-live/login?next=%2Fkanban -> 303 /kanban
http://0.0.0.0:3333/spark-live/login?next=%2Fkanban -> 303 /kanban
```

Direct governed route proof after runtime sync:

```text
requestId=direct-workspace-boundary-smoke-1780952662272
autoAnalysis.provider=codex
autoAnalysis.started=true
authority.source=governor_decision
authority.governorOutcome=execute
authority.ledgerIngest.persisted=true
auto_worker_dispatch.workingDirectory=C:\Users\USER\.spark\workspaces\prd-auto-analysis\direct-workspace-boundary-smoke-1780952662272
```

This proves the old installed-source working-directory failure is fixed for fresh PRD bridge requests.

Direct governed route proof after canonical-result reconciliation:

```text
requestId=direct-full-build-smoke-1780953899741
authority.source=governor_decision
authority.governorOutcome=execute
authority.ledgerIngest.persisted=true
auto_worker_dispatch.workingDirectory=C:\Users\USER\.spark\workspaces\prd-auto-analysis\direct-full-build-smoke-1780953899741
events_received_complete.source=codex-auto
canonical_result_stored.source=codex-auto
auto_worker_finished.success=true
pending.status=processed
pending.autoAnalysis.status=complete
pending.autoAnalysis.canonicalResultAvailable=true
result.projectName=Harness Ops Field Notebook App
result.projectType=local React field-operations dashboard
result.tasks=6
```

Local surface probes for the same run:

```text
http://127.0.0.1:3333/kanban -> 200 without login wall
http://127.0.0.1:3333/canvas?pipeline=direct-full-build-smoke-1780953899741&mission=mission-1780953899741 -> 200 without login wall
http://127.0.0.1:3333/api/prd-bridge/result?requestId=direct-full-build-smoke-1780953899741 -> found=true, success=true
```

## Still To Prove

Native Telegram Desktop proof still needs a clean fresh send through `@SparkRecursive_bot` after this runtime repair. The previous visible Telegram failure at `2026-06-09 00:43` was pre-fix evidence for `tg-build-2b28ef7acfa5-1780951400906`, not a fresh post-fix failure.

The fresh Telegram proof should capture:

- visible outbound user request
- visible bot acknowledgement
- `request_written` with Harness Governor authority
- `auto_worker_dispatch` under `.spark\workspaces\prd-auto-analysis\<requestId>`
- `authority_verdict_evaluated`
- `auto_worker_finished`
- Canvas/Kanban URL opening locally without the hosted access wall
- mission progress relay back to Telegram when applicable

## Regression Rules

- Do not add a local login wall for loopback Mission Control.
- Do not persist local operator sessions as a substitute for request classification.
- Do not treat hosted UI auth as Harness authority.
- Do not pass `process.cwd()` as a provider working directory for generated missions, PRD auto-analysis, Telegram builds, or auto-dispatch.
- Do not demote the workspace boundary to make installed-source builds pass.
- Do not let `pending-request.json` outrank a matching canonical provider result artifact.
- Do not re-serve pending work once `results/<requestId>.json` exists for the same request.
- Do not make deterministic fallback output the release proof for Spawner mission execution.
- Do not use canned Telegram replies as proof. The proof is route selection, Governor decision, ledgers, provider dispatch, side effects, and visible UI state.
