# CLAUDE.md - Spawner UI

This file provides guidance to Claude Code when working with the spawner-ui codebase.

---

## ⚠️ SPAWNER WORKFLOW EXECUTION RULES (CRITICAL)

**When executing Spawner workflows/missions, these rules are NON-NEGOTIABLE:**

### Rule 1: NO PAUSING FOR CONFIRMATION
- **NEVER** stop mid-workflow to ask "should I continue?"
- **NEVER** pause to ask for user confirmation between tasks
- Execute autonomously from start to finish
- Pausing breaks the UI state and corrupts the workflow bridge

### Rule 2: COMPLETE 100% OF THE PROJECT
- **NEVER** stop at 20%, 50%, or 80% completion
- **NEVER** say "I've set up the foundation, you can continue from here"
- **NEVER** leave placeholder code or TODO comments for the user to finish
- Complete ALL tasks in the pipeline until the project is fully functional
- A project is only "done" when it can be run and tested

### Rule 3: TEST AFTER COMPLETION
- After all tasks are complete, run the project
- Verify it builds without errors
- Verify core functionality works
- Report any issues found during testing
- Fix issues before declaring completion

### Rule 4: REPORT PROGRESS VIA EVENTS API
- Send `task_started` when beginning a task
- Send `task_progress` for significant milestones
- Send `task_completed` when finishing a task
- This keeps the UI in sync without requiring human interaction

### Rule 5: HANDLE ERRORS GRACEFULLY
- If a task fails, log the error and attempt to fix it
- If unfixable, move to the next task and note the blocker
- **NEVER** stop the entire workflow for a single task failure
- Complete as much as possible, then report all issues at the end

### Rule 6: ALWAYS SEND PROGRESS EVENTS (HEARTBEAT)
- **NEVER** go more than 60 seconds without sending a progress event
- During long operations (npm install, build, test runs), send `task_progress` events every 30-60 seconds
- Even if nothing has changed, send a heartbeat event: `{"type": "task_progress", "message": "Still working..."}`
- This prevents the UI from showing "disconnected" or "no progress" errors
- Long silence = UI thinks agent is dead = workflow corruption

**Example during npm install:**
```bash
# Before starting long operation
curl -X POST http://localhost:5173/api/events -H "Content-Type: application/json" -d '{"type": "task_progress", "data": {"message": "Installing dependencies (this may take 2-3 minutes)..."}}'

# Every 30-60 seconds during operation
curl -X POST http://localhost:5173/api/events -H "Content-Type: application/json" -d '{"type": "task_progress", "data": {"message": "Still installing dependencies..."}}'
```

**For detailed rules, see: `.spawner/RULES.md`**
**For future improvements roadmap, see: `.spawner/ROADMAP-COMPLETION-PIPELINE.md`**

---

## Project Overview

Spawner UI is a SvelteKit application that provides a visual canvas for building AI agent workflows. It allows users to:
- Create visual pipelines of skills/agents
- Execute multi-step missions
- Track progress through the Mind system

## Vibeship Skills Lab - PRIMARY SKILL SOURCE

**CRITICAL: This project uses the Vibeship Skills Lab as the PRIMARY skill source.**

### Skills Lab Location

`C:/Users/USER/Desktop/vibeship-skills-lab`

### Why Local Skills Lab

- **593 valid skills** sourced from spark-skill-graphs (H70-C+ format, 36 categories after remap)
- `sparknet-council` category is **remapped at build time** — the 52 breadth/literacy skills are assigned to their topical home (e.g. `machine-learning-fundamentals` → `ai`, `cybersecurity-fundamentals` → `security`). See `SPARKNET_COUNCIL_REMAP` in `scripts/build-skill-catalog.cjs` + `build-skill-index.cjs`.
- **Zero network latency** - skills loaded from local disk
- **No API costs** - no external service calls required
- **Comprehensive** - skills include identity, disasters, anti-patterns, patterns
- **Flat structure** - `{category}/{skill-name}.yaml` for easy browsing

### Skill Categories

Skills are organized by category:
- `ai/`, `ai-agents/`, `ai-tools/` - AI and ML skills
- `backend/`, `frontend/` - Core development
- `frameworks/` - SvelteKit, Next.js, etc.
- `game-dev/`, `gamedev/` - Game development (50+ skills)
- `marketing/`, `community/` - Growth and marketing
- `security/`, `compliance/` - Security patterns
- And 40+ more categories

### Skill Loading Priority

1. **Skills API** (PRIMARY): `/api/h70-skills/[skillId]` - loads from local Skills Lab
2. **vibeship-spawner MCP** (Legacy): `mcp.vibeship.co` - only if local unavailable

### H70-C+ Skill Format

Skills use the H70-C+ format with embedded detection commands:
- `identity`: Expert persona and background
- `owns`: Specific areas of expertise
- `delegates`: When to hand off to other skills
- `disasters`: War stories with `emotional_anchor` and `detection_command` EMBEDDED
- `anti_patterns`: Common mistakes with `detection` EMBEDDED
- `patterns`: Recommended implementation patterns
- `triggers`: Activation phrases

