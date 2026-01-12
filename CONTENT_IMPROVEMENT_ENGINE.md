# Content Improvement Engine

> Add a new **Improve Mode** to ContentForge that recommends improvements to your draft content (text + media) using everything learned from past analyses.

## Overview

ContentForge currently has **Analyze Mode** which scores existing/published content and learns patterns. We're adding a new **Improve Mode** that applies those learnings to help you improve drafts BEFORE publishing.

**Both modes coexist:**

| Mode | Purpose | Input | Output |
|------|---------|-------|--------|
| **Analyze Mode** (existing) | Score & learn from content | Published posts, tweets | Virality score, insights, patterns stored |
| **Improve Mode** (NEW) | Improve drafts before posting | Draft text + images/media | Recommendations, rewrites, fixes |

**Flow Comparison:**
```
ANALYZE MODE (existing):
Published Content → Analyze → Score → Learn → Store in Mind

IMPROVE MODE (new):
Draft Content + Media → Apply Learnings → Recommendations → Rewrites → Better Content
```

## What We Already Have

### Learning Systems (Already Built)

| System | What It Tracks | Data Location |
|--------|---------------|---------------|
| **Viral Pattern Learning** | Hook types, structures, emotions, anti-patterns | Mind v5 + `viral-patterns.ts` |
| **Topic Learning** | Hot topics, rising topics, subtopics, gaps | Mind v5 + `topic-learning.ts` |
| **Engagement Correlations** | Which patterns → high engagement | Mind v5 via `contentforge-mind.ts` |
| **User Style Profile** | Your tone, preferred hooks, strong emotions | Mind v5 aggregated |
| **8-Agent Intelligence** | Cross-domain insights, recommendations | `mind-learning-intelligence.ts` |

### Pattern Data Available

**Hook Types Tracked:**
- `contrarian` - "Unpopular opinion..."
- `curiosity_gap` - "The one thing nobody tells you..."
- `transformation` - "I went from X to Y..."
- `number_list` - "7 lessons from..."
- `direct_claim` - Bold statement
- `question` - "Why do most people..."
- `story` - "Last week I..."
- `shock` - Surprising stat/fact

**Subtopics Tracked (per main topic):**
- Claude Code: custom skills, legal/contracts, optimization, prompts, memory, hooks, MCP, cost, tips, workflows, debugging, comparisons
- AI Agents: autonomous, multi-agent, tool use, memory, planning, deployment, cost, safety, frameworks, use cases
- Vibe Coding: workflow, prompting, iteration, planning, debugging, shipping, learning, productivity

**Emotions Tracked:**
- FOMO, aspiration, curiosity, validation, outrage, awe

**Anti-Patterns (What NOT to do):**
- Weak hooks, generic statements, no clear value proposition

---

## Content Improvement Engine Design

### Core Concept

When user enters draft content, instead of (or in addition to) scoring it, we:

1. **Match against learned patterns** - What's working? What's missing?
2. **Check topic/keyword coverage** - Are the right subtopics included?
3. **Apply best practices** - From 8-agent learnings
4. **Generate specific rewrites** - Not vague advice, actual alternatives
5. **Score improvement potential** - "This change could boost score by +15"

### New Mode: "Improve Mode" vs "Analyze Mode"

```
┌─────────────────────────────────────────────────────────────┐
│  ContentForge                                                │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ Analyze Mode │  │ Improve Mode │  ← NEW                  │
│  │ (Score post) │  │ (Fix draft)  │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Feature Specification

### Input

```typescript
interface DraftContent {
  text: string;           // The draft content
  media?: MediaItem[];    // Optional: images, videos, etc.
  targetPlatform?: 'twitter' | 'linkedin' | 'threads';
  targetTopic?: string;   // Optional: what topic is this about?
  targetEmotion?: string; // Optional: what feeling to evoke?
}

interface MediaItem {
  type: 'image' | 'video' | 'gif';
  file?: File;            // Uploaded file
  url?: string;           // Or URL to existing media
  altText?: string;       // Current alt text (if any)
}
```

### Supported Input Types

| Input Type | How It's Analyzed |
|------------|-------------------|
| **Text only** | Hook, emotion, topics, structure analysis |
| **Text + Image** | All text analysis + visual composition, color, text overlay recommendations |
| **Text + Video thumbnail** | All above + thumbnail optimization |
| **Image only** | Visual hook, composition, color psychology, text overlay suggestions |
| **Screenshot of draft** | OCR to extract text, then full analysis |

### Output

```typescript
interface ContentImprovements {
  // Overall assessment
  currentScore: number;        // Estimated score (0-100)
  potentialScore: number;      // Score if all recommendations applied

