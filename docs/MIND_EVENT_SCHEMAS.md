# Mind Event Schemas

> Complete TypeScript interfaces for Claude Code → Spawner UI communication

---

## Overview

This document defines the event schemas for each Mind tier. Claude Code sends these events; Spawner UI receives and processes them.

---

## Base Types

```typescript
// Temporal levels for memory persistence
type TemporalLevel = 1 | 2 | 3 | 4;
// 1 = Working (hours)
// 2 = Recent (days)
// 3 = Reference (weeks/months)
// 4 = Identity (permanent)

// Learning categories
type LearningType =
  | 'success_pattern'      // Something that worked well
  | 'failure_lesson'       // Something that didn't work
  | 'gotcha'               // Non-obvious issue encountered
  | 'user_preference'      // User-specific insight
  | 'skill_insight'        // Skill-specific knowledge
  | 'collaboration_note'   // Cross-agent insight
  | 'optimization'         // Performance/efficiency insight
  | 'architecture'         // Structural decision
  | 'code_pattern';        // Reusable code approach

// Outcome signals
type OutcomeSignal = 'positive' | 'neutral' | 'negative';

// Improvement types
type ImprovementType = 'skill' | 'agent' | 'team' | 'pipeline';

// Severity levels
type Severity = 'info' | 'warning' | 'critical';
```

---

## LITE Tier Events

### Learning Event

The primary event for capturing intelligence in LITE tier.

```typescript
interface LiteLearningEvent {
  type: 'learning';

  // ============================================
  // REQUIRED: The actual insight
  // ============================================

  /** The learning content - MUST be specific, not generic
   *  BAD:  "Task completed successfully"
   *  GOOD: "Early returns prevent deep nesting in async handlers"
   */
  content: string;

  /** Category of this learning */
  learning_type: LearningType;

  // ============================================
  // CONTEXT: Where this learning came from
  // ============================================

  /** H70 skill that produced this learning */
  skill_id?: string;

  /** Task description for context */
  task_context?: string;

  /** Mission ID for grouping */
  mission_id?: string;

  /** Agent that produced this learning */
  agent_id?: string;

  // ============================================
  // IMPORTANCE: How valuable is this learning
  // ============================================

  /** How long should this persist (1-4) */
  temporal_level: TemporalLevel;

  /** How important is this (0.0 to 1.0) */
  salience: number;

  // ============================================
  // EVIDENCE: Why should we trust this
  // ============================================

  evidence?: {
    /** What happened that led to this learning */
    what_happened: string;

    /** Why did this approach work/fail */
    why_it_worked?: string;

    /** Other options that were considered */
    alternatives_considered?: string[];

    /** Code snippet demonstrating the pattern (if applicable) */
    code_example?: string;
  };
}

// ============================================
// EXAMPLES
// ============================================

// Example 1: Success pattern
const successPattern: LiteLearningEvent = {
  type: 'learning',
  content: 'Zod schemas defined before Drizzle schemas enable shared validation between API and database layers',
  learning_type: 'success_pattern',
  skill_id: 'drizzle-orm',
  task_context: 'Setting up database layer with type-safe validation',
  temporal_level: 3,
  salience: 0.85,
  evidence: {
    what_happened: 'Defined Drizzle schema first, then had to duplicate validation logic for API',
    why_it_worked: 'Zod schemas can infer Drizzle types AND validate API requests',
    alternatives_considered: ['Drizzle-only validation', 'Separate Zod + Drizzle schemas']
  }
};

// Example 2: Gotcha
const gotcha: LiteLearningEvent = {
  type: 'learning',
  content: 'Supabase Auth PKCE flow requires explicit redirect URL configuration in dashboard before any OAuth will work',
  learning_type: 'gotcha',
  skill_id: 'supabase-auth',
  task_context: 'Implementing Google OAuth login',
  temporal_level: 3,
  salience: 0.9,
  evidence: {
    what_happened: 'OAuth redirect failed silently with no error message',
    why_it_worked: 'Adding exact redirect URL to Supabase Auth settings resolved immediately',
    alternatives_considered: []
  }
};

// Example 3: User preference
const userPreference: LiteLearningEvent = {
  type: 'learning',
  content: 'User prefers detailed explanations with code examples over concise summaries',
  learning_type: 'user_preference',
  task_context: 'Explaining authentication flow',
  temporal_level: 4,  // Permanent - affects all future interactions
  salience: 0.95,
  evidence: {
    what_happened: 'User asked for more detail after initial brief explanation',
    why_it_worked: 'Detailed explanation with code was approved immediately'
  }
};

// Example 4: Collaboration note
const collaborationNote: LiteLearningEvent = {
  type: 'learning',
  content: 'When handing off from frontend-design to supabase-auth, include: form field names, validation rules, and expected error states',
  learning_type: 'collaboration_note',
  skill_id: 'frontend-design',
  task_context: 'Building login form before auth integration',
  temporal_level: 3,
  salience: 0.8,
  evidence: {
    what_happened: 'Auth integration required re-visiting form component to add missing error state handling',
    why_it_worked: 'Including error state requirements upfront prevented rework'
  }
};
```

