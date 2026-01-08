# Mind v5 Unified Improvement System

## Executive Summary

A unified memory and improvement system that makes Spawner agents **self-aware** of their past experiences, enabling continuous improvement of skills, agents, teams, and workflows.

---

## Current Architecture Analysis

### What Already Exists (Excellent Foundation)

| Component | Status | Location |
|-----------|--------|----------|
| Decision Tracking | ✅ Full | `memory-client.ts:recordAgentDecision()` |
| Outcome Recording | ✅ Full | `memory-client.ts:recordTaskOutcome()` |
| Learning Extraction | ✅ Full | `memory-client.ts:recordLearning()` |
| Workflow Patterns | ✅ Full | `memory-client.ts:recordWorkflowPattern()` |
| Reinforcement | ✅ Full | `learning-reinforcement.ts` |
| Agent Effectiveness | ✅ Full | `memory-client.ts:getAgentEffectiveness()` |
| Temporal Hierarchy | ✅ Full | 4 levels (immediate → identity) |
| Metadata System | ✅ Rich | `AgentMemoryMetadata` interface |

### Current Mind v5 Lite Schema

```sql
memories (
  memory_id TEXT PRIMARY KEY,
  user_id TEXT,
  content TEXT,          -- Can include ---METADATA--- JSON block
  content_type TEXT,     -- Flexible: any string value
  temporal_level INT,    -- 1=immediate, 2=situational, 3=seasonal, 4=identity
  salience REAL,         -- 0.0 to 1.0
  retrieval_count INT,
  decision_count INT,
  positive_outcomes INT,
  negative_outcomes INT,
  created_at TEXT
)
```

### Existing Content Types

```typescript
// Agent Learning Types (currently used)
'agent_decision'          // Decision during mission
'agent_learning'          // Insight from outcomes
'workflow_pattern'        // Successful skill sequence
'task_outcome'            // Task result
'handoff_context'         // Agent-to-agent context
'skill_insight'           // Learning about skill
'decision_reinforcement'  // Reinforcement applied
'pattern_reinforcement'   // Pattern boost/penalize

// Base Types (available)
'fact' | 'preference' | 'event' | 'goal' | 'observation'
```

---

## Unified Tab System Design

### Tab Architecture

```
/mind
├── Learnings      → content_type: agent_learning, task_outcome, workflow_pattern
├── Decisions      → content_type: decision (NEW - user decisions)
├── Issues         → content_type: issue (NEW)
├── Sessions       → content_type: session (NEW)
└── Improvements   → content_type: *_improvement (NEW TAB)
```

### New Content Types for User-Facing Tabs

```typescript
// User-facing memory types
type UserContentType =
  | 'decision'              // User/project decisions (what + why)
  | 'issue'                 // Tracked issues (open/resolved)
  | 'session'               // Session summaries
  | 'skill_improvement'     // Skill getting better
  | 'agent_improvement'     // Agent getting better
  | 'team_improvement'      // Team composition learning
  | 'pipeline_improvement'  // Workflow optimization
```

### Data Flow: All Tabs → Mind v5

