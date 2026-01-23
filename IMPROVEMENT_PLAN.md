# Spawner UI Improvement Plan: Complete Project Execution

## Problem Statement

Current system failures:
1. **Same pipeline every time** - Always: Setup → Design → Auth → DB → API → Features
2. **27 tasks, 42 skills** - Fixed numbers regardless of PRD content
3. **Features after API are garbage** - Raw PRD text, not actionable tasks
4. **Claude never finishes** - Context lost, gives up, marks incomplete as done
5. **No verification** - "Complete" means nothing without checks
6. **No variation** - Different PRDs should produce different pipelines

## Solution Architecture

### Phase 1: Phased Execution Model

Instead of one giant mission with 27 tasks, break into **small phases**:

```
BEFORE (Broken):
┌──────────────────────────────────────────────────────┐
│ Mission: 27 tasks                                    │
│ Claude tries to do all 27 → fails at task 8 → done  │
└──────────────────────────────────────────────────────┘

AFTER (Works):
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Phase 1         │     │ Phase 2         │     │ Phase 3         │
│ 2-3 tasks       │ ──► │ 2-3 tasks       │ ──► │ 2-3 tasks       │
│ + verification  │     │ + verification  │     │ + verification  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   [Checkpoint]            [Checkpoint]            [Complete]
```

**Implementation:**
- `generatePhasedMission(prd)` returns `Phase[]` not flat `Task[]`
- Each phase has max 3 tasks
- Each phase has verification criteria
- Claude executes ONE phase at a time
- System verifies before next phase

### Phase 2: Verification Gates

Every task gets verification criteria:

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  skills: string[];
  // NEW
  verification: {
    files: string[];        // Files that must exist
    commands: string[];     // Commands that must succeed (npm test, etc.)
    patterns: string[];     // Code patterns that must be present
  };
  acceptanceCriteria: string[];  // Human-readable "done when"
}
```

**Example:**
```typescript
{
  title: "Project Setup",
  verification: {
    files: ["package.json", "tsconfig.json", "src/app.ts"],
    commands: ["npm install", "npm run build"],
    patterns: []
  },
  acceptanceCriteria: [
    "Package.json has all dependencies",
    "TypeScript compiles without errors",
    "Dev server starts successfully"
  ]
}
```

### Phase 3: Smart Infrastructure Detection

Replace keyword matching with explicit detection:

```typescript
// BEFORE (broken)
const needsAuth = features.some(f => f.category === 'auth');  // Too broad

// AFTER (smart)
const needsAuth = detectAuthRequirement(prd);

function detectAuthRequirement(prd: string): boolean {
  // EXPLICIT requirements only
  const explicitPatterns = [
    /user\s+(registration|signup|authentication)/i,
    /login\s+(system|page|flow)/i,
    /must\s+authenticate/i,
    /requires?\s+authentication/i,
    /protected\s+routes?/i,
  ];

  return explicitPatterns.some(p => p.test(prd));
}
```

**User Override:**
```svelte
<!-- In PRD input UI -->
<fieldset>
  <legend>Infrastructure (auto-detected, override if needed):</legend>
  <label><input type="checkbox" bind:checked={needsAuth}> Authentication</label>
  <label><input type="checkbox" bind:checked={needsDatabase}> Database</label>
  <label><input type="checkbox" bind:checked={needsAPI}> API Layer</label>
</fieldset>
```

### Phase 4: Actionable Task Generation

Transform observations into actions:

```typescript
// BEFORE (broken)
// PRD: "Insights are scattered across metrics"
// Task title: "Insights are scattered across metrics"  ← WTF

// AFTER (smart)
function transformToAction(rawText: string): TaskDefinition | null {
  // Pattern: problem statement → solution task
  const problemPatterns = [
    { match: /no\s+(.+)\s+(?:loop|system|integration)/i,
      action: (m) => `Implement ${m[1]} system` },
    { match: /(.+)\s+(?:is|are)\s+scattered/i,
      action: (m) => `Consolidate ${m[1]} into unified view` },
    { match: /lack(?:s|ing)?\s+(.+)/i,
      action: (m) => `Add ${m[1]}` },
  ];

  for (const { match, action } of problemPatterns) {
    const m = rawText.match(match);
    if (m) return { title: action(m), description: rawText };
  }

  // Not a valid feature - skip it
  return null;
}
```

### Phase 5: Pipeline Variation

Different PRDs → Different pipelines:

```typescript
const PIPELINE_TEMPLATES = {
  // SaaS with full stack
  'saas-full': ['setup', 'design', 'auth', 'database', 'api', 'features', 'tests', 'deploy'],

  // Simple frontend (no auth, no db)
  'frontend-only': ['setup', 'design', 'features', 'tests', 'deploy'],

  // AI/ML app (different infra)
  'ai-app': ['setup', 'design', 'llm-integration', 'rag-setup', 'features', 'tests', 'deploy'],

  // Static site (minimal)
  'static-site': ['setup', 'design', 'content', 'deploy'],

  // API-only (no frontend)
  'api-only': ['setup', 'database', 'api', 'tests', 'deploy'],

  // Svelte app (user preference)
  'svelte-app': ['setup-svelte', 'design', 'features', 'tests', 'deploy-vercel'],
};