### Task Decision Event

Captures decisions made during task execution.

```typescript
interface LiteTaskDecisionEvent {
  type: 'task_decision';

  /** Task that this decision was made for */
  task_id: string;
  task_name: string;

  /** The decision made */
  decision: {
    /** What was decided */
    action: string;

    /** Why this choice was made */
    reasoning: string;

    /** How confident in this decision (0.0 to 1.0) */
    confidence: number;
  };

  /** What alternatives were considered */
  alternatives?: Array<{
    option: string;
    rejected_reason: string;
  }>;

  /** Context */
  skill_id?: string;
  mission_id?: string;
}

// Example
const taskDecision: LiteTaskDecisionEvent = {
  type: 'task_decision',
  task_id: 'task-abc',
  task_name: 'Set up state management',
  decision: {
    action: 'Use Zustand for state management',
    reasoning: 'Project is small (<20 components), user prefers minimal boilerplate, and Zustand has excellent TypeScript support',
    confidence: 0.88
  },
  alternatives: [
    { option: 'Redux Toolkit', rejected_reason: 'Overkill for project size' },
    { option: 'React Context', rejected_reason: 'Will cause re-render issues at scale' },
    { option: 'Jotai', rejected_reason: 'Less ecosystem support than Zustand' }
  ],
  skill_id: 'react-state'
};
```

### Task Outcome Event

Records the result of a task.

```typescript
interface LiteTaskOutcomeEvent {
  type: 'task_outcome';

  task_id: string;
  task_name: string;

  /** Did it succeed */
  success: boolean;

  /** Outcome details */
  outcome: {
    /** Description of what happened */
    details: string;

    /** How many iterations were needed */
    iterations: number;

    /** User feedback if any */
    user_feedback?: string;

    /** Duration in milliseconds */
    duration_ms?: number;
  };

  /** Context */
  skill_id?: string;
  mission_id?: string;
}

// Example: Success
const successOutcome: LiteTaskOutcomeEvent = {
  type: 'task_outcome',
  task_id: 'task-abc',
  task_name: 'Build authentication flow',
  success: true,
  outcome: {
    details: 'Implemented Supabase Auth with PKCE, including login, signup, and password reset',
    iterations: 1,
    user_feedback: 'Clean implementation, works perfectly',
    duration_ms: 180000
  },
  skill_id: 'supabase-auth',
  mission_id: 'mission-xyz'
};

// Example: Failure
const failureOutcome: LiteTaskOutcomeEvent = {
  type: 'task_outcome',
  task_id: 'task-def',
  task_name: 'Integrate payment processing',
  success: false,
  outcome: {
    details: 'Stripe webhook verification failed due to missing endpoint secret',
    iterations: 3,
    duration_ms: 600000
  },
  skill_id: 'stripe-payments',
  mission_id: 'mission-xyz'
};
```

---

## STANDARD Tier Events

### Decision Complete Event

Full decision cycle with outcome tracking and attribution.

