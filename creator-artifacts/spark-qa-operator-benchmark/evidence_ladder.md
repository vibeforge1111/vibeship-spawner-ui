# Spark QA Operator Evidence Ladder

## Tier 0: Staged

PRD, benchmark spec, cases, artifact manifest, Canvas/Kanban plan, and validation ledger exist. No score or capability improvement may be claimed.

## Tier 1: Locally Validated Packet

The local validation command passes and confirms required files, splits, gates, boundaries, and no-score discipline. This proves packet shape only.

## Tier 2: Fresh Baseline

A benchmark runner produces a fresh baseline score artifact with benchmark refs, runner id, timestamp, and validation ledger update.

## Tier 3: Candidate Run

A candidate run produces baseline score, candidate score, delta, held-out verdict, trap verdict, and wrapper/raw reconciliation.

## Tier 4: Promotion Dossier

Sidecar or human/swarm adjudication signs off that the improvement is real, not wording-only, not stale, not leaked from hidden cases, and not public-ready without review.

## Tier 5: Review-Ready Local Packet

A local Swarm contribution packet may be reviewed. `network_absorbable` remains false until a future operator explicitly approves publication after all gates pass.