  // Hook Analysis
  hook: {
    detected: string | null;           // Current hook type
    effectiveness: 'weak' | 'moderate' | 'strong';
    recommendation: string;            // What to do
    rewrites: string[];                // 2-3 alternative hooks
    basedOn: string;                   // "Your top hooks: curiosity_gap (avg 78), contrarian (avg 72)"
  };

  // Topic/Keyword Recommendations
  topics: {
    detected: string[];                // Topics found in draft
    missing: string[];                 // Hot topics not mentioned
    subtopicsDetected: string[];       // Subtopics found
    subtopicsMissing: string[];        // Hot subtopics to consider
    keywordsToAdd: string[];           // Specific words that boost engagement
    recommendation: string;
  };

  // Emotional Resonance
  emotion: {
    detected: string | null;           // Current emotion
    intensity: 'low' | 'medium' | 'high';
    recommendation: string;
    rewrites: string[];                // Ways to add more emotion
    basedOn: string;                   // "Your audience responds to: curiosity (avg 75)"
  };

  // Structure Improvements
  structure: {
    current: string;                   // Current structure type
    optimal: string;                   // Recommended structure
    recommendation: string;
    example: string;                   // How to restructure
  };

  // Specific Line-by-Line Suggestions
  lineImprovements: Array<{
    original: string;                  // Original line
    issue: string;                     // What's wrong
    suggestion: string;                // How to fix
    rewrite: string;                   // Specific rewrite
    impact: 'low' | 'medium' | 'high';
  }>;

  // Anti-Pattern Warnings
  warnings: Array<{
    pattern: string;                   // What anti-pattern was detected
    location: string;                  // Where in the content
    fix: string;                       // How to fix it
    example: string;                   // Example of better approach
  }>;

  // Final Rewrite Suggestions
  fullRewrites: Array<{
    version: string;                   // "Hook-focused", "Emotion-focused", etc.
    content: string;                   // Full rewritten content
    estimatedScore: number;            // Projected score
    changes: string[];                 // What was changed
  }>;

  // Visual/Media Improvements (when media is provided)
  visual?: {
    hasMedia: boolean;
    mediaType: 'image' | 'video' | 'gif';

    // Composition Analysis
    composition: {
      current: string;                 // "centered", "rule-of-thirds", etc.
      recommendation: string;
      example?: string;                // Reference to high-performing visual
    };

    // Color Psychology
    colors: {
      dominant: string[];              // Colors detected
      mood: string;                    // "energetic", "calm", "professional"
      recommendation: string;          // "Add contrast" or "Good choice for engagement"
      platformOptimal: string[];       // Best colors for platform
    };

    // Text Overlay (if image has text)
    textOverlay: {
      detected: boolean;
      readability: 'poor' | 'moderate' | 'good';
      recommendation: string;
      fontSuggestion?: string;
      contrastFix?: string;
    };

    // Scroll-Stopping Analysis
    scrollStop: {
      score: number;                   // 0-100
      factors: string[];               // What works
      missing: string[];               // What to add
      recommendation: string;
    };

    // Alt Text (accessibility + algorithm)
    altText: {
      current: string | null;
      recommendation: string;          // Optimized alt text
      keywords: string[];              // Keywords to include
    };

    // Platform-Specific
    platformFit: {
      aspectRatio: 'optimal' | 'suboptimal';
      recommendedRatio: string;        // "1:1 for Twitter", "4:5 for Instagram"
      fileSize: 'ok' | 'too_large';
      recommendation: string;
    };
  };
}
```

---

## Implementation Architecture

### New Files

```
src/lib/services/
├── content-improver.ts          # Core improvement engine
├── content-improver-prompts.ts  # AI prompts for improvements
└── improvement-patterns.ts      # Pattern matching utilities

src/lib/components/contentforge/
├── ImproveMode.svelte           # UI for improvement mode
├── ImprovementCard.svelte       # Individual suggestion card
└── RewritePreview.svelte        # Side-by-side comparison
```

### Core Service: `content-improver.ts`

```typescript
/**
 * Content Improvement Engine
 *
 * Uses learned patterns from Mind to improve draft content
 * before publishing.
 */

import { getTopicInsights, extractTopicsFromContent } from './topic-learning';
import { getPatternStats, extractPatternsFromContent } from './viral-patterns';
import { queryMindPatterns, getUserStyle } from './contentforge-mind';

