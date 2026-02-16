# MCP + Openclaw Integration Roadmap

Date: 2026-02-16

## Goal

Make MCP support production-ready in Spawner UI and enable direct control of Spawner workflows/canvas from Openclaw chat.

## Implementation Status

Completed in this repository:

- [x] Phase 0 -> `fix(mcp): align tool and config type contracts` (`6db3078`)
- [x] Phase 1 -> `feat(mcp): add unified runtime snapshot service` (`d87c423`)
- [x] Phase 2 -> `feat(mcp): add beginner setup flow with smoke tests` (`9351f2b`)
- [x] Phase 3 -> `feat(orchestrator): add executable mcp tool planning` (`a0196d9`)
- [x] Phase 4 -> `feat(openclaw): add session bridge for canvas mission and mcp control` (`a2f574c`)
- [x] Phase 5 -> `fix(security): harden openclaw and mcp control surfaces` (`8d3d15a`)

Notes:

- `npm run check` still reports pre-existing baseline errors outside this roadmap scope.
- New integration coverage includes `/api/openclaw/*` session + command + stream flow.

## Current State (What Exists)

- Single MCP server connection (Spawner MCP) exists via:
  - `src/lib/stores/mcp.svelte.ts`
  - `src/lib/services/mcp-client.ts`
- Multi-MCP registry + instances exist via:
  - `src/lib/stores/mcps.svelte.ts`
  - `src/routes/mcps/+page.svelte`
  - `src/routes/api/mcp/+server.ts`
  - `src/routes/api/mcp/call/+server.ts`
- Multi-LLM orchestrator already consumes connected MCP capabilities for routing hints:
  - `src/lib/components/ExecutionPanel.svelte`
  - `src/lib/services/multi-llm-orchestrator.ts`
- Canvas real-time protocol exists (`canvas_*` events), currently centered on Claude/sync bridge:
  - `src/lib/services/canvas-sync.ts`
  - `src/lib/services/sync-client.ts`
  - `src/routes/api/events/+server.ts`

## Critical Gaps To Close First

1. Type contract drift in MCP models
- `src/lib/types/mcp.ts` has duplicate `MCPTool` interface declarations with conflicting optionality.
- This breaks `npm run check` and weakens MCP reliability.

2. Two MCP systems are partially parallel
- `mcp.svelte.ts` (single remote MCP) and `mcps.svelte.ts` (multi local MCP instances) are both active.
- UX and orchestration are not yet unified under a single MCP capability/health model.

3. MCP onboarding is still expert-oriented
- No guided setup for required env vars, command allowlist, auth keys, and tool smoke tests.
- Users can connect MCPs, but first-run success path is not fully guided.

4. Openclaw integration layer does not exist yet
- No Openclaw-specific adapter, auth/session model, or command-to-canvas/missions mapping.

5. Event/API hardening needed for external chat control
- `/api/events` allows broad ingestion with no auth currently.
- For Openclaw-driven control, inbound control routes need signed auth + allowlist + tenant/session scoping.

## Target Architecture

1. Unified MCP Runtime
- One source of truth for connected MCP instances, health, capabilities, and tool schemas.
- Orchestrator consumes this runtime directly (not via ad-hoc projections).

2. MCP Capability Graph
- Build a deterministic graph:
  - Task intent -> required capabilities -> candidate MCPs/tools -> fallback chain.
- Use this graph in mission build + multi-LLM prompt generation.

3. Openclaw Bridge
- Stateless HTTP bridge + event stream:
  - Openclaw sends high-level intents.
  - Bridge translates to Spawner operations (canvas actions, mission actions, MCP tool calls).
  - Bridge streams progress back as normalized events.

4. Security Envelope
- API key or signed token required for all control endpoints.
- Session/pipeline scoping on every mutating command.
- Tool-level allowlist and per-MCP capability checks before execution.

## Phased Plan

## Phase 0 - Stabilize MCP Foundations

Scope:
- Fix MCP type drift and baseline MCP-related check errors.
- Add MCP contract tests.

Files:
- `src/lib/types/mcp.ts`
- `src/lib/stores/mcps.svelte.ts`
- `src/lib/types/schemas.ts`

Acceptance:
- `npm run check` has no MCP type errors.
- Unit tests validate MCP instance/tool schema compatibility.

Commit:
- `fix(mcp): align tool and instance type contracts`

## Phase 1 - Unified MCP Runtime + Health

Scope:
- Introduce `MCPRuntimeService`:
  - connected instances
  - capabilities
  - tool schemas
  - health and last-check status
- Make `ExecutionPanel` and orchestrator read from runtime service.

