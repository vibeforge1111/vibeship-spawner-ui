# Mind Improvement Plan for Spawner UI

> Making Mind the intelligence layer that makes everything smarter over time

## Vision

Mind isn't just a memory store - it's the **collective intelligence** of your agent ecosystem. Every mission completed, every handoff made, every outcome measured feeds back into making the next mission better. Mind should feel like a living brain that:

- **Learns** from every interaction
- **Remembers** what works and what doesn't
- **Connects** patterns across projects, skills, and teams
- **Recommends** based on accumulated wisdom
- **Improves** through external feedback loops

---

## Core Learning Dimensions

### 1. Individual Learning (Agent/Skill Level)
What each specialist learns from their work.

```
Example: "Texture Art agent learned that 512x512 textures work better
for mobile games than 1024x1024 - based on 15 missions"
```

**Current state**: Partially implemented (agent_learning, agent_decision)
**Enhancement**: Better categorization, confidence tracking, skill association display

---

### 2. Team Learning (Collaboration Level)
How combinations of agents/skills work together.

```
Example: "Game Design + Texture Art + VFX team achieves 85% success rate
when Game Design provides style guides before handoff"
```

**Key insights to track**:
- Which skill combos have chemistry
- Optimal handoff patterns between skills
- What context helps the receiving agent succeed
- Parallel vs sequential collaboration effectiveness
- Conflict patterns and resolutions

**Data structure**:
```typescript
interface TeamLearning {
  team_id: string;
  members: string[];              // ['game-design', 'texture-art', 'vfx']
  collaboration_type: 'sequential' | 'parallel' | 'iterative';

  // Performance metrics
  formation_count: number;        // Times this team worked together
  success_rate: number;           // 0.0 - 1.0
  avg_completion_time?: number;   // In minutes

  // Learned patterns
  effective_handoffs: HandoffPattern[];
  recommended_for: string[];      // Task types this team excels at

  // Growth tracking
  first_collaboration: string;    // Date
  last_collaboration: string;
  improvement_trend: number;      // Positive = getting better
}

interface HandoffPattern {
  from_skill: string;
  to_skill: string;
  context_provided: string[];     // What info helps
  success_rate: number;
  learned_tip: string;            // "Always include color palette"
}
```

---

### 3. Project Learning (Mission Level)
What we learned from specific projects that applies to similar future projects.

```
Example: "Mobile game projects need art-consistency checks after every
visual asset task - learned from Pixel Monster Hunter mission"
```

**Key insights to track**:
- Decisions made and their outcomes
- Unexpected challenges encountered
- What would we do differently
- Reusable patterns for similar projects

**Data structure**:
```typescript
interface ProjectLearning {
  project_id: string;
  project_name: string;
  project_type: string;           // 'game', 'marketing', 'saas', 'tool'

  // Context
  goal_summary: string;
  skills_used: string[];
  total_tasks: number;
  completion_status: 'success' | 'partial' | 'failed';

  // Learnings
  key_decisions: Decision[];
  challenges_faced: Challenge[];
  what_worked: string[];
  what_didnt: string[];

  // For future projects
  applies_to: string[];           // Project types this learning helps
  recommendations: string[];
}
```

---

### 4. System Learning (Cross-Project Patterns)
Patterns that emerge across many projects and improve the entire system.

```
Example: "Marketing campaigns that run content-strategy before
creative-production have 40% higher engagement across all projects"
```

**Key insights to track**:
- Universal best practices
- Anti-patterns to avoid
- Optimal skill orderings
- Resource allocation patterns

---

## Feedback Loop Architecture

This is where Mind becomes truly intelligent - learning from real-world outcomes.

### Feedback Sources

