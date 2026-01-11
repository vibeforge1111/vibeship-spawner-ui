# ContentForge - Viral Content Analysis Engine

ContentForge is an AI-powered content analysis system that learns what makes content go viral. It uses Claude Code with H70 expert skills to analyze tweets and text, building a memory of patterns that work.

## Quick Start

### Prerequisites
1. **Spawner UI** running at `http://localhost:5173`
2. **Mind v5 Lite** running at `http://localhost:8080` (for learning)
3. **Claude Code** connected (the AI worker)

### Start Everything
```bash
# Terminal 1: Spawner UI
cd C:\Users\USER\Desktop\spawner-ui && npm run dev

# Terminal 2: Mind v5
cd C:\Users\USER\Desktop\the-mind && start_mind_lite.bat

# Terminal 3: Claude Code (worker)
claude
# Then paste the worker prompt from ContentForge UI
```

### Access
- **ContentForge UI**: http://localhost:5173/contentforge
- **Mind Dashboard**: http://localhost:8501

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ContentForge System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   User UI    │───▶│  Bridge API  │───▶│ Claude Code  │       │
│  │  (+page)     │    │  (write,     │    │  (Worker)    │       │
│  │              │◀───│   status,    │◀───│              │       │
│  │              │    │   result)    │    │  + H70 Skills│       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                                       │                │
│         │            ┌──────────────┐           │                │
│         └───────────▶│   Mind v5    │◀──────────┘                │
│                      │  (Learning)  │                            │
│                      │              │                            │
│                      │ - Patterns   │                            │
│                      │ - History    │                            │
│                      │ - Insights   │                            │
│                      └──────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure (Active Files Only)

```
src/
├── routes/
│   ├── tools/contentforge/
│   │   └── +page.svelte              # Main UI (1400 lines)
│   └── api/contentforge/bridge/
│       ├── write/+server.ts          # Write content + bundle H70 skills
│       ├── status/+server.ts         # Worker heartbeat & progress
│       ├── pending/+server.ts        # Worker discovers work
│       └── result/+server.ts         # Result storage (polling fallback)
│
├── lib/
│   ├── services/
│   │   ├── contentforge-bridge.ts    # Bridge service (UI ↔ Worker)
│   │   ├── contentforge-queue.ts     # Queue management for batch analysis
│   │   ├── contentforge-mind.ts      # Mind v5 integration
│   │   ├── ralph-contentforge.ts     # Iterative self-improvement mode
│   │   └── viral-patterns.ts         # Pattern extraction & learning
│   │
│   └── components/contentforge/
│       └── ContentQueue.svelte       # Queue sidebar UI
```

---

## Core Systems

### 1. Bridge System (Worker Communication)

The bridge enables communication between the UI and Claude Code worker.

**Flow:**
1. User enters content → UI calls `POST /api/contentforge/bridge/write`
2. Server bundles content + 8 H70 skills → writes to `.spawner/pending-contentforge.md`
3. Worker polls `GET /api/contentforge/bridge/pending` every 30s
4. Worker analyzes with real AI, updates progress via `PATCH /api/contentforge/bridge/status`
5. Worker posts result to `POST /api/contentforge/bridge/result` AND `POST /api/events`
6. UI receives result via SSE or polling fallback

**Key Files:**
- `contentforge-bridge.ts` - Client-side bridge service
- `/api/bridge/*` - Server endpoints

### 2. H70 Skills System

ContentForge uses 8 specialized H70 skills for expert analysis:

| Skill | Purpose | Agent |
|-------|---------|-------|
| `viral-marketing` | STEPPS framework, K-Factor | Marketing |
| `copywriting` | Hook formulas, 4 U's, PAS/AIDA | Copywriting |
| `viral-hooks` | Hook patterns, attention capture | Copywriting, Psychology |
| `content-strategy` | Content planning, distribution | Research |
| `persuasion-psychology` | Cialdini's principles, biases | Psychology |
| `platform-algorithms` | Twitter/X, LinkedIn ranking signals | Marketing |
| `audience-psychology` | Psychographics, sharing triggers | Research, Psychology |
| `narrative-craft` | Story structures, micro-narratives | Copywriting |

**Skills Location:** `C:/Users/USER/Desktop/vibeship-h70/skill-lab/`

