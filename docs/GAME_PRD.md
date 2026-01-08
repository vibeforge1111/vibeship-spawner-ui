# PRD: Escape Room Puzzle Game

## Overview

**Product Name:** MindLock
**Type:** Browser-based puzzle game
**Target:** Single-player escape room experience
**Tech Stack:** Vanilla JavaScript, HTML5 Canvas, CSS3

---

## Problem Statement

### Job-to-be-Done
```
When I have 15-30 minutes of downtime,
I want to solve engaging logic puzzles,
So I can feel mentally stimulated and accomplished.
```

### Problem Validation
- Escape room games are a $1.2B+ market
- Mobile puzzle games have 70%+ retention for engaged users
- Existing browser escape games are either too simple or require Flash (deprecated)

---

## Product Requirements

### Core Features (MVP)

#### 1. Room Environment
- Single room with interactive background
- 5-7 clickable hotspots (objects)
- Visual feedback on hover/click
- Ambient atmosphere (dark, mysterious)

#### 2. Inventory System
- Collect items by clicking
- Inventory bar at bottom of screen
- Drag items to use on objects
- Combine items (2 items max)

#### 3. Puzzle Mechanics
- **Lock Puzzle:** 4-digit combination lock
- **Pattern Puzzle:** Match symbols in order
- **Hidden Object:** Find item behind/under objects
- **Logic Puzzle:** Decode clue from room elements

#### 4. Hint System
- 3 hints available per game
- Progressive hints (vague → specific)
- Cooldown timer between hints (30 seconds)

#### 5. Win Condition
- Unlock the door to escape
- Victory screen with time and hints used
- Option to replay

---

## Technical Architecture

### File Structure
```
mindlock/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── game.js         # Main game loop
│   ├── room.js         # Room rendering
│   ├── inventory.js    # Inventory management
│   ├── puzzles.js      # Puzzle logic
│   └── hints.js        # Hint system
└── assets/
    ├── room-bg.png
    ├── objects/        # Interactive objects
    └── items/          # Inventory items
```

### Canvas Setup
- 1280x720 base resolution
- Responsive scaling
- Click detection via coordinate mapping

### State Management
```javascript
const gameState = {
  inventory: [],
  solvedPuzzles: [],
  hintsRemaining: 3,
  startTime: null,
  isComplete: false
};
```

---

## User Flow

```
[Start Screen]
    ↓
[Room Loads] → Click objects → [Examine/Collect]
    ↓                              ↓
[Inventory Updates] ←──────────────┘
    ↓
[Use Items on Objects] → [Puzzle Triggered]
    ↓                         ↓
[Solve Puzzle] ←─── [Need Hint?] → [Use Hint]
    ↓
[Door Unlocks] → [Victory Screen]
```

---

## Puzzles Design

### Puzzle 1: Safe Combination
- **Trigger:** Click safe on wall
- **Solution:** Find 4 numbers hidden around room
- **Hint 1:** "Numbers are everywhere..."
- **Hint 2:** "Check the clock, book, and painting"
- **Hint 3:** "Clock=3, Book page=7, Painting flowers=4, Calendar=1"

### Puzzle 2: Key Assembly
- **Trigger:** Need key for desk drawer
- **Solution:** Combine broken key pieces (2 parts)
- **Hint 1:** "The key is in pieces"
- **Hint 2:** "One piece under the rug, one in the plant"

### Puzzle 3: Symbol Lock
- **Trigger:** Box with symbol buttons
- **Solution:** Match symbols shown in painting order
- **Hint 1:** "Art tells a story"
- **Hint 2:** "The painting shows the sequence"

### Puzzle 4: Final Door
- **Trigger:** Main door lock
- **Solution:** Use master key from safe
- **Prerequisite:** Must solve Puzzles 1-3 first

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Load Time | < 3 seconds |
| Completion Rate | > 40% |
| Average Play Time | 15-25 minutes |
| Hint Usage | < 2 per session |

---

## Development Phases

### Phase 1: Core Engine (Week 1)
- [ ] Canvas setup and room rendering
- [ ] Click detection system
- [ ] Basic object interaction

### Phase 2: Inventory (Week 1)
- [ ] Item collection
- [ ] Inventory UI
- [ ] Drag-and-drop

### Phase 3: Puzzles (Week 2)
- [ ] Combination lock
- [ ] Item combination
- [ ] Symbol matching
- [ ] Win condition

### Phase 4: Polish (Week 2)
- [ ] Hint system
- [ ] Sound effects
- [ ] Victory screen
- [ ] Mobile responsiveness

---

## Skills Required

From H70 Skill Lab:
- `typescript-strict` - Type-safe game state
- `frontend-patterns` - Component architecture
- `api-design` - Save/load game state
- `testing-strategies` - Puzzle logic tests

---

*PRD generated using H70 product-strategy skill*
*Source: h70-local*
