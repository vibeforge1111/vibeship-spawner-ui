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
decided: Implemented LITE+ self-improvement integration for Spawner UI: Added decision tracing with memory attribution, outcome recording that propagates to source memories using formula delta = quality * contribution * 0.1, pattern extraction from successful decision sequences, and new Intelligence tab in /mind showing all LITE+ metrics. The mission executor now creates decision traces at task start (linking relevant past memories) and records outcomes at task completion (triggering attribution). This enables true self-improving skills, agents, and teams based on outcome data.
decided: Fixed PRD analyzer (prd-analyzer.ts) to generate dynamic workflows instead of hardcoded 12 features/13 tasks/12 connections. Key changes: (1) Made infrastructure tasks conditional (needsFrontend, needsBackend, needsAuth, needsDatabase, needsDeployment, needsTesting), (2) Removed slice(0,5) limit on feature tasks, (3) Improved extractFeatures() with 5 detection methods (bullets, headings, user stories, paragraph patterns, keyword detection), (4) Different PRDs now generate different workflows. Also fixed duplicate keys in h70-skill-matcher.ts (dashboard, pdf, pipeline). Documented all rules in CLAUDE.md to prevent regression.
learned: PRD Analyzer fix: Previous version generated 249 tasks (crashed system). New version uses semantic scoring with TF-IDF-like relevance and reasonable limits (MAX_FEATURE_TASKS=20, MAX_TOTAL_TASKS=30). Key changes: (1) Selective extraction - only explicit features, not every sentence, (2) Feature consolidation - max 3 per category, merge rest, (3) Semantic skill matching with scoring instead of first-match, (4) Generic item filtering. Expected output: 5-30 tasks based on PRD complexity.
decided: Fixed copy-to-clipboard terminal crash: Old mission state with full H70 skill content was being persisted and restored. Bumped MISSION_STATE_VERSION from 1 to 2 and added checks to clear any persisted state with executionPrompt > 10KB chars. The new just-in-time format (~200 lines) only includes skill IDs.
learned: ReelRoyale Mission Execution Analysis: Critical failure where 27 tasks were assigned but only 7 completed. 45+ H70 skills listed but only ~5 loaded. Root causes: 1) No enforcement mechanism for skill loading 2) No task completion verification 3) Mission executor lacks "feature implementation vs scaffolding" distinction 4) Premature completion declaration without verification gates
fixed: Completed Sections A and B of OPTIMIZATION-CLEANUP-PLAN.md. Section A: Security hardening (XSS protection with DOMPurify, Zod validation for all JSON.parse calls, debug functions gated). Section B: Type safety (stricter tsconfig, replaced 12+ any types with proper interfaces/type guards). Commits: 58ac231, cfc83dd, 34cb6ff. Pushed to GitHub.
fixed: Simplified mcps/+page.svelte: Consolidated three repetitive switch statements (getCategoryIcon, getCategoryColor, getCategoryBgColor - 180 lines) into a single CATEGORY_CONFIG object (32 lines). Also consolidated status functions. Reduced code by ~120 lines while improving maintainability.
decided: Implemented intelligent skill routing for PRD analyzer: 1) Specificity scoring (specialists like drizzle-orm at 0.95 beat generalists like backend at 0.5), 2) Domain packs auto-activate for fintech/gaming/ai/blockchain/enterprise/mobile/ecommerce PRDs, 3) Skill chains decompose complex features (auth_system → [auth-specialist, database-architect, security-hardening, testing-automation]), 4) Visual chain indicators on canvas nodes showing specialist sequence
fixed: Completed 17-task mission execution test. Successfully loaded 15/16 H70 skills (llm-architect had parsing error). Stability improvements working - task tracking, skill loading via MCP, and progress reporting all functioning correctly.