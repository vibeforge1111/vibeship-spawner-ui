# Spawner UI - Implementation Tasks

> Generated: 2026-01-04
> Status: In Progress

This file tracks what's built, what's missing, and the implementation order.

---

## Current Architecture

```
┌─────────────────┐     stdio      ┌─────────────────┐      HTTP       ┌─────────────────┐
│   Claude Code   │ ◄──────────► │   mcp-remote    │ ◄──────────────► │  MCP Server     │
│   (Local CLI)   │               │   (bridge)      │                  │  (Cloudflare)   │
└─────────────────┘               └─────────────────┘                  └────────┬────────┘
                                                                                │
                                                                          HTTP  │
                                                                                ▼
                                                                       ┌─────────────────┐
                                                                       │   Spawner UI    │
                                                                       │   (SvelteKit)   │
                                                                       └─────────────────┘
```

**MCP Server URL:**
- Local: `http://localhost:8797` (wrangler dev)
- Production: `https://mcp.vibeship.co`

---

## Phase 1: Foundation (MCP Connection)

### 1.1 Auto-connect to MCP on App Load
- [x] Add MCP connection attempt in root `+layout.svelte` ✅
- [x] Show connection status indicator in Navbar ✅
- [x] Graceful fallback to static data if MCP unavailable *(implemented in skills.svelte.ts)*
- [x] Store connection preference in localStorage ✅

**Status:** ✅ COMPLETE
**Files:** `src/routes/+layout.svelte`, `src/lib/components/Navbar.svelte`

### 1.2 Skills Page - Wire to MCP
- [x] Call `loadSkills()` on mount *(works, falls back to static)*
- [ ] Add "Source: MCP / Static" indicator
- [x] Enable real-time search via `searchSkillsMcp()` *(implemented in store)*
- [ ] Show skill count from server

**Status:** ⚠️ PARTIAL - Store has MCP integration, UI needs source indicator
**Files:** `src/routes/skills/+page.svelte`, `src/lib/stores/skills.svelte.ts`

### 1.3 Skill Detail Page
- [x] Implement `/skills/[id]/+page.svelte` properly
- [ ] Fetch full skill content via `mcpClient.getSkill(id)` *(uses static data)*
- [x] Display skill markdown content, triggers, handoffs
- [x] Show "pairs well with" recommendations

**Status:** ✅ UI COMPLETE - Uses static data, would work with MCP once connected
**Files:** `src/routes/skills/[id]/+page.svelte`

---

## Phase 2: Canvas Integration

### 2.1 Canvas Nodes from MCP Skills
- [x] When adding node to canvas, fetch skill data from MCP *(uses local skill data)*
- [ ] Populate node with skill's inputs/outputs from schema
- [x] Store skill reference in node data

**Status:** ⚠️ PARTIAL - Canvas is fully featured but uses local skill data
**Files:** `src/routes/canvas/+page.svelte`, `src/lib/stores/canvas.svelte.ts`

### 2.2 Node Configuration Panel
- [x] Create side panel for selected node configuration ✅
- [x] Show skill description, required inputs ✅
- [x] Show tags, triggers, handoffs, pairs-well ✅
- [x] Show sharp edges/warnings via MCP ✅
- [ ] Allow parameter configuration (pending schema support)

**Status:** ✅ COMPLETE - Full NodeConfigPanel with tabs
**Files:** `src/lib/components/NodeConfigPanel.svelte` ✅

### 2.3 Canvas Validation via MCP
- [x] Before execution, validate workflow ✅
- [x] Show validation errors on affected nodes ✅
- [x] Display sharp edges warnings via `mcpClient.watchOut()` ✅
- [x] Call `mcpClient.validate()` for server-side validation ✅
- [x] Run MCP Validation button in panel ✅

**Status:** ✅ COMPLETE - Local + MCP validation with sharp edges
**Files:** `src/lib/services/validation.ts` ✅, `src/lib/components/ValidationPanel.svelte` ✅

---

## Phase 3: Real-time Sync Layer

### 3.1 Execution State Store
- [x] Create execution state management *(in executor.ts, not separate store)*
- [x] Track: current mission, running nodes, logs, outputs
- [ ] Support pause/resume/cancel

**Status:** ⚠️ PARTIAL - Executor service has state, missions store has polling
**Files:** `src/lib/services/executor.ts` ✅, `src/lib/stores/missions.svelte.ts` ✅

### 3.2 Polling-based Sync (MVP)
- [x] Poll MCP server for mission status updates *(in missions.svelte.ts)*
- [x] Poll interval: 2s during execution *(implemented)*
- [x] Update UI when mission state changes

**Status:** ✅ IMPLEMENTED - `startLogPolling()` / `stopLogPolling()` in missions store
**Files:** `src/lib/stores/missions.svelte.ts` ✅

