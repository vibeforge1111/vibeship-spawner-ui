# Spawner UI - Architecture Document

> Visual orchestration platform for AI skill chains
> Version 1.0 | January 2025

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Deployment Modes](#deployment-modes)
3. [High-Level Architecture](#high-level-architecture)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Security Architecture](#security-architecture)
7. [Performance Architecture](#performance-architecture)
8. [Scalability Design](#scalability-design)
9. [Technology Stack](#technology-stack)
10. [API Design](#api-design)
11. [Database Schema](#database-schema)
12. [Integration Points](#integration-points)

---

## System Overview

### What is Spawner UI?

Spawner UI is a visual orchestration platform that enables users to build, configure, and deploy AI skill chains through an intuitive interface. It serves both non-technical users (via chat-first interaction) and power users (via canvas-based editing).

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Visual Canvas** | Drag-drop skill nodes with typed connections |
| **AI Composer** | Natural language to skill chain generation |
| **Skill Library** | 450+ specialized expert personas |
| **Mind Memory** | Persistent decision tracking across sessions |
| **Validation Engine** | Pre-flight checks with auto-fix suggestions |
| **Dual Deployment** | Cloud SaaS or local self-hosted |

### Design Principles

1. **Chat-First, Canvas-Second** - Beginners start with conversation, canvas appears as result
2. **Progressive Disclosure** - Complexity reveals only when needed
3. **Offline-Capable** - Core features work without internet (local mode)
4. **API-First** - Every UI action maps to an API call
5. **Real-Time Sync** - Cloud and local stay synchronized when connected

---

## Deployment Modes

### Mode 1: Cloud (SaaS)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLOUD MODE                                   │
│                                                                         │
│  User Browser                                                           │
│       │                                                                 │
│       ▼                                                                 │
│  ┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐ │
│  │ Spawner │────▶│  Edge CDN   │────▶│  API Edge   │────▶│ Services │ │
│  │   UI    │     │ (Vercel/CF) │     │  (Workers)  │     │  (D1/KV) │ │
│  └─────────┘     └─────────────┘     └─────────────┘     └──────────┘ │
│                                              │                          │
│                                              ▼                          │
│                                       ┌─────────────┐                  │
│                                       │ Claude API  │                  │
│                                       └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘

Benefits:
- Zero setup for users
- Always up-to-date
- Collaborative features
- Managed infrastructure
```

### Mode 2: Local (Self-Hosted)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            LOCAL MODE                                   │
│                                                                         │
│  User's Machine                                                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │  ┌─────────┐     ┌─────────────┐     ┌─────────────────────┐  │    │
│  │  │ Spawner │────▶│  Local API  │────▶│  SQLite + LanceDB   │  │    │
│  │  │   UI    │     │  (SvelteKit)│     │  (Local Storage)    │  │    │
│  │  └─────────┘     └──────┬──────┘     └─────────────────────┘  │    │
│  │                         │                                      │    │
│  │                         ▼                                      │    │
│  │                  ┌─────────────┐     ┌─────────────────────┐  │    │
│  │                  │ Claude API  │     │  ~/.spawner/skills  │  │    │
│  │                  │ (user key)  │     │  (local skills)     │  │    │
│  │                  └─────────────┘     └─────────────────────┘  │    │
│  │                                                                 │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

Benefits:
- Full data privacy
- Works offline (except AI features)
- No subscription required
- Custom skill development
```

### Mode 3: Hybrid (Connected Local)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HYBRID MODE                                   │
│                                                                         │
│  User's Machine                           Cloud Services                │
│  ┌──────────────────────────┐            ┌──────────────────────┐      │
│  │                          │            │                      │      │
│  │  ┌─────────┐             │    sync    │   ┌─────────────┐   │      │
│  │  │ Spawner │─────────────│───────────▶│   │ Cloud Sync  │   │      │
│  │  │   UI    │             │            │   │   Service   │   │      │
│  │  └────┬────┘             │◀───────────│   └─────────────┘   │      │
│  │       │                  │   skills   │                      │      │
│  │       ▼                  │   recipes  │   ┌─────────────┐   │      │
│  │  ┌─────────────┐         │   updates  │   │  Community  │   │      │
│  │  │ Local Store │         │            │   │   Recipes   │   │      │
│  │  │ (SQLite)    │         │            │   └─────────────┘   │      │
│  │  └─────────────┘         │            │                      │      │
│  │                          │            │                      │      │
│  └──────────────────────────┘            └──────────────────────┘      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

Benefits:
- Local-first with cloud backup
- Community recipe sharing
- Skill updates without reinstall
- Seamless online/offline transition
```

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                              PRESENTATION LAYER                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │    Canvas     │  │  AI Composer  │  │    Palette    │  │    Mind     │ │
│  │   Component   │  │    Panel      │  │   Browser     │  │   Panel     │ │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └──────┬──────┘ │
│          │                  │                  │                  │        │
│          └──────────────────┴──────────────────┴──────────────────┘        │
│                                      │                                      │
│                                      ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                          STATE MANAGEMENT                             │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │   Canvas    │  │    Chat     │  │   Skills    │  │    Mind     │  │  │
│  │  │   Store     │  │   Store     │  │   Store     │  │   Store     │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│                                      ▼                                      │
│                               SERVICE LAYER                                 │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Canvas     │  │  Composer   │  │  Skill      │  │  Validation │  │  │
│  │  │  Service    │  │  Service    │  │  Service    │  │  Service    │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Mind       │  │  Sync       │  │  Export     │  │  Auth       │  │  │
│  │  │  Service    │  │  Service    │  │  Service    │  │  Service    │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│                                      ▼                                      │
│                                 API LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │   /api/canvas    /api/compose    /api/skills    /api/validate        │  │
│  │   /api/mind      /api/sync       /api/export    /api/auth            │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│                                      ▼                                      │
│                              DATA LAYER                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │   SQLite    │  │  LanceDB    │  │  Skills     │  │   Claude    │  │  │
│  │  │  (projects) │  │  (vectors)  │  │  (YAML)     │  │    API      │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend Components

```
src/
├── lib/
│   ├── components/
│   │   │
│   │   ├── canvas/
│   │   │   ├── Canvas.svelte           # Main infinite canvas
│   │   │   ├── SkillNode.svelte         # Individual skill block
│   │   │   ├── Connection.svelte        # Edge between nodes
│   │   │   ├── GhostNode.svelte         # AI-proposed node (preview)
│   │   │   ├── GhostConnection.svelte   # AI-proposed edge (preview)
│   │   │   ├── MiniMap.svelte           # Canvas overview
│   │   │   └── SelectionBox.svelte      # Multi-select
│   │   │
│   │   ├── composer/
│   │   │   ├── ComposerPanel.svelte     # AI chat container
│   │   │   ├── MessageBubble.svelte     # Chat message
│   │   │   ├── ProposalCard.svelte      # Proposed changes card
│   │   │   ├── QuickActions.svelte      # Action chips
│   │   │   └── StreamingIndicator.svelte # Typing indicator
│   │   │
│   │   ├── palette/
│   │   │   ├── SkillPalette.svelte      # Skill browser sidebar
│   │   │   ├── CategoryTree.svelte      # Skill categories
│   │   │   ├── SkillCard.svelte         # Skill preview card
│   │   │   ├── RecipeGallery.svelte     # Pre-built templates
│   │   │   └── SearchBar.svelte         # Skill search
│   │   │
│   │   ├── mind/
│   │   │   ├── MindPanel.svelte         # Memory sidebar
│   │   │   ├── DecisionCard.svelte      # Single decision
│   │   │   ├── Timeline.svelte          # Decision history
│   │   │   └── MemorySearch.svelte      # Semantic search
│   │   │
│   │   ├── validation/
│   │   │   ├── PreflightPanel.svelte    # Validation results
│   │   │   ├── IssueCard.svelte         # Single issue
│   │   │   ├── FixSuggestion.svelte     # Auto-fix option
│   │   │   └── ValidationBadge.svelte   # Node status indicator
│   │   │
│   │   ├── shared/
│   │   │   ├── Modal.svelte
│   │   │   ├── Tooltip.svelte
│   │   │   ├── CommandPalette.svelte    # Cmd+K menu
│   │   │   ├── ModeToggle.svelte        # Express/Studio/Code
│   │   │   └── LoadingSpinner.svelte
│   │   │
│   │   └── welcome/
│   │       ├── WelcomeScreen.svelte     # First-time experience
│   │       ├── PromptInput.svelte       # "What do you want to build?"
│   │       └── RecipeCards.svelte       # Starter templates
│   │
│   ├── stores/
│   │   ├── canvas.ts                    # Nodes, edges, positions
│   │   ├── chat.ts                      # Conversation history
│   │   ├── skills.ts                    # Loaded skills
│   │   ├── mind.ts                      # Memory/decisions
│   │   ├── validation.ts                # Preflight results
│   │   ├── ui.ts                        # UI state (mode, panels)
│   │   └── sync.ts                      # Cloud sync state
│   │
│   ├── services/
│   │   ├── canvas.service.ts            # Canvas operations
│   │   ├── composer.service.ts          # AI generation
│   │   ├── skill.service.ts             # Skill loading
│   │   ├── validation.service.ts        # Pre-flight checks
│   │   ├── mind.service.ts              # Memory operations
│   │   ├── sync.service.ts              # Cloud sync
│   │   ├── export.service.ts            # Code/API export
│   │   └── auth.service.ts              # Authentication
│   │
│   ├── utils/
│   │   ├── graph.ts                     # Graph algorithms
│   │   ├── diff.ts                      # Canvas diff/patch
│   │   ├── validation.ts                # Validation helpers
│   │   └── debounce.ts
│   │
│   └── types/
│       ├── canvas.ts                    # Node, Edge types
│       ├── skill.ts                     # Skill schema
│       ├── mind.ts                      # Memory types
│       └── api.ts                       # API types
│
├── routes/
│   ├── +page.svelte                     # Welcome/home
│   ├── +layout.svelte                   # App shell
│   ├── project/
│   │   └── [id]/
│   │       └── +page.svelte             # Project editor
│   ├── api/
│   │   ├── canvas/+server.ts
│   │   ├── compose/+server.ts
│   │   ├── skills/+server.ts
│   │   ├── validate/+server.ts
│   │   ├── mind/+server.ts
│   │   └── sync/+server.ts
│   └── auth/
│       ├── login/+page.svelte
│       └── callback/+server.ts
│
└── app.html
```

---

## Data Flow

### Flow 1: AI Composition (Chat to Canvas)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  1. USER INPUT                                                          │
│     "Build a DeFi price alert with Telegram notifications"              │
│                          │                                              │
│                          ▼                                              │
│  2. COMPOSER SERVICE                                                    │
│     ┌────────────────────────────────────────────────────────────┐     │
│     │  • Parse intent                                             │     │
│     │  • Load relevant skills from store                          │     │
│     │  • Build context (current canvas + mind memories)           │     │
│     │  • Send to Claude API                                       │     │
│     └────────────────────────────────────────────────────────────┘     │
│                          │                                              │
│                          ▼                                              │
│  3. CLAUDE API (streaming)                                              │
│     ┌────────────────────────────────────────────────────────────┐     │
│     │  Returns:                                                   │     │
│     │  • Skill chain proposal (nodes + edges)                     │     │
│     │  • Configuration for each node                              │     │
│     │  • Explanation text                                         │     │
│     │  • Sharp edge warnings                                      │     │
│     └────────────────────────────────────────────────────────────┘     │
│                          │                                              │
│                          ▼                                              │
│  4. DIFF GENERATION                                                     │
│     ┌────────────────────────────────────────────────────────────┐     │
│     │  • Compare proposed vs current canvas                       │     │
│     │  • Generate GraphPatch[]                                    │     │
│     │  • Create ghost nodes/edges for preview                     │     │
│     └────────────────────────────────────────────────────────────┘     │
│                          │                                              │
│                          ▼                                              │
│  5. UI PREVIEW (Ghost State)                                            │
│     ┌────────────────────────────────────────────────────────────┐     │
│     │  • Render ghost nodes (dashed, 50% opacity)                 │     │
│     │  • Show proposal card in chat                               │     │
│     │  • User sees [Apply] [Modify] [Reject] buttons              │     │
│     └────────────────────────────────────────────────────────────┘     │
│                          │                                              │
│                          ▼                                              │
│  6. USER CONFIRMS                                                       │
│     ┌────────────────────────────────────────────────────────────┐     │
│     │  • Apply patches to canvas store                            │     │
│     │  • Convert ghosts to solid nodes                            │     │
│     │  • Log decision to Mind                                     │     │
│     │  • Add to undo stack                                        │     │
│     └────────────────────────────────────────────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Validation (Pre-flight Check)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  1. TRIGGER                                                             │
│     User clicks [Preflight] or auto-triggered on Run                    │
│                          │                                              │
│                          ▼                                              │
│  2. VALIDATION SERVICE                                                  │
│     ┌────────────────────────────────────────────────────────────┐     │
│     │  For each node:                                             │     │
│     │  ├─ Load skill validations.yaml                             │     │
│     │  ├─ Check required inputs connected                         │     │
│     │  ├─ Type-check connections (input ↔ output)                 │     │
│     │  └─ Run regex pattern validations                           │     │
│     │                                                              │     │
│     │  For each edge:                                              │     │
│     │  ├─ Verify data type compatibility                          │     │
│     │  └─ Check handoff protocol requirements                     │     │
│     │                                                              │     │
│     │  For entire graph:                                           │     │
│     │  ├─ Detect cycles                                            │     │
│     │  ├─ Check for orphan nodes                                   │     │
│     │  └─ Aggregate sharp edge warnings                            │     │
│     └────────────────────────────────────────────────────────────┘     │
│                          │                                              │
│                          ▼                                              │
│  3. RESULTS                                                             │
│     ┌────────────────────────────────────────────────────────────┐     │
│     │  {                                                          │     │
│     │    passed: boolean,                                         │     │
│     │    errors: ValidationIssue[],    // blocking                │     │
│     │    warnings: ValidationIssue[],  // sharp edges             │     │
│     │    fixes: AutoFix[]              // one-click solutions     │     │
│     │  }                                                          │     │
│     └────────────────────────────────────────────────────────────┘     │
│                          │                                              │
│                          ▼                                              │
│  4. UI UPDATE                                                           │
│     • Badge each node (green/yellow/red)                                │
│     • Show PreflightPanel with issues                                   │
│     • Offer [Fix All Safe] button                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flow 3: Cloud Sync (Hybrid Mode)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  LOCAL                                    CLOUD                         │
│  ─────                                    ─────                         │
│                                                                         │
│  ┌─────────────┐                         ┌─────────────┐               │
│  │   Canvas    │   ──── on change ────▶  │  Sync Queue │               │
│  │   Store     │                         │  (debounced)│               │
│  └─────────────┘                         └──────┬──────┘               │
│                                                  │                      │
│                                                  ▼                      │
│                                          ┌─────────────┐               │
│                                          │  Conflict   │               │
│                                          │  Detection  │               │
│                                          └──────┬──────┘               │
│                                                  │                      │
│                              ┌───────────────────┼───────────────────┐ │
│                              ▼                   ▼                   ▼ │
│                        No Conflict          Merge OK            Conflict│
│                              │                   │                   │  │
│                              ▼                   ▼                   ▼  │
│                         ┌─────────┐        ┌─────────┐        ┌───────┐│
│                         │  Push   │        │ 3-way   │        │ User  ││
│                         │  to D1  │        │  Merge  │        │Resolve││
│                         └─────────┘        └─────────┘        └───────┘│
│                                                                         │
│  SYNC STATES:                                                           │
│  ● Synced     - All changes saved to cloud                              │
│  ○ Syncing    - Upload in progress                                      │
│  ◐ Pending    - Offline, will sync when connected                       │
│  ✕ Conflict   - Needs manual resolution                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Security Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  CLOUD MODE                                                             │
│  ──────────                                                             │
│                                                                         │
│  ┌────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐  │
│  │  User  │────▶│  OAuth2    │────▶│  Callback  │────▶│  Session   │  │
│  │        │     │  Provider  │     │  Handler   │     │  Created   │  │
│  └────────┘     │(GitHub/    │     └────────────┘     └────────────┘  │
│                 │ Google)    │                                         │
│                 └────────────┘                                         │
│                                                                         │
│  SESSION STORAGE:                                                       │
│  • JWT token (httpOnly cookie)                                          │
│  • Refresh token (encrypted in D1)                                      │
│  • Session expires: 7 days (configurable)                               │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LOCAL MODE                                                             │
│  ──────────                                                             │
│                                                                         │
│  ┌────────┐     ┌────────────┐     ┌────────────┐                      │
│  │  User  │────▶│  API Key   │────▶│  Local     │                      │
│  │        │     │  Input     │     │  Keychain  │                      │
│  └────────┘     └────────────┘     └────────────┘                      │
│                                                                         │
│  STORED SECURELY:                                                       │
│  • Claude API key → OS keychain (keytar)                                │
│  • Never stored in plain text or localStorage                           │
│  • Encrypted at rest with machine-specific key                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Security Measures

| Layer | Measure | Implementation |
|-------|---------|----------------|
| **Transport** | TLS 1.3 | All API calls over HTTPS |
| **Authentication** | OAuth2 + PKCE | Secure token exchange |
| **Authorization** | RBAC | Project-level permissions |
| **API Keys** | Encrypted storage | OS keychain / Cloudflare secrets |
| **Input Validation** | Zod schemas | All API inputs validated |
| **XSS Prevention** | CSP headers | Strict content security policy |
| **CSRF Protection** | SameSite cookies | httpOnly + Secure flags |
| **Rate Limiting** | Sliding window | 100 req/min per user |
| **Audit Logging** | Immutable log | All mutations logged |

### Data Privacy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  WHAT WE STORE (Cloud Mode)           WHAT WE DON'T STORE               │
│  ─────────────────────────            ───────────────────               │
│  • Project structure                  • API keys (user's Claude key)    │
│  • Skill configurations               • Execution outputs               │
│  • Mind decisions                     • Sensitive config values         │
│  • Sync metadata                      • Personal data from flows        │
│                                                                         │
│  LOCAL MODE: Everything stays on user's machine                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Performance Architecture

### Speed Optimizations

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  TARGET METRICS                                                         │
│  ──────────────                                                         │
│                                                                         │
│  • First Contentful Paint:    < 1.0s                                    │
│  • Time to Interactive:       < 2.0s                                    │
│  • Canvas render (100 nodes): < 16ms (60fps)                            │
│  • Skill search:              < 50ms                                    │
│  • AI response start:         < 500ms (streaming)                       │
│  • Validation (full graph):   < 200ms                                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STRATEGIES                                                             │
│  ──────────                                                             │
│                                                                         │
│  1. EDGE-FIRST ARCHITECTURE                                             │
│     ┌─────────────────────────────────────────────────────────┐        │
│     │  Static assets → Vercel/Cloudflare Edge (< 50ms)        │        │
│     │  API calls → Cloudflare Workers (< 100ms cold start)    │        │
│     │  Skills → KV cache (< 10ms read)                        │        │
│     └─────────────────────────────────────────────────────────┘        │
│                                                                         │
│  2. VIRTUAL RENDERING (Canvas)                                          │
│     ┌─────────────────────────────────────────────────────────┐        │
│     │  Only render visible nodes (viewport culling)           │        │
│     │  Lazy load node details on zoom                         │        │
│     │  WebGL acceleration for 1000+ nodes                     │        │
│     └─────────────────────────────────────────────────────────┘        │
│                                                                         │
│  3. STREAMING RESPONSES                                                 │
│     ┌─────────────────────────────────────────────────────────┐        │
│     │  Claude API → Server-Sent Events → UI                   │        │
│     │  Progressive canvas build (nodes appear as generated)   │        │
│     │  Skeleton loading states                                │        │
│     └─────────────────────────────────────────────────────────┘        │
│                                                                         │
│  4. LOCAL CACHING                                                       │
│     ┌─────────────────────────────────────────────────────────┐        │
│     │  Skills cached in IndexedDB (refresh on version change) │        │
│     │  Recent projects cached for instant load                │        │
│     │  Mind memories indexed locally with LanceDB             │        │
│     └─────────────────────────────────────────────────────────┘        │
│                                                                         │
│  5. OPTIMISTIC UPDATES                                                  │
│     ┌─────────────────────────────────────────────────────────┐        │
│     │  UI updates immediately, syncs in background            │        │
│     │  Rollback on failure with clear error message           │        │
│     └─────────────────────────────────────────────────────────┘        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Bundle Optimization

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  CODE SPLITTING STRATEGY                                                │
│  ───────────────────────                                                │
│                                                                         │
│  Initial Bundle (< 100KB gzipped):                                      │
│  ├── Core framework (Svelte runtime)                                    │
│  ├── Welcome screen                                                     │
│  ├── Basic routing                                                      │
│  └── Critical CSS                                                       │
│                                                                         │
│  Lazy Loaded:                                                           │
│  ├── Canvas engine (Svelvet) ─────────── on first project open          │
│  ├── AI Composer panel ───────────────── on first chat interaction      │
│  ├── Skill browser ───────────────────── on palette open                │
│  ├── Mind panel ──────────────────────── on mind tab click              │
│  ├── Code editor (Monaco) ────────────── on code mode toggle            │
│  └── Export dialogs ──────────────────── on export click                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Scalability Design

### Horizontal Scaling (Cloud)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                           LOAD BALANCER                                 │
│                                │                                        │
│              ┌─────────────────┼─────────────────┐                     │
│              ▼                 ▼                 ▼                     │
│        ┌──────────┐      ┌──────────┐      ┌──────────┐               │
│        │  Edge    │      │  Edge    │      │  Edge    │               │
│        │ Worker 1 │      │ Worker 2 │      │ Worker N │               │
│        └────┬─────┘      └────┬─────┘      └────┬─────┘               │
│             │                 │                 │                      │
│             └─────────────────┼─────────────────┘                      │
│                               │                                        │
│                    ┌──────────┴──────────┐                            │
│                    ▼                     ▼                            │
│              ┌──────────┐          ┌──────────┐                       │
│              │   D1     │          │   KV     │                       │
│              │ Database │          │  Cache   │                       │
│              │ (SQLite) │          │ (Skills) │                       │
│              └──────────┘          └──────────┘                       │
│                                                                         │
│  SCALING LIMITS:                                                        │
│  • Workers: Unlimited (auto-scales)                                     │
│  • D1: 10GB per database, read replicas available                       │
│  • KV: 1GB per namespace, 100K reads/sec                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Partitioning

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  PARTITION STRATEGY                                                     │
│  ──────────────────                                                     │
│                                                                         │
│  By User (for projects/mind):                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  user_123                                                        │   │
│  │  ├── projects/                                                   │   │
│  │  │   ├── project_a.sqlite                                        │   │
│  │  │   └── project_b.sqlite                                        │   │
│  │  └── mind/                                                       │   │
│  │      └── memories.lance                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Global (for skills):                                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  skills/                                                         │   │
│  │  ├── v1.2.0/                                                     │   │
│  │  │   ├── agents/                                                 │   │
│  │  │   ├── defi/                                                   │   │
│  │  │   └── ...                                                     │   │
│  │  └── v1.3.0/  (new version, gradual rollout)                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Purpose | Why |
|------------|---------|-----|
| **SvelteKit** | Framework | Fast, small bundle, great DX |
| **Svelvet** | Canvas library | Svelte-native node graphs |
| **Tailwind CSS** | Styling | Utility-first, consistent |
| **TypeScript** | Type safety | Catch errors early |
| **Zod** | Validation | Runtime type checking |

### Backend (Cloud)

| Technology | Purpose | Why |
|------------|---------|-----|
| **Cloudflare Workers** | API | Edge-first, fast cold starts |
| **Cloudflare D1** | Database | SQLite at edge, low latency |
| **Cloudflare KV** | Cache | Skills cache, fast reads |
| **Cloudflare R2** | Storage | Project exports, large files |

### Backend (Local)

| Technology | Purpose | Why |
|------------|---------|-----|
| **SvelteKit (Node)** | Server | Same codebase as cloud |
| **better-sqlite3** | Database | Fast local SQLite |
| **LanceDB** | Vectors | Local semantic search |
| **keytar** | Secrets | OS keychain integration |

### External Services

| Service | Purpose | Fallback |
|---------|---------|----------|
| **Claude API** | AI generation | Required (user provides key) |
| **GitHub OAuth** | Auth (cloud) | Email/password option |
| **Sentry** | Error tracking | Optional, self-host available |

---

## API Design

### RESTful Endpoints

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  PROJECTS                                                               │
│  ────────                                                               │
│  GET    /api/projects              List user's projects                 │
│  POST   /api/projects              Create new project                   │
│  GET    /api/projects/:id          Get project details                  │
│  PUT    /api/projects/:id          Update project                       │
│  DELETE /api/projects/:id          Delete project                       │
│                                                                         │
│  CANVAS                                                                 │
│  ──────                                                                 │
│  GET    /api/projects/:id/canvas   Get canvas state                     │
│  PATCH  /api/projects/:id/canvas   Apply canvas patches                 │
│  POST   /api/projects/:id/undo     Undo last action                     │
│  POST   /api/projects/:id/redo     Redo last undo                       │
│                                                                         │
│  COMPOSE                                                                │
│  ───────                                                                │
│  POST   /api/compose               Generate skill chain (streaming)     │
│  POST   /api/compose/refine        Refine existing chain                │
│  POST   /api/compose/explain       Explain a node/connection            │
│                                                                         │
│  SKILLS                                                                 │
│  ──────                                                                 │
│  GET    /api/skills                List all skills                      │
│  GET    /api/skills/:id            Get skill details                    │
│  GET    /api/skills/search?q=      Search skills                        │
│  GET    /api/skills/categories     Get skill categories                 │
│                                                                         │
│  VALIDATION                                                             │
│  ──────────                                                             │
│  POST   /api/validate              Validate canvas                      │
│  POST   /api/validate/fix          Apply auto-fix                       │
│                                                                         │
│  MIND                                                                   │
│  ────                                                                   │
│  GET    /api/mind                  Get all memories                     │
│  POST   /api/mind                  Log new memory                       │
│  GET    /api/mind/search?q=        Semantic search                      │
│  DELETE /api/mind/:id              Delete memory                        │
│                                                                         │
│  EXPORT                                                                 │
│  ──────                                                                 │
│  POST   /api/export/code           Export as code                       │
│  POST   /api/export/api            Export as API spec                   │
│  POST   /api/export/recipe         Export as shareable recipe           │
│                                                                         │
│  SYNC                                                                   │
│  ────                                                                   │
│  GET    /api/sync/status           Get sync status                      │
│  POST   /api/sync/push             Push local changes                   │
│  POST   /api/sync/pull             Pull remote changes                  │
│  POST   /api/sync/resolve          Resolve conflict                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### WebSocket Events (Real-time)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  CLIENT → SERVER                                                        │
│  ───────────────                                                        │
│  canvas:patch      { patches: GraphPatch[] }                            │
│  compose:start     { prompt: string, context: Context }                 │
│  compose:stop      { }                                                  │
│                                                                         │
│  SERVER → CLIENT                                                        │
│  ───────────────                                                        │
│  compose:chunk     { text: string, nodes?: Node[], edges?: Edge[] }     │
│  compose:done      { summary: string }                                  │
│  compose:error     { message: string }                                  │
│  sync:update       { projectId: string, changes: Change[] }             │
│  sync:conflict     { projectId: string, conflicts: Conflict[] }         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### SQLite Schema (Projects)

```sql
-- Projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  settings JSON,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Canvas state (JSONB for flexibility)
CREATE TABLE canvas_states (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  nodes JSON NOT NULL,        -- Array of Node objects
  edges JSON NOT NULL,        -- Array of Edge objects
  viewport JSON,              -- { x, y, zoom }
  version INTEGER NOT NULL,   -- For conflict detection
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Undo/Redo history
CREATE TABLE canvas_history (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  patches JSON NOT NULL,      -- GraphPatch[] for this action
  inverse JSON NOT NULL,      -- Inverse patches for undo
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Mind memories
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,            -- NULL for global memories
  type TEXT NOT NULL,         -- decision, learning, blocker, etc.
  content TEXT NOT NULL,
  embedding BLOB,             -- Vector for semantic search
  metadata JSON,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Users (cloud mode only)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  settings JSON,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_canvas_project ON canvas_states(project_id);
CREATE INDEX idx_memories_user ON memories(user_id);
CREATE INDEX idx_memories_project ON memories(project_id);
CREATE INDEX idx_memories_type ON memories(type);
```

---

## Integration Points

### Spawner MCP Server

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Spawner UI connects to Spawner MCP Server for:                         │
│                                                                         │
│  • Skill loading (spawner_skills)                                       │
│  • Validation rules (spawner_validate)                                  │
│  • Sharp edges (spawner_watch_out)                                      │
│  • Project memory (spawner_remember)                                    │
│                                                                         │
│  CONNECTION MODES:                                                      │
│                                                                         │
│  Cloud:  Spawner UI ──HTTPS──▶ Spawner Workers (Cloudflare)            │
│  Local:  Spawner UI ──HTTP───▶ Spawner MCP (localhost:8787)            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Claude API

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  AI COMPOSER INTEGRATION                                                │
│                                                                         │
│  Model: claude-sonnet-4-20250514 (default, fast)                              │
│         claude-opus-4-20250514 (for complex chains)                           │
│                                                                         │
│  Features used:                                                         │
│  • Streaming responses (for progressive build)                          │
│  • Tool use (for structured skill chain output)                         │
│  • System prompts (skill-aware context)                                 │
│                                                                         │
│  API KEY HANDLING:                                                      │
│  Cloud:  User provides key, stored encrypted in D1                      │
│  Local:  User provides key, stored in OS keychain                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix: Key Type Definitions

```typescript
// Core types (src/lib/types/canvas.ts)

interface Node {
  id: string;
  type: 'skill';
  skillId: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  state: 'solid' | 'ghost' | 'error';
}

interface Edge {
  id: string;
  source: string;      // node id
  target: string;      // node id
  sourceHandle: string; // output port
  targetHandle: string; // input port
  type: 'data' | 'handoff' | 'memory';
  state: 'solid' | 'ghost' | 'invalid';
}

interface GraphPatch {
  op: 'add' | 'remove' | 'update';
  path: string;        // e.g., 'nodes/abc123' or 'edges/xyz789'
  value?: Node | Edge | Partial<Node> | Partial<Edge>;
}

interface ValidationResult {
  passed: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  fixes: AutoFix[];
}

interface ValidationIssue {
  nodeId?: string;
  edgeId?: string;
  type: 'error' | 'warning';
  code: string;
  message: string;
  details?: string;
}

interface AutoFix {
  issueId: string;
  description: string;
  patches: GraphPatch[];
  safe: boolean;       // true if can auto-apply
}
```

---

*Architecture Document v1.0 - January 2025*