Files:
- `src/lib/services/mcp-runtime.ts` (new)
- `src/lib/stores/mcps.svelte.ts`
- `src/lib/components/ExecutionPanel.svelte`
- `src/lib/services/mission-executor.ts`

Acceptance:
- One canonical MCP capability snapshot used by orchestrator.
- Connected/disconnected MCP transitions reflected within one render tick.

Commit:
- `feat(mcp): add unified runtime state for orchestration`

## Phase 2 - Beginner MCP Setup Flow

Scope:
- Add guided setup wizard:
  - select MCP
  - required config/env guidance
  - test connection
  - test one tool call
  - mark as ready
- Add per-MCP quick-fix UI for common errors.

Files:
- `src/routes/mcps/+page.svelte`
- `src/lib/components/McpConnection.svelte`
- `src/lib/services/mcp/client.ts`

Acceptance:
- New user can connect at least one MCP and run a test tool without docs.
- Setup completion rate and failure reasons are observable (local telemetry/events).

Commit:
- `feat(mcp-ui): add guided setup and tool smoke tests`

## Phase 3 - MCP-Aware Orchestration Execution

Scope:
- Expand routing from hints to executable planning:
  - identify tasks requiring MCP tools
  - attach tool plans to provider prompts
  - fallback if MCP unavailable
- Add mission-time MCP usage logs.

Files:
- `src/lib/services/multi-llm-orchestrator.ts`
- `src/lib/services/mission-executor.ts`
- `src/lib/services/canvas-sync.ts`

Acceptance:
- Mission pack includes explicit MCP tool plan blocks for relevant tasks.
- If required MCP unavailable, mission emits deterministic blocked reason + fallback suggestion.

Commit:
- `feat(orchestrator): add executable mcp tool planning`

## Phase 4 - Openclaw Bridge API

Scope:
- Add Openclaw bridge endpoints and event stream:
  - `POST /api/openclaw/session/start`
  - `POST /api/openclaw/command`
  - `GET /api/openclaw/events?sessionId=...`
  - `POST /api/openclaw/session/end`
- Command translator for:
  - canvas operations
  - mission operations
  - MCP tool operations

Files:
- `src/routes/api/openclaw/session/start/+server.ts` (new)
- `src/routes/api/openclaw/command/+server.ts` (new)
- `src/routes/api/openclaw/events/+server.ts` (new)
- `src/lib/services/openclaw-bridge.ts` (new)
- `src/lib/services/event-bridge.ts`

Acceptance:
- Openclaw chat can create/update a canvas and run a mission through bridge commands.
- End-to-end integration test covers one full session.

Commit:
- `feat(openclaw): add session bridge for canvas mission and mcp control`

## Phase 5 - Security + Governance for External Control

Scope:
- Require auth for all external control APIs.
- Add origin/session scoping, rate limits, and command allowlists.
- Add audit log entries for all bridge commands.

Files:
- `src/lib/server/mcp-auth.ts`
- `src/routes/api/events/+server.ts`
- `src/routes/api/openclaw/**/+server.ts`

Acceptance:
- Unauthorized commands are rejected.
- All accepted commands are traceable with session + actor metadata.

Commit:
- `fix(security): harden openclaw and mcp control surfaces`

## Openclaw Command Mapping (V1)

1. Canvas
- `canvas.create_pipeline` -> queue pending load + activate pipeline
- `canvas.add_skill` -> `canvas_add_skill`
- `canvas.add_connection` -> `canvas_connect`
- `canvas.get_state` -> current nodes/connections + pipeline metadata

2. Mission
- `mission.build` -> run local mission builder from current canvas
- `mission.start` -> mission executor start
- `mission.pause` / `mission.resume` / `mission.stop` -> mission executor controls
- `mission.status` -> active mission snapshot

3. MCP
- `mcp.list` -> registry + connected status
- `mcp.connect` -> create + connect instance
- `mcp.call_tool` -> validated tool call on connected instance
- `mcp.disconnect` -> disconnect instance

4. Stream
- `events.subscribe` -> SSE stream with normalized event payloads:
  - mission lifecycle
  - task lifecycle
  - provider feedback
  - mcp tool invocation outcomes

## Testing Plan

- Unit:
  - MCP type/runtime normalization
  - Openclaw command translation
  - permission and capability guards
- Integration:
  - `/api/mcp` connect/call/disconnect
  - `/api/openclaw/*` session + command + stream
  - mission active-state persistence with MCP plans
- E2E:
  - Openclaw command sequence creates canvas -> runs mission -> consumes events.

## Recommended Execution Order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5

This order minimizes regressions by stabilizing MCP contracts before introducing external chat control.