**Skill Loading:** Skills are bundled with every request in `/api/bridge/write/+server.ts`

### 3. Queue System

Allows batch analysis of multiple content items.

**Features:**
- Sequential processing (one at a time)
- Status tracking (queued → processing → complete/error)
- Click to view results of completed items
- Queue stats (total, completed, pending, avg score)

**Key Files:**
- `contentforge-queue.ts` - Queue state management
- `ContentQueue.svelte` - Queue sidebar UI

**Usage:**
```typescript
import { addToQueue, queueItems, isQueueProcessing } from '$lib/services/contentforge-queue';

// Add item to queue
addToQueue(content);

// Subscribe to queue state
$: items = $queueItems;
$: processing = $isQueueProcessing;
```

### 4. Viral Pattern Learning

Automatically extracts and learns patterns from analyzed content.

**Pattern Categories:**
- **Hooks**: contrarian, curiosity_gap, transformation, number_list, direct_claim, question, story, shock
- **Structures**: single_punch, thread, visual_text, listicle
- **Emotions**: fomo, aspiration, curiosity, validation, outrage, awe
- **Timing**: optimal posting times
- **Formats**: media types, length optimization

**Key Files:**
- `viral-patterns.ts` - Pattern extraction and storage
- Mind v5 stores patterns with virality scores

**Learning Loop:**
```
Content Analyzed → extractPatternsFromAnalysis() → storePatternsInMind()
                                                          ↓
                                                   Pattern Stats Updated
                                                          ↓
                                                   UI Shows Top Performers
```

### 5. Ralph Mode (Iterative Self-Improvement)

Optional mode that iterates until quality threshold is met.

**Config:**
- `maxIterations`: 5 (default)
- `qualityThreshold`: 75 (virality score)
- `requiredAgents`: all 4 agents

**Flow:**
1. Query Mind for past learnings
2. Generate enhanced prompt with context
3. Analyze content
4. If score < threshold → would iterate (currently single-pass)
5. Record success/blocker to Mind

**Key Files:**
- `ralph-contentforge.ts` - Ralph loop logic

### 6. Mind v5 Integration

Persistent memory for learning and improvement.

**What Gets Stored:**
- Analysis results (content, score, insights)
- Viral patterns learned
- Success/failure records
- User style profile

**Key Functions:**
```typescript
// Save analysis
await saveAnalysisToMind(content, { viralityScore, keyInsights, hookType, emotionalTrigger, patterns });

// Query learnings
const patterns = await queryLearnedPatterns();
const style = await getUserStyle();
const enhanced = await getEnhancedLearnings();
```

**Key Files:**
- `contentforge-mind.ts` - Mind integration service

---

## API Reference

### POST /api/contentforge/bridge/write
Write content for analysis with bundled H70 skills.

**Request:**
```json
{
  "content": "Tweet or text to analyze",
  "requestId": "cf-1234567890-abc123"
}
```

**Response:**
```json
{
  "success": true,
  "path": ".spawner/pending-contentforge.md",
  "requestId": "cf-1234567890-abc123",
  "skillsLoaded": 8
}
```

### GET /api/contentforge/bridge/pending
Worker discovers pending work.

**Response (when work available):**
```json
{
  "pending": true,
  "requestId": "cf-1234567890-abc123",
  "contentPath": ".spawner/pending-contentforge.md"
}
```

### PATCH /api/contentforge/bridge/status
Worker reports progress.

**Request:**
```json
{
  "action": "start|progress|complete|error",
  "requestId": "cf-1234567890-abc123",
  "task": "Marketing Agent analyzing...",
  "step": "Marketing Agent complete"
}
```

### POST /api/contentforge/bridge/result
Worker stores result (polling fallback).

**Request:**
```json
{
  "requestId": "cf-1234567890-abc123",
  "data": {
    "synthesis": { "viralityScore": 75, "keyInsights": [...] },
    "orchestrator": { "agentResults": {...} }
  }
}
```

---

## Worker Protocol

When Claude Code acts as the ContentForge worker:

1. **Register**: `POST /api/contentforge/bridge/status` with `{"version": "claude-code"}`
2. **Poll**: `GET /api/contentforge/bridge/pending` every 30 seconds
3. **When work found**:
   - STOP POLLING until done
   - Read content file at `contentPath`
   - Use bundled H70 skills for 4-agent analysis
   - Update progress via PATCH status
