# Mind Intelligence Tiers

> A comprehensive architecture for agent self-learning, team intelligence, and collective wisdom

---

## Executive Summary

Mind v5 can power three distinct tiers of agent intelligence, each building on the previous:

| Tier | Intelligence Level | Learning Scope | Key Capability |
|------|-------------------|----------------|----------------|
| **LITE** | Individual Memory | Per-agent | Remembers what worked |
| **STANDARD** | Team Intelligence | Cross-agent | Learns why things work |
| **ENTERPRISE** | Collective Wisdom | Cross-project | Knows what will work |

---

## The Problem We're Solving

### Current State: Hollow Intelligence

Today's agent memories are template-based logs:

```
"Task executed: Build UI component"
"Task completed successfully in 10s"
"Mission 3/4 tasks done"
```

**This tells us WHAT happened, not WHAT WAS LEARNED.**

### Target State: Rich Intelligence

```
"Chose Zustand over Redux for state management because project is
 small-to-medium and user explicitly prefers minimal boilerplate.
 Evaluated: Redux (rejected: too verbose), Jotai (considered: good
 but less ecosystem), Context (rejected: prop drilling at scale)."

 Confidence: 0.85
 Outcome: Positive (user approved without changes)
 Pattern: state-management-selection
 Applicable to: React projects < 50 components
```

---

## Tier 1: LITE - Individual Memory

### What It Is

SQLite-based local storage with substring search. No external services required. **This is what we have today.**

### Capabilities

| Feature | Support | Notes |
|---------|---------|-------|
| Memory CRUD | ✅ Full | Create, read, update, delete |
| Temporal Levels | ✅ Full | 1-4 levels with manual promotion |
| Salience | ⚠️ Manual | Set explicitly, no auto-adjustment |
| Search | ⚠️ Basic | Substring matching only |
| Decisions | ⚠️ Basic | Stored but not linked to outcomes |
| Outcomes | ⚠️ Basic | Stored but no attribution |
| Patterns | ❌ None | Manual only |
| Cross-Agent | ❌ None | Each agent isolated |
| Federation | ❌ None | Single project only |

### Intelligence Model

```
┌─────────────────────────────────────────────────────────┐
│                    LITE TIER                            │
│                                                         │
│   Agent A              Agent B              Agent C     │
│   ┌─────┐              ┌─────┐              ┌─────┐    │
│   │ 📝  │              │ 📝  │              │ 📝  │    │
│   │Mem A│              │Mem B│              │Mem C│    │
│   └─────┘              └─────┘              └─────┘    │
│      │                    │                    │        │
│      └────────────────────┼────────────────────┘        │
│                           │                             │
│                    ┌──────▼──────┐                      │
│                    │   SQLite    │                      │
│                    │  (Local)    │                      │
│                    └─────────────┘                      │
│                                                         │
│   Learning: Each agent remembers its own experiences    │
│   Limitation: Agents can't learn from each other        │
└─────────────────────────────────────────────────────────┘
```

### What Agents Can Learn (LITE)

1. **Own Successes**: "When I used Drizzle ORM, the task succeeded"
2. **Own Failures**: "TypeScript strict mode caught my null reference error"
3. **Own Patterns**: "I tend to work better on API tasks than UI tasks"
4. **User Preferences**: "This user prefers detailed explanations"

### What Agents Cannot Learn (LITE)

1. Why something worked (no outcome attribution)
2. From other agents' experiences
3. Semantic relationships between memories
4. Automatically promoted insights

### Claude Code Event Schema (LITE)

