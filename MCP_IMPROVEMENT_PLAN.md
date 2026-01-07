# MCP Improvement Plan for Spawner UI

> Making MCPs first-class citizens that enhance skills, feed Mind, and automate workflows

## Vision

MCPs (Model Context Protocol servers) are the **connective tissue** of Spawner. They:

- **Extend** what skills can do (tools, data access, integrations)
- **Feed** Mind with real-world feedback (analytics, security scans, metrics)
- **Automate** workflows (deployment, monitoring, notifications)
- **Connect** to the outside world (APIs, databases, services)

MCPs transform Spawner from an isolated agent system into a **living ecosystem** that learns from real outcomes.

---

## Core Concepts

### 1. MCP as Capability Provider

MCPs provide capabilities that agents can use:

```
┌─────────────────────────────────────────────────────────────────┐
│                         SKILL                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Native    │  │    MCP      │  │    MCP      │             │
│  │   Ability   │  │   Tools     │  │   Data      │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│        │                │                │                      │
│        └────────────────┼────────────────┘                      │
│                         │                                       │
│                    Agent Uses                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Example**: A "Marketing" skill can use:
- Native: Content generation, strategy planning
- MCP Tools: Image generation (DALL-E), social posting (Twitter API)
- MCP Data: Analytics (engagement metrics), competitor data

---

### 2. MCP as Feedback Provider

MCPs observe outcomes and report back to Mind:

```
┌─────────────────────────────────────────────────────────────────┐
│                      FEEDBACK LOOP                               │
│                                                                  │
│   Mission      Agent        Output        MCP          Mind     │
│   Started  →   Works    →   Created   →  Observes  →  Learns   │
│                                              │                   │
│                                              ▼                   │
│                                    ┌─────────────────┐          │
│                                    │ Security Scan   │          │
│                                    │ Analytics Data  │          │
│                                    │ Performance     │          │
│                                    │ User Feedback   │          │
│                                    └─────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

**Example**: Code generated → Security Scanner MCP runs → Finds vulnerability → Mind learns "this pattern is risky"

---

### 3. MCP as Pipeline Node

MCPs can be nodes in execution pipelines:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PIPELINE                                  │
│                                                                  │
│  [Research]  →  [Design]  →  [Security  →  [Build]  →  [Deploy │
│   Skill          Skill       Scan MCP]      Skill       MCP]    │
│                                  │                        │      │
│                                  ▼                        ▼      │
│                              Validates               Publishes   │
│                              & Gates                 & Monitors  │
└─────────────────────────────────────────────────────────────────┘
```

MCPs can act as:
- **Validators** - Gate progression (security must pass)
- **Transformers** - Process outputs between skills
- **Monitors** - Track execution and report metrics
- **Triggers** - Start actions based on conditions

---

## MCP Categories

### Feedback MCPs (→ Mind)

Feed data back to Mind for learning:

| MCP | What It Measures | Mind Learning |
|-----|-----------------|---------------|
| Security Scanner | Vulnerabilities, secrets | "This pattern has SQL injection risk" |
| Analytics Tracker | Engagement, traffic, conversions | "Short videos get 2x engagement" |
| Code Quality | Complexity, coverage, lint errors | "High cyclomatic complexity = more bugs" |
| SEO Analyzer | Rankings, backlinks, speed | "Long-form content ranks better" |
| Performance Monitor | Load times, memory, CPU | "This approach is 3x slower" |
| User Sentiment | Reviews, NPS, feedback | "Users struggle with this flow" |
| A/B Test Results | Variant performance | "Version B converts 15% better" |

### Tool MCPs (Skills Use)

Provide tools that skills can invoke:

| MCP | Tools Provided | Used By Skills |
|-----|---------------|----------------|
| Image Generator | generate_image, edit_image | Design, Marketing, Game Art |
| Video Generator | generate_video, edit_video | Content, Marketing |
| Audio Generator | generate_audio, text_to_speech | Content, Game Dev |
| Code Executor | run_code, test_code | Development, DevOps |
| Web Browser | navigate, screenshot, interact | Research, Testing |
| File Manager | read, write, transform | All |
| Email Sender | send_email, create_template | Marketing, Notifications |

### Data MCPs (Information Access)

Provide data access:

| MCP | Data Provided | Use Cases |
|-----|--------------|-----------|
| Database Connector | SQL queries, schema info | Backend, Analytics |
| Web Research | Search results, page content | Research, Content |
| API Gateway | REST/GraphQL calls | Integration |
| Knowledge Base | Documentation, FAQs | Support, Onboarding |
| Market Data | Prices, trends, news | Finance, Trading |
| Social Listener | Mentions, sentiment, trends | Marketing, PR |

### Integration MCPs (External Services)

Connect to external platforms:

| MCP | Integrations | Actions |
|-----|-------------|---------|
| GitHub | Repos, PRs, Issues | Code management |
| Slack/Discord | Channels, messages | Team communication |
| Notion/Docs | Pages, databases | Documentation |
| CRM (Salesforce, HubSpot) | Contacts, deals | Sales automation |
| Project Management (Jira, Linear) | Tasks, sprints | Work tracking |
| Cloud Providers (AWS, GCP, Azure) | Infrastructure | Deployment |

### Automation MCPs (Workflow Actions)

Automate repetitive tasks:

| MCP | Automations | Triggers |
|-----|-------------|----------|
| Scheduler | Cron jobs, delayed tasks | Time-based |
| Webhook Handler | Receive external events | Event-based |
| Notification Hub | Email, SMS, push, Slack | Condition-based |
| Deployment Manager | Build, deploy, rollback | Pipeline completion |
| Backup Manager | Snapshot, restore | Scheduled |

---

## MCP-Skill Integration

### Binding Types

```typescript
interface SkillMCPBinding {
  skillId: string;
  mcpId: string;

