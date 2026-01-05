# Spawner Live: Implementation Plan

## Overview

This document provides a step-by-step implementation plan for Spawner Live. Each phase builds on the previous, with clear milestones and edge case handling.

---

## Phase 1: Core Event System

**Goal:** Establish the foundational event routing and state management.

### Step 1.1: Create Type Definitions

**Files to create:**
- `src/lib/spawner-live/types/events.ts`
- `src/lib/spawner-live/types/states.ts`
- `src/lib/spawner-live/types/animation.ts`
- `src/lib/spawner-live/types/compliance.ts`

**Edge Cases:**
- Unknown event types should be logged but not crash the system
- Malformed events should be rejected with clear error messages
- Future event types should be forward-compatible (use discriminated unions)

### Step 1.2: Build Event Router

**File:** `src/lib/spawner-live/orchestrator/event-router.ts`

**Features:**
- Subscribe/unsubscribe pattern
- Type-filtered subscriptions
- Node-filtered subscriptions
- Event history with configurable limit
- Svelte store integration for reactivity

**Edge Cases:**
| Edge Case | Handling |
|-----------|----------|
| Subscriber throws exception | Catch, log, continue to other subscribers |
| Duplicate subscription IDs | Replace old subscription (warn in dev) |
| High-frequency events (>100/s) | Throttle with latest-value semantics |
| Memory pressure | Auto-prune history to 500 items |

### Step 1.3: Build State Machine Manager

**File:** `src/lib/spawner-live/orchestrator/state-machine.ts`

**Features:**
- Per-node state tracking
- Valid transition enforcement
- State history per node
- Duration tracking

**Edge Cases:**
| Edge Case | Handling |
|-----------|----------|
| Invalid state transition | Reject, log warning, keep current state |
| Event for unknown node | Create default state, process event |
| Duplicate exit events | Ignore subsequent exits |
| Orphaned active states | Timeout after 5 minutes → auto-error |
| Node deleted during active | Mark as 'cancelled' special state |

### Step 1.4: Build Event Validator

**File:** `src/lib/spawner-live/orchestrator/event-validator.ts`

**Features:**
- Schema validation
- Sequence validation
- Deduplication (by id or timestamp+type+node)
- Event ordering/reordering

**Edge Cases:**
| Edge Case | Handling |
|-----------|----------|
| Out-of-order events | Queue up to 10 events, replay when gap filled |
| Events from wrong pipeline | Reject with warning |
| Extremely old events (>1hr) | Accept but mark as 'stale' |
| Future timestamps | Accept but log warning (clock skew) |

### Step 1.5: Build Event Buffer

**File:** `src/lib/spawner-live/orchestrator/event-buffer.ts`

**Features:**
- Offline event storage (IndexedDB)
- Replay on reconnection
- Conflict resolution

**Edge Cases:**
| Edge Case | Handling |
|-----------|----------|
| IndexedDB unavailable | Fall back to in-memory (warn user) |
| Buffer overflow (>1000 events) | Drop oldest events |
| Replay conflicts | Server events win, reapply local |
| Corrupted buffer | Clear and start fresh |

---

## Phase 2: Sync Layer Enhancement

**Goal:** Robust bidirectional communication with the enforcement layer.

### Step 2.1: Enhance Sync Client

**File:** `src/lib/spawner-live/sync/enhanced-sync.ts`

**Features:**
- Agent event handling
- Event acknowledgment
- Retry with exponential backoff
- Connection state management

**Edge Cases:**
| Edge Case | Handling |
|-----------|----------|
| WebSocket disconnect | Immediate reconnect attempt, then backoff |
| Reconnect fails 10 times | Show "offline" mode, continue with local state |
| Server rejects event | Log error, notify user, don't retry |
| Network latency >2s | Show "syncing" indicator |
| Server sends invalid data | Reject, log, don't crash |

### Step 2.2: Build State Reconciler

**File:** `src/lib/spawner-live/sync/state-reconciler.ts`

**Features:**
- Diff detection between local and server state
- Merge strategies (server-wins, local-wins, interactive)
- Full state refresh capability
- Periodic reconciliation (every 30s)