```typescript
// Rich learning event for LITE tier
interface LiteLearningEvent {
  type: 'learning';

  // The actual insight (not template garbage)
  content: string;  // "Early returns prevent callback hell in async handlers"

  // Categorization
  learning_type: 'success_pattern' | 'failure_lesson' | 'user_preference' |
                 'skill_insight' | 'collaboration_note' | 'optimization';

  // Context
  skill_id?: string;        // "drizzle-orm"
  task_context?: string;    // "Building user authentication"
  mission_id?: string;

  // Importance (manually set in LITE)
  temporal_level: 1 | 2 | 3 | 4;  // 1=hours, 2=days, 3=weeks, 4=permanent
  salience: number;               // 0.0 to 1.0

  // Evidence
  evidence?: {
    what_happened: string;
    why_it_worked?: string;
    alternatives_considered?: string[];
  };
}

// Example: Rich learning from Claude Code
{
  type: 'learning',
  content: 'Zod schemas should be defined before Drizzle schemas to enable shared validation',
  learning_type: 'success_pattern',
  skill_id: 'drizzle-orm',
  task_context: 'Setting up database layer with validation',
  temporal_level: 3,  // Reference - useful for weeks
  salience: 0.85,
  evidence: {
    what_happened: 'Defined Drizzle schema first, had to duplicate validation logic',
    why_it_worked: 'Zod schemas can be used both for API validation and Drizzle inference',
    alternatives_considered: ['Drizzle-first', 'Separate validation layer']
  }
}
```

### Implementation Requirements (LITE)

**Claude Code Changes:**
1. Send rich `learning` events after each task (not just completion status)
2. Include reasoning context in decision events
3. Tag learnings with skill_id for retrieval

**Spawner UI Changes:**
1. Parse and store rich learning events
2. Display learnings grouped by skill/type
3. Allow manual promotion of valuable insights

---

## Tier 2: STANDARD - Team Intelligence

### What It Is

PostgreSQL with pgvector for semantic search. Includes causal graph, automatic salience adjustment, and cross-agent learning. **Requires Docker/PostgreSQL.**

### Capabilities

| Feature | Support | Notes |
|---------|---------|-------|
| Memory CRUD | ✅ Full | Same as LITE |
| Temporal Levels | ✅ Full | Automatic promotion based on usage |
| Salience | ✅ Auto | Adjusted by outcome quality |
| Search | ✅ Semantic | Vector embeddings + keyword + salience |
| Decisions | ✅ Full | Linked to memories and outcomes |
| Outcomes | ✅ Full | Attribution to influencing memories |
| Patterns | ✅ Auto | Background extraction from decisions |
| Cross-Agent | ✅ Full | Agents share learnings |
| Federation | ❌ None | Single project only |

### Intelligence Model

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           STANDARD TIER                                   │
│                                                                          │
│   Agent A              Agent B              Agent C                      │
│   ┌─────┐              ┌─────┐              ┌─────┐                     │
│   │ 🧠  │◄────────────►│ 🧠  │◄────────────►│ 🧠  │                     │
│   │Learn│   Shared     │Learn│   Shared     │Learn│                     │
│   └──┬──┘   Memory     └──┬──┘   Memory     └──┬──┘                     │
│      │                    │                    │                         │
│      └────────────────────┼────────────────────┘                         │
│                           │                                              │
│                    ┌──────▼──────┐                                       │
│                    │ PostgreSQL  │                                       │
│                    │ + pgvector  │                                       │
│                    └──────┬──────┘                                       │
│                           │                                              │
│              ┌────────────┼────────────┐                                 │
│              │            │            │                                 │
│        ┌─────▼─────┐ ┌────▼────┐ ┌─────▼─────┐                          │
│        │  Causal   │ │Salience │ │  Pattern  │                          │
│        │  Graph    │ │ Adjuster│ │ Extractor │                          │
│        └───────────┘ └─────────┘ └───────────┘                          │
│                                                                          │
│   Learning: Agents learn from each other's experiences                   │
│   Intelligence: System knows WHY things work, adjusts automatically      │
└──────────────────────────────────────────────────────────────────────────┘
```

### What Agents Can Learn (STANDARD)

Everything from LITE, plus:

1. **From Each Other**: Agent B's auth success informs Agent A's approach
2. **Causal Understanding**: Memory X led to Decision Y which had Outcome Z
3. **Automatic Salience**: Helpful memories bubble up, unhelpful sink
4. **Semantic Retrieval**: Find "authentication" when searching "login"
5. **Pattern Discovery**: "When using React + Supabase, this sequence works"

### The Learning Loop (STANDARD)

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
            ┌───────────────┐                                 │
            │   Decision    │                                 │
            │   Tracked     │                                 │
            └───────┬───────┘                                 │
                    │                                         │
                    │ Which memories                          │
                    │ influenced this?                        │
                    ▼                                         │
            ┌───────────────┐                                 │
            │   Outcome     │                                 │
            │   Recorded    │──────────────────┐              │
            └───────┬───────┘                  │              │
                    │                          │              │
                    │ How good                 │              │
                    │ was it?                  │              │
                    ▼                          ▼              │
            ┌───────────────┐          ┌───────────────┐      │
            │  Attribution  │          │   Pattern     │      │
            │  Calculated   │          │  Extraction   │      │
            └───────┬───────┘          └───────────────┘      │
                    │                                         │
                    │ Memory A: 40%                           │
                    │ Memory B: 35%                           │
                    │ Memory C: 25%                           │
                    ▼                                         │
            ┌───────────────┐                                 │
            │   Salience    │                                 │
            │   Adjusted    │─────────────────────────────────┘
            └───────────────┘
              Memory A: +0.08
              Memory B: +0.07
              Memory C: +0.05
```

