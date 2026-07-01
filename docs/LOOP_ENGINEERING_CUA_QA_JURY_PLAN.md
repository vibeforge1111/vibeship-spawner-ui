# Loop Engineering CUA QA And Jury Plan

Date: 2026-07-01
Owner: Spark Domain Chip Labs / Spawner
Status: active QA plan; Spawner schedule lifecycle slice conditionally passed, Telegram parity still pending

Latest continuation packet:

- `docs/qa/loop-engineering-cua/2026-07-01/remaining-r30/progress-report.md`
- `docs/qa/loop-engineering-cua/2026-07-01/remaining-r30/next-goal-prompt.md`
- `docs/qa/loop-engineering-cua/2026-07-01/remaining-r30/artifacts/`

## Objective

Prove that the Loop Engineering control plane is usable, reliable, and evidence-bound across Spawner and Telegram Desktop for one complete domain-chip workflow:

- create or refine a domain chip
- add benchmark cases
- run benchmark evals
- run a self-improvement loop
- evaluate improvements with a separate jury
- distill learnings back into future chip behavior
- activate the chip from Spawner and Telegram where appropriate
- schedule or continue loops without losing evidence, authority, or user control

The target is not a shallow command smoke test. The target is a real operator journey that a new user can understand, manage, and trust from either surface.

## Surfaces Under Test

1. Spawner Loop Engineering control plane
   - `/loop-engineering`
   - `/loop-engineering/[chipId]`
   - benchmark staging, selection, run controls, loop controls, evaluator review, distillation, activation, scheduling, evidence inspection

2. Telegram Desktop
   - loop-engineering commands and natural-language requests
   - status and explanation replies
   - connected Spawner links
   - cross-surface state reflection

3. Server APIs and evidence ledger
   - benchmark run routes
   - loop run routes
   - evaluator-review routes
   - distillation routes
   - activation and schedule routes
   - evidence lookup routes

4. Harness Core, Governor, and authority boundaries
   - mission launch authority
   - file-write authority
   - evidence-bound mutation
   - private review and non-publish defaults

## Non-Negotiable Proof Rules

1. The worker agent never grades its own work.
   - A separate evaluator jury must inspect screenshots, event logs, API results, and evidence packets.
   - Worker notes can describe what happened, but cannot be accepted as the verdict.

2. Every improvement claim needs a source run.
   - Positive evaluator verdicts must point to a passed benchmark or loop source event for the same chip.
   - Distillation must be tied to a review that is itself tied to a source run.
   - Evidence references must be chip-scoped and traversal-safe.

3. Spawner and Telegram are equal control lanes.
   - Spawner must work without Telegram.
   - Telegram must show or link back to the same control-plane state.
   - Cross-surface disagreement is a release blocker.

4. Guardrails must be balanced.
   - The system should block fake proof, unsafe evidence, and authority drift.
   - The system should not block real self-improvement loops when evidence is present.
   - Any block must explain the next useful action.

5. Private stays private until explicitly activated.
   - Candidate chip packets, benchmark outputs, and jury verdicts remain local/private during QA.
   - No external API calls, global publication, or production activation unless the goal explicitly names it.

## QA Environment

Use production preview for browser CUA unless the dev server issue has been fixed.

- Known dev issue to verify or fix:
  - `npm run dev` previously hit `TypeError [ERR_INVALID_ARG_VALUE]` on `\x00virtual:__sveltekit/env`.
  - `npm run preview -- --host 127.0.0.1 --port <free-port>` previously worked.

- Browser CUA order:
  1. in-app browser if localhost is not blocked
  2. Playwright Chromium screenshots and interactions if the in-app browser blocks localhost
  3. record the fallback reason in the QA packet

- Telegram Desktop CUA order:
  1. inspect Telegram Desktop with Peekaboo or available desktop CUA
  2. capture annotated screenshots before and after every user-visible action
  3. record any connection issue separately from product failure

- Telegram availability definitions:
  - unavailable means Telegram Desktop is closed, logged out, offline, or CUA cannot inspect it.
  - connection failure means Telegram is visible but cannot confirm live Spark state.
  - product failure means Telegram is connected but gives stale, conflicting, unsafe, or misleading Spark state.

- Dev/preview release rule:
  - fixed: `npm run dev` and production preview both render Loop Engineering locally.
  - deferred: production preview works, installer path does not depend on dev server, and an owner/date are recorded.
  - blocker: R30 installer, Spawner launch, or CUA proof depends on the broken dev path.

