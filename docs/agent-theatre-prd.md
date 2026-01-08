# 🎭 Agent Theatre: Three.js Visualization for Spawner UI

## ⚡ CLAUDE CODE INSTRUCTIONS

> **IMPORTANT**: This PRD was drafted by Claude (claude.ai) and needs YOUR completion. You have access to the actual Spawner UI codebase via GitHub. Please execute the following tasks:

### Immediate Actions for Claude Code:

```
1. DISCOVER ARCHITECTURE
   - Check the GitHub repo for Spawner UI structure
   - Find: workflow execution models, agent types, memory/mind systems
   - Identify: API endpoints, WebSocket events, data schemas
   - Locate: any existing bridge code between Spawner UI and Claude Code

2. FILL IN PLACEHOLDERS
   - Search this document for "[CLAUDE_CODE_FILL]" markers
   - Replace each with actual details from the codebase
   - Add any missing integration points you discover

3. VALIDATE & EXTEND
   - Cross-reference the proposed architecture with actual Spawner UI patterns
   - Add technical specifications based on real code structure
   - Create the integration layer code if needed

4. OUTPUT
   - Update this PRD with complete technical specifications
   - Generate initial scaffolding code for the Three.js app
   - Create WebSocket/API bridge code to connect to Spawner UI
```

### Context from User:
> "We have workflow execution, learnings, mind, memory, and all of those kinds of stuff. The local Claude Code is connected to that GitHub, so you can actually write prompts so that it can directly connect there. Whatever is happening on our local computer in terms of workflow execution should connect to this Three.js visualization in real-time."

---

## 1. Executive Summary

**Agent Theatre** is an immersive Three.js web experience that visualizes your Spawner UI's automated agent pipeline as a living, breathing team of characters. Think of it as a "mission control" meets "Pixar animation" - where users can watch AI agents collaborate, discuss tasks, execute workflows, and grow through learnings - all represented as stylized 3D characters in a creative workspace.

### Core Value Proposition
- **Transparency**: See what your agent pipeline is actually doing
- **Engagement**: Turn automation into entertainment
- **Understanding**: Visualize complex multi-agent workflows intuitively
- **Delight**: Make AI work feel alive and relatable

---

## 2. Vision & Experience

### 2.1 The Scene
Imagine a cozy, stylized workspace - something between a Pixar animation studio and a cyberpunk command center. This is where your agents "live" while they work.

**Environment Concepts:**
- **The Workshop**: A warm, wooden workshop with floating holographic displays
- **The Lab**: A sleek, neon-lit space station control room
- **The Garden**: An organic, nature-inspired space where ideas "grow"
- **The Stage**: A theatrical setting where agents perform their roles

### 2.2 The Characters
Each agent type in your Spawner UI maps to a distinct character archetype:

| Agent Type | Character Design | Personality | Visual Cues |
|------------|------------------|-------------|-------------|
| [CLAUDE_CODE_FILL: List actual agent types from Spawner UI] | | | |
| Orchestrator/Coordinator | **"The Director"** - Tall, composed figure with a floating clipboard | Calm, strategic, sees the big picture | Glowing connection lines to all other agents |
| Worker/Executor | **"The Builder"** - Sturdy, tool-wielding character | Focused, reliable, hands-on | Animated tool usage, sparks when working |
| Researcher/Analyst | **"The Scholar"** - Floating character with multiple eyes/lenses | Curious, thorough, knowledge-hungry | Books/data streams orbiting around them |
| Creative/Generator | **"The Artist"** - Fluid, colorful, shape-shifting form | Imaginative, expressive, unpredictable | Color splashes, morphing appendages |
| Memory/Knowledge | **"The Keeper"** - Ancient, crystalline entity | Wise, patient, foundational | Crystal formations, stored memories visible inside |

### 2.3 The Interactions
Agents don't just exist - they LIVE:

- **Idle States**: Unique animations per character (stretching, thinking, organizing)
- **Working States**: Visible task execution (typing, building, researching)
- **Conversation States**: Speech bubbles, body language, emotional reactions
- **Collaboration**: Physical proximity, shared workspaces, passing objects
- **Celebration**: Task completion animations, team high-fives, confetti

---

## 3. Technical Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AGENT THEATRE (Three.js)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Scene     │  │  Character  │  │    Chat     │  │   Status    │ │
│  │  Manager    │  │  Controller │  │   System    │  │   Display   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │                │         │
│         └────────────────┴────────────────┴────────────────┘         │
│                                   │                                   │
│                          ┌───────┴───────┐                           │
│                          │  Event Bridge │                           │
│                          └───────┬───────┘                           │
└──────────────────────────────────┼───────────────────────────────────┘
                                   │
                          WebSocket/REST API
                                   │
┌──────────────────────────────────┼───────────────────────────────────┐
│                          LOCAL BRIDGE SERVER                          │
│                    (Runs alongside Spawner UI)                        │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     [CLAUDE_CODE_FILL:                          │ │
│  │                     Document the actual bridge architecture      │ │
│  │                     between Spawner UI and external systems]     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────┼───────────────────────────────────┘
                                   │
┌──────────────────────────────────┼───────────────────────────────────┐
│                            SPAWNER UI                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐            │
│  │   Workflow    │  │    Agent      │  │    Memory     │            │
│  │   Execution   │  │   Registry    │  │    System     │            │
│  └───────────────┘  └───────────────┘  └───────────────┘            │
│                                                                       │
│  [CLAUDE_CODE_FILL: Add actual Spawner UI components from codebase]  │
└───────────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

```
[CLAUDE_CODE_FILL: After checking the Spawner UI repo, document:]

1. Event Sources (what triggers updates?)
   - Workflow start/complete events
   - Agent task assignments
   - Inter-agent communications
   - Memory/learning updates
   - Error/retry events

2. Data Schemas (what does each event contain?)
   - Agent identification
   - Task/workflow metadata
   - Message content
   - Status/progress indicators
   - Timestamps

3. API Endpoints (how do we fetch state?)
   - Current active agents
   - Workflow status
   - Historical data for replay
   - Memory/learning retrieval
```

### 3.3 Integration Points

#### From Spawner UI → Agent Theatre

| Event Type | Spawner UI Source | Theatre Action |
|------------|-------------------|----------------|
| `agent.spawn` | [CLAUDE_CODE_FILL] | Spawn character with entrance animation |
| `agent.task.start` | [CLAUDE_CODE_FILL] | Character moves to workstation, starts working animation |
| `agent.task.complete` | [CLAUDE_CODE_FILL] | Celebration animation, status update |
| `agent.message` | [CLAUDE_CODE_FILL] | Speech bubble, body language |
| `workflow.start` | [CLAUDE_CODE_FILL] | Scene-wide alert, all agents orient |
| `workflow.complete` | [CLAUDE_CODE_FILL] | Team celebration sequence |
| `memory.update` | [CLAUDE_CODE_FILL] | "Keeper" character absorbs new knowledge visually |
| `learning.new` | [CLAUDE_CODE_FILL] | Lightbulb moment animation |

#### From Agent Theatre → Spawner UI (Optional Interactions)

| User Action | Theatre Event | Spawner UI Effect |
|-------------|---------------|-------------------|
| Click agent | `theatre.agent.inspect` | Show detailed agent state |
| Focus workflow | `theatre.workflow.focus` | Highlight related agents |
| Time scrub | `theatre.replay.seek` | Show historical state |

---

## 4. Feature Specifications

### 4.1 Core Features (MVP)

#### F1: Live Agent Visualization
- Real-time character representation of each active agent
- Position in scene reflects role/relationship
- Visual state reflects current activity

#### F2: Workflow Execution Display
- Timeline/progress bar for active workflows
- Visual connections between collaborating agents
- Stage-by-stage progression visualization