### Claude Code Event Schema (STANDARD)

```typescript
// Decision with outcome tracking
interface StandardDecisionEvent {
  type: 'decision_complete';

  // Link to trace for attribution
  trace_id: string;

  // What memories influenced this decision
  retrieved_memories: string[];  // Memory IDs

  // The decision made
  decision: {
    action: string;           // "Use Zustand for state management"
    reasoning: string;        // "Small project, user prefers minimal boilerplate"
    confidence: number;       // 0.85
    context: string;          // "Setting up React state architecture"
  };

  // The outcome (can be sent later)
  outcome?: {
    quality: number;          // 0.0 to 1.0
    signal: 'positive' | 'neutral' | 'negative';
    feedback?: string;        // "User approved without changes"
    implicit_signals?: {
      user_followed_suggestion: boolean;
      iterations_needed: number;
      time_to_approval: number;  // seconds
    };
  };

  // Learning extracted from this decision
  learning?: {
    content: string;
    pattern_name?: string;
    confidence: number;
    alternatives_rejected: string[];
    gotchas_encountered?: string[];
    applicable_to?: string[];   // ["react", "state-management", "small-projects"]
  };
}

// Example: Full decision cycle
{
  type: 'decision_complete',
  trace_id: 'dec-abc123',
  retrieved_memories: ['mem-1', 'mem-2', 'mem-3'],
  decision: {
    action: 'Implement authentication using Supabase Auth with PKCE flow',
    reasoning: 'Project already uses Supabase for database, PKCE is more secure than implicit flow for SPAs, and user mentioned OAuth requirements',
    confidence: 0.88,
    context: 'User authentication for React SPA'
  },
  outcome: {
    quality: 0.92,
    signal: 'positive',
    feedback: 'Clean implementation, worked first try',
    implicit_signals: {
      user_followed_suggestion: true,
      iterations_needed: 1,
      time_to_approval: 120
    }
  },
  learning: {
    content: 'For React SPAs with existing Supabase backend, use Supabase Auth with PKCE flow - integrates seamlessly and handles token refresh automatically',
    pattern_name: 'supabase-spa-auth',
    confidence: 0.9,
    alternatives_rejected: ['NextAuth (overkill for this stack)', 'Custom JWT (unnecessary complexity)'],
    gotchas_encountered: ['Must configure redirect URLs in Supabase dashboard'],
    applicable_to: ['react', 'supabase', 'authentication', 'spa']
  }
}
```

### Background Workflows (STANDARD)