**Edge Cases:**
| Edge Case | Handling |
|-----------|----------|
| Conflict: node exists locally but not on server | Ask user: keep local or delete |
| Conflict: different pipeline versions | Show diff, let user choose |
| Server state is stale | Use timestamps, prefer newer |
| Reconciliation during execution | Pause execution, reconcile, resume |

---

## Phase 3: Effects Engine

**Goal:** Beautiful, performant visual feedback for all events.

### Step 3.1: Create Animation Manager

**File:** `src/lib/spawner-live/effects/animation-manager.ts`

**Features:**
- Node scale animations
- Node pulse animations
- Node shake animations
- Progress ring management
- Agent indicator show/hide

**Implementation Notes:**
```typescript
// Use CSS classes for GPU-accelerated animations
// Avoid JavaScript-based frame-by-frame animation

// Example: Scale animation
scaleNode(nodeId: string, scale: number, duration: number): void {
  const node = document.querySelector(`[data-node-id="${nodeId}"]`);
  if (!node) return;

  node.style.transition = `transform ${duration}ms ease-out`;
  node.style.transform = `scale(${scale})`;
}
```

**Edge Cases:**
| Edge Case | Handling |
|-----------|----------|
| Node not in DOM | Skip animation, log debug |
| Rapid animation requests | Cancel previous, start new |
| Animation during scroll/zoom | Use `will-change`, `transform` only |
| Reduced motion preference | Check `prefers-reduced-motion`, skip effects |

### Step 3.2: Build Particle System

**File:** `src/lib/spawner-live/effects/particle-system.ts`

**Features:**
- Particle burst on completion
- Particle trail while processing
- Configurable particle count, color, duration
- Object pooling for performance

**Implementation Notes:**
```typescript
// Use a single canvas overlay for all particles
// Pool particle objects to avoid GC pressure
// Use requestAnimationFrame for smooth animation

class ParticlePool {
  private pool: Particle[] = [];
  private active: Particle[] = [];
  private maxParticles = 500;

  acquire(): Particle | null {
    if (this.active.length >= this.maxParticles) return null;
    const particle = this.pool.pop() || new Particle();
    this.active.push(particle);
    return particle;
  }

  release(particle: Particle): void {
    const idx = this.active.indexOf(particle);
    if (idx >= 0) {
      this.active.splice(idx, 1);
      particle.reset();
      this.pool.push(particle);
    }
  }
}
```

**Edge Cases:**
| Edge Case | Handling |
|-----------|----------|
| Too many particles requested | Cap at maxParticles, log warning |
| Node moves during particle burst | Particles continue from original position |
| Canvas resize during animation | Recalculate positions on resize |
| Low FPS detected (<30) | Reduce particle count by 50% |

### Step 3.3: Build Spotlight Manager

**File:** `src/lib/spawner-live/effects/spotlight-manager.ts`

**Features:**
- Activate/deactivate spotlight per node
- Configurable color and intensity
- Smooth transitions
- Multiple simultaneous spotlights (parallel execution)

**Edge Cases:**
| Edge Case | Handling |
|-----------|----------|
| Spotlight on hidden node | Skip effect |
| Multiple agents on same node | Increase intensity, show multiple badges |
| Spotlight color conflict | Blend colors or use striped effect |

### Step 3.4: Build Connection Effects

**File:** `src/lib/spawner-live/effects/connection-effects.ts`

**Features:**
- Connection spotlight/glow
- Traveling pulse animation
- Error propagation effect
- Data flow visualization

**Implementation Notes:**
```typescript
// Use SVG path animation for traveling pulse
// Calculate path length, animate stroke-dashoffset

travelingPulse(sourceId: string, targetId: string, options: PulseOptions): void {
  const connection = findConnection(sourceId, targetId);
  if (!connection) return;

  const path = connection.querySelector('path');
  const length = path.getTotalLength();

  // Create pulse element
  const pulse = createPulseElement(options);

  // Animate along path using motionPath or manual calculation
  animateAlongPath(pulse, path, options.duration);
}
```

**Edge Cases:**
| Edge Case | Handling |
|-----------|----------|
| Connection doesn't exist | Log warning, skip |
| Very long connection | Increase pulse speed proportionally |
| Connection being dragged | Pause effect, resume when stable |
| Multiple pulses on same connection | Queue or show parallel |

