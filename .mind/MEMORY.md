# Spawner UI Memory

## Decisions

### Guide System Design (2026-01-08)
**What:** Created comprehensive interactive tutorial system for Spawner onboarding
**Why:** Users need a game-style learn-by-doing approach, not documentation walls

**Key Details:**
- 7 modules: Welcome, Skills, Teams, MCPs, Workflows, Mind, Advanced
- Gamification: achievements, streaks, progress bars, certificates
- 5-minute first success goal
- Components: spotlight overlay, interactive sandboxes, contextual help, quizzes
- Design doc: `docs/guide-system-design.md`
- Philosophy: "The best tutorial is invisible - you're having fun and suddenly realize you've learned everything"

### Mind Tabs Reordering (2026-01-08)
**What:** Made Learnings the first/default tab in Mind section
**Why:** Learnings are the primary value of Mind - should be front and center

**Tab Order:** Learnings → Decisions → Issues → Sessions

### MCP Connected Tab Enhancement (2026-01-08)
**What:** Enhanced Connected tab to show tools, skills, and usage guide
**Why:** Users need guidance on how to use connected MCPs

**Features:**
- Left column: Recommended Spawner Skills
- Right column: Available Tools from MCP
- 3-step usage guide with actual tool names
- Server version badge and status indicators

## Learnings

### MCP Integration
- Real MCP connections work via `@modelcontextprotocol/sdk`
- Test MCP server at `src/lib/services/mcp/test-server.ts` (no auth needed)
- Filesystem MCP works for reading real files
- API endpoints: `/api/mcp` (connect/disconnect), `/api/mcp/call` (tool calls)

### UI Patterns
- Use `accent-primary` (#00C49A Vibeship teal) for consistent branding
- Avoid generic Tailwind colors like `green-500` - use theme colors
- Two-column layouts work well for tools/skills display

## Project Context

**Stack:** SvelteKit, Tailwind, TypeScript, Svelvet
**Purpose:** UI for Vibeship Spawner - skills, teams, MCPs, workflows
**Key Pages:** /canvas, /mcps, /mind, /guide (planned)

decided: Unified all Mind tabs to Mind v5 Lite: Decisions, Issues, Sessions, and Learnings all now read/write to the same SQLite database via memoryClient. Content types: project_decision, project_issue, session_summary, agent_learning. Removed dependency on Spawner MCP for these tabs.
fixed: Phase 1 of Mind improvement system complete: All tabs unified to Mind v5. New load functions: loadDecisions(), loadIssues(), loadSessions(), loadAllMindData(). Mind page now connects directly to Mind v5 API.
fixed: Created spawner-h70 MCP server: Local MCP that reads 470 H70 skills directly from skill-lab. Server at mcp-h70/index.js, tool name is spawner_h70_skills with actions: get, list, search. Config added to ~/.claude/settings.json. Requires Claude Code restart to activate.
fixed: Mind v5 enhancements complete: Added pagination to Learnings (50 initial, load all button), fixed UTC timestamps to show local time, added Issues tab guidance explaining auto-creation workflow, changed Improvements default filter to "all", created MIND.md comprehensive documentation, updated CLAUDE.md with Mind quick reference. All changes committed and pushed.
fixed: Spawner Theatre Mission: Task 8 in progress (Understanding - Workflow visualization). Completed: Tasks 1-7 (Project Setup, Design System, Transparency, Engagement, H70 Skill Visibility). Pending: Tasks 9-10 (Delight, Workspace). Created files: theatre module with SceneManager, ParticleEffects, PipelineView, WorkflowGraph, TaskTimeline components.
decided: Added SessionStateBar component to canvas page - shows mission progress when returning to a session. Also added H70 skill visibility to ExecutionPanel showing loaded skills with their task associations. Created WorkflowGraph and TaskTimeline components for Theatre visualization (Task 8 complete).