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

## PRD-to-Skill Matching System

### CRITICAL RULES (DO NOT CHANGE)

1. **NEVER condense H70 skills** - Always load and use FULL skill content
2. **MAX_SKILLS_TO_SUGGEST = 50** - Cap at 50 skills maximum
3. **Use `loadSkillsForMission`** - NOT `loadCondensedSkillsForMission`
4. **Full skill content includes**: identity, owns, delegates, disasters, anti-patterns, patterns
5. **skill-matcher.ts MUST import KEYWORD_TO_SKILLS** from h70-skill-matcher.ts (391 mappings)
6. **PRD matching uses H70 keywords** - Different PRDs MUST get different skills

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
| 5. EXECUTION PROMPT                      |
|    - Full H70 skill content embedded     |
|    - identity, owns, delegates           |
|    - disasters, anti-patterns, patterns  |
+------------------------------------------+
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/types/goal.ts` | `MAX_SKILLS_TO_SUGGEST: 50`, `getDynamicSkillLimit()` |
| `src/lib/services/skill-matcher.ts` | PRD -> initial skill matching |
| `src/lib/services/h70-skill-matcher.ts` | 391 keyword mappings -> H70 skill IDs |
| `src/lib/services/h70-skills.ts` | `loadSkillsForMission()` - loads FULL skills |
| `src/lib/services/mission-builder.ts` | Builds missions with full H70 skill content |

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

- Do NOT use `loadCondensedSkillsForMission()` - always use `loadSkillsForMission()`
- Do NOT truncate skill identity to first paragraph
- Do NOT limit patterns/anti-patterns to top 3
- Do NOT limit disasters to top 2
- Do NOT set MAX_SKILLS_TO_SUGGEST above 50 (full skills need context space)
- Do NOT modify the h70-skill-matcher keyword mappings without good reason
- Do NOT remove the `import { KEYWORD_TO_SKILLS }` from skill-matcher.ts
- Do NOT revert skill-matcher.ts to only use the ~40 local TECH_TO_SKILLS/FEATURE_TO_SKILLS mappings

## PRD Analyzer Rules (prd-analyzer.ts)

### CRITICAL: Dynamic Task Generation

The PRD analyzer (`src/lib/utils/prd-analyzer.ts`) generates workflow tasks from PRD content.

**DIFFERENT PRDs MUST GENERATE DIFFERENT WORKFLOWS!**

### DO NOT

- Do NOT create hardcoded task structures (e.g., always: Setup → Design → Auth → DB → API → Features → Testing → Deploy)
- Do NOT limit feature tasks with `.slice(0, 5)` or any other artificial limit
- Do NOT always add infrastructure tasks - they should be CONDITIONAL based on PRD
- Do NOT assume every project needs frontend, backend, database, auth, testing, or deployment

### Task Generation Rules

1. **Project Setup**: Only if `suggestedStack.frontend` or `suggestedStack.backend` is defined
2. **Design System**: Only if `needsFrontend` is true (frontend/design/mobile/ecommerce categories)
3. **Authentication**: Only if `needsAuth` is true (auth category OR saas project type)
4. **Database Schema**: Only if `needsDatabase` is true (database/ecommerce/analytics categories OR db tech hints)
5. **API Layer**: Only if `needsBackend` is true (backend/api/database/auth/realtime categories)
6. **Feature Tasks**: ALL features from PRD (no `.slice()` limit!)
7. **Testing**: Only if testing keywords detected OR complex project (>5 features)
8. **Deployment**: Only if deployment keywords detected OR complex project

### Feature Extraction Methods

The `extractFeatures()` function uses 5 methods to comprehensively extract features:

1. **Bulleted/numbered lists**: `- Feature`, `1. Feature`, `* Feature`
2. **Markdown headings**: `## Feature Name`, `### Feature Name`
3. **User stories**: "As a user, I want to [feature]..."
4. **Paragraph patterns**: "The system should...", "Users can...", "Support for..."
5. **Keyword detection**: If <3 features found, detect categories from content

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/utils/prd-analyzer.ts` | PRD analysis and dynamic task generation |
| `src/lib/components/Welcome.svelte` | Calls `analyzePRD()` and `generateTasksFromPRD()` |
| `src/lib/components/PRDProcessingModal.svelte` | Displays features found, tasks generated |

### Conditional Detection

```typescript
// These booleans determine what infrastructure tasks to create:
needsFrontend = featureCategories.some(c => ['frontend', 'design', 'mobile', 'ecommerce'].includes(c)) ||
  ['webapp', 'saas', 'mobile'].includes(projectType);

needsBackend = featureCategories.some(c => ['backend', 'api', 'database', 'auth', 'realtime'].includes(c)) ||
  ['api', 'saas'].includes(projectType);

needsAuth = featureCategories.includes('auth') || projectType === 'saas';

needsDatabase = featureCategories.some(c => ['database', 'ecommerce', 'analytics', 'community'].includes(c)) ||
  techHints.some(t => ['postgres', 'mysql', 'mongodb', 'supabase', 'firebase'].includes(t));

needsDeployment = featureCategories.includes('deployment') ||
  techHints.some(t => ['docker', 'kubernetes', 'vercel', 'aws', 'gcp', 'azure'].includes(t));

needsTesting = featureCategories.includes('testing') ||
  techHints.some(t => ['jest', 'vitest', 'cypress', 'playwright'].includes(t));
```

### Expected Behavior

- Simple landing page PRD → ~3-5 tasks (setup, design, content features)
- E-commerce PRD → ~15-20 tasks (all infrastructure + payment + inventory + orders)
- API-only PRD → ~5-8 tasks (no frontend, no design system)
- ML Pipeline PRD → Different skills entirely (data, ai, pipeline categories)

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
