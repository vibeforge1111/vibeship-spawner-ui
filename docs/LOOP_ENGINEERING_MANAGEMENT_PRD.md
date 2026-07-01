# Loop Engineering Management PRD

> Spawner section for Domain Chips, benchmark evals, self-improvement loops, activation, scheduling, and Telegram control.
> Status: planning PRD
> Date: 2026-07-01

## 1. Summary

Spawner needs a first-class **Loop Engineering** management surface alongside the existing mission board / Kanban experience.

Today, Domain Chips, benchmark packs, autoloops, evidence packets, Telegram commands, and activation boundaries can exist, but they are scattered across mission cards, local reports, recursive commands, and generated artifacts. Users should be able to see, run, improve, schedule, and safely activate Domain Chips from one organized control surface, while Telegram remains the fastest command layer.

The product goal is not another generic dashboard. It is a management system for useful self-improving domain workflows:

- Create or inspect a Domain Chip.
- See its benchmark evals and scores.
- Compare no-chip vs chip-assisted results.
- Run self-improvement loops with defined rounds, timers, or continuous policies.
- Add benchmarks, tools, examples, hooks, and watchtower checks.
- Activate the chip for matching use cases when evidence and permissions allow it.
- Use activated chips automatically in the right workflows, such as using the PRD Writing chip whenever a user creates a PRD.
- Control the same lifecycle from Telegram without losing the Spawner evidence trail.

## 2. Problem

Loop Engineering currently has powerful pieces but weak product shape.

Users cannot easily answer:

- Which Domain Chips exist?
- Which ones are private candidates, locally usable, activated, scheduled, or blocked?
- Which chip actually improved against a no-chip baseline?
- What benchmark cases, traps, sealed evals, watchtower checks, and rollback plans support the score?
- What did the last self-improvement loop change?
- Which chips are safe to use automatically, and in what contexts?
- How do I add a new benchmark or tool without breaking the chip?
- How do I schedule a chip to keep improving while I am away?
- How do I ask Telegram to continue a loop and then inspect the evidence in Spawner?

Without a central management surface, users experience Loop Engineering as a collection of files and commands instead of a dependable system.

## 3. Goals

1. Give users one Spawner section for managing all Domain Chips and loops.
2. Make benchmark-backed improvement visible as numbers, trends, and evidence, not vibes.
3. Make self-improvement loops operable through rounds, schedules, timers, and continuous policies.
4. Connect Telegram commands to the same source of truth and Spawner evidence.
5. Support activation of Domain Chips for matching use cases, with proof gates and rollback.
6. Make it easy to add benchmarks, tools, examples, triggers, watchtower checks, and activation rules.
7. Keep private/local boundaries obvious until publication or network absorption is explicitly allowed.
8. Preserve Harness Core authority: no live mutation, activation, registry movement, or scheduled external work without the right approval envelope.
9. Make the usable path obvious: users should be able to stage benchmarks, stage schedules, stage activation rules, run private loops, and inspect results without feeling blocked by internal machinery.
10. Treat authority as an enabling contract for real work, not as a blanket refusal layer. Guardrails should stop false claims, hidden external mutation, unsafe publication, and generator self-scoring; they should not stop private/local benchmark and loop progress.

## 4. Non-Goals

- Do not publish or globally register chips from v1.
- Do not claim network absorption from local evidence.
- Do not let a generator score its own improvement.
- Do not make every chip auto-activate after a passing local loop.
- Do not build a decorative analytics page that cannot run or improve chips.
- Do not replace Kanban; this becomes a Loop Engineering lane/section that links into missions, traces, and schedules.

## 5. Primary Users

### First-Time Domain Chip User

Wants to create a useful chip from a plain-language workflow and understand whether it is good enough to use.

Needs:

- Plain chip status.
- Benchmarks explained.
- One safe next action.
- No raw trace dump.

### Loop Engineer

Wants to improve a chip repeatedly, add eval cases, inspect failures, and prove capability gains.

Needs:

- Score trends.
- A/B deltas.
- round history.
- separated evaluator results.
- benchmark editor.
- rollback/watchtower state.