```typescript
interface FeedbackSource {
  id: string;
  name: string;
  type: 'mcp' | 'api' | 'webhook' | 'manual';

  // What this source measures
  capabilities: FeedbackCapability[];

  // Connection details
  endpoint?: string;
  mcp_tool?: string;
  auth_method?: 'none' | 'api_key' | 'oauth';

  // Status
  connected: boolean;
  last_ping?: string;
}

type FeedbackCapability =
  | 'engagement'      // Social metrics, views, clicks
  | 'security'        // Vulnerability scans, code analysis
  | 'performance'     // Load times, efficiency metrics
  | 'quality'         // Test coverage, bug counts
  | 'user_behavior'   // Analytics, usage patterns
  | 'revenue'         // Sales, conversions
  | 'sentiment'       // Reviews, feedback
  | 'compliance';     // Regulatory checks
```

### Feedback Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         MISSION COMPLETES                        │
│                              │                                   │
│                              ▼                                   │
│                    ┌─────────────────┐                          │
│                    │  Store Outputs  │                          │
│                    │  & Decisions    │                          │
│                    └────────┬────────┘                          │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│     ┌────────────┐   ┌────────────┐   ┌────────────┐           │
│     │  Security  │   │ Analytics  │   │ Engagement │           │
│     │   Scan     │   │    API     │   │   Tracker  │           │
│     └─────┬──────┘   └─────┬──────┘   └─────┬──────┘           │
│           │                │                │                   │
│           └────────────────┼────────────────┘                   │
│                            ▼                                    │
│                  ┌─────────────────┐                            │
│                  │ Feedback Result │                            │
│                  │   Processing    │                            │
│                  └────────┬────────┘                            │
│                           │                                     │
│              ┌────────────┼────────────┐                        │
│              ▼            ▼            ▼                        │
│     ┌─────────────┐ ┌──────────┐ ┌──────────────┐              │
│     │   Update    │ │  Adjust  │ │   Surface    │              │
│     │  Learning   │ │Confidence│ │   Insights   │              │
│     │  Outcomes   │ │  Levels  │ │  to User     │              │
│     └─────────────┘ └──────────┘ └──────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Example Feedback Integrations

| Domain | Feedback Source | Metrics | Learning Impact |
|--------|----------------|---------|-----------------|
| Marketing | Social APIs | Engagement, reach, clicks | "This content style performs 2x better" |
| Code | Security scanners (Trivy, Gitleaks) | Vulnerabilities, secrets | "This pattern introduces SQL injection risk" |
| Games | Analytics SDK | Play time, retention, IAP | "Tutorial completion improves with X approach" |
| Content | SEO tools | Rankings, traffic | "Long-form content ranks better for this topic" |
| Products | Usage analytics | Feature adoption, churn | "Users don't discover this feature" |

### Feedback Result Structure

```typescript
interface FeedbackResult {
  id: string;
  source_id: string;
  received_at: string;

  // What was measured
  target_type: 'output' | 'decision' | 'pattern';
  target_id: string;

  // Results
  metrics: Record<string, number>;
  raw_data?: any;

  // Interpretation
  interpretation: string;         // AI-generated insight
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence_impact: number;      // -1.0 to +1.0

  // Actions taken
  learnings_updated: string[];    // Memory IDs affected
  patterns_reinforced: string[];
  alerts_generated?: string[];
}
```

---

## Enhanced Metadata Schema

Unified metadata structure for all memory types:

```typescript
interface EnhancedMemoryMetadata {
  // === Identity ===
  agent_id?: string;
  agent_name?: string;
  skill_id?: string;
  skill_name?: string;

  // === Project Context ===
  project_id?: string;
  project_name?: string;
  project_type?: ProjectType;     // 'game' | 'marketing' | 'saas' | 'tool' | etc.
  mission_id?: string;
  task_id?: string;

  // === Team Context ===
  team_id?: string;
  team_members?: string[];        // Skill IDs that collaborated
  collaboration_type?: 'sequential' | 'parallel' | 'iterative';
  handoff_from?: string;          // Previous skill in chain
  handoff_to?: string;            // Next skill in chain

  // === Classification ===
  category?: LearningCategory;
  tags?: string[];
  pattern_type?: 'success' | 'failure' | 'optimization' | 'discovery';

  // === Confidence & Reinforcement ===
  confidence: number;             // 0.0 - 1.0
  reinforcement_count: number;    // Times this pattern was seen
  last_reinforced?: string;       // ISO date
  decay_rate?: number;            // How fast confidence fades without reinforcement

  // === Feedback Tracking ===
  feedback_pending?: boolean;
  feedback_sources?: string[];    // Connected feedback source IDs
  feedback_results?: FeedbackResult[];

  // === Impact Tracking ===
  times_applied?: number;         // How often this learning was used
  success_when_applied?: number;  // Success rate when applied
  impact_score?: number;          // Calculated importance

  // === Reasoning ===
  reasoning?: string;             // Why this was learned
  decision_context?: string;      // What led to this decision
  outcome?: 'success' | 'failure' | 'pending';
  outcome_details?: string;
}

type LearningCategory =
  | 'technical'      // Code, architecture, implementation
  | 'process'        // Workflow, methodology
  | 'collaboration'  // Team dynamics, handoffs
  | 'quality'        // Standards, consistency
  | 'performance'    // Speed, efficiency
  | 'user_impact';   // End-user outcomes
```

---

## UI Components

### 1. Mind Dashboard (Enhanced Home)

```
┌─────────────────────────────────────────────────────────────────┐
│  Mind                                              [Settings]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐ │
│  │  Learnings   │ │    Teams     │ │   Projects   │ │Feedback │ │
│  │     127      │ │      8       │ │      23      │ │   12    │ │
│  │   +5 today   │ │  85% avg     │ │   Active: 3  │ │ pending │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘ │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│  Intelligence Insights                              [View All]   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ⚡ Team "Design+Art+Dev" has improved 15% over last 5       ││
│  │    missions - consider using for similar game projects      ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ⚠️  Security scans flagged 3 patterns from recent code      ││
│  │    generation - review and update learnings                 ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ✓  Marketing content engagement up 40% after applying      ││
│  │    "audience-first" learning from last campaign             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Recent Learnings                    [Filter ▼] [By Project ▼]  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ + [game-design] Style guides in handoffs improve outcomes   ││
│  │   Project: Pixel Monster Hunter │ Confidence: 85% │ 2h ago  ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ! [security] Avoid string concatenation in SQL queries      ││
│  │   Project: SaaS Dashboard │ Feedback: Trivy │ 5h ago        ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ * [marketing] Short-form video outperforms static images    ││
│  │   Project: Product Launch │ Feedback: Analytics │ 1d ago    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Team Insights Panel

```
┌─────────────────────────────────────────────────────────────────┐
│  Team Insights                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Top Performing Teams                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🏆 Game Design → Texture Art → VFX                          ││
│  │    Success: 92% │ Missions: 12 │ Trend: ↑                   ││
│  │    Best for: Visual-heavy game projects                     ││
│  │    Key insight: Include color palette in every handoff      ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ 🥈 Content Strategy → Blog Writing → SEO                    ││
│  │    Success: 88% │ Missions: 8 │ Trend: →                    ││
│  │    Best for: Content marketing campaigns                    ││
│  │    Key insight: Keyword research before writing improves    ││
│  │    rankings by 3x                                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Collaboration Patterns                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │    [Game Design]──(style guide)──>[Texture Art]             ││
│  │         │                              │                     ││
│  │         │                              │                     ││
│  │    (mechanics)                    (assets)                   ││
│  │         │                              │                     ││
│  │         ▼                              ▼                     ││
│  │    [Game Dev] <────(integration)────[VFX]                   ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Recommended Team for New Task                                   │
│  Task: "Build mobile puzzle game"                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Suggested: Game Design + UI Design + Mobile Game Dev        ││
│  │ Confidence: 78% │ Based on: 5 similar projects              ││
│  │ [Use This Team]                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Project Memory View

```
┌─────────────────────────────────────────────────────────────────┐
│  Project: Pixel Monster Hunter                    [Export] [🔗]  │
│  Type: Game │ Status: Completed │ Duration: 3 days              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Skills Used                                                     │
│  [Game Design] [Hand Gesture] [UI Design] [Voxel Art] [VFX]     │
│  [Viral Marketing] [Game Dev]                                    │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│  Key Decisions                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ✓ Used MediaPipe for hand tracking (vs TensorFlow.js)       ││
│  │   Why: Better mobile performance, smaller bundle            ││
│  │   Outcome: Successful - 60fps on mid-range devices          ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ✓ Voxel style for monsters (vs 2D sprites)                  ││
│  │   Why: Unique aesthetic, easier to animate                  ││
│  │   Outcome: Positive user feedback on art style              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Learnings Generated                                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ + Hand gesture games need clear visual feedback             ││
│  │ + Voxel art renders faster than expected on mobile          ││
│  │ ! Initial gesture calibration confused users - add tutorial ││
│  │ * Viral sharing works better with GIF captures than video   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Applies To Future Projects                                      │
│  [Mobile Games] [Gesture Control] [Casual Games] [Viral Apps]   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Feedback Center

```
┌─────────────────────────────────────────────────────────────────┐
│  Feedback Center                                    [+ Connect]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Connected Sources                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ 🔒 Trivy     │ │ 📊 Plausible│ │ 🐦 Twitter   │            │
│  │ Security     │ │ Analytics   │ │ Engagement   │            │
│  │ ● Connected  │ │ ● Connected │ │ ○ Configure  │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                  │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│  Pending Feedback (12)                             [Process All] │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🔒 Security scan completed for "SaaS Dashboard"             ││
│  │    2 high, 5 medium vulnerabilities found                   ││
│  │    [Review & Learn]                                         ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ 📊 Analytics update for "Product Launch Campaign"           ││
│  │    CTR: 4.2% (above average) │ Conversions: 127             ││
│  │    [Review & Learn]                                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Recent Feedback Impact                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Learning: "Use parameterized queries"                       ││
│  │ ├─ Confidence: 65% → 95% (+30%)                            ││
│  │ ├─ Source: Trivy security scan                             ││
│  │ └─ Impact: Blocked 3 potential SQL injection patterns      ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ Learning: "Short-form video for social"                     ││
│  │ ├─ Confidence: 70% → 85% (+15%)                            ││
│  │ ├─ Source: Twitter Analytics                               ││
│  │ └─ Impact: 2.3x more engagement than image posts           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Learning Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│  Learning Detail                                        [Edit]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  + "Style guides in handoffs improve texture art outcomes"       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Confidence  ████████████████░░░░  85%                       ││
│  │ Reinforced  12 times │ Last: 2 hours ago                    ││
│  │ Applied     8 times │ Success rate: 92%                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Context                                                         │
│  ├─ Category: Collaboration                                     │
│  ├─ Skills: Game Design → Texture Art                           │
│  ├─ Pattern Type: Success                                       │
│  └─ Tags: #handoffs #art #game-dev                              │
│                                                                  │
│  Origin                                                          │
│  ├─ First observed: Pixel Monster Hunter (Jan 5, 2026)          │
│  ├─ Agent: game-design-agent                                    │
│  └─ Reasoning: "Noticed 3x fewer revision requests when         │
│     style guides were included in handoff context"              │
│                                                                  │
│  Reinforcement History                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Jan 7 │ Mobile Puzzle Game    │ Applied │ ✓ Success        ││
│  │ Jan 6 │ Voxel Adventure       │ Applied │ ✓ Success        ││
│  │ Jan 6 │ Casual Runner         │ Applied │ ✓ Success        ││
│  │ Jan 5 │ Pixel Monster Hunter  │ Origin  │ ✓ Success        ││
│  │ ...                                                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Feedback Received                                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ No external feedback yet                                    ││
│  │ [Request Feedback] [Add Manual Feedback]                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Related Learnings                                               │
│  ├─ "Color palettes reduce back-and-forth by 50%"              │
│  ├─ "Reference images help more than text descriptions"        │
│  └─ "Art consistency checks catch issues early"                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Current Sprint)
**Goal**: Better display of existing data

