# Spawner Live: Technical Architecture

## Overview

This document details the technical architecture for Spawner Live - the real-time agent orchestration visualization system.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                              SPAWNER UI                                     │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      VISUALIZATION LAYER                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │  │
│  │  │ Presentation │  │  Developer   │  │      Effects Engine      │  │  │
│  │  │    Mode      │  │    Mode      │  │  ┌────────────────────┐  │  │  │
│  │  │              │  │              │  │  │ Animation Manager  │  │  │  │
│  │  │ • Animations │  │ • Log Panel  │  │  │ Particle System    │  │  │  │
│  │  │ • Particles  │  │ • Compliance │  │  │ State Visualizer   │  │  │  │
│  │  │ • Spotlights │  │ • Metrics    │  │  │ Sound Manager (v2) │  │  │  │
│  │  │ • Confetti   │  │ • Inspector  │  │  └────────────────────┘  │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │  │
│  └─────────────────────────────────────┬───────────────────────────────┘  │
│                                        │                                   │
│  ┌─────────────────────────────────────▼───────────────────────────────┐  │
│  │                      EVENT ORCHESTRATOR                              │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │  │
│  │  │ Event Router │  │State Machine │  │    Event Validator       │  │  │
│  │  │              │  │   Manager    │  │                          │  │  │
│  │  │ • Subscribe  │  │              │  │ • Sequence validation    │  │  │
│  │  │ • Dispatch   │  │ • Per-node   │  │ • Deduplication          │  │  │
│  │  │ • Filter     │  │ • Transition │  │ • Ordering               │  │  │
│  │  │ • Broadcast  │  │ • History    │  │ • Schema check           │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │  │
│  └─────────────────────────────────────┬───────────────────────────────┘  │
│                                        │                                   │
│  ┌─────────────────────────────────────▼───────────────────────────────┐  │
│  │                      SYNC LAYER (Enhanced)                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │  │
│  │  │  WebSocket   │  │    Event     │  │    State Reconciler      │  │  │
│  │  │   Client     │  │    Buffer    │  │                          │  │  │
│  │  │              │  │              │  │ • Diff detection         │  │  │
│  │  │ • Connect    │  │ • Queue      │  │ • Conflict resolution    │  │  │
│  │  │ • Reconnect  │  │ • Replay     │  │ • Full state sync        │  │  │
│  │  │ • Heartbeat  │  │ • Persist    │  │ • Periodic refresh       │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket / HTTP
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          ENFORCEMENT LAYER                                  │
│                                                                            │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐   │
│  │  spawner-canvas    │  │   MCP Pipeline     │  │   Event Contract   │   │
│  │      Skill         │  │    Validator       │  │    Enforcer        │   │
│  │                    │  │                    │  │                    │   │
│  │ • Load pipeline    │  │ • spawner_emit     │  │ • Required events  │   │
│  │ • Inject rules     │  │ • spawner_check    │  │ • Compliance score │   │
│  │ • Monitor behavior │  │ • spawner_get_next │  │ • Deviation alerts │   │
│  │ • Report deviations│  │ • Validate actions │  │ • Audit log        │   │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │     CLAUDE CODE       │
                        │                       │
                        │  • Executes pipeline  │
                        │  • Emits events       │
                        │  • Follows skill rules│
                        └───────────────────────┘