Suggested artifact folder:

```text
docs/qa/loop-engineering-cua/2026-07-01/
```

Suggested artifact names:

```text
spawner-overview-desktop-before.png
spawner-overview-desktop-after.png
spawner-detail-desktop-before.png
spawner-detail-desktop-after.png
spawner-detail-mobile.png
spawner-overview-mobile.png
spawner-activation-mobile.png
spawner-schedule-mobile.png
spawner-recovery-mobile.png
telegram-loop-state-before.png
telegram-loop-state-after.png
telegram-transcript-current-state.md
telegram-transcript-what-improved.md
telegram-transcript-no-start-inspect.md
event-ledger-before.json
event-ledger-after.json
api-negative-cases.json
artifact-manifest.json
jury-verdicts.md
final-qa-report.md
```

## CUA Test Matrix

### A. Spawner Independent Happy Path

Goal: prove a user can run the full loop-engineering workflow without Telegram.

Isolation condition: complete this entire Spawner path while Telegram is unused, unavailable, closed, or explicitly ignored. Telegram can be tested only after Spawner has produced its own complete evidence chain.

1. Open `/loop-engineering`.
   - Verify the first viewport explains the operator state through real controls, counts, and chip cards.
   - Verify it does not rely on marketing copy or raw internals.
   - Verify the user can identify the next best chip/action within 10 seconds.

2. Create or refine the PRD Writing domain chip from Spawner.
   - If create is supported, start a fresh private PRD Writing chip candidate.
   - If only refine is supported for R30, edit/refine the existing PRD Writing chip and record the limitation.
   - Verify the user can see what the chip is for, what it can improve, and what proof is required before activation.

3. Open the PRD Writing chip detail page.
   - Verify phase navigation is understandable: define, benchmark, improve, review, activate.
   - Verify each major control has a visible or hoverable clue.
   - Verify help affordances are present near unfamiliar terms: domain chip, benchmark, self-improvement loop, evaluator review, distillation, activation, schedule, evidence.

4. Stage a benchmark case.
   - Use a realistic PRD-writing benchmark, not a toy case.
   - Verify the UI distinguishes draft/staged/active cases.
   - Verify staged cases show enough information for a human to understand what will be judged.

5. Select benchmark cases and run a benchmark.
   - Verify selected-case controls are obvious.
   - Verify run state is visible while the action is in progress.
   - Verify completion shows score, delta, evidence, and next action.
   - Verify no raw stack trace or internal id appears in normal copy.
   - Refresh/reopen Spawner and verify the benchmark result persists.

6. Run a self-improvement loop.
   - Verify the loop can use benchmark evidence.
   - Verify progress is visible in real time.
   - Verify completion records a source event that can be reviewed.
   - Refresh/reopen Spawner and verify the loop source event persists.

7. Submit evaluator review from Spawner.
   - Use a passed source run from the same chip.
   - Verify the UI makes clear that this is a judge verdict, not generator self-praise.
   - Verify weak or unsupported improvement claims can be marked as conditional or failed.
   - Verify the UI visibly connects source run to evaluator verdict.
   - Refresh/reopen Spawner and verify the verdict persists.

8. Distill a learning.
   - Verify the system can answer what improved and why.
   - Verify the distilled learning becomes reusable for future PRDs.
   - Verify future PRD requests do not need to re-run the entire loop when a valid distilled lesson already applies.
   - Run a Spawner-side before/after PRD prompt to prove the distilled lesson is reused without pretending a new loop ran.
   - Verify the UI visibly connects source run to evaluator verdict to distilled learning.
   - Refresh/reopen Spawner and verify the distilled learning persists.

9. Configure activation and schedule.
   - Verify activation can be limited to Spawner-only, Telegram-only, or both where supported.
   - Verify timer/continuous/fixed-count schedule controls are clear.
   - Verify a user can pause or inspect before continued work.
   - Verify confirmation, pause, resume, cancel, and deactivate/undo controls.
   - Verify bad schedule configuration fails with a useful recovery message.
   - Verify fixed-count completion, timer state after reload, and continuous state after reload.
   - Verify continued work does not lose authority, evidence, or source linkage.

10. Inspect evidence.
   - Open evidence references from the UI.
   - Verify evidence is human-readable and machine-verifiable.
   - Verify the UI separates "ready for inspection" from "approved for activation."
   - Verify the UI visibly connects source run to evaluator verdict to distilled learning to activation/schedule eligibility.