```typescript
interface StandardDecisionCompleteEvent {
  type: 'decision_complete';

  // ============================================
  // DECISION TRACING
  // ============================================

  /** Unique trace ID for this decision */
  trace_id: string;

  /** Memory IDs that influenced this decision */
  retrieved_memories: string[];

  // ============================================
  // THE DECISION
  // ============================================

  decision: {
    /** What action was taken */
    action: string;

    /** Why this action was chosen */
    reasoning: string;

    /** Confidence level (0.0 to 1.0) */
    confidence: number;

    /** Task context */
    context: string;
  };

  // ============================================
  // OUTCOME (can be sent separately later)
  // ============================================

  outcome?: {
    /** Quality of outcome (0.0 to 1.0) */
    quality: number;

    /** Signal type */
    signal: OutcomeSignal;

    /** Explicit user feedback */
    feedback?: string;

    /** Implicit signals from behavior */
    implicit_signals?: {
      user_followed_suggestion: boolean;
      iterations_needed: number;
      time_to_approval_seconds: number;
      required_clarification: boolean;
    };
  };

  // ============================================
  // LEARNING EXTRACTED
  // ============================================

  learning?: {
    /** The insight gained */
    content: string;

    /** Named pattern (for retrieval) */
    pattern_name?: string;

    /** Confidence in this learning */
    confidence: number;

    /** What was rejected */
    alternatives_rejected: string[];

    /** Issues encountered */
    gotchas_encountered?: string[];

    /** Where this applies */
    applicable_to?: string[];
  };

  // ============================================
  // CONTEXT
  // ============================================

  task_id?: string;
  mission_id?: string;
  skill_id?: string;
  agent_id?: string;
}

// Example: Full decision cycle
const fullDecision: StandardDecisionCompleteEvent = {
  type: 'decision_complete',
  trace_id: 'dec-abc123',
  retrieved_memories: ['mem-1', 'mem-2', 'mem-3'],
  decision: {
    action: 'Implement authentication using Supabase Auth with PKCE flow',
    reasoning: 'Project already uses Supabase for database. PKCE is more secure than implicit flow for SPAs. User mentioned OAuth requirements which Supabase handles well.',
    confidence: 0.88,
    context: 'User authentication for React single-page application'
  },
  outcome: {
    quality: 0.92,
    signal: 'positive',
    feedback: 'Clean implementation, worked on first try',
    implicit_signals: {
      user_followed_suggestion: true,
      iterations_needed: 1,
      time_to_approval_seconds: 120,
      required_clarification: false
    }
  },
  learning: {
    content: 'For React SPAs with existing Supabase backend, use Supabase Auth with PKCE flow - integrates seamlessly and handles token refresh automatically',
    pattern_name: 'supabase-spa-auth',
    confidence: 0.9,
    alternatives_rejected: ['NextAuth (overkill for this stack)', 'Custom JWT (unnecessary complexity)'],
    gotchas_encountered: ['Must configure redirect URLs in Supabase dashboard first'],
    applicable_to: ['react', 'supabase', 'authentication', 'spa']
  },
  task_id: 'task-auth',
  mission_id: 'mission-xyz',
  skill_id: 'supabase-auth',
  agent_id: 'agent-auth'
};
```

### Outcome Attribution Event

When outcome is known after the fact.

```typescript
interface StandardOutcomeEvent {
  type: 'outcome_observed';

  /** Link to the original decision */
  trace_id: string;

  /** Outcome data */
  outcome: {
    quality: number;
    signal: OutcomeSignal;
    feedback?: string;
    implicit_signals?: {
      user_followed_suggestion: boolean;
      iterations_needed: number;
      time_to_approval_seconds: number;
    };
  };

  /** Attribution (which memories helped) */
  attribution?: Array<{
    memory_id: string;
    contribution: number;  // 0.0 to 1.0, must sum to 1.0
  }>;
}

// Example
const outcomeEvent: StandardOutcomeEvent = {
  type: 'outcome_observed',
  trace_id: 'dec-abc123',
  outcome: {
    quality: 0.85,
    signal: 'positive',
    feedback: 'Works well but needed one small adjustment'
  },
  attribution: [
    { memory_id: 'mem-1', contribution: 0.45 },
    { memory_id: 'mem-2', contribution: 0.35 },
    { memory_id: 'mem-3', contribution: 0.20 }
  ]
};
```

### Pattern Extracted Event

When a pattern is discovered from multiple decisions.

```typescript
interface StandardPatternEvent {
  type: 'pattern_extracted';

  /** Pattern details */
  pattern: {
    name: string;
    description: string;
    skill_sequence: string[];
    success_rate: number;
    evidence_count: number;
    applicable_to: string[];
  };

  /** Source decisions */
  source_decisions: string[];  // trace_ids

  /** Mission context */
  mission_id?: string;
}

// Example
const patternEvent: StandardPatternEvent = {
  type: 'pattern_extracted',
  pattern: {
    name: 'type-first-crud',
    description: 'Define TypeScript types → Zod schemas → Drizzle schema → API routes → UI components',
    skill_sequence: ['typescript', 'zod-validation', 'drizzle-orm', 'api-design', 'frontend-design'],
    success_rate: 0.93,
    evidence_count: 5,
    applicable_to: ['crud', 'data-driven', 'full-stack']
  },
  source_decisions: ['dec-1', 'dec-2', 'dec-3', 'dec-4', 'dec-5'],
  mission_id: 'mission-xyz'
};
```

---

## ENTERPRISE Tier Events

### Mission Complete with Federation

Full mission results with anonymized contribution to collective learning.