```

---

## File Structure

```
src/lib/
├── spawner-live/
│   ├── index.ts                    # Main exports
│   │
│   ├── types/
│   │   ├── events.ts               # Event type definitions
│   │   ├── states.ts               # Node state definitions
│   │   ├── animation.ts            # Animation config types
│   │   └── compliance.ts           # Compliance tracking types
│   │
│   ├── orchestrator/
│   │   ├── event-router.ts         # Central event dispatch
│   │   ├── state-machine.ts        # Node state management
│   │   ├── event-validator.ts      # Event validation logic
│   │   ├── event-buffer.ts         # Offline event buffering
│   │   └── index.ts
│   │
│   ├── effects/
│   │   ├── effects-engine.ts       # Main effects coordinator
│   │   ├── animation-manager.ts    # CSS/JS animation control
│   │   ├── particle-system.ts      # Particle effects
│   │   ├── spotlight-manager.ts    # Node spotlight effects
│   │   ├── connection-effects.ts   # Connection animations
│   │   ├── celebration.ts          # Confetti, success effects
│   │   └── index.ts
│   │
│   ├── enforcement/
│   │   ├── compliance-tracker.ts   # Track pipeline compliance
│   │   ├── deviation-detector.ts   # Detect off-pipeline work
│   │   ├── event-contract.ts       # Required event definitions
│   │   └── index.ts
│   │
│   ├── sync/
│   │   ├── enhanced-sync.ts        # Enhanced WebSocket sync
│   │   ├── state-reconciler.ts     # State diff/merge
│   │   └── index.ts
│   │
│   └── stores/
│       ├── live-mode.svelte.ts     # Presentation/Developer toggle
│       ├── node-states.svelte.ts   # Per-node state tracking
│       ├── compliance.svelte.ts    # Compliance data
│       ├── effects-settings.svelte.ts  # Animation settings
│       └── execution-log.svelte.ts # Execution history
│
├── components/
│   └── spawner-live/
│       ├── ModeToggle.svelte       # Presentation/Developer switch
│       ├── LiveNode.svelte         # Enhanced node with effects
│       ├── LiveConnection.svelte   # Enhanced connection
│       ├── ParticleCanvas.svelte   # Particle effect layer
│       ├── SpotlightOverlay.svelte # Spotlight effects layer
│       ├── AgentIndicator.svelte   # Glowing orb indicator
│       │
│       ├── panels/
│       │   ├── ExecutionLogPanel.svelte    # Real-time logs
│       │   ├── CompliancePanel.svelte      # Pipeline compliance
│       │   ├── MetricsPanel.svelte         # Performance metrics
│       │   ├── StateInspectorPanel.svelte  # Node state inspector
│       │   └── PanelContainer.svelte       # Draggable panel wrapper
│       │
│       └── celebrations/
│           ├── ConfettiEffect.svelte       # Confetti animation
│           ├── SuccessBanner.svelte        # Success message
│           └── ErrorVignette.svelte        # Error screen effect
```

---

## Core Components

### 1. Event Router (`event-router.ts`)

Central hub for all agent events.

```typescript
import { writable, derived } from 'svelte/store';

export type AgentEventType =
  | 'agent_enter'
  | 'agent_progress'
  | 'agent_thinking'
  | 'agent_output'
  | 'agent_exit'
  | 'agent_error'
  | 'agent_skip'
  | 'handoff_start'
  | 'handoff_complete'
  | 'pipeline_start'
  | 'pipeline_complete'
  | 'pipeline_failed'
  | 'deviation_warn';

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  nodeId: string | null;
  agentId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface EventSubscription {
  types?: AgentEventType[];
  nodeId?: string;
  callback: (event: AgentEvent) => void;
}

class EventRouter {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventHistory: AgentEvent[] = [];
  private maxHistory = 1000;

  // Event store for reactive UI
  public events = writable<AgentEvent[]>([]);
  public latestEvent = writable<AgentEvent | null>(null);

  subscribe(id: string, subscription: EventSubscription): () => void {
    this.subscriptions.set(id, subscription);
    return () => this.subscriptions.delete(id);
  }

  dispatch(event: AgentEvent): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    // Update stores
    this.events.update(events => [...events.slice(-this.maxHistory + 1), event]);
    this.latestEvent.set(event);

