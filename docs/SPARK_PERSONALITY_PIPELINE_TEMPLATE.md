# SPARK Personality Pipeline Template

This template is a concrete Spawner node graph for visible personality evolution missions.

## 1) Node Graph (reference DAG)

```text
planner
  -> trait-modeler
      -> codex-impl -----------\
      -> claude-review (spec) --+-> tester -> integrator
      -> doc-writer -----------/

codex-impl -> claude-review (code) -> tester
```

Suggested synchronization points:
- **Sync A**: `trait-modeler` output must be frozen before parallel lanes start.
- **Sync B**: `tester` waits for both code-review pass + docs artifact.
- **Sync C**: `integrator` waits for test report + docs + approved trait delta.

---

## 2) Node Definitions

## Node: `planner`
- **Role**: Convert user intent into mission objective + acceptance criteria.
- **Inputs**:
  - user prompt
  - current personality profile
  - previous run outcomes
- **Outputs**:
  - mission brief
  - measurable acceptance criteria
  - risk notes
- **Success criteria**:
  - objective is testable
  - boundaries are explicit
  - rollback requirement declared

## Node: `trait-modeler`
- **Role**: Transform objective into constrained trait delta proposal.
- **Inputs**:
  - mission brief
  - personality profile vN
  - guardrail policy
- **Outputs**:
  - `trait_deltas_vN+1` draft
  - expected behavior shifts
  - non-goals and constraints
- **Success criteria**:
  - delta is minimal + scoped
  - every change maps to objective
  - reversible patch metadata included

## Node: `codex-impl`
- **Role**: Implement required prompt/config/code adjustments.
- **Inputs**:
  - approved trait delta draft
  - implementation constraints
  - codebase context
- **Outputs**:
  - code/config diff
  - test additions/updates
  - implementation notes
- **Success criteria**:
  - diff compiles/runs
  - no unrelated edits
  - changes trace to trait delta

## Node: `claude-review`
- **Role**: Perform quality/safety review on spec and implementation.
- **Inputs**:
  - mission brief + trait delta
  - Codex diff
  - guardrail checklist
- **Outputs**:
  - review verdict (pass/fail)
  - requested revisions
  - safety rationale
- **Success criteria**:
  - no boundary violations
  - review comments are actionable
  - approval/reject decision is explicit

## Node: `tester`
- **Role**: Validate behavioral outcomes against acceptance criteria.
- **Inputs**:
  - merged candidate changes
  - regression test suite
  - behavior rubric
- **Outputs**:
  - test report
  - regression summary
  - confidence score
- **Success criteria**:
  - all critical tests pass
  - no unacceptable regressions
  - report links each test to objective

## Node: `doc-writer`
- **Role**: Emit user-facing explanation of what changed and why.
- **Inputs**:
  - mission objective
  - trait delta
  - test/review outcomes
- **Outputs**:
  - change summary
  - rollback instructions
  - known limitations
- **Success criteria**:
  - plain-language explanation
  - rollback steps verified
  - boundaries reiterated

## Node: `integrator`
- **Role**: Final gate and packaging of approved evolution state.
- **Inputs**:
  - tester report
  - claude-review verdict
  - doc-writer summary
  - trait delta version refs
- **Outputs**:
  - finalized `personality_profile_vN+1`
  - audit bundle
  - rollback pointer
- **Success criteria**:
  - all prerequisite nodes succeeded
  - state is versioned + reversible
  - mission completion event emitted

---

## 3) Parallel Lanes

## Lane 1: Build lane (Codex-heavy)
`trait-modeler -> codex-impl -> tester`

Purpose:
- ship concrete implementation
- produce executable/testable artifacts

## Lane 2: Quality lane (Claude-heavy)
`trait-modeler -> claude-review -> tester`

Purpose:
- prevent unsafe or low-quality drift
- enforce product boundaries

## Lane 3: Communication lane
`trait-modeler -> doc-writer -> integrator`

Purpose:
- keep user-facing visibility and rollback instructions current

---

## 4) Synchronization & Gate Rules

1. **Gate G1 (before parallel start)**
   - planner + trait-modeler must both succeed.

2. **Gate G2 (pre-test gate)**
   - codex-impl complete
   - claude-review status = pass or pass-with-minor-actions

3. **Gate G3 (release gate)**
   - tester status = pass
   - doc-writer artifact present
   - user approval flag set (for persistent personality update)

4. **Failure behavior**
   - Any hard fail routes to integrator as `blocked` with reasons.
   - Integrator produces “no-apply” outcome + rollback-safe state.

---

## 5) Eventing Requirements Per Node

Each node should emit:
- `task_started` (node id, provider, mission id)
- `task_progress` (0-100, short step message)
- `task_completed` (artifact refs)
- `task_failed` (error + remediation hint)

Provider mapping recommendation:
- `codex-impl` -> provider `codex`
- `claude-review`, `doc-writer`, optional `planner` -> provider `claude`
- `tester`, `integrator` -> platform/runtime executor