#### F3: Agent Conversations
- Speech bubbles for inter-agent messages
- Emotional reactions (emojis/expressions)
- Conversation history sidebar

#### F4: Status Dashboard Overlay
- Current active agents count
- Workflow progress summary
- Recent completions/errors
- System health indicators

### 4.2 Enhanced Features (v2)

#### F5: Agent Emotions & Personality
- Mood system based on task success/failure
- Personality traits affecting animations
- Relationship dynamics between agents

#### F6: Memory Visualization
- "Mind palace" view for memory system
- Visual representation of learnings
- Knowledge graph connections

#### F7: Time Travel / Replay
- Scrub through historical workflow executions
- Replay significant events
- Compare execution patterns

#### F8: Interactive Mode
- Click agents for detailed info
- Drag to rearrange workspace
- Trigger demo workflows

### 4.3 Delight Features (v3)

#### F9: Ambient Life
- Agents have idle behaviors
- Environmental effects (day/night, weather based on workload)
- Easter eggs and personality moments

#### F10: Achievements & Stats
- Celebrate milestones (1000 tasks completed!)
- Agent "level ups" based on experience
- Workflow efficiency trends

---

## 5. Character Design System

### 5.1 Base Character Structure

```javascript
// Character configuration schema
const CharacterConfig = {
  id: "string",           // Maps to Spawner UI agent ID
  type: "string",         // Agent type from Spawner UI
  archetype: "string",    // Visual archetype (director, builder, etc.)
  
  appearance: {
    baseModel: "string",  // GLTF model path
    primaryColor: "hex",  // Theme color
    accentColor: "hex",   // Secondary color
    scale: "number",      // Size relative to others
    accessories: []       // Type-specific additions
  },
  
  personality: {
    idleVariation: "string",   // calm, energetic, thoughtful
    workingStyle: "string",    // methodical, chaotic, focused
    socialLevel: "number",     // How much they interact
    expressiveness: "number"   // Animation intensity
  },
  
  animations: {
    idle: [],
    working: [],
    talking: [],
    celebrating: [],
    error: [],
    thinking: []
  }
};
```

### 5.2 Agent Type → Character Mapping

```
[CLAUDE_CODE_FILL: After examining Spawner UI agent types, create mapping:]

// Example structure - replace with actual types
const AgentTypeMapping = {
  "[actual_agent_type_1]": {
    archetype: "director",
    description: "Coordinates workflow execution",
    model: "models/director.glb",
    color: "#4A90D9"
  },
  "[actual_agent_type_2]": {
    archetype: "builder", 
    description: "Executes specific tasks",
    model: "models/builder.glb",
    color: "#50C878"
  },
  // ... map all agent types
};
```

---

## 6. Real-Time Sync Architecture

### 6.1 Connection Strategy

```javascript
// Bridge connection - [CLAUDE_CODE_FILL: Adapt to actual Spawner UI patterns]

class SpawnerBridge {
  constructor(config) {
    this.wsEndpoint = config.wsEndpoint;  // [FILL: actual endpoint]
    this.apiBase = config.apiBase;        // [FILL: actual base URL]
    this.authMethod = config.auth;        // [FILL: auth pattern used]
  }
  
  async connect() {
    // [CLAUDE_CODE_FILL: Implement based on Spawner UI's 
    //  actual WebSocket/event system]
  }
  
  subscribe(eventType, handler) {
    // [CLAUDE_CODE_FILL: Map to actual Spawner UI event patterns]
  }
  
  async getInitialState() {
    // [CLAUDE_CODE_FILL: Fetch current state from Spawner UI APIs]
  }
}
```

### 6.2 Event Normalization

```javascript
// Normalize Spawner UI events to Theatre events
// [CLAUDE_CODE_FILL: Map actual event structures]

function normalizeEvent(spawnerEvent) {
  // Input: Raw event from Spawner UI
  // Output: Standardized theatre event
  
  return {
    type: mapEventType(spawnerEvent.type),
    agentId: spawnerEvent.agent?.id,
    workflowId: spawnerEvent.workflow?.id,
    timestamp: spawnerEvent.timestamp,
    payload: {
      message: spawnerEvent.message,
      status: spawnerEvent.status,
      metadata: spawnerEvent.metadata
    }
  };
}
```