### B. Spawner Negative And Recovery Path

Goal: prove safety does not become user-hostile, and blocks explain recovery.

1. Try to run benchmark with no selected cases.
   - Expected: blocked with a useful explanation and a clear next action.

2. Try an unknown, inactive, or wrong-chip benchmark case via API.
   - Expected: rejected and recorded without corrupting chip state.

3. Try evaluator review without a source run.
   - Expected: blocked because the review cannot prove improvement.

4. Try distillation before evaluator review.
   - Expected: blocked with an explanation that names the missing review.

5. Try positive manual completion with fake verdict evidence.
   - Expected: blocked unless the evidence packet is a real control-plane evaluator verdict.

6. Try evidence path traversal or wrong-chip evidence lookup.
   - Expected: blocked and scoped safely.

7. Try malformed payloads, wrong methods, auth/authority failures, stale/concurrent mutations, and duplicate submissions.
   - Expected: rejected without unsafe mutation.
   - Expected: user-visible recovery is helpful where the route has a browser surface.

8. Confirm recovery.
   - After each block, complete the correct next step and verify the workflow continues.

For every negative case, record two layers separately:

- browser-visible recovery: what the user sees and what they can do next
- raw API rejection: route, status, safe error shape, and evidence/state impact

Endpoint-specific negative checklist:

| Case | Route or route family | Expected result |
| --- | --- | --- |
| No selected cases | benchmark run route | 4xx, useful browser recovery, no run event |
| Wrong-chip or inactive case | benchmark run route | 4xx, no state mutation, chip scope preserved |
| Review without source run | evaluator-review route | 4xx, no positive verdict packet |
| Distill before review | distill route | 4xx, no distilled-learning packet |
| Fake verdict evidence | manual completion or distill route | 4xx, fake packet ignored |
| Traversal or wrong-chip evidence | evidence lookup route | 4xx, no file disclosure |
| Malformed payload | all mutation routes touched by QA | 4xx, safe error shape |
| Wrong method | all mutation routes touched by QA | 405 or framework equivalent |
| Auth/authority failure | queue/run/review/distill routes | blocked by Governor/Harness authority |
| Stale or concurrent mutation | schedule, activation, benchmark selection | conflict or latest-state reconciliation |
| Duplicate submission | benchmark/loop/review routes | idempotent behavior or safe duplicate rejection |

Positive not-over-blocking checklist:

- Valid benchmark evidence allows a loop to run.
- Valid passed source run allows evaluator review.
- Valid evaluator verdict allows distillation.
- A weak improvement claim can become `Conditional` instead of being blindly accepted or hard-failed.
- Valid distilled learning can be reused on a future PRD prompt without rerunning the full loop.

### C. Telegram Connected Happy Path

Goal: prove a user can manage the same chip from Telegram without losing Spawner alignment.

1. Ask Telegram for current PRD Writing loop state.
   - Expected: a concise, human reply with the useful next step and one Spawner link when helpful.
   - Expected: no raw ids unless explicitly requested.
   - Save the exact transcript in addition to screenshots.

2. Ask Telegram to explain "what improved and why."
   - Expected: the answer cites distilled learnings and benchmark/evaluator evidence in plain language.
   - Expected: it explains whether the next PRD can use the learning immediately or needs another loop.
   - Save the exact transcript in addition to screenshots.

3. Ask Telegram to stage or run a loop action if supported.
   - Expected: Telegram confirms intent, authority, and private/default behavior.
   - Expected: Spawner event ledger updates.
   - Expected: Telegram uses at most one useful Spawner link unless raw/debug details are requested.

4. Ask Telegram for a schedule or continuation.
   - Expected: the reply distinguishes timer, continuous, and fixed-count loops.
   - Expected: Spawner schedule controls reflect the same state.

5. Ask Telegram to avoid starting work and only inspect.
   - Expected: no run is launched.
   - Expected: Spawner state remains unchanged except for safe inspection/read events if those are tracked.
   - Save the exact transcript and event diff proving no mutation.

6. Test Telegram availability states.
   - Connected: Telegram can read the latest Spawner state.
   - Disconnected or connection-failing: Telegram clearly says it cannot confirm live state, and Spawner still works.
   - Reconnected: Telegram refreshes to the latest Spawner truth.
   - Stale: Telegram either updates within 10 seconds or labels the answer as stale and points to Spawner for live truth.