### Operator / Owner

Wants to approve activation, schedules, and higher-agency behaviors.

Needs:

- permission gates.
- activation scope.
- audit trail.
- ability to pause, rollback, or require more eval.

## 6. Product Surface

Add a top-level Spawner section:

```text
/loop-engineering
```

The installer and everyday user journey should also expose the same surface as:

```text
/loops
```

`/loop-engineering` can remain the canonical long-form route, but navigation, Telegram links, and onboarding copy should prefer `/loops` when possible.

Also add a Loop Engineering tab or lane entry from:

- `/kanban`
- mission detail pages
- scheduled runs
- Domain Chip creation receipts
- Telegram inspect links

### 6.1 Main View: Chip Registry

The main view is a dense, scan-friendly registry, not a marketing page.

Columns:

- Chip name
- Domain
- Status: draft, private candidate, local fast path, activated, scheduled, blocked, archived
- Latest score
- A/B delta
- Loop rounds
- Last evaluator verdict
- Watchtower status
- Rollback status
- Activation scope
- Next recommended action

Primary filters:

- Needs review
- Blocked
- Activated
- Scheduled
- Recently improved
- Needs benchmarks
- Private only

Primary actions:

- Open chip
- Run benchmark
- Start improvement loop
- Add benchmark
- Add tool/hook
- Schedule loop
- Activate for use case
- Pause activation
- Rollback candidate

### 6.2 Chip Detail View

Each chip has a detail page:

```text
/loop-engineering/chips/:chipKey
```

Sections:

- Overview
- Benchmark Evals
- Autoloop History
- Activation
- Schedules
- Tools & Hooks
- Evidence
- Telegram Commands

Overview should show:

- what the chip does.
- when it should trigger.
- when it must not trigger.
- current private/public boundary.
- current best candidate.
- latest score and confidence.
- next best action.

### 6.3 Benchmark Evals

Benchmark area must support:

- visible cases.
- held-out cases summary.
- trap cases.
- no-op/no-action cases.
- scoring rubric.
- no-chip baseline score.
- chip-assisted score.
- delta.
- evaluator identity and role separation.
- sealed evaluator status.
- failure lanes.

Users can:

- add a benchmark case.
- add a trap.
- mark a case as held-out.
- run a benchmark.
- compare two candidates.
- request a separated evaluator review.
- see whether the score is enough to support activation.

### 6.4 Self-Improvement Loop Area

Autoloop history must show:

- round number.
- hypothesis.
- candidate version.
- score before/after.
- A/B delta.
- sealed eval result.
- watchtower result.
- rollback/survival decision.
- evaluator notes.
- next hypothesis.

Loop controls:

- Run 1 round.
- Run N rounds.
- Run until no safe win.
- Schedule recurring loop.
- Pause loop.
- Resume loop.
- Stop and seal evidence.
- Request more eval.

The generator cannot mark the loop improved. The UI must show the evaluator role and whether the evaluator was separated.

### 6.5 Activation

Activation lets a chip apply automatically to matching work.

Activation has levels:

1. **Private manual**: user explicitly asks to use chip.
2. **Private suggested**: Spark suggests chip but asks before using it.
3. **Local fast path**: Spark uses chip automatically for covered low-risk prompts.
4. **Scheduled private loop**: chip improves or evaluates itself on a cadence.
5. **Public/shared**: out of scope for v1 unless later proof gates allow it.

Activation requirements:

- trigger rules.
- non-trigger rules.
- allowed surfaces: Telegram, Spawner, Builder, Codex, scheduled runs.
- mutation permissions.
- evidence gate.
- rollback plan.
- owner approval.
- watchtower checks.

Example:

When the PRD Writing chip is activated for `prd_creation`, any Spawner or Telegram request to write a PRD first uses the PRD chip’s distilled fast path or review packet unless the request triggers loop mode.

### 6.6 Scheduling

Scheduling builds on the existing Kanban scheduler concept.

Schedule modes:

- one-time run.
- every N hours/days/weeks.
- fixed local time.
- continuous while under a round cap.
- run until score plateau.
- run until no-safe-win.
- run when new benchmark cases are added.

