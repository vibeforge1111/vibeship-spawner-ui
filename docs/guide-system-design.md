# Vibeship Spawner Guide System Design

## Philosophy: Learn by Doing, Not Reading

> "The best tutorial is invisible. You're having fun, and suddenly you realize you've learned everything."

### Core Principles

1. **KISS (Keep It Simple, Stupid)**
   - No walls of text
   - One concept at a time
   - Progressive disclosure
   - Jargon-free language

2. **Game-Style Learning**
   - Learn by DOING, not reading
   - Immediate feedback on every action
   - Safe sandbox to experiment
   - Celebrate small wins

3. **5-Minute First Success**
   - User should accomplish something meaningful in first 5 minutes
   - Build confidence before complexity
   - "I did it!" moment as early as possible

---

## How Games Teach (And How We'll Apply It)

### Game Tutorial Patterns We'll Use

| Pattern | Game Example | Spawner Application |
|---------|--------------|---------------------|
| **Forced First Action** | "Press SPACE to jump" | "Click here to load your first skill" |
| **Guided Discovery** | Glowing objects to interact with | Highlighted UI elements with tooltips |
| **Safe Sandbox** | Tutorial level with no enemies | Practice mode with no consequences |
| **Progressive Unlocking** | New abilities each level | New modules unlock as you progress |
| **Immediate Feedback** | Sound + visual on success | Confetti + success message |
| **Contextual Hints** | "Press E to interact" when near object | Smart tooltips when hovering |
| **Learning Through Failure** | Respawn and try again | "That didn't work. Here's why..." |
| **Achievement System** | Badges, trophies | Module completion badges |

### What We WON'T Do

- Long text explanations before action
- Forcing users to read documentation
- Abstract concepts without hands-on examples
- Overwhelming with all features at once
- Testing knowledge before teaching it

---

## The Onboarding Flow

### Phase 1: Instant Gratification (0-5 minutes)

**Goal:** User successfully uses ONE skill and feels accomplished.

```
Step 1: Welcome Screen (10 seconds)
├── "Welcome to Spawner!"
├── "Let's get you building in 5 minutes"
└── [Start Learning] button

Step 2: First Skill (60 seconds)
├── Screen highlights the Skills section
├── "Skills are superpowers for Claude. Let's try one."
├── "Click on 'commit' to load it" (arrow pointing)
├── User clicks → Skill loads → Confetti!
└── "You just loaded your first skill!"

Step 3: Use the Skill (90 seconds)
├── "Now let's use it. Go to Claude Code."
├── "Type: /commit"
├── Shows what will happen
├── User tries it → Success!
└── "You just made Claude write perfect commit messages!"

Step 4: Celebration (30 seconds)
├── Achievement unlocked: "First Skill Master"
├── Progress bar: 10% complete
└── "Ready to learn more? Or explore on your own?"
```

### Phase 2: Building Confidence (5-15 minutes)

**Goal:** User understands Skills, loads 3 more, uses them successfully.

```
Module: Skills Basics
├── Lesson 1: What are Skills? (Interactive demo)
│   ├── Show skill loading animation
│   ├── Explain: "Skills teach Claude new tricks"
│   └── Try: Load 'brainstorming' skill
│
├── Lesson 2: Skill Categories (Exploration)
│   ├── Show category grid
│   ├── "Click around and explore"
│   └── Achievement: "Explorer" (viewed 5 skills)
│
├── Lesson 3: Using Skills in Practice (Hands-on)
│   ├── Real task: "Let's plan a feature"
│   ├── Use brainstorming skill
│   └── See the structured output
│
└── Checkpoint: Quick Quiz (Fun, not scary)
    ├── "Which skill helps with git commits?"
    ├── Immediate feedback
    └── Badge: "Skills Apprentice"
```

### Phase 3: Building Power (15-45 minutes)

**Goal:** User creates their first team, understands MCPs, builds a workflow.

```
Module: Teams
├── "Skills are powerful alone. Together, they're unstoppable."
├── Interactive: Drag skills to create a team
├── See team in action
└── Badge: "Team Builder"

Module: MCPs
├── "MCPs give Claude access to real tools"
├── Connect filesystem MCP (safe, no auth needed)
├── See Claude read actual files
└── Badge: "Tool Master"

Module: Workflows
├── "Let's automate something real"
├── Build simple 3-step workflow in Canvas
├── Run it, see results
└── Badge: "Automation Architect"
```

### Phase 4: Mastery (45+ minutes)

**Goal:** User can build anything they imagine.

```
Advanced Modules (Unlocked after basics):
├── Creating Custom Skills
├── Advanced Team Strategies
├── MCP Deep Dive
├── Mind & Memory System
├── Pro Patterns & Optimization
└── Building for Production
```

---

## Interactive Tutorial Components

### 1. Spotlight Overlay