  // How tightly coupled
  bindingType: 'required' | 'recommended' | 'optional';

  // When to attach
  autoAttach: boolean;        // Attach when skill is used
  attachOnMissionStart: boolean;
  attachOnTaskStart: boolean;

  // What to use
  toolsUsed: string[];        // Specific tools this skill uses
  feedbackSubscribed: string[]; // Feedback types skill cares about

  // Configuration
  defaultConfig: MCPConfig;    // Preset config for this binding
  configOverridable: boolean;  // Can user change config
}
```

### Recommended Bindings

Pre-configured skill-MCP combinations:

```yaml
# Game Development Skills
game-development:
  required:
    - image-generator      # Asset creation
  recommended:
    - security-scanner     # Code security
    - performance-monitor  # Game performance
  optional:
    - analytics-tracker    # Player analytics

# Marketing Skills
marketing:
  required:
    - analytics-tracker    # Campaign metrics
  recommended:
    - image-generator      # Visual assets
    - social-listener      # Brand monitoring
  optional:
    - seo-analyzer         # Content optimization

# Backend Skills
backend:
  required:
    - database-connector   # Data access
  recommended:
    - security-scanner     # Vulnerability checks
    - code-quality         # Code standards
  optional:
    - performance-monitor  # API performance
```

---

## MCP-Team Integration

### Team-Level MCPs

MCPs can be attached to entire teams:

```typescript
interface TeamMCPBinding {
  teamId: string;
  mcpId: string;

  // Sharing behavior
  sharedAcrossTeam: boolean;  // All members can use
  sharedContext: boolean;      // Share MCP state across team

  // Feedback handling
  feedbackAggregation: boolean; // Combine feedback from all members
  feedbackScope: 'task' | 'mission' | 'team';