### D. Cross-Surface Consistency

Goal: prove Spawner and Telegram describe the same truth.

1. Start a benchmark from Spawner, then ask Telegram for status.
   - Expected: Telegram sees the same latest event, score, and next action.

2. Start or queue a supported action from Telegram, then refresh Spawner.
   - Expected: Spawner shows the same action, source, and evidence status.

3. Distill a learning in Spawner, then ask Telegram to use it on a fresh PRD prompt.
   - Expected: Telegram applies the learning without pretending a new loop ran.

4. Create a conflict/concurrency case.
   - Show one surface with older state.
   - Start or queue an action from the other surface.
   - Verify the older surface resolves to the latest source of truth before allowing conflicting mutation.
   - Verify ledger sequence, version, or timestamp ordering proves which state won.

5. Capture before/after screenshots, exact Telegram transcripts, timestamps, and event ledgers for both directions.

Freshness rule:

- Telegram should reflect Spawner mutations within 10 seconds during healthy connectivity.
- If it cannot, it must say that the state may be stale and offer the Spawner control-plane link.

### E. UI Clues, Tooltips, And Usability

Goal: prove a new user can understand the workflow without reading internal docs.

Inspect every visible major control for:

- a clear label
- hover or focus tooltip when the concept is specialized
- disabled state copy that says what is missing
- loading state while work is happening
- success state with useful next action
- failure state with useful recovery
- consistent Spawner component style
- no stray green buttons or one-off components outside the design system
- desktop and mobile layout without overlap or truncated controls

Tooltip acceptance criteria:

- plain-language definition
- why this matters to the user's workflow
- what happens next when the user acts
- hover and keyboard focus support on desktop
- tap or visible fallback support on mobile
- no jargon-only explanation
- no raw ids, stack traces, or internal route names in ordinary copy

Required tooltip coverage:

- Domain chip
- Benchmark case
- Benchmark run
- Self-improvement loop
- Evaluator review
- Source run
- Distilled learning
- Activation
- Schedule
- Evidence
- Queue
- Run now
- Telegram surface
- Spawner surface

First-time-user rubric:

For each core concept, a novice observer should be able to answer these without reading internal docs:

- What is this?
- Why would I use it?
- What proof does it need?
- What is the next safe action?
- How do I undo, pause, or inspect it?

## Real-Time Observation Protocol

For every CUA scenario:

1. Capture the screen before action.
2. Record the action in plain language.
3. Capture the in-progress state for benchmark runs, loop runs, and schedule-triggered work.
4. Capture the screen after action.
5. Save the related API response or event ledger diff.
6. Save the evidence packet, if created.
7. Record whether Telegram and Spawner agree.
8. Record jury verdict separately from worker notes.

Each real-time proof must include:

- timestamp before action
- timestamp after action
- event ordering
- ledger sequence, version, or comparable monotonic ordering where available
- visible running or queued state
- ledger diff
- source event id in the raw artifact only, not normal user-facing copy
- recorded reason if an in-progress screenshot is technically impossible

The QA packet should make it possible for a third agent to replay the reasoning without trusting the worker's interpretation.

Raw proof fields for source-linked artifacts:

```json
{
  "chipId": "prd-writing",
  "sourceRunId": "raw-only-source-run-id",
  "sourceEventId": "raw-only-source-event-id",
  "sourceStatus": "passed",
  "evaluatorVerdictId": "raw-only-verdict-id",
  "distilledLearningId": "raw-only-learning-id",
  "evidenceRef": "chip-scoped-evidence-ref",
  "ledgerSequence": 0,
  "createdAt": "2026-07-01T00:00:00.000Z",
  "artifactPaths": []
}
```

These raw ids belong in JSON artifacts and jury packets only. Ordinary Telegram and Spawner copy should stay human unless raw/debug details are requested.

## Proof Artifact Checklist

| Capability | Required artifact |
| --- | --- |
| Spawner-only operation | screenshots, event ledger, and final evidence chain created with Telegram unavailable or unused |
| Chip create/refine | before/after chip definition screenshot and event diff |
| Benchmark run | selected cases screenshot, in-progress screenshot, result screenshot, API/event diff |
| Self-improvement loop | in-progress screenshot, source run event, output packet |
| Evaluator review | separate jury/verdict packet linked to source run |
| Distillation | before/after PRD prompt output and distilled learning packet |
| Activation | scoped activation screenshot, confirmation, undo/deactivate proof |
| Schedule | timer/fixed-count/continuous screenshots, pause/resume/cancel proof, reload persistence |
| Telegram sync | screenshot, exact transcript, Spawner ledger agreement |
| Negative recovery | browser recovery screenshot and raw API rejection |

