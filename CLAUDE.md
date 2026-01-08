# CLAUDE.md - Spawner UI

This file provides guidance to Claude Code when working with the spawner-ui codebase.

## Project Overview

Spawner UI is a SvelteKit application that provides a visual canvas for building AI agent workflows. It allows users to:
- Create visual pipelines of skills/agents
- Execute multi-step missions
- Track progress through the Mind system

## H70 Skills - PRIMARY SOURCE

**IMPORTANT: This project uses H70 skills as the PRIMARY skill source.**

### Spawner H70 MCP Server

This repo includes a **private local MCP server** for H70 skills at `mcp-h70/`.

**To load H70 skills, use:**
```
mcp__spawner_h70__spawner_h70_skills with action="get" and name="skill-id"
```

**Available actions:**
- `get`: Get full skill content by ID
- `list`: List all available H70 skills
- `search`: Search skills by query

### Skill Loading Priority

1. **spawner-h70 MCP** (PRIMARY): Local `mcp-h70/` server reading from H70 skill-lab
2. **H70 API** (Fallback): `/api/h70-skills/[skillId]` endpoint
3. **vibeship-spawner MCP** (Remote): `mcp.vibeship.co` (legacy)

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
