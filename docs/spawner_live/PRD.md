# Spawner Live: Real-Time Agent Orchestration Visualization

## Product Requirements Document (PRD)

**Version:** 1.0
**Date:** 2025-01-05
**Status:** Draft

---

## Executive Summary

Spawner Live transforms the Spawner UI from a static pipeline builder into a living, breathing visualization of AI agent orchestration. Users can watch Claude work through pipelines in real-time with beautiful animations, while a robust enforcement layer ensures Claude always respects the visual schema.

**Primary Goals:**
1. Make agent orchestration visually stunning for streamers/content creators
2. Ensure Claude consistently follows the visual pipeline (not just creates it)
3. Provide developers with full observability into agent behavior
4. Create a seamless sync between Claude's actions and visual representation

---

## Problem Statement

### Current Pain Points

| Problem | Impact |
|---------|--------|
| Claude ignores the canvas entirely | Users build pipelines that are never used |
| Claude creates nodes but executes independently | Visual pipeline becomes decoration, not orchestration |
| Inconsistent behavior | Sometimes works, sometimes doesn't - unpredictable |
| No feedback loop | Even when Claude follows the pipeline, users can't see it |

### Root Cause
The sync between Spawner UI and Claude is one-directional and unenforced. Claude can receive canvas state but isn't required to follow it or report back.

---

## Solution Overview

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────┐
│           VISUALIZATION LAYER                   │
│  • Presentation Mode (dramatic animations)      │
│  • Developer Mode (observability panels)        │
│  • Effects Engine (translates events → visuals) │
└─────────────────────────────────────────────────┘
                      ▲
                      │ Events
                      │
┌─────────────────────────────────────────────────┐
│           EVENT ORCHESTRATOR                    │
│  • Central event hub                            │
│  • Event validation & sequencing                │
│  • State machine per node                       │
└─────────────────────────────────────────────────┘
                      ▲
                      │ WebSocket + MCP
                      │