```yaml
# Runs automatically on schedule
workflows:
  memory_promotion:
    schedule: "0 0 * * *"  # Daily
    action: Promote memories based on access count + positive outcomes

  memory_expiration:
    schedule: "0 * * * *"  # Hourly
    action: Archive memories past their temporal level expiration

  memory_consolidation:
    schedule: "0 0 * * *"  # Daily
    action: Merge similar memories, deduplicate

  pattern_extraction:
    schedule: "0 0 * * *"  # Daily
    action: Analyze successful decision sequences, extract patterns

  confidence_calibration:
    schedule: "0 0 * * 0"  # Weekly
    action: Compare predicted vs actual outcomes, adjust model
```

### Implementation Requirements (STANDARD)

**Infrastructure:**
- PostgreSQL 15+ with pgvector extension
- Background job runner (Temporal, or simpler alternative)
- Embedding service (OpenAI, or local model)

**Claude Code Changes:**
- Send `decision_complete` events with full context
- Include `outcome` when known (can be separate event)
- Extract learnings at end of each task

**Spawner UI Changes:**
- Display causal relationships (decision → outcome)
- Show salience trends over time
- Surface cross-agent learnings
- Pattern library view

---

## Tier 3: ENTERPRISE - Collective Wisdom

### What It Is

Everything from STANDARD, plus federated learning across projects and users. Includes differential privacy, collective patterns, and predictive analytics. **Requires cloud infrastructure.**

### Capabilities

| Feature | Support | Notes |
|---------|---------|-------|
| All STANDARD | ✅ Full | Everything above |
| Federation | ✅ Full | Learn across projects |
| Differential Privacy | ✅ Full | Safe pattern sharing |
| Collective Patterns | ✅ Full | "90% of successful X use Y" |
| Skill Effectiveness | ✅ Full | Which H70 skills work best |
| Team Optimization | ✅ Full | Best agent combos |
| Predictive Confidence | ✅ Full | "Similar decisions worked 85%" |
| Anomaly Detection | ✅ Full | Spot underperforming agents |

### Intelligence Model

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                              ENTERPRISE TIER                                    │
│                                                                                │
│   Project A                 Project B                 Project C                │
│   ┌─────────┐               ┌─────────┐               ┌─────────┐             │
│   │Team     │               │Team     │               │Team     │             │
│   │Intel    │               │Intel    │               │Intel    │             │
│   └────┬────┘               └────┬────┘               └────┬────┘             │
│        │                         │                         │                   │
│        └─────────────────────────┼─────────────────────────┘                   │
│                                  │                                             │
│                         ┌────────▼────────┐                                    │
│                         │   Federation    │                                    │
│                         │   Layer         │                                    │
│                         └────────┬────────┘                                    │
│                                  │                                             │
│        ┌─────────────────────────┼─────────────────────────┐                   │
│        │                         │                         │                   │
│   ┌────▼────┐              ┌─────▼─────┐            ┌──────▼──────┐           │
│   │Pattern  │              │  Privacy  │            │ Collective  │           │
│   │Aggreg-  │◄────────────►│  Guard    │◄──────────►│ Analytics   │           │
│   │ation    │              │(Diff Priv)│            │             │           │
│   └─────────┘              └───────────┘            └─────────────┘           │
│                                                                                │
│   Outputs:                                                                     │
│   • "92% of React+Supabase projects succeed with auth-first approach"          │
│   • "drizzle-orm skill has 95% success rate vs 78% for prisma"                 │
│   • "frontend-design + api-design agents work better together (0.91 synergy)"  │
│   • "Projects like yours typically complete in 3 days"                         │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### What Gets Federated (Safely)

| Data Type | Federated? | Privacy Protection |
|-----------|------------|-------------------|
| Raw memories | ❌ Never | N/A |
| User content | ❌ Never | N/A |
| Personal info | ❌ Never | PII scrubbing |
| Success patterns | ✅ Yes | Aggregated (10+ users) |
| Skill effectiveness | ✅ Yes | Differential privacy |
| Team synergy scores | ✅ Yes | Anonymized |
| Decision strategies | ✅ Yes | Abstracted |

