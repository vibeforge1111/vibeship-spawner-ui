# Spawner UI - UI/UX Design System

> Complete visual and interaction design specification
> Version 1.0 | January 2025

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Visual Identity](#visual-identity)
3. [Design Tokens](#design-tokens)
4. [Layout System](#layout-system)
5. [Component Library](#component-library)
6. [Interaction Patterns](#interaction-patterns)
7. [Animation System](#animation-system)
8. [User Flows](#user-flows)
9. [Responsive Design](#responsive-design)
10. [Accessibility](#accessibility)
11. [Dark/Light Modes](#darklight-modes)
12. [Micro-interactions](#micro-interactions)

---

## Design Philosophy

### Core Principles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  1. CONVERSATION OVER CONFIGURATION                                         │
│     ─────────────────────────────────                                       │
│     Users describe what they want. The system builds it.                    │
│     Text input is always the fastest path.                                  │
│                                                                             │
│  2. PROGRESSIVE COMPLEXITY                                                  │
│     ──────────────────────────                                              │
│     Start simple. Reveal depth on demand.                                   │
│     Never show 100 options when 3 will do.                                  │
│                                                                             │
│  3. VISIBLE SYSTEM STATE                                                    │
│     ─────────────────────────                                               │
│     Users always know: What's happening? What's next? What went wrong?      │
│     No mystery meat, no hidden processes.                                   │
│                                                                             │
│  4. SAFE EXPERIMENTATION                                                    │
│     ──────────────────────                                                  │
│     Every action is reversible. Previews before commits.                    │
│     Fear of breaking things kills creativity.                               │
│                                                                             │
│  5. SPEED AS FEATURE                                                        │
│     ─────────────────                                                       │
│     Instant feedback. No spinners longer than 200ms without explanation.    │
│     Perceived performance matters as much as actual performance.            │
│                                                                             │
│  6. PERSONALITY WITHOUT GIMMICKS                                            │
│     ───────────────────────────                                             │
│     Confident, technical, slightly playful.                                 │
│     We're building serious tools that don't take themselves too seriously.  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Design Mantras

| Situation | Response |
|-----------|----------|
| User is confused | Show, don't tell. Animate the explanation. |
| User made a mistake | Make it trivially easy to undo. No blame. |
| System is processing | Stream progress. Never block without feedback. |
| Feature is complex | Hide it by default. Reveal with clear affordance. |
| User succeeded | Celebrate briefly. Don't interrupt momentum. |

---

## Visual Identity

### Brand Essence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  SPAWNER                                                                    │
│                                                                             │
│  Aesthetic:      Cyber-Industrial meets Warm Accessibility                  │
│  Mood:           Powerful but approachable                                  │
│  Personality:    Expert friend, not corporate robot                         │
│                                                                             │
│  KEY VISUAL THEMES:                                                         │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   DEPTH     │  │   GLOW      │  │   FLOW      │  │   CLARITY   │        │
│  │             │  │             │  │             │  │             │        │
│  │  Layered    │  │  Subtle     │  │  Animated   │  │  High       │        │
│  │  surfaces   │  │  light      │  │  connections│  │  contrast   │        │
│  │  with       │  │  effects    │  │  showing    │  │  text on    │        │
│  │  shadows    │  │  guide      │  │  data       │  │  dark       │        │
│  │             │  │  attention  │  │  movement   │  │  surfaces   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Logo Concepts

```
PRIMARY LOGO (Full)
───────────────────

   ╔═╗ ╔═╗ ╔═╗ ╦ ╦ ╔╗╔ ╔═╗ ╦═╗
   ╚═╗ ╠═╝ ╠═╣ ║║║ ║║║ ║╣  ╠╦╝
   ╚═╝ ╩   ╩ ╩ ╚╩╝ ╝╚╝ ╚═╝ ╩╚═

   Font: Custom geometric sans (based on Space Grotesk)
   Treatment: Solid white on dark, or gradient on light


ICON (Mark Only)
────────────────

   ┌───────────┐
   │     ◆     │      The "Spawner Diamond"
   │    ╱ ╲    │      - Represents node/skill
   │   ◇───◇   │      - Connected nodes below
   │           │      - Suggests generation/spawning
   └───────────┘

   Usage: Favicon, app icon, small spaces


ANIMATED LOGO (Loading State)
─────────────────────────────

   Frame 1:  ◇
   Frame 2:  ◇───◇
   Frame 3:  ◇───◆───◇
   Frame 4:  ◇───◆───◇
                 │
                 ◇

   Duration: 1.5s loop
   Usage: Initial load, long operations
```

---

## Design Tokens

### Color System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  FOUNDATION COLORS                                                          │
│  ─────────────────                                                          │
│                                                                             │
│  Background                                                                 │
│  ──────────                                                                 │
│  bg-base         #09090B     ████████  Near black, main background          │
│  bg-surface      #18181B     ████████  Elevated surfaces (cards, panels)    │
│  bg-elevated     #27272A     ████████  Modals, dropdowns, tooltips          │
│  bg-hover        #3F3F46     ████████  Hover states on surfaces             │
│                                                                             │
│  Borders                                                                    │
│  ───────                                                                    │
│  border-subtle   #27272A     ████████  Default borders                      │
│  border-default  #3F3F46     ████████  Emphasized borders                   │
│  border-strong   #52525B     ████████  High contrast borders                │
│                                                                             │
│  Text                                                                       │
│  ────                                                                       │
│  text-primary    #FAFAFA     ████████  Primary text, headings               │
│  text-secondary  #A1A1AA     ████████  Secondary text, labels               │
│  text-tertiary   #71717A     ████████  Placeholder, disabled                │
│  text-inverse    #09090B     ████████  Text on light backgrounds            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ACCENT COLORS                                                              │
│  ─────────────                                                              │
│                                                                             │
│  Primary (Spawner Yellow)                                                   │
│  ────────────────────────                                                   │
│  primary-50      #FEFCE8     ░░░░░░░░  Subtle backgrounds                   │
│  primary-100     #FEF9C3     ░░░░░░░░  Light backgrounds                    │
│  primary-200     #FEF08A     ████████  Hover states                         │
│  primary-300     #FDE047     ████████  Secondary buttons                    │
│  primary-400     #FACC15     ████████  PRIMARY - Main actions               │
│  primary-500     #EAB308     ████████  Hover on primary                     │
│  primary-600     #CA8A04     ████████  Active/pressed                       │
│  primary-700     #A16207     ████████  Dark variant                         │
│                                                                             │
│  Secondary (Electric Cyan)                                                  │
│  ─────────────────────────                                                  │
│  secondary-400   #22D3EE     ████████  Links, info highlights               │
│  secondary-500   #06B6D4     ████████  Interactive elements                 │
│  secondary-600   #0891B2     ████████  Hover states                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SEMANTIC COLORS                                                            │
│  ───────────────                                                            │
│                                                                             │
│  Success                                                                    │
│  ───────                                                                    │
│  success-400     #4ADE80     ████████  Success icons, badges                │
│  success-500     #22C55E     ████████  Success backgrounds                  │
│  success-600     #16A34A     ████████  Success text, borders                │
│  success-bg      #052E16     ████████  Success surface (dark)               │
│                                                                             │
│  Warning                                                                    │
│  ───────                                                                    │
│  warning-400     #FB923C     ████████  Warning icons, badges                │
│  warning-500     #F97316     ████████  Warning backgrounds                  │
│  warning-600     #EA580C     ████████  Warning text, borders                │
│  warning-bg      #431407     ████████  Warning surface (dark)               │
│                                                                             │
│  Error                                                                      │
│  ─────                                                                      │
│  error-400       #F87171     ████████  Error icons, badges                  │
│  error-500       #EF4444     ████████  Error backgrounds                    │
│  error-600       #DC2626     ████████  Error text, borders                  │
│  error-bg        #450A0A     ████████  Error surface (dark)                 │
│                                                                             │
│  Info                                                                       │
│  ────                                                                       │
│  info-400        #60A5FA     ████████  Info icons, badges                   │
│  info-500        #3B82F6     ████████  Info backgrounds                     │
│  info-600        #2563EB     ████████  Info text, borders                   │
│  info-bg         #172554     ████████  Info surface (dark)                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SKILL CATEGORY COLORS (Node Headers)                                       │
│  ────────────────────────────────────                                       │
│                                                                             │
│  DeFi/Blockchain     #8B5CF6     ████████  Purple                           │
│  Auth/Security       #EF4444     ████████  Red                              │
│  Data/Database       #3B82F6     ████████  Blue                             │
│  API/Integration     #10B981     ████████  Green                            │
│  AI/ML               #F59E0B     ████████  Amber                            │
│  Frontend            #EC4899     ████████  Pink                             │
│  DevOps              #6366F1     ████████  Indigo                           │
│  Notification        #14B8A6     ████████  Teal                             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DATA TYPE COLORS (Connection Wires)                                        │
│  ───────────────────────────────────                                        │
│                                                                             │
│  String              #A1A1AA     ████████  Gray                             │
│  Number              #60A5FA     ████████  Blue                             │
│  Boolean             #C084FC     ████████  Purple                           │
│  Object/JSON         #4ADE80     ████████  Green                            │
│  Array               #FBBF24     ████████  Yellow                           │
│  Binary              #F87171     ████████  Red                              │
│  Any/Unknown         #52525B     ████████  Dark gray (dashed)               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Typography

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  FONT FAMILIES                                                              │
│  ─────────────                                                              │
│                                                                             │
│  Primary (UI):        Inter                                                 │
│                       Clean, highly legible, excellent for interfaces       │
│                       Fallback: system-ui, -apple-system, sans-serif        │
│                                                                             │
│  Monospace (Code):    JetBrains Mono                                        │
│                       Designed for coding, great ligatures                  │
│                       Fallback: SF Mono, Consolas, monospace                │
│                                                                             │
│  Display (Headings):  Space Grotesk                                         │
│                       Geometric, technical feel                             │
│                       Use sparingly for impact                              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TYPE SCALE                                                                 │
│  ──────────                                                                 │
│                                                                             │
│  Name          Size    Weight    Line Height    Letter Spacing    Usage     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  display-xl    48px    700       1.1            -0.02em           Hero      │
│  display-lg    36px    700       1.1            -0.02em           Page title│
│  display-md    30px    600       1.2            -0.01em           Section   │
│                                                                             │
│  heading-xl    24px    600       1.3            -0.01em           Card title│
│  heading-lg    20px    600       1.3            0                 Panel head│
│  heading-md    18px    600       1.4            0                 Subhead   │
│  heading-sm    16px    600       1.4            0                 Small head│
│                                                                             │
│  body-lg       16px    400       1.6            0                 Main text │
│  body-md       14px    400       1.5            0                 Default   │
│  body-sm       13px    400       1.5            0                 Secondary │
│                                                                             │
│  label-lg      14px    500       1.4            0.01em            Form label│
│  label-md      12px    500       1.4            0.02em            Small lbl │
│  label-sm      11px    500       1.3            0.03em            Tiny label│
│                                                                             │
│  code-lg       14px    400       1.5            0                 Code block│
│  code-md       13px    400       1.5            0                 Inline    │
│  code-sm       12px    400       1.4            0                 Small code│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Spacing System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  SPACING SCALE (4px base)                                                   │
│  ────────────────────────                                                   │
│                                                                             │
│  space-0       0px      │                                                   │
│  space-1       4px      │▌                                                  │
│  space-2       8px      │██                                                 │
│  space-3       12px     │███                                                │
│  space-4       16px     │████                                               │
│  space-5       20px     │█████                                              │
│  space-6       24px     │██████                                             │
│  space-8       32px     │████████                                           │
│  space-10      40px     │██████████                                         │
│  space-12      48px     │████████████                                       │
│  space-16      64px     │████████████████                                   │
│  space-20      80px     │████████████████████                               │
│  space-24      96px     │████████████████████████                           │
│                                                                             │
│  COMMON USAGE                                                               │
│  ────────────                                                               │
│  • Component padding:     space-3 to space-4 (12-16px)                      │
│  • Card padding:          space-4 to space-6 (16-24px)                      │
│  • Section spacing:       space-8 to space-12 (32-48px)                     │
│  • Page margins:          space-6 to space-8 (24-32px)                      │
│  • Inline element gap:    space-2 (8px)                                     │
│  • Form field spacing:    space-4 (16px)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Border Radius

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  RADIUS SCALE                                                               │
│  ────────────                                                               │
│                                                                             │
│  radius-none   0px      ┌────────┐   Sharp corners                          │
│  radius-sm     4px      ╭────────╮   Subtle rounding (inputs, small btns)   │
│  radius-md     8px      ╭────────╮   Default (buttons, cards)               │
│  radius-lg     12px     ╭────────╮   Larger elements (modals)               │
│  radius-xl     16px     ╭────────╮   Feature cards                          │
│  radius-2xl    24px     ╭────────╮   Large containers                       │
│  radius-full   9999px   (────────)   Pills, avatars, circular               │
│                                                                             │
│  USAGE GUIDE                                                                │
│  ───────────                                                                │
│  • Buttons:           radius-md (8px)                                       │
│  • Input fields:      radius-md (8px)                                       │
│  • Cards:             radius-lg (12px)                                      │
│  • Modals:            radius-xl (16px)                                      │
│  • Skill nodes:       radius-lg (12px)                                      │
│  • Tooltips:          radius-md (8px)                                       │
│  • Tags/badges:       radius-full                                           │
│  • Avatars:           radius-full                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Shadows & Elevation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  SHADOW SYSTEM                                                              │
│  ─────────────                                                              │
│                                                                             │
│  shadow-sm     0 1px 2px rgba(0,0,0,0.3)                                    │
│                Subtle lift (buttons, inputs)                                │
│                                                                             │
│  shadow-md     0 4px 6px -1px rgba(0,0,0,0.3),                              │
│                0 2px 4px -2px rgba(0,0,0,0.3)                               │
│                Default elevation (cards, dropdowns)                         │
│                                                                             │
│  shadow-lg     0 10px 15px -3px rgba(0,0,0,0.4),                            │
│                0 4px 6px -4px rgba(0,0,0,0.4)                               │
│                High elevation (modals, popovers)                            │
│                                                                             │
│  shadow-xl     0 20px 25px -5px rgba(0,0,0,0.5),                            │
│                0 8px 10px -6px rgba(0,0,0,0.5)                              │
│                Maximum elevation (overlays)                                 │
│                                                                             │
│  GLOW EFFECTS (for emphasis)                                                │
│  ───────────────────────────                                                │
│                                                                             │
│  glow-primary  0 0 20px rgba(250, 204, 21, 0.3)   Yellow glow               │
│  glow-success  0 0 20px rgba(34, 197, 94, 0.3)    Green glow                │
│  glow-error    0 0 20px rgba(239, 68, 68, 0.3)    Red glow                  │
│  glow-info     0 0 20px rgba(59, 130, 246, 0.3)   Blue glow                 │
│                                                                             │
│  ELEVATION LEVELS                                                           │
│  ────────────────                                                           │
│                                                                             │
│  Level 0:  bg-base      (Page background)                                   │
│  Level 1:  bg-surface   + shadow-sm (Cards, panels)                         │
│  Level 2:  bg-elevated  + shadow-md (Dropdowns, tooltips)                   │
│  Level 3:  bg-elevated  + shadow-lg (Modals)                                │
│  Level 4:  bg-elevated  + shadow-xl (Command palette)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layout System

### App Shell

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  GLOBAL HEADER (56px height, fixed)                                         │
│  ─────────────────────────────────                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Logo]  │  Project: ▼  │           │  [Preflight] [Run ▶] │ [👤]  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     48px      Variable       Spacer          Actions        Avatar          │
│                                                                             │
│  Properties:                                                                │
│  • Background: bg-surface with border-bottom                                │
│  • Z-index: 50 (above content, below modals)                                │
│  • Shadow: shadow-sm on scroll                                              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MAIN LAYOUT REGIONS                                                        │
│  ───────────────────                                                        │
│                                                                             │
│  ┌────────┬──────────────────────────────────┬─────────────────────────┐   │
│  │        │                                  │                         │   │
│  │  LEFT  │            CENTER                │          RIGHT          │   │
│  │ PANEL  │            CANVAS                │          PANEL          │   │
│  │        │                                  │                         │   │
│  │ 240px  │           Flexible               │          320px          │   │
│  │  min   │           (grows)                │           min           │   │
│  │ 320px  │                                  │          400px          │   │
│  │  max   │                                  │           max           │   │
│  │        │                                  │                         │   │
│  │ Resize │                                  │         Resize          │   │
│  │   ↔    │                                  │            ↔            │   │
│  │        │                                  │                         │   │
│  └────────┴──────────────────────────────────┴─────────────────────────┘   │
│                                                                             │
│  Panel Behavior:                                                            │
│  • Panels can be collapsed (icon-only state)                                │
│  • Panels can be resized by dragging edge                                   │
│  • Collapsed state persists in localStorage                                 │
│  • Keyboard: Cmd+B (left), Cmd+J (right)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layout Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  EXPRESS MODE (Beginner Default)                                            │
│  ═══════════════════════════════                                            │
│                                                                             │
│  Priority: Chat > Canvas > Everything else                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Logo]  Express Mode                         [Switch to Studio]    │   │
│  ├─────────────────────────────────┬───────────────────────────────────┤   │
│  │                                 │                                   │   │
│  │                                 │        AI COMPOSER                │   │
│  │      CANVAS PREVIEW             │        ────────────               │   │
│  │      ──────────────             │                                   │   │
│  │                                 │   Welcome! What would you like    │   │
│  │   ┌─────┐                       │   to build today?                 │   │
│  │   │     │───┐                   │                                   │   │
│  │   └─────┘   │                   │   ┌─────────────────────────────┐ │   │
│  │             ▼                   │   │ A DeFi bot that monitors... │ │   │
│  │         ┌─────┐                 │   └─────────────────────────────┘ │   │
│  │         │     │                 │                                   │   │
│  │         └─────┘                 │   ────────── OR ──────────        │   │
│  │                                 │                                   │   │
│  │   [Click to expand]             │   [Recipe Cards...]               │   │
│  │                                 │                                   │   │
│  │         35%                     │              65%                  │   │
│  └─────────────────────────────────┴───────────────────────────────────┘   │
│                                                                             │
│  • Left panel: HIDDEN                                                       │
│  • Canvas: Compact preview, click to focus                                  │
│  • Right panel: Chat dominates, full conversation view                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STUDIO MODE (Builder Default)                                              │
│  ═════════════════════════════                                              │
│                                                                             │
│  Priority: Canvas > Panels (balanced)                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Logo]  Project Name ▼           [Preflight] [Run ▶]  Studio Mode  │   │
│  ├──────────────┬──────────────────────────────────┬───────────────────┤   │
│  │              │                                  │                   │   │
│  │  PALETTE     │          CANVAS                  │   COMPOSER        │   │
│  │  ────────    │          ──────                  │   ────────        │   │
│  │              │                                  │                   │   │
│  │  🔍 Search   │    ┌─────┐      ┌─────┐         │   [Chat]          │   │
│  │              │    │     │─────▶│     │         │                   │   │
│  │  ▸ DeFi      │    └─────┘      └──┬──┘         │   [Mind]          │   │
│  │  ▸ Auth      │                    │            │                   │   │
│  │  ▸ Data      │                    ▼            │   ┌─────────────┐ │   │
│  │              │               ┌─────┐           │   │ Message...  │ │   │
│  │  ──────────  │               │     │           │   └─────────────┘ │   │
│  │  RECIPES     │               └─────┘           │                   │   │
│  │  [cards]     │                                  │                   │   │
│  │              │                                  │                   │   │
│  │    15%       │              55%                 │        30%        │   │
│  └──────────────┴──────────────────────────────────┴───────────────────┘   │
│                                                                             │
│  • Left panel: Skill palette + recipes                                      │
│  • Canvas: Primary workspace, full interaction                              │
│  • Right panel: Tabbed (Chat / Mind), collapsible                           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CODE MODE (Expert)                                                         │
│  ═════════════════                                                          │
│                                                                             │
│  Priority: Canvas + Code side-by-side                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [Logo]  Project Name ▼           [Preflight] [Run ▶]    Code Mode  │   │
│  ├────────────────────────────────────┬────────────────────────────────┤   │
│  │                                    │                                │   │
│  │           CANVAS                   │        CODE EDITOR             │   │
│  │           ──────                   │        ───────────             │   │
│  │                                    │                                │   │
│  │    ┌─────┐      ┌─────┐           │   1 │ nodes:                   │   │
│  │    │ ◆◆◆ │─────▶│ ◆◆◆ │           │   2 │   - id: price-monitor   │   │
│  │    └─────┘      └──┬──┘           │   3 │     skill: blockchain   │   │
│  │        ▲           │              │   4 │     config:             │   │
│  │        │           ▼              │   5 │       chain: ethereum   │   │
│  │    Selected   ┌─────┐             │   6 │       threshold: 0.05   │   │
│  │    node       │ ◆◆◆ │             │   7 │                         │   │
│  │    highlighted└─────┘             │   8 │   - id: alert-sender    │   │
│  │    in code                        │   9 │     skill: telegram     │   │
│  │                                    │  10 │                         │   │
│  │              50%                   │              50%               │   │
│  └────────────────────────────────────┴────────────────────────────────┘   │
│                                                                             │
│  • Left panel: HIDDEN (Cmd+B to show)                                       │
│  • Canvas: Visual view, synced with code                                    │
│  • Right panel: Monaco editor with YAML/JSON                                │
│  • Selection syncs bidirectionally                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Library

### Buttons

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  PRIMARY BUTTON                                                             │
│  ──────────────                                                             │
│                                                                             │
│  Default:    ┌──────────────────────┐                                       │
│              │ ██████ BUILD IT ████ │   bg: primary-400                     │
│              └──────────────────────┘   text: text-inverse                  │
│                                         shadow: shadow-sm                   │
│                                                                             │
│  Hover:      ┌──────────────────────┐                                       │
│              │ ██████ BUILD IT ████ │   bg: primary-500                     │
│              └──────────────────────┘   glow: glow-primary                  │
│                                                                             │
│  Active:     ┌──────────────────────┐                                       │
│              │ ██████ BUILD IT ████ │   bg: primary-600                     │
│              └──────────────────────┘   transform: scale(0.98)              │
│                                                                             │
│  Disabled:   ┌──────────────────────┐                                       │
│              │ ░░░░░░ BUILD IT ░░░░ │   bg: bg-hover                        │
│              └──────────────────────┘   text: text-tertiary                 │
│                                         cursor: not-allowed                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SECONDARY BUTTON                                                           │
│  ────────────────                                                           │
│                                                                             │
│  Default:    ┌──────────────────────┐                                       │
│              │      Configure       │   bg: transparent                     │
│              └──────────────────────┘   border: border-default              │
│                                         text: text-primary                  │
│                                                                             │
│  Hover:      ┌──────────────────────┐                                       │
│              │      Configure       │   bg: bg-hover                        │
│              └──────────────────────┘   border: border-strong               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GHOST BUTTON                                                               │
│  ────────────                                                               │
│                                                                             │
│  Default:    ┌──────────────────────┐                                       │
│              │      Learn more      │   bg: transparent                     │
│              └──────────────────────┘   text: text-secondary                │
│                                                                             │
│  Hover:      ┌──────────────────────┐                                       │
│              │      Learn more      │   bg: bg-hover                        │
│              └──────────────────────┘   text: text-primary                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BUTTON SIZES                                                               │
│  ────────────                                                               │
│                                                                             │
│  sm:   ┌──────────┐    height: 32px, padding: 8px 12px, font: 13px         │
│        │  Small   │                                                         │
│        └──────────┘                                                         │
│                                                                             │
│  md:   ┌────────────┐  height: 40px, padding: 10px 16px, font: 14px        │
│        │   Medium   │  (DEFAULT)                                            │
│        └────────────┘                                                       │
│                                                                             │
│  lg:   ┌──────────────┐  height: 48px, padding: 12px 24px, font: 16px      │
│        │    Large     │                                                     │
│        └──────────────┘                                                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ICON BUTTONS                                                               │
│  ────────────                                                               │
│                                                                             │
│  With icon:   ┌─────────────────┐                                           │
│               │  ▶  Run Flow    │                                           │
│               └─────────────────┘                                           │
│                                                                             │
│  Icon only:   ┌─────┐                                                       │
│               │  ⚙  │   Square, same height/width                           │
│               └─────┘   Tooltip required for accessibility                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Skill Nodes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  SKILL NODE - COLLAPSED (Default View)                                      │
│  ═════════════════════════════════════                                      │
│                                                                             │
│  ┌────────────────────────────────────┐                                     │
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ ← Category color (full width)      │
│  │  ⛓️  Blockchain DeFi              │ ← Icon + Title (16px semibold)      │
│  ├────────────────────────────────────┤                                     │
│  │                                    │                                     │
│  │  Monitors DEX prices and           │ ← Description (13px, text-secondary)│
│  │  executes token swaps              │                                     │
│  │                                    │                                     │
│  │  ○ chain_id           price_data ● │ ← Ports with labels                 │
│  │  ○ token_pair           tx_hash ● │                                     │
│  │                                    │                                     │
│  │  ┌──────────────────────────────┐ │                                     │
│  │  │  ✅ Valid                     │ │ ← Status badge                      │
│  │  └──────────────────────────────┘ │                                     │
│  └────────────────────────────────────┘                                     │
│                                                                             │
│  Dimensions:                                                                │
│  • Width: 280px (fixed)                                                     │
│  • Height: Auto (content-based, ~160px typical)                             │
│  • Border radius: 12px                                                      │
│  • Header height: 40px                                                      │
│                                                                             │
│  Interaction States:                                                        │
│  • Default: border-subtle, shadow-sm                                        │
│  • Hover: border-default, shadow-md                                         │
│  • Selected: border-primary (yellow), glow-primary                          │
│  • Error: border-error, glow-error                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SKILL NODE - EXPANDED (On Double-Click)                                    │
│  ═══════════════════════════════════════                                    │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│      │
│  │  ⛓️  Blockchain DeFi                                        [×] │      │
│  ├──────────────────────────────────────────────────────────────────┤      │
│  │                                                                  │      │
│  │  ┌─ CONFIGURATION ─────────────────────────────────────────────┐│      │
│  │  │                                                              ││      │
│  │  │  Chain            [▼ Ethereum                            ]  ││      │
│  │  │                                                              ││      │
│  │  │  Token Pair       [▼ ETH/USDC                            ]  ││      │
│  │  │                                                              ││      │
│  │  │  Threshold        [═══════════○─────] 5%                    ││      │
│  │  │                                                              ││      │
│  │  │  Poll Interval    [ 30 ] seconds                            ││      │
│  │  │                                                              ││      │
│  │  └──────────────────────────────────────────────────────────────┘│      │
│  │                                                                  │      │
│  │  ┌─ PATTERNS ───────────────┐ ┌─ ANTI-PATTERNS ────────────────┐│      │
│  │  │ ✓ Use multicall batching │ │ ✗ Don't poll faster than 10s  ││      │
│  │  │ ✓ Handle reverts         │ │ ✗ Never hardcode private keys ││      │
│  │  │ ✓ Check slippage bounds  │ │ ✗ Avoid frontrunnable txs     ││      │
│  │  └──────────────────────────┘ └────────────────────────────────┘│      │
│  │                                                                  │      │
│  │  ┌─ SHARP EDGES ─────────────────────────────────────────────┐  │      │
│  │  │ ⚠️ Gas estimation fails on complex multi-hop swaps         │  │      │
│  │  │ ⚠️ MEV bots frontrun transactions in public mempool        │  │      │
│  │  │ ⚠️ Some tokens have transfer fees not reflected in quotes  │  │      │
│  │  └────────────────────────────────────────────────────────────┘  │      │
│  │                                                                  │      │
│  │  ○ chain_id                                        price_data ● │      │
│  │  ○ token_pair                                        tx_hash ● │      │
│  │  ○ threshold_pct                                                │      │
│  │                                                                  │      │
│  │  [Collapse]              [Test Node]              [View YAML]   │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│  Dimensions:                                                                │
│  • Width: 440px (fixed)                                                     │
│  • Height: Auto (content-based)                                             │
│  • Appears as overlay, doesn't reflow canvas                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SKILL NODE - GHOST STATE (AI Proposal)                                     │
│  ══════════════════════════════════════                                     │
│                                                                             │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐                                     │
│    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ← Header at 40% opacity            │
│  │  ⛓️  Blockchain DeFi              │                                     │
│  ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤                                     │
│  │                                    │ ← Body at 60% opacity               │
│  │  Monitors DEX prices and           │                                     │
│    executes token swaps                                                     │
│  │                                    │                                     │
│    ○ chain_id           price_data ●   ← Dashed border, animated           │
│  │  ○ token_pair           tx_hash ● │                                     │
│  │                                    │                                     │
│  │ [✓ Accept] [✎ Modify] [✗ Reject] │ ← Action buttons                     │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘                                     │
│                                                                             │
│  Properties:                                                                │
│  • Border: 2px dashed primary-400                                           │
│  • Animation: Border dash offset loops (2s)                                 │
│  • Background: bg-surface at 60% opacity                                    │
│  • Subtle pulse: opacity 0.5 → 0.7 (2s ease-in-out)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Connections

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  CONNECTION TYPES                                                           │
│  ════════════════                                                           │
│                                                                             │
│  DATA CONNECTION (Default)                                                  │
│  ─────────────────────────                                                  │
│                                                                             │
│      [Node A] ●━━━━━━━━━━━━━━━━━━━━━━━━━○ [Node B]                          │
│                                                                             │
│      • Stroke: 2px solid                                                    │
│      • Color: Based on data type (see Data Type Colors)                     │
│      • End markers: None (ports indicate direction)                         │
│      • Path: Bezier curve with smart routing                                │
│                                                                             │
│  HANDOFF CONNECTION                                                         │
│  ──────────────────                                                         │
│                                                                             │
│      [Node A] ●╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌○ [Node B]                          │
│                       │                                                     │
│                 ┌─────┴─────┐                                               │
│                 │ HANDOFF   │  ← Badge on hover                             │
│                 │ auth data │                                               │
│                 └───────────┘                                               │
│                                                                             │
│      • Stroke: 2px dashed                                                   │
│      • Color: secondary-500 (cyan)                                          │
│      • Badge: Shows handoff context on hover                                │
│                                                                             │
│  MEMORY CONNECTION                                                          │
│  ─────────────────                                                          │
│                                                                             │
│      [Node A] ●════════════════════════════ [Mind]                          │
│                                                                             │
│      • Stroke: 3px double                                                   │
│      • Color: warning-400 (amber)                                           │
│      • Connects to Mind panel (special target)                              │
│                                                                             │
│  GHOST CONNECTION (AI Proposal)                                             │
│  ──────────────────────────────                                             │
│                                                                             │
│      [Node A] ●┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄○ [Ghost Node]                      │
│                                                                             │
│      • Stroke: 2px dotted                                                   │
│      • Color: primary-400 at 50% opacity                                    │
│      • Animated: Dots flow in direction of data                             │
│                                                                             │
│  INVALID CONNECTION                                                         │
│  ──────────────────                                                         │
│                                                                             │
│      [Node A] ●━━━━━━━━━━❌━━━━━━━━━━━○ [Node B]                            │
│                         │                                                   │
│                   ┌─────┴─────┐                                             │
│                   │ TYPE      │  ← Error tooltip                            │
│                   │ MISMATCH  │                                             │
│                   └───────────┘                                             │
│                                                                             │
│      • Stroke: 2px solid                                                    │
│      • Color: error-500                                                     │
│      • X icon in middle of path                                             │
│      • Tooltip shows error details                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CONNECTION ANIMATION (During Execution)                                    │
│  ═══════════════════════════════════════                                    │
│                                                                             │
│      [Node A] ●━━━━━━●━━━━━━●━━━━━━━━━○ [Node B]                            │
│                      ↑                                                      │
│               Animated dots flowing →                                       │
│                                                                             │
│      • Small circles (4px) travel along path                                │
│      • Speed indicates data volume                                          │
│      • Color matches connection type                                        │
│      • Duration: 1s per full path traversal                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Chat/Composer Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  COMPOSER PANEL                                                             │
│  ══════════════                                                             │
│                                                                             │
│  ┌───────────────────────────────────────┐                                  │
│  │  AI COMPOSER                    [─] [×]│ ← Header with collapse/close    │
│  ├───────────────────────────────────────┤                                  │
│  │                                       │                                  │
│  │  ┌─────────────────────────────────┐ │                                  │
│  │  │ 🤖 Opus                         │ │ ← AI Message                      │
│  │  │                                 │ │                                  │
│  │  │ I'll help you build a DeFi     │ │                                  │
│  │  │ price monitoring system. Here's│ │                                  │
│  │  │ what I'm creating:             │ │                                  │
│  │  │                                 │ │                                  │
│  │  │ • Price Monitor (Ethereum)     │ │                                  │
│  │  │ • Threshold Filter (5%)        │ │                                  │
│  │  │ • Telegram Alert               │ │                                  │
│  │  │                                 │ │                                  │
│  │  └─────────────────────────────────┘ │                                  │
│  │                                       │                                  │
│  │  ┌─────────────────────────────────┐ │                                  │
│  │  │ 👤 You                          │ │ ← User Message                    │
│  │  │                                 │ │                                  │
│  │  │ Can you add a stop-loss at 10%?│ │                                  │
│  │  │                                 │ │                                  │
│  │  └─────────────────────────────────┘ │                                  │
│  │                                       │                                  │
│  │  ┌─────────────────────────────────┐ │                                  │
│  │  │ 🤖 Opus                    ···  │ │ ← Streaming indicator            │
│  │  │                                 │ │                                  │
│  │  │ Adding a stop-loss skill to    │ │                                  │
│  │  │ your flow...                   │ │                                  │
│  │  │ █                              │ │ ← Cursor                         │
│  │  └─────────────────────────────────┘ │                                  │
│  │                                       │                                  │
│  ├───────────────────────────────────────┤                                  │
│  │                                       │                                  │
│  │  ┌─ PROPOSAL ────────────────────┐   │ ← Proposal Card (special)        │
│  │  │                                │   │                                  │
│  │  │  + Add: stop-loss-manager      │   │                                  │
│  │  │  ~ Connect: threshold → stop   │   │                                  │
│  │  │                                │   │                                  │
│  │  │  [✓ Apply]  [✎ Modify]  [✗]   │   │                                  │
│  │  └────────────────────────────────┘   │                                  │
│  │                                       │                                  │
│  ├───────────────────────────────────────┤                                  │
│  │                                       │                                  │
│  │  ┌─ QUICK ACTIONS ──────────────────┐│ ← Contextual actions             │
│  │  │ [Explain] [Optimize] [Add Error] ││                                  │
│  │  │ [Handling] [Validate] [Export]   ││                                  │
│  │  └──────────────────────────────────┘│                                  │
│  │                                       │                                  │
│  ├───────────────────────────────────────┤                                  │
│  │  ┌─────────────────────────────────┐ │                                  │
│  │  │ Ask Opus anything...        [➤] │ │ ← Input field                    │
│  │  └─────────────────────────────────┘ │                                  │
│  └───────────────────────────────────────┘                                  │
│                                                                             │
│  Message Styles:                                                            │
│  • AI: bg-surface, left-aligned, cyan accent                                │
│  • User: bg-primary-400/10, right-aligned, yellow accent                    │
│  • System: bg-info-bg, center-aligned, blue accent                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Mind Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  MIND PANEL                                                                 │
│  ══════════                                                                 │
│                                                                             │
│  ┌───────────────────────────────────────┐                                  │
│  │  🧠 MIND                       [─] [×]│                                  │
│  ├───────────────────────────────────────┤                                  │
│  │                                       │                                  │
│  │  ┌─────────────────────────────────┐ │                                  │
│  │  │ 🔍 Search memories...           │ │ ← Semantic search                 │
│  │  └─────────────────────────────────┘ │                                  │
│  │                                       │                                  │
│  │  SESSION DECISIONS                    │                                  │
│  │  ─────────────────                    │                                  │
│  │                                       │                                  │
│  │  ┌─────────────────────────────────┐ │                                  │
│  │  │ 💡 5 min ago                    │ │ ← Decision card                   │
│  │  │                                 │ │                                  │
│  │  │ Chose Uniswap v3 over v2        │ │                                  │
│  │  │ "Better capital efficiency for  │ │                                  │
│  │  │ concentrated liquidity"         │ │                                  │
│  │  │                                 │ │                                  │
│  │  │ [Undo] [Explain]               │ │                                  │
│  │  └─────────────────────────────────┘ │                                  │
│  │                                       │                                  │
│  │  ┌─────────────────────────────────┐ │                                  │
│  │  │ ⚠️ 12 min ago                   │ │ ← Blocker card                    │
│  │  │                                 │ │                                  │
│  │  │ RESOLVED: Gas estimation was    │ │                                  │
│  │  │ failing on multi-hop swaps      │ │                                  │
│  │  │                                 │ │                                  │
│  │  │ Solution: Added fallback gas    │ │                                  │
│  │  └─────────────────────────────────┘ │                                  │
│  │                                       │                                  │
│  │  PERSISTENT PREFERENCES               │                                  │
│  │  ──────────────────────               │                                  │
│  │                                       │                                  │
│  │  ┌─────────────────────────────────┐ │                                  │
│  │  │ Chain: Ethereum (default)       │ │ ← Preferences                    │
│  │  │ Notifications: Telegram         │ │                                  │
│  │  │ Risk Level: Medium              │ │                                  │
│  │  │                                 │ │                                  │
│  │  │ [Edit Preferences]             │ │                                  │
│  │  └─────────────────────────────────┘ │                                  │
│  │                                       │                                  │
│  │  ────────────────────────────────────│                                  │
│  │                                       │                                  │
│  │  TIMELINE                      [View]│                                  │
│  │  ────────                            │                                  │
│  │  │                                   │                                  │
│  │  ├─● Now: Added stop-loss            │ ← Timeline dots                   │
│  │  ├─● 5m: Chose Uniswap v3            │                                  │
│  │  ├─● 12m: Fixed gas estimation       │                                  │
│  │  ├─○ 20m: Created project            │                                  │
│  │  │                                   │                                  │
│  └───────────────────────────────────────┘                                  │
│                                                                             │
│  Card Types:                                                                │
│  • Decision: 💡 with amber left border                                      │
│  • Blocker: ⚠️ with red left border (resolved = green)                      │
│  • Learning: 📚 with blue left border                                       │
│  • Preference: ⚙️ with gray left border                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Preflight Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  PREFLIGHT CHECK MODAL                                                      │
│  ═════════════════════                                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │                    ⚡ PREFLIGHT CHECK                                │   │
│  │                    ═════════════════                                 │   │
│  │                                                                     │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │                                                               │ │   │
│  │  │  ✅  All 4 nodes connected properly                           │ │   │
│  │  │                                                               │ │   │
│  │  │  ✅  Data types compatible across all connections             │ │   │
│  │  │                                                               │ │   │
│  │  │  ✅  No circular dependencies detected                        │ │   │
│  │  │                                                               │ │   │
│  │  │  ⚠️  Sharp edge: API may timeout on slow networks             │ │   │
│  │  │      │                                                        │ │   │
│  │  │      └─ Recommendation: Add retry logic with backoff          │ │   │
│  │  │                                                               │ │   │
│  │  │         [+ Add Retry Skill]   [Ignore This]                   │ │   │
│  │  │                                                               │ │   │
│  │  │  ⚠️  Sharp edge: No rate limiting configured                  │ │   │
│  │  │      │                                                        │ │   │
│  │  │      └─ Risk: May hit API limits during high activity         │ │   │
│  │  │                                                               │ │   │
│  │  │         [+ Add Rate Limiter]  [Ignore This]                   │ │   │
│  │  │                                                               │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │  ────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │     2 warnings found                                                │   │
│  │     Flow will run but may fail under certain conditions             │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────┐    ┌──────────────────────────────┐   │   │
│  │  │                         │    │                              │   │   │
│  │  │     FIX ALL (SAFE)      │    │  ██████ RUN ANYWAY ███████  │   │   │
│  │  │                         │    │                              │   │   │
│  │  └─────────────────────────┘    └──────────────────────────────┘   │   │
│  │         Secondary                         Primary (yellow)          │   │
│  │                                                                     │   │
│  │                          [Cancel]                                   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Modal Properties:                                                          │
│  • Width: 600px max                                                         │
│  • Background: bg-elevated                                                  │
│  • Border radius: 16px                                                      │
│  • Shadow: shadow-xl                                                        │
│  • Backdrop: #000 at 70% opacity                                            │
│  • Animation: Scale from 95% + fade in (150ms)                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Command Palette

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  COMMAND PALETTE (Cmd+K)                                                    │
│  ═══════════════════════                                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │  🔍  stripe                                              [ESC]│ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │  SKILLS                                                             │   │
│  │  ──────                                                             │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │  💳  stripe-integration                              ↵ Enter │ │   │
│  │  │      Payment processing and webhooks                         │ │   │
│  │  ├───────────────────────────────────────────────────────────────┤ │   │
│  │  │  💳  stripe-subscriptions                                     │ │   │
│  │  │      Recurring billing management                            │ │   │
│  │  ├───────────────────────────────────────────────────────────────┤ │   │
│  │  │  💳  stripe-connect                                           │ │   │
│  │  │      Multi-party payments and marketplaces                   │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │  ACTIONS                                                            │   │
│  │  ───────                                                            │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │  ▶  Run flow                                          ⌘Enter │ │   │
│  │  ├───────────────────────────────────────────────────────────────┤ │   │
│  │  │  ✓  Validate                                          ⌘⇧V   │ │   │
│  │  ├───────────────────────────────────────────────────────────────┤ │   │
│  │  │  📤 Export as code                                    ⌘⇧E   │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │  RECENT                                                             │   │
│  │  ──────                                                             │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │  📁  DeFi Price Bot                                           │ │   │
│  │  │  📁  Auth System                                              │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Properties:                                                                │
│  • Width: 560px                                                             │
│  • Max height: 400px (scrollable)                                           │
│  • Position: Centered, 20% from top                                         │
│  • Fuzzy search with highlighting                                           │
│  • Keyboard navigation (↑↓ arrows)                                          │
│  • Categories collapse when empty                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Interaction Patterns

### Ghost Preview System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  THE GHOST PREVIEW FLOW                                                     │
│  ══════════════════════                                                     │
│                                                                             │
│  Purpose: Never surprise users with changes. Always preview first.          │
│                                                                             │
│  STEP 1: User Request                                                       │
│  ─────────────────────                                                      │
│                                                                             │
│      User: "Add error handling to the API calls"                            │
│                     │                                                       │
│                     ▼                                                       │
│                                                                             │
│  STEP 2: AI Generates Proposal                                              │
│  ─────────────────────────────                                              │
│                                                                             │
│      ┌─────────────────────────────────────────────────────────────────┐   │
│      │  Opus is thinking...                                            │   │
│      │  ════════════════════                                           │   │
│      │                                                                 │   │
│      │  Analyzing your flow...                                         │   │
│      │  ███████████░░░░░░░░░ 60%                                       │   │
│      └─────────────────────────────────────────────────────────────────┘   │
│                     │                                                       │
│                     ▼                                                       │
│                                                                             │
│  STEP 3: Ghost Nodes Appear                                                 │
│  ──────────────────────────                                                 │
│                                                                             │
│      CANVAS:                                                                │
│      ┌─────┐                  ┌ ─ ─ ─ ─ ─ ─ ┐                              │
│      │ API │──────┬──────────   Error       │ ← Ghost node                 │
│      │     │      │          │ Handler     │                              │
│      └─────┘      │          └ ─ ─ ─ ─ ─ ─ ┘                              │
│                   │                 │                                       │
│                   │                 ▼                                       │
│                   │          ┌ ─ ─ ─ ─ ─ ─ ┐                              │
│                   └──────────   Retry      │ ← Ghost node                  │
│                              │ Logic       │                              │
│                              └ ─ ─ ─ ─ ─ ─ ┘                              │
│                                                                             │
│      COMPOSER:                                                              │
│      ┌─────────────────────────────────────────────────────────────────┐   │
│      │  PROPOSED CHANGES                                               │   │
│      │  ────────────────                                               │   │
│      │                                                                 │   │
│      │  + Add: error-handler (after API node)                          │   │
│      │  + Add: retry-logic (parallel to error-handler)                 │   │
│      │  ~ Connect: API → Error Handler → existing flow                 │   │
│      │  ~ Connect: API → Retry Logic → API (loop back)                 │   │
│      │                                                                 │   │
│      │  ⚠️ Note: Retry will attempt 3 times with exponential backoff   │   │
│      │                                                                 │   │
│      │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │   │
│      │  │  ✓ Accept    │ │  ✎ Modify   │ │  ✗ Reject   │             │   │
│      │  └──────────────┘ └──────────────┘ └──────────────┘             │   │
│      └─────────────────────────────────────────────────────────────────┘   │
│                     │                                                       │
│                     ▼                                                       │
│                                                                             │
│  STEP 4: User Decides                                                       │
│  ─────────────────────                                                      │
│                                                                             │
│      [Accept]  → Ghosts become solid nodes                                  │
│                  Animation: fade in, scale 1.0                              │
│                  Connection lines solidify                                  │
│                  Mind logs: "Added error handling"                          │
│                                                                             │
│      [Modify]  → Opens modification dialog                                  │
│                  User can adjust parameters                                 │
│                  Ghost updates in real-time                                 │
│                                                                             │
│      [Reject]  → Ghosts fade out (200ms)                                    │
│                  Canvas returns to previous state                           │
│                  Opus asks: "What would you prefer?"                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Progressive Disclosure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  INFORMATION HIERARCHY                                                      │
│  ═════════════════════                                                      │
│                                                                             │
│  LEVEL 1: Glanceable (Always Visible)                                       │
│  ─────────────────────────────────────                                      │
│  • Node icon and name                                                       │
│  • Connection status (valid/invalid)                                        │
│  • Single-line description                                                  │
│  • Port labels                                                              │
│                                                                             │
│  LEVEL 2: Hover (1 second delay)                                            │
│  ─────────────────────────────────                                          │
│  • Full description                                                         │
│  • Sharp edge count                                                         │
│  • Usage statistics                                                         │
│  • Quick action hints                                                       │
│                                                                             │
│  LEVEL 3: Click (Selection)                                                 │
│  ──────────────────────────                                                 │
│  • Configuration panel (right side)                                         │
│  • All input/output details                                                 │
│  • Validation status                                                        │
│  • Context-aware chat                                                       │
│                                                                             │
│  LEVEL 4: Double-Click (Expansion)                                          │
│  ─────────────────────────────────                                          │
│  • Full patterns list                                                       │
│  • Full anti-patterns list                                                  │
│  • All sharp edges with details                                             │
│  • Advanced configuration                                                   │
│  • YAML view option                                                         │
│                                                                             │
│  LEVEL 5: Expert Mode (Toggle)                                              │
│  ─────────────────────────────                                              │
│  • Raw configuration editor                                                 │
│  • Custom validation rules                                                  │
│  • Debug information                                                        │
│  • Export options                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Animation System

### Timing Functions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  EASING CURVES                                                              │
│  ═════════════                                                              │
│                                                                             │
│  ease-out        cubic-bezier(0, 0, 0.2, 1)                                 │
│                  Use for: Entrances, things appearing                       │
│                                                                             │
│  ease-in         cubic-bezier(0.4, 0, 1, 1)                                 │
│                  Use for: Exits, things disappearing                        │
│                                                                             │
│  ease-in-out     cubic-bezier(0.4, 0, 0.2, 1)                               │
│                  Use for: Movement, position changes                        │
│                                                                             │
│  spring          cubic-bezier(0.34, 1.56, 0.64, 1)                          │
│                  Use for: Playful interactions, success states              │
│                                                                             │
│  DURATIONS                                                                  │
│  ─────────                                                                  │
│                                                                             │
│  instant         0ms        State changes (no animation)                    │
│  fast            100ms      Micro-interactions (hover, focus)               │
│  normal          200ms      Standard transitions                            │
│  slow            300ms      Complex transitions                             │
│  deliberate      500ms      Significant state changes                       │
│  dramatic        1000ms     Celebration, major events                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Animations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  NODE ENTRANCE (AI-generated)                                               │
│  ────────────────────────────                                               │
│                                                                             │
│  Frame 0:    opacity: 0, scale: 0.8, y: -20px                               │
│  Frame 100:  opacity: 1, scale: 1.0, y: 0                                   │
│                                                                             │
│  Duration: 300ms                                                            │
│  Easing: ease-out                                                           │
│  Stagger: 100ms between nodes                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CONNECTION DRAWING                                                         │
│  ──────────────────                                                         │
│                                                                             │
│  Animation: stroke-dashoffset from 100% to 0%                               │
│                                                                             │
│  [Node A] ●━━━━━━━━━━━━━━━━━━━━━━○ [Node B]                                │
│            ▲                                                                │
│            └─ Line draws from source to target                              │
│                                                                             │
│  Duration: 400ms                                                            │
│  Easing: ease-in-out                                                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GHOST PULSE                                                                │
│  ───────────                                                                │
│                                                                             │
│  @keyframes ghost-pulse {                                                   │
│    0%   { opacity: 0.5; border-color: primary-400 }                         │
│    50%  { opacity: 0.7; border-color: primary-300 }                         │
│    100% { opacity: 0.5; border-color: primary-400 }                         │
│  }                                                                          │
│                                                                             │
│  Duration: 2s                                                               │
│  Iteration: infinite                                                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GHOST BORDER MARCH                                                         │
│  ──────────────────                                                         │
│                                                                             │
│  @keyframes border-march {                                                  │
│    0%   { stroke-dashoffset: 0 }                                            │
│    100% { stroke-dashoffset: 20 }                                           │
│  }                                                                          │
│                                                                             │
│  Creates "marching ants" effect on ghost borders                            │
│  Duration: 1s                                                               │
│  Iteration: infinite, linear                                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DATA FLOW (Execution)                                                      │
│  ─────────────────────                                                      │
│                                                                             │
│  Small dots (4px circles) travel along connection path                      │
│                                                                             │
│  [Node A] ●━━━○━━━━━━━━○━━━━━━━━○━━━━○ [Node B]                             │
│               ↑       ↑       ↑                                             │
│               └───────┴───────┴─ Dots moving →                              │
│                                                                             │
│  Duration: 1.5s per dot                                                     │
│  Spawn rate: Every 300ms during execution                                   │
│  Color: Connection type color                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SUCCESS CELEBRATION                                                        │
│  ───────────────────                                                        │
│                                                                             │
│  On successful run completion:                                              │
│                                                                             │
│  1. All nodes flash green briefly (200ms)                                   │
│  2. Checkmark appears on final node (scale spring)                          │
│  3. Subtle confetti particles (optional, can disable)                       │
│  4. Success toast slides in from bottom                                     │
│                                                                             │
│  Total duration: 1s                                                         │
│  Keep celebration brief - don't interrupt workflow                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## User Flows

### First-Time User (Complete Journey)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  FIRST-TIME USER FLOW                                                       │
│  ════════════════════                                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  STEP 1: LANDING                                     Time: 0s       │   │
│  │  ─────────────────                                                  │   │
│  │                                                                     │   │
│  │  User sees:                                                         │   │
│  │  • Clean welcome screen                                             │   │
│  │  • "What will you ship today?" prompt                               │   │
│  │  • 3-4 recipe cards as inspiration                                  │   │
│  │  • No login required to explore                                     │   │
│  │                                                                     │   │
│  │  Emotional state: Curious, not overwhelmed                          │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  STEP 2: DESCRIBE GOAL                               Time: 30s      │   │
│  │  ─────────────────────                                              │   │
│  │                                                                     │   │
│  │  User types:                                                        │   │
│  │  "I want to monitor ETH prices and get notified when it drops"      │   │
│  │                                                                     │   │
│  │  System responds:                                                   │   │
│  │  • Input auto-expands as they type                                  │   │
│  │  • Subtle suggestions appear ("Add threshold?")                     │   │
│  │  • [Build It] button pulses when ready                              │   │
│  │                                                                     │   │
│  │  Emotional state: Engaged, expressing intent                        │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  STEP 3: WATCH THE MAGIC                             Time: 45s      │   │
│  │  ───────────────────────                                            │   │
│  │                                                                     │   │
│  │  Canvas transition:                                                 │   │
│  │  • Screen splits (chat moves right)                                 │   │
│  │  • Canvas fades in on left                                          │   │
│  │  • First node drops in with animation                               │   │
│  │                                                                     │   │
│  │  Opus narrates:                                                     │   │
│  │  "I'm creating your price monitor. Here's what I'm building:"       │   │
│  │                                                                     │   │
│  │  Nodes appear sequentially (300ms apart):                           │   │
│  │  1. Price Monitor ← "This watches ETH/USD on Chainlink"             │   │
│  │  2. Threshold Filter ← "Triggers when price drops 5%+"              │   │
│  │  3. Alert (ghost) ← "How should I notify you?"                      │   │
│  │                                                                     │   │
│  │  Emotional state: Delighted, watching creation                      │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  STEP 4: QUICK DECISION                              Time: 1m       │   │
│  │  ──────────────────────                                             │   │
│  │                                                                     │   │
│  │  Opus asks (with button choices):                                   │   │
│  │  "How would you like to be notified?"                               │   │
│  │                                                                     │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐                       │   │
│  │  │ 📱         │ │ ✉️         │ │ 🔗         │                       │   │
│  │  │ Telegram   │ │ Email      │ │ Webhook    │                       │   │
│  │  │ (Popular)  │ │            │ │            │                       │   │
│  │  └────────────┘ └────────────┘ └────────────┘                       │   │
│  │                                                                     │   │
│  │  User clicks Telegram:                                              │   │
│  │  • Ghost node transforms to Telegram skill                          │   │
│  │  • Connection draws to previous node                                │   │
│  │  • Brief config prompt for bot token                                │   │
│  │                                                                     │   │
│  │  Emotional state: Empowered, making choices                         │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  STEP 5: VALIDATION                                  Time: 1m 30s   │   │
│  │  ──────────────────                                                 │   │
│  │                                                                     │   │
│  │  Opus says:                                                         │   │
│  │  "Your flow is ready! Let me check for any issues..."               │   │
│  │                                                                     │   │
│  │  Preflight runs automatically:                                      │   │
│  │  ✅ Connections valid                                               │   │
│  │  ✅ Data types match                                                │   │
│  │  ⚠️ Tip: Consider adding retry logic (optional)                     │   │
│  │                                                                     │   │
│  │  All nodes glow green briefly                                       │   │
│  │                                                                     │   │
│  │  [▶ Run Now] button prominently displayed                           │   │
│  │                                                                     │   │
│  │  Emotional state: Confident, validated                              │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  STEP 6: FIRST RUN                                   Time: 2m       │   │
│  │  ─────────────────                                                  │   │
│  │                                                                     │   │
│  │  User clicks Run:                                                   │   │
│  │  • Data flow animation through nodes                                │   │
│  │  • Each node lights up as it executes                               │   │
│  │  • Real-time log in composer panel                                  │   │
│  │                                                                     │   │
│  │  Completion:                                                        │   │
│  │  • Success animation (checkmarks, brief green flash)                │   │
│  │  • "Your flow ran successfully!"                                    │   │
│  │  • Shows actual output (current ETH price)                          │   │
│  │                                                                     │   │
│  │  Emotional state: ACCOMPLISHED 🎉                                   │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  STEP 7: NEXT STEPS                                  Time: 2m 30s   │   │
│  │  ──────────────────                                                 │   │
│  │                                                                     │   │
│  │  Opus offers:                                                       │   │
│  │  "Great! What would you like to do next?"                           │   │
│  │                                                                     │   │
│  │  [📅 Schedule]    Run automatically every hour                      │   │
│  │  [💾 Save]        Save to your projects                             │   │
│  │  [📤 Share]       Share as a recipe                                 │   │
│  │  [✨ Enhance]     Add more features                                 │   │
│  │                                                                     │   │
│  │  Soft prompt to create account (if not logged in):                  │   │
│  │  "Save your flow to access it anywhere"                             │   │
│  │                                                                     │   │
│  │  Emotional state: Satisfied, want to continue                       │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TOTAL TIME: < 3 minutes from landing to first successful run              │
│  DECISIONS: 2-3 (notification type, optional config)                       │
│  TYPING: 1 sentence                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Responsive Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  BREAKPOINTS                                                                │
│  ═══════════                                                                │
│                                                                             │
│  sm       640px      Mobile landscape, small tablets                        │
│  md       768px      Tablets                                                │
│  lg       1024px     Small laptops                                          │
│  xl       1280px     Desktops (DEFAULT TARGET)                              │
│  2xl      1536px     Large displays                                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MOBILE (< 768px)                                                           │
│  ─────────────────                                                          │
│                                                                             │
│  • Single panel view (tabs to switch)                                       │
│  • Canvas: Pinch to zoom, swipe to pan                                      │
│  • Bottom sheet for composer                                                │
│  • Simplified node cards                                                    │
│  • No side panels (drawer navigation)                                       │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │  [≡] Spawner    │                                                        │
│  ├─────────────────┤                                                        │
│  │                 │                                                        │
│  │    CANVAS       │                                                        │
│  │   (full width)  │                                                        │
│  │                 │                                                        │
│  │  ┌─────┐        │                                                        │
│  │  │     │        │                                                        │
│  │  └──┬──┘        │                                                        │
│  │     │           │                                                        │
│  │     ▼           │                                                        │
│  │  ┌─────┐        │                                                        │
│  │  │     │        │                                                        │
│  │  └─────┘        │                                                        │
│  │                 │                                                        │
│  ├─────────────────┤                                                        │
│  │ [Canvas][Chat]  │ ← Tab bar                                              │
│  └─────────────────┘                                                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TABLET (768px - 1024px)                                                    │
│  ───────────────────────                                                    │
│                                                                             │
│  • Two-panel layout (canvas + one side panel)                               │
│  • Collapsible palette (icon mode)                                          │
│  • Touch-optimized node interaction                                         │
│                                                                             │
│  ┌─────────────────────────────────────┐                                    │
│  │  [≡] Spawner              [▶ Run]  │                                    │
│  ├───────────────────────┬─────────────┤                                    │
│  │                       │             │                                    │
│  │       CANVAS          │  COMPOSER   │                                    │
│  │                       │             │                                    │
│  │       (65%)           │   (35%)     │                                    │
│  │                       │             │                                    │
│  └───────────────────────┴─────────────┘                                    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DESKTOP (1024px+)                                                          │
│  ─────────────────                                                          │
│                                                                             │
│  • Full three-panel layout                                                  │
│  • Resizable panels                                                         │
│  • Keyboard shortcuts active                                                │
│  • Hover states enabled                                                     │
│                                                                             │
│  (See Layout System section for full specs)                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Accessibility

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  WCAG 2.1 AA COMPLIANCE                                                     │
│  ══════════════════════                                                     │
│                                                                             │
│  COLOR CONTRAST                                                             │
│  ──────────────                                                             │
│  • Text on bg-base:        FAFAFA on 09090B = 19.5:1 ✅                      │
│  • Text on bg-surface:     FAFAFA on 18181B = 15.3:1 ✅                      │
│  • Primary on dark:        FACC15 on 09090B = 11.2:1 ✅                      │
│  • Secondary text:         A1A1AA on 09090B = 7.1:1  ✅                      │
│                                                                             │
│  Minimum required: 4.5:1 for normal text, 3:1 for large text                │
│                                                                             │
│  KEYBOARD NAVIGATION                                                        │
│  ───────────────────                                                        │
│  • All interactive elements focusable                                       │
│  • Visible focus indicators (yellow outline)                                │
│  • Tab order follows visual layout                                          │
│  • Escape closes modals/panels                                              │
│  • Arrow keys navigate within components                                    │
│                                                                             │
│  Focus indicator style:                                                     │
│  outline: 2px solid primary-400                                             │
│  outline-offset: 2px                                                        │
│                                                                             │
│  SCREEN READER SUPPORT                                                      │
│  ─────────────────────                                                      │
│  • All images have alt text                                                 │
│  • Icons have aria-label                                                    │
│  • Live regions for dynamic updates                                         │
│  • Proper heading hierarchy (h1 → h6)                                       │
│  • ARIA landmarks for navigation                                            │
│                                                                             │
│  Canvas announcements:                                                      │
│  • "Node added: Blockchain DeFi"                                            │
│  • "Connected Price Monitor to Threshold Filter"                            │
│  • "Validation complete: 2 warnings"                                        │
│                                                                             │
│  MOTION PREFERENCES                                                         │
│  ──────────────────                                                         │
│  @media (prefers-reduced-motion: reduce) {                                  │
│    • Disable all animations                                                 │
│    • Instant state transitions                                              │
│    • Static connection lines (no flow animation)                            │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dark/Light Modes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  THEME STRATEGY                                                             │
│  ══════════════                                                             │
│                                                                             │
│  Default: Dark mode (matches developer tools aesthetic)                     │
│  Option: Light mode for accessibility preferences                           │
│  Detection: prefers-color-scheme media query                                │
│  Override: User setting persisted in localStorage                           │
│                                                                             │
│  DARK MODE (Default)                  LIGHT MODE                            │
│  ───────────────────                  ──────────                            │
│                                                                             │
│  bg-base:      #09090B                bg-base:      #FAFAFA                 │
│  bg-surface:   #18181B                bg-surface:   #FFFFFF                 │
│  bg-elevated:  #27272A                bg-elevated:  #F4F4F5                 │
│  bg-hover:     #3F3F46                bg-hover:     #E4E4E7                 │
│                                                                             │
│  text-primary:   #FAFAFA              text-primary:   #09090B               │
│  text-secondary: #A1A1AA              text-secondary: #52525B               │
│  text-tertiary:  #71717A              text-tertiary:  #A1A1AA               │
│                                                                             │
│  border-subtle:  #27272A              border-subtle:  #E4E4E7               │
│  border-default: #3F3F46              border-default: #D4D4D8               │
│                                                                             │
│  Accent colors remain consistent across themes                              │
│                                                                             │
│  THEME TOGGLE                                                               │
│  ────────────                                                               │
│  Location: Settings menu or header                                          │
│  Icons: ☀️ (light) / 🌙 (dark) / 💻 (system)                                │
│  Transition: 200ms cross-fade                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Micro-interactions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  DELIGHTFUL DETAILS                                                         │
│  ══════════════════                                                         │
│                                                                             │
│  BUTTON PRESS                                                               │
│  ────────────                                                               │
│  • Scale: 0.98 on mousedown                                                 │
│  • Return: spring easing on mouseup                                         │
│  • Duration: 100ms                                                          │
│                                                                             │
│  NODE DRAG                                                                  │
│  ─────────                                                                  │
│  • Slight rotation (±2°) during drag                                        │
│  • Shadow increases (shadow-lg)                                             │
│  • Opacity: 0.9                                                             │
│  • Snap-to-grid on release (optional)                                       │
│                                                                             │
│  CONNECTION CREATE                                                          │
│  ─────────────────                                                          │
│  • Elastic line from port to cursor                                         │
│  • Compatible ports glow/pulse                                              │
│  • Incompatible ports dim                                                   │
│  • Satisfying "snap" on successful connection                               │
│                                                                             │
│  VALIDATION SUCCESS                                                         │
│  ──────────────────                                                         │
│  • Green ripple from center of each node                                    │
│  • Checkmark scales in with spring                                          │
│  • Duration: 400ms                                                          │
│                                                                             │
│  ERROR SHAKE                                                                │
│  ───────────                                                                │
│  • Horizontal shake: x: [-4, 4, -4, 4, 0]                                   │
│  • Duration: 300ms                                                          │
│  • Used for validation errors, invalid inputs                               │
│                                                                             │
│  TOOLTIP APPEAR                                                             │
│  ──────────────                                                             │
│  • Delay: 500ms (don't show on quick hover)                                 │
│  • Fade + slight y-translate (4px)                                          │
│  • Duration: 150ms                                                          │
│                                                                             │
│  PANEL RESIZE                                                               │
│  ────────────                                                               │
│  • Cursor changes to col-resize                                             │
│  • Resize handle highlights on hover                                        │
│  • Smooth width transition                                                  │
│  • Min/max constraints with bounce                                          │
│                                                                             │
│  COPY TO CLIPBOARD                                                          │
│  ─────────────────                                                          │
│  • Icon briefly changes to checkmark                                        │
│  • Tooltip: "Copied!" for 1.5s                                              │
│  • Subtle success color flash                                               │
│                                                                             │
│  LOADING STATES                                                             │
│  ──────────────                                                             │
│  • Skeleton screens (not spinners) for content                              │
│  • Shimmer animation: left to right gradient sweep                          │
│  • Progress bars for known-length operations                                │
│  • Pulsing dots for unknown-length operations                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Competitor Research Insights

> Research-driven UX improvements based on deep analysis of user feedback from n8n, Dify, Langflow, Make.com, Flowise, and Zapier

### Pain Point Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  COMPETITOR PAIN POINTS → SPAWNER UI SOLUTIONS                              │
│  ════════════════════════════════════════════                               │
│                                                                             │
│  SEVERITY LEGEND: ●●● Critical  ●●○ High  ●○○ Medium                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. STEEP LEARNING CURVE                                        ●●● n8n    │
│     ────────────────────────────────────────────────────────────────────    │
│     Problem:  "Needs programming knowledge"                                 │
│               "3-5 nodes for simple actions"                                │
│               "No clear starting point"                                     │
│                                                                             │
│     Solution: CHAT-FIRST APPROACH (Express Mode)                            │
│               ┌─────────────────────────────────────────────────────┐       │
│               │ User types: "Email me when someone stars my repo"  │       │
│               │                                                     │       │
│               │ AI builds:  [GitHub] ──→ [Filter] ──→ [Email]      │       │
│               │             (ghost preview - one click to confirm)  │       │
│               └─────────────────────────────────────────────────────┘       │
│               Zero node dragging required for beginners.                    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  2. DEBUGGING NIGHTMARE                              ●●● n8n, Flowise       │
│     ────────────────────────────────────────────────────────────────────    │
│     Problem:  "Loops are untestable"                                        │
│               "Can't test nodes in isolation"                               │
│               "UI freezes showing agent reasoning"                          │
│                                                                             │
│     Solution: NODE-LEVEL TESTING + STREAMING                                │
│               ┌─────────────────────────────────────────────────────┐       │
│               │  [GitHub Watch] ⚡ TEST                              │       │
│               │  ─────────────────────                               │       │
│               │  Input:  mock_event.json  ← Editable test input     │       │
│               │  Output: ✓ {stars: 142}   ← Live result             │       │
│               │  Time:   0.23s                                       │       │
│               │                                                      │       │
│               │  [Run Again] [Use Output →]                          │       │
│               └─────────────────────────────────────────────────────┘       │
│               Agent reasoning streams char-by-char (no freeze).             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  3. COGNITIVE OVERLOAD                               ●●○ Flowise, n8n       │
│     ────────────────────────────────────────────────────────────────────    │
│     Problem:  "Opening modules covers entire screen"                        │
│               "Too many options shown at once"                              │
│               "67% abandon forms when encountering issues"                  │
│                                                                             │
│     Solution: PROGRESSIVE DISCLOSURE (3 Modes)                              │
│               ┌───────────────┐ ┌───────────────┐ ┌───────────────┐        │
│               │ EXPRESS       │ │ STUDIO        │ │ CODE          │        │
│               │ ○ 3-5 options │→│ Full config   │→│ Raw YAML      │        │
│               │ ○ Presets     │ │ All params    │ │ Git diff      │        │
│               │ ○ 1-click     │ │ Custom conn   │ │ Version ctrl  │        │
│               └───────────────┘ └───────────────┘ └───────────────┘        │
│               Context-aware hiding: only relevant options per skill.        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  4. POOR DOCUMENTATION/SUPPORT                      ●●○ Dify, n8n          │
│     ────────────────────────────────────────────────────────────────────    │
│     Problem:  "'Read the docs' responses"                                   │
│               "No contextual help"                                          │
│               "Poor documentation"                                          │
│                                                                             │
│     Solution: EMBEDDED CONTEXTUAL HELP                                      │
│               ┌─────────────────────────────────────────────────────┐       │
│               │  [Stripe Charge] ← hover any node                    │       │
│               │  ┌────────────────────────────────────────────┐      │       │
│               │  │ 💡 QUICK TIPS                              │      │       │
│               │  │ • Amount is in cents (1000 = $10)          │      │       │
│               │  │ • Test keys start with sk_test_            │      │       │
│               │  │                                            │      │       │
│               │  │ ⚠️ Sharp Edge: Idempotency keys expire     │      │       │
│               │  │    after 24 hours                          │      │       │
│               │  │                                            │      │       │
│               │  │ [Full Docs] [Ask Claude]                   │      │       │
│               │  └────────────────────────────────────────────┘      │       │
│               └─────────────────────────────────────────────────────┘       │
│               Sharp edges from 450+ skills surface automatically.            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  5. PERFORMANCE ISSUES                               ●●○ n8n, Flowise       │
│     ────────────────────────────────────────────────────────────────────    │
│     Problem:  "RAM spikes with large datasets"                              │
│               "UI freezes on complex flows"                                 │
│               "Slow with many nodes"                                        │
│                                                                             │
│     Solution: OPTIMIZED ARCHITECTURE                                        │
│               ├── Canvas: 60fps @ 100+ nodes (virtualized)                  │
│               ├── Lazy load: Node configs load on demand                    │
│               ├── Streaming: Large outputs stream, don't buffer            │
│               ├── Web Workers: Heavy compute off main thread                │
│               └── IndexedDB: Offline-first caching                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  6. RELIABILITY CONCERNS                             ●●● Make.com           │
│     ────────────────────────────────────────────────────────────────────    │
│     Problem:  "Automations fail silently"                                   │
│               "Webhooks unreliable"                                         │
│               "No clear failure notifications"                              │
│                                                                             │
│     Solution: RUN HISTORY + PROACTIVE ALERTS                                │
│               ┌─────────────────────────────────────────────────────┐       │
│               │  LAST 24 HOURS                        Filter: All ▾ │       │
│               │  ───────────────────────────────────────────────────│       │
│               │  ● 14:32  GitHub → Email    ✓ 0.8s                   │       │
│               │  ● 13:42  GitHub → Email    ✗ FAILED                 │       │
│               │    └─→ Stripe rate limit exceeded                    │       │
│               │        [Retry Now] [Edit & Retry]                    │       │
│               │                                                      │       │
│               │  ALERTS: [Email ✓] [Slack ✓] [Webhook ○]            │       │
│               └─────────────────────────────────────────────────────┘       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  7. PRICING CONFUSION                                ●○○ Make.com, Zapier   │
│     ────────────────────────────────────────────────────────────────────    │
│     Problem:  "Operations-based pricing confusing"                          │
│               "Hidden costs"                                                │
│               "Expensive at scale"                                          │
│                                                                             │
│     Solution: TRANSPARENT MODEL                                             │
│               ├── Free tier: Unlimited local use                            │
│               ├── Cloud tier: Simple per-project (not per-operation)        │
│               ├── BYOK: User brings own Claude API key                      │
│               └── Dashboard: Clear usage visibility                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Positive Patterns to Adopt (from Zapier)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  WHAT USERS LOVE ABOUT ZAPIER → ADOPTING IN SPAWNER UI                      │
│  ════════════════════════════════════════════════════                       │
│                                                                             │
│  ✓ "Step-by-step guidance"                                                  │
│     → Chat-first approach + ghost previews guide naturally                  │
│                                                                             │
│  ✓ "Clean dashboard"                                                        │
│     → Minimalist design, progressive disclosure                             │
│                                                                             │
│  ✓ "Works without programming"                                              │
│     → Express mode: describe in words, AI builds                            │
│                                                                             │
│  ✓ "7,000+ integrations"                                                    │
│     → 450+ skills with rich sharp edges + patterns                           │
│                                                                             │
│  ✓ "Reliability"                                                            │
│     → Local-first + cloud sync = works offline                              │
│                                                                             │
│  NEW PATTERN: TEMPLATE QUICK-STARTS                                         │
│  ─────────────────────────────────                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  POPULAR STARTING POINTS                         View All →      │       │
│  │                                                                  │       │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │       │
│  │  │ 📧 → 📊     │ │ 🐙 → 💬     │ │ 📅 → 📱     │ │ 🔔 → 📧   │  │       │
│  │  │ Form to     │ │ GitHub to   │ │ Calendar to │ │ Monitor   │  │       │
│  │  │ Spreadsheet │ │ Slack       │ │ SMS         │ │ to Email  │  │       │
│  │  │             │ │             │ │             │ │           │  │       │
│  │  │ [1-click]   │ │ [1-click]   │ │ [1-click]   │ │ [1-click] │  │       │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │       │
│  │                                                                  │       │
│  │  "Start from template, customize with chat"                      │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### New Components (Research-Driven)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  NODE TEST PANEL                                                            │
│  ═══════════════                                                            │
│                                                                             │
│  Appears on: Right-click node → "Test this node"                            │
│  Or: Click ⚡ icon on node header                                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  TEST: Stripe Create Charge                              ✕ Close│       │
│  ├─────────────────────────────────────────────────────────────────┤       │
│  │                                                                  │       │
│  │  INPUT                                                   [Load] │       │
│  │  ┌─────────────────────────────────────────────────────────┐    │       │
│  │  │ {                                                       │    │       │
│  │  │   "amount": 2000,                                       │    │       │
│  │  │   "currency": "usd",                                    │    │       │
│  │  │   "customer": "cus_test_123"                            │    │       │
│  │  │ }                                                       │    │       │
│  │  └─────────────────────────────────────────────────────────┘    │       │
│  │                                                                  │       │
│  │  ┌──────────────────────────────────────────────────────────┐   │       │
│  │  │              [▶ Run Test]              [Use Mock Data]   │   │       │
│  │  └──────────────────────────────────────────────────────────┘   │       │
│  │                                                                  │       │
│  │  OUTPUT                                               ✓ 0.34s   │       │
│  │  ┌─────────────────────────────────────────────────────────┐    │       │
│  │  │ {                                                       │    │       │
│  │  │   "id": "ch_1234567890",                                │    │       │
│  │  │   "status": "succeeded",                                │    │       │
│  │  │   "amount": 2000                                        │    │       │
│  │  │ }                                                       │    │       │
│  │  └─────────────────────────────────────────────────────────┘    │       │
│  │                                                                  │       │
│  │  [Copy Output]  [Use as Input for Next Node →]                  │       │
│  │                                                                  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  States:                                                                    │
│  • Empty: Show "Paste or load test input"                                   │
│  • Running: Spinner + streaming output                                      │
│  • Success: Green border, timing shown                                      │
│  • Error: Red border, error message, retry button                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  CONTEXTUAL HELP TOOLTIP                                                    │
│  ═══════════════════════                                                    │
│                                                                             │
│  Trigger: Hover node for 800ms OR click (?) icon                            │
│  Source: skill.yaml patterns + sharp-edges.yaml                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                                                                  │       │
│  │  STRIPE CHARGE                                                   │       │
│  │  ───────────────                                                 │       │
│  │                                                                  │       │
│  │  💡 QUICK TIPS                                                   │       │
│  │  • Amount is always in cents (1000 = $10.00)                     │       │
│  │  • Currency must be lowercase: "usd", "eur"                      │       │
│  │  • Test mode: use sk_test_ keys                                  │       │
│  │                                                                  │       │
│  │  ⚠️ SHARP EDGES                                                  │       │
│  │  • Idempotency keys expire after 24 hours                        │       │
│  │  • Customer must exist before charging                           │       │
│  │  • 3DS may require additional auth step                          │       │
│  │                                                                  │       │
│  │  ┌──────────────────────────────────────────────────────────┐   │       │
│  │  │  [📖 Full Docs]    [💬 Ask Claude]    [📋 Examples]      │   │       │
│  │  └──────────────────────────────────────────────────────────┘   │       │
│  │                                                                  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  Animation:                                                                 │
│  • Fade in: 150ms ease-out                                                  │
│  • Slide up: 8px                                                            │
│  • Max width: 320px                                                         │
│  • Position: Above node, centered                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  RUN HISTORY PANEL                                                          │
│  ═════════════════                                                          │
│                                                                             │
│  Location: Bottom drawer OR dedicated tab                                   │
│  Default: Collapsed, shows summary badge                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  RUN HISTORY                                    Filter: All ▾  ⚙│       │
│  ├─────────────────────────────────────────────────────────────────┤       │
│  │                                                                  │       │
│  │  TODAY                                                           │       │
│  │  ──────                                                          │       │
│  │  ┌─────────────────────────────────────────────────────────┐    │       │
│  │  │ ● 14:32:15  GitHub Watch → Filter → Email               │    │       │
│  │  │             ✓ Completed in 0.8s           [View Details] │    │       │
│  │  └─────────────────────────────────────────────────────────┘    │       │
│  │  ┌─────────────────────────────────────────────────────────┐    │       │
│  │  │ ○ 14:15:22  GitHub Watch → Filter → Email               │    │       │
│  │  │             ✓ Completed in 0.6s           [View Details] │    │       │
│  │  └─────────────────────────────────────────────────────────┘    │       │
│  │  ┌─────────────────────────────────────────────────────────┐    │       │
│  │  │ ● 13:42:08  GitHub Watch → Filter → Email   ⚠ FAILED    │    │       │
│  │  │             ✗ Stripe rate limit exceeded                 │    │       │
│  │  │             ┌────────────────────────────────────────┐   │    │       │
│  │  │             │ [Retry Now] [Edit & Retry] [Dismiss]   │   │    │       │
│  │  │             └────────────────────────────────────────┘   │    │       │
│  │  └─────────────────────────────────────────────────────────┘    │       │
│  │                                                                  │       │
│  │  ALERTS                                                          │       │
│  │  ──────                                                          │       │
│  │  Notify me on failure via:                                       │       │
│  │  [✓ Email] [✓ Slack] [○ Webhook] [○ SMS]                        │       │
│  │                                                                  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  States:                                                                    │
│  • Success (green dot): Completed normally                                  │
│  • Failed (red dot): Error occurred, action needed                          │
│  • Pending (yellow dot): Currently running                                  │
│  • Skipped (gray dot): Condition not met                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  TEMPLATE PICKER (NEW)                                                      │
│  ═════════════════════                                                      │
│                                                                             │
│  Trigger: New Project → "Start from template"                               │
│  Or: Command palette → "template"                                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  START FROM TEMPLATE                                    ✕ Close │       │
│  ├─────────────────────────────────────────────────────────────────┤       │
│  │                                                                  │       │
│  │  🔥 POPULAR                                                      │       │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │       │
│  │  │ 📧 → 📊   │ │ 🐙 → 💬   │ │ 📅 → 📱   │ │ 🔔 → 📧   │        │       │
│  │  │           │ │           │ │           │ │           │        │       │
│  │  │ Form to   │ │ GitHub    │ │ Calendar  │ │ Monitor   │        │       │
│  │  │ Sheet     │ │ to Slack  │ │ to SMS    │ │ Alerts    │        │       │
│  │  │           │ │           │ │           │ │           │        │       │
│  │  │ 1.2k uses │ │ 890 uses  │ │ 654 uses  │ │ 543 uses  │        │       │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘        │       │
│  │                                                                  │       │
│  │  🤖 AI & AUTOMATION                                              │       │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │       │
│  │  │ 🔍 → 🤖   │ │ 📝 → 🎨   │ │ 💬 → 📊   │ │ 📧 → 🤖   │        │       │
│  │  │           │ │           │ │           │ │           │        │       │
│  │  │ RAG       │ │ Content   │ │ Sentiment │ │ Email     │        │       │
│  │  │ Pipeline  │ │ Generator │ │ Analysis  │ │ Responder │        │       │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────┘        │       │
│  │                                                                  │       │
│  │  ───────────────────────────────────────────────────────────    │       │
│  │  [Browse All Templates (47)]        [Create Blank Project]      │       │
│  │                                                                  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  On template click:                                                         │
│  1. Show preview with node chain                                            │
│  2. "Use this template" button                                              │
│  3. Template opens in Express mode for customization via chat               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cognitive Load Reduction Strategies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  BASED ON RESEARCH: 67% of users abandon when encountering issues           │
│  ══════════════════════════════════════════════════════════════             │
│                                                                             │
│  STRATEGY 1: SMART DEFAULTS                                                 │
│  ─────────────────────────────                                              │
│  Every skill ships with sensible defaults.                                  │
│  User only sees what they NEED to change.                                   │
│                                                                             │
│  BAD (competitor pattern):         GOOD (Spawner UI):                       │
│  ┌─────────────────────────┐      ┌─────────────────────────┐              │
│  │ API Key: ___________    │      │ [Use saved Stripe key ▾]│              │
│  │ Environment: ______     │      │                         │              │
│  │ Timeout: ___________    │      │ Amount: $___            │              │
│  │ Retry Count: _______    │      │ Customer: [Select ▾]    │              │
│  │ Idempotency: ________   │      │                         │              │
│  │ Currency: __________    │      │ [Show advanced options] │              │
│  │ Amount: ____________    │      └─────────────────────────┘              │
│  │ Customer: __________    │                                                │
│  │ Description: _______    │      Only 2 fields visible by default.        │
│  │ Metadata: __________    │      Rest hidden until needed.                 │
│  └─────────────────────────┘                                                │
│                                                                             │
│  STRATEGY 2: INLINE VALIDATION                                              │
│  ─────────────────────────────                                              │
│  Don't wait for "Run" to show errors.                                       │
│  Validate as user types.                                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ Amount: 10.50                                                    │       │
│  │ ⚠️ Amount must be in cents (1050 for $10.50)    [Fix for me]     │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  STRATEGY 3: CONTEXTUAL ACTIONS                                             │
│  ─────────────────────────────                                              │
│  Show actions relevant to current state only.                               │
│                                                                             │
│  Node not connected:  [Connect →] [Delete] [Duplicate]                      │
│  Node connected:      [Test] [Edit] [View Output]                           │
│  Node failed:         [Retry] [Edit & Retry] [Skip] [View Error]            │
│                                                                             │
│  STRATEGY 4: UNDO EVERYTHING                                                │
│  ─────────────────────────────                                              │
│  Every action is reversible. Shown prominently.                             │
│                                                                             │
│  After any action:                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  ✓ Node deleted                                    [Undo] (Ctrl+Z)│       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  STRATEGY 5: PROGRESSIVE ERROR DETAIL                                       │
│  ─────────────────────────────                                              │
│  First show simple message. Details on demand.                              │
│                                                                             │
│  Level 1: "Stripe charge failed"                                            │
│  Level 2: "Card declined by issuer"                                         │
│  Level 3: [View full API response]                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Updated Component Priorities (Post-Research)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  PRIORITY ADJUSTMENTS BASED ON COMPETITOR PAIN POINTS                       │
│  ═══════════════════════════════════════════════════                        │
│                                                                             │
│  MOVED TO P0 (Critical):                                                    │
│  ├── Node-level test panel (debugging is #1 pain point)                     │
│  ├── Inline validation (67% abandon on form issues)                         │
│  ├── Contextual help tooltips (poor docs is universal complaint)            │
│  └── Run history with retry (silent failures frustrate users)               │
│                                                                             │
│  MOVED TO P1 (High):                                                        │
│  ├── Template picker (Zapier's "1-click start" highly praised)              │
│  ├── Streaming output display (prevents UI freeze)                          │
│  └── Smart defaults system (reduces cognitive load)                         │
│                                                                             │
│  KEPT AT P2 (Medium):                                                       │
│  ├── Keyboard shortcuts                                                     │
│  ├── Dark/Light mode toggle                                                 │
│  └── Export/Import flows                                                    │
│                                                                             │
│  NEW ADDITIONS:                                                             │
│  ├── [P0] Error recovery wizard (guided fix for common errors)              │
│  ├── [P1] Usage dashboard (transparent cost visibility)                     │
│  └── [P2] Community templates (learn from others)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix: Asset Checklist

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ICONS NEEDED                                                               │
│  ────────────                                                               │
│  □ Logo (SVG, multiple sizes)                                               │
│  □ Favicon set (16, 32, 180, 192, 512)                                      │
│  □ Skill category icons (8 categories)                                      │
│  □ Port type icons (7 types)                                                │
│  □ Status icons (success, warning, error, info)                             │
│  □ Action icons (run, stop, save, export, etc.)                             │
│  □ Navigation icons (collapse, expand, close, menu)                         │
│                                                                             │
│  ILLUSTRATIONS                                                              │
│  ─────────────                                                              │
│  □ Empty state (no projects)                                                │
│  □ Welcome illustration                                                     │
│  □ Success celebration                                                      │
│  □ Error state                                                              │
│  □ Loading state                                                            │
│                                                                             │
│  FONTS                                                                      │
│  ─────                                                                      │
│  □ Inter (400, 500, 600, 700)                                               │
│  □ JetBrains Mono (400, 500)                                                │
│  □ Space Grotesk (600, 700) - display only                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*UI/UX Design System v1.0 - January 2025*
*Spawner - Visual orchestration for AI skill chains*