┌─────────────────────────────────────────────────┐
│           ENFORCEMENT LAYER                     │
│  • spawner-canvas skill (mandatory)             │
│  • MCP Pipeline Validator                       │
│  • Event Contract (required emissions)          │
└─────────────────────────────────────────────────┘
```

---

## Detailed Requirements

### 1. Visualization Layer

#### 1.1 Presentation Mode (Streamer-Friendly)

**Node States & Animations:**

| State | Visual Treatment |
|-------|------------------|
| `idle` | Default appearance, subtle breathing animation (scale 1.0 → 1.02) |
| `waiting` | Soft pulsing glow, "waiting" badge |
| `active` | Spotlight ring, slight scale up (1.1x), agent name badge, glowing orb indicator |
| `processing` | Progress ring around node, activity particles |
| `success` | Green flash, particle burst outward, satisfying "complete" indicator |
| `error` | Red pulse, shake animation, error badge with message |
| `skipped` | Dimmed (50% opacity), "skipped" badge |

**Connection Animations:**

| Event | Animation |
|-------|-----------|
| Idle | Subtle dashed line flow (existing) |
| Data flowing | Bright pulse traveling along path, connection glows |
| Handoff | Spotlight effect on connection, energy transfer animation |
| Error propagation | Red pulse traveling along path |

**Dramatic Moments:**

| Moment | Effect | Tunable Settings |
|--------|--------|------------------|
| Node completion | Particle burst (50 particles, 500ms) | particle count, duration, enabled |
| Node error | Shake (3 cycles, 200ms) + red pulse | shake intensity, enabled |
| Handoff | Connection spotlight + traveling pulse | pulse speed, glow intensity, enabled |
| Pipeline complete | Confetti burst + success banner (2s) | confetti count, banner duration, sound, enabled |
| Pipeline failed | Screen edge red vignette + error summary | vignette intensity, enabled |

**Abstract Activity Indicators:**
- Glowing orb appears at active node
- Subtle particle trail showing recent activity path
- Ambient "energy" effect when pipeline is running

#### 1.2 Developer Mode (Observability)

**Collapsible Panels:**

| Panel | Content | Default Position |
|-------|---------|------------------|
| Execution Log | Real-time scrolling log with timestamps, tool calls, thinking | Right sidebar |
| Pipeline Compliance | "Following pipeline" indicator, deviation alerts, step tracker | Top bar |
| Performance Metrics | Time per node, total elapsed, tokens used, cost estimate | Bottom bar |
| State Inspector | Click any node to see inputs, outputs, current state | Right sidebar (tab) |

**Compliance Indicator:**
```
┌─────────────────────────────────────────────────┐
│ Pipeline: auth-flow          Status: FOLLOWING  │
│ ████████████░░░░░░░░ Step 3/8: validate-input   │
│ ✓ init → ✓ fetch-user → ● validate-input → ...  │
└─────────────────────────────────────────────────┘
```

**Deviation Alerts:**
- Yellow warning: Claude working on something not in pipeline
- Red alert: Claude skipped a required step
- Info: Claude added a step not in original pipeline

#### 1.3 Mode Toggle

- Single toggle switch in navbar: "Live Mode" with presentation/developer icons
- Keyboard shortcut: `Cmd/Ctrl + Shift + L`
- Settings panel for fine-tuning each mode
- Presets: "Minimal", "Balanced", "Maximum Drama"

---

### 2. Event Orchestrator

#### 2.1 Event Types

```typescript
// Core agent events
interface AgentEvent {
  type: AgentEventType;
  nodeId: string;
  agentId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

type AgentEventType =
  | 'agent_enter'      // Agent starts working on a node
  | 'agent_progress'   // Progress update (0-100)
  | 'agent_thinking'   // Agent is processing/thinking
  | 'agent_output'     // Agent produced output
  | 'agent_exit'       // Agent finished with node
  | 'agent_error'      // Agent encountered error
  | 'agent_skip'       // Agent decided to skip node
  | 'handoff_start'    // Beginning handoff to another agent
  | 'handoff_complete' // Handoff finished
  | 'pipeline_start'   // Pipeline execution began
  | 'pipeline_complete'// Pipeline finished successfully
  | 'pipeline_failed'  // Pipeline failed
  | 'deviation_warn'   // Agent deviated from pipeline
```

#### 2.2 Node State Machine

```
                    ┌──────────┐
                    │   idle   │
                    └────┬─────┘
                         │ agent_enter
                         ▼
                    ┌──────────┐
         ┌─────────│ waiting  │
         │         └────┬─────┘
         │              │ (dependencies met)
         │              ▼
         │         ┌──────────┐
         │    ┌────│  active  │────┐
         │    │    └────┬─────┘    │
         │    │         │          │
         │    │ agent_  │ agent_   │ agent_
         │    │ error   │ progress │ skip
         │    │         ▼          │
         │    │    ┌──────────┐    │
         │    │    │processing│    │
         │    │    └────┬─────┘    │
         │    │         │          │
         │    │         │ agent_   │
         │    │         │ exit     │
         │    ▼         ▼          ▼
         │ ┌──────┐ ┌───────┐ ┌───────┐
         │ │error │ │success│ │skipped│
         │ └──────┘ └───────┘ └───────┘
         │     │         │         │
         └─────┴─────────┴─────────┘
                    │ (reset)
                    ▼
               ┌──────────┐
               │   idle   │
               └──────────┘
```

#### 2.3 Event Validation

- Events must arrive in valid state transitions
- Out-of-order events are queued and replayed
- Missing events trigger warnings (not errors)
- Duplicate events are deduplicated by timestamp

---

### 3. Enforcement Layer

#### 3.1 spawner-canvas Skill

**Purpose:** Mandatory skill that Claude MUST invoke at session start when a pipeline exists.

**Behavior:**
1. Reads current canvas state from UI via sync
2. Presents pipeline to Claude as the "execution plan"
3. Instructs Claude to follow nodes in order
4. Requires Claude to emit events at each step
5. Warns Claude if it deviates from the plan

**Skill Content (simplified):**
```markdown
# spawner-canvas

You are working with a visual pipeline. Follow these rules:

1. **Check the pipeline first** - Use `spawner_get_canvas()` to see the current workflow
2. **Announce entry** - Before working on a node, emit `agent_enter` event
3. **Report progress** - Emit `agent_progress` events during work
4. **Announce exit** - When done with a node, emit `agent_exit` event
5. **Follow the order** - Execute nodes in dependency order
6. **No skipping** - If you must skip a node, emit `agent_skip` with reason
7. **Handoffs** - When passing to another agent, emit `handoff_start` and wait

Deviating from the pipeline without emitting events will show as a warning to the user.
```

#### 3.2 MCP Pipeline Validator

**New MCP Tools:**

| Tool | Purpose |
|------|---------|
| `spawner_get_canvas` | Returns current canvas state (nodes, connections, positions) |
| `spawner_emit_event` | Emit an agent event (validated against state machine) |
| `spawner_check_step` | Validate that a planned action aligns with pipeline |
| `spawner_get_next_node` | Returns the next node(s) to execute |
| `spawner_report_deviation` | Explicitly report intentional deviation with reason |

**Validation Rules:**
- `spawner_emit_event` validates state transitions
- `spawner_check_step` returns warnings if action doesn't match next expected node
- All tool calls are logged for compliance panel

#### 3.3 Event Contract

**Required Events:**
- `pipeline_start` before any node work
- `agent_enter` before working on each node
- `agent_exit` or `agent_error` after each node
- `pipeline_complete` or `pipeline_failed` at end

**Compliance Scoring:**
```
Score = (emitted_required_events / total_required_events) * 100
```
- 100%: Full compliance, green indicator
- 80-99%: Minor gaps, yellow indicator
- <80%: Major gaps, red indicator with details

---

## Edge Cases & Error Handling

### 4.1 Connection Issues

| Scenario | Handling |
|----------|----------|
| WebSocket disconnects | Show "reconnecting" indicator, buffer events locally, replay on reconnect |
| MCP server unreachable | Queue events, retry with exponential backoff, show warning |
| Sync latency (>2s) | Show "syncing" indicator, don't block UI |
| Event delivery failure | Retry 3x, then log to error panel |

### 4.2 State Inconsistencies

| Scenario | Handling |
|----------|----------|
| Event for unknown node | Log warning, ignore event (don't crash) |
| Out-of-order events | Queue and replay in correct order |
| Duplicate events | Dedupe by (nodeId, type, timestamp) |
| Stale state | UI polls for full state every 30s as backup |
| Claude reports different pipeline | Show diff panel, ask user to resolve |

### 4.3 Pipeline Execution

| Scenario | Handling |
|----------|----------|
| Node has no agent assigned | Skip with warning, show "unassigned" badge |
| Circular dependency detected | Block execution, show error |
| Node fails mid-pipeline | Mark node error, pause pipeline, offer retry/skip/abort |
| User modifies pipeline during execution | Warn user, offer to restart or continue with old plan |
| Multiple agents active simultaneously | Support parallel execution, show all active nodes |

### 4.4 Animation Performance

| Scenario | Handling |
|----------|----------|
| Many nodes (50+) active | Reduce particle count, disable distant animations |
| Low-end device detected | Auto-enable "reduced motion" mode |
| Animation jank | Use `requestAnimationFrame`, GPU-accelerated transforms only |
| Memory pressure | Limit event history to 1000 items, prune old animations |

### 4.5 Mode Switching

| Scenario | Handling |
|----------|----------|
| Switch mode during execution | Smooth transition, don't interrupt events |
| Panel layout not saved | Persist to localStorage |
| Mode-specific events | Presentation mode: all effects. Developer: minimal effects + full data |

---

## Success Metrics

### User Experience
- [ ] User can SEE Claude following the pipeline in real-time
- [ ] Animations are smooth (60fps) on modern devices
- [ ] Mode toggle is instant (<100ms)
- [ ] Streamers find it "watchable" without explanation

### Enforcement
- [ ] Claude follows pipeline 95%+ of the time when spawner-canvas skill is active
- [ ] Deviations are always visible in compliance panel
- [ ] Users report feeling "in control" of agent behavior

### Technical
- [ ] Event latency <500ms from Claude action to UI update
- [ ] WebSocket reconnects within 5s
- [ ] Zero crashes from malformed events
- [ ] Works on 1000+ node pipelines (with performance optimizations)

---

## Out of Scope (v1)

- Sound effects (future enhancement)
- Custom themes beyond light/dark
- Recording/playback of sessions
- Multi-user collaboration
- Mobile support

---

## Appendix A: Event Payload Examples

```typescript
// Agent enters a node
{
  type: 'agent_enter',
  nodeId: 'node-abc123',
  agentId: 'claude-opus',
  timestamp: '2025-01-05T10:30:00.000Z',
  data: {
    nodeName: 'validate-input',
    skillId: 'input-validator'
  }
}

// Progress update
{
  type: 'agent_progress',
  nodeId: 'node-abc123',
  agentId: 'claude-opus',
  timestamp: '2025-01-05T10:30:05.000Z',
  data: {
    progress: 45,
    message: 'Validating email format...'
  }
}

// Handoff between agents
{
  type: 'handoff_start',
  nodeId: 'node-abc123',
  agentId: 'claude-opus',
  timestamp: '2025-01-05T10:30:10.000Z',
  data: {
    targetNodeId: 'node-def456',
    targetAgentId: 'claude-sonnet',
    payload: { validatedInput: {...} }
  }
}

// Pipeline completion
{
  type: 'pipeline_complete',
  nodeId: null,
  agentId: 'claude-opus',
  timestamp: '2025-01-05T10:35:00.000Z',
  data: {
    totalDuration: 300000,
    nodesCompleted: 8,
    nodesSkipped: 0,
    nodesFailed: 0
  }
}
```

---

## Appendix B: Animation Specifications

### Particle Burst (Success)
```css
.particle {
  animation: burst 500ms ease-out forwards;
}

@keyframes burst {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
}
```

### Node Spotlight (Active)
```css
.node-active {
  animation: spotlight 2s ease-in-out infinite;
  filter: drop-shadow(0 0 20px var(--agent-color));
}

@keyframes spotlight {
  0%, 100% { filter: drop-shadow(0 0 15px var(--agent-color)); }
  50% { filter: drop-shadow(0 0 25px var(--agent-color)); }
}
```

### Connection Pulse (Handoff)
```css
.connection-pulse {
  stroke-dasharray: 10;
  animation: flow 1s linear infinite, glow 500ms ease-out;
}

@keyframes glow {
  0% { stroke-width: 2; stroke-opacity: 1; }
  100% { stroke-width: 6; stroke-opacity: 0; }
}
```

### Shake (Error)
```css
.node-error {
  animation: shake 200ms ease-in-out 3;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
```