    // Notify subscribers
    this.subscriptions.forEach((sub) => {
      const typeMatch = !sub.types || sub.types.includes(event.type);
      const nodeMatch = !sub.nodeId || sub.nodeId === event.nodeId;
      if (typeMatch && nodeMatch) {
        sub.callback(event);
      }
    });
  }

  getHistory(filter?: { types?: AgentEventType[]; nodeId?: string }): AgentEvent[] {
    return this.eventHistory.filter(event => {
      const typeMatch = !filter?.types || filter.types.includes(event.type);
      const nodeMatch = !filter?.nodeId || filter.nodeId === event.nodeId;
      return typeMatch && nodeMatch;
    });
  }

  clear(): void {
    this.eventHistory = [];
    this.events.set([]);
    this.latestEvent.set(null);
  }
}

export const eventRouter = new EventRouter();
```

### 2. State Machine Manager (`state-machine.ts`)

Manages per-node state transitions.

```typescript
export type NodeState =
  | 'idle'
  | 'waiting'
  | 'active'
  | 'processing'
  | 'success'
  | 'error'
  | 'skipped';

export interface NodeStateData {
  state: NodeState;
  agentId: string | null;
  progress: number;
  message: string | null;
  error: string | null;
  enteredAt: string | null;
  exitedAt: string | null;
  duration: number | null;
}

// Valid state transitions
const validTransitions: Record<NodeState, NodeState[]> = {
  idle: ['waiting', 'active'],
  waiting: ['active', 'skipped'],
  active: ['processing', 'success', 'error', 'skipped'],
  processing: ['success', 'error'],
  success: ['idle'], // Reset for re-execution
  error: ['idle', 'active'], // Retry
  skipped: ['idle', 'active']
};

class StateMachineManager {
  private nodeStates = new Map<string, NodeStateData>();
  public states = writable<Map<string, NodeStateData>>(new Map());

  getState(nodeId: string): NodeStateData {
    return this.nodeStates.get(nodeId) || this.defaultState();
  }

  private defaultState(): NodeStateData {
    return {
      state: 'idle',
      agentId: null,
      progress: 0,
      message: null,
      error: null,
      enteredAt: null,
      exitedAt: null,
      duration: null
    };
  }

  transition(nodeId: string, event: AgentEvent): boolean {
    const current = this.getState(nodeId);
    const newState = this.eventToState(event);

    if (!validTransitions[current.state].includes(newState)) {
      console.warn(`Invalid transition: ${current.state} -> ${newState} for node ${nodeId}`);
      return false;
    }

    const updated: NodeStateData = {
      ...current,
      state: newState,
      agentId: event.agentId,
      message: event.data?.message as string || null
    };

    // Update specific fields based on event type
    switch (event.type) {
      case 'agent_enter':
        updated.enteredAt = event.timestamp;
        updated.progress = 0;
        break;
      case 'agent_progress':
        updated.progress = event.data?.progress as number || 0;
        break;
      case 'agent_exit':
        updated.exitedAt = event.timestamp;
        updated.progress = 100;
        if (updated.enteredAt) {
          updated.duration = new Date(event.timestamp).getTime() -
                            new Date(updated.enteredAt).getTime();
        }
        break;
      case 'agent_error':
        updated.error = event.data?.error as string || 'Unknown error';
        break;
    }

    this.nodeStates.set(nodeId, updated);
    this.states.update(s => new Map(s).set(nodeId, updated));
    return true;
  }

  private eventToState(event: AgentEvent): NodeState {
    switch (event.type) {
      case 'agent_enter': return 'active';
      case 'agent_progress':
      case 'agent_thinking': return 'processing';
      case 'agent_exit':
      case 'agent_output': return 'success';
      case 'agent_error': return 'error';
      case 'agent_skip': return 'skipped';
      default: return 'idle';
    }
  }

  reset(nodeId?: string): void {
    if (nodeId) {
      this.nodeStates.set(nodeId, this.defaultState());
    } else {
      this.nodeStates.clear();
    }
    this.states.set(new Map(this.nodeStates));
  }
}