```
┌─────────────────────────────────────────────────────────────┐
│                        Mind v5 Lite                         │
│                    (SQLite Database)                        │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  Learnings  │ │  Decisions  │ │   Issues    │           │
│  │ agent_learn │ │  decision   │ │   issue     │           │
│  │ task_outcom │ │             │ │             │           │
│  │ workflow_pa │ │             │ │             │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                             │
│  ┌─────────────┐ ┌─────────────────────────────────────┐   │
│  │  Sessions   │ │           Improvements              │   │
│  │   session   │ │  skill_improvement                  │   │
│  │             │ │  agent_improvement                  │   │
│  │             │ │  team_improvement                   │   │
│  │             │ │  pipeline_improvement               │   │
│  └─────────────┘ └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Improvement Tracking System

### 1. Skill Improvements

**When tracked:** After missions using the skill complete

```typescript
interface SkillImprovement {
  content_type: 'skill_improvement';
  content: string;  // "Skill 'commit' success rate improved from 65% to 78%"
  metadata: {
    skill_id: string;
    skill_name: string;

    // Performance metrics
    previous_success_rate: number;
    current_success_rate: number;
    improvement_delta: number;

    // Usage stats
    total_uses: number;
    successful_uses: number;
    failed_uses: number;

    // Context
    best_paired_with: string[];      // Skills that work well together
    worst_paired_with: string[];     // Skills that cause issues
    optimal_position: 'start' | 'middle' | 'end';  // Best position in workflow

    // Learnings
    key_learnings: string[];         // Top insights about this skill
    common_failures: string[];       // What causes failures

    improvement_type: 'success_rate' | 'speed' | 'quality' | 'reliability';
  };
  temporal_level: 3;  // Seasonal - persists
  salience: 0.8;
}
```

**Example:**
```json
{
  "content": "Skill 'code-review' improved: success rate 72% → 85% (+13%)",
  "content_type": "skill_improvement",
  "metadata": {
    "skill_id": "code-review",
    "previous_success_rate": 0.72,
    "current_success_rate": 0.85,
    "improvement_delta": 0.13,
    "total_uses": 47,
    "best_paired_with": ["commit", "testing"],
    "key_learnings": ["Works best after testing completes", "Needs clear PR description"]
  }
}
```

### 2. Agent Improvements

**When tracked:** Aggregated from decision outcomes

```typescript
interface AgentImprovement {
  content_type: 'agent_improvement';
  content: string;  // "Agent 'Frontend Developer' is 23% more effective this week"
  metadata: {
    agent_id: string;
    agent_name: string;
    agent_role: string;

    // Performance over time
    period: 'daily' | 'weekly' | 'monthly';
    previous_effectiveness: number;
    current_effectiveness: number;
    improvement_delta: number;

    // Skill mastery
    skills_improving: string[];
    skills_declining: string[];
    strongest_skill: string;
    weakest_skill: string;

    // Decision quality
    decision_accuracy: number;      // How often decisions lead to success
    confidence_calibration: number; // How well confidence matches outcomes

    // Collaboration
    best_handoff_partners: string[];    // Agents they work well with
    problematic_handoffs: string[];     // Agents causing issues

    // Recommendations
    suggested_training: string[];       // Skills to improve
    optimal_task_types: string[];       // What they're best at
  };
  temporal_level: 3;
  salience: 0.85;
}
```

### 3. Team Improvements

**When tracked:** After multi-agent missions

```typescript
interface TeamImprovement {
  content_type: 'team_improvement';
  content: string;  // "Team 'Full-Stack Squad' coordination improved by 18%"
  metadata: {
    team_id: string;
    team_name: string;
    agent_ids: string[];

    // Team performance
    previous_success_rate: number;
    current_success_rate: number;
    improvement_delta: number;

    // Composition insights
    synergy_score: number;              // How well agents work together
    bottleneck_agent: string | null;    // Agent slowing things down
    star_performer: string;             // Most effective agent

    // Communication patterns
    handoff_efficiency: number;         // Clean handoffs vs fumbled
    context_preservation: number;       // How much context survives handoffs

    // Recommendations
    suggested_additions: string[];      // Skills/agents to add
    suggested_removals: string[];       // What's not working
    optimal_task_flow: string[];        // Best task ordering
  };
  temporal_level: 3;
  salience: 0.9;
}
```

### 4. Pipeline/Workflow Improvements

**When tracked:** After workflow executions

```typescript
interface PipelineImprovement {
  content_type: 'pipeline_improvement';
  content: string;  // "Workflow 'Feature Development' optimized: 15% faster"
  metadata: {
    pipeline_id: string;
    pipeline_name: string;
    skill_sequence: string[];

    // Performance metrics
    previous_avg_duration: number;
    current_avg_duration: number;
    improvement_delta: number;

    // Success tracking
    success_rate: number;
    failure_points: Array<{
      skill_id: string;
      failure_rate: number;
      common_reasons: string[];
    }>;

    // Optimization insights
    bottleneck_skills: string[];        // Skills slowing things down
    parallelizable_steps: string[][];   // Steps that could run in parallel
    removable_steps: string[];          // Unnecessary steps

    // Pattern recognition
    similar_successful_patterns: string[];  // Other workflows that work well
    anti_patterns_detected: string[];       // What to avoid
  };
  temporal_level: 3;
  salience: 0.85;
}
```

---

## Improvement Tab UI Design

```
┌─────────────────────────────────────────────────────────────────────┐
│ Mind > Improvements                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─── Filter ───┐  ┌─── Time Range ───┐  ┌─── Sort ───┐            │
│  │ All Types  ▼ │  │ Last 7 days    ▼ │  │ Biggest ▼  │            │
│  └──────────────┘  └──────────────────┘  └────────────┘            │
│                                                                     │
│  ╔═══════════════════════════════════════════════════════════════╗ │
│  ║  📈 Overall Improvement Score: +12% this week                 ║ │
│  ║  ████████████████████░░░░░░░░  72% → 84%                      ║ │
│  ╚═══════════════════════════════════════════════════════════════╝ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ⚡ SKILLS                                        +8% avg    │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ┌─────────────────────────────────────────────────────────┐ │   │
│  │ │ code-review     72% → 85%  ████████████████░░  +13%    │ │   │
│  │ │ Used 47 times   Best with: commit, testing              │ │   │
│  │ └─────────────────────────────────────────────────────────┘ │   │
│  │ ┌─────────────────────────────────────────────────────────┐ │   │
│  │ │ commit          88% → 91%  ██████████████████░  +3%     │ │   │
│  │ │ Used 89 times   Star performer                          │ │   │
│  │ └─────────────────────────────────────────────────────────┘ │   │
│  │ ┌─────────────────────────────────────────────────────────┐ │   │
│  │ │ testing         65% → 62%  ████████████░░░░░░  -3% ⚠️   │ │   │
│  │ │ Used 23 times   Needs attention                         │ │   │
│  │ └─────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🤖 AGENTS                                        +15% avg   │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Frontend Agent    78% → 89%  ███████████████████░  +11%    │   │
│  │ Backend Agent     82% → 85%  █████████████████░░░  +3%     │   │
│  │ Testing Agent     70% → 68%  ██████████████░░░░░░  -2% ⚠️  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 👥 TEAMS                                         +18% avg   │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Full-Stack Squad  71% → 89%  ███████████████████░  +18%    │   │
│  │ 3 agents, 12 missions, synergy: excellent                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 🔄 WORKFLOWS                                     +22% avg   │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ Feature Development  avg 12m → 9m  ██████████████░░  -25%  │   │
│  │ Bug Fix Pipeline     avg 8m → 6m   ██████████████░░  -25%  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## AGI-Style Self-Improvement Loop

