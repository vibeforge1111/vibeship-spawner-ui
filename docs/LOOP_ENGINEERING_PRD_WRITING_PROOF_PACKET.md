# Loop Engineering PRD Writing Proof Packet

Date: 2026-07-01
Status: local/private proof strengthened; live Telegram Desktop CUA management chain passed; autonomous local benchmark-runner and loop-runner v1 now execute staged cases into separated evaluator verdict packets.

## Reference Chip

- Chip: `domain-chip-prd-writing-proof-loop`
- Use case: PRD Writing requests
- Scope: private/local v1 only
- Required boundary: generators do not score themselves; improvement claims require separated evaluator evidence.

## Proven Chain

The current route-chain proof exercises the PRD Writing reference chip through actual Spawner Loop Engineering routes and Telegram command-result payloads:

1. Stage held-out benchmark case from Telegram.
2. Queue private benchmark mission with Native Governor authority.
3. Bind benchmark completion with separated evaluator evidence.
4. Queue capped private loop mission with Native Governor authority.
5. Bind loop completion with separated evaluator evidence.
6. Record evaluator review.
7. Stage distilled lessons for future PRD behavior.
8. Stage suggested activation for PRD Writing requests with rollback reference.
9. Stage schedule and activation management records from Telegram without treating them as evaluator evidence.

The persisted ledger is expected to contain:

```text
benchmark_case_added
benchmark_run
loop_batch
evaluator_review
distillation
activation_requested
```

The benchmark and loop completion events must be `passed`, include `completedAt`, preserve `evaluatorSeparated: true`, and store the `run_completion_bound` command-result payload. Staged benchmark cases, schedules, and activation requests are provenance records only; they must remain `evaluatorSeparated: false` until a separated evaluator binds a scored result.

## Evidence

Spawner commits:

- `569d8f01 Add PRD Writing route chain proof`
- `1a4f0644 Strengthen PRD Writing loop proof chain`
- `2a9d29d1 Fire private loop schedules from control plane`
- `2a0ab5e1 Expose loop completion binding in Spawner UI`
- `efa187a7 Bind loop run completions to evaluator evidence`
- `52948cdf Prove route rejects self-scored loop completion`
- `ff20d74d Prove route requires evaluator refs for improvement`
- `42bab961 Document PRD Writing loop proof packet`
- `aff57614 Document live PRD Writing loop proof`
- `564d3a05 Seed PRD Writing loop proof chip`
- `cf5ec058 Document live Telegram loop run proof`
- `bee65552 Clarify queued loop evaluator contract`
- `8c5b20af Separate loop staging from evaluator evidence`
- `2a04842e Track Telegram source for benchmark cases`
- `7a7c383d Execute staged loop benchmarks locally`
- `78460397 Expose immediate loop benchmark runs`
- `6a5d865a Separate benchmark source keys from blind packets`
- `55253851 Document blind benchmark source separation`
- `53f12a3f Document live Telegram benchmark execution chain`
- `a7cb0005 Execute private loop runs locally`
- `7b5ede5b Expose immediate loop improvement runs`

Telegram commits:

- `8f61f2f Harden loop execute proof from Telegram`
- `ff3d3a1 Execute loop improvement runs from Telegram`
- `e30f894 Select loop benchmark cases from Telegram`
- `c49e135 Harden loop benchmark execute command tests`
- `c75aa84 Execute loop benchmarks from Telegram`
- `d4a0e50 Allow evidence wording in loop case text`
- `78c53c7 Pass Telegram source for loop management commands`
- `d70679b Explain missing loop evidence in Telegram`
- `c083de3 Pass human loop authority to Spawner`
- `aa4b7b6 Bind loop command request ids to authority`
- `ca28241 Parse live loop command payloads`
- `5e49ce3 Cover Telegram capped loop command`
- `0b34150 Bridge scheduled loop fires from Telegram`
- `6e4493f Bridge loop completion binding from Telegram`
- `4c1f586 Add Telegram loop discovery commands`

Commands passed:

