# Openclaw Bridge API

## Overview

Spawner exposes a session-based bridge for Openclaw chat orchestration:

- `POST /api/openclaw/session/start`
- `POST /api/openclaw/command`
- `GET /api/openclaw/events?sessionId=...`
- `POST /api/openclaw/session/end`

The bridge normalizes canvas, mission, and MCP commands and emits session-scoped events.

## Auth and Security

Control surfaces are guarded by API-key auth or loopback-only mode:

- `OPENCLAW_API_KEY` (preferred for `/api/openclaw/*`)
- `EVENTS_API_KEY` (for `/api/events`)
- `MCP_API_KEY` (fallback key and MCP route guard)

Optional origin allowlists:

- `OPENCLAW_ALLOWED_ORIGINS`
- `EVENTS_ALLOWED_ORIGINS`
- `MCP_ALLOWED_ORIGINS`

Rate limiting is applied per scope (session start/end, command, event stream, event POST).

Session scoping:

- `POST /api/openclaw/command` supports `x-openclaw-session-id` and enforces header/body match.
- `GET /api/openclaw/events` supports `x-openclaw-session-id` and enforces header/query match.

## Command Set (V1)

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

- `events.subscribe` (returns `/api/openclaw/events` session URL)

## Quick Start (curl)

1) Start session

```bash
curl -sS -X POST http://localhost:5173/api/openclaw/session/start \
  -H "Content-Type: application/json" \
  -d '{"actor":"openclaw"}'
```

2) Create pipeline

```bash
curl -sS -X POST http://localhost:5173/api/openclaw/command \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<SESSION_ID>","command":"canvas.create_pipeline","params":{"name":"Launch Pipeline"}}'
```

3) Add skills and connection

```bash
curl -sS -X POST http://localhost:5173/api/openclaw/command \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<SESSION_ID>","command":"canvas.add_skill","params":{"nodeId":"node-a","skillId":"planner","skillName":"Planner"}}'

curl -sS -X POST http://localhost:5173/api/openclaw/command \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<SESSION_ID>","command":"canvas.add_skill","params":{"nodeId":"node-b","skillId":"builder","skillName":"Builder"}}'

curl -sS -X POST http://localhost:5173/api/openclaw/command \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<SESSION_ID>","command":"canvas.add_connection","params":{"sourceNodeId":"node-a","targetNodeId":"node-b"}}'
```

4) Build + start mission

```bash
curl -sS -X POST http://localhost:5173/api/openclaw/command \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<SESSION_ID>","command":"mission.build","params":{"name":"Openclaw Mission"}}'

curl -sS -X POST http://localhost:5173/api/openclaw/command \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<SESSION_ID>","command":"mission.start"}'
```

5) Subscribe to events

```bash
curl -N "http://localhost:5173/api/openclaw/events?sessionId=<SESSION_ID>"
```

6) End session

```bash
curl -sS -X POST http://localhost:5173/api/openclaw/session/end \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<SESSION_ID>","reason":"done"}'
```

## Testing

Integration test:

- `src/routes/api/openclaw/openclaw.integration.test.ts`

The test covers:

- non-local auth rejection
- full session command flow
- events stream connectivity