### Step 3.5: Build Celebration Effects

**File:** `src/lib/spawner-live/effects/celebration.ts`

**Features:**
- Confetti burst
- Success/error banner
- Error vignette
- Achievement popup (future)

**Edge Cases:**
| Edge Case | Handling |
|-----------|----------|
| Multiple celebrations rapid-fire | Queue, show one at a time |
| Celebration during error | Error takes priority |
| User dismisses banner early | Clean up animations |
| Celebration on background tab | Skip or delay until visible |

### Step 3.6: Create Effects Engine Coordinator

**File:** `src/lib/spawner-live/effects/effects-engine.ts`

**Features:**
- Event subscription and routing to appropriate effects
- Settings integration
- Mode-aware (presentation vs developer)
- Performance monitoring

---

## Phase 4: Enforcement Layer

**Goal:** Ensure Claude follows the pipeline consistently.

### Step 4.1: Build Compliance Tracker

**File:** `src/lib/spawner-live/enforcement/compliance-tracker.ts`

**Features:**
- Initialize with expected pipeline steps
- Track completed steps
- Detect and record deviations
- Calculate compliance score

**Edge Cases:**
| Edge Case | Handling |
|-----------|----------|
| Pipeline has parallel branches | Track all valid orderings |
| Optional nodes in pipeline | Don't penalize for skipping |
| Dynamic pipeline changes | Re-initialize tracker |
| Claude adds helpful extra step | Mark as 'info' not 'warning' |

### Step 4.2: Build Deviation Detector

**File:** `src/lib/spawner-live/enforcement/deviation-detector.ts`

**Features:**
- Real-time deviation detection
- Severity classification
- User notification
- Deviation history

**Deviation Types:**
| Type | Severity | Description |
|------|----------|-------------|
| `unexpected_step` | info | Claude working on something not in pipeline |
| `skipped_step` | warning | Claude skipped a pipeline step |
| `out_of_order` | warning | Claude executed step in wrong order |
| `unknown_action` | warning | Claude doing something unrecognized |
| `critical_skip` | error | Claude skipped a required step |

### Step 4.3: Create spawner-canvas Skill

**File:** `~/.spawner/skills/spawner-canvas/skill.yaml` (or wherever skills live)

**Content:**
```yaml
name: spawner-canvas
description: Ensures Claude follows the visual pipeline in Spawner UI
version: 1.0.0
triggers:
  - "spawner"
  - "pipeline"
  - "canvas"
  - "workflow"

rules:
  - always_check_canvas: true
  - emit_events: required
  - follow_order: required
  - report_deviations: required

instructions: |
  # Spawner Canvas Integration

  You are working with a visual pipeline in Spawner UI. Follow these rules:

  ## Before Starting
  1. Call `spawner_get_canvas()` to see the current workflow
  2. Understand the node order and dependencies
  3. Call `spawner_emit_event({ type: 'pipeline_start' })`

  ## For Each Node
  1. Before working: `spawner_emit_event({ type: 'agent_enter', nodeId: '...' })`
  2. During work: `spawner_emit_event({ type: 'agent_progress', nodeId: '...', data: { progress: 50 } })`
  3. After completion: `spawner_emit_event({ type: 'agent_exit', nodeId: '...' })`

  ## Handoffs
  When passing work to another agent:
  1. `spawner_emit_event({ type: 'handoff_start', nodeId: '...', data: { targetNodeId: '...' } })`
  2. Wait for handoff completion

  ## If You Must Deviate
  - Call `spawner_report_deviation({ reason: '...' })` BEFORE deviating
  - Explain why the pipeline step doesn't apply
  - Never silently skip steps

  ## Completion
  - `spawner_emit_event({ type: 'pipeline_complete' })` on success
  - `spawner_emit_event({ type: 'pipeline_failed', data: { error: '...' } })` on failure

  The user can see your progress in real-time. Emitting events makes the experience magical.
```

### Step 4.4: Create MCP Tools (Server-side)

**New tools to implement:**

