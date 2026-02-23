# Sentinel Dispatch Adapter (Spawner UI)

Spawner UI now exposes a receiver endpoint for Spark PR Sentinel action payloads.

## Endpoint
- `POST /api/sentinel/dispatch`
- Auth: `EVENTS_API_KEY` (or fallback `MCP_API_KEY`) via header/query/cookie based on control auth rules.

## Accepted payload
The payload should follow Sentinel contract fields:
- `source`: `spark-pr-sentinel`
- `generated_at`: ISO timestamp string
- `summary`: object
- `actions`: array of action objects

Each action requires:
- `kind`: `pr_review` or `issue_followup`
- `id`
- `priority`
- `title`
- `reasons` (array)

## Behavior
- Valid payloads are normalized and accepted.
- The endpoint emits `sentinel_action_received` bridge events for UI visibility.
- Response:
  - success: `{ ok: true, accepted, receivedAt, summary }`
  - validation error: `{ ok: false, errors }` with `422`

## Example
```bash
curl -X POST http://127.0.0.1:5173/api/sentinel/dispatch \
  -H "Content-Type: application/json" \
  -H "x-api-key: <EVENTS_API_KEY>" \
  -d @reports/spawner_mission.json
```

This adapter is intentionally minimal and safe: it validates payload shape and exposes events so downstream mission execution logic can be plugged in incrementally.