```
┌─────────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░┌───────────────┐░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░│  [Skill Card] │ ← "Click here to      │
│░░░░░░░░░│   commit      │    load this skill"   │
│░░░░░░░░░└───────────────┘░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────────────────────────────┘

- Dark overlay on everything except target
- Pulsing border on target element
- Tooltip with instruction
- Can't click elsewhere (guided)
```

### 2. Progress Tracker (Always Visible)

```
┌─────────────────────────────────────────┐
│ Your Progress                           │
│ ████████████░░░░░░░░░░░░░░░░░░ 35%     │
│                                         │
│ ✓ Getting Started                       │
│ ✓ Skills Basics                         │
│ → Teams (In Progress)                   │
│ ○ MCPs                                  │
│ ○ Workflows                             │
│ ○ Mind & Memory                         │
│ 🔒 Advanced (Unlock at 60%)             │
└─────────────────────────────────────────┘
```

### 3. Achievement Popups

```
┌─────────────────────────────────┐
│  🏆 Achievement Unlocked!       │
│                                 │
│  ┌─────┐                        │
│  │ ⚡  │  SKILL LOADER          │
│  └─────┘                        │
│                                 │
│  You loaded your first skill!   │
│                                 │
│  [Continue]     [View All]      │
└─────────────────────────────────┘
```

### 4. Interactive Sandbox

```
┌─────────────────────────────────────────────────┐
│ TRY IT: Create a Team                           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Available Skills:        Your Team:            │
│  ┌─────────┐              ┌─────────────────┐   │
│  │ commit  │ ──drag──→    │ 1. commit       │   │
│  ├─────────┤              │ 2. code-review  │   │
│  │ review  │              │ 3. ???          │   │
│  ├─────────┤              └─────────────────┘   │
│  │ test    │                                    │
│  └─────────┘              [Run Team Demo]       │
│                                                 │
│  💡 Hint: Add 'test' to complete the workflow   │
└─────────────────────────────────────────────────┘
```

### 5. Contextual Help Bubbles

```
When user hovers over "MCP" anywhere:

     ┌──────────────────────────────────┐
     │ MCP = Model Context Protocol     │
     │                                  │
     │ Think of it as a "plugin" that   │
     │ gives Claude new abilities,      │
     │ like reading files or browsing.  │
     │                                  │
     │ [Learn More] [Got it]            │
     └──────────────────────────────────┘
              ▼
         [ MCP ]
```

---

## Content Types Per Lesson

### Type 1: Interactive Demo (Primary)
- User takes action
- Sees immediate result
- Celebrates success
- **Use for:** 80% of content

### Type 2: Short Video (< 60 seconds)
- Screen recording with voiceover
- Shows complex workflow
- Optional (can skip)
- **Use for:** Complex multi-step processes

### Type 3: Infographic
- Visual diagram
- Architecture overview
- Comparison charts
- **Use for:** Conceptual understanding

### Type 4: Code Example
- Syntax highlighted
- Copy button
- Inline explanations
- **Use for:** Skill definitions, configs

### Type 5: Quick Quiz
- 2-3 questions max
- Multiple choice
- Immediate feedback
- Fun, not stressful
- **Use for:** Knowledge checkpoints

---

## Gamification System

### Progress Tracking

```typescript
interface UserProgress {
  overallPercent: number;
  modules: {
    [moduleId: string]: {
      completed: boolean;
      lessonsCompleted: number;
      totalLessons: number;
      timeSpent: number; // minutes
      quizScore?: number;
    }
  };
  achievements: Achievement[];
  streak: {
    current: number;
    longest: number;
    lastActivity: Date;
  };
}
```

### Achievements

| Badge | Trigger | Icon |
|-------|---------|------|
| First Steps | Complete onboarding | 👶 |
| Skill Loader | Load first skill | ⚡ |
| Explorer | View 10 different skills | 🔍 |
| Team Builder | Create first team | 👥 |
| Tool Master | Connect first MCP | 🔧 |
| Automation Pro | Build first workflow | 🤖 |
| Memory Keeper | Use Mind features | 🧠 |
| Speed Runner | Complete module in < 10 min | ⚡ |
| Perfectionist | 100% quiz score | 💯 |
| Graduate | Complete all modules | 🎓 |

### Streak System

```
Day 1: 🔥
Day 2: 🔥🔥
Day 3: 🔥🔥🔥
Day 7: 🔥 WEEK STREAK! Bonus badge unlocked!
```

### Leaderboard (Optional/Future)

- Weekly most progress
- Fastest module completion
- Most achievements
- Community challenges

---

## Module Structure

### Module 1: Welcome to Spawner
**Time:** 5 minutes | **Type:** Interactive Tour

1. What is Spawner? (30 sec video)
2. Your first skill (interactive)
3. See it in action (demo)
4. You did it! (celebration)

### Module 2: Skills Deep Dive
**Time:** 15 minutes | **Type:** Interactive + Quiz