```typescript
// spawner_emit_event
async function spawner_emit_event(params: {
  type: AgentEventType;
  nodeId?: string;
  data?: Record<string, unknown>;
}): Promise<{ success: boolean; eventId: string }> {
  // 1. Validate event type and data
  // 2. Add metadata (timestamp, agentId)
  // 3. Broadcast via WebSocket to UI
  // 4. Log for audit trail
  // 5. Return confirmation
}

// spawner_get_canvas
async function spawner_get_canvas(): Promise<{
  pipelineId: string;
  nodes: CanvasNode[];
  connections: Connection[];
  executionOrder: string[];
}> {
  // 1. Fetch current canvas state from UI
  // 2. Calculate execution order (topological sort)
  // 3. Return structured data
}

// spawner_check_step
async function spawner_check_step(params: {
  action: string;
  nodeId?: string;
}): Promise<{
  aligned: boolean;
  expectedNode: string | null;
  warning: string | null;
}> {
  // 1. Get current pipeline state
  // 2. Compare planned action to expected next step
  // 3. Return alignment status
}

// spawner_get_next_node
async function spawner_get_next_node(): Promise<{
  nodeIds: string[];
  nodes: CanvasNode[];
}> {
  // 1. Get current completed steps
  // 2. Calculate next available nodes (respecting dependencies)
  // 3. Return node details
}

// spawner_report_deviation
async function spawner_report_deviation(params: {
  reason: string;
  severity?: 'info' | 'warning' | 'error';
}): Promise<{ acknowledged: boolean }> {
  // 1. Log deviation with reason
  // 2. Emit deviation_warn event
  // 3. Update compliance tracker
}
```

---

## Phase 5: UI Components

**Goal:** Build the visual components for both modes.

### Step 5.1: Create LiveNode Component

**File:** `src/lib/components/spawner-live/LiveNode.svelte`

**Features:**
- Extends existing SkillNode
- State-based styling (idle, active, success, error, etc.)
- Progress ring overlay
- Agent badge
- Spotlight integration

**Props:**
```typescript
interface LiveNodeProps {
  node: CanvasNode;
  state: NodeStateData;
  selected: boolean;
  onSelect: () => void;
}
```

### Step 5.2: Create LiveConnection Component

**File:** `src/lib/components/spawner-live/LiveConnection.svelte`

**Features:**
- Extends existing ConnectionLine
- State-based styling
- Pulse animation support
- Glow effect support

### Step 5.3: Create Mode Toggle

**File:** `src/lib/components/spawner-live/ModeToggle.svelte`

**Features:**
- Toggle between Presentation and Developer modes
- Keyboard shortcut (Cmd/Ctrl+Shift+L)
- Settings dropdown for fine-tuning
- Presets (Minimal, Balanced, Maximum Drama)

### Step 5.4: Create Agent Indicator

**File:** `src/lib/components/spawner-live/AgentIndicator.svelte`

**Features:**
- Glowing orb that appears at active node
- Pulsing animation
- Color based on agent type
- Smooth transitions

### Step 5.5: Create Particle Canvas

**File:** `src/lib/components/spawner-live/ParticleCanvas.svelte`

**Features:**
- Full-screen canvas overlay
- Particle system integration
- Performance-optimized rendering
- Auto-cleanup

### Step 5.6: Create Developer Panels

**Files:**
- `src/lib/components/spawner-live/panels/ExecutionLogPanel.svelte`
- `src/lib/components/spawner-live/panels/CompliancePanel.svelte`
- `src/lib/components/spawner-live/panels/MetricsPanel.svelte`
- `src/lib/components/spawner-live/panels/StateInspectorPanel.svelte`
- `src/lib/components/spawner-live/panels/PanelContainer.svelte`

**Features:**
- Collapsible/expandable
- Draggable positioning
- Resizable
- Layout persistence

### Step 5.7: Create Celebration Components

**Files:**
- `src/lib/components/spawner-live/celebrations/ConfettiEffect.svelte`
- `src/lib/components/spawner-live/celebrations/SuccessBanner.svelte`
- `src/lib/components/spawner-live/celebrations/ErrorVignette.svelte`

---

## Phase 6: Integration

**Goal:** Wire everything together with the existing system.

### Step 6.1: Integrate with Canvas Page

**File:** `src/routes/canvas/+page.svelte`