### 6.3 Local Development Setup

```bash
# [CLAUDE_CODE_FILL: Create setup script based on actual project structure]

# Expected setup flow:
# 1. Start Spawner UI locally
# 2. Start bridge server (if separate)
# 3. Start Agent Theatre dev server
# 4. Connect and sync

# Placeholder - replace with actual commands:
# npm run spawner:start
# npm run bridge:start  
# npm run theatre:dev
```

---

## 7. Prompts for GitHub Integration

### 7.1 For Claude Code - Repository Discovery

```
TASK: Analyze the Spawner UI repository and extract integration details.

SEARCH FOR:
1. Event emission patterns (search: "emit", "dispatch", "publish", "event")
2. WebSocket implementations (search: "ws", "socket", "websocket")
3. Agent type definitions (search: "agent", "type", "enum", "interface")
4. Workflow execution (search: "workflow", "execute", "run", "task")
5. Memory/Mind systems (search: "memory", "mind", "learning", "knowledge")
6. API routes (search: "route", "endpoint", "api", "handler")

OUTPUT FORMAT:
For each discovery, provide:
- File path
- Relevant code snippet
- How it maps to Agent Theatre integration
- Suggested implementation approach
```

### 7.2 For Claude Code - Bridge Implementation

```
TASK: Create the bridge server that connects Spawner UI to Agent Theatre.

REQUIREMENTS:
1. WebSocket server for real-time events
2. REST endpoints for state queries
3. Event translation layer
4. Authentication passthrough (if needed)
5. Reconnection handling
6. Event buffering for Theatre catch-up

USE PATTERNS FROM:
- Existing Spawner UI networking code
- Any existing external integrations
- Configuration/environment patterns

OUTPUT:
- bridge-server/index.js (or .ts)
- bridge-server/events.js
- bridge-server/api.js
- Updated configuration files
```

### 7.3 For Claude Code - Complete PRD Update

```
TASK: Update this PRD with complete technical specifications.

FILL ALL SECTIONS MARKED WITH [CLAUDE_CODE_FILL]

ADDITIONAL TASKS:
1. Add a "Technical Appendix" section with:
   - Complete API documentation
   - Event schema definitions
   - Data type mappings
   
2. Add an "Implementation Roadmap" with:
   - Estimated complexity per feature
   - Dependency order
   - Risk areas

3. Add a "Testing Strategy" section with:
   - Mock event generators
   - Integration test approach
   - Visual regression testing

4. Generate initial code scaffolding in a new directory
```

---

## 8. Three.js Implementation Outline

### 8.1 Project Structure

```
agent-theatre/
├── src/
│   ├── core/
│   │   ├── Scene.js          # Three.js scene setup
│   │   ├── Camera.js         # Camera controls
│   │   ├── Renderer.js       # WebGL renderer
│   │   └── Loop.js           # Animation loop
│   ├── characters/
│   │   ├── BaseCharacter.js  # Character base class
│   │   ├── Director.js       # Orchestrator character
│   │   ├── Builder.js        # Worker character
│   │   ├── Scholar.js        # Researcher character
│   │   ├── Artist.js         # Creative character
│   │   └── Keeper.js         # Memory character
│   ├── systems/
│   │   ├── AnimationSystem.js
│   │   ├── ChatSystem.js
│   │   ├── WorkflowSystem.js
│   │   └── EmotionSystem.js
│   ├── bridge/
│   │   ├── SpawnerBridge.js  # Connection to Spawner UI
│   │   ├── EventHandler.js   # Event processing
│   │   └── StateManager.js   # Application state
│   ├── ui/
│   │   ├── Dashboard.jsx     # Status overlay (React)
│   │   ├── ChatPanel.jsx     # Conversation viewer
│   │   └── Controls.jsx      # User controls
│   └── main.js               # Entry point
├── public/
│   ├── models/               # GLTF character models
│   ├── textures/             # Environment textures
│   └── sounds/               # Audio effects
├── bridge-server/            # Local bridge server
│   ├── index.js
│   └── [CLAUDE_CODE_FILL]
└── config/
    ├── characters.json       # Character configurations
    ├── animations.json       # Animation mappings
    └── spawner.config.js     # Spawner UI connection config
```