export const stateMachine = new StateMachineManager();
```

### 3. Effects Engine (`effects-engine.ts`)

Coordinates all visual effects based on events.

```typescript
import { eventRouter, type AgentEvent } from './event-router';
import { animationManager } from './animation-manager';
import { particleSystem } from './particle-system';
import { spotlightManager } from './spotlight-manager';
import { connectionEffects } from './connection-effects';
import { celebration } from './celebration';
import { effectsSettings } from '../stores/effects-settings.svelte';
import { get } from 'svelte/store';

class EffectsEngine {
  private unsubscribe: (() => void) | null = null;

  init(): void {
    this.unsubscribe = eventRouter.subscribe('effects-engine', {
      callback: (event) => this.handleEvent(event)
    });
  }

  destroy(): void {
    this.unsubscribe?.();
  }

  private handleEvent(event: AgentEvent): void {
    const settings = get(effectsSettings);
    if (!settings.enabled) return;

    switch (event.type) {
      case 'agent_enter':
        this.onAgentEnter(event, settings);
        break;
      case 'agent_progress':
        this.onAgentProgress(event, settings);
        break;
      case 'agent_exit':
        this.onAgentExit(event, settings);
        break;
      case 'agent_error':
        this.onAgentError(event, settings);
        break;
      case 'handoff_start':
        this.onHandoffStart(event, settings);
        break;
      case 'handoff_complete':
        this.onHandoffComplete(event, settings);
        break;
      case 'pipeline_complete':
        this.onPipelineComplete(event, settings);
        break;
      case 'pipeline_failed':
        this.onPipelineFailed(event, settings);
        break;
    }
  }

  private onAgentEnter(event: AgentEvent, settings: EffectSettings): void {
    if (!event.nodeId) return;

    // Spotlight effect
    if (settings.spotlights.enabled) {
      spotlightManager.activate(event.nodeId, {
        color: settings.spotlights.color,
        intensity: settings.spotlights.intensity
      });
    }

    // Agent indicator (glowing orb)
    if (settings.indicators.enabled) {
      animationManager.showAgentIndicator(event.nodeId, event.agentId);
    }

    // Node scale animation
    animationManager.scaleNode(event.nodeId, 1.1, 300);
  }

  private onAgentProgress(event: AgentEvent, settings: EffectSettings): void {
    if (!event.nodeId) return;

    const progress = event.data?.progress as number || 0;
    animationManager.updateProgressRing(event.nodeId, progress);

    // Subtle particles while processing
    if (settings.particles.enabled && progress % 20 === 0) {
      particleSystem.emit(event.nodeId, {
        count: 5,
        color: settings.particles.color,
        duration: 300
      });
    }
  }

  private onAgentExit(event: AgentEvent, settings: EffectSettings): void {
    if (!event.nodeId) return;

    // Remove spotlight
    spotlightManager.deactivate(event.nodeId);

    // Success burst
    if (settings.completionBurst.enabled) {
      particleSystem.burst(event.nodeId, {
        count: settings.completionBurst.particleCount,
        duration: settings.completionBurst.duration,
        color: '#22c55e' // Green
      });
    }

    // Reset scale
    animationManager.scaleNode(event.nodeId, 1.0, 200);
    animationManager.hideAgentIndicator(event.nodeId);
  }

  private onAgentError(event: AgentEvent, settings: EffectSettings): void {
    if (!event.nodeId) return;

    // Shake animation
    if (settings.errorShake.enabled) {
      animationManager.shakeNode(event.nodeId, {
        intensity: settings.errorShake.intensity,
        cycles: 3
      });
    }

    // Red pulse
    animationManager.pulseNode(event.nodeId, '#ef4444', 500);
    spotlightManager.deactivate(event.nodeId);
  }

  private onHandoffStart(event: AgentEvent, settings: EffectSettings): void {
    if (!event.nodeId || !event.data?.targetNodeId) return;

    const targetNodeId = event.data.targetNodeId as string;

    // Connection spotlight
    if (settings.handoffSpotlight.enabled) {
      connectionEffects.spotlight(event.nodeId, targetNodeId, {
        duration: settings.handoffSpotlight.duration,
        pulseSpeed: settings.handoffSpotlight.pulseSpeed
      });
    }

    // Traveling pulse along connection
    connectionEffects.travelingPulse(event.nodeId, targetNodeId, {
      duration: 800,
      color: settings.handoffSpotlight.color
    });
  }

