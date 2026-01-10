# CLAUDE.md - Spawner UI

This file provides guidance to Claude Code when working with the spawner-ui codebase.

## Project Overview

Spawner UI is a SvelteKit application that provides a visual canvas for building AI agent workflows. It allows users to:
- Create visual pipelines of skills/agents
- Execute multi-step missions
- Track progress through the Mind system

## H70 Skills - DEFAULT MCP (USE THIS FIRST)

**CRITICAL: This project uses H70 skills as the DEFAULT and PRIMARY skill source.**

### Why H70 is Default

- **480 valid skills** available locally (verified, all YAML parses correctly)
- **Zero network latency** - skills loaded from local disk
- **No API costs** - no external service calls required
- **More comprehensive** - H70 skills include identity, disasters, anti-patterns, patterns

### Spawner H70 MCP Server

This repo includes a **local MCP server** for H70 skills at `mcp-h70/`.

**ALWAYS use this MCP first:**
```
mcp__spawner_h70__spawner_h70_skills with action="get" and name="skill-id"
```

**Available actions:**
- `get`: Get full skill content by ID (e.g., `name="drizzle-orm"`)
- `list`: List all 480 available H70 skills
- `search`: Search skills by query (e.g., `query="authentication"`)

### Skill Loading Priority (ALWAYS FOLLOW THIS ORDER)

1. **spawner-h70 MCP** (DEFAULT): Local `mcp-h70/` server - USE THIS FIRST
2. **H70 API** (Fallback): `/api/h70-skills/[skillId]` endpoint
3. **vibeship-spawner MCP** (Legacy): `mcp.vibeship.co` - only if H70 unavailable

### H70 Skill Format

H70 skills are comprehensive YAML files with:
- `identity`: Expert persona and background
- `owns`: Specific areas of expertise
- `delegates`: When to hand off to other skills
- `disasters`: War stories and critical lessons
- `anti_patterns`: Common mistakes to avoid
- `patterns`: Recommended implementation patterns
- `triggers`: Activation phrases

### Key Files

- `mcp-h70/index.js` - Local H70 MCP server (PRIVATE)
- `src/lib/services/h70-skills.ts` - H70 skill service for frontend
- `src/routes/api/h70-skills/[skillId]/+server.ts` - API route for H70 skills
- `src/lib/services/canvas-sync.ts` - Canvas sync (uses H70 first)
- `static/skills.json` - Skills metadata (migrated from H70)

### Testing H70 Skills

```bash
# Via MCP (in Claude Code):
# Use spawner_h70_skills tool with action="get", name="drizzle-orm"

# Via API:
curl http://localhost:5173/api/h70-skills/drizzle-orm | jq .source
# Should return: "h70-local"
```

## H70 Skills as Development Guidance

**CRITICAL: Always load and follow relevant H70 skills when doing ANY development work.**

### Before Starting Work

1. **Identify relevant skills** for the task (e.g., `typescript-strict`, `code-quality`, `test-architect`, `sveltekit`)
2. **Read the skill file** from `C:/Users/USER/Desktop/vibeship-h70/skill-lab/{skill-name}/skill.yaml`
3. **Check these sections:**
   - `disasters`: Real failures to avoid (fear-first learning)
   - `anti_patterns`: What NOT to do
   - `patterns`: What TO do with implementation examples
   - `gotchas`: Common traps everyone falls into

### Key Skills for This Codebase

| Task Type | H70 Skills to Load |
|-----------|-------------------|
| TypeScript/Types | `typescript-strict` |
| Code quality/cleanup | `code-quality` |
| Testing | `test-architect` |
| SvelteKit/Svelte | `sveltekit` |
| Security | `security-owasp` |
| API design | `api-design` |
| State management | `state-management` |

### Principles from H70 Skills

