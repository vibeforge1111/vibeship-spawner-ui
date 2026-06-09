Spark Harness Core Vendor Manifest

This package artifact is vendored so isolated CI, publishing machines, and
standalone Spawner UI checkouts can resolve the canonical Harness Core contracts
without relying on an adjacent local Spark module checkout.

- Source repo: `vibeforge1111/spark-harness-core`
- Source commit: `aa19fd7e49151c9df9e76e38f32da4aba7870bdf`
- Package: `@spark/harness-core@0.1.0`
- Rule: this is the canonical Harness Core contract/Governor package artifact,
  not a fallback authority plane. Spawner remains an execution capability
  consumer. It must not execute high-agency work without native
  `GovernorDecisionV1` authority or an explicitly documented machine-origin
  policy.

Refresh rule:

When Harness Core changes, refresh this vendored artifact from the released
Harness Core package/source commit, then run Spawner authority tests,
`npm run check`, `npm run build`, runtime sync check, and Spark compile before
publishing.