export interface ImprovementRequest {
  content: string;
  platform?: string;
  targetTopic?: string;
}

export interface ContentImprovements {
  currentScore: number;
  potentialScore: number;
  hook: HookAnalysis;
  topics: TopicAnalysis;
  emotion: EmotionAnalysis;
  structure: StructureAnalysis;
  lineImprovements: LineImprovement[];
  warnings: AntiPatternWarning[];
  fullRewrites: FullRewrite[];
}

/**
 * Main entry point - analyze draft and generate improvements
 */
export async function improveContent(
  request: ImprovementRequest
): Promise<ContentImprovements> {
  // 1. Load all learned data
  const [topicInsights, patternStats, userStyle] = await Promise.all([
    getTopicInsights(),
    getPatternStats(),
    getUserStyle()
  ]);

  // 2. Extract what's in the draft
  const extractedTopics = extractTopicsFromContent(request.content);
  const extractedPatterns = extractPatternsFromContent(request.content);

  // 3. Generate improvements based on gaps
  const hookAnalysis = analyzeHook(request.content, patternStats, userStyle);
  const topicAnalysis = analyzeTopics(extractedTopics, topicInsights);
  const emotionAnalysis = analyzeEmotion(request.content, patternStats, userStyle);
  const structureAnalysis = analyzeStructure(request.content, patternStats);
  const lineImprovements = generateLineImprovements(request.content, patternStats);
  const warnings = detectAntiPatterns(request.content, patternStats);

  // 4. Generate full rewrites (via AI)
  const fullRewrites = await generateRewrites(request.content, {
    hookAnalysis,
    topicAnalysis,
    emotionAnalysis,
    userStyle
  });

  // 5. Calculate scores
  const currentScore = estimateScore(request.content, patternStats);
  const potentialScore = estimatePotentialScore(fullRewrites);

  return {
    currentScore,
    potentialScore,
    hook: hookAnalysis,
    topics: topicAnalysis,
    emotion: emotionAnalysis,
    structure: structureAnalysis,
    lineImprovements,
    warnings,
    fullRewrites
  };
}
```

### AI-Powered Rewrite Generation

The engine uses Claude to generate actual rewrites based on learned patterns:

```typescript
/**
 * Generate AI-powered rewrites based on learned patterns
 */
async function generateRewrites(
  content: string,
  context: ImprovementContext
): Promise<FullRewrite[]> {
  // This calls Claude via the existing bridge pattern
  // Prompt includes:
  // - The draft content
  // - User's best-performing patterns
  // - Hot topics/subtopics to include
  // - Emotions that resonate with their audience
  // - Anti-patterns to avoid

  const prompt = buildRewritePrompt(content, context);

  // Returns 3 variations:
  // 1. "Hook-Optimized" - Focus on stronger opening
  // 2. "Emotion-Amplified" - More emotional resonance
  // 3. "Topic-Enhanced" - Better keyword/subtopic coverage
}
```

---

## UI Design

### Mode Toggle (Top of ContentForge)

```svelte
<!-- Mode selector - both modes available -->
<div class="flex gap-2 mb-4">
  <button
    class="{mode === 'analyze' ? 'bg-accent-primary' : 'bg-bg-secondary'}"
    onclick={() => mode = 'analyze'}
  >
    Analyze Post
  </button>
  <button
    class="{mode === 'improve' ? 'bg-emerald-500' : 'bg-bg-secondary'}"
    onclick={() => mode = 'improve'}
  >
    Improve Draft
  </button>
