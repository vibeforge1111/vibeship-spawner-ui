# Spark Spawner Agent Ruleset

## Repo Role

`spawner-ui` owns Spark's local execution plane: mission creation, Mission Control, PRD/canvas build flow, worker dispatch, provider runtime metadata, result-artifact evidence, and local execution dashboards.

Canonical truth owned here:

- mission lifecycle, mission ids, Mission Control rows, and worker state
- PRD bridge planning/build dispatch and canvas/preview artifact handling
- provider/model execution metadata and metadata-only result evidence
- Spawner health, relay readiness, and execution-plane diagnostics
- local execution UI behavior and mission-board state

This repo does not own:

- Telegram user intent, chat access prompts, or final reply composition
- Builder RouteConfidenceGateV1, AOC, identity, or memory orchestration
- CLI registry, installer, secret storage, or system-map compilation
- durable memory rules or memory mutation authority
- public publication governance owned by Swarm/Labs

## Start-of-Work Protocol

1. Run `git status --short --branch`.
2. Read this file plus the relevant mission, provider, or API docs before edits.
3. Identify whether the change is Spawner-owned or belongs in Builder, Telegram, CLI, Cockpit, memory, Labs, Swarm, or Skill Graphs.
4. Define the smallest execution behavior and stop-ship gate.
5. Add focused tests for the changed API, mission relay, provider client, PRD bridge, or event ledger.
6. Keep provider evidence metadata-only unless a local artifact contract explicitly permits saved output.
7. Commit one logical checkpoint and record verification.

## One Truth Rules

- Spawner mission state is execution evidence, not user intent.
- Mission Control rows, agent-event rows, and PRD trace rows should preserve one request/trace family.
- Provider/model/result facts should be source-owned here, then compiled by CLI or rendered by Telegram/Cockpit as projections.
- Do not duplicate Builder route confidence or Telegram conversation routing inside Spawner.
- Do not use proof pages, generated previews, local workspaces, or provider outputs as source code unless explicitly promoted.

## Privacy Red Lines

Do not export, commit, or pass into projections:

- secrets, tokens, env values, credentials, private keys
- raw chat ids, user ids, or non-redacted account identifiers
- raw prompts when metadata is enough
- provider output bodies
- memory bodies or transcript bodies
- raw audio payloads
- private `spark-intelligence-systems` strategy

Result artifacts may exist locally by explicit mission request, but ledgers and compiled evidence should carry metadata, paths, hashes/counts, redacted refs, and blockers rather than private content.

## Authority and Execution Rules

- Spawner executes only after upstream route/authority gates allow it or a local operator explicitly invokes a safe diagnostic.
- External, destructive, publishing, deletion, credential, and network-visible actions require explicit authority and confirmation.
- Safe read-only health checks may report state, but status routes must not mutate source or installed runtime.
- If provider/model proof is missing, expose the missing source row instead of inventing from Kanban, memory, or old result text.

## Anti-Spaghetti Rules

- Do not add channel-specific Telegram logic here.
- Do not move Builder AOC, route confidence, or memory decisions into Spawner APIs.
- Do not add hidden shell execution or caller-supplied command templates.
- Do not let tests/imports rewrite runtime source, ledgers, or installed paths unexpectedly.
- Keep PRD proof constraints deterministic when a request asks for exact local files.

## Verification Menu

- Focused Vitest/integration tests for changed routes, provider clients, Mission Control relay, PRD bridge, or event ledger.
- `npm run check`.
- `npm run build`.
- Privacy scan for ledgers, result metadata serializers, route payloads, and docs.
- Browser/API smoke for UI or mission-board changes when relevant.
- `git diff --check`.
- `git status --short --branch`.
