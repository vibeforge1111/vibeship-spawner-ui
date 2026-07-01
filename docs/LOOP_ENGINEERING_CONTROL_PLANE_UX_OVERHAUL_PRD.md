# Loop Engineering Control Plane UX Overhaul PRD

Status: planning PRD
Date: 2026-07-01
Owner surface: Spawner Loop Engineering

## Summary

Spawner should become the primary Loop Engineering control plane for Domain Chips, benchmark evals, private improvement loops, evaluator review, distillation, activation staging, schedules, and evidence inspection. Telegram should remain a fast command lane, but users must be able to understand, operate, and improve chips from Spawner without copying raw ids or relying on chat commands.

The current surface has real backend capability, but the UI reads like endpoint machinery. A first-time user sees dense ledgers, raw refs, and many mutation forms before they understand what a Domain Chip is, where the chip is in the proof chain, or what one safe next action should be.

## Audit Inputs

Three independent audits were run:

- Human onboarding/readability audit.
- Spawner design-system consistency audit.
- Control-plane capability completeness audit.

Key findings:

- The overview page says read-only while the detail page mutates state.
- The detail page exposes seven action groups at once.
- Raw ids, evidence refs, API links, and runtime internals are too prominent.
- Buttons bypass the size/variant contract and should use shared components.
- Status, gate, evidence, and success colors are duplicated locally.
- Tooltips rely on native `title` and do not explain core terms.
- Spawner can stage and execute local v1 packets, but cannot yet fully create chips, run provider-backed loops, inspect evidence contents inline, approve activations, or process recurring schedules.

## Product Goals

1. Give first-time users a clear mental model: Define -> Benchmark -> Improve -> Review -> Activate.
2. Make Spawner the full operator lane for everyday Loop Engineering work.
3. Group controls by phase and expose one recommended next action.
4. Explain core concepts with question-mark help affordances in Spawner style.
5. Replace ad hoc buttons/status colors/panels with reusable UI primitives.
6. Make evidence refs inspectable from Spawner instead of raw text only.
7. Keep private/local boundaries honest: local packet execution is not provider-backed autonomous execution.
8. Preserve Harness Core/Governor authority for all mutations.

## Non-Goals

- Do not publish, globally register, or network-absorb chips.
- Do not claim current synthetic `Run now` paths are full provider-backed loops.
- Do not auto-activate staged rules.
- Do not hide advanced evidence from operators; move it behind deliberate disclosure.

## Information Architecture

### Overview: `/loop-engineering`

Order:

1. Plain one-sentence definition of Domain Chips and Loop Engineering.
2. Five-step progress model: Define, Benchmark, Improve, Review, Activate.
3. Chip registry focused on domain, readiness, blocker, recommended next action, and Open.
4. Needs attention lane for blocked chips and missing proof.
5. Advanced evidence ledger behind an expandable section.

The overview must not call the entire section read-only. Use language like: "Inspect chips, run private evals, and stage safe improvements from Spawner."

### Detail: `/loop-engineering/[chipId]`

Order:

1. Header: domain, readiness, current boundary, one plain next step.
2. Recommended action panel: one primary action based on readiness.
3. Progress checklist: benchmark, loop, evaluator separation, rollback/watchtower, activation review.
4. Phase panels:
   - Benchmark suite.
   - Improve loop.
   - Evaluator review.
   - Distill learnings.
   - Activation.
   - Schedule.
5. Results timeline and evidence inspector.
6. Advanced/raw: API, runtime state, ids, refs, manual bind completion.

Phase panels should be collapsed or segmented so a new user is not presented with all forms at once.

## Required UI Primitives

Create or reuse shared components:

- `LoopHelp`: question-mark help trigger using `Tooltip`, with wrapping text.
- `StatusBadge`: shared mapping for passed/running/blocked/staged/private/local-fast-path.
- `GateBadge`: proof gate status with consistent status semantics.
- `ActionButton`: wrapper around `Button` with icon, loading, disabled, and proof-aware variants.
- `SectionPanel`: Spawner-style panel wrapper for page sections.
- `MetricTile`: consistent compact metric display.
- `ActionFormPanel`: collapsible action form with title, help, disabled reason, and footer button.
- `EvidenceRef`: truncated, copyable, inspectable evidence reference.
- `EvidenceInspector`: modal or panel for `control-plane:*`, mission refs, source keys, generator output, evaluator verdicts, summaries, and chip report files.

Avoid raw `class="btn text-sm"` and local success-green cards. Use shared variants.

## Help Text Priority

Add question-mark help for:

- Domain Chip.
- Benchmark delta.
- No-chip baseline.
- Candidate.
- Blind evaluation.
- Separated evaluator.
- Watchtower.
- Rollback.
- Proof auditor.
- Distillation.
- Activation rule.
- Private schedule.
- Queue vs Run now.
- Local packet execution vs provider-backed execution.

Help text must be short, conversational, and honest. Example:

`Run now`: "Runs the current local private packet evaluator immediately. It writes evidence but does not activate or publish the chip."

## Control-Plane Capability Improvements

### V1 UX Must Support

- Add benchmark case from Spawner.
- Select active benchmark cases for benchmark/loop runs.
- Run benchmark now from Spawner with evidence packet refs.
- Run loop now from Spawner with evidence packet refs.
- Record evaluator review without manually copying event ids when a run is eligible.
- Distill lessons from a selected evaluator review.
- Stage activation with configurable surfaces, not hard-coded Telegram + Spawner.
- Stage schedules with visible active/inactive boundary.
- Fire a staged schedule manually from Spawner.
- Inspect generated evidence packets inline.

### V1 Must Label As Staged/Local

- Synthetic local packet execution.
- Distillation that has not been applied to chip runtime artifacts.
- Activation rules that are not enabled.
- Schedules that do not yet recur automatically.

### Follow-Up Capability Backlog

- Create/import/edit/retire chips from Spawner.
- Edit/pause/retire benchmark cases.
- Provider-backed generator/evaluator jobs.
- Evidence ref existence validation for manual evaluator review.
- Apply distilled lessons to runtime artifacts with diff preview.
- Approve/enable/pause/rollback activation rules.
- Real recurring scheduler and due-run processor.

## Acceptance Criteria

### UX

- A first-time user can identify what Loop Engineering is, what state a chip is in, and the next safe action within 30 seconds.
- Detail page no longer shows all mutation forms at once.
- Raw ids and refs are hidden behind evidence/advanced disclosure unless needed.
- Queue/run-now distinction is explained where actions appear.
- All core terms listed above have hover/focus help.

### Design System

- Loop Engineering pages use shared `Button`, `Alert`, `Badge`, and new loop UI primitives.
- No raw `btn text-sm` action buttons remain in Loop Engineering pages.
- No ad hoc `bg-green-*` or semantically ambiguous success panels are added.
- `Tooltip` supports wrapping text for longer help copy.
- Layout works on desktop and mobile without text overlap.

### Control Plane

- Spawner can perform the same critical v1 loop path as Telegram: case -> benchmark execution -> loop execution -> evaluator review -> distillation -> staged activation.
- Operator can select evidence from eligible events rather than manually typing ids for normal paths.
- Evidence refs from generated benchmark/loop packets can be opened from Spawner.
- All mutating actions include Harness Core/Governor authority and retain private/local claim boundaries.

### QA

- Unit/route tests cover new action payloads and evidence inspection routes.
- Svelte check passes with zero errors/warnings.
- Browser/Playwright or equivalent visual smoke covers `/loop-engineering` and one chip detail page at desktop and mobile widths.
- A live or local smoke proves Spawner-only operation for the PRD Writing reference chip without Telegram.

## `/goal` Prompt

```text
/goal Build the Spawner Loop Engineering control-plane UX overhaul end to end. Use the PRD at docs/LOOP_ENGINEERING_CONTROL_PLANE_UX_OVERHAUL_PRD.md plus the existing management PRD and proof packet. Make Spawner the primary operator lane, with Telegram as a fast lane only.

Audit first, then implement in small commits. Redesign /loop-engineering and /loop-engineering/[chipId] around Define -> Benchmark -> Improve -> Review -> Activate. Add a clear first-time-user mental model, one recommended next action, phase panels, progressive disclosure, and advanced/raw evidence sections. Replace ad hoc controls with Spawner UI primitives: Button, Alert, Badge, Tooltip, plus loop-specific primitives for help, status/gate badges, action panels, metrics, and evidence refs. Add question-mark hover/focus help for core terms and for Queue vs Run now.

Make Spawner capable of the full v1 local/private path without Telegram: add/stage benchmark case, select cases, execute benchmark now, execute loop now, record evaluator review from eligible events, distill lessons, stage activation with selectable surfaces, stage/fire schedules, and inspect generated evidence packets. Keep local packet execution, distillation, activation, and schedules honestly labeled as local/staged unless actually enabled. Preserve Harness Core/Governor authority for every mutation.

Do not publish, globally activate, or network-absorb chips. Do not overclaim synthetic local packet execution as provider-backed autonomous execution. Add focused tests, Svelte check, and browser/visual smoke for desktop/mobile. Use evaluator agents for UX/design/control-plane review before final. Commit often and leave unrelated dirty files alone.
```