### 3.3 SSE/WebSocket Upgrade (Future)
- [ ] Requires MCP server changes
- [ ] Server pushes: execution progress, agent handoffs, completions
- [ ] UI subscribes to mission-specific channel

**Status:** ❌ NOT STARTED - Future enhancement
**Files:** `src/lib/services/realtime.ts` (NOT CREATED)

---

## Phase 4: Mission System

### 4.1 Mission List UI
- [x] Create `/missions` route ✅
- [x] List missions via `mcpClient.listMissions()` ✅
- [x] Status badges logic ready in store ✅
- [x] Quick actions: view, resume, delete ✅

**Status:** ✅ COMPLETE
**Files:** `src/routes/missions/+page.svelte` ✅

### 4.2 Mission Detail/Monitor
- [x] Create `/missions/[id]/+page.svelte` ✅
- [x] Show mission agents, tasks, progress ✅
- [x] Live log stream via `mcpClient.getMissionLogs()` ✅
- [x] `generateClaudeCodePrompt()` helper ✅

**Status:** ✅ COMPLETE
**Files:** `src/routes/missions/[id]/+page.svelte` ✅

### 4.3 Canvas → Mission Export
- [x] Convert canvas workflow to Mission format ✅
- [x] Map nodes to tasks, connections to handoffs ✅
- [x] Create mission via `mcpClient.createMission()` ✅
- [x] Redirect to mission monitor ✅
- [x] Export button in canvas toolbar ✅

**Status:** ✅ COMPLETE
**Files:** `src/lib/services/mission-builder.ts` ✅, `src/routes/canvas/+page.svelte`

---

## Phase 5: Mind Integration

### 5.1 Mind Store & Types
- [x] Create `mind.svelte.ts` store ✅
- [x] Define Memory, Decision, Session types ✅
- [x] Connect to Mind MCP tools ✅

**Status:** ✅ COMPLETE
**Files:** `src/lib/stores/mind.svelte.ts` ✅, `src/lib/services/mcp-client.ts`

### 5.2 Mind Dashboard
- [x] Create `/mind` route ✅
- [x] Show recent memories, decisions ✅
- [x] Add new decisions/issues UI ✅
- [ ] Search/filter memories
- [ ] Memory timeline visualization

**Status:** ⚠️ PARTIAL - Core UI complete, search/timeline missing
**Files:** `src/routes/mind/+page.svelte` ✅

### 5.3 Mind in Canvas Context
- [ ] Show relevant memories when configuring nodes
- [ ] "Remember this" action for manual memory creation
- [ ] Display past decisions that affect current workflow

**Status:** ❌ NOT STARTED
**Files:** Integration across canvas components

---

## Phase 6: Polish & Production

### 6.1 Error Handling
- [ ] Global error boundary
- [ ] MCP connection retry logic
- [ ] Offline mode with clear messaging

### 6.2 Loading States
- [ ] Skeleton loaders for all async content
- [ ] Progress indicators for long operations
- [ ] Optimistic updates where safe

### 6.3 Keyboard Shortcuts
- [ ] Command palette (Cmd/Ctrl+K)
- [ ] Canvas shortcuts documented
- [ ] Customizable keybindings

### 6.4 Mobile Responsiveness
- [ ] Skills browser works on mobile
- [ ] Canvas has touch controls or "desktop only" message
- [ ] Mission monitor readable on tablet

---

## Forgotten/Overlooked Items

### Scanner Integration
- [ ] `/scanner` page exists but is mock only
- [ ] Wire to `mcpClient.validate()` for real scans
- [ ] Support file upload or repo URL input

**Status:** ❌ MOCK ONLY

### Guide Page Updates
- [x] Guide page exists with MCP test
- [ ] Add "connection successful, here's what you can do" flow
- [ ] Link to canvas/skills after successful connection

**Status:** ⚠️ EXISTS BUT INCOMPLETE

### Settings/Preferences
- [ ] No settings page exists
- [ ] Need: MCP URL config, theme toggle, keyboard shortcuts
- [ ] Store in localStorage + sync to MCP if authenticated

**Status:** ❌ NOT STARTED

### Authentication (Future)
- [ ] No auth system currently
- [ ] Needed for: cloud sync, personal missions, team features
- [ ] Likely GitHub OAuth via Supabase or Clerk

**Status:** ❌ NOT STARTED

---

## Implementation Order (Recommended)

```
Week 1: Foundation
├── 1.1 Auto-connect MCP
├── 1.2 Skills from MCP
└── 1.3 Skill detail pages

Week 2: Canvas Power
├── 2.1 Canvas nodes from MCP
├── 2.2 Node config panel
└── 2.3 Validation integration

Week 3: Execution
├── 3.1 Execution store
├── 3.2 Polling sync
├── 4.1 Mission list
└── 4.3 Canvas → Mission

Week 4: Mind + Polish
├── 5.1 Mind store
├── 5.2 Mind dashboard
├── 6.1-6.4 Polish items
└── Scanner integration
```