  // Access control
  allowedMembers: string[];    // Specific skills that can use (empty = all)
  adminOnly: boolean;          // Only team lead can configure
}
```

### Team MCP Patterns

**Shared Resource Pattern**:
```
Team: Design + Frontend + Backend
Shared MCP: Database Connector
- All skills query same database
- Shared connection pool
- Unified schema access
```

**Aggregated Feedback Pattern**:
```
Team: Content Strategy + Blog Writing + SEO
Shared MCP: Analytics Tracker
- Each skill contributes to content
- Analytics aggregates all performance
- Mind learns what combination works
```

**Gated Progress Pattern**:
```
Team: Frontend + Backend + DevOps
Gate MCP: Security Scanner
- Must pass security before deployment
- Blocks pipeline if vulnerabilities found
- Reports to Mind on common issues
```

---

## MCP in Pipelines

### Pipeline Node Types

```typescript
interface PipelineMCPNode {
  id: string;
  mcpId: string;
  nodeType: 'validator' | 'transformer' | 'monitor' | 'action' | 'trigger';

  // Position in pipeline
  position: { x: number; y: number };
  layer: number;  // Execution order

  // Connections
  inputFrom: string[];   // Receives from these nodes
  outputTo: string[];    // Sends to these nodes

  // Execution rules
  runCondition: 'always' | 'on_success' | 'on_failure' | 'conditional';
  condition?: string;    // Custom condition expression

  // Configuration
  toolsToRun: string[];  // Which MCP tools to execute
  inputMapping: Record<string, string>;  // Map inputs to tool params
  outputMapping: Record<string, string>; // Map tool outputs to pipeline

  // Error handling
  onError: 'fail' | 'skip' | 'retry' | 'fallback';
  retryCount?: number;
  fallbackNode?: string;
}
```

### Pipeline Examples

**Quality Gate Pipeline**:
```
[Skill: Code Gen]
      │
      ▼
[MCP: Code Quality] ──failure──> [Skill: Fix Issues]
      │                                │
      success                          │
      │                                │
      ▼                                │
[MCP: Security Scan] <─────────────────┘
      │
      ▼
[MCP: Deploy]
```

**Content Pipeline with Feedback**:
```
[Skill: Strategy] → [Skill: Writing] → [Skill: SEO]
                                            │
                                            ▼
                                    [MCP: Publish]
                                            │
                                            ▼
                                    [MCP: Analytics] ──> Mind
```

---

## MCP Registry & Discovery

### Registry Structure

```typescript
interface MCPRegistry {
  // Built-in MCPs
  builtin: MCPDefinition[];

  // Community MCPs
  community: MCPRegistryEntry[];

  // User's custom MCPs
  custom: MCPDefinition[];

  // Installed MCPs
  installed: string[];  // MCP IDs

  // Categories and tags for discovery
  categories: MCPCategory[];
  tags: string[];
}

interface MCPRegistryEntry {
  definition: MCPDefinition;

  // Discovery metadata
  popularity: number;       // Install count
  rating: number;          // 0-5 stars
  reviews: MCPReview[];

  // Trust indicators
  verified: boolean;        // Reviewed by team
  featured: boolean;        // Highlighted
  official: boolean;        // From platform

  // Maintenance
  lastUpdated: string;
  maintainer: string;
  repository?: string;
}
```

### Discovery UI

```
┌─────────────────────────────────────────────────────────────────┐
│  MCP Registry                                    [+ Add Custom]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Search MCPs...]                                               │
│                                                                  │
│  Categories: [All] [Feedback] [Tool] [Data] [Integration]       │
│                                                                  │
│  Featured                                                        │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│  │ 🔒 Security      │ │ 📊 Analytics     │ │ 🎨 Image Gen     │ │
│  │ Scanner          │ │ Tracker          │ │                  │ │
│  │ ★★★★★ Official   │ │ ★★★★☆ Verified  │ │ ★★★★★ Official   │ │
│  │ [Install]        │ │ [Install]        │ │ [Install]        │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│                                                                  │
│  Popular This Week                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. GitHub Integration    ★★★★★  12.4k installs          │   │
│  │ 2. Notion Connector      ★★★★☆   8.2k installs          │   │
│  │ 3. Slack Notifier        ★★★★★   7.8k installs          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## MCP Configuration

### Configuration Levels

