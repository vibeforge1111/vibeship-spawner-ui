# Spark Agent Bridge API

Spawner exposes a session-based bridge for Spark-controlled canvas, mission, and MCP commands:

- `POST /api/spark-agent/session/start`
- `POST /api/spark-agent/command`
- `GET /api/spark-agent/events?sessionId=...`
- `POST /api/spark-agent/session/end`
- `GET /api/spark-agent/canvas-state`

The bridge normalizes commands, keeps them session-scoped, and emits events that the canvas, mission board, and trace views can inspect.

## Auth And Security

Control surfaces are guarded by API-key auth or loopback-only mode:

- `SPARK_AGENT_API_KEY`
- `EVENTS_API_KEY`
- `MCP_API_KEY`

Optional origin allowlists:

- `SPARK_AGENT_ALLOWED_ORIGINS`
- `EVENTS_ALLOWED_ORIGINS`
- `MCP_ALLOWED_ORIGINS`

Session scoping:

- `POST /api/spark-agent/command` supports `x-spark-agent-session-id` and enforces header/body match.
- `GET /api/spark-agent/events` supports `x-spark-agent-session-id` and enforces header/query match.

## Command Set

Canvas:

- `canvas.create_pipeline`
- `canvas.add_skill`
- `canvas.add_connection`
- `canvas.get_state`

Mission:

- `mission.build`
- `mission.start`
- `mission.pause`
- `mission.resume`
- `mission.stop`
- `mission.status`

MCP:

- `mcp.list`
- `mcp.connect`
- `mcp.call_tool`
- `mcp.disconnect`

Stream:

- `events.subscribe`

## Quick Start

```bash
curl -sS -X POST http://localhost:5173/api/spark-agent/session/start \
  -H "Content-Type: application/json" \
  -d '{"actor":"spark"}'
```

```bash
curl -sS -X POST http://localhost:5173/api/spark-agent/command \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<SESSION_ID>","command":"canvas.create_pipeline","params":{"name":"Launch Pipeline"}}'
```

```bash
curl -N "http://localhost:5173/api/spark-agent/events?sessionId=<SESSION_ID>"
```

## Test Coverage

- `src/routes/api/spark-agent/spark-agent.integration.test.ts`
- `scripts/smoke-routes.mjs`
- `scripts/smoke-mission-surfaces.mjs`