  private onHandoffComplete(event: AgentEvent, settings: EffectSettings): void {
    // Connection returns to normal
    if (event.data?.sourceNodeId && event.nodeId) {
      connectionEffects.clearSpotlight(
        event.data.sourceNodeId as string,
        event.nodeId
      );
    }
  }

  private onPipelineComplete(event: AgentEvent, settings: EffectSettings): void {
    if (settings.milestone.enabled) {
      celebration.confetti({
        count: settings.milestone.confettiCount,
        duration: settings.milestone.duration
      });
      celebration.showBanner('Pipeline Complete!', 'success', 2000);
    }
  }

  private onPipelineFailed(event: AgentEvent, settings: EffectSettings): void {
    if (settings.milestone.enabled) {
      celebration.showVignette('error', 1000);
      celebration.showBanner(
        event.data?.error as string || 'Pipeline Failed',
        'error',
        3000
      );
    }
  }
}

export const effectsEngine = new EffectsEngine();
```

### 4. Compliance Tracker (`compliance-tracker.ts`)

Tracks whether Claude follows the pipeline.

```typescript
import { writable, derived } from 'svelte/store';
import { eventRouter, type AgentEvent } from '../orchestrator/event-router';

export interface ComplianceState {
  pipelineId: string | null;
  expectedSteps: string[];
  completedSteps: string[];
  currentStep: string | null;
  deviations: Deviation[];
  score: number;
  status: 'not_started' | 'following' | 'deviated' | 'completed' | 'failed';
}

export interface Deviation {
  timestamp: string;
  type: 'unexpected_step' | 'skipped_step' | 'out_of_order' | 'unknown_action';
  nodeId: string | null;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

class ComplianceTracker {
  private state: ComplianceState = this.defaultState();
  public compliance = writable<ComplianceState>(this.defaultState());

  private defaultState(): ComplianceState {
    return {
      pipelineId: null,
      expectedSteps: [],
      completedSteps: [],
      currentStep: null,
      deviations: [],
      score: 100,
      status: 'not_started'
    };
  }

  init(pipelineId: string, nodeIds: string[]): void {
    this.state = {
      ...this.defaultState(),
      pipelineId,
      expectedSteps: nodeIds,
      status: 'not_started'
    };
    this.compliance.set(this.state);

    // Subscribe to events
    eventRouter.subscribe('compliance-tracker', {
      callback: (event) => this.handleEvent(event)
    });
  }

  private handleEvent(event: AgentEvent): void {
    switch (event.type) {
      case 'pipeline_start':
        this.state.status = 'following';
        break;

      case 'agent_enter':
        this.onNodeEnter(event);
        break;

      case 'agent_exit':
        this.onNodeExit(event);
        break;

      case 'agent_skip':
        this.onNodeSkip(event);
        break;

      case 'deviation_warn':
        this.onDeviation(event);
        break;

      case 'pipeline_complete':
        this.onPipelineComplete();
        break;

      case 'pipeline_failed':
        this.state.status = 'failed';
        break;
    }

    this.updateScore();
    this.compliance.set({ ...this.state });
  }

  private onNodeEnter(event: AgentEvent): void {
    if (!event.nodeId) return;

    this.state.currentStep = event.nodeId;

    // Check if this is the expected next step
    const expectedIndex = this.state.completedSteps.length;
    const expectedNode = this.state.expectedSteps[expectedIndex];

    if (event.nodeId !== expectedNode) {
      // Check if it's out of order vs completely unexpected
      if (this.state.expectedSteps.includes(event.nodeId)) {
        this.addDeviation({
          type: 'out_of_order',
          nodeId: event.nodeId,
          message: `Expected "${expectedNode}" but got "${event.nodeId}"`,
          severity: 'warning'
        });
      } else {
        this.addDeviation({
          type: 'unexpected_step',
          nodeId: event.nodeId,
          message: `Working on "${event.nodeId}" which is not in the pipeline`,
          severity: 'info'
        });
      }
      this.state.status = 'deviated';
    }
  }

