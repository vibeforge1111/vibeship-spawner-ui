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
│                      │ - Topics     │                            │
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
│   │   └── +page.svelte              # Main UI (1500+ lines)
│   ├── api/contentforge/bridge/
│   │   ├── write/+server.ts          # Write content + bundle H70 skills
│   │   ├── status/+server.ts         # Worker heartbeat & progress
│   │   ├── pending/+server.ts        # Worker discovers work
│   │   └── result/+server.ts         # Result storage (polling fallback)
│   ├── api/x/tweet/
│   │   └── +server.ts                # X/Twitter API - fetch tweets
│   └── api/events/
│       └── +server.ts                # SSE event bridge
│
├── lib/
│   ├── services/
│   │   ├── contentforge-bridge.ts    # Bridge service (UI ↔ Worker)
│   │   ├── contentforge-queue.ts     # Queue management for batch analysis
│   │   ├── contentforge-mind.ts      # Mind v5 integration
│   │   ├── ralph-contentforge.ts     # Iterative self-improvement mode
│   │   ├── viral-patterns.ts         # Pattern extraction & learning
│   │   ├── topic-learning.ts         # Niche topic intelligence
│   │   ├── x-api.ts                  # X/Twitter API client
│   │   └── event-bridge.ts           # Real-time SSE bridge
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

### 6. Topic Intelligence (Niche Learning)

Learns what TOPICS resonate in your niche, not just patterns. Tracks categories like "vibe coding", "Claude", "AI tools" etc.

**Default Niche: Vibe Coding & AI Tools**
```typescript
primaryTopics: [
  'vibe coding', 'claude code', 'ai coding', 'ai assisted development',
  'cursor ai', 'copilot', 'ai agents', 'mcp servers', 'prompt engineering'
]
```

**What It Tracks:**
- **Hot Topics**: High-performing topics your audience loves
- **Rising Topics**: Trending up in engagement
- **Declining Topics**: Saturated or losing traction
- **Gap Topics**: Topics in your niche you haven't explored yet

**Key Functions:**
```typescript
import {
  extractTopicsFromContent,
  storeTopicPerformance,
  getTopicInsights,
  generateContentIdeas,
  getCurrentNiche,
  setNiche
} from '$lib/services/topic-learning';

// Extract topics from content
const topics = extractTopicsFromContent(content);
// { primary: ['claude code', 'ai agents'], secondary: ['automation'], sentiment: 'positive', angle: 'build-in-public' }

// Store topic performance after analysis
await storeTopicPerformance(topics, viralityScore, content, author);

// Get insights for UI
const insights = await getTopicInsights();
// { hotTopics, risingTopics, saturatedTopics, gapTopics, recommendations }

// Generate content ideas based on learnings
const ideas = await generateContentIdeas();
```

**Content Angles Detected:**
- `contrarian` - Hot takes, unpopular opinions
- `educational` - How-to, tutorials, guides
- `build-in-public` - Shipped, launched, built
- `deep-dive` - Threads, breakdowns
- `lessons-learned` - Mistakes, learnings
- `prediction` - Future, next year
- `comparison` - X vs Y, better than
- `productivity-hack` - Saved time, efficiency

**Key Files:**
- `topic-learning.ts` - Topic extraction, storage, and insights

### 7. Mind v5 Integration

Persistent memory for learning and improvement.

**What Gets Stored:**
- Analysis results (content, score, insights)
- Viral patterns learned
- Topic performance data
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

### 8. X API Integration (Tweet Fetching)

Fetches real tweets with engagement metrics for analysis.

**Input Modes:**
1. **Tweet URL** - Paste `x.com` or `twitter.com` URL → Fetches full tweet data
2. **Raw Text** - Paste any text directly for analysis

**Supported URL Formats:**
```
https://x.com/username/status/1234567890
https://twitter.com/username/status/1234567890
https://x.com/i/web/status/1234567890
1234567890 (just the ID)
```

**What Gets Fetched:**
- Tweet content (text)
- Author info (name, username, followers, verified status)
- Engagement metrics (likes, retweets, replies, quotes, bookmarks, impressions)
- Media attachments (photos, videos, GIFs)
- Tweet type (original, retweet, reply, quote)
- Timing (posted date/time)

**Key Functions:**
```typescript
import { extractTweetId, fetchTweetFromAPI, formatTweetForAnalysis } from '$lib/services/x-api';

// Extract ID from any URL format
const tweetId = extractTweetId('https://x.com/user/status/123');

// Fetch from X API (server-side only)
const result = await fetchTweetFromAPI(tweetId, bearerToken);

// Format for analysis
const formatted = formatTweetForAnalysis(result.tweet);
```

**Key Files:**
- `x-api.ts` - X API client service
- `/api/x/tweet` - Server endpoint (requires `X_BEARER_TOKEN`)