**Changes:**
- Import and initialize effects engine
- Connect event router to sync client
- Add mode toggle to navbar
- Conditionally render Live components vs standard

### Step 6.2: Integrate with Execution Panel

**File:** Modify existing `ExecutionPanel.svelte`

**Changes:**
- Emit events on start/progress/complete
- Use compliance tracker for status
- Add developer panel toggles

### Step 6.3: Integrate with Sync Client

**File:** Modify existing `sync-client.ts`

**Changes:**
- Route agent events to event router
- Handle new event types
- Add event acknowledgment

### Step 6.4: Create Settings Store

**File:** `src/lib/spawner-live/stores/effects-settings.svelte.ts`

**Features:**
- All tunable effect settings
- Presets (Minimal, Balanced, Maximum)
- Persistence to localStorage
- Mode-specific defaults

---

## Phase 7: Testing & Polish

### Step 7.1: Unit Tests

**Test files:**
- `event-router.test.ts`
- `state-machine.test.ts`
- `compliance-tracker.test.ts`
- `event-validator.test.ts`

**Key test cases:**
- Valid/invalid state transitions
- Event ordering and deduplication
- Compliance scoring accuracy
- Effect triggering

### Step 7.2: Integration Tests

**Test scenarios:**
- Full pipeline execution with events
- Disconnect/reconnect recovery
- Mode switching during execution
- Parallel node execution

### Step 7.3: Performance Testing

**Metrics to verify:**
- 60fps during animations
- <500ms event latency
- <100ms mode toggle
- Memory stable over 1hr session

### Step 7.4: Edge Case Testing

**Scenarios:**
- 100+ node pipeline
- Rapid-fire events (100/s)
- Network disconnect at each phase
- Browser tab backgrounded
- Low-end device simulation

---

## Implementation Order

```
Week 1: Foundation
├── Day 1-2: Types + Event Router
├── Day 3-4: State Machine + Validator
└── Day 5: Event Buffer + Tests

Week 2: Effects
├── Day 1: Animation Manager
├── Day 2: Particle System
├── Day 3: Spotlight + Connection Effects
├── Day 4: Celebration Effects
└── Day 5: Effects Engine Coordinator

Week 3: Enforcement
├── Day 1-2: Compliance Tracker + Deviation Detector
├── Day 3: spawner-canvas Skill
└── Day 4-5: MCP Tools

Week 4: UI Components
├── Day 1-2: LiveNode + LiveConnection
├── Day 3: Mode Toggle + Agent Indicator
├── Day 4: Developer Panels
└── Day 5: Celebration Components

Week 5: Integration & Testing
├── Day 1-2: Integration with existing system
├── Day 3: Unit tests
├── Day 4: Integration tests
└── Day 5: Performance testing + polish
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Animation performance issues | Use CSS-only, test early on low-end devices |
| WebSocket reliability | Robust reconnection, event buffering |
| Claude doesn't follow skill | Multiple enforcement layers, clear feedback |
| Complex state management | Keep state simple, avoid derived-from-derived |
| Scope creep | Stick to PRD, defer nice-to-haves to v2 |

---

## Success Criteria Checklist

### Phase 1
- [ ] Events route correctly to subscribers
- [ ] State transitions are validated
- [ ] Invalid events don't crash the system
- [ ] Event history is maintained

### Phase 2
- [ ] WebSocket reconnects reliably
- [ ] Events survive offline periods
- [ ] State reconciles without data loss

### Phase 3
- [ ] Animations run at 60fps
- [ ] Particles look good and perform well
- [ ] Spotlights highlight active nodes clearly
- [ ] Celebrations feel rewarding

### Phase 4
- [ ] Claude follows pipeline 95%+ of time
- [ ] Deviations are clearly visible
- [ ] MCP tools work reliably
- [ ] Skill instructions are clear

### Phase 5
- [ ] UI looks polished
- [ ] Modes toggle smoothly
- [ ] Panels are usable and informative
- [ ] Settings persist correctly

### Phase 6
- [ ] Everything works together
- [ ] No regressions in existing functionality
- [ ] Performance is acceptable

### Phase 7
- [ ] Tests pass
- [ ] Edge cases handled
- [ ] Documentation complete