**From `code-quality`:**
- Readable before clever - "Would a new team member understand this in 10 seconds?"
- Rule of Three - Don't abstract until you see the pattern 3 times
- Comments explain WHY, not WHAT
- Pragmatic SOLID - principles are guidelines, not laws

**From `typescript-strict`:**
- Ban `any` - use `unknown` and narrow with Zod
- Never use `!` (non-null assertion) - use `?.` or explicit checks
- Never use `as Type` on external data - validate with Zod
- Discriminated unions for state machines

**From `test-architect`:**
- Test pyramid: 70% unit, 20% integration, 10% E2E
- Zero flaky test tolerance
- Fakes over mocks - test behavior, not implementation
- Coverage is a lie - use mutation testing to verify tests catch bugs

### DO NOT Over-Engineer

The H70 skills explicitly warn against:
- Adding abstractions before you need them
- "Clean Code" taken to extremes (47 files for one button)
- DRY applied too early (wrong abstraction > duplication)
- Patterns without the problems they solve

**Simple, readable code that works > "properly architected" complexity**

## PRD-to-Skill Matching System

### CRITICAL RULES (DO NOT CHANGE)

1. **Just-in-time skill loading** - Copy-paste prompt contains skill IDs only, NOT content
2. **Claude Code loads skills when needed** - Via MCP or direct file read before each task
3. **FULL skill content at execution time** - identity, disasters, anti-patterns, patterns
4. **MAX_SKILLS_TO_SUGGEST = 50** - Cap at 50 skills maximum
5. **skill-matcher.ts MUST import KEYWORD_TO_SKILLS** from h70-skill-matcher.ts (391 mappings)
6. **PRD matching uses H70 keywords** - Different PRDs MUST get different skills

**WHY just-in-time?** Full skills with 50 entries = 20,000+ lines = crashes terminals!
Instead, we list skill IDs and Claude Code fetches them one-by-one when executing each task.

### System Architecture

```
PRD Input ("Describe what you want to build")
    |
    v
+------------------------------------------+
| 1. GOAL ANALYZER (goal-analyzer.ts)      |
|    - Extracts: keywords, technologies,   |
|      features, domains                   |
|    - Calculates confidence score         |
+------------------------------------------+
    |
    v
+------------------------------------------+
| 2. SKILL MATCHER (skill-matcher.ts)      |
|    - IMPORTS KEYWORD_TO_SKILLS (391)     |
|    - H70 keyword matching (primary)      |
|    - Multi-word phrase matching          |
|    - MCP server matching (if connected)  |
|    - Returns PRD-specific skills         |
+------------------------------------------+
    |
    v
+------------------------------------------+
| 3. WORKFLOW GENERATOR                    |
|    - Creates canvas nodes from skills    |
|    - Positions by tier (1=essential)     |
|    - Infers connections                  |
+------------------------------------------+
    |
    v
+------------------------------------------+
| 4. MISSION BUILDER (mission-builder.ts)  |
|    - Uses h70-skill-matcher.ts           |
|    - Loads FULL skill content via        |
|      loadSkillsForMission()              |
+------------------------------------------+
    |
    v
+------------------------------------------+
| 5. EXECUTION PROMPT (JUST-IN-TIME)       |
|    - Task list with skill IDs only       |
|    - Instructions to fetch full skills   |
|    - Claude Code loads skills per task   |
+------------------------------------------+
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/types/goal.ts` | `MAX_SKILLS_TO_SUGGEST: 50`, `getDynamicSkillLimit()` |
| `src/lib/services/skill-matcher.ts` | PRD -> initial skill matching |
| `src/lib/services/h70-skill-matcher.ts` | 391 keyword mappings -> H70 skill IDs |
| `src/lib/services/h70-skills.ts` | `loadSkillsForMission()` - loads full skills for matching/UI |
| `src/lib/services/mission-builder.ts` | Builds missions, generates prompt with skill IDs (just-in-time) |

### Skill Limits