```
Global Config (User-wide defaults)
    │
    ▼
Project Config (Project-specific overrides)
    │
    ▼
Mission Config (Mission-specific overrides)
    │
    ▼
Runtime Config (Dynamic adjustments)
```

### Configuration Schema

```typescript
interface MCPConfiguration {
  // Connection
  endpoint?: string;
  transport: 'stdio' | 'http' | 'websocket';
  timeout: number;

  // Authentication
  auth?: {
    type: 'none' | 'api_key' | 'oauth' | 'token';
    credentials: Record<string, string>;
  };

  // Behavior
  autoConnect: boolean;
  reconnectOnFailure: boolean;
  maxRetries: number;

  // Feedback settings
  autoFeedback: boolean;
  feedbackThreshold: number;  // Min confidence to send
  feedbackBatching: boolean;
  feedbackInterval: number;   // Batch interval in ms

  // Resource limits
  maxConcurrentCalls: number;
  rateLimitPerMinute: number;
  maxResponseSize: number;

  // Logging
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
  logToMind: boolean;  // Log MCP interactions to Mind
}
```

---

## MCP Lifecycle

### States

```
┌─────────────────────────────────────────────────────────────────┐
│                       MCP LIFECYCLE                              │
│                                                                  │
│   ┌──────────┐    ┌────────────┐    ┌───────────┐               │
│   │Registered│───▶│ Installing │───▶│ Installed │               │
│   └──────────┘    └────────────┘    └─────┬─────┘               │
│                                           │                      │
│                                           ▼                      │
│                              ┌────────────────────┐              │
│                              │    Disconnected    │◀────┐        │
│                              └──────────┬─────────┘     │        │
│                                         │               │        │
│                                         ▼               │        │
│                              ┌────────────────────┐     │        │
│                              │    Connecting      │     │        │
│                              └──────────┬─────────┘     │        │
│                                         │               │        │
│                           success       │      failure  │        │
│                              ┌──────────┴──────────┐    │        │
│                              ▼                     ▼    │        │
│                   ┌────────────────┐    ┌─────────────┐ │        │
│                   │   Connected    │    │    Error    │─┘        │
│                   └───────┬────────┘    └─────────────┘          │
│                           │                                      │
│                           ▼                                      │
│                   ┌────────────────┐                             │
│                   │     Active     │ ◀─── Tools being used       │
│                   └────────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Health Monitoring

```typescript
interface MCPHealth {
  mcpId: string;
  status: MCPConnectionStatus;

  // Connection health
  lastPing: string;
  latencyMs: number;
  uptime: number;  // Percentage

  // Usage stats
  callsTotal: number;
  callsSuccessful: number;
  callsFailed: number;
  avgResponseTime: number;

  // Errors
  lastError?: string;
  errorCount24h: number;

  // Resource usage
  memoryUsage?: number;
  cpuUsage?: number;
}
```

---

## UI Components

### 1. MCP Dashboard (Enhanced)

```
┌─────────────────────────────────────────────────────────────────┐
│  MCPs                                              [+ Connect]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  │ Connected  │ │  Feedback  │ │    Tools   │ │   Health   │   │
│  │     8      │ │    127     │ │     42     │ │    98%     │   │
│  │   active   │ │ this week  │ │ available  │ │   uptime   │   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│  [Discover] [Connected] [Feedback] [Pipelines] [Settings]       │
│                                                                  │
│  ... tab content ...                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. MCP Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│  Security Scanner                           [Disconnect] [⚙️]    │
│  Category: Feedback │ Status: ● Connected                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Description                                                     │
│  Scans code for vulnerabilities using Trivy and Gitleaks.       │
│  Provides real-time security feedback to Mind.                  │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│  Tools                                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ scan_vulnerabilities                                        ││
│  │ Scan code for security vulnerabilities                      ││
│  │ [Try It]                                                    ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ scan_secrets                                                ││
│  │ Scan for exposed secrets and credentials                    ││
│  │ [Try It]                                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Feedback Types                                                  │
│  [vulnerability_report] [secret_detection]                      │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│  Attached To                                                     │
│  Skills: [backend] [frontend] [devops]                          │
│  Teams: [Core Development]                                      │
│  Pipelines: [Deploy Pipeline] [Code Review]                     │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│  Stats (Last 7 Days)                                            │
│  ├─ Calls: 234                                                  │
│  ├─ Feedback sent: 18                                           │
│  ├─ Avg response: 1.2s                                          │
│  └─ Success rate: 99.1%                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Pipeline MCP Integration

