# PRD-to-Skill Matching System

> Documentation for the intelligent PRD analysis and skill matching system in Spawner UI.

## System Overview

The PRD-to-Skill Matching system takes a user's project description (PRD) and automatically selects relevant H70 skills to build their workflow. It supports two matching modes:

1. **Local Matching** (Default) - Uses keyword mappings from `h70-skill-matcher.ts`
2. **Claude API Matching** (Optional) - Uses Claude to intelligently select from 480 skills

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INPUT (PRD)                            │
│  "I want to build a roguelike dungeon crawler with procedural   │
│   generation, combat system, inventory, and pixel art"          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GOAL ANALYZER                                │
│                 (goal-analyzer.ts)                              │
├─────────────────────────────────────────────────────────────────┤
│  Extracts:                                                      │
│  • keywords: ["roguelike", "dungeon", "procedural", ...]        │
│  • technologies: ["pixel"]                                      │
│  • features: ["combat", "inventory", "procedural"]              │
│  • domains: ["game"]                                            │
│  • confidence: 0.85                                             │
│  • inputType: "short" | "paragraph" | "technical" | etc.        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SKILL MATCHER                                │
│                  (skill-matcher.ts)                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Check if Claude API available → Use intelligent matching    │
│  2. Otherwise → Use local H70 keyword matching                  │
│                                                                 │
│  Local matching uses KEYWORD_TO_SKILLS (391+ mappings):         │
│  • "roguelike" → [game-design, procedural-generation, ...]      │
│  • "combat" → [combat-design, game-ai-behavior, ...]            │
│  • "inventory" → [inventory-management, game-ui-design, ...]    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MATCHED SKILLS                                │
├─────────────────────────────────────────────────────────────────┤
│  [                                                              │
│    { skillId: "game-design", score: 0.9, tier: 1 },             │
│    { skillId: "procedural-generation", score: 0.8, tier: 1 },   │
│    { skillId: "combat-design", score: 0.7, tier: 2 },           │
│    { skillId: "pixel-art", score: 0.6, tier: 2 },               │
│    ...                                                          │
│  ]                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 WORKFLOW GENERATOR                              │
│              (goal-to-workflow.ts)                              │
├─────────────────────────────────────────────────────────────────┤
│  Creates canvas nodes with:                                     │
│  • Positions (tier 1 = top, tier 2 = middle, tier 3 = bottom)   │
│  • Connections (inferred from skill handoffs)                   │
│  • Full H70 skill content for execution                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

### Core Services

| File | Purpose |
|------|---------|
| `src/lib/services/goal-analyzer.ts` | Extracts keywords, technologies, features, domains from PRD |
| `src/lib/services/skill-matcher.ts` | Main matching logic - tries Claude API, falls back to local |
| `src/lib/services/h70-skill-matcher.ts` | **391+ keyword → skill ID mappings** (the core mapping data) |
| `src/lib/services/goal-to-workflow.ts` | Converts matched skills to canvas workflow |
| `src/lib/services/mission-builder.ts` | Builds mission object for execution |

### API Routes

| File | Purpose |
|------|---------|
| `src/routes/api/analyze/+server.ts` | Server-side Claude API integration |
| `src/routes/api/h70-skills/[skillId]/+server.ts` | Fetches full H70 skill content |

### Types

| File | Purpose |
|------|---------|
| `src/lib/types/goal.ts` | Type definitions + constants (MAX_SKILLS_TO_SUGGEST = 25) |

### Data

| File | Purpose |
|------|---------|
| `static/skills.json` | 480 H70 skills metadata (id, name, description, tags, triggers) |
| `src/lib/data/skill-index-ultra.json` | Skills organized by domain for Claude prompt |

---

## Keyword Mapping System

### How It Works

The `KEYWORD_TO_SKILLS` object in `h70-skill-matcher.ts` maps keywords to skill IDs:

```typescript
export const KEYWORD_TO_SKILLS: Record<string, string[]> = {
  // Game Development
  'roguelike': ['game-design', 'procedural-generation', 'progression-systems'],
  'dungeon': ['procedural-generation', 'level-design', 'game-design'],
  'combat': ['combat-design', 'game-ai-behavior', 'animation-systems'],
  'inventory': ['inventory-management', 'game-ui-design', 'game-design', ...],
  'pixel': ['pixel-art', 'pixel-art-sprites', 'game-development'],

  // Authentication
  'auth': ['supabase-auth', 'nextjs-supabase-auth', 'clerk-auth'],
  'login': ['supabase-auth', 'nextjs-supabase-auth'],

  // Payments
  'stripe': ['stripe-integration', 'subscription-billing'],
  'payment': ['stripe-integration', 'subscription-billing'],

  // ... 391+ total mappings
};
```