| Setting | Value | Location |
|---------|-------|----------|
| MAX_SKILLS_TO_SUGGEST | 50 | `goal.ts` |
| Max skills per task | 3-5 (dynamic) | `mission-builder.ts` |
| Max total skills | 15-50 (dynamic) | `mission-builder.ts` |
| Keyword mappings | 391 | `h70-skill-matcher.ts` |
| Total H70 skills available | 470 | `static/skills.json` |

### Dynamic Skill Calculation

```typescript
// Per task: 3-5 skills based on task count
maxPerTask = Math.min(5, Math.max(3, Math.ceil(taskCount / 3)))

// Total: 15-50 based on complexity
maxTotal = Math.min(50, Math.max(15, 15 + taskCount * 2))

// From PRD analysis: 15-50 based on word count and features
getDynamicSkillLimit(wordCount, featureCount) =
  Math.min(50, Math.max(15, 15 + wordCount/100 + featureCount))
```

### DO NOT

- Do NOT set MAX_SKILLS_TO_SUGGEST above 50
- Do NOT modify the h70-skill-matcher keyword mappings without good reason
- Do NOT remove the `import { KEYWORD_TO_SKILLS }` from skill-matcher.ts
- Do NOT revert skill-matcher.ts to only use the ~40 local TECH_TO_SKILLS/FEATURE_TO_SKILLS mappings
- Do NOT include skill CONTENT in copy-paste prompt (just skill IDs - content is loaded just-in-time)
- Do NOT use condensed/truncated skill content - always load FULL skills at execution time

## PRD Analyzer Rules (prd-analyzer.ts)

### CRITICAL: Semantic Matching with Reasonable Limits

The PRD analyzer (`src/lib/utils/prd-analyzer.ts`) generates workflow tasks from PRD content.

**DIFFERENT PRDs MUST GENERATE DIFFERENT WORKFLOWS!**
**BUT WORKFLOWS MUST BE MANAGEABLE (5-30 tasks, not 249!)**

### Task Limits

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_FEATURE_TASKS` | 20 | Max feature tasks (before consolidation) |
| `MAX_TOTAL_TASKS` | 30 | Absolute max including infra + deployment |

### DO NOT

- Do NOT create hardcoded task structures
- Do NOT generate unlimited tasks (previous bug: 249 tasks crashed the system)
- Do NOT use direct keyword matching - use SEMANTIC SCORING
- Do NOT extract features from every sentence/bullet point
- Do NOT assume every project needs all infrastructure

### Semantic Scoring System

Features are scored using TF-IDF-like relevance:

```typescript
// Feature relevance score (0-1):
score = baseScore(0.5)
      + categoryBonus(0.2 if non-general)
      + priorityBonus(0.2 for must-have, -0.1 for nice-to-have)
      + keywordDensityBonus(0.05 per keyword match, max 0.2)
      + sectionBonus(0.3 if in explicit "Features" section)
```

Skills are matched using semantic scoring:
```typescript
// Skill match score:
relevance = exactMatch(1.0) | contains(0.7) | contained(0.5) | wordOverlap(0.3)
score = relevance + positionBonus(earlier in H70 list = higher)
```

### Feature Consolidation

When a category has >3 features, they're consolidated:
- Keep top 3 by relevance score
- Merge rest into "Additional {Category} Features" task

### Feature Extraction (Selective)

Only extracts from:
1. **Explicit feature lists** (bulleted/numbered in Features section) - highest score
2. **User stories** ("As a user, I want...") - bonus score
3. **Category detection** (only if <5 explicit features found) - fallback

**NOT extracted**: Every paragraph pattern, generic bullets, section headers

### Task Generation Rules

1. **Project Setup**: Only if stack defined
2. **Design System**: Only if `needsFrontend`
3. **Auth/Database/API**: Only if detected
4. **Feature Tasks**: Limited by `availableFeatureSlots = MAX_TOTAL_TASKS - infraTasks - 2`
5. **Testing/Deployment**: Only if complex (>3 features) or explicitly needed

### Expected Output

| PRD Type | Expected Tasks |
|----------|----------------|
| Simple landing page | 5-8 tasks |
| Standard webapp | 10-15 tasks |
| Complex SaaS | 20-25 tasks |
| Maximum (capped) | 30 tasks |

## Common Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Type check
npm run check
```