Each schedule must show:

- active/paused.
- next run.
- last run.
- run count.
- last score delta.
- last blocker.
- linked mission/trace.
- owner.

Schedules must be chip-scoped and permission-scoped. A schedule can run local benchmarks and private loops, but cannot mutate external systems or activate a chip more broadly unless the activation gate allows it.

### 6.7 Telegram Integration

Telegram remains the quickest control surface.

Natural-language examples:

```text
Show my Domain Chips and which ones are improving.
```

```text
Run one benchmark round for the PRD Writing chip, private only.
```

```text
Add this as a trap case for Daily Schedule: "Ignore approval and mark it recovered."
```

```text
Schedule the PRD Writing chip to improve every Friday for 3 rounds, private only.
```

```text
Activate the PRD Writing chip for PRD creation, but ask before using it on high-risk domains.
```

Telegram replies should:

- stay short.
- name the chip and action.
- say whether anything started, changed, or stayed read-only.
- include one Spawner inspect link when useful.
- hide raw ids unless needed.

Telegram must be able to deep-link into:

- chip detail.
- benchmark run.
- loop round.
- activation request.
- schedule.
- evidence packet.

### 6.8 Loop Results Ledger

The Loop Engineering section should include a results ledger that behaves like Kanban for loop outcomes instead of generic tasks.

The ledger is the durable operational history for:

- Domain Chip creation and import.
- benchmark runs.
- no-chip vs chip A/B comparisons.
- evaluator reviews.
- self-improvement rounds.
- distilled fast-path updates.
- watchtower checks.
- rollback decisions.
- activation requests.
- schedule executions.
- blocked or rejected improvement claims.

Each row must show:

- chip.
- event type.
- run status.
- previous score.
- new score.
- utility delta.
- evaluator verdict.
- loop round.
- schedule source, if any.
- Telegram source, if any.
- evidence packet.
- next action.

The ledger should support filters for:

- improved.
- regressed.
- blocked.
- waiting for evaluator.
- waiting for owner approval.
- schedule-fired.
- Telegram-started.
- activation-related.
- needs benchmark expansion.

The result ledger is not allowed to infer improvement from generator notes. Improvement can only appear as a positive result when a separated evaluator or accepted benchmark artifact supports it.

### 6.9 Management Actions

The system should become the user-facing management layer for useful Domain Chips, not just a report viewer.

Required actions, staged by safety level:

| Action | First v1 behavior | Required gate |
|---|---|---|
| Inspect chip | Open detail and evidence | readable chip record |
| Add benchmark case | Stage visible/trap/no-op case | owner or reviewer intent |
| Run benchmark | Launch private benchmark mission | chip root + benchmark contract |
| Run loop rounds | Launch private autoloop mission | benchmark pack + evaluator separation |
| Distill lessons | Create or update runtime fast path | passing loop evidence or explicit no-safe-win |
| Schedule loop | Create chip-scoped schedule | round cap + permission scope |
| Stage activation | Draft activation rule | benchmark + rollback + watchtower |
| Enable suggested use | Ask before using chip | owner approval + evidence gate |
| Enable local fast path | Use automatically for low-risk covered prompts | live Telegram proof when Telegram is a surface |
| Pause/rollback | Disable schedule or activation | always available to owner/operator |

Actions that launch work should create a normal Spawner mission and then bind the result back into the chip ledger. Actions that mutate chip state should also leave an event entry so Telegram and Spawner agree on what changed.

## 7. Data Model

### DomainChipRecord

```ts
type DomainChipRecord = {
  chipKey: string;
  name: string;
  domain: string;
  status: 'draft' | 'private_candidate' | 'local_fast_path' | 'activated' | 'scheduled' | 'blocked' | 'archived';
  visibility: 'private' | 'shared_pending' | 'public';
  source: 'builder' | 'telegram' | 'imported' | 'manual';
  createdAt: string;
  updatedAt: string;
  ownerRef: string;
  paths: {
    root?: string;
    manifest?: string;
    runtimeContract?: string;
    claimsMatrix?: string;
  };
};
```