### Scoring Algorithm

```typescript
// For each keyword in the PRD:
for (const keyword of goal.keywords) {
  const skills = KEYWORD_TO_SKILLS[keyword.toLowerCase()];
  for (let i = 0; i < skills.length; i++) {
    const skillId = skills[i];
    // First skill in array gets higher score (0.6 vs 0.4)
    const positionScore = i === 0 ? 0.6 : 0.4;
    // Multiple keyword matches boost score
    if (alreadyMatched) score += 0.1;
  }
}

// Features and technologies add bonus points
for (const feature of goal.features) { score += 0.2 }
for (const tech of goal.technologies) { score += 0.3 }
```

---

## Domain Detection

### DOMAIN_PATTERNS (goal-analyzer.ts)

```typescript
const DOMAIN_PATTERNS: Record<string, string[]> = {
  'game': ['game', 'gaming', 'gamedev', 'roguelike', 'rpg', 'platformer',
           'puzzle', 'strategy', 'shooter', 'simulation', 'arcade'],
  'ai': ['ai', 'ml', 'llm', 'gpt', 'claude', 'chatbot', 'agent'],
  'saas': ['saas', 'software', 'service', 'platform', 'subscription'],
  'e-commerce': ['ecommerce', 'shop', 'store', 'cart', 'checkout'],
  'fintech': ['fintech', 'finance', 'banking', 'trading', 'crypto'],
  // ... more domains
};
```

### TECH_PATTERNS (goal-analyzer.ts)

```typescript
const TECH_PATTERNS: Record<string, string[]> = {
  // Game engines
  'unity': ['unity', 'unity3d', 'c#'],
  'godot': ['godot', 'gdscript'],
  'unreal': ['unreal', 'ue4', 'ue5'],
  'phaser': ['phaser', 'phaser3'],

  // Web frameworks
  'nextjs': ['next', 'nextjs', 'next.js'],
  'react': ['react', 'reactjs'],
  'svelte': ['svelte', 'sveltekit'],

  // Databases
  'supabase': ['supabase'],
  'postgres': ['postgres', 'postgresql'],
  // ... more tech
};
```

### FEATURE_PATTERNS (goal-analyzer.ts)

```typescript
const FEATURE_PATTERNS: Record<string, string[]> = {
  // Game features
  'combat': ['combat', 'fight', 'battle', 'attack', 'damage', 'health'],
  'inventory': ['inventory', 'items', 'equipment', 'loot', 'crafting'],
  'progression': ['progression', 'leveling', 'xp', 'skills', 'upgrade'],
  'procedural': ['procedural', 'generation', 'random', 'dungeon'],

  // App features
  'authentication': ['auth', 'login', 'signup', 'user', 'account'],
  'payments': ['payment', 'billing', 'subscription', 'checkout'],
  'dashboard': ['dashboard', 'admin', 'analytics', 'metrics'],
  // ... more features
};
```

---

## Game Keyword Mappings (Added 2025-01-10)

### Game Engines
```typescript
'unity': ['unity-development', 'unity-llm-integration'],
'godot': ['godot-development', 'godot-llm-integration'],
'unreal': ['unreal-engine', 'unreal-llm-integration'],
'phaser': ['game-development', 'game-design'],
```

### Game Genres
```typescript
'roguelike': ['game-design', 'procedural-generation', 'progression-systems'],
'roguelite': ['game-design', 'procedural-generation', 'progression-systems'],
'rpg': ['game-design', 'progression-systems', 'narrative-design'],
'platformer': ['game-development', 'physics-simulation', 'level-design'],
'puzzle': ['puzzle-design', 'game-design', 'level-design'],
'strategy': ['game-design', 'game-ai-behavior', 'level-design'],
'shooter': ['game-development', 'combat-design', 'game-ai-behavior'],
'simulation': ['game-development', 'physics-simulation', 'game-ai-behavior'],
```

