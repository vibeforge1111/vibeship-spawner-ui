# 🚀 Skill Orchestration Guide: Claude Code + Spawner UI Integration

## Overview

This guide documents how skills work together to create a seamless bidirectional sync between Claude Code and Spawner UI for automated agent pipeline execution.

## 🎯 Core Architecture

```
Claude Code (Command Center)
    ↕️
[claude-code-integration] (Bridge Layer)
    ↕️
[WebSocket Sync Layer]
    ↕️
Spawner UI (Visual Canvas)
    ↕️
[spawner-mcp-bridge] (Execution Layer)
    ↕️
MCP Tools & Skills
```

---

## 📚 Skill Categories & Responsibilities

### 1. **Integration Layer** (New Skills)

#### `claude-code-integration` 
**Role**: Primary orchestrator and message broker
- **Owns**: Command protocol, session management, retry logic
- **Receives From**: Claude Code commands
- **Hands Off To**: 
  - `websocket-state-sync` for state management
  - `spawner-mcp-bridge` for execution
  - `event-sourcing-sync` for audit logging

#### `websocket-state-sync`
**Role**: State consistency guardian
- **Owns**: Delta sync, conflict resolution, optimistic updates
- **Receives From**: `claude-code-integration` state changes
- **Hands Off To**:
  - `canvas-collaboration` for multi-user scenarios
  - `realtime-engineer` for connection management

#### `spawner-mcp-bridge`
**Role**: Pipeline-to-execution translator
- **Owns**: Converting visual pipelines to executable MCP tools
- **Receives From**: Canvas pipeline definitions
- **Hands Off To**:
  - `mcp-builder` for tool creation
  - `background-jobs` for async execution

#### `canvas-collaboration`
**Role**: Multi-agent coordination
- **Owns**: Presence, locking, collaborative edits
- **Receives From**: Multiple Claude Code instances
- **Hands Off To**: `event-sourcing-sync` for history

#### `event-sourcing-sync`
**Role**: Time machine and audit trail
- **Owns**: Event log, replay, snapshots
- **Receives From**: All state changes
- **Hands Off To**: Recovery systems

### 2. **Spawner Skills** (Existing)

#### `realtime-engineer`
**Role**: WebSocket infrastructure expert
- **Supports**: `websocket-state-sync` with connection pooling
- **Handles**: Reconnection strategies, heartbeats, presence

#### `mcp-builder`
**Role**: MCP protocol implementation
- **Supports**: `spawner-mcp-bridge` with tool definitions
- **Creates**: Dynamic MCP tools from skills

#### `ai-agents`
**Role**: Agent orchestration patterns
- **Coordinates**: Multi-agent workflows
- **Manages**: Tool use, memory, planning

#### `multi-agent-orchestration`
**Role**: Distributed agent coordination
- **Handles**: Agent communication protocols
- **Manages**: Consensus, voting, task distribution

#### `background-jobs`
**Role**: Async task processing
- **Executes**: Long-running pipeline tasks
- **Manages**: Queues, retries, dead letters

---

## 🔄 Skill Handoff Patterns

### Pattern 1: Command Execution Flow
```
Claude Code → [claude-code-integration] → [spawner-mcp-bridge] → [mcp-builder] → Execution
                        ↓
              [websocket-state-sync] (maintains UI state)
                        ↓
              [event-sourcing-sync] (logs everything)
```

**Example**: Claude Code sends "add React Patterns skill"
1. `claude-code-integration` validates command, assigns ID
2. `websocket-state-sync` optimistically updates UI
3. `spawner-mcp-bridge` prepares skill for execution
4. `event-sourcing-sync` logs the addition
5. Confirmation flows back through the chain

### Pattern 2: State Synchronization Flow
```
UI Change → [canvas-collaboration] → [websocket-state-sync] → [claude-code-integration] → Claude Code
                    ↓                          ↓
            [event-sourcing-sync]    [realtime-engineer]
                                    (manages connections)
```

**Example**: User drags node on canvas
1. `canvas-collaboration` broadcasts change
2. `websocket-state-sync` calculates delta
3. `claude-code-integration` formats for Claude Code
4. `realtime-engineer` ensures delivery
5. `event-sourcing-sync` records the move

### Pattern 3: Pipeline Execution Flow
```
Visual Pipeline → [spawner-mcp-bridge] → [mcp-builder] → [ai-agents]
                           ↓                    ↓             ↓
                  [background-jobs]     [multi-agent-orchestration]
                           ↓                    ↓
                  [event-sourcing-sync] (execution log)
```