### Collective Intelligence Outputs

#### 1. Skill Effectiveness Rankings

```json
{
  "skill_rankings": {
    "authentication": {
      "supabase-auth": { "success_rate": 0.94, "avg_iterations": 1.2 },
      "nextauth": { "success_rate": 0.89, "avg_iterations": 1.5 },
      "custom-jwt": { "success_rate": 0.72, "avg_iterations": 2.3 }
    },
    "database": {
      "drizzle-orm": { "success_rate": 0.95, "avg_iterations": 1.1 },
      "prisma": { "success_rate": 0.88, "avg_iterations": 1.4 }
    }
  },
  "based_on": "1,234 projects",
  "updated_at": "2025-01-15"
}
```

#### 2. Team Synergy Matrix

```json
{
  "team_synergy": {
    "frontend-design + supabase-auth": 0.91,
    "api-design + drizzle-orm": 0.94,
    "frontend-design + api-design": 0.87,
    "frontend-design + drizzle-orm": 0.72  // Not a great combo
  },
  "recommendation": "For auth-heavy projects, pair frontend-design with supabase-auth"
}
```

#### 3. Pattern Effectiveness

```json
{
  "patterns": {
    "type-first-development": {
      "description": "Define TypeScript types before implementation",
      "success_rate": 0.93,
      "applies_to": ["typescript", "api", "database"],
      "evidence_count": 847
    },
    "auth-before-features": {
      "description": "Implement authentication before feature development",
      "success_rate": 0.89,
      "applies_to": ["saas", "user-facing"],
      "evidence_count": 623
    }
  }
}
```

#### 4. Predictive Confidence

```json
{
  "prediction": {
    "task": "Implement user authentication for React SPA with Supabase",
    "confidence": 0.91,
    "reasoning": "87 similar tasks completed successfully with this approach",
    "recommended_skills": ["supabase-auth", "frontend-design"],
    "expected_iterations": 1.2,
    "potential_gotchas": [
      "Configure redirect URLs in Supabase dashboard",
      "Handle token refresh in client"
    ]
  }
}
```

### Claude Code Event Schema (ENTERPRISE)

```typescript
// Mission complete with federation contribution
interface EnterpriseMissionEvent {
  type: 'mission_complete';

  mission_id: string;
  mission_name: string;

  // Overall results
  results: {
    success_rate: number;
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    duration_ms: number;
  };

  // Federated contribution (anonymized, aggregatable)
  federated_contribution: {
    // Pattern discoveries (will be aggregated across projects)
    patterns_discovered: Array<{
      pattern_name: string;
      description: string;
      skill_sequence: string[];
      success_rate: number;
      applies_to: string[];
    }>;

    // Skill effectiveness data (will be averaged)
    skill_effectiveness: Record<string, {
      success_rate: number;
      avg_iterations: number;
      task_types: string[];
    }>;

    // Team synergy data (will be averaged)
    team_synergy: Record<string, number>;  // "skill-a + skill-b": synergy_score

    // Gotchas encountered (will be deduplicated and ranked)
    gotchas: Array<{
      skill_id: string;
      description: string;
      severity: 'info' | 'warning' | 'critical';
      resolution: string;
    }>;
  };

  // Privacy controls
  privacy: {
    consent_level: 'none' | 'patterns_only' | 'full';
    pii_scrubbed: boolean;
    project_anonymized: boolean;
  };
}

// Example: Full enterprise event
{
  type: 'mission_complete',
  mission_id: 'm-xyz789',
  mission_name: 'E-commerce User Authentication',
  results: {
    success_rate: 0.92,
    total_tasks: 12,
    completed_tasks: 11,
    failed_tasks: 1,
    duration_ms: 3600000
  },
  federated_contribution: {
    patterns_discovered: [
      {
        pattern_name: 'supabase-react-auth-flow',
        description: 'Auth setup: RLS policies → Auth hooks → Protected routes → Session handling',
        skill_sequence: ['supabase-auth', 'frontend-design', 'react-state'],
        success_rate: 0.92,
        applies_to: ['authentication', 'react', 'supabase', 'spa']
      }
    ],
    skill_effectiveness: {
      'supabase-auth': { success_rate: 1.0, avg_iterations: 1.0, task_types: ['auth'] },
      'frontend-design': { success_rate: 0.9, avg_iterations: 1.2, task_types: ['ui'] },
      'drizzle-orm': { success_rate: 0.85, avg_iterations: 1.5, task_types: ['database'] }
    },
    team_synergy: {
      'supabase-auth + frontend-design': 0.94,
      'frontend-design + drizzle-orm': 0.88
    },
    gotchas: [
      {
        skill_id: 'supabase-auth',
        description: 'PKCE flow requires explicit redirect URL configuration',
        severity: 'warning',
        resolution: 'Add all valid redirect URLs in Supabase Auth settings before testing'
      }
    ]
  },
  privacy: {
    consent_level: 'patterns_only',
    pii_scrubbed: true,
    project_anonymized: true
  }
}
```