```typescript
interface EnterpriseMissionCompleteEvent {
  type: 'mission_complete';

  mission_id: string;
  mission_name: string;

  // ============================================
  // MISSION RESULTS
  // ============================================

  results: {
    success_rate: number;
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    duration_ms: number;
  };

  // ============================================
  // FEDERATED CONTRIBUTION (anonymized)
  // ============================================

  federated_contribution: {
    /** Patterns discovered (will be aggregated across projects) */
    patterns_discovered: Array<{
      pattern_name: string;
      description: string;
      skill_sequence: string[];
      success_rate: number;
      applies_to: string[];
    }>;

    /** Skill effectiveness (will be averaged across projects) */
    skill_effectiveness: Record<string, {
      success_rate: number;
      avg_iterations: number;
      task_types: string[];
    }>;

    /** Agent/skill synergy (will be averaged) */
    team_synergy: Record<string, number>;

    /** Gotchas encountered (will be deduplicated and ranked) */
    gotchas: Array<{
      skill_id: string;
      description: string;
      severity: Severity;
      resolution: string;
    }>;
  };

  // ============================================
  // PRIVACY CONTROLS
  // ============================================

  privacy: {
    /** User consent level */
    consent_level: 'none' | 'patterns_only' | 'full';

    /** Confirmation that PII was scrubbed */
    pii_scrubbed: boolean;

    /** Confirmation that project is anonymized */
    project_anonymized: boolean;
  };
}

// Example
const enterpriseMission: EnterpriseMissionCompleteEvent = {
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
        description: 'RLS policies → Auth hooks → Protected routes → Session handling',
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
        description: 'PKCE flow requires explicit redirect URL configuration before OAuth will work',
        severity: 'warning',
        resolution: 'Add all valid redirect URLs in Supabase Auth settings first'
      }
    ]
  },
  privacy: {
    consent_level: 'patterns_only',
    pii_scrubbed: true,
    project_anonymized: true
  }
};
```

### Collective Insights Request

Query collective intelligence.

```typescript
interface EnterpriseInsightsRequest {
  type: 'insights_request';

  /** What kind of insight */
  insight_type: 'skill_ranking' | 'team_synergy' | 'pattern_search' | 'prediction';

  /** Query context */
  query: {
    /** Task or domain */
    task_type?: string;

    /** Skills being considered */
    skills?: string[];

    /** Tech stack */
    stack?: string[];
  };
}

interface EnterpriseInsightsResponse {
  type: 'insights_response';

  /** Skill rankings for the query */
  skill_rankings?: Record<string, {
    success_rate: number;
    avg_iterations: number;
    recommendation: 'highly_recommended' | 'recommended' | 'acceptable' | 'not_recommended';
  }>;

  /** Team synergy data */
  team_synergy?: Record<string, number>;

  /** Relevant patterns */
  patterns?: Array<{
    name: string;
    description: string;
    success_rate: number;
    evidence_count: number;
  }>;

  /** Prediction for success */
  prediction?: {
    confidence: number;
    expected_iterations: number;
    potential_gotchas: string[];
  };

  /** Data freshness */
  based_on: {
    project_count: number;
    decision_count: number;
    last_updated: string;
  };
}
```

---

## Event Processing

### LITE Processing (Client-Side)

```typescript
// In Spawner UI
function processLiteEvent(event: LiteLearningEvent | LiteTaskDecisionEvent | LiteTaskOutcomeEvent) {
  switch (event.type) {
    case 'learning':
      // Store directly in memory
      memoryClient.createMemory({
        content: event.content,
        content_type: `learning_${event.learning_type}`,
        temporal_level: event.temporal_level,
        salience: event.salience,
        metadata: {
          skill_id: event.skill_id,
          task_context: event.task_context,
          evidence: event.evidence
        }
      });
      break;

    case 'task_decision':
      memoryClient.recordAgentDecision(
        event.skill_id || 'unknown',
        event.task_name,
        {
          decision: event.decision.action,
          reasoning: event.decision.reasoning,
          confidence: event.decision.confidence
        }
      );
      break;

    case 'task_outcome':
      memoryClient.recordTaskOutcome(
        event.mission_id || '',
        event.task_id,
        {
          success: event.success,
          details: event.outcome.details,
          skillId: event.skill_id
        }
      );
      break;
  }
}
```

### STANDARD Processing (Server-Side)