1. What skills actually do
2. Finding the right skill
3. Loading and using skills
4. Skill categories tour
5. Quiz: Match skill to use case

### Module 3: Building Teams
**Time:** 15 minutes | **Type:** Interactive Sandbox

1. Why teams beat solo skills
2. Create your first team (drag & drop)
3. Team communication patterns
4. Real example: Code review team
5. Challenge: Build a custom team

### Module 4: MCP Integration
**Time:** 20 minutes | **Type:** Guided Setup

1. What are MCPs? (infographic)
2. Connect your first MCP (filesystem)
3. See Claude read real files
4. Popular MCPs tour
5. Challenge: Connect GitHub MCP

### Module 5: Workflow Automation
**Time:** 20 minutes | **Type:** Canvas Playground

1. The Canvas explained
2. Build a 3-step workflow
3. Connect the nodes
4. Run and watch magic happen
5. Challenge: Build custom automation

### Module 6: Mind & Memory
**Time:** 15 minutes | **Type:** Interactive Demo

1. Why memory matters
2. Learnings system tour
3. Decisions and issues
4. Session summaries
5. Search your memories

### Module 7: Advanced Patterns (Unlockable)
**Time:** 30 minutes | **Type:** Deep Dive

1. Creating custom skills
2. Advanced team strategies
3. MCP chaining
4. Production deployment
5. Optimization tips

---

## Technical Implementation

### State Management

```typescript
// Store in localStorage + sync to backend
const guideState = {
  currentModule: 'skills-basics',
  currentLesson: 2,
  completedLessons: ['welcome-1', 'welcome-2', 'skills-1'],
  achievements: ['first-steps', 'skill-loader'],
  preferences: {
    showHints: true,
    autoPlayVideos: false,
    difficulty: 'normal' // or 'quick' for experienced
  }
};
```

### Components Needed

```
/src/lib/components/guide/
├── GuideLayout.svelte        # Main layout with sidebar
├── ModuleCard.svelte         # Module in sidebar
├── LessonContent.svelte      # Lesson display
├── SpotlightOverlay.svelte   # Highlight UI elements
├── ProgressTracker.svelte    # Progress sidebar
├── AchievementPopup.svelte   # Achievement notifications
├── InteractiveSandbox.svelte # Practice environments
├── QuizComponent.svelte      # Knowledge checks
├── VideoPlayer.svelte        # Embedded videos
├── CodeExample.svelte        # Syntax highlighted code
└── HelpBubble.svelte         # Contextual tooltips
```

### Routes

```
/guide                    # Main guide page
/guide/[module]           # Specific module
/guide/[module]/[lesson]  # Specific lesson
/guide/achievements       # All achievements
/guide/progress           # Detailed progress
```

---

## Content Creation Guidelines

### Writing Style

**DO:**
- Use "you" and "your"
- Keep sentences short
- Use active voice
- Celebrate progress
- Be encouraging

**DON'T:**
- Use jargon without explaining
- Write paragraphs
- Be condescending
- Assume knowledge
- Rush through concepts

### Example Good vs Bad

**Bad:**
> "Skills are YAML-defined instruction sets that modify Claude's behavior through prompt injection, enabling domain-specific capabilities."

**Good:**
> "Skills teach Claude new tricks. Load one, and Claude instantly knows how to do something new."

### Lesson Template

```markdown
# [Lesson Title]

## What You'll Learn
- One thing
- Another thing

## Let's Do It

[Interactive element here]

## You Did It!
[Celebration + summary]

## Next Up
[Preview of next lesson]
```

---

## Success Metrics

### Track These

- Time to first skill loaded
- Module completion rates
- Drop-off points
- Quiz success rates
- Feature adoption after tutorial
- Return visits to guide

### Goals

- 90% complete Module 1
- 70% complete Module 2
- Average time to "first success" < 5 minutes
- 50% complete full course
- NPS score > 50

---

## Launch Plan

### Phase 1: MVP (Week 1-2)
- Module 1: Welcome (interactive)
- Module 2: Skills Basics
- Basic progress tracking
- 3 achievements

### Phase 2: Core (Week 3-4)
- Modules 3-5
- Full achievement system
- Sandbox environments
- Video content

### Phase 3: Polish (Week 5-6)
- Module 6-7
- Streak system
- Contextual help throughout app
- Certificate generation

### Phase 4: Iterate (Ongoing)
- A/B test different tutorials
- Add content based on user questions
- Community challenges
- Advanced modules

---

## Summary

The Spawner Guide System is not documentation—it's an **interactive journey** that transforms confused newcomers into confident builders through:

1. **Immediate action** over explanation
2. **Progressive unlocking** of complexity
3. **Celebration** of every small win
4. **Safe spaces** to experiment
5. **Clear progress** visualization

The goal: Anyone can go from "What is this?" to "I built something amazing!" in under an hour.
