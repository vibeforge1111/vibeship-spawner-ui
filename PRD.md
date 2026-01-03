# Spawner UI - Product Requirements Document

> Visual orchestration platform for AI skill chains
> Version 1.0 | January 2025

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Target Users](#target-users)
4. [Product Vision](#product-vision)
5. [User Journeys](#user-journeys)
6. [Feature Requirements](#feature-requirements)
7. [User Experience Specifications](#user-experience-specifications)
8. [Success Metrics](#success-metrics)
9. [Release Plan](#release-plan)
10. [Competitive Analysis](#competitive-analysis)

---

## Executive Summary

### What We're Building

Spawner UI is a visual orchestration platform that lets anyone—from complete beginners to expert developers—build AI-powered workflows by connecting specialized "skills" (expert personas). Unlike existing tools that start with an empty canvas, Spawner UI starts with conversation and progressively reveals complexity.

### Key Differentiators

| Feature | Spawner UI | Competitors |
|---------|------------|-------------|
| Starting point | Chat-first | Empty canvas |
| Building blocks | 273+ expert personas | Generic nodes |
| Memory | Persistent Mind layer | Session only |
| Validation | Per-skill rules + sharp edges | Basic type checking |
| Deployment | Cloud + Local + Hybrid | Usually one mode |

### Target Launch

- **MVP (v0.1)**: 8 weeks - Core canvas + chat + basic skills
- **Beta (v0.5)**: 16 weeks - Full feature set + cloud sync
- **v1.0**: 24 weeks - Production ready + community features

---

## Problem Statement

### Current Pain Points

**For Non-Technical Users:**
- AI tools are powerful but intimidating
- No-code platforms still require understanding of logic flows
- Fear of "breaking something" prevents experimentation
- No memory of past decisions or preferences

**For Developers:**
- Building AI workflows requires boilerplate code
- Switching between different AI tools/patterns is friction
- Best practices and anti-patterns are scattered across docs
- No visual overview of complex agent systems

**For Teams:**
- Sharing AI workflows is cumbersome
- No standardized way to document AI system architecture
- Difficult to onboard new team members to existing flows

### The Opportunity

There's a gap between:
- **Chat interfaces** (easy but limited)
- **Code-first tools** (powerful but high barrier)

Spawner UI bridges this gap with visual building that's guided by AI.

---

## Target Users

### Primary Personas

#### 1. The Vibe Coder (Beginner)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ALEX - The Vibe Coder                                                  │
│  ─────────────────────                                                  │
│                                                                         │
│  Background:                                                            │
│  • Has business ideas but no coding experience                          │
│  • Uses ChatGPT/Claude for writing and brainstorming                    │
│  • Tried Zapier but found it confusing                                  │
│  • Watches YouTube tutorials about AI tools                             │
│                                                                         │
│  Goals:                                                                 │
│  • Build a simple automation without learning to code                   │
│  • Feel confident they won't break anything                             │
│  • Get something working in one session                                 │
│                                                                         │
│  Frustrations:                                                          │
│  • "I don't know where to start"                                        │
│  • "What do all these options mean?"                                    │
│  • "It worked yesterday, why not today?"                                │
│                                                                         │
│  Success Criteria:                                                      │
│  • First working flow in < 10 minutes                                   │
│  • Never sees an error they can't recover from                          │
│  • Feels proud of what they built                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 2. The Builder (Intermediate)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  JORDAN - The Builder                                                   │
│  ────────────────────                                                   │
│                                                                         │
│  Background:                                                            │
│  • Technical but not a full-time developer                              │
│  • Uses tools like Notion, Airtable, n8n                                │
│  • Can read code but prefers visual interfaces                          │
│  • Ships side projects and MVPs                                         │
│                                                                         │
│  Goals:                                                                 │
│  • Build production-ready automations quickly                           │
│  • Understand what's happening under the hood                           │
│  • Customize when needed, not forced to                                 │
│                                                                         │
│  Frustrations:                                                          │
│  • "The simple mode is too limiting"                                    │
│  • "I know what I want but the UI fights me"                            │
│  • "Why can't I just see the config?"                                   │
│                                                                         │
│  Success Criteria:                                                      │
│  • Can switch between simple and advanced modes                         │
│  • Keyboard shortcuts for common actions                                │
│  • Can export to code when needed                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3. The Expert (Advanced)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SAM - The Expert                                                       │
│  ────────────────                                                       │
│                                                                         │
│  Background:                                                            │
│  • Senior developer or AI engineer                                      │
│  • Builds complex multi-agent systems                                   │
│  • Values speed and keyboard-driven workflows                           │
│  • Contributes to open source                                           │
│                                                                         │
│  Goals:                                                                 │
│  • Prototype faster than writing code                                   │
│  • Visualize complex systems for documentation                          │
│  • Share patterns with team                                             │
│                                                                         │
│  Frustrations:                                                          │
│  • "Visual tools are usually too slow"                                  │
│  • "I need to see the actual config, not abstractions"                  │
│  • "Can I just edit the YAML directly?"                                 │
│                                                                         │
│  Success Criteria:                                                      │
│  • Cmd+K for everything                                                 │
│  • Split view: canvas + code editor                                     │
│  • Can create custom skills                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Secondary Personas

- **Team Lead**: Needs to review and approve workflows
- **DevOps**: Needs to deploy and monitor in production
- **Educator**: Uses Spawner UI to teach AI concepts

---

## Product Vision

### The 30-Second Pitch

> "Describe what you want to build in plain English. Watch it appear on a visual canvas. Click Run. That's it."

### Core Experience Principles

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  1. CONVERSATION FIRST                                                  │
│     Start with "What do you want to build?" not an empty canvas.        │
│     The canvas is a RESULT of conversation, not the starting point.    │
│                                                                         │
│  2. PROGRESSIVE REVELATION                                              │
│     Beginners see simple cards. Experts see full config.                │
│     Complexity appears only when you ask for it.                        │
│                                                                         │
│  3. SAFE TO EXPERIMENT                                                  │
│     Everything is undoable. Pre-flight catches errors.                  │
│     Ghost previews before committing changes.                           │
│                                                                         │
│  4. MEMORY THAT LEARNS                                                  │
│     Remember past decisions. Surface relevant context.                  │
│     "Why did we choose this?" is always answerable.                     │
│                                                                         │
│  5. WORKS EVERYWHERE                                                    │
│     Cloud for collaboration. Local for privacy.                         │
│     Seamless sync between both.                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### The "Aha Moments"

| Moment | What Happens | Emotional Response |
|--------|--------------|-------------------|
| First Build | User describes goal, watches canvas build itself | "Whoa, it understood me!" |
| First Warning | Pre-flight catches a potential issue | "It saved me from a mistake" |
| First Memory | System remembers a past preference | "It knows what I like!" |
| First Export | Working code generated from visual | "I could never write this" |

---

## User Journeys

### Journey 1: First-Time User (Beginner)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  GOAL: Build first working flow in < 10 minutes                         │
│                                                                         │
│  ┌─────┐                                                                │
│  │  1  │  LAND ON HOMEPAGE                                              │
│  └──┬──┘  • See welcoming screen with single prompt                     │
│     │     • "What do you want to build today?"                          │
│     │     • Recipe cards showing what others built                      │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  2  │  DESCRIBE GOAL                                                 │
│  └──┬──┘  • Type: "Alert me when ETH drops 5%"                          │
│     │     • Or click a recipe card                                      │
│     │     • Click [Build It]                                            │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  3  │  WATCH THE MAGIC                                               │
│  └──┬──┘  • Canvas appears with animation                               │
│     │     • Nodes drop in one by one                                    │
│     │     • Opus explains each piece                                    │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  4  │  ANSWER QUICK QUESTIONS                                        │
│  └──┬──┘  • "How should I notify you?"                                  │
│     │     • [Telegram] [Email] [Webhook]                                │
│     │     • Click one button (no typing needed)                         │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  5  │  PRE-FLIGHT CHECK                                              │
│  └──┬──┘  • System validates the flow                                   │
│     │     • Shows green checkmarks                                      │
│     │     • Maybe one warning with [Fix] button                         │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  6  │  RUN                                                           │
│  └──┬──┘  • Click big [Run] button                                      │
│     │     • See execution animate through nodes                         │
│     │     • Success message with results                                │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  7  │  CELEBRATE                                                     │
│  └─────┘  • "Your flow is live!"                                        │
│           • Option to save, share, or schedule                          │
│           • Mind remembers preferences for next time                    │
│                                                                         │
│  TIME: ~8 minutes                                                       │
│  CLICKS: ~12                                                            │
│  TYPING: 1 sentence                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Journey 2: Returning User (Builder)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  GOAL: Modify existing flow with new requirement                        │
│                                                                         │
│  ┌─────┐                                                                │
│  │  1  │  OPEN PROJECT                                                  │
│  └──┬──┘  • Dashboard shows recent projects                             │
│     │     • Click "DeFi Price Alert"                                    │
│     │     • Canvas loads instantly (cached)                             │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  2  │  STUDIO MODE (auto-detected for returning user)                │
│  └──┬──┘  • Full canvas with all panels visible                         │
│     │     • Recent chat history visible                                 │
│     │     • Mind shows past decisions                                   │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  3  │  ASK FOR CHANGES                                               │
│  └──┬──┘  • Type: "Add a stop-loss at 10%"                              │
│     │     • Opus proposes ghost node                                    │
│     │     • Shows where it connects                                     │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  4  │  REVIEW & APPROVE                                              │
│  └──┬──┘  • See diff: "+ stop-loss node"                                │
│     │     • Click [Apply]                                               │
│     │     • Ghost becomes solid                                         │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  5  │  MANUAL TWEAK                                                  │
│  └──┬──┘  • Click node to configure                                     │
│     │     • Change threshold from 10% to 8%                             │
│     │     • See patterns/anti-patterns in panel                         │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  6  │  TEST & DEPLOY                                                 │
│  └─────┘  • Pre-flight check                                            │
│           • Run test with simulated data                                │
│           • Deploy to production schedule                               │
│                                                                         │
│  TIME: ~5 minutes                                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Journey 3: Power User (Expert)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  GOAL: Build complex multi-agent system quickly                         │
│                                                                         │
│  ┌─────┐                                                                │
│  │  1  │  CMD+N (New Project)                                           │
│  └──┬──┘  • Instantly in Studio Mode                                    │
│     │     • Empty canvas ready                                          │
│     │     • Palette visible on left                                     │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  2  │  CMD+K (Command Palette)                                       │
│  └──┬──┘  • Type: "add autonomous-agents"                               │
│     │     • Skill appears, positioned with keyboard                     │
│     │     • Repeat for other skills                                     │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  3  │  DRAG CONNECTIONS                                              │
│  └──┬──┘  • Drag from output port to input port                         │
│     │     • System validates compatibility                              │
│     │     • Handoff protocol shown on hover                             │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  4  │  TOGGLE CODE MODE                                              │
│  └──┬──┘  • Split view: canvas + YAML editor                            │
│     │     • Edit configs directly                                       │
│     │     • Changes reflect on canvas                                   │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  5  │  CHAOS TEST                                                    │
│  └──┬──┘  • Run "chaos test" simulation                                 │
│     │     • See where failures would occur                              │
│     │     • Fix highlighted weak points                                 │
│     ▼                                                                   │
│  ┌─────┐                                                                │
│  │  6  │  EXPORT                                                        │
│  └─────┘  • Export as Python/TypeScript                                 │
│           • Or export as API spec                                       │
│           • Or share as team recipe                                     │
│                                                                         │
│  TIME: ~15 minutes for complex system                                   │
│  MOSTLY: Keyboard-driven                                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Feature Requirements

### P0 - Must Have (MVP)

| Feature | Description | User Value |
|---------|-------------|------------|
| **Welcome Flow** | Single prompt + recipe gallery | Zero-friction start |
| **AI Composer** | Natural language to skill chain | No learning curve |
| **Visual Canvas** | Drag-drop nodes with connections | See what you're building |
| **Skill Library** | Browse/search 273+ skills | Find the right tool |
| **Basic Validation** | Type checking + required fields | Prevent obvious errors |
| **Run Execution** | Execute flow and show results | See it work |
| **Undo/Redo** | Full history with keyboard shortcuts | Safe to experiment |
| **Local Mode** | Works on user's machine | Privacy option |

### P1 - Should Have (Beta)

| Feature | Description | User Value |
|---------|-------------|------------|
| **Ghost Previews** | AI proposals shown before applying | Control over changes |
| **Pre-flight Check** | Full validation with auto-fix | Catch issues early |
| **Mind Panel** | Decision memory + semantic search | Context preservation |
| **Cloud Sync** | Projects sync across devices | Work anywhere |
| **Mode Toggle** | Express/Studio/Code modes | Right complexity level |
| **Sharp Edges** | Warnings for common pitfalls | Learn best practices |
| **Recipes** | Community-shared templates | Don't start from scratch |

### P2 - Nice to Have (v1.0)

| Feature | Description | User Value |
|---------|-------------|------------|
| **Replay Debugger** | Scrub through execution timeline | Debug visually |
| **Chaos Testing** | Simulate failures before deploy | Production confidence |
| **Skill Chemistry** | Show synergy between skills | Better combinations |
| **Code Export** | Export as Python/TypeScript | Take code ownership |
| **Team Workspaces** | Shared projects with permissions | Collaboration |
| **Custom Skills** | Create your own skill definitions | Extensibility |
| **API Publishing** | Turn flows into REST APIs | Production deployment |

### P3 - Future Considerations

| Feature | Description | Timeline |
|---------|-------------|----------|
| **Mobile View** | Responsive canvas for tablets | v1.5 |
| **Voice Input** | Describe flows by speaking | v2.0 |
| **Marketplace** | Buy/sell premium skills | v2.0 |
| **White Label** | Branded version for enterprises | v2.0 |
| **Self-Hosted Cloud** | Docker deployment for orgs | v1.5 |

---

## User Experience Specifications

### Layout Specifications

#### Express Mode (Default for New Users)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Logo                                     [Express ▾] [Save] [Run ▶]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │                             │  │                                 │  │
│  │                             │  │  AI COMPOSER                    │  │
│  │      CANVAS PREVIEW         │  │  ────────────                   │  │
│  │        (30% width)          │  │                                 │  │
│  │                             │  │  [Chat messages]                │  │
│  │    Small, zoomable view     │  │                                 │  │
│  │    Click to expand          │  │  [Proposal cards]               │  │
│  │                             │  │                                 │  │
│  │                             │  │  [Quick actions]                │  │
│  │                             │  │                                 │  │
│  │                             │  │  ┌─────────────────────────┐   │  │
│  │                             │  │  │ Type your message...    │   │  │
│  │                             │  │  └─────────────────────────┘   │  │
│  │                             │  │        (70% width)              │  │
│  └─────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Studio Mode (Default for Returning Users)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Logo    [Project Name ▾]                [Studio ▾] [Preflight] [Run]  │
├────────────┬────────────────────────────────────────┬───────────────────┤
│            │                                        │                   │
│  PALETTE   │              CANVAS                    │   COMPOSER +      │
│  ────────  │              ──────                    │   MIND            │
│            │                                        │   ──────────      │
│  🔍 Search │    Infinite canvas with                │                   │
│            │    - Skill nodes                       │   [Tabs]          │
│  ▸ DeFi    │    - Connections                       │   Chat | Mind     │
│  ▸ Auth    │    - Mini-map                          │                   │
│  ▸ Data    │                                        │   [Content]       │
│  ▸ API     │    Full drag/drop                      │                   │
│            │    Right-click menus                   │                   │
│  ────────  │    Keyboard shortcuts                  │                   │
│            │                                        │                   │
│  RECIPES   │                                        │                   │
│  ────────  │         (60% width)                    │   (25% width)     │
│  [cards]   │                                        │                   │
│  (15%)     │                                        │                   │
└────────────┴────────────────────────────────────────┴───────────────────┘
```

#### Code Mode (Power Users)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Logo    [Project Name ▾]                  [Code ▾] [Preflight] [Run]  │
├────────────────────────────────────────┬────────────────────────────────┤
│                                        │                                │
│              CANVAS                    │          CODE EDITOR           │
│              ──────                    │          ───────────           │
│                                        │                                │
│    Visual representation               │   skill.yaml                   │
│    of the flow                         │   ─────────────                │
│                                        │   id: defi-monitor             │
│    Click node to focus                 │   config:                      │
│    in code editor                      │     chain: ethereum            │
│                                        │     threshold: 0.05            │
│                                        │   inputs:                      │
│                                        │     - token_pair               │
│                                        │   outputs:                     │
│                                        │     - price_data               │
│                                        │                                │
│         (50% width)                    │         (50% width)            │
│                                        │                                │
└────────────────────────────────────────┴────────────────────────────────┘
```

### Node Design Specifications

#### Collapsed Node (Default)

```
┌────────────────────────────────┐
│  ⛓️  Blockchain DeFi          │   ← Icon + Name (14px bold)
│  ──────────────────────────── │
│                                │
│  Monitors prices and           │   ← Description (12px, gray)
│  executes trades               │
│                                │
│  ○ chain_id         price ●───│   ← Ports (input left, output right)
│  ○ threshold                   │
│                                │
│  [ ✅ Valid ]                  │   ← Status badge
└────────────────────────────────┘

Size: 240px × 140px
Corner radius: 8px
Shadow: 0 2px 8px rgba(0,0,0,0.1)
```

#### Expanded Node (On Click)

```
┌────────────────────────────────────────────────────────────────┐
│  ⛓️  Blockchain DeFi                                    [×]   │
│  ────────────────────────────────────────────────────────────  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  CONFIGURATION                                           │ │
│  │  ─────────────                                           │ │
│  │  Chain:        [Ethereum ▾]                              │ │
│  │  Threshold:    [5] %                                     │ │
│  │  Interval:     [30] seconds                              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  PATTERNS                      ANTI-PATTERNS             │ │
│  │  ✓ Use multicall               ✗ Don't poll too fast     │ │
│  │  ✓ Handle reverts              ✗ Never hardcode keys     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ⚠️ SHARP EDGES                                          │ │
│  │  • Gas estimation may fail on complex paths              │ │
│  │  • Some DEXs have different decimals                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ○ chain_id                                      price ●───   │
│  ○ threshold                                   tx_hash ●───   │
│                                                                │
│  [Collapse] [Test This Node] [View YAML]                       │
└────────────────────────────────────────────────────────────────┘

Size: 400px × auto (content-based)
```

#### Ghost Node (AI Proposal)

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  ⛓️  Blockchain DeFi              ← Same content but:
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     • Dashed border
│                                │ • 50% opacity
  Monitors prices and              • Subtle pulse animation
  executes trades
│                                │
  ○ chain_id         price ●───
│ ○ threshold                    │

│ [Accept] [Modify] [Reject]     │ ← Action buttons
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

### Connection Design

```
DATA CONNECTION (solid)
──────────────────────

    [Node A] ────────────────────────▶ [Node B]

             • 2px stroke
             • Color matches output port type
             • Subtle animation on data flow


HANDOFF CONNECTION (dashed)
───────────────────────────

    [Node A] ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ▶ [Node B]

             • 2px dashed stroke
             • Purple color (#8B5CF6)
             • Hover shows handoff protocol


MEMORY CONNECTION (double)
─────────────────────────

    [Node A] ═══════════════════════════ [Mind]

             • 3px double stroke
             • Gold color (#F59E0B)
             • Connects to Mind panel


INVALID CONNECTION (blocked)
────────────────────────────

    [Node A] ────────❌────────────────▶ [Node B]

             • Red color (#EF4444)
             • X icon in middle
             • Tooltip shows error
```

### Color System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  SKILL CATEGORIES (Node Header Colors)                                  │
│  ─────────────────────────────────────                                  │
│                                                                         │
│  DeFi/Blockchain   #8B5CF6  (Purple)                                    │
│  Auth/Security     #EF4444  (Red)                                       │
│  Data/Database     #3B82F6  (Blue)                                      │
│  API/Integration   #10B981  (Green)                                     │
│  AI/ML             #F59E0B  (Amber)                                     │
│  Frontend          #EC4899  (Pink)                                      │
│  DevOps            #6366F1  (Indigo)                                    │
│  Notification      #14B8A6  (Teal)                                      │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PORT TYPES (Connection Colors)                                         │
│  ─────────────────────────────                                          │
│                                                                         │
│  String            #6B7280  (Gray)                                      │
│  Number            #3B82F6  (Blue)                                      │
│  Boolean           #8B5CF6  (Purple)                                    │
│  JSON/Object       #10B981  (Green)                                     │
│  Array             #F59E0B  (Amber)                                     │
│  Binary            #EF4444  (Red)                                       │
│  Any               #9CA3AF  (Light Gray, dashed)                        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STATUS INDICATORS                                                      │
│  ─────────────────                                                      │
│                                                                         │
│  Valid             #10B981  (Green)    ✅                               │
│  Warning           #F59E0B  (Amber)    ⚠️                               │
│  Error             #EF4444  (Red)      ❌                               │
│  Running           #3B82F6  (Blue)     ⏳ (animated)                    │
│  Ghost             #9CA3AF  (Gray)     50% opacity                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+K` | Open command palette | Global |
| `Cmd+N` | New project | Global |
| `Cmd+S` | Save project | Project |
| `Cmd+Z` | Undo | Canvas |
| `Cmd+Shift+Z` | Redo | Canvas |
| `Cmd+A` | Select all nodes | Canvas |
| `Cmd+D` | Duplicate selection | Canvas |
| `Delete` | Delete selection | Canvas |
| `Cmd+G` | Group selection | Canvas |
| `Cmd+Enter` | Run flow | Project |
| `Cmd+Shift+V` | Validate/Preflight | Project |
| `Space` | Pan canvas (hold) | Canvas |
| `Cmd+Plus` | Zoom in | Canvas |
| `Cmd+Minus` | Zoom out | Canvas |
| `Cmd+0` | Reset zoom | Canvas |
| `Escape` | Deselect / Close panel | Global |
| `Tab` | Cycle through nodes | Canvas |
| `Enter` | Expand selected node | Canvas |
| `/` | Focus chat input | Global |

---

## Success Metrics

### North Star Metric

**Flows Deployed to Production per Month**

This measures real value delivered—not just users playing around, but actual working automations.

### Primary Metrics

| Metric | Target (v1.0) | Measurement |
|--------|---------------|-------------|
| **Time to First Flow** | < 10 minutes | From signup to first run |
| **Completion Rate** | > 70% | Started flow → Successful run |
| **Weekly Active Users** | 5,000 | Users with 1+ session/week |
| **Flows per User** | 3+ | Average flows created |
| **Retention (D7)** | > 40% | Return after 7 days |
| **Retention (D30)** | > 25% | Return after 30 days |

### Secondary Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **AI Acceptance Rate** | > 60% | Users apply AI proposals |
| **Preflight Fix Rate** | > 80% | Users fix flagged issues |
| **Mode Progression** | 30% | Express → Studio within 30 days |
| **Recipe Usage** | > 40% | First flow from recipe |
| **Export Rate** | 15% | Flows exported to code |
| **Share Rate** | 10% | Flows shared as recipes |

### Health Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Error Rate** | < 0.1% | > 1% |
| **P95 Latency** | < 500ms | > 2000ms |
| **AI Response Time** | < 3s | > 10s |
| **Sync Conflicts** | < 1% | > 5% |

---

## Release Plan

### Phase 1: MVP (Weeks 1-8)

```
WEEK 1-2: Foundation
├── SvelteKit project setup
├── Basic routing and layout
├── Tailwind + design system
└── Local storage for projects

WEEK 3-4: Canvas Core
├── Svelvet integration
├── Node rendering
├── Connection drawing
├── Viewport controls

WEEK 5-6: AI Composer
├── Chat panel UI
├── Claude API integration
├── Streaming responses
├── Basic skill chain generation

WEEK 7-8: Integration + Polish
├── Skill loader (from spawner-v2)
├── Basic validation
├── Run execution
├── Error handling

DELIVERABLE: Working local app that generates skill chains from chat
```

### Phase 2: Beta (Weeks 9-16)

```
WEEK 9-10: Ghost System
├── Proposal preview
├── Diff visualization
├── Apply/Reject flow
└── Undo/Redo stack

WEEK 11-12: Validation Engine
├── Full preflight checks
├── Sharp edge warnings
├── Auto-fix suggestions
└── Validation badges

WEEK 13-14: Mind Integration
├── Decision logging
├── Semantic search (LanceDB)
├── Memory panel UI
└── Context injection

WEEK 15-16: Cloud Infrastructure
├── Cloudflare Workers setup
├── D1 database
├── Auth flow
└── Sync engine

DELIVERABLE: Cloud-enabled beta with full validation and memory
```

### Phase 3: v1.0 (Weeks 17-24)

```
WEEK 17-18: Polish
├── Mode system (Express/Studio/Code)
├── Keyboard shortcuts
├── Command palette
└── Performance optimization

WEEK 19-20: Advanced Features
├── Replay debugger
├── Chaos testing
├── Code export
└── Recipe system

WEEK 21-22: Production Readiness
├── Security audit
├── Load testing
├── Error monitoring
├── Documentation

WEEK 23-24: Launch Prep
├── Landing page
├── Onboarding flow
├── Tutorial content
└── Community setup

DELIVERABLE: Production-ready v1.0
```

---

## Competitive Analysis

### Feature Comparison

| Feature | Spawner UI | n8n | Dify | Langflow |
|---------|------------|-----|------|----------|
| **Starting Point** | Chat | Canvas | Canvas | Canvas |
| **Node Types** | 273 skills | ~400 integrations | 15 nodes | LangChain nodes |
| **AI Generation** | Native | Add-on | Basic | None |
| **Memory System** | Mind layer | None | Session | None |
| **Validation** | Per-skill rules | Basic | Basic | Type checking |
| **Sharp Edges** | Built-in | None | None | None |
| **Local Mode** | Full | Yes | Yes | Yes |
| **Cloud Mode** | Yes | Hosted option | Yes | Yes |
| **Export to Code** | Yes | JSON only | No | Yes |
| **Pricing** | Free + Pro | Free + EE | Free + Pro | Free |

### Positioning

```
                        HIGH ABSTRACTION
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              │   ChatGPT     │   Spawner UI  │ ← OUR POSITION
              │               │   (Express)   │
              │               │               │
  SIMPLE ─────┼───────────────┼───────────────┼───── POWERFUL
              │               │               │
              │    Zapier     │   Spawner UI  │
              │               │   (Studio)    │
              │               │               │
              └───────────────┼───────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              │     n8n       │   LangGraph   │
              │    Dify       │   Code        │
              │               │               │
              └───────────────┼───────────────┘
                              │
                        LOW ABSTRACTION
```

### Why We Win

1. **Chat-First**: Competitors assume users know what nodes they need. We start with their goal.

2. **Expert Personas**: Our skills have opinions—patterns, anti-patterns, sharp edges. Generic nodes don't.

3. **Memory**: No other tool remembers why you made decisions. We do.

4. **Progressive**: One tool that grows with you, not three different products.

5. **Dual Mode**: Cloud convenience OR local privacy. Not forced to choose permanently.

---

## Appendix: Open Questions

| Question | Options | Decision Needed By |
|----------|---------|-------------------|
| Pricing model | Freemium vs. usage-based | Week 20 |
| Self-hosted enterprise | Docker vs. Kubernetes | Week 22 |
| Skill marketplace | Curated vs. open | v1.5 |
| Mobile support | Responsive vs. native app | v1.5 |
| White-label | Yes/No | v2.0 |

---

*PRD v1.0 - January 2025*