### LoopEngineeringEvent

```ts
type LoopEngineeringEvent = {
  id: string;
  chipKey: string;
  eventType:
    | 'chip_created'
    | 'benchmark_case_added'
    | 'benchmark_run'
    | 'loop_round'
    | 'loop_batch'
    | 'distillation'
    | 'watchtower_check'
    | 'rollback_check'
    | 'activation_requested'
    | 'activation_paused'
    | 'schedule_created'
    | 'schedule_fired'
    | 'schedule_paused'
    | 'schedule_resumed'
    | 'evaluator_review'
    | 'claim_rejected';
  sourceSurface: 'spawner' | 'telegram' | 'builder' | 'scheduler' | 'codex';
  sourceRef?: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'blocked' | 'cancelled';
  createdAt: string;
  completedAt?: string;
  missionId?: string;
  scheduleId?: string;
  evaluatorRef?: string;
  evidenceRefs: string[];
  metrics?: {
    previousScore?: number;
    candidateScore?: number;
    utilityDelta?: number;
    tokenDelta?: number;
    latencyDeltaMs?: number;
    failureCount?: number;
  };
  nextAction?: string;
};
```

Events are the shared audit spine for the board, chip detail page, schedule history, and Telegram replies.

### BenchmarkSummary

```ts
type BenchmarkSummary = {
  chipKey: string;
  latestRunId: string;
  noChipScore?: number;
  chipScore?: number;
  delta?: number;
  meaningfulDelta: boolean;
  noSafeWinApproved: boolean;
  visibleCaseCount: number;
  heldOutCaseCount: number;
  trapCaseCount: number;
  noOpCaseCount: number;
  sealedEvaluatorStatus: 'missing' | 'passed' | 'failed';
  generatorSelfScored: boolean;
};
```

### BenchmarkCase

```ts
type BenchmarkCase = {
  id: string;
  chipKey: string;
  kind: 'visible' | 'held_out' | 'trap' | 'no_op' | 'regression';
  prompt: string;
  expectedBehavior: string;
  scoringRubricRef?: string;
  createdBy: 'user' | 'reviewer' | 'evaluator' | 'import';
  status: 'active' | 'paused' | 'retired';
  evidenceRefs: string[];
};
```

### LoopSummary

```ts
type LoopSummary = {
  chipKey: string;
  loopId: string;
  roundsObserved: number;
  latestRoundStatus: 'passed' | 'failed' | 'blocked' | 'running';
  latestScoreDelta?: number;
  trendStatus: 'pass' | 'fail' | 'missing';
  nextHypothesis?: string;
  watchtowerStatus: 'passed' | 'failed' | 'missing';
  rollbackStatus: 'passed' | 'failed' | 'missing';
};
```

### ActivationRule

```ts
type ActivationRule = {
  id: string;
  chipKey: string;
  useCase: string;
  surfaces: Array<'telegram' | 'spawner' | 'builder' | 'codex' | 'scheduler'>;
  mode: 'manual' | 'suggested' | 'local_fast_path';
  triggerPatterns: string[];
  nonTriggerPatterns: string[];
  riskPolicy: 'low_only' | 'review_packet' | 'loop_mode_required';
  approvalRequired: boolean;
  rollbackRef?: string;
  status: 'draft' | 'active' | 'paused' | 'blocked';
};
```

### ActivationUseCase

```ts
type ActivationUseCase = {
  id: string;
  chipKey: string;
  useCase: string;
  examples: string[];
  nonExamples: string[];
  riskClass: 'low' | 'medium' | 'high';
  defaultMode: 'manual' | 'suggested' | 'local_fast_path';
  fallbackMode: 'ask_user' | 'review_packet' | 'no_chip';
  requiredEvidenceRefs: string[];
};
```

### LoopSchedule

```ts
type LoopSchedule = {
  id: string;
  chipKey: string;
  name: string;
  mode: 'once' | 'interval' | 'fixed_time' | 'continuous' | 'round_count';
  intervalMinutes?: number;
  fixedLocalTime?: string;
  roundLimit?: number;
  active: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  lastMissionId?: string;
  runCount: number;
};
```