**Example**: Execute a 5-skill pipeline
1. `spawner-mcp-bridge` converts visual to DAG
2. `mcp-builder` creates tool definitions
3. `ai-agents` handles execution strategy
4. `background-jobs` manages async tasks
5. `multi-agent-orchestration` coordinates parallel execution

### Pattern 4: Conflict Resolution Flow
```
Conflict Detected → [websocket-state-sync] → [canvas-collaboration]
                            ↓                          ↓
                  [event-sourcing-sync]     [claude-code-integration]
                    (find last valid)         (notify all clients)
```

**Example**: Two Claude Code instances modify same node
1. `websocket-state-sync` detects conflict
2. `canvas-collaboration` applies locking
3. `event-sourcing-sync` provides history
4. Resolution propagates to all clients

---

## 🎭 Skill Interaction Rules

### 1. **Message Priority Levels**
- **P0 (Critical)**: Connection state, errors
- **P1 (High)**: User commands, state changes  
- **P2 (Normal)**: Sync updates, validations
- **P3 (Low)**: Telemetry, debugging

### 2. **Handoff Triggers**

| From Skill | To Skill | Trigger Condition |
|------------|----------|-------------------|
| `claude-code-integration` | `websocket-state-sync` | State change detected |
| `claude-code-integration` | `spawner-mcp-bridge` | Execute command received |
| `websocket-state-sync` | `canvas-collaboration` | Multiple clients detected |
| `spawner-mcp-bridge` | `mcp-builder` | Tool creation needed |
| `spawner-mcp-bridge` | `background-jobs` | Async execution required |
| Any skill | `event-sourcing-sync` | State mutation occurs |
| `realtime-engineer` | `claude-code-integration` | Connection lost/restored |

### 3. **Failure Cascades**

```yaml
claude-code-integration fails:
  - websocket-state-sync: enters read-only mode
  - spawner-mcp-bridge: queues commands
  - event-sourcing-sync: continues logging

websocket-state-sync fails:
  - claude-code-integration: disables optimistic updates
  - canvas-collaboration: locks all edits
  - UI shows "sync lost" warning

spawner-mcp-bridge fails:
  - Pipeline execution disabled
  - UI shows "execution unavailable"
  - Commands queue for retry
```

---

## 🔧 Implementation Patterns

### Command Structure
```javascript
{
  // Required fields
  id: "cmd-{timestamp}-{random}",
  type: "canvas_command",
  action: "add_skill|remove_skill|connect|disconnect|execute",
  
  // Command data
  payload: {
    skillId: "react-patterns",
    position: { x: 100, y: 200 },
    config: { /* skill-specific */ }
  },
  
  // Metadata
  meta: {
    source: "claude-code",
    sessionId: "session-123",
    timestamp: 1704067200000,
    priority: 1,
    idempotencyKey: "unique-key",
    timeout: 5000
  }
}
```

### Response Structure
```javascript
{
  commandId: "cmd-123",
  status: "success|error|pending|timeout",
  
  // Success case
  data: {
    nodeId: "node-456",
    executionId: "exec-789"
  },
  
  // Error case
  error: {
    code: "NODE_EXISTS",
    message: "Skill already on canvas",
    recoverable: true,
    suggestion: "Use different position"
  },
  
  // Metadata
  meta: {
    duration: 123,
    timestamp: 1704067200123
  }
}
```

### State Synchronization Protocol
```javascript
{
  type: "state_delta",
  version: 42,
  
  // Changes since last sync
  operations: [
    { op: "add", path: "/nodes/3", value: nodeData },
    { op: "remove", path: "/connections/5" },
    { op: "replace", path: "/nodes/2/position", value: {x: 100} }
  ],
  
  // Validation
  checksum: "sha256-hash",
  previousVersion: 41,
  
  // Conflict resolution
  conflictStrategy: "server_wins|client_wins|merge|manual"
}
```

---

## 📊 Monitoring & Debugging

### Key Metrics to Track

1. **Latency Metrics**
   - Command round-trip time
   - State sync delay
   - WebSocket ping/pong

2. **Reliability Metrics**
   - Command success rate
   - Sync conflicts per hour
   - Connection drops per session

3. **Performance Metrics**
   - Messages per second
   - State size in KB
   - Event log growth rate

### Debug Commands