```
┌─────────────────────────────────────────────────────────────────┐
│  Pipeline: Deploy to Production                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│       ┌─────────┐                                               │
│       │  Code   │                                               │
│       │  Gen    │                                               │
│       └────┬────┘                                               │
│            │                                                     │
│            ▼                                                     │
│   ┌────────────────┐                                            │
│   │ 🔒 Security    │ ◀── MCP Node                               │
│   │    Scan        │     Type: Validator                        │
│   │ [Configure]    │     On Fail: Block                         │
│   └────────┬───────┘                                            │
│            │                                                     │
│       pass │ fail                                                │
│            │   └──────▶ [Alert & Stop]                          │
│            ▼                                                     │
│       ┌─────────┐                                               │
│       │  Build  │                                               │
│       └────┬────┘                                               │
│            │                                                     │
│            ▼                                                     │
│   ┌────────────────┐                                            │
│   │ 🚀 Deploy      │ ◀── MCP Node                               │
│   │    Manager     │     Type: Action                           │
│   │ [Configure]    │     Target: Production                     │
│   └────────────────┘                                            │
│                                                                  │
│  [+ Add MCP Node]                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. MCP Sidebar Panel

Quick access in canvas/mission views:

```
┌─────────────────────┐
│  MCPs          [+]  │
├─────────────────────┤
│                     │
│  Connected (3)      │
│  ┌─────────────────┐│
│  │ 🔒 Security    ●││
│  │ 📊 Analytics   ●││
│  │ 🎨 Image Gen   ●││
│  └─────────────────┘│
│                     │
│  Drag to add to     │
│  pipeline or skill  │
│                     │
│  ─────────────────  │
│                     │
│  Recommended        │
│  for this mission:  │
│  ┌─────────────────┐│
│  │ 📈 SEO Analyzer ││
│  │ [Connect]       ││
│  └─────────────────┘│
│                     │
└─────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Current)
**Goal**: Basic MCP infrastructure

- [x] MCP type definitions
- [x] MCP store for state management
- [x] MCP page with Discover/Connected/Feedback tabs
- [x] Built-in MCP definitions
- [x] Navbar integration
- [ ] MCP instance persistence (localStorage)
- [ ] Basic connection simulation

### Phase 2: Skill Integration
**Goal**: MCPs work with skills

- [ ] Skill-MCP binding UI
- [ ] Auto-attach on skill use
- [ ] Tool invocation from skills
- [ ] Skill detail page MCP section
- [ ] Recommended MCPs for skills

### Phase 3: Team Integration
**Goal**: MCPs work with teams

- [ ] Team-MCP binding
- [ ] Shared MCP resources
- [ ] Team-level configuration
- [ ] Aggregated feedback

### Phase 4: Pipeline Integration
**Goal**: MCPs as pipeline nodes

- [ ] MCP nodes on canvas
- [ ] Drag-and-drop from sidebar
- [ ] Validator/gate nodes
- [ ] Pipeline MCP configuration
- [ ] Execution integration

### Phase 5: Real Connections
**Goal**: Actually connect to MCP servers

- [ ] MCP protocol implementation
- [ ] stdio transport
- [ ] HTTP transport
- [ ] WebSocket transport
- [ ] Health monitoring

### Phase 6: Feedback Loop
**Goal**: MCPs feed Mind

- [ ] Feedback processing pipeline
- [ ] Auto-send to Mind API
- [ ] Confidence updates
- [ ] Learning correlation
- [ ] Feedback UI enhancements

