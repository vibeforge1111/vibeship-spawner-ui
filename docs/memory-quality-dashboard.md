# Spark Memory Quality Dashboard

## Compact PRD

Spark needs an internal dashboard at `/memory-quality` that shows whether live
memory recall is trustworthy over time. The page is an operational surface, not
a marketing page: dense signals, source health, latency, failure modes, recent
events, and a manual evaluation panel should be visible quickly.

The dashboard reads local Spark memory quality files when present and falls back
to clearly marked sample data when those files are missing or unreadable. Manual
operator evaluations are appended to a local file under Spawner state so the flow
does not require a database.

## Signals

Recall accuracy groups events by local day and counts `hit`, `miss`, `drift`,
and `unsure` outcomes. A hit means the recalled memory matched the requested
context. A miss means relevant memory was not returned. Drift means a memory was
returned but had meaningfully shifted from the source evidence. Unsure is for
operator reviews where evidence is insufficient.

Failure modes are counted across exactly these categories:

- `confabulation`
- `omission`
- `drift`
- `stale recall`
- `source unavailable`

Latency metrics report p50, p95, and the slowest recent recall in milliseconds.
Source health covers the four monitored memory surfaces: `domain-chip-memory`,
`Telegram conversation memory`, `structured evidence retrieval`, and
`current-state injection`.

## Local Files

By default the loader looks in `.spawner/memory-quality` under the Spawner UI
working directory. Operators can override paths with:

- `SPARK_MEMORY_QUALITY_DIR`
- `MEMORY_QUALITY_RECALL_EVENTS_FILE`
- `MEMORY_QUALITY_SOURCE_HEALTH_FILE`
- `MEMORY_QUALITY_EVALUATIONS_FILE`

Expected JSON may be an array of events, an array of source health records, or an
object containing `events` and/or `sourceHealth`.

## Fallback Behavior

If live metric files are missing or unreadable, the dashboard returns sample
events and shows a visible `Sample data` marker above the fold. Source warnings
are retained in the dataset so operators can tell which file path failed.

Manual evaluations are still written locally when fallback data is active. After
submission, the new event appears at the top of the recent recall table alongside
the sample marker.

## Manual Smoke Test

1. Run `npm run dev`.
2. Visit `/memory-quality`.
3. Confirm recall accuracy, failure modes, latency, source health, and the
   sample-data marker are visible.
4. Submit a manual evaluation with query, source, outcome, latency, and notes.
5. Confirm the new evaluation appears at the top of recent recall events.