---

## Quick Wins (Can Do Anytime)

- [x] Add MCP status to Navbar (green dot = connected) ✅
- [x] "Connecting..." state on app load ✅
- [ ] Skill source indicator on skills page
- [ ] Remove/hide Knowledge Base from nav (not core feature)

---

## Current Session Progress

- [x] Landing page redesign (Skilled Agents, Benchmarks, Mind sections)
- [x] Input focus styling fixes
- [x] Spawn button states
- [x] **AUDIT COMPLETE** - Full codebase audit (2026-01-04)
- [x] **MCP Auto-connect** - Added to +layout.svelte with localStorage persistence
- [x] **MCP Status Indicator** - Added to Navbar with tooltip
- [x] **Missions Routes** - Created /missions and /missions/[id] pages
- [x] **Mission Builder** - Canvas → Mission conversion service
- [x] **Export to Mission** - Button in canvas toolbar
- [x] **Mind Store** - Created mind.svelte.ts with MCP integration
- [x] **Mind Dashboard** - Created /mind route with decisions/issues/sessions tabs
- [x] **Navbar Updates** - Added Missions and Mind links
- [x] **Skills Source Indicator** - Shows MCP/Static on skills page
- [x] **NodeConfigPanel** - Full config panel with tabs (details, config, warnings)
- [x] **MCP Validation** - Wired validate() and watchOut() in ValidationPanel

---

## Audit Summary (2026-01-04)

### ✅ FULLY IMPLEMENTED (Ready to Use)
| Component | File | Notes |
|-----------|------|-------|
| MCP Client | `src/lib/services/mcp-client.ts` | Full JSON-RPC, all tool wrappers |
| MCP State Store | `src/lib/stores/mcp.svelte.ts` | Connection management |
| MCP Auto-connect | `src/routes/+layout.svelte` | Auto-connects on app load ✅ |
| MCP Status Indicator | `src/lib/components/Navbar.svelte` | Green/yellow/red dot ✅ |
| Skills Store | `src/lib/stores/skills.svelte.ts` | MCP + static fallback |
| Missions Store | `src/lib/stores/missions.svelte.ts` | Full CRUD, polling, logs |
| Missions List | `src/routes/missions/+page.svelte` | Filter, view, delete ✅ |
| Mission Detail | `src/routes/missions/[id]/+page.svelte` | Tasks, logs, prompt ✅ |
| Mission Builder | `src/lib/services/mission-builder.ts` | Canvas → Mission ✅ |
| Canvas Store | `src/lib/stores/canvas.svelte.ts` | 1300+ lines, complete |
| Canvas Page | `src/routes/canvas/+page.svelte` | Full featured editor + export |
| Validation Service | `src/lib/services/validation.ts` | Local validation |
| Validation Panel | `src/lib/components/ValidationPanel.svelte` | Working UI |
| Executor Service | `src/lib/services/executor.ts` | Simulated execution |
| Execution Panel | `src/lib/components/ExecutionPanel.svelte` | Working UI |
| Skill Detail Page | `src/routes/skills/[id]/+page.svelte` | Complete |
| Mind Store | `src/lib/stores/mind.svelte.ts` | Decisions, issues, sessions ✅ |
| Mind Dashboard | `src/routes/mind/+page.svelte` | Tabbed UI ✅ |
| Node Config Panel | `src/lib/components/NodeConfigPanel.svelte` | Tabs: details, config, warnings ✅ |
| Skills Source Indicator | `src/routes/skills/+page.svelte` | Shows MCP/Static ✅ |
| MCP Validation | `src/lib/services/validation.ts` | validate() + watchOut() ✅ |

### ⚠️ PARTIAL (Needs Completion)
| Task | Missing |
|------|---------|
| Execution via MCP | Currently simulated, needs real MCP calls |
| Mind Search/Timeline | Search/filter and timeline visualization |

### ❌ NOT IMPLEMENTED (Routes/Files Missing)
| Route/File | Priority |
|------------|----------|
| Settings page | LOW |
| Scanner integration | MEDIUM - Currently mock only |
| SSE/WebSocket realtime | LOW - Future enhancement |
| Mind in Canvas context | MEDIUM |

### 📍 RECOMMENDED NEXT STEPS
1. Add skills source indicator (quick win)
2. Create Node Config Panel for canvas
3. Wire MCP validation (mcpClient.validate + watchOut)
4. Wire real execution through MCP instead of simulation

---

## Notes

- MCP server must be running for live features (`wrangler dev` or production)
- Claude Code connects via `mcp-remote` package (stdio → HTTP bridge)
- Mind lightweight version in progress separately (no Docker)
- Skills are stored at `~/.spawner/skills/` locally