### Phase 7: Registry & Discovery
**Goal**: Community MCPs

- [ ] Registry API
- [ ] Community submissions
- [ ] Ratings and reviews
- [ ] Verification process
- [ ] Custom MCP creation

---

## Technical Architecture

### MCP Protocol Support

```typescript
interface MCPTransport {
  type: 'stdio' | 'http' | 'websocket';

  // stdio: Local process
  stdio?: {
    command: string;
    args: string[];
    env?: Record<string, string>;
  };

  // http: REST API
  http?: {
    baseUrl: string;
    headers?: Record<string, string>;
  };

  // websocket: Real-time
  websocket?: {
    url: string;
    protocols?: string[];
  };
}
```

### Message Format

```typescript
// Request
interface MCPRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

// Response
interface MCPResponse {
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Notification (no response expected)
interface MCPNotification {
  method: string;
  params?: Record<string, unknown>;
}
```

### Tool Execution

```typescript
interface ToolCall {
  mcpId: string;
  tool: string;
  params: Record<string, unknown>;

  // Context
  skillId?: string;
  missionId?: string;
  taskId?: string;

  // Options
  timeout?: number;
  retries?: number;
}

interface ToolResult {
  success: boolean;
  result?: unknown;
  error?: string;

  // Metadata
  duration: number;
  retryCount: number;

  // Feedback trigger
  triggerFeedback?: boolean;
  feedbackType?: string;
}
```

---

## Security Considerations

### Permission Model

```typescript
interface MCPPermissions {
  // What the MCP can access
  fileSystem: 'none' | 'read' | 'readwrite' | 'full';
  network: 'none' | 'localhost' | 'allowlist' | 'full';
  environment: 'none' | 'allowlist' | 'full';

  // Resource limits
  maxMemory: number;    // MB
  maxCPU: number;       // Percentage
  maxDuration: number;  // Seconds per call

  // Data handling
  canAccessSecrets: boolean;
  canAccessUserData: boolean;
  dataRetention: 'none' | 'session' | 'persistent';
}
```

### Trust Levels

```
┌─────────────────────────────────────────────────────────────────┐
│                       TRUST LEVELS                               │
│                                                                  │
│  Official (Spawner team)                                        │
│  ├─ Fully trusted                                               │
│  ├─ No permission prompts                                       │
│  └─ Auto-updates enabled                                        │
│                                                                  │
│  Verified (Community reviewed)                                  │
│  ├─ Code audited                                                │
│  ├─ Permissions displayed                                       │
│  └─ Update notifications                                        │
│                                                                  │
│  Community (Unverified)                                         │
│  ├─ Permission prompts required                                 │
│  ├─ Sandboxed by default                                        │
│  └─ User reviews visible                                        │
│                                                                  │
│  Custom (User-created)                                          │
│  ├─ Full local permissions                                      │
│  ├─ User responsible                                            │
│  └─ Not shareable                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Success Metrics

### Usage Metrics
- MCPs connected per user
- Tool calls per day
- Most popular MCPs
- Skill-MCP binding frequency

### Quality Metrics
- MCP uptime percentage
- Average response time
- Error rate by MCP
- Feedback delivery rate

### Impact Metrics
- Mind learnings from MCP feedback
- Pipeline success rate with MCP validators
- User satisfaction with MCP tools

---

## Open Questions

1. **Protocol Version**: Which MCP protocol version to target?
2. **Sandboxing**: How to sandbox untrusted MCPs?
3. **Pricing**: Should some MCPs be premium?
4. **Offline Mode**: How do MCPs work offline?
5. **Mobile**: MCP support on mobile clients?
6. **Rate Limiting**: How to handle MCP rate limits?

---

## Next Steps

1. Implement MCP persistence (localStorage)
2. Add skill-MCP binding UI
3. Create MCP sidebar for canvas
4. Build pipeline MCP node support
5. Prototype real MCP connection (stdio)

---

*This is a living document. Update as we learn more about MCP patterns and user needs.*