- [ ] Enhance learning cards with project/skill context
- [ ] Add category badges and tags
- [ ] Show confidence levels visually
- [ ] Add reinforcement count display
- [ ] Improve filtering (by project, skill, category)
- [ ] Add learning detail view

### Phase 2: Team Intelligence
**Goal**: Track and display team collaboration patterns

- [ ] Create TeamLearning data structure
- [ ] Track team formations during missions
- [ ] Calculate team success rates
- [ ] Build Team Insights panel
- [ ] Add handoff pattern visualization
- [ ] Implement team recommendations

### Phase 3: Project Memory
**Goal**: Per-project learning views

- [ ] Create ProjectLearning data structure
- [ ] Link learnings to projects
- [ ] Build Project Memory view
- [ ] Add decision tracking with outcomes
- [ ] Implement "applies to" tagging
- [ ] Add project comparison view

### Phase 4: Feedback Loops
**Goal**: External feedback integration

- [ ] Define FeedbackSource interface
- [ ] Build Feedback Center UI
- [ ] Implement MCP tool connectors:
  - [ ] Security scanners (Trivy, Gitleaks)
  - [ ] Analytics APIs
  - [ ] Social engagement trackers
- [ ] Create feedback processing pipeline
- [ ] Auto-update confidence based on feedback
- [ ] Surface insights from feedback

### Phase 5: Intelligence Layer
**Goal**: Cross-project insights and recommendations

- [ ] Build pattern correlation engine
- [ ] Implement recommendation system
- [ ] Create Intelligence Insights panel
- [ ] Add trend analysis
- [ ] Build weekly/monthly reports
- [ ] Implement proactive suggestions

---

## Technical Considerations

### Database Schema Updates

The Lite tier stores metadata as JSON in content. For these features, we may need:

1. **Enhanced metadata encoding** - Ensure all new fields serialize properly
2. **Index-friendly queries** - Consider adding content_type-based listing
3. **Aggregation support** - Team stats, project summaries

### Performance

- Lazy load team/project data
- Cache frequently accessed patterns
- Paginate large learning lists
- Background process feedback results

### API Additions Needed

```typescript
// New endpoints for Mind API
GET  /v1/teams                    // List team formations
GET  /v1/teams/:id/learnings      // Team-specific learnings
GET  /v1/projects/:id/memory      // Project memory summary
POST /v1/feedback                 // Submit feedback result
GET  /v1/insights                 // Get AI-generated insights
POST /v1/learnings/:id/reinforce  // Manually reinforce a learning
```

---

## Success Metrics

How we'll know Mind is working:

1. **Learning Utilization** - % of learnings that get applied
2. **Confidence Accuracy** - Do high-confidence learnings succeed?
3. **Team Improvement** - Do teams get better over time?
4. **Feedback Loop Closure** - Time from output to feedback to learning
5. **User Engagement** - Do users reference Mind insights?
6. **Recommendation Accuracy** - Are team/approach suggestions helpful?

---

## Open Questions

1. **Privacy**: How to handle learnings that contain sensitive project info?
2. **Decay**: Should old learnings lose confidence over time?
3. **Conflicts**: What happens when learnings contradict each other?
4. **Sharing**: Can teams share learnings across organizations?
5. **Export**: How to export/import Mind state between environments?

---

## Next Steps

1. Review this plan and prioritize features
2. Start Phase 1 implementation
3. Design API changes needed for Phase 2+
4. Identify MCP tools for feedback integration
5. Create UI mockups for new panels

---

*This is a living document. Update as we learn more about what users need.*
