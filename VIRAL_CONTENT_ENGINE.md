# Viral Content Engine

## Vision

Transform ContentForge from an **analysis tool** into a **self-improving content generation engine** that learns what makes content go viral and uses that knowledge to consistently create banger content.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    THE VIRAL CONTENT FLYWHEEL                           │
│                                                                         │
│     ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐ │
│     │ ANALYZE  │ ──▶  │  LEARN   │ ──▶  │ GENERATE │ ──▶  │   TEST   │ │
│     │ Content  │      │ Patterns │      │ Content  │      │ & Score  │ │
│     └──────────┘      └──────────┘      └──────────┘      └──────────┘ │
│           ▲                                                     │       │
│           │                                                     │       │
│           └─────────────────────────────────────────────────────┘       │
│                         IMPROVE & REPEAT                                │
└─────────────────────────────────────────────────────────────────────────┘
```

## Current State

**What we have:**
- ContentForge analyzes tweets/content for virality score
- 4 H70 agents provide insights (Marketing, Copywriting, Viral Hooks, Psychology)
- Ralph Mode iterates until quality threshold met
- Mind stores analysis results

**What's missing:**
- Content GENERATION based on learnings
- Pattern extraction and ranking
- Benchmarking system for generated content
- Feedback loop from real-world performance
- Structured knowledge base of "what works"

---

## Phase 1: Enhanced Learning Storage

### 1.1 Pattern Categories to Track

Store these specific patterns in Mind with performance scores:

```typescript
interface ViralPattern {
  category: 'hook' | 'structure' | 'emotion' | 'timing' | 'format' | 'topic';
  pattern: string;           // e.g., "Contrarian opener"
  examples: string[];        // Real examples that worked
  avgScore: number;          // Average virality score
  sampleSize: number;        // How many times we've seen this
  bestPerformer: {
    content: string;
    score: number;
    metrics?: EngagementMetrics;
  };
  antiPatterns: string[];    // What NOT to do
}
```

### 1.2 Hook Types to Learn

| Hook Type | Example | What to Track |
|-----------|---------|---------------|
| **Contrarian** | "Unpopular opinion: X is overrated" | Score vs topic, audience reaction |
| **Curiosity Gap** | "The skill that changed everything..." | Click-through, completion |
| **Number/List** | "7 ways to..." | Optimal number, topic fit |
| **Story Hook** | "2 years ago I was broke..." | Emotional arc, authenticity |
| **Direct Claim** | "This will 10x your output" | Boldness vs credibility |
| **Question** | "Why do most founders fail?" | Engagement rate, reply quality |

### 1.3 Structure Patterns

| Structure | When It Works | Score Correlation |
|-----------|---------------|-------------------|
| **Single Tweet** | Hot takes, insights | High for authority |
| **Thread** | Tutorials, stories | High for value content |
| **Quote Tweet** | Commentary, takes | Medium, context-dependent |
| **Visual + Text** | Data, before/after | Very high for proof |
| **Video** | Demos, personality | Highest engagement |

### 1.4 Emotional Triggers

Track which emotions correlate with virality:
- **FOMO** - "Everyone's using this except you"
- **Aspiration** - "How I went from X to Y"
- **Curiosity** - "The hidden secret of..."
- **Outrage** - "This is wrong with the industry"
- **Validation** - "You're not alone if you..."
- **Awe** - "Mind-blowing discovery"

---

## Phase 2: Content Generation System

### 2.1 Generation Modes

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT GENERATION MODES                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [1] TOPIC → CONTENT                                            │
│      Input: "AI agents"                                         │
│      Output: 5 tweet variations using top-performing patterns   │
│                                                                  │
│  [2] INSIGHT → CONTENT                                          │
│      Input: "I discovered X technique"                          │
│      Output: Best hook + structure for this insight type        │
│                                                                  │
│  [3] TEMPLATE → CONTENT                                         │
│      Input: Select from proven templates                        │
│      Output: Fill-in-the-blank with your specifics              │
│                                                                  │
│  [4] REMIX → CONTENT                                            │
│      Input: Existing high-performer                             │
│      Output: Your version using same patterns                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Generation Pipeline

```
User Input (topic/insight)
    │
    ▼
┌──────────────────────────────┐
│ 1. Query Mind for Patterns   │ ◀── What hooks work for this topic?
│    - Best hooks for topic    │     What structures perform best?
│    - Optimal structure       │     What emotions to target?
│    - Target emotions         │
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ 2. Generate Variations       │ ◀── Create 5+ versions
│    - Different hooks         │     Each using different patterns
│    - Different structures    │     Ranked by predicted score
│    - Different angles        │
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ 3. Score Each Variation      │ ◀── Run through analysis pipeline
│    - Predict virality        │     Compare to learned patterns
│    - Identify weaknesses     │     Suggest improvements
└──────────────────────────────┘
    │
    ▼
┌──────────────────────────────┐
│ 4. Iterate with Ralph        │ ◀── Keep improving until score ≥ 85
│    - Fix weak points         │     Apply anti-patterns check
│    - Strengthen hooks        │     Validate against top performers
└──────────────────────────────┘
    │
    ▼
Output: Polished content ready to post
```

### 2.3 Template Library (Built from Learnings)

Store proven templates extracted from high-performers:

```markdown
## Template: Contrarian Authority
Hook: "[Unpopular opinion / Hot take]: [Common belief] is [wrong/overrated]"
Body: "Here's why: [3 reasons with proof]"
CTA: "[Question that invites debate]"
Best for: Thought leadership, standing out
Avg Score: 78