### Implementation Requirements (ENTERPRISE)

**Infrastructure:**
- All STANDARD requirements
- Federated aggregation service
- Differential privacy engine
- Cross-project analytics database
- Privacy compliance (GDPR, etc.)

**Claude Code Changes:**
- Include `federated_contribution` in mission_complete events
- Respect privacy consent levels
- Scrub PII before sending

**Spawner UI Changes:**
- Display collective intelligence insights
- Show skill effectiveness rankings
- Team composition recommendations
- Privacy consent controls

---

## Comparison Matrix

### Feature Comparison

| Feature | LITE | STANDARD | ENTERPRISE |
|---------|------|----------|------------|
| **Storage** | SQLite | PostgreSQL | Distributed |
| **Search** | Substring | Semantic (Vector) | Semantic + Collective |
| **Salience** | Manual | Auto-adjusted | Federated signals |
| **Decisions** | Basic | Full tracing | Predictive |
| **Outcomes** | Basic | Attributed | Aggregated |
| **Patterns** | Manual | Auto-extracted | Collective |
| **Cross-Agent** | ❌ | ✅ | ✅ |
| **Cross-Project** | ❌ | ❌ | ✅ |
| **Background Jobs** | ❌ | ✅ | ✅ |
| **Federation** | ❌ | ❌ | ✅ |
| **Privacy** | N/A | N/A | Differential |

### Intelligence Capability Comparison

| Intelligence Type | LITE | STANDARD | ENTERPRISE |
|-------------------|------|----------|------------|
| **Remember what worked** | ✅ | ✅ | ✅ |
| **Know why it worked** | ❌ | ✅ | ✅ |
| **Learn from teammates** | ❌ | ✅ | ✅ |
| **Learn from everyone** | ❌ | ❌ | ✅ |
| **Predict success** | ❌ | ⚠️ | ✅ |
| **Recommend skills** | ❌ | ⚠️ | ✅ |
| **Optimize teams** | ❌ | ❌ | ✅ |

### Setup Complexity

| Aspect | LITE | STANDARD | ENTERPRISE |
|--------|------|----------|------------|
| **Dependencies** | None | PostgreSQL, Embeddings | Cloud infra |
| **Setup Time** | 0 min | 30 min | Days |
| **Maintenance** | None | Low | High |
| **Cost** | Free | ~$20/mo | ~$200+/mo |

---

## Event Flow Architecture

### LITE: Direct Storage

```
Claude Code           Spawner UI              SQLite
    │                     │                     │
    │ learning event      │                     │
    ├────────────────────►│                     │
    │                     │ INSERT memory       │
    │                     ├────────────────────►│
    │                     │                     │
    │                     │◄────────────────────┤
    │                     │    OK               │
```

### STANDARD: Event-Driven Processing