4. **Send result** to BOTH:
   - `POST /api/contentforge/bridge/result`
   - `POST /api/events` with type `contentforge_analysis_complete`
5. **Cleanup**: `DELETE /api/contentforge/bridge/pending`
6. **Resume polling**

---

## Analysis Output Format

```typescript
interface ContentForgeResult {
  requestId: string;
  success: boolean;
  postId: string;

  orchestrator: {
    success: boolean;
    processingTimeMs: number;
    agentResults: {
      marketing: { positioning, distributionFactors };
      copywriting: { hook, structure };
      research: { trendContext };
      psychology: { emotionalTriggers, identityResonance };
    };
  };

  synthesis: {
    viralityScore: number;  // 0-100
    keyInsights: string[];
    patternCorrelations: Array<{ pattern: string; correlation: number }>;
    playbook: {
      title: string;
      summary: string;
      steps: Array<{ order: number; action: string; rationale: string }>;
    };
  };
}
```

---

## Learning & Memory

### Pattern Storage in Mind
Patterns are stored as memories with content type `viral_pattern`:
- Pattern name and category
- Average virality score
- Sample size and confidence level
- Example content sources

### User Style Profile
Aggregated from all analyses:
- Total analyzed count
- Average virality score
- Most used hooks
- Preferred emotions
- Effective patterns

### Enhanced Learnings
Advanced analytics:
- Engagement correlations (pattern → engagement)
- Visual insights (media type performance)
- Content type performance (thread vs single)
- Trend data over time

---

## Configuration

### Environment
- **H70 Skills Path**: `C:/Users/USER/Desktop/vibeship-h70/skill-lab`
- **Mind v5 API**: `http://localhost:8080`
- **Spawner UI**: `http://localhost:5173`

### Timeouts
- Analysis timeout: 5 minutes (300,000ms)
- Worker poll interval: 30 seconds
- Status poll interval: 2 seconds

### Ralph Mode Defaults
```typescript
const DEFAULT_RALPH_CONFIG = {
  maxIterations: 5,
  qualityThreshold: 75,
  requiredAgents: ['marketing', 'copywriting', 'research', 'psychology'],
  minRecommendations: 3
};
```

---

## Troubleshooting

### Worker Not Connected
- Check if Claude Code is running
- Paste the worker prompt from UI
- Verify status endpoint: `curl http://localhost:5173/api/contentforge/bridge/status`

### Analysis Stuck
- Check worker progress in UI
- Look for errors in Claude Code terminal
- Verify Mind v5 is running: `curl http://localhost:8080/health`

### Skills Not Loading
- Verify skills exist: `ls C:/Users/USER/Desktop/vibeship-h70/skill-lab/viral-marketing`
- Check console for warnings about missing skills

### Queue Not Processing
- Verify `isQueueProcessing` store state
- Check if worker is connected
- Look for errors in queue item status

---

## Future Improvements

### Topic/Category Learning (Planned)
Learn not just patterns but topics that resonate in specific niches:
- Track topic categories (vibe coding, Claude, AI tools)
- Learn what subjects get engagement
- Co-create content ideas based on trending topics

### Content Generation (Planned)
Move from analysis-only to content creation:
- Generate content based on learned patterns
- Iterate until quality threshold met
- A/B test variations

### Multi-Platform Support (Planned)
Extend beyond Twitter/X:
- LinkedIn-specific analysis
- TikTok content patterns
- Cross-platform strategy

---

## Contributing

### Adding New Skills
1. Create skill in H70 skill-lab: `vibeship-h70/skill-lab/{skill-name}/skill.yaml`
2. Add skill ID to `CONTENTFORGE_SKILLS` array in `/api/bridge/write/+server.ts`
3. Map skill to agent in `agentSkills` object

### Extending Pattern Learning
1. Add pattern category to `viral-patterns.ts`
2. Update extraction logic in `extractPatternsFromAnalysis()`
3. Update Mind storage format if needed

### Adding New Agent
1. Add agent to `agentSkills` mapping in bridge write endpoint
2. Update analysis instructions in bridge write
3. Update UI to display agent results