### The Feedback Cycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AGI IMPROVEMENT CYCLE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│    ┌──────────────┐                                                │
│    │   EXECUTE    │  Agent runs task using skill                   │
│    └──────┬───────┘                                                │
│           ↓                                                         │
│    ┌──────────────┐                                                │
│    │   OBSERVE    │  Record decision + outcome                     │
│    └──────┬───────┘                                                │
│           ↓                                                         │
│    ┌──────────────┐                                                │
│    │   REFLECT    │  Compare outcome to confidence                 │
│    └──────┬───────┘  Was agent calibrated correctly?              │
│           ↓                                                         │
│    ┌──────────────┐                                                │
│    │   REINFORCE  │  Boost or penalize based on outcome            │
│    └──────┬───────┘                                                │
│           ↓                                                         │
│    ┌──────────────┐                                                │
│    │   EXTRACT    │  Generate improvement records                  │
│    └──────┬───────┘  skill_improvement, agent_improvement, etc.   │
│           ↓                                                         │
│    ┌──────────────┐                                                │
│    │   REMEMBER   │  Store in Mind v5 (temporal level 3+)         │
│    └──────┬───────┘                                                │
│           ↓                                                         │
│    ┌──────────────┐                                                │
│    │   RETRIEVE   │  Next execution queries past learnings        │
│    └──────┬───────┘                                                │
│           ↓                                                         │
│    ┌──────────────┐                                                │
│    │    ADAPT     │  Agent adjusts behavior based on memory        │
│    └──────┬───────┘                                                │
│           │                                                         │
│           └─────────────────→ Back to EXECUTE                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Memory-Aware Agent Prompting

**Before task execution, agents receive context:**

```typescript
async function getAgentContext(agentId: string, taskDescription: string): Promise<string> {
  // 1. Get agent's past effectiveness
  const effectiveness = await memoryClient.getAgentEffectiveness(agentId);

  // 2. Get relevant learnings for this task
  const learnings = await memoryClient.getRelevantLearnings(taskDescription, {
    agentId,
    limit: 5
  });

  // 3. Get skill improvements for skills agent will use
  const skillImprovements = await getSkillImprovements(agentId);

  // 4. Get workflow patterns that worked
  const patterns = await memoryClient.getWorkflowPatterns(taskDescription);

  return `
## Your Performance Context

**Success Rate:** ${effectiveness.success_rate * 100}% (${effectiveness.total_decisions} decisions)
**Strongest Skill:** ${effectiveness.top_skills[0]?.skill_id}
**Areas to Improve:** ${effectiveness.top_skills.slice(-1)[0]?.skill_id}

## Relevant Past Learnings
${learnings.map(l => `- ${l.content} (confidence: ${l.metadata?.confidence})`).join('\n')}

## What Works for This Type of Task
${patterns.map(p => `- ${p.name}: ${p.metadata?.workflow_sequence?.join(' → ')}`).join('\n')}

## Recent Improvements
${skillImprovements.map(s => `- ${s.skill_id}: ${s.improvement_delta > 0 ? '+' : ''}${s.improvement_delta}%`).join('\n')}
  `;
}
```

### Improvement Generation Logic