### 8.2 Key Dependencies

```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.92.0",
    "socket.io-client": "^4.7.0",
    "zustand": "^4.4.0",
    "framer-motion-3d": "^11.0.0",
    "leva": "^0.9.35"
  }
}
```

---

## 9. Visual Design References

### 9.1 Style Inspiration
- **Pixar's Inside Out**: Emotional characters, abstract concepts made tangible
- **Monument Valley**: Clean geometry, satisfying animations
- **Overcooked**: Chaotic but readable multi-agent activity
- **Slack's loading animations**: Professional yet playful
- **Discord's Wumpus**: Character that conveys state through pose/expression

### 9.2 Color System

| Element | Color | Usage |
|---------|-------|-------|
| Primary | `#6366F1` | Main UI elements, highlights |
| Success | `#10B981` | Completed tasks, healthy states |
| Warning | `#F59E0B` | Processing, attention needed |
| Error | `#EF4444` | Failures, critical states |
| Neutral | `#6B7280` | Idle states, backgrounds |

### 9.3 Animation Principles
- **Anticipation**: Characters telegraph actions before doing them
- **Follow-through**: Actions have weight and consequence
- **Personality**: Each character type moves distinctively
- **Timing**: Speed conveys urgency/importance
- **Staging**: Important actions get visual focus

---

## 10. Success Metrics

### 10.1 Technical Success
- [ ] < 100ms latency from Spawner event to Theatre update
- [ ] 60fps animation performance
- [ ] Handles 20+ concurrent agent characters
- [ ] Graceful degradation on connection loss

### 10.2 User Experience Success
- [ ] Users can understand workflow state at a glance
- [ ] Agent conversations are readable and followable
- [ ] The experience is genuinely enjoyable to watch
- [ ] Users report increased trust in the automation

### 10.3 Engagement Metrics
- [ ] Average session time > 5 minutes
- [ ] Users return to check on long-running workflows
- [ ] Positive qualitative feedback on character design

---

## 11. Open Questions

> [CLAUDE_CODE_FILL: After repository analysis, update this section]

1. **Authentication**: How does Spawner UI handle auth? Do we need to pass through?
2. **Scaling**: What's the maximum concurrent agents/workflows?
3. **History**: Is there a persistent event log for replay functionality?
4. **Customization**: Can users customize their Theatre environment?
5. **Mobile**: Should we support mobile viewing?

---

## 12. Next Steps

### For Claude Code (Immediate):

```
1. Run repository discovery prompts (Section 7.1)
2. Fill all [CLAUDE_CODE_FILL] sections
3. Generate bridge server code
4. Create initial Three.js scaffolding
5. Output updated PRD + initial codebase
```

### For Human Review (After Claude Code):
1. Review filled PRD for accuracy
2. Approve character designs
3. Prioritize features for MVP
4. Set up development environment
5. Begin sprint planning

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| Agent Theatre | This Three.js visualization system |
| Spawner UI | [CLAUDE_CODE_FILL: Brief description of Spawner UI] |
| Bridge | The connection layer between Spawner UI and Theatre |
| Character | 3D representation of an agent |
| Archetype | Visual/behavioral category (Director, Builder, etc.) |

---

*Document Version: DRAFT 0.1*  
*Created: Claude (claude.ai)*  
*Requires: Claude Code completion*  
*Last Updated: [Auto-fill on save]*