  private onNodeExit(event: AgentEvent): void {
    if (!event.nodeId) return;

    if (!this.state.completedSteps.includes(event.nodeId)) {
      this.state.completedSteps.push(event.nodeId);
    }
    this.state.currentStep = null;

    // Check if back on track
    if (this.state.status === 'deviated' && this.isOnTrack()) {
      this.state.status = 'following';
    }
  }

  private onNodeSkip(event: AgentEvent): void {
    if (!event.nodeId) return;

    this.addDeviation({
      type: 'skipped_step',
      nodeId: event.nodeId,
      message: `Skipped "${event.nodeId}": ${event.data?.reason || 'No reason given'}`,
      severity: 'warning'
    });
  }

  private onDeviation(event: AgentEvent): void {
    this.addDeviation({
      type: 'unknown_action',
      nodeId: event.nodeId,
      message: event.data?.message as string || 'Unknown deviation',
      severity: event.data?.severity as 'info' | 'warning' | 'error' || 'warning'
    });
    this.state.status = 'deviated';
  }

  private onPipelineComplete(): void {
    // Check for any skipped steps
    const skipped = this.state.expectedSteps.filter(
      step => !this.state.completedSteps.includes(step)
    );

    if (skipped.length > 0) {
      skipped.forEach(nodeId => {
        this.addDeviation({
          type: 'skipped_step',
          nodeId,
          message: `Step "${nodeId}" was never executed`,
          severity: 'warning'
        });
      });
    }

    this.state.status = this.state.deviations.length > 0 ? 'deviated' : 'completed';
  }

  private addDeviation(deviation: Omit<Deviation, 'timestamp'>): void {
    this.state.deviations.push({
      ...deviation,
      timestamp: new Date().toISOString()
    });
  }

  private isOnTrack(): boolean {
    const lastCompleted = this.state.completedSteps[this.state.completedSteps.length - 1];
    const expectedIndex = this.state.expectedSteps.indexOf(lastCompleted);
    return expectedIndex === this.state.completedSteps.length - 1;
  }

  private updateScore(): void {
    const totalSteps = this.state.expectedSteps.length;
    if (totalSteps === 0) {
      this.state.score = 100;
      return;
    }

    const completed = this.state.completedSteps.filter(
      step => this.state.expectedSteps.includes(step)
    ).length;

    const deviationPenalty = this.state.deviations.reduce((penalty, d) => {
      switch (d.severity) {
        case 'error': return penalty + 15;
        case 'warning': return penalty + 5;
        case 'info': return penalty + 1;
        default: return penalty;
      }
    }, 0);

    this.state.score = Math.max(0, Math.round(
      (completed / totalSteps) * 100 - deviationPenalty
    ));
  }