### 9. Event Bridge (Real-Time Communication)

Enables real-time updates between Worker and UI via Server-Sent Events (SSE).

**Architecture:**
```
Worker                    Server                    UI
  │                         │                        │
  │ POST /api/events ──────▶│                        │
  │                         │ emit(event) ──────────▶│ SSE
  │                         │                        │ onmessage()
```

**Worker Sends Events:**
```bash
# Send analysis result
curl -X POST http://localhost:5173/api/events \
  -H "Content-Type: application/json" \
  -d '{"type":"contentforge_analysis_complete","data":{...}}'
```

**UI Receives Events:**
```typescript
import { clientEventBridge, eventBridgeStatus } from '$lib/services/event-bridge';

// Subscribe to events
clientEventBridge?.subscribe((event) => {
  if (event.type === 'contentforge_analysis_complete') {
    handleResult(event.data);
  }
});

// Check connection status
$: status = $eventBridgeStatus; // 'connected' | 'connecting' | 'disconnected'
```

**Event Types:**
| Type | Purpose |
|------|---------|
| `contentforge_analysis_complete` | Worker finished analysis |
| `progress` | Task progress update |
| `connected` | SSE connection established |

**Key Files:**
- `event-bridge.ts` - Server + client bridge classes
- `/api/events` - SSE endpoint (GET) + event receiver (POST)

---

## Environment Variables

```bash
# Required for Tweet URL mode (fetching real tweets)
X_BEARER_TOKEN=your_bearer_token_here

# Optional - for posting tweets (not yet implemented)
X_API_KEY=your_api_key_here
X_API_SECRET=your_api_secret_here
X_ACCESS_TOKEN=your_access_token_here
X_ACCESS_TOKEN_SECRET=your_access_token_secret_here
```

**Getting X API Credentials:**
1. Go to https://developer.x.com/en/portal/dashboard
2. Create a project and app
3. Copy the Bearer Token from "Keys and tokens"
4. Add to `.env` file

**Note:** Without `X_BEARER_TOKEN`, you can still use Raw Text mode - just paste content directly instead of URLs.

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

### GET /api/x/tweet
Fetch tweet data from X/Twitter API.

**Request:**
```
GET /api/x/tweet?url=https://x.com/user/status/1234567890
```

**Response:**
```json
{
  "success": true,
  "tweet": {
    "id": "1234567890",
    "text": "Tweet content...",
    "author": { "username": "user", "followers": 10000, "verified": true },
    "metrics": { "likes": 500, "retweets": 100, "impressions": 50000 },
    "media": [],
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "formattedContent": "# Tweet Analysis Request\n..."
}
```

**Errors:**
| Code | Message |
|------|---------|
| 400 | Invalid tweet URL or ID format |
| 404 | Tweet not found or deleted |
| 429 | Rate limit exceeded |
| 503 | X API not configured (missing X_BEARER_TOKEN) |

### POST /api/events
Worker sends events to broadcast via SSE.

**Request:**
```json
{
  "type": "contentforge_analysis_complete",
  "data": { "requestId": "...", "synthesis": {...} }
}
```

**Response:**
```json
{ "success": true, "eventId": "evt-1234567890-abc123" }
```

### GET /api/events
SSE stream for real-time updates.

**Response:** Server-Sent Events stream
```
data: {"type":"connected","timestamp":"2024-01-15T10:30:00Z"}

data: {"type":"contentforge_analysis_complete","data":{...}}
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

### Content Generation (Planned)
Move from analysis-only to content creation:
- Generate content based on learned patterns + topics
- Use Topic Intelligence to suggest trending angles
- Iterate until quality threshold met (Ralph Mode)
- A/B test variations

### Multi-Platform Support (Planned)
Extend beyond Twitter/X:
- LinkedIn-specific analysis
- TikTok content patterns
- Cross-platform strategy

### Advanced Topic Analytics (Planned)
Deeper niche intelligence:
- Time-series trend analysis
- Topic combination performance (A + B = viral)
- Competitor topic tracking
- Seasonal topic patterns

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

### Customizing Topic Intelligence
1. Create a new `NicheConfig` in `topic-learning.ts`
2. Call `setNiche(yourConfig)` to switch niches
3. Or extend the default: `addTopicsToNiche(['new topic'], 'primary')`

```typescript
// Example: Add a new niche
const INDIE_HACKER_NICHE: NicheConfig = {
  name: 'Indie Hacking',
  description: 'Content about bootstrapping, solo founders, MRR',
  primaryTopics: ['indie hacking', 'bootstrapping', 'mrr', 'solopreneur'],
  relatedTopics: ['saas', 'marketing', 'growth'],
  keywords: ['launched', 'revenue', 'customers', 'churn', 'ltv']
};
setNiche(INDIE_HACKER_NICHE);
```
