# Memory Dashboard v1

The focused memory dashboard lives at `/memory-dashboard`. It is intentionally
small: the first screen centers on memory volume, retrieval usefulness, and stale
or risky memories, with filters, trend/distribution visuals, and an actionable
review list underneath.

## Data Source

V1 uses seeded sample records from `src/lib/services/memory-dashboard.ts`.
The loader marks the dataset with `isSampleData: true`, `sourceLabel`, and a
warning so the UI never implies that live memory data is connected.

To replace the seed later, keep the `MemoryDashboardDataset` contract in
`src/lib/services/memory-dashboard-types.ts` and swap `loadMemoryDashboardDataset`
for a live adapter. The aggregation helpers in
`src/lib/services/memory-dashboard-aggregates.ts` are deterministic and accept
plain typed records.

## Metric Contract

- Memory volume: count of records in the current filtered slice.
- Retrieval usefulness: useful retrievals divided by total retrievals.
- Stale or risky memories: count of stale, risky, review, low-confidence, or old
  records that should be handled.

Seeded fallback behavior is defined alongside the metric contract in
`MEMORY_DASHBOARD_METRIC_CONTRACT`.

## Verification

Run these before shipping changes:

```bash
npm run check
npm run test:run -- memory-dashboard
npm run test:e2e -- memory-dashboard
npm run build
```

`npm run test:e2e -- memory-dashboard` starts a bounded local dev server, checks
the route, verifies the metric/filter/list/sample-data markers, then stops the
server.