## Architecture

### Tech Stack
- **Framework**: SvelteKit 2 with Svelte 5 runes
- **Styling**: Tailwind CSS with Vibeship Design System
- **State**: Svelte stores with `$state` and `$derived`
- **Canvas**: Custom node-based editor in `$lib/stores/canvas.svelte`

### Key Directories

```
src/
├── lib/
│   ├── components/    # Svelte components
│   ├── services/      # Business logic (canvas-sync, mission-executor, h70-skills)
│   ├── stores/        # State management
│   └── types/         # TypeScript types
├── routes/
│   ├── api/           # API endpoints (including h70-skills)
│   ├── canvas/        # Canvas page
│   ├── skills/        # Skills browser
│   └── missions/      # Missions page
└── static/
    └── skills.json    # Skills metadata
```

### Vibeship Design System

- No rounded corners (square/sharp aesthetic)
- Teal accent colors (`accent-primary`, `accent-secondary`)
- Monospace fonts for technical content
- Surface borders using `border-surface-border`

## Mission Execution Flow

1. User builds workflow on canvas (skill nodes + connections)
2. Canvas validates workflow structure
3. `mission-builder.ts` converts canvas to Mission object
4. `mission-executor.ts` manages execution state
5. Skills are loaded from H70 (primary) or MCP (fallback)
6. Progress events sent via EventBridge
7. Results displayed in ExecutionPanel

## Environment

- **H70 Skills Path**: `C:/Users/USER/Desktop/vibeship-h70/skill-lab`
- **Dev Server**: `http://localhost:5173`
- **MCP Fallback**: `https://mcp.vibeship.co/mcp`
- **Mind v5 API**: `http://localhost:8080`
- **Mind Dashboard**: `http://localhost:8501`

## Mind v5 - Memory System

Mind v5 provides persistent memory for learning and improvement. See `MIND.md` for full documentation.

### Quick Reference

**Start Mind v5:**
```bash
# From C:\Users\USER\Desktop\the-mind:
start_mind_lite.bat
```

### The Five Tabs (at /mind)

| Tab | Purpose | Auto-Created |
|-----|---------|--------------|
| **Learnings** | Task outcomes and patterns | Yes, after each task |
| **Improvements** | System improvement suggestions | Yes, after missions |
| **Decisions** | What was accomplished | Yes, on task success |
| **Issues** | Problems and blockers | Yes, on task failure |
| **Sessions** | Mission summaries | Yes, after missions |

### Key Behaviors

1. **Auto-capture**: Mind automatically records everything during mission execution
2. **Auto-apply improvements**: All improvements are applied automatically (no pending state)
3. **UTC timestamps**: Stored in UTC, displayed in local time
4. **Pagination**: Learnings load 50 initially, click "Load All" for more

### Memory Content Types

- `agent_learning`, `task_outcome` - Learnings tab
- `project_decision` - Decisions tab
- `project_issue` - Issues tab
- `session_summary` - Sessions tab
- `*_improvement` - Improvements tab

### API Quick Reference

```bash
# Check connection
curl http://localhost:8080/health

# List recent memories
curl "http://localhost:8080/v1/memories/?limit=20"

# Search
curl -X POST http://localhost:8080/v1/memories/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication"}'
```

### Troubleshooting

- **Connection refused**: Start Mind with `start_mind_lite.bat`
- **Empty tabs**: Click the tab to trigger lazy loading
- **Improvements show "pending"**: Change filter from "Pending" to "All"
- **Learnings stuck at 50**: Click "Load All Learnings" button