```typescript
// After mission completes
async function generateImprovements(mission: Mission, outcomes: TaskOutcome[]) {
  const skillStats = aggregateBySkill(outcomes);
  const agentStats = aggregateByAgent(outcomes);
  const teamStats = calculateTeamMetrics(mission.agents, outcomes);

  // 1. Skill Improvements
  for (const [skillId, stats] of skillStats) {
    const previous = await getSkillHistory(skillId, '7d');
    const delta = stats.successRate - previous.successRate;

    if (Math.abs(delta) >= 0.05) {  // 5% threshold
      await memoryClient.createMemory({
        content: `Skill '${skillId}' ${delta > 0 ? 'improved' : 'declined'}: ` +
                 `${previous.successRate}% → ${stats.successRate}% (${delta > 0 ? '+' : ''}${delta}%)`,
        content_type: 'skill_improvement',
        temporal_level: TEMPORAL_LEVELS.SEASONAL,
        salience: 0.8,
        metadata: {
          skill_id: skillId,
          previous_success_rate: previous.successRate,
          current_success_rate: stats.successRate,
          improvement_delta: delta,
          total_uses: stats.totalUses,
          key_learnings: extractKeyLearnings(skillId, outcomes)
        }
      });
    }
  }

  // 2. Agent Improvements (similar pattern)
  // 3. Team Improvements (similar pattern)
  // 4. Pipeline Improvements (similar pattern)
}
```

---

## Implementation Plan

### Phase 1: Unify Tabs to Mind v5 (Week 1)

**Files to modify:**
- `src/lib/stores/mind.svelte.ts` - Use memoryClient for decisions/issues/sessions
- `src/routes/mind/+page.svelte` - Update data loading

**New content types:**
```typescript
'decision'  // For Decisions tab
'issue'     // For Issues tab
'session'   // For Sessions tab
```

**API calls:**
```typescript
// Decisions
await memoryClient.createMemory({
  content: JSON.stringify({ what, why }),
  content_type: 'decision',
  temporal_level: 3,
  salience: 0.8
});

// Issues
await memoryClient.createMemory({
  content: description,
  content_type: 'issue',
  metadata: { status: 'open' | 'resolved' }
});

// Sessions
await memoryClient.createMemory({
  content: summary,
  content_type: 'session',
  temporal_level: 2
});
```

### Phase 2: Add Improvements Tab (Week 2)

**New files:**
- `src/lib/components/ImprovementsPanel.svelte`
- `src/lib/components/SkillImprovementCard.svelte`
- `src/lib/components/AgentImprovementCard.svelte`
- `src/lib/components/TeamImprovementCard.svelte`
- `src/lib/services/improvement-tracker.ts`

**New content types:**
```typescript
'skill_improvement'
'agent_improvement'
'team_improvement'
'pipeline_improvement'
```

### Phase 3: Auto-Generate Improvements (Week 3)

**Integrate with mission executor:**
- After mission complete → analyze outcomes
- Generate improvement records for skills/agents/teams
- Store in Mind v5 with rich metadata

**Memory-aware prompting:**
- Before task start → query relevant memories
- Inject context into agent system prompt
- Track which memories influenced decisions

### Phase 4: Self-Improvement Dashboard (Week 4)

**Visualization:**
- Improvement trends over time (charts)
- Skill/agent/team comparison
- Recommendations engine
- "What's getting better" highlights

---

## Content Type Summary

| Tab | Content Type | Temporal Level | Purpose |
|-----|--------------|----------------|---------|
| Learnings | `agent_learning` | 3 | Agent insights |
| Learnings | `task_outcome` | 2 | Task results |
| Learnings | `workflow_pattern` | 3 | Successful sequences |
| Decisions | `decision` | 3 | User decisions |
| Issues | `issue` | 2 | Problem tracking |
| Sessions | `session` | 2 | Session summaries |
| Improvements | `skill_improvement` | 3 | Skill performance |
| Improvements | `agent_improvement` | 3 | Agent effectiveness |
| Improvements | `team_improvement` | 3 | Team coordination |
| Improvements | `pipeline_improvement` | 3 | Workflow optimization |

---

## Success Metrics

1. **Data Unification**
   - All tabs load from Mind v5 ✓
   - No dependency on Spawner MCP for basic data ✓
   - Consistent data format across tabs ✓

2. **Self-Improvement**
   - Improvements generated after each mission
   - Agents receive memory context before tasks
   - Measurable improvement deltas tracked

3. **User Value**
   - Clear visibility into what's improving
   - Actionable recommendations
   - Historical trends visible

---

## Conclusion

This system transforms Spawner from a workflow tool into a **learning system** where:

1. Every execution generates learnings
2. Every learning influences future executions
3. Users see what's improving (and what isn't)
4. Agents become genuinely better over time

The foundation already exists - we're connecting the dots and exposing the improvement loop to users.