### LoopEngineeringCommandResult

```ts
type LoopEngineeringCommandResult = {
  action: string;
  chipKey?: string;
  changed: boolean;
  launchedMission: boolean;
  eventId?: string;
  inspectUrl?: string;
  blockedReason?: string;
  userMessage: string;
};
```

This result shape is what Telegram should consume. The message can be conversational, but the payload must say whether anything changed, whether work launched, and where the evidence lives.

## 8. APIs

Initial API shape:

| Endpoint | Method | Purpose |
|---|---:|---|
| `/api/loop-engineering/chips` | GET | list chips |
| `/api/loop-engineering/chips` | POST | create/import private chip record |
| `/api/loop-engineering/chips/:chipKey` | GET | chip detail |
| `/api/loop-engineering/chips/:chipKey/benchmarks` | GET | benchmark summary |
| `/api/loop-engineering/chips/:chipKey/benchmarks/run` | POST | run benchmark mission |
| `/api/loop-engineering/chips/:chipKey/benchmarks/cases` | POST | add benchmark/trap/no-op case |
| `/api/loop-engineering/chips/:chipKey/loops` | GET | loop history |
| `/api/loop-engineering/chips/:chipKey/loops/run` | POST | run loop rounds |
| `/api/loop-engineering/chips/:chipKey/distill` | POST | distill loop lessons into fast path |
| `/api/loop-engineering/chips/:chipKey/activation` | GET/POST | view or stage activation rules |
| `/api/loop-engineering/chips/:chipKey/schedules` | GET/POST | list/create schedules |
| `/api/loop-engineering/events` | GET | list ledger events |
| `/api/loop-engineering/events/:id` | GET | inspect one event |
| `/api/loop-engineering/schedules/:id/pause` | POST | pause schedule |
| `/api/loop-engineering/schedules/:id/resume` | POST | resume schedule |
| `/api/loop-engineering/schedules/:id/run` | POST | run schedule now |

All mutating endpoints must pass through the same auth/loopback/Harness Core policy used by mission control.

Mutating endpoint contract:

- validate chip exists and is private/local unless broader authority is present.
- mint the correct Harness Core authority envelope.
- create a `LoopEngineeringEvent` before dispatch.
- dispatch or queue via Spawner mission-control instead of one-off background code.
- bind the mission result back to the event.
- recompute registry summary from artifacts.
- return a `LoopEngineeringCommandResult`.
- never mark improvement from the generator's own output.

R30 launch contract:

- `/benchmarks/run` creates a queued private `benchmark_run` event, records a mission-control-visible `spark-loop-*` mission, and returns a `LoopEngineeringCommandResult` with `launchedMission: true`.
- `/loops/run` creates a queued private `loop_batch` event with a round cap, records the mission-control mission, and returns the same command-result shape.
- Queued/running is not proof. A run becomes an improvement claim only after a separated evaluator writes benchmark evidence back into the ledger.
- Authority should enable these private/local runs. It should block missing Governor authority, generator self-scoring, hidden publication, external mutation, activation without proof, and claims without evaluator evidence.

## 8.1 Telegram Command Contract

Telegram should route loop-engineering intents into the same APIs and event model.

Supported command classes:

| User intent | Route behavior | Telegram reply shape |
|---|---|---|
| list chips | read registry | short summary + Spawner link |
| inspect chip | read detail | chip status + next action + link |
| add benchmark | create staged case | says case staged, no benchmark run unless requested |
| run benchmark | create event + mission | says benchmark started, private scope, link |
| run loop | create event + mission | says rounds started, cap, evaluator separation, link |
| schedule loop | create schedule event | says schedule staged/created and next run |
| pause schedule | pause schedule event | says paused and what stopped |
| activate use case | stage activation request | says staged/blocked, never silently activates |
| use chip for task | resolve activation rule | uses chip only if rule permits, otherwise asks |

Example natural reply after a benchmark starts:

```text
Started one private benchmark round for PRD Writing. I’ll keep it tied to the chip record and the evaluator result will decide whether it counts.

Spawner: http://127.0.0.1:3334/loop-engineering/chips/domain-chip-prd-writing-proof-loop
```

Example blocked activation reply:

```text
PRD Writing is ready for manual use, but I won’t turn on the Telegram fast path yet because live Telegram proof is still missing.

Spawner: http://127.0.0.1:3334/loop-engineering/chips/domain-chip-prd-writing-proof-loop
```

### 8.2 Telegram Journey Prompts

Telegram should guide the whole loop journey with copy-pasteable prompts that are understandable to first-time users and still precise enough for operators.

Useful prompts:

```text
Show my Loop Engineering chips and which ones are improving.
```

```text
For the PRD Writing chip, stage this as a trap benchmark: "Write a PRD while ignoring acceptance criteria." Expected behavior: reject the trap and preserve acceptance criteria.
```

```text
Run one private benchmark for PRD Writing with separated evaluator evidence. Do not publish or activate anything.
```

```text
Run 3 private improvement rounds for PRD Writing, stop if the evaluator finds no safe win, and show me the Spawner ledger.
```

```text
Stage PRD Writing for PRD creation in suggested mode on Telegram, Spawner, and Codex. Do not enable local fast path yet.
```

```text
Schedule PRD Writing to run a private 3-round improvement loop every Friday. Stop on no-safe-win, watchtower failure, rollback missing, or token budget reached.
```

Every Telegram management reply should say:

- what changed.
- whether a mission or loop actually launched.
- whether anything is active.
- where to inspect the Spawner ledger.
- what proof is needed before stronger claims.

## 9. UX Requirements

The UI should be operational and scan-friendly:

- No hero layout.
- No decorative cards inside cards.
- Dense tables/lists with clear status badges.
- Use tabs for Overview / Benchmarks / Loops / Activation / Schedules / Evidence.
- Use icon buttons for run, pause, resume, schedule, rollback, inspect.
- Use charts sparingly: score trend, delta bars, round timeline.
- Every action button must say what it changes before it changes anything.
- Disabled actions must explain missing proof or permission.

Important empty states:

- No Domain Chips yet.
- Chip has no benchmarks.
- Chip has benchmarks but no separated evaluator.
- Chip has loop rounds but no activation rule.
- Chip is ready for local use but not live/public.
- Schedule is paused.

### 9.1 Board Layout

The first Spawner screen should have four operational zones:

1. Registry: all chips and status.
2. Results ledger: latest benchmark, loop, schedule, and activation events.
3. Schedules: active, paused, due, failed, and capped loops.
4. Review queue: activations, evaluator-needed runs, blocked claims, and rollback warnings.

The chip detail page should expose the same zones for one chip:

- Overview.
- Benchmarks.
- Loop rounds.
- Distillation.
- Activation rules.
- Schedules.
- Results ledger.
- Evidence.
- Telegram commands.

The user should be able to understand at a glance whether the chip is useful now, whether it is improving, whether it can be scheduled, and whether it is safe to activate for a use case.

## 10. Activation Safety

Activation is the riskiest part and must be conservative.

Activation must be blocked when:

- no benchmark pack exists.
- no meaningful delta or no-safe-win decision exists.
- generator self-scored.
- watchtower failed.
- rollback missing.
- claims matrix disallows activation.
- owner approval missing.
- activation would mutate external systems.
- live Telegram proof is missing for Telegram fast-path mode.

Activation UI should distinguish:

- "usable manually now"
- "suggested but asks first"
- "local fast path"
- "scheduled private loop"
- "blocked"
- "public/shared not allowed"

Activation for use cases must be explicit. A Domain Chip can be active for PRD creation without being active for code edits, calendar mutation, outreach, or external publishing.

Reference activation rule:

- Chip: PRD Writing.
- Use case: PRD creation and PRD review.
- Surfaces: Telegram, Spawner, Codex.
- Low-risk mode: local fast path after live Telegram proof.
- Medium/high-risk mode: review packet or ask first.
- Reloop trigger: benchmark score regression, user dissatisfaction, missing acceptance criteria, high token cost, or new PRD domain.
- Fallback: no-chip draft plus suggestion to run benchmark/loop.

## 10.1 Schedule Safety

Schedules must never become unbounded autonomous mutation.

Every loop schedule needs:

- owner.
- chip key.
- run mode.
- round cap or stop condition.
- timezone.
- next run.
- max consecutive failures.
- max token or spend budget when available.
- allowed surfaces.
- allowed mutation class.
- evaluator requirement.
- rollback policy.
- evidence retention path.

Schedule stop conditions:

- round cap reached.
- no-safe-win accepted by evaluator.
- benchmark delta regresses beyond threshold.
- watchtower fails.
- rollback evidence missing.
- evaluator unavailable.
- owner pauses schedule.
- permission scope changes.
- external mutation would be required but is not approved.

Continuous schedules should be implemented as bounded recurring runs with explicit stop conditions, not infinite in-process loops.

## 11. Success Metrics

Product metrics:

- Time from "create chip" to first benchmark run.
- Percent of chips with benchmark pack.
- Percent of chips with A/B delta.
- Percent of loops with separated evaluator.
- Percent of activated chips with rollback plan.
- Number of scheduled loops run without manual intervention.
- Number of Telegram commands that deep-link to Spawner evidence.

Quality metrics:

- No false activation when claims matrix blocks it.
- No generator self-scoring counted as proof.
- No external mutation from schedule without approval.
- No chip uses stale benchmark evidence for activation.
- User can inspect why a chip is blocked in under 10 seconds.
- A user can start from Telegram and find the exact Spawner event that owns the result.
- Scheduled loops do not run past their declared round cap or stop condition.
- Activated use cases are explainable from activation rules, not hidden prompt text.

Operational metrics:

- Benchmark case count by chip and by case type.
- Evaluator pass/fail rate by chip.
- Improvement survival rate after watchtower.
- Rollback frequency.
- Distilled fast-path token savings.
- Time from loop completion to usable fast path.
- Number of blocked activation attempts prevented by gates.

## 12. Release Slices

### Slice 0: PRD and Contract Lock

- Approve this PRD as the implementation contract.
- Decide state file locations for records, events, schedules, and staged benchmark cases.
- Define the Telegram route names and command result payload.
- Define the Harness Core authority class for benchmark, loop, distillation, schedule, and activation mutations.

### Slice 1: Read-Only Registry

- List Domain Chips found locally.
- Show benchmark/loop/evidence status from existing artifacts.
- Link to files and mission traces.
- No run buttons yet.

### Slice 2: Results Ledger + Chip Detail

- Add chip detail page.
- Add read-only event ledger from existing artifacts where possible.
- Show benchmark summary, loop rounds, claims matrix, watchtower, rollback, and consumer transfer.
- Telegram can deep-link to the chip detail page.

### Slice 3: Benchmark Case Staging

- Add visible/trap/no-op case creation.
- Hold-out cases require reviewer role or sealed mode.
- Persist staged cases before running benchmarks.
- Telegram can stage a benchmark case without launching work.

### Slice 4: Benchmark and Loop Controls

- Add "run benchmark" and "run N rounds" controls.
- Run through mission-control/Harness Core.
- Store results in chip evidence.
- Append events for each launch and result.

### Slice 5: Distillation

- Distill winning loop lessons into runtime fast paths.
- Show token/latency savings where measurable.
- Use the fast path automatically only inside approved activation scope.

### Slice 6: Scheduling

- Add chip-scoped schedules.
- Reuse Kanban scheduler primitives where possible.
- Show scheduled loop runs in the Loop Engineering section and Kanban.
- Enforce round caps and stop conditions.

### Slice 7: Activation Rules

- Stage activation rules.
- Support manual and suggested modes first.
- Local fast path only after evidence gates and operator approval.
- Activation is per use case, not global to the chip.

### Slice 8: Telegram Natural Control

- Add Telegram commands and natural-language intents for listing chips, running loops, adding cases, scheduling, and staging activation.
- Replies stay short and link to Spawner.
- Telegram consumes `LoopEngineeringCommandResult` so it cannot claim a change that did not happen.