  reset(): void {
    this.state = this.defaultState();
    this.compliance.set(this.state);
  }
}

export const complianceTracker = new ComplianceTracker();
```

---

## Data Flow

### Event Flow (Claude → UI)

```
Claude Code
    │
    │ 1. Claude calls spawner_emit_event MCP tool
    ▼
MCP Pipeline Validator
    │
    │ 2. Validates event against state machine
    │ 3. Logs to audit trail
    ▼
WebSocket / HTTP
    │
    │ 4. Event transmitted to UI
    ▼
Enhanced Sync Client
    │
    │ 5. Buffers if offline, dedupes, validates
    ▼
Event Router
    │
    │ 6. Dispatches to all subscribers
    ├──────────────────────────┐
    ▼                          ▼
State Machine              Effects Engine
    │                          │
    │ 7. Updates node state    │ 8. Triggers animations
    ▼                          ▼
Node States Store          Animation/Particle/Spotlight
    │                          │
    │ 9. Reactive update       │ 10. Visual feedback
    ▼                          ▼
LiveNode.svelte            Canvas overlays
```

### Compliance Flow

```
Canvas State
    │
    │ 1. Extract node order from connections
    ▼
Compliance Tracker
    │
    │ 2. Initialize expected steps
    ▼
Event Router (subscribe)
    │
    │ 3. Listen for agent events
    ▼
Compare expected vs actual
    │
    ├─── Match ──► Update progress, score
    │
    └─── Mismatch ──► Log deviation, update status
                          │
                          ▼
                    Compliance Panel
                          │
                          │ 4. Show warnings/alerts
                          ▼
                    User notification
```

---

## Integration Points

### 1. Existing Canvas Store

Extend `canvas.svelte.ts` to work with Spawner Live:

```typescript
// In canvas.svelte.ts, add:
import { stateMachine } from '../spawner-live/orchestrator/state-machine';
import { complianceTracker } from '../spawner-live/enforcement/compliance-tracker';

// When starting execution:
export function startLiveExecution(): void {
  const nodeOrder = getExecutionOrder(); // Topological sort
  complianceTracker.init(currentPipelineId, nodeOrder);
  effectsEngine.init();
}

// Expose node states for rendering:
export const liveNodeStates = stateMachine.states;
```

### 2. Existing Sync Client

Enhance `sync-client.ts` to handle new event types:

```typescript
// Add new event types
type EnhancedEventType = EventType | AgentEventType;

// Route agent events to EventRouter
private handleMessage(data: SyncEvent): void {
  if (isAgentEvent(data.type)) {
    eventRouter.dispatch(data as AgentEvent);
  }
  // ... existing handling
}
```

### 3. MCP Tools

New tools added to MCP server:

```typescript
// spawner_emit_event
{
  name: 'spawner_emit_event',
  description: 'Emit an agent event for pipeline tracking',
  parameters: {
    type: { type: 'string', enum: AgentEventTypes },
    nodeId: { type: 'string', nullable: true },
    data: { type: 'object', optional: true }
  }
}

// spawner_get_canvas
{
  name: 'spawner_get_canvas',
  description: 'Get current canvas state including nodes and connections',
  parameters: {}
}

// spawner_check_step
{
  name: 'spawner_check_step',
  description: 'Check if a planned action aligns with the pipeline',
  parameters: {
    action: { type: 'string' },
    nodeId: { type: 'string', optional: true }
  }
}

// spawner_get_next_node
{
  name: 'spawner_get_next_node',
  description: 'Get the next node(s) to execute in the pipeline',
  parameters: {}
}
```

---

## Performance Considerations

### Animation Performance

1. **Use CSS transforms only** - `transform` and `opacity` are GPU-accelerated
2. **Batch DOM updates** - Use `requestAnimationFrame` for animations
3. **Limit particle count** - Max 100 particles per burst, auto-reduce on low-end
4. **Throttle progress updates** - Max 10 updates/second per node
5. **Virtualize large pipelines** - Only animate visible nodes (50+ nodes)

### Memory Management

1. **Event history limit** - Keep last 1000 events
2. **Clear completed animations** - Remove animation elements after completion
3. **Weak references** - Use WeakMap for node-animation associations
4. **Garbage collection friendly** - Avoid closures holding large objects

### Network Efficiency

1. **Batch events** - Combine rapid events into single messages
2. **Compression** - Gzip WebSocket messages
3. **Reconnection backoff** - Exponential backoff (1s, 2s, 4s, 8s, max 30s)
4. **State reconciliation** - Full state sync every 30s as backup

---

## Security Considerations

1. **Event validation** - All events validated against schema before processing
2. **Rate limiting** - Max 100 events/second per client
3. **Sanitization** - Event messages sanitized before display
4. **Authentication** - Events must include valid session token
5. **Audit logging** - All events logged for debugging/forensics