</div>
```

### Improve Mode Input Area

```
┌─────────────────────────────────────────────────────────────┐
│  IMPROVE MODE                                               │
│  ───────────────────────────────────────────────────────── │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Your Draft                                          │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  [                                                 ] │   │
│  │  [          Text input area                        ] │   │
│  │  [                                                 ] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📷 Add Media (optional)                            │   │
│  │  ─────────────────────────────────────────────────  │   │
│  │  [Drop image/video here or click to upload]         │   │
│  │                                                      │   │
│  │  Supported: JPG, PNG, GIF, MP4, WebM                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Platform: [Twitter ▼]   Topic Focus: [Auto-detect ▼]      │
│                                                             │
│  [ Get Improvement Recommendations ]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Improvement Results Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Your Draft                    │  Suggested Improvements    │
│  ────────────────────────────  │  ────────────────────────  │
│  [Original content here]       │  Current Score: 45         │
│                                │  Potential: 78 (+33)       │
│  ┌────────────────────────┐    │                            │
│  │  [Uploaded image       │    │  🎣 Hook: WEAK             │
│  │   preview here]        │    │  Try: "Most devs miss..."  │
│  └────────────────────────┘    │                            │
│                                │  🏷️ Topics: Missing        │
│                                │  Add: "Claude skills"      │
│                                │                            │
│                                │  💡 Emotion: LOW           │
│                                │  Add curiosity gap         │
├─────────────────────────────────────────────────────────────┤
│  📷 Visual Recommendations (when media uploaded)            │
│  ────────────────────────────────────────────────────────── │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐  │
│  │ 🎨 Composition  │ │ 🌈 Colors       │ │ 📝 Text       │  │
│  │ Rule of thirds  │ │ Add contrast    │ │ Readability:  │  │
│  │ ✓ Good framing  │ │ Current: muted  │ │ MODERATE      │  │
│  │                 │ │ Try: bold teal  │ │ Increase size │  │
│  └─────────────────┘ └─────────────────┘ └───────────────┘  │
│                                                             │
│  Scroll-Stop Score: 62/100                                  │
│  Missing: High contrast element, clear focal point          │
│  Alt Text: "Claude Code workflow diagram showing..." [Copy] │
├─────────────────────────────────────────────────────────────┤
│  Full Rewrites                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────┐  │
│  │ Hook-Optimized  │ │ Emotion-Focused │ │ Topic-Rich    │  │
│  │ Est. Score: 72  │ │ Est. Score: 78  │ │ Est. Score: 68│  │
│  │ [Full rewrite]  │ │ [Full rewrite]  │ │ [Full rewrite]│  │
│  │ [Copy] [Use]    │ │ [Copy] [Use]    │ │ [Copy] [Use]  │  │
│  └─────────────────┘ └─────────────────┘ └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Line-by-Line Suggestions

```svelte
<div class="line-improvement">
  <div class="original">
    "I've been using Claude Code lately"
  </div>
  <div class="issue">
    Weak hook - no curiosity or value proposition
  </div>
  <div class="suggestion">
    Start with a transformation or contrarian take
  </div>
  <div class="rewrite">
    "Claude Code changed how I ship code - here's what 6 months taught me"
  </div>
  <button class="apply">Apply</button>
</div>
```

---

## Data Flow

```
┌──────────────────┐
│   Draft Input    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│                   Content Improver                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ Load from   │  │ Extract     │  │ Compare &   │       │
│  │ Mind:       │  │ from Draft: │  │ Generate:   │       │
│  │ - Patterns  │  │ - Topics    │  │ - Gaps      │       │
│  │ - Topics    │  │ - Subtopics │  │ - Warnings  │       │
│  │ - User Style│  │ - Hook type │  │ - Rewrites  │       │
│  │ - Hot hooks │  │ - Emotion   │  │ - Score est │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  Improvements    │
│  + Rewrites      │
└──────────────────┘
```

---

## Implementation Plan

### Phase 1: Core Engine (MVP)

1. **`content-improver.ts`** - Basic improvement logic
   - Hook detection and suggestions
   - Topic/subtopic gap analysis
   - Emotion detection
   - Anti-pattern warnings
   - Score estimation

2. **Local improvements** (no AI call needed)
   - Based purely on pattern matching
   - Fast, instant feedback
   - Shows what's missing vs learned patterns

### Phase 2: AI-Powered Rewrites

3. **Rewrite generation** via Claude
   - Uses bridge pattern (like existing analysis)
   - Generates 3 alternative versions
   - Includes specific changes list

4. **UI for rewrite selection**
   - Side-by-side comparison
   - One-click apply
   - Copy to clipboard

### Phase 3: Advanced Features

5. **Real-time suggestions** (as you type)
6. **Platform-specific optimization** (Twitter vs LinkedIn)
7. **A/B test suggestions** (generate multiple variations to test)
8. **History tracking** (did improvements actually boost engagement?)

---

## Two Modes Working Together

Both modes coexist in ContentForge - use Analyze to learn, use Improve to apply learnings.

| Feature | Analyze Mode (existing) | Improve Mode (NEW) |
|---------|------------------------|-------------------|
| **Purpose** | Score & learn from content | Improve before publishing |
| **Input** | Published posts, tweet URLs | Draft text + images/media |
| **Output** | Virality score, pattern insights | Recommendations, rewrites, fixes |
| **Media** | Fetches from URL | User uploads directly |
| **Rewrites** | None (analysis only) | Multiple AI-generated options |
| **Timing** | Post-publish analysis | Pre-publish optimization |
| **Learning** | Stores new patterns to Mind | Applies learned patterns |
| **Action** | Passive insight | Active improvement |