```typescript
// In background worker
async function processStandardEvent(event: StandardDecisionCompleteEvent) {
  // 1. Store decision trace
  const traceId = await decisionStore.create({
    trace_id: event.trace_id,
    query: event.decision.context,
    retrieved_memories: event.retrieved_memories,
    confidence: event.decision.confidence
  });

  // 2. If outcome present, process attribution
  if (event.outcome) {
    // Calculate attribution
    const attribution = await calculateAttribution(
      event.retrieved_memories,
      event.outcome.quality
    );

    // Adjust salience for each memory
    for (const { memory_id, contribution } of attribution) {
      const adjustment = event.outcome.signal === 'positive'
        ? contribution * event.outcome.quality * 0.1
        : -contribution * (1 - event.outcome.quality) * 0.15;

      await memoryStore.adjustSalience(memory_id, adjustment);
    }
  }

  // 3. If learning present, store it
  if (event.learning) {
    await memoryStore.create({
      content: event.learning.content,
      content_type: 'agent_learning',
      temporal_level: 3,
      salience: event.learning.confidence,
      metadata: {
        pattern_name: event.learning.pattern_name,
        alternatives_rejected: event.learning.alternatives_rejected,
        applicable_to: event.learning.applicable_to
      }
    });
  }

  // 4. Publish event for other workers
  await eventBus.publish('decision.tracked', { trace_id: traceId, ...event });
}
```

### ENTERPRISE Processing (Federated)

```typescript
// In federation service
async function processEnterpriseEvent(event: EnterpriseMissionCompleteEvent) {
  // 1. Process locally first (same as STANDARD)
  await processStandardEvents(event);

  // 2. Check consent
  if (event.privacy.consent_level === 'none') {
    return;  // User opted out
  }

  // 3. Validate PII scrubbing
  if (!event.privacy.pii_scrubbed || !event.privacy.project_anonymized) {
    throw new Error('Privacy requirements not met');
  }

  // 4. Aggregate patterns
  for (const pattern of event.federated_contribution.patterns_discovered) {
    await federationStore.addPatternEvidence(pattern);
  }

  // 5. Update skill effectiveness
  for (const [skillId, effectiveness] of Object.entries(event.federated_contribution.skill_effectiveness)) {
    await federationStore.updateSkillEffectiveness(skillId, effectiveness);
  }

  // 6. Update team synergy matrix
  for (const [combo, synergy] of Object.entries(event.federated_contribution.team_synergy)) {
    await federationStore.updateTeamSynergy(combo, synergy);
  }

  // 7. Deduplicate and rank gotchas
  for (const gotcha of event.federated_contribution.gotchas) {
    await federationStore.recordGotcha(gotcha);
  }
}
```

---

## Validation

### Required Fields

| Tier | Event Type | Required Fields |
|------|------------|-----------------|
| LITE | learning | content, learning_type, temporal_level, salience |
| LITE | task_decision | task_id, task_name, decision.action, decision.reasoning |
| LITE | task_outcome | task_id, success, outcome.details |
| STANDARD | decision_complete | trace_id, decision.* |
| STANDARD | outcome_observed | trace_id, outcome.quality, outcome.signal |
| ENTERPRISE | mission_complete | mission_id, results.*, privacy.* |

### Content Quality Rules

```typescript
function validateLearningContent(content: string): boolean {
  // Reject template garbage
  const badPatterns = [
    /^Task (executed|completed|started)/i,
    /^Mission (executed|completed|started)/i,
    /^\d+\/\d+ tasks/i,
    /^Successfully/i
  ];

  for (const pattern of badPatterns) {
    if (pattern.test(content)) {
      return false;
    }
  }

  // Require minimum length
  if (content.length < 20) {
    return false;
  }

  return true;
}
```

---

## Migration Notes

### From Current → LITE+

Current format:
```typescript
{ type: 'task_completed', taskId: 'x', success: true }
```

New format:
```typescript
{
  type: 'task_outcome',
  task_id: 'x',
  task_name: 'Build auth flow',
  success: true,
  outcome: {
    details: 'Implemented Supabase Auth with PKCE...',
    iterations: 1,
    user_feedback: 'Clean implementation'
  },
  skill_id: 'supabase-auth'
}

// Plus a learning event:
{
  type: 'learning',
  content: 'PKCE flow with Supabase requires redirect URL config first',
  learning_type: 'gotcha',
  skill_id: 'supabase-auth',
  temporal_level: 3,
  salience: 0.85
}
```

### Backwards Compatibility

The event bridge should accept both formats during migration:

```typescript
function processEvent(event: any) {
  // Legacy format
  if (event.type === 'task_completed' && !event.outcome) {
    return processLegacyEvent(event);
  }

  // New format
  return processRichEvent(event);
}
```
