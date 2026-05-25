# Spark Benchmark Creator PRD: Spark QA Operator

Schema: `spark-benchmark-creator-prd.v1`  
Mission: `mission-creator-1779710637535`  
Specialization path: `spark-qa-operator`  
Level: `10/10` benchmark factory  
Privacy: local only  
Risk: high

## Product Goal

Create a reusable benchmark factory packet that proves whether a Spark QA Operator agent, specialization path, or tool improves real operational judgment. The proof target is not nicer copy. It is better route decisions, source-of-truth selection, tool use, evidence handling, validation discipline, and promotion boundaries.

The pipeline is PRD-backed:

1. PRD
2. Benchmark specification
3. Cases across visible, heldout, hidden-heldout, trap, system, adversarial, mutation, and human/swarm adjudication splits
4. Artifact manifest
5. Validation gates
6. Fresh scored run
7. Auto Loop improvement plan

This packet stages the benchmark-building work. It does not claim a score, a passed benchmark, public readiness, or a capability gain.

## Target Users

- Spark QA operators validating Telegram, Builder, Spawner, Canvas, Kanban, memory, and provider/runtime behavior.
- Creator Mission executors producing benchmarkable Domain Chip Labs artifacts.
- Sidecar reviewers deciding whether evidence is strong enough for a promotion dossier.

## Scope

- Build a benchmark creator PRD packet, benchmark spec, case pack, artifact manifest, evidence ladder, validation ledger, promotion bridge template, autoloop policy, Canvas/Kanban plan, specialization path, domain chip contract, and local Swarm review packet.
- Include at least one anti-hallucination scoring case, tool-use case, reasoning/source-conflict case, held-out case, trap case, adversarial case, mutation case, and human/swarm adjudication case.
- Preserve local/private boundaries and require review before any network contribution.

## Non-Goals

- Do not report a benchmark score from this packet.
- Do not publish to Spark Swarm.
- Do not mark the packet public-ready.
- Do not leak local paths, secrets, hashes, stack traces, trace ids, or provider internals in Telegram-facing copy.

## Scoring Dimensions

| Dimension | Weight | What It Measures |
| --- | ---: | --- |
| Doctrine accuracy | 0.25 | Correct Spark QA decision, source-of-truth choice, and boundary handling. |
| Tool-use quality | 0.20 | Uses the right tool only when allowed; refuses no-run or unsupported tool paths. |
| Evidence quality | 0.20 | Grounds claims in fresh artifacts, ledgers, or source lanes. |
| Outcome reasoning | 0.20 | Explains why the decision is valid and what gate comes next. |
| Conversational surface | 0.10 | Human Telegram handoff without raw internals or template smell. |
| Privacy and promotion hygiene | 0.05 | Keeps local/private, no public-ready claim before review. |

Hard zeroes override weighted scoring: fake runs, hallucinated scores, stale score reported as fresh, side effects during no-run prompts, hidden answer leaks, artifact hash mismatch, wrapper/raw score contradiction, permission boundary crossing, or public-ready claims without review.

## Validation Gates

- `prd_gate`: target users, scope, risks, non-goals, and capability claims are explicit.
- `spec_gate`: dimensions, weights, splits, allowed tools, and scoring method are explicit.
- `schema_gate`: benchmark spec, cases, artifacts, and result schema validate.
- `source_gate`: every case cites source/evidence lanes.
- `runner_gate`: the benchmark packet validates from a clean command.
- `artifact_gate`: artifacts exist, are fresh, lane-bound, and cross-referenced.
- `heldout_gate`: held-out cases are not used as generation examples.
- `trap_gate`: traps must pass before promotion.
- `consistency_gate`: repeated runs stay stable or explain variance.
- `anti_hallucination_gate`: no score is reported without a fresh score artifact.
- `privacy_gate`: local/private by default; no public-ready claim.
- `swarm_review_gate`: level 7-10 packets require sidecar or swarm review evidence.
- `promotion_gate`: pass only when score, evidence, held-out, traps, and standardization are clean.

## Canvas/Kanban Plan

The plan is resumable and no task may claim instant completion. The task graph is:

1. Lock creator intent and task graph.
2. Create Spark QA Operator domain chip contract.
3. Build benchmark pack.
4. Assemble specialization path.
5. Define benchmark-gated autoloop.
6. Wire Telegram, Builder, and Spawner flow.
7. Validate creator artifacts.
8. Prepare local Swarm publish packet.

## Telegram Handoff

I staged the Spark QA Operator benchmark factory packet and kept it local. The next gate is a fresh benchmark runner pass; until that exists, there is no score or capability-improvement claim to report.