### Game Systems
```typescript
'procedural': ['procedural-generation', 'level-design', 'game-development'],
'dungeon': ['procedural-generation', 'level-design', 'game-design'],
'combat': ['combat-design', 'game-ai-behavior', 'animation-systems'],
'inventory': ['inventory-management', 'game-ui-design', 'game-design', 'progression-systems', 'database-architect'],
'crafting': ['game-design', 'game-ui-design', 'progression-systems'],
'progression': ['progression-systems', 'game-design', 'player-onboarding'],
'level': ['level-design', 'game-design', 'procedural-generation'],
'enemy': ['game-ai-behavior', 'combat-design', 'character-design'],
'npc': ['game-ai-behavior', 'narrative-design', 'llm-npc-dialogue'],
'dialogue': ['narrative-design', 'llm-npc-dialogue', 'game-design'],
'quest': ['narrative-design', 'game-design', 'progression-systems'],
```

### Game Art
```typescript
'sprite': ['pixel-art', 'pixel-art-sprites', 'animation-systems'],
'pixel': ['pixel-art', 'pixel-art-sprites', 'game-development'],
'tilemap': ['level-design', 'game-development', 'pixel-art'],
'vfx': ['vfx-realtime', 'animation-systems', 'shader-programming'],
'shader': ['shader-programming', 'vfx-realtime', 'threejs-3d-graphics'],
```

### Game Audio
```typescript
'soundtrack': ['game-audio', 'ai-audio-production'],
'sfx': ['game-audio', 'ai-audio-production'],
'sound effect': ['game-audio', 'ai-audio-production'],
```

### Multiplayer
```typescript
'multiplayer': ['game-networking', 'realtime-engineer', 'websockets-realtime'],
'co-op': ['game-networking', 'game-design', 'realtime-engineer'],
'pvp': ['game-networking', 'combat-design', 'game-design'],
```

---

## Unit Testing Plan

### 1. Goal Analyzer Tests (`goal-analyzer.test.ts`)

```typescript
describe('analyzeGoal', () => {
  it('should extract game keywords from roguelike PRD', () => {
    const result = analyzeGoal('Build a roguelike dungeon crawler');
    expect(result.keywords).toContain('roguelike');
    expect(result.keywords).toContain('dungeon');
    expect(result.domains).toContain('game');
  });

  it('should extract SaaS keywords from subscription app PRD', () => {
    const result = analyzeGoal('Build a SaaS with Stripe subscriptions');
    expect(result.keywords).toContain('saas');
    expect(result.keywords).toContain('stripe');
    expect(result.domains).toContain('saas');
  });

  it('should detect technologies correctly', () => {
    const result = analyzeGoal('Build with Next.js and Supabase');
    expect(result.technologies).toContain('nextjs');
    expect(result.technologies).toContain('supabase');
  });

  it('should detect features correctly', () => {
    const result = analyzeGoal('Add authentication and payments');
    expect(result.features).toContain('authentication');
    expect(result.features).toContain('payments');
  });

  it('should calculate confidence based on detail', () => {
    const vague = analyzeGoal('app');
    const detailed = analyzeGoal('Build a roguelike with procedural dungeons');
    expect(detailed.confidence).toBeGreaterThan(vague.confidence);
  });
});
```

### 2. Skill Matcher Tests (`skill-matcher.test.ts`)

```typescript
describe('matchSkillsLocal', () => {
  it('should match game skills for game PRD', () => {
    const goal = analyzeGoal('roguelike dungeon crawler');
    const result = await matchSkills(goal, { preferLocal: true });

    const skillIds = result.skills.map(s => s.skillId);
    expect(skillIds).toContain('game-design');
    expect(skillIds).toContain('procedural-generation');
    expect(skillIds).not.toContain('stripe-integration');
  });

  it('should match SaaS skills for SaaS PRD', () => {
    const goal = analyzeGoal('SaaS with Stripe payments and auth');
    const result = await matchSkills(goal, { preferLocal: true });

    const skillIds = result.skills.map(s => s.skillId);
    expect(skillIds).toContain('stripe-integration');
    expect(skillIds).toContain('supabase-auth');
    expect(skillIds).not.toContain('game-design');
  });

  it('should score multiple keyword matches higher', () => {
    const goal = analyzeGoal('roguelike with procedural dungeons');
    const result = await matchSkills(goal, { preferLocal: true });

    // procedural-generation should score high (matched by roguelike + procedural + dungeon)
    const procGen = result.skills.find(s => s.skillId === 'procedural-generation');
    expect(procGen?.score).toBeGreaterThan(0.7);
  });

  it('should respect maxResults limit', () => {
    const goal = analyzeGoal('complex app with everything');
    const result = await matchSkills(goal, { maxResults: 10 });
    expect(result.skills.length).toBeLessThanOrEqual(10);
  });
});
```