### Key Files

- `src/lib/services/h70-skills.ts` - Skill service for frontend
- `src/routes/api/h70-skills/[skillId]/+server.ts` - API route (searches across categories)
- `src/lib/services/h70-skill-matcher.ts` - Keyword-to-skill matching
- `static/skills.json` - Skills metadata (593 skills, synced from spark-skill-graphs)

### Testing Skills

```bash
# Via API:
curl http://localhost:5500/api/h70-skills/supabase-backend | grep source
# Returns: "source":"vibeship-skills-lab"

# Check category:
curl http://localhost:5500/api/h70-skills/react-native-specialist | grep category
# Returns: "category":"frontend"
```

## Skills as Development Guidance

**CRITICAL: Always load and follow relevant skills when doing ANY development work.**

### Before Starting Work

1. **Identify relevant skills** for the task (e.g., `typescript-strict`, `code-quality`, `test-architect`, `sveltekit`)
2. **Load via API**: `curl http://localhost:5500/api/h70-skills/{skill-id}`
3. **Or read directly** from `C:/Users/USER/Desktop/vibeship-skills-lab/{category}/{skill-name}.yaml`
4. **Check these sections:**
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
| `src/lib/services/h70-skill-matcher.ts` | 402 keyword mappings -> H70 skill IDs |
| `src/lib/services/h70-skills.ts` | `loadSkillsForMission()` - loads full skills for matching/UI |
| `src/lib/services/mission-builder.ts` | Builds missions, generates prompt with skill IDs (just-in-time) |

### Skill Limits

| Setting | Value | Location |
|---------|-------|----------|
| MAX_SKILLS_TO_SUGGEST | 50 | `goal.ts` |
| Max skills per task | 3-5 (dynamic) | `mission-builder.ts` |
| Max total skills | 15-50 (dynamic) | `mission-builder.ts` |
| Keyword mappings | 402 | `h70-skill-matcher.ts` |
| Total H70 skills available | 593 | `static/skills.json` (spark-skill-graphs) |

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

## Startup Checklist (REQUIRED FOR PRD TESTING)

**Before testing with PRDs or running missions, ensure these services are running:**

### 1. Spawner UI Dev Server
```bash
cd C:\Users\USER\Desktop\spawner-ui
npm run dev
# Runs at http://localhost:5173
```

### 2. H70 MCP Server (spawner-h70)
- Should be auto-connected via Claude Code MCP config
- Verify with `/mcp` command - look for `spawner-h70`
- Provides 480 H70 skills locally

### 3. Mind v5 Lite (for memory/learning features)
```bash
cd C:\Users\USER\Desktop\the-mind
start_mind_lite.bat
# API: http://localhost:8080
# Dashboard: http://localhost:8501
```

### Quick Start All Services
```bash
# Terminal 1: Spawner UI
cd C:\Users\USER\Desktop\spawner-ui && npm run dev

# Terminal 2: Mind v5
cd C:\Users\USER\Desktop\the-mind && start_mind_lite.bat
```

### Verify Everything is Running
| Service | URL | Check |
|---------|-----|-------|
| Spawner UI | http://localhost:5173 | Page loads |
| Mind v5 API | http://localhost:8080/health | Returns `{"status":"healthy"}` |
| H70 MCP | `/mcp` in Claude Code | Shows `spawner-h70` connected |

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

## PRD Analysis Bridge (REAL AI)

**CRITICAL: PRD analysis uses REAL Claude AI intelligence, not regex patterns.**

When a user uploads a PRD to Spawner UI, Claude Code analyzes it with actual intelligence.

### How It Works

1. User uploads PRD → UI writes to `.spawner/pending-prd.md`
2. UI sends `prd_analysis_requested` event
3. Claude Code checks `/api/prd-bridge/pending` or reads the file
4. Claude Code analyzes PRD with real AI (variable task count based on complexity)
5. Claude Code sends results via `POST /api/events` with type `prd_analysis_complete`
6. UI receives intelligent pipeline (could be 5 or 25 tasks - depends on actual project)

### ⚠️ CRITICAL: RequestId Matching (MUST FOLLOW)

**The UI polls for results using a specific `requestId`. If your response uses a different requestId, IT WILL BE IGNORED.**

**ALWAYS follow this exact flow:**

```bash
# Step 1: ALWAYS fetch the CURRENT pending requestId first
curl http://localhost:5173/api/prd-bridge/pending
# Returns: {"pending": true, "requestId": "prd-1234567890-abc123", ...}

# Step 2: Use THAT EXACT requestId in your response
# DO NOT use an old requestId from a previous request
# DO NOT guess or generate your own requestId

# Step 3: Send the result with the matching requestId
curl -X POST http://localhost:5173/api/events \
  -H "Content-Type: application/json" \
  -d '{"type": "prd_analysis_complete", "data": {"requestId": "prd-1234567890-abc123", ...}}'
```

**Why this matters:**
- The UI generates a NEW requestId each time the user submits/resubmits a PRD
- The UI only polls for results matching its current requestId
- Results with mismatched requestIds are stored but never displayed
- If the user refreshes or resubmits, the old requestId becomes stale