```bash
cd /Users/alchemistab/.spark/modules/spawner-ui/source
npx vitest run src/routes/api/loop-engineering/prd-writing-chain.authority.test.ts src/lib/server/loop-engineering-control-plane.test.ts
npx vitest run src/routes/api/loop-engineering/prd-writing-chain.authority.test.ts src/lib/server/loop-engineering-control-plane.test.ts 'src/routes/api/loop-engineering/events/[eventId]/complete/complete.authority.test.ts'
npx vitest run src/routes/api/loop-engineering/prd-writing-chain.authority.test.ts src/lib/server/loop-engineering-control-plane.test.ts 'src/routes/api/loop-engineering/events/[eventId]/complete/complete.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/benchmarks/run/benchmark-run.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/loops/run/loop-run.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/schedules/schedules.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/schedules/[scheduleId]/fire/fire.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/activation/activation.authority.test.ts'
npx vitest run src/routes/api/loop-engineering/prd-writing-chain.authority.test.ts src/lib/server/loop-engineering-control-plane.test.ts 'src/routes/api/loop-engineering/events/[eventId]/complete/complete.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/benchmarks/run/benchmark-run.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/benchmarks/cases/benchmark-cases.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/loops/run/loop-run.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/distill/distill.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/evaluator-review/evaluator-review.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/schedules/schedules.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/schedules/[scheduleId]/fire/fire.authority.test.ts' 'src/routes/api/loop-engineering/chips/[chipId]/activation/activation.authority.test.ts'
npm run loop-engineering:seed-prd-writing-proof
node --check scripts/seed-prd-writing-proof-chip.mjs
npm run check

cd /Users/alchemistab/.spark/modules/spark-telegram-bot/source
npx ts-node tests/loopEngineeringStatus.test.ts
npx ts-node tests/loopEngineeringCommand.test.ts
npx ts-node tests/telegramActionAuthority.test.ts
npx ts-node tests/spawner.test.ts
npx tsc --noEmit --pretty false
npm run build
```

Live registry artifact packet:

- Registry root: `/Users/alchemistab/.spark/chips/domain-chip-prd-writing-proof-loop`
- Evidence files: `spark-chip.json`, `reports/chip-benefit-ab.json`, `reports/long-loop-trend.json`, `reports/loop-gate-check.json`, `reports/watchtower-check.json`, `reports/rollback-check.json`, `reports/consumer-transfer-trial-binding.json`, `reports/proof-auditor-check.json`, `reports/r30-controlled-loop/final-allowed-disallowed-claims-matrix.json`, `distilled-runtime/prd-writing-fast-path.json`
- Spawner API check: `GET /api/loop-engineering/chips/domain-chip-prd-writing-proof-loop` returned `Local fast path supported`, `12/12` checks, `0` blocked checks, and next action `Ready for operator activation review`.

Live Telegram Desktop CUA proof:

- Prompt sent from Telegram Desktop: `/loop status domain-chip-prd-writing-proof-loop`
- First proof screenshot: `/tmp/telegram-loop-status-proof-final.png`
- After binding the live proof into the private runtime packet, second proof screenshot: `/tmp/telegram-loop-status-proof-12of12.png`
- Final Telegram reply: `PRD Writing is local fast path supported: 12/12 checks pass. I do not see a blocker in the current readiness packet... Next safe step: Ready for operator activation review`
- The reply was read-only: it did not queue a loop, benchmark, schedule, activation, publication, or installer movement.
- Prompt sent from Telegram Desktop: `/loop run domain-chip-prd-writing-proof-loop 1`
- Loop-run proof screenshot: `/tmp/telegram-loop-run-proof-final.png`
- Final Telegram reply: `Queued a capped private loop mission for domain-chip-prd-writing-proof-loop. Generator work and evaluator scoring stay separated before any lesson is accepted.`
- Persisted Spawner ledger events include Telegram-sourced queued loop batches `lee-1782871482391-f5fd50` and `lee-1782871565160-ec68f2`, each with one observed round and a `spark-loop-*` mission id.
- The run proof stayed private/local: it queued a capped evaluator-separated loop and did not publish, activate, install, or claim improvement without evaluator evidence.

Live Telegram Desktop CUA full chain:

- Benchmark prompt screenshot: `/tmp/telegram-loop-benchmark-live-chain.png`
- Benchmark completion screenshot: `/tmp/telegram-loop-complete-benchmark-live-chain.png`
- Loop-run screenshot: `/tmp/telegram-loop-run-live-chain-v2.png`
- Loop completion screenshot: `/tmp/telegram-loop-complete-loop-live-chain.png`
- Evaluator review screenshot: `/tmp/telegram-loop-eval-live-chain.png`
- Distillation screenshot: `/tmp/telegram-loop-distill-live-chain.png`
- Activation staging screenshot: `/tmp/telegram-loop-activation-live-chain.png`
- Management replay screenshot before source bridge: `/tmp/telegram-loop-final-management-live-chain.png`
- Final management replay screenshot after source bridge: `/tmp/telegram-loop-final-source-live-chain.png`

Current persisted control-plane snapshot:

- Events: `31`
- Benchmark cases: `7`
- Schedules: `3`
- Activation rules: `4`
- Distillations: `2`
- Final Telegram-sourced benchmark-case event: `lee-1782872822413-731f3d`, `sourceSurface: telegram`, `evaluatorSeparated: false`, evidence `control-plane:benchmark_cases:benchcase-1782872822411-6702af`
- Final Telegram-sourced schedule event: `lee-1782872827842-b0009e`, `sourceSurface: telegram`, `evaluatorSeparated: false`, evidence `control-plane:schedules:loopsched-1782872827842-3d5c2b`
- Final Telegram-sourced activation event: `lee-1782872833350-4ba07e`, `sourceSurface: telegram`, `evaluatorSeparated: false`, evidence `control-plane:activation_rules:activation-1782872833350-4d0da1`

Live evaluator-bound improvement records:

- Benchmark completion event `lee-1782872103420-91c602`: `sourceSurface: telegram`, mission `spark-loop-1782872103419-0d9278`, previous score `6`, candidate score `8.4`, evaluator evidence `reports/prd-writing-live-benchmark-evaluator.json`, verdict `reports/prd-writing-live-benchmark-verdict.json`, command action `run_completion_bound`.
- Loop completion event `lee-1782872241085-4e7607`: `sourceSurface: telegram`, mission `spark-loop-1782872241084-75786b`, previous score `6.4`, candidate score `8.7`, evaluator evidence `reports/prd-writing-live-loop-evaluator.json`, verdict `reports/prd-writing-live-loop-verdict.json`, command action `run_completion_bound`.
- Evaluator review event `lee-1782872306065-b7ebf9`: previous score `6.4`, candidate score `8.7`, evidence `reports/prd-writing-live-evaluator-review.json`.
- Distillation event `lee-1782872338972-59f490`: staged lesson set `distill-1782872338972-f41d15`, including the PRD fast-path lessons to resolve owner, success metric, acceptance criteria, risks, and evidence refs before drafting, and to prefer the distilled PRD fast path for ordinary PRD requests before rerunning the full loop.

## Autonomous Benchmark Runner V1

The benchmark run route now supports an explicit `executeNow: true` mode. Queue mode remains unchanged. Executed mode:

- selects active staged benchmark cases, or the requested case ids;
- generates baseline and candidate outputs into a private generator packet;
- blind-labels outputs as evaluator variants;
- scores those variants with `spark.local.separated-evaluator.v1`;
- writes `generator-output.json`, `blind-evaluator-verdict.json`, and `summary.json` under the private Spawner state benchmark-run folder;
- completes the `benchmark_run` event with score delta, source ref, evaluator verdict ref, and `benchmark_run_executed` command result;
- keeps activation, publication, installer promotion, and global approval out of scope.

Clean live local API proof:

- Fresh staged case: `benchcase-1782890308306-b065f9`
- Executed benchmark event: `lee-1782890308315-c70af5`
- Mission: `spark-loop-1782890308315-19e535`
- Benchmark run packet: `benchrun-lee-1782890308315-c70af5`
- Verdict ref: `control-plane:benchmark_runs:benchrun-lee-1782890308315-c70af5:blind-evaluator-verdict.json`
- Source ref: `control-plane:benchmark_runs:benchrun-lee-1782890308315-c70af5:summary.json`
- Generator packet ref: `control-plane:benchmark_runs:benchrun-lee-1782890308315-c70af5:generator-output.json`
- Source-key ref: `control-plane:benchmark_runs:benchrun-lee-1782890308315-c70af5:source-key.json`
- Scores: previous `4.32`, candidate `10`, delta `+5.68`
- Case count: `1`
- Verdict schema: `spark.loop_engineering.blind_evaluator_verdict.v1`
- Blind-packet check: `generator-output.json` contains no `blindKey`, `baseline`, or `candidate` source labels; source labels are stored in `source-key.json` and used only after blind variant scoring.
- Claim boundary in packet: private benchmark verdict only; it can support evidence review but does not activate, publish, or globally approve the chip.

Telegram bridge proof:

- `/loop benchmark <chip>` remains queue-only.
- `/loop benchmark <chip> now`, `execute`, `run`, or `score` sends `executeNow: true` through the same Governor-authorized Spawner command-result route.
- `/loop benchmark <chip> now case <benchcase-id>` filters the run to selected staged cases so old demo cases do not pollute a clean proof run.
- Focused Telegram command test and TypeScript build passed after this bridge.

Clean live Telegram Desktop CUA proof:

- Screenshot: `/tmp/telegram-loop-benchmark-now-clean-case.png`
- Full chain screenshot: `/tmp/telegram-loop-benchmark-now-full-chain.png`
- Selected case command: `/loop benchmark domain-chip-prd-writing-proof-loop now case benchcase-1782890308306-b065f9`
- Telegram benchmark event: `lee-1782890747783-6f43b9`
- Telegram benchmark mission: `spark-loop-1782890747783-f30ad7`
- Telegram benchmark run packet: `benchrun-lee-1782890747783-6f43b9`
- Scores: previous `4.32`, candidate `10`, delta `+5.68`, one selected case.
- Telegram benchmark reply: `Ran 1 private benchmark case... This is evaluator evidence for review, not activation.`
- Generator packet check: no `blindKey`, `baseline`, or `candidate` source labels in `generator-output.json`.
- Evaluator review event: `lee-1782890822766-e080f7`, source `telegram`, previous `4.32`, candidate `10`, delta `+5.68`, evidence `control-plane:benchmark_runs:benchrun-lee-1782890747783-6f43b9:blind-evaluator-verdict.json` and `mission-control:spark-loop-1782890747783-f30ad7`.
- Distillation event: `lee-1782890856205-8b0bf8`, distillation `distill-1782890856205-52d079`, source `telegram`, staged lesson: lock owner, affected users, success metric, acceptance criteria, risks, rollback, and evidence refs before implementation detail.
- Activation staging event: `lee-1782890885777-968b7c`, activation rule `activation-1782890885777-200f2e`, status `staged`, approval required, rollback `reports/prd-writing-clean-rollback.json`, evaluatorSeparated `false` because staging is not evaluator proof.

## Autonomous Loop Runner V1

The loop run route now also supports `executeNow: true`. Queue mode remains unchanged. Executed mode:

- selects active staged benchmark cases, or requested case ids, so clean proof runs can avoid old demo cases;
- writes `loop-plan.json`, `generator-output.json`, `source-key.json`, `loop-evaluator-verdict.json`, and `summary.json` under the private Spawner loop-run folder;
- keeps baseline/candidate source labels out of generator output and stores the reveal map only in `source-key.json`;
- records a `loop_batch` event with `loop_run_executed`, score delta, source ref, evaluator verdict ref, accepted lessons, evidence refs, and observed round count;
- keeps accepted lessons as evidence for distillation review, not activation, publication, installer promotion, or global approval.

Clean live local API proof:

- Command shape: `POST /api/loop-engineering/chips/domain-chip-prd-writing-proof-loop/loops/run` with `executeNow: true`, `roundLimit: 3`, and `benchmarkCaseIds: ["benchcase-1782890308306-b065f9"]`.
- Executed loop event: `lee-1782891532985-b2627b`
- Mission: `spark-loop-1782891532985-8a8312`
- Loop run packet: `looprun-lee-1782891532985-b2627b`
- Verdict ref: `control-plane:loop_runs:looprun-lee-1782891532985-b2627b:loop-evaluator-verdict.json`
- Source ref: `control-plane:loop_runs:looprun-lee-1782891532985-b2627b:summary.json`
- Generator packet ref: `control-plane:loop_runs:looprun-lee-1782891532985-b2627b:generator-output.json`
- Source-key ref: `control-plane:loop_runs:looprun-lee-1782891532985-b2627b:source-key.json`
- Scores: previous `4.32`, candidate `10`, delta `+5.68`
- Rounds observed: `3`
- Verdict schema: `spark.loop_engineering.loop_evaluator_verdict.v1`
- Generator-packet check: `generator-output.json` contains no `blindKey`, `baseline`, or `candidate` source labels; source labels are stored in `source-key.json` and used only after blind variant scoring.
- Claim boundary in packet: private loop improvement evidence only; it can support distillation review but does not activate, publish, or globally approve the chip.

Telegram bridge proof:

- `/loop run <chip> <rounds>` remains queue-only.
- `/loop run <chip> <rounds> now`, `execute`, or `score` sends `executeNow: true` through the same Governor-authorized Spawner command-result route.
- `/loop run <chip> <rounds> now case <benchcase-id>` filters the run to selected staged cases so old demo cases do not pollute a clean proof run.
- Malformed explicit case scopes now fail closed instead of silently widening to all active staged cases.
- Telegram treats execute-now success as proven only when Spawner returns the expected action, event id, mission id, and run-packet id.
- Focused Telegram command test and TypeScript build passed after this bridge and hardening.

Clean live Telegram Desktop CUA loop proof:

- Screenshot: `/tmp/telegram-loop-run-now-clean-case.png`
- Full evaluator/distillation/activation chain screenshot: `/tmp/telegram-loop-run-distill-activation-chain.png`
- Selected case command: `/loop run domain-chip-prd-writing-proof-loop 3 now case benchcase-1782890308306-b065f9`
- Telegram loop event: `lee-1782891574683-e68233`
- Telegram loop mission: `spark-loop-1782891574683-27d9af`
- Telegram loop run packet: `looprun-lee-1782891574683-e68233`
- Scores: previous `4.32`, candidate `10`, delta `+5.68`, one selected case, three observed rounds.
- Telegram loop reply: `Ran 3 private loop rounds for domain-chip-prd-writing-proof-loop on 1 case: 4.3 -> 10.0. This is evaluator evidence for distillation review, not activation.`
- Generator packet check: no `blindKey`, `baseline`, or `candidate` source labels in `generator-output.json`.
- Evaluator review event: `lee-1782891627338-1f6915`, source `telegram`, previous `4.32`, candidate `10`, delta `+5.68`, evidence `control-plane:loop_runs:looprun-lee-1782891574683-e68233:loop-evaluator-verdict.json` and `mission-control:spark-loop-1782891574683-27d9af`.
- Distillation event: `lee-1782891646577-f4c4fd`, distillation `distill-1782891646577-ee7e67`, source `telegram`, evidence includes the loop evaluator verdict and loop mission.
- Activation staging event: `lee-1782891662568-23e569`, activation rule `activation-1782891662568-7d0f8b`, status `staged`, approval required, rollback `reports/prd-writing-clean-rollback.json`, evaluatorSeparated `false` because staging is not evaluator proof.

Evaluator audit follow-up:

- Telegram bridge evaluator found one blocker: `/loop run <chip> now case typo` could previously drop the bad case id and execute all active cases.
- Fix: explicit invalid `case` scopes now return a user-facing validation failure before Spawner is called.
- Additional bridge guard: `/loop benchmark ... now` and `/loop run ... now` refuse success-without-proof responses instead of relaying a "ran" message without event, mission, and run-packet ids.
- Regression coverage: `/loop run now rejects malformed explicit benchmark case scope without widening`, `/loop run now refuses success without execution proof ids`, and `/loop benchmark now refuses success without execution proof ids`.

Fresh post-hardening Telegram Desktop smoke:

- Malformed scope screenshot: `/tmp/telegram-loop-invalid-case-fail-closed.png`
- Malformed command: `/loop run domain-chip-prd-writing-proof-loop 3 now case typo`
- Result: Telegram replied with a case-scope validation failure, Spawner was not called, latest executed Telegram loop event stayed `lee-1782891574683-e68233`, and total control-plane event count stayed `37`.
- Valid scoped run screenshot: `/tmp/telegram-loop-valid-after-hardening.png`
- Valid command: `/loop run domain-chip-prd-writing-proof-loop 3 now case benchcase-1782890308306-b065f9`
- New Telegram loop event: `lee-1782892300583-ceab22`
- New Telegram loop mission: `spark-loop-1782892300583-74d057`
- New Telegram loop packet: `looprun-lee-1782892300583-ceab22`
- Scores: previous `4.32`, candidate `10`, delta `+5.68`, one selected case, three observed rounds.
- Packet separation check: `generator-output.json` contains no `blindKey`, `baseline`, or `candidate` source labels; verdict schema is `spark.loop_engineering.loop_evaluator_verdict.v1`.

## Honesty Boundary

The seeded PRD Writing artifact packet includes static fixture reports used to prove shape, rendering, and transferability. The live Telegram route chain proves command authority, source attribution, ledger persistence, separated evaluator binding, autonomous benchmark execution, autonomous loop execution, staged distillation, and staged activation control. The evaluator is still a local deterministic v1 packet evaluator, not an external human judge or cryptographic blind-review service. Scored improvement claims are only accepted where evaluator evidence refs and completion-time or executed-run binding are present.

## Remaining Gate

This packet proves the Telegram -> Spawner evidence status path, the private Telegram -> Spawner capped loop-run queue path, the private autonomous benchmark execution path, the private autonomous loop execution path, and the private PRD Writing loop evidence chain through distillation and staged activation review. Operator activation review remains required before stronger runtime activation, publication, installer promotion, or network absorption.

## Release Gate

This packet supports local/private confidence and operator activation review readiness only. Publishing readiness still requires explicit operator approval and the separate R30 release gate.