### 3. H70 Keyword Mapping Tests (`h70-skill-matcher.test.ts`)

```typescript
describe('KEYWORD_TO_SKILLS', () => {
  it('should have no duplicate keys', () => {
    // Verify the object doesn't have duplicate keys
    const keys = Object.keys(KEYWORD_TO_SKILLS);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('should map game keywords to game skills', () => {
    expect(KEYWORD_TO_SKILLS['roguelike']).toContain('game-design');
    expect(KEYWORD_TO_SKILLS['combat']).toContain('combat-design');
    expect(KEYWORD_TO_SKILLS['inventory']).toContain('game-ui-design');
  });

  it('should map auth keywords to auth skills', () => {
    expect(KEYWORD_TO_SKILLS['auth']).toContain('supabase-auth');
    expect(KEYWORD_TO_SKILLS['login']).toContain('supabase-auth');
  });

  it('should have valid skill IDs (exist in skills.json)', async () => {
    const skills = await fetch('/skills.json').then(r => r.json());
    const validIds = new Set(skills.map(s => s.id));

    for (const [keyword, skillIds] of Object.entries(KEYWORD_TO_SKILLS)) {
      for (const skillId of skillIds) {
        expect(validIds.has(skillId)).toBe(true);
      }
    }
  });
});
```

### 4. Integration Tests

```typescript
describe('PRD to Workflow Integration', () => {
  it('should generate game workflow for game PRD', async () => {
    const prd = 'Build a roguelike dungeon crawler with pixel art';
    const workflow = await generateWorkflowFromGoal(prd);

    const nodeIds = workflow.nodes.map(n => n.skillId);
    expect(nodeIds.some(id => id.includes('game'))).toBe(true);
    expect(nodeIds.some(id => id.includes('pixel'))).toBe(true);
  });

  it('should generate SaaS workflow for SaaS PRD', async () => {
    const prd = 'Build a SaaS app with auth and Stripe payments';
    const workflow = await generateWorkflowFromGoal(prd);

    const nodeIds = workflow.nodes.map(n => n.skillId);
    expect(nodeIds.some(id => id.includes('auth'))).toBe(true);
    expect(nodeIds.some(id => id.includes('stripe'))).toBe(true);
  });
});
```

---

## Configuration

### Constants (goal.ts)

```typescript
export const GOAL_VALIDATION = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 10000,
  MIN_WORDS_FOR_CONFIDENCE: 3,
  MAX_SKILLS_TO_SUGGEST: 25,  // Cap at 25 skills
  MIN_CONFIDENCE_SCORE: 0.3,
  VAGUE_INPUT_THRESHOLD: 0.4
};
```

### Dynamic Skill Limit

```typescript
// Calculates skill limit based on PRD complexity
function getDynamicSkillLimit(wordCount: number, featureCount: number): number {
  const baseSkills = 15;
  const wordBonus = Math.floor(wordCount / 150);
  const featureBonus = Math.floor(featureCount / 2);
  return Math.min(25, Math.max(10, baseSkills + wordBonus + featureBonus));
}
```

---

## Troubleshooting

### Game PRD getting SaaS skills?
1. Check if game keywords are in `KEYWORD_TO_SKILLS`
2. Check if game domain is in `DOMAIN_PATTERNS`
3. Check if game features are in `FEATURE_PATTERNS`

### Skills not matching?
1. Verify keyword exists in `KEYWORD_TO_SKILLS`
2. Check skill ID exists in `skills.json`
3. Check goal analyzer extracts the keyword

### Low confidence score?
1. PRD may be too short/vague
2. No recognized technologies/features detected
3. Domain not detected

---

## Recent Changes (2025-01-10)

1. **Added 30+ game keyword mappings** to `h70-skill-matcher.ts`
2. **Added game domain detection** to `goal-analyzer.ts`
3. **Fixed duplicate 'inventory' key** - merged game + e-commerce contexts
4. **Updated /api/analyze** - returns helpful fallback message when no API key

---

## Next Steps

1. Add unit tests for goal-analyzer
2. Add unit tests for skill-matcher
3. Add integration tests for full PRD → workflow flow
4. Consider adding more keyword mappings for other domains (AI, Web3, etc.)