## Template: Transformation Story
Hook: "[Time] ago, I was [bad state]. Now I [good state]."
Body: "Here's the [number] things that changed everything: [list]"
CTA: "Which one resonates most?"
Best for: Personal brand, inspiration
Avg Score: 82

## Template: Tactical Value
Hook: "How to [achieve result] in [timeframe]:"
Body: "[Numbered steps with specifics]"
CTA: "Bookmark this for later"
Best for: Tutorials, building authority
Avg Score: 75
```

---

## Phase 3: Benchmarking System

### 3.1 Internal Benchmarks

Before posting, score generated content:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Virality Score** | ≥ 80 | ContentForge analysis |
| **Hook Strength** | ≥ 8/10 | First 10 words impact |
| **Pattern Match** | Top 3 patterns | Compare to learned winners |
| **Uniqueness** | Not recycled | Check against recent posts |
| **Clarity** | 8th grade level | Readability score |

### 3.2 Real-World Feedback Loop

After posting, track actual performance:

```typescript
interface PostPerformance {
  contentId: string;
  predictedScore: number;      // What we predicted
  actualMetrics: {
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
    bookmarks: number;
    engagementRate: number;    // (likes+RTs+replies) / impressions
  };
  performanceScore: number;    // Calculated from metrics
  learnings: string[];         // What we learned from difference
}
```

### 3.3 Calibration

Track prediction accuracy:
- If predicted 80, actual performance was X
- Adjust pattern weights based on real results
- Identify blind spots in analysis

---

## Phase 4: Mind Schema Updates

### 4.1 New Memory Types

Add these content types to Mind:

```typescript
// Viral pattern learned from analysis
content_type: 'viral_pattern'
{
  pattern_category: 'hook' | 'structure' | 'emotion' | 'timing',
  pattern_name: string,
  success_examples: string[],
  avg_score: number,
  sample_size: number,
  confidence: number
}

// Generated content and its performance
content_type: 'generated_content'
{
  input_topic: string,
  generated_variations: string[],
  selected_version: string,
  predicted_score: number,
  actual_performance?: PostPerformance,
  patterns_used: string[]
}

// Content generation decision
content_type: 'generation_decision'
{
  topic: string,
  chosen_hook_type: string,
  chosen_structure: string,
  reasoning: string,
  outcome: 'success' | 'moderate' | 'underperformed'
}

// Anti-pattern (what NOT to do)
content_type: 'anti_pattern'
{
  pattern: string,
  why_fails: string,
  examples: string[],
  avg_score: number  // Low score
}
```

### 4.2 Pattern Ranking System

Store patterns with confidence scores:

```
HOOK PATTERNS (ranked by avg score):
1. Transformation Story (avg: 84, n=23, confidence: high)
2. Contrarian Hot Take (avg: 81, n=45, confidence: very high)
3. Curiosity Gap (avg: 78, n=67, confidence: very high)
4. Direct Claim (avg: 72, n=31, confidence: high)
5. Question Hook (avg: 68, n=18, confidence: medium)

STRUCTURE PATTERNS (ranked):
1. Visual + Short Text (avg: 86, n=12, confidence: medium)
2. Thread 5-7 tweets (avg: 79, n=34, confidence: high)
3. Single Tweet < 200 chars (avg: 75, n=89, confidence: very high)
```

---

## Phase 5: Implementation Roadmap

### Step 1: Enhanced Pattern Storage (Now)
- [ ] Add new memory types to Mind schema
- [ ] Extract patterns from each analysis
- [ ] Store with scores and examples
- [ ] Build pattern ranking system

### Step 2: Pattern Query System
- [ ] API to query top patterns by category
- [ ] API to get best patterns for topic
- [ ] API to get anti-patterns to avoid

### Step 3: Content Generation UI
- [ ] New "Generate Content" tab in ContentForge
- [ ] Topic input → pattern suggestions
- [ ] Variation generator
- [ ] Pre-post scoring

### Step 4: Feedback Loop
- [ ] Track posted content performance
- [ ] Compare predicted vs actual
- [ ] Auto-adjust pattern weights
- [ ] Surface insights on what's working

### Step 5: Template Library
- [ ] Extract templates from top performers
- [ ] Categorize by use case
- [ ] Fill-in-the-blank interface
- [ ] Score predictions per template

---

## Success Metrics

### Short-term (1 month)
- 50+ patterns stored with scores
- Pattern confidence levels established
- Can generate 5 variations for any topic

### Medium-term (3 months)
- 80%+ of generated content scores ≥ 75
- Template library with 20+ proven templates
- Real-world feedback loop active

### Long-term (6 months)
- Prediction accuracy within 10% of actual
- Consistently generate 85+ score content
- Become the go-to content generation engine

---

## The End Goal

When you ask: "Give me content ideas about X"

The system will:
1. Query Mind for patterns that work for topic X
2. Identify your top-performing styles
3. Generate variations using proven patterns
4. Score each variation
5. Iterate until banger-level quality
6. Return ready-to-post content with confidence score

**Result: Consistently viral content, every time.**

---

## Next Actions

1. **Implement Phase 1** - Enhanced pattern storage in Mind
2. **Build pattern extraction** - Auto-extract from each analysis
3. **Create generation prompt** - Use learnings to generate content
4. **Add feedback tracking** - Close the loop with real performance

Let's build this step by step.