**The Virtuous Cycle:**
```
Analyze Mode → Learns patterns → Stored in Mind
                                      ↓
Improve Mode ← Applies patterns ← Reads from Mind
                                      ↓
Better Content → Analyze again → More learnings → Even better recommendations
```

---

## Example Usage

### Input Draft:
```
"I've been using Claude Code for a while now. It's pretty good for coding tasks.
The AI helps with various things. Would recommend checking it out."
```

### Improvement Output:

**Hook Analysis:**
- Current: `direct_claim` (weak)
- Your best: `curiosity_gap` (avg 78), `transformation` (avg 72)
- Suggestion: "Start with what changed or what most people don't know"
- Rewrites:
  1. "The one Claude Code trick that cut my debugging time by 80%"
  2. "I went from hating AI coding tools to shipping 3x faster"
  3. "Why most developers are using Claude Code wrong"

**Topic Analysis:**
- Detected: `claude code` ✓
- Missing hot subtopics: `custom skills`, `tips & tricks`, `workflows`
- Keywords to add: "vibe coding", "ship faster", "productivity"
- Suggestion: "Mention specific subtopics that perform well in your niche"

**Emotion Analysis:**
- Current: None detected (neutral)
- Your audience responds to: `curiosity` (75), `aspiration` (71)
- Suggestion: "Add specific outcomes or transformations to evoke aspiration"

**Anti-Pattern Warnings:**
- "It's pretty good" → Vague, no specifics (suggest: specific metric or example)
- "various things" → Generic (suggest: list 2-3 specific use cases)
- "Would recommend" → Weak CTA (suggest: direct value statement)

**Full Rewrite (Hook-Optimized):**
```
"Claude Code changed how I ship code.

In 6 months:
- Debugging time: -80%
- Features shipped: 3x more
- Custom skills: Game changer for repetitive tasks

The trick most devs miss? Setting up the right workflows.

Here's the exact setup that made the difference:"
```
Estimated Score: 74 (+32 from original 42)

---

### Example with Image Upload

**Input:**
- Text: "Here's my Claude Code setup"
- Image: Screenshot of terminal with Claude Code running

**Visual Recommendations:**
```
📷 Visual Analysis
─────────────────────────────────────────
Composition:     Centered (suboptimal)
                 → Try: Crop to highlight key area

Colors:          Dark terminal (low contrast)
                 → Add: Colored annotations or highlights

Text Overlay:    None detected
                 → Suggest: Add title overlay "My Claude Setup"

Scroll-Stop:     48/100 (WEAK)
                 → Missing: Eye-catching element, clear focal point
                 → Add: Arrow pointing to key feature, or before/after

Alt Text:        None provided
                 → Recommended: "Claude Code terminal showing custom
                   skill execution with 3-second response time"

Platform Fit:    16:9 aspect (suboptimal for Twitter)
                 → Crop to: 1:1 or 4:3 for better feed presence
```

**Combined Score Impact:**
- Text improvements: +32 points
- Visual improvements: +15 points
- Total potential: 89 (from original 42)

---

## Success Metrics

- **Improvement adoption rate**: How often users apply suggestions
- **Score increase**: Average improvement from draft → published
- **Time to publish**: Faster iteration with AI rewrites
- **Engagement lift**: Does improved content actually perform better?

---

## Next Steps

1. Review this spec and confirm direction
2. Build `content-improver.ts` with basic pattern matching
3. Add "Improve Mode" toggle to UI
4. Implement rewrite generation via Claude
5. Add line-by-line suggestion UI
6. Test with real drafts and iterate

---

## Summary

**What we're building:** A new "Improve Mode" for ContentForge that sits alongside the existing "Analyze Mode".

**Key capabilities:**
- Draft text input with optional media upload (images, videos, GIFs)
- Applies ALL learned patterns from Mind (hooks, topics, subtopics, emotions)
- Generates specific rewrites (not vague advice)
- Visual analysis for uploaded media (composition, colors, scroll-stop score)
- Line-by-line improvement suggestions
- Anti-pattern warnings
- Estimated score impact for each recommendation

**Both modes work together:**
- **Analyze Mode**: Score published content → Learn patterns → Store in Mind
- **Improve Mode**: Apply learned patterns → Fix drafts → Better content

*The more you analyze, the smarter your improvements become.*