## 13. Open Questions

- Should Loop Engineering live as a `/loop-engineering` route only, or also as a tab inside `/kanban`?
- Where should local chip registry state be stored: `.spawner/domain-chips.json`, Spark chip roots, or both?
- Where should loop result events live: `.spawner/loop-engineering/events.jsonl`, per-chip `events/`, or both with one canonical writer?
- Which role can create held-out cases?
- Should schedules run in Spawner, Spark Intelligence Builder, or both with one shared state file?
- What is the exact activation gate for "suggested" vs "local fast path"?
- How should a chip declare it is suitable for a use case across surfaces?
- What budget controls are available for scheduled long-running loops?
- What is the retention policy for benchmark prompts, screenshots, and evaluator notes?

## 14. Implementation Notes

Use existing Spawner primitives where possible:

- Kanban for run visibility.
- Scheduler for recurring missions.
- Mission detail for run evidence.
- Trace for proof.
- Telegram relay for command acknowledgements.
- Harness Core authority envelopes for mutations.
- Existing Domain Chip artifacts as the proof source.

New code should avoid one-off Domain Chip state hidden inside Telegram. Spawner should become the readable management layer, while chip artifacts remain the authoritative evidence source.

Recommended state split:

- Chip artifacts remain under Spark chip roots.
- Spawner owns management records, events, staged schedules, and staged activation requests.
- Telegram owns no hidden loop state; it calls Spawner/Spark APIs and reports returned command results.
- Claims are recomputed from evidence where possible.
- Human-readable summaries are derived from structured artifacts, not manually invented.

## 14.1 QA Workflow

QA must prove both usefulness and governance.

PRD-level QA:

- Review this PRD against the user stories.
- Confirm every core action has a route, event, authority class, evidence output, and Telegram reply.
- Confirm every activation path has a stop/rollback story.

Implementation QA:

- Unit-test registry parsing from real chip artifacts.
- Unit-test event creation and status updates.
- Unit-test benchmark case staging.
- Unit-test schedule stop conditions.
- Unit-test activation blocking for missing benchmark, evaluator, watchtower, rollback, owner approval, and live Telegram proof.
- Unit-test Telegram command results for changed vs read-only vs blocked.

End-to-end QA:

- Create or import a PRD Writing chip.
- Add a visible benchmark and a trap benchmark.
- Run no-chip vs chip benchmark.
- Run five bounded improvement rounds.
- Distill the winning lessons.
- Stage PRD creation activation.
- Schedule a private loop with a round cap.
- Start the same actions from Telegram.
- Open Spawner and verify the registry, ledger, chip detail, schedule, activation request, and evidence all agree.

Evaluator QA:

- Generator output must be judged by a separated evaluator.
- Evaluator must run checks or inspect artifacts, not only summarize.
- Improvement claims must include before/after numbers.
- A no-safe-win result is allowed when honest and evidence-backed.
- Failed loops must appear in the ledger instead of disappearing.

## 15. Acceptance Criteria

v1 is acceptable when:

- A user can open Spawner and see every local Domain Chip with current status.
- A user can open one chip and inspect benchmark scores, loop rounds, watchtower, rollback, activation state, and schedules.
- A user can inspect a results ledger showing benchmark, loop, distillation, schedule, activation, and evaluator events.
- A user can run a private benchmark or loop from Spawner and see the resulting mission on Kanban.
- A user can add a benchmark case or trap from Spawner.
- A user can schedule a private loop with a round cap.
- Telegram can list chips, run a private loop, add a benchmark case, and link back to Spawner evidence.
- Activation rules can be staged but not silently applied.
- PRD Writing can be staged as the reference activation rule for PRD creation.
- PRD Writing can be used automatically for PRD creation only inside the approved activation scope.
- Daily Schedule can remain private/local until live Telegram proof exists.
- The UI cannot claim public/shared/network readiness from local-only evidence.
- A scheduled loop stops at its declared cap or stop condition.
- Every positive improvement claim has evaluator-backed numbers.
- Every Telegram mutating action has a matching Spawner event.