```
Claude Code           Spawner UI         Event Bus       Background Workers
    │                     │                  │                   │
    │ decision_complete   │                  │                   │
    ├────────────────────►│                  │                   │
    │                     │ publish event    │                   │
    │                     ├─────────────────►│                   │
    │                     │                  │ consume           │
    │                     │                  ├──────────────────►│
    │                     │                  │                   │
    │                     │                  │    ┌──────────────┤
    │                     │                  │    │ Causal graph │
    │                     │                  │    │ Salience adj │
    │                     │                  │    │ Pattern ext  │
    │                     │                  │    └──────────────┤
    │                     │                  │                   │
```

### ENTERPRISE: Federated Processing

```
Claude Code      Spawner UI     Event Bus    Background    Federation
    │                │             │             │              │
    │ mission_complete             │             │              │
    ├───────────────►│             │             │              │
    │                │ publish     │             │              │
    │                ├────────────►│             │              │
    │                │             │ local proc  │              │
    │                │             ├────────────►│              │
    │                │             │             │              │
    │                │             │ federate    │              │
    │                │             ├─────────────┼─────────────►│
    │                │             │             │              │
    │                │             │             │   ┌──────────┤
    │                │             │             │   │ Privacy  │
    │                │             │             │   │ Aggregate│
    │                │             │             │   │ Patterns │
    │                │             │             │   └──────────┤
    │                │◄────────────┼─────────────┼──────────────┤
    │                │   collective insights     │              │
```

---

## Migration Path

### Phase 1: LITE → LITE+ (Now)

**Goal**: Rich events without infrastructure changes

1. Update Claude Code event format to include reasoning
2. Store structured learnings in SQLite
3. Display learnings grouped by skill/type
4. Manual pattern curation

**Effort**: 1-2 weeks

### Phase 2: LITE+ → STANDARD (Next)

**Goal**: Cross-agent learning with attribution

1. Add PostgreSQL + pgvector
2. Implement embedding service
3. Build causal graph tracking
4. Add background job runner
5. Auto-salience adjustment

**Effort**: 4-6 weeks

### Phase 3: STANDARD → ENTERPRISE (Future)

**Goal**: Collective intelligence

1. Federation service
2. Privacy engine
3. Cross-project aggregation
4. Predictive analytics
5. Team optimization

**Effort**: 3-6 months

---

## Immediate Action Items

### For LITE+ (Start Now)

1. **Update Claude Code Events**
   - [ ] Define rich learning event schema
   - [ ] Implement learning extraction after each task
   - [ ] Include reasoning in decision events
   - [ ] Tag with skill_id for retrieval

2. **Update Spawner UI**
   - [ ] Parse rich learning events
   - [ ] New "Learnings by Skill" view
   - [ ] Pattern library (manual curation)
   - [ ] Learning quality indicators

3. **Update Memory Client**
   - [ ] New `recordRichLearning()` method
   - [ ] Skill-based retrieval
   - [ ] Learning type filters

### Sample Event for Testing

```json
{
  "type": "learning",
  "content": "When setting up Drizzle with SQLite, always use synchronous mode for development to avoid connection pool issues",
  "learning_type": "gotcha",
  "skill_id": "drizzle-orm",
  "task_context": "Database setup for local development",
  "temporal_level": 3,
  "salience": 0.85,
  "evidence": {
    "what_happened": "Initial setup with async mode caused intermittent connection failures",
    "why_it_worked": "SQLite's file-based nature doesn't benefit from connection pooling locally",
    "alternatives_considered": ["WAL mode", "in-memory database"]
  }
}
```

---

## Appendix: Complete Event Schemas

See `MIND_EVENT_SCHEMAS.md` for full TypeScript interfaces and examples.

---

## Conclusion

Mind v5's potential is massive, but currently underutilized. By implementing rich events now (LITE+), we lay the foundation for team intelligence (STANDARD) and eventually collective wisdom (ENTERPRISE).

**The key insight**: Intelligence isn't about storing more data - it's about capturing the *reasoning* behind decisions and learning from outcomes. The current "Task executed" logs are telemetry, not intelligence.

**Start with rich events. Everything else builds from there.**