**Common failure pattern:**
1. User submits PRD → requestId A created
2. Claude starts analyzing...
3. User refreshes page or resubmits → requestId B created (A is now stale!)
4. Claude sends result with requestId A → IGNORED because UI is polling for B
5. User sees nothing, thinks it failed

**The fix:** Always fetch `/api/prd-bridge/pending` IMMEDIATELY before sending results to get the current requestId.

### Checking for Pending PRD Analysis

```bash
curl http://localhost:5173/api/prd-bridge/pending
```

Returns: `{"pending": true, "requestId": "...", "prdContent": "..."}` if pending

### Responding to PRD Analysis

```bash
curl -X POST http://localhost:5173/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "prd_analysis_complete",
    "data": {
      "requestId": "prd-xxx",
      "result": {
        "success": true,
        "projectName": "...",
        "projectType": "saas|tool|marketplace|...",
        "complexity": "simple|moderate|complex",
        "infrastructure": {"needsAuth": false, "needsDatabase": true, ...},
        "techStack": {"framework": "SvelteKit", ...},
        "tasks": [{
          "id": "task-1",
          "title": "...",
          "skills": ["skill-id"],
          "phase": 1,
          "dependsOn": [],
          "verification": {"criteria": [...]}
        }],
        "skills": ["skill-1", "skill-2"],
        "executionPrompt": "..."
      }
    }
  }'
```

### Task Count Guidelines

| Complexity | Task Count | Examples |
|------------|------------|----------|
| Simple | 4-8 | Landing page, static site |
| Moderate | 8-15 | Single feature app, tool |
| Complex | 15-25 | Full SaaS, marketplace |
| Maximum | 30 | Never exceed this |

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/services/prd-bridge.ts` | Bridge service (client + types) |
| `src/routes/api/prd-bridge/write/+server.ts` | Write PRD for analysis |
| `src/routes/api/prd-bridge/pending/+server.ts` | Check pending requests |
| `.spawner/pending-prd.md` | PRD content file |
| `.spawner/pending-request.json` | Request metadata |

### Pipeline Loading - FILE-BASED QUEUE SYSTEM

**The pipeline loading system uses a file-based queue to prevent race conditions.**

This replaced the old sessionStorage-based system which had race condition issues.

**How it works:**
1. `queuePipelineLoad()` writes pipeline data to `.spawner/pending-load.json`
2. Canvas page's `onMount` calls `getPendingLoad()` which reads AND DELETES the file
3. If a pending load exists, canvas loads those exact nodes/connections
4. If no pending load, canvas loads the active pipeline from localStorage

**Key files:**
| File | Purpose |
|------|---------|
| `src/lib/services/pipeline-loader.ts` | `queuePipelineLoad()`, `getPendingLoad()` |
| `src/routes/api/pipeline-loader/+server.ts` | File-based queue API |
| `.spawner/pending-load.json` | Queued pipeline data (auto-deleted on consume) |

**Key code locations:**
- `src/lib/components/Welcome.svelte` - `handleProcessingComplete()` uses `queuePipelineLoad()`
- `src/routes/canvas/+page.svelte` - `onMount` uses `getPendingLoad()` FIRST

### handleProcessingComplete - Uses queuePipelineLoad()

**`handleProcessingComplete()` queues the pipeline via file-based system, not sessionStorage.**

**How it works:**
1. Calls `queuePipelineLoad()` with nodes, connections, and pipeline name
2. This writes to `.spawner/pending-load.json`
3. Navigates to `/canvas`
4. Canvas `onMount` calls `getPendingLoad()` and loads the queued data
5. File is automatically deleted after consumption (prevents duplicate loads)

**Key code location:**
- `src/lib/components/Welcome.svelte` - `handleProcessingComplete()` function

**DO NOT:**
- Revert to sessionStorage-based loading (causes race conditions)
- Skip `queuePipelineLoad()` before navigation to canvas
- Modify `getPendingLoad()` to NOT delete the file (causes duplicate loads)

### Canvas Page - Single Loading Path

**Canvas page uses ONE loading path via `getPendingLoad()` - no more competing initialization!**

The old approach had 4+ competing loading paths which caused race conditions. Now there's just one.

**How canvas `onMount` works:**
1. Call `getPendingLoad()` - checks for `.spawner/pending-load.json`
2. If pending load exists:
   - Create new pipeline with `createNewPipeline()`
   - Load the exact nodes/connections from the pending load
   - File is auto-deleted (consumed)
3. If NO pending load:
   - Load active pipeline from localStorage

**Key code location:**
- `src/routes/canvas/+page.svelte` - `onMount` uses `getPendingLoad()` FIRST

**DO NOT:**
- Add additional loading paths or checks to canvas onMount
- Check sessionStorage, PRD results, or other sources in canvas
- All pipeline loading must go through the `queuePipelineLoad()` → `getPendingLoad()` flow

## Environment

- **Skills Lab Path**: `C:/Users/USER/Desktop/vibeship-skills-lab`
- **Dev Server**: `http://localhost:5173` (or `http://localhost:5500` if custom port)
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