```javascript
// In browser console
window.spawnerDebug = {
  // Show current sync state
  showState: () => console.table(syncClient.getState()),
  
  // List pending commands
  showQueue: () => console.log(commandQueue.pending()),
  
  // Force state sync
  forceSync: () => syncClient.requestFullState(),
  
  // Show skill handoffs
  traceHandoffs: () => eventLog.filter(e => e.type === 'handoff'),
  
  // Replay events
  replay: (from, to) => eventSourcing.replay(from, to)
};
```

---

## 🚦 Production Readiness Checklist

### Essential Features
- [ ] Idempotent command processing
- [ ] Automatic reconnection with exponential backoff
- [ ] State checksum validation every 30 seconds
- [ ] Command deduplication (5-minute window)
- [ ] Graceful degradation when skills unavailable
- [ ] Circuit breaker for failing skills
- [ ] Dead letter queue for failed commands
- [ ] Audit log retention (30 days minimum)

### Performance Targets
- Command latency: < 100ms (p50), < 500ms (p99)
- State sync: < 50ms for small changes
- Reconnection time: < 2 seconds
- Memory usage: < 50MB per session
- WebSocket messages: < 100/second sustained

### Security Requirements
- [ ] Session tokens with 24-hour expiry
- [ ] Command signing with HMAC
- [ ] Rate limiting (100 commands/minute)
- [ ] Input sanitization for all commands
- [ ] Audit trail encryption at rest

---

## 🎯 Use Case Scenarios

### Scenario 1: Rapid Skill Addition
**User Action**: Claude Code adds 10 skills in quick succession

**Skill Flow**:
1. `claude-code-integration` batches commands
2. `websocket-state-sync` applies all optimistically
3. `canvas-collaboration` ensures no overlaps
4. `spawner-mcp-bridge` queues for execution
5. `event-sourcing-sync` creates checkpoint

### Scenario 2: Network Interruption
**Event**: 30-second network outage

**Recovery Flow**:
1. `realtime-engineer` detects disconnect
2. `claude-code-integration` enters offline mode
3. Commands queue locally
4. On reconnect: `event-sourcing-sync` provides missing events
5. `websocket-state-sync` reconciles states

### Scenario 3: Collaborative Editing
**Setup**: 3 Claude Code instances on same canvas

**Coordination**:
1. `canvas-collaboration` assigns colors/cursors
2. `websocket-state-sync` merges all changes
3. `claude-code-integration` broadcasts to all
4. Conflicts resolved by timestamp priority
5. `event-sourcing-sync` maintains complete history

---

## 🔮 Future Enhancements

### Phase 2: Advanced Features
- **Branching Workflows**: Git-like branch/merge for pipelines
- **Time Travel Debugging**: Replay any session
- **Predictive Sync**: Pre-fetch likely next states
- **Skill Composition**: Combine skills into meta-skills
- **Federation**: Connect multiple Spawner UI instances

### Phase 3: Scale & Performance
- **Edge Sync**: CDN-based state distribution
- **CRDT Implementation**: True conflict-free editing
- **WebRTC Fallback**: Peer-to-peer when server down
- **Skill Caching**: Local execution of common patterns
- **Progressive Sync**: Sync visible canvas first

---

## 📝 Quick Reference

### Skill Dependency Graph
```
claude-code-integration
├── websocket-state-sync
│   ├── realtime-engineer
│   └── canvas-collaboration
├── spawner-mcp-bridge
│   ├── mcp-builder
│   └── background-jobs
└── event-sourcing-sync

ai-agents
└── multi-agent-orchestration
```

### Command Cheatsheet
```javascript
// Add skill
{ action: "add_skill", payload: { skillId, position } }

// Remove skill
{ action: "remove_skill", payload: { nodeId } }

// Create connection
{ action: "connect", payload: { sourceId, targetId } }

// Execute pipeline
{ action: "execute", payload: { pipelineId, config } }

// Sync state
{ action: "sync", payload: { full: true } }
```

### Error Codes
- `SKILL_NOT_FOUND`: Requested skill doesn't exist
- `NODE_EXISTS`: Node already on canvas
- `INVALID_CONNECTION`: Connection violates DAG
- `SYNC_CONFLICT`: State conflict detected
- `EXECUTION_FAILED`: Pipeline execution error
- `SESSION_EXPIRED`: Re-authentication needed
- `RATE_LIMITED`: Too many requests

---

This orchestration ensures seamless collaboration between Claude Code and Spawner UI, with each skill playing its specific role in the larger system.