## Automated Test Ladder

Run the ladder in this order after any implementation changes made during QA:

1. Clean worktree and branch check before starting.
2. Focused unit/regression tests for loop-engineering control plane, evidence, registry, authority, and route behavior.
3. API route negative tests for malformed payloads, wrong-chip data, missing source runs, fake verdict evidence, traversal, stale/concurrent mutation, duplicate submission, and authority failure.
4. Typecheck or framework check.
5. Production build.
6. Production preview smoke.
7. Browser CUA or Playwright desktop screenshots for overview, detail, activation, schedule, and recovery states.
8. Browser CUA or Playwright mobile screenshots for overview, detail, activation, schedule, and recovery states.
9. Telegram route tests that can run locally.
10. Telegram Desktop CUA screenshots and exact transcript capture.
11. Final clean worktree check after commits.

If a rung cannot run, record:

- command or tool attempted
- reason it could not run
- risk to R30
- owner or follow-up
- replacement evidence, if any

## Commit And Release Discipline

- Check `git status --short` before and after meaningful work.
- Keep commits atomic: docs, UI, server behavior, tests, and QA artifacts should not be mixed unless the change is inseparable.
- Do not revert unrelated dirty work.
- Do not push, open a PR, publish globally, or merge from the QA machine unless explicitly asked.
- No release recommendation can be `Pass` while unrelated dirty changes are unexplained or while required QA artifacts are missing.
- Any release deferral must name the owner, risk, and date.

## Jury Blind Packet Template

```text
Packet id:
Capability under review:
Worker claim:
Artifacts supplied:
- screenshots:
- transcripts:
- API responses:
- event ledgers:
- evidence packets:
Replay command or check:
Known omissions:
Jury verdict:
Jury required fixes:
```

## Separate Jury Protocol

Use separate evaluator agents. They may inspect artifacts, run read-only checks, use screenshots, and request missing evidence. They should not be the same agents that execute the workflow.

Required jury seats:

1. UX onboarding judge
   - Judges whether a new user can understand the flow and next action.

2. Spawner operator judge
   - Judges whether the control plane can manage chips, benchmarks, loops, reviews, distillation, activation, and schedules without Telegram.

3. Telegram connectivity judge
   - Judges whether Telegram reflects the same truth and gives natural, useful replies.

4. Proof and authority judge
   - Judges whether improvement claims, evidence refs, source runs, and authority gates are honest and not over-blocking.

5. Reliability regression judge
   - Judges tests, API recovery paths, dev/preview behavior, mobile layout, and release risk.

Verdict format:

```text
Verdict: Pass | Conditional | Fail
Scores:
- usability:
- evidence honesty:
- cross-surface sync:
- tooltip clarity:
- authority balance:
- recovery quality:
Required fixes:
- ...
Nice-to-have polish:
- ...
Evidence inspected:
- ...
```

Acceptance thresholds:

- No P0 or P1 findings.
- No cross-surface disagreement.
- No unsupported improvement claim.
- No blocker with unclear recovery.
- Average score across jury seats is at least 9.0.
- Any individual score below 8.0 creates a required fix or documented release deferral.
- No Pass verdict is allowed until final artifacts exist and have been inspected.

## Final QA Report

The final report should include:

- executive verdict
- environment and versions
- artifact links
- screenshots inspected
- Spawner-only results
- Telegram-connected results
- negative/recovery results
- jury verdict table
- fixes applied during QA
- remaining risks
- release recommendation for R30

## Example Telegram Reply Standards

Current state:

```text
The PRD Writing chip has a passed benchmark and one distilled learning ready to reuse. Next useful move: run one fresh PRD prompt from Spawner to confirm the learning still helps before activating it for Telegram.
```

What improved:

```text
The chip improved because the last loop found that PRDs scored higher when acceptance criteria were tied to observable evidence and rollout risk. Spark can reuse that lesson on the next PRD without rerunning the full loop, unless you ask for a new benchmark.
```

Inspect only:

```text
I will only inspect the current chip state and will not start a benchmark, loop, activation, or schedule. Spawner remains the live control plane if you want to check the full evidence chain.
```

Schedule:

```text
I can schedule this as a fixed-count loop, a timer, or continuous improvement. Fixed-count is safest for this run because it gives you a clean stop point and a jury packet after each pass.
```

## `/goal` Prompt

```text
/goal Run the documented Loop Engineering CUA QA and jury plan in docs/LOOP_ENGINEERING_CUA_QA_JURY_PLAN.md end to end for the PRD Writing domain chip. Prove that Spawner can independently manage the chip, benchmarks, self-improvement loops, evaluator reviews, distillation, activation, schedules, and evidence, and prove that Telegram Desktop stays connected to the same truth without becoming the only control lane.

Use real CUA evidence. Drive Spawner in browser CUA first; use production preview if dev still fails, and fix or clearly document the dev-server blocker if it affects R30. Drive Telegram Desktop with available desktop CUA/Peekaboo, capturing annotated screenshots and connection issues separately from product issues. For every meaningful action, save before/after screenshots, in-progress proof where possible, API/event-ledger diffs, and evidence packets under docs/qa/loop-engineering-cua/<date>/.

Do not let worker agents grade themselves. Use separate evaluator jury agents for UX onboarding, Spawner operation, Telegram connectivity, proof/authority balance, and reliability regression. Give them the artifacts blind to worker self-scores where possible. Verdicts must include pass/conditional/fail, numeric scores, required fixes, inspected evidence, and release risk.

Test the full happy path and the recovery path: stage realistic benchmark cases, run selected benchmarks, run a self-improvement loop, bind evaluator review to a passed source run, distill learnings, show why PRDs improved, prove future PRDs can reuse the distilled learning without rerunning the whole loop when valid, configure activation and scheduling, and verify Spawner and Telegram report the same latest state. Also test blocks for no selected cases, wrong-chip or inactive cases, review without source run, distillation before review, fake verdict evidence, and evidence traversal.

Also test Spawner isolation while Telegram is unused or unavailable, Telegram connected/disconnected/reconnected/stale states, exact Telegram transcript capture, 10-second freshness or stale-state labeling, conflict resolution when one surface has older state, persistence after refresh/reopen, and schedule pause/resume/cancel/deactivate behavior.

Run the automated test ladder, keep atomic commits, and do not mark Pass until the jury has inspected final artifacts. Polish whatever blocks usability or reliability with long-term fixes that follow Spark Harness Core, Governor, authority, evidence, and Spawner design-system patterns. Add or update tests for every meaningful behavior change. Commit often. Do not publish globally, activate broadly, or call external APIs unless explicitly required and approved by the local framework. Finish with a final QA report, jury verdicts, screenshots/artifact links, fixes applied, remaining risks, and a clear R30 release recommendation.
```

## Continuation `/goal` Prompt

```text
/goal Continue the Loop Engineering CUA QA from docs/qa/loop-engineering-cua/2026-07-01/final-qa-report.md for domain-chip-prd-writing-proof-loop. Do not redo the already-proven Spawner scoped schedule/fire path except as regression setup. Focus on the remaining R30 blockers: schedule lifecycle controls, negative/recovery CUA matrix, Telegram action-back-to-Spawner paths, route/proof evidence cleanliness, and distilled-learning reuse.

First fix or document the Telegram proof gap found by the jury: PRD loop state queries behaviorally execute loop_engineering.status, but the proof capsule/route shadow still records recursive.command or recursive.sessions mismatch. Make the route ledger, proof capsule, and outbound evidence agree on loop_engineering.status with Spawner joined, event id, source timestamp, and before/after event/schedule counts showing no mutation for read-only state queries. Keep the reply short: freshness, latest result, Spawner link.

Then run real CUA and API evidence for pause, resume, cancel, deactivate/undo, timer mode, continuous mode, reload persistence, duplicate/concurrency behavior, wrong-chip or inactive cases, no selected cases, review without source run, distillation before review, fake verdict evidence, traversal, malformed payloads, authority failures, stale/reconnect states, and recovery after each block. Capture screenshots, route/proof rows, event-ledger diffs, state hashes, and user-visible recovery copy under docs/qa/loop-engineering-cua/2026-07-01/.

Use separate evaluator jury agents again for Telegram proof cleanliness, Spawner lifecycle UX, authority/evidence integrity, and release readiness. Run focused tests plus full relevant check/build/test ladders. Commit atomically. Do not publish, globally activate, or call external APIs. Finish by updating the final QA report, artifact manifest, jury verdicts, and R30 release recommendation.
```
