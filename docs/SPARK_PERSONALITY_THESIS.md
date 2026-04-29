# SPARK Personality Evolution Thesis

## 1) Product Thesis

### Why this exists
Spawner already supports visual pipelines, mission execution, and event streaming. Spark personality evolution adds a missing layer: **users can intentionally shape how Spark plans, codes, reviews, and explains over time**—while seeing the process in public (canvas + event panel), not as a black box.

### Target outcomes
1. **Predictable personality growth**: Spark becomes more aligned to user preferences (style, risk tolerance, verbosity, constraints).
2. **Visible multi-agent collaboration**: users can see Codex and Claude responsibilities in real time.
3. **Safer iteration loop**: every evolution step is reversible and user-approved.
4. **Better mission quality**: improved plan quality, implementation quality, and explanation quality via specialist nodes.

### Explicit boundaries
- Not “self-improving AGI”.
- Not hidden autonomous goal formation.
- Not irreversible behavior drift.
- Personality changes must be mission-scoped or versioned and rollbackable.

---

## 2) Architecture in Spawner Terms

## Core entities
- **Nodes**: specialized agents operating on typed artifacts.
- **Skills**: reusable capabilities attached to nodes (planning, coding, review, testing, documentation, integration).
- **Mission Pack**: a versioned bundle containing:
  - personality objective
  - trait constraints
  - evaluation rubric
  - rollback pointer
- **Event visibility**: every major step emits structured events (`task_started`, `task_progress`, `task_completed`, `task_failed`).

## Personality data model (practical)
Use versioned state:
- `personality_profile_vN.json`
- `trait_deltas_vN.json`
- `evaluation_report_vN.json`
- `rollback_ref` (points to previous stable version)

Recommended trait fields:
- communication style (concise/detailed)
- planning depth
- code risk tolerance
- review strictness
- user preference fidelity
- explanation style

## Runtime flow (Spawner)
1. `canvas.create_pipeline` creates evolution pipeline.
2. `canvas.add_skill` adds specialized nodes.
3. `canvas.add_connection` defines execution DAG.
4. `mission.build` compiles node graph into executable mission tasks.
5. `mission.start` runs the pipeline.
6. Optional provider-level work is executed via `worker.run` for Codex/Claude specific tasks.
7. Event stream (`/api/spark-agent/events`) keeps UI live and auditable.

---

## 3) Codex + Claude Parallel Work Model

## Responsibility split
- **Codex lane (build lane)**
  - writes/refactors implementation artifacts
  - generates tests and migration-safe patches
  - produces concrete diffs
- **Claude lane (reasoning + quality lane)**
  - critiques design decisions
  - checks safety and boundary compliance
  - rewrites prompts/specs/docs for clarity

## Handoffs
1. **Planner -> Trait Modeler**: objectives and constraints are formalized.
2. **Trait Modeler -> Codex + Claude (parallel)**:
   - Codex receives implementation tasks.
   - Claude receives review/risk tasks for the same scope.
3. **Codex -> Claude Review**: Claude reviews Codex outputs against rubric.
4. **Claude Review -> Codex (if needed)**: targeted revision requests.
5. **Both -> Integrator**: merge decision + final package.

## Merge points
- **M1 (Spec Freeze)**: after planner + trait-modeler.
- **M2 (Quality Gate)**: after codex-impl + claude-review.
- **M3 (Release Gate)**: after tester + doc-writer, before integrator commit.

---

## 4) Visibility Design (Canvas + Event Panel)

## Canvas visibility
User sees:
- node-by-node status color (queued/running/blocked/done/failed)
- active lane highlighting (Codex lane vs Claude lane)
- synchronization nodes (quality gate / integrator) with wait-state indicators
- artifact links on each node (spec, diff, test report, review notes)

## Event panel visibility
Each event should include:
- timestamp
- node id + provider (`codex` or `claude`)
- mission id / task id
- progress percentage where relevant
- short human-readable message

Minimum event set:
- `task_started`
- `task_progress`
- `task_completed`
- `task_failed`
- `mission_started`
- `mission_paused` / `mission_resumed`
- `mission_completed`

## What “visible orchestration” means in practice
A user can answer, at any moment:
1. Which node is currently running?
2. Is Codex or Claude currently working?
3. What artifact was produced or blocked?
4. What gate is waiting, and why?

---

## 5) Phased Build Plan

## P0 — Demo (prove concept)
Goal: demonstrate observable Codex+Claude collaboration on one personality update.

Scope:
- static pipeline template with 6–8 nodes
- event panel showing provider-labeled lifecycle events
- versioned personality profile write
- manual rollback command

Exit criteria:
- user can run one mission and visually track both providers
- one-click rollback restores previous personality version

## P1 — Usable (team-ready)
Goal: regular workflow for user-guided personality tuning.

Scope:
- mission pack templates (e.g., “more concise”, “stricter reviewer”, “more planning upfront”)
- approval checkpoint before applying trait deltas
- automated regression checks against baseline behavior set
- richer event metadata and artifact drill-down

Exit criteria:
- repeatable evolution runs with approval + rollback
- stable runbook for local and staging

## P2 — Hardened (production candidate)
Goal: safety, reliability, and governance.

Scope:
- policy checks for prohibited drift
- signed/evidenced trait changes
- stronger failure recovery and resume
- audit export (timeline + artifact references)

Exit criteria:
- no unapproved trait mutation
- deterministic rollback across recent versions
- auditable mission history

---

## 6) Guardrails (non-negotiable)

1. **User-guided evolution only**
   - no background personality mutation
   - no hidden self-optimization loops

2. **Reversible state**
   - every applied delta references prior stable version
   - rollback is operationally simple and tested

3. **No autonomous goals**
   - mission objective originates from user instruction
   - system cannot invent durable goals outside mission scope

4. **Transparent reasoning artifacts**
   - planner/trait/risk outputs are visible in run artifacts
   - failed gates are shown with actionable reasons

5. **Scoped memory updates**
   - only approved trait fields are persisted
   - non-approved recommendations remain advisory only

---

## 7) Definition of Done for this initiative

This initiative is successful when:
- users can intentionally evolve Spark personality from the UI,
- Codex and Claude parallel roles are visible in real time,
- every applied change is auditable and rollbackable,
- and the system remains explicitly non-autonomous in goal formation.