function selectPipeline(analysis: PRDAnalysis): string {
  // Detect project type and select appropriate pipeline
  if (!analysis.needsFrontend && analysis.needsAPI) return 'api-only';
  if (!analysis.needsAuth && !analysis.needsDatabase) return 'frontend-only';
  if (analysis.detectedDomains.includes('ai-ml')) return 'ai-app';
  // etc.
}
```

### Phase 6: Checkpoint/Resume System

```typescript
interface Checkpoint {
  missionId: string;
  phaseIndex: number;
  completedTasks: string[];
  verificationResults: Map<string, boolean>;
  timestamp: Date;
  filesCreated: string[];
  testsStatus: { passed: number; failed: number; };
}

// After each phase
async function saveCheckpoint(mission: Mission, phase: Phase): Promise<Checkpoint> {
  const checkpoint: Checkpoint = {
    missionId: mission.id,
    phaseIndex: phase.index,
    completedTasks: phase.tasks.filter(t => t.verified).map(t => t.id),
    verificationResults: new Map(),
    timestamp: new Date(),
    filesCreated: await detectCreatedFiles(),
    testsStatus: await runTests(),
  };

  await saveToMind(checkpoint);  // Persist to Mind v5
  return checkpoint;
}

// On resume
async function resumeFromCheckpoint(missionId: string): Promise<Mission> {
  const checkpoint = await getLatestCheckpoint(missionId);
  const mission = await loadMission(missionId);

  // Skip completed phases
  mission.currentPhase = checkpoint.phaseIndex + 1;
  mission.completedTasks = checkpoint.completedTasks;

  return mission;
}
```

### Phase 7: Execution Prompt Changes

Instead of one giant prompt, generate phase-specific prompts:

```markdown
# Phase 2: Core Features (Tasks 4-6 of 12)

## Previous Phase Status
✓ Phase 1 (Setup) completed and verified
  - package.json created
  - npm install succeeded
  - Dev server runs

## This Phase: Core Features

### Task 4: User Dashboard
**Skills**: `svelte-patterns`, `tailwind-css`
**Files to create**:
- `src/routes/dashboard/+page.svelte`
- `src/lib/components/StatCard.svelte`

**Acceptance Criteria**:
- [ ] Dashboard route accessible at /dashboard
- [ ] Shows 4 stat cards
- [ ] Responsive layout

**Verification** (will be checked automatically):
- File exists: `src/routes/dashboard/+page.svelte`
- No TypeScript errors
- Component renders without crashing

### Task 5: ...

## When Done
Report completion:
```bash
curl -X POST .../api/events -d '{"type":"phase_completed","phase":2}'
```

System will verify and provide Phase 3 prompt if successful.
```

## Implementation Priority

1. **Immediate** (fixes the core problem):
   - [ ] Add verification criteria to tasks
   - [ ] Break missions into phases (max 3 tasks each)
   - [ ] Generate phase-specific prompts

2. **Short-term** (improves quality):
   - [ ] Smart infrastructure detection
   - [ ] Transform observations to actions
   - [ ] Checkpoint/resume system

3. **Medium-term** (adds flexibility):
   - [ ] Pipeline template selection
   - [ ] User override checkboxes in UI
   - [ ] Svelte as default for frontend projects

## File Changes Required

| File | Change |
|------|--------|
| `prd-analyzer.ts` | Smart infra detection, action transformation |
| `mission-builder.ts` | Phased mission structure, verification criteria |
| `mission-executor.ts` | Phase-by-phase execution, checkpoint saves |
| `Welcome.svelte` | Infrastructure override checkboxes |
| New: `phase-executor.ts` | Single-phase execution logic |
| New: `checkpoint-manager.ts` | Save/resume checkpoint logic |
| New: `verification-runner.ts` | Run verification checks |

## Success Metrics

After implementation:
- [ ] Different PRDs produce different task counts (not always 27)
- [ ] Different PRDs produce different skill counts (not always 42)
- [ ] AI app PRD → no auth tasks
- [ ] Static site PRD → minimal pipeline
- [ ] Projects actually complete (all tasks done)
- [ ] Failed tasks can be resumed
- [ ] Each task has clear verification
