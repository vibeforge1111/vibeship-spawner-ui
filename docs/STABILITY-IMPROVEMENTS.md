# Spawner Stability Improvements

> **Design Principle**: KISS (Keep It Simple, Stupid) - Every feature must justify its complexity. No over-engineering.

## Problem Statement

The ReelRoyale mission execution revealed critical gaps:

| Metric | Expected | Actual | Gap |
|--------|----------|--------|-----|
| Tasks Completed | 27 | 7 | 74% skipped |
| Skills Loaded | 45+ | ~5 | 89% unused |
| Feature Tasks | 20 | 0 | 100% skipped |
| End-to-End Verified | Yes | No | No verification |

**Root Causes:**
1. No skill loading enforcement
2. No task completion verification
3. No infrastructure vs feature distinction
4. Premature "mission complete" declaration
5. No end-of-project validation gate

---

## Architecture Overview

```
PRD Input
    |
    v
+------------------+
| PRE-FLIGHT       |  <-- Validate before starting
| CHECKS           |
+------------------+
    |
    v
+------------------+
| MISSION          |  <-- Execute with tracking
| EXECUTION        |
|  - Skill Loading |
|  - Artifact Track|
|  - Health Monitor|
+------------------+
    |
    v
+------------------+
| AUTOMATED        |  <-- Run all possible tests
| VERIFICATION     |
|  - Unit Tests    |
|  - Build Check   |
|  - Type Check    |
+------------------+
    |
    v
+------------------+
| HUMAN            |  <-- END checkpoint only
| CHECKPOINT       |
|  - Review Summary|
|  - Manual QA     |
+------------------+
    |
    v
Mission Complete
```

---

## Implementation Priorities

### Phase 1: Critical (Must Have)
1. [Pre-Flight Validation](#1-pre-flight-validation)
2. [Skill Loading Enforcement](#2-skill-loading-enforcement)
3. [Task Completion Gates](#3-task-completion-gates)
4. [End-of-Project Checkpoint](#4-end-of-project-checkpoint)

### Phase 2: Important (Should Have)
5. [Artifact Tracking](#5-artifact-tracking)
6. [Confidence Scoring](#6-confidence-scoring)
7. [Testing Integration](#7-testing-integration)

### Phase 3: Nice to Have
8. [Skill Dependencies](#8-skill-dependencies)
9. [Execution Health Monitoring](#9-execution-health-monitoring)
10. [Learning Feedback Loop](#10-learning-feedback-loop)

---

## Phase 1: Critical Implementations

### 1. Pre-Flight Validation

**Purpose:** Validate mission is executable BEFORE starting. Fail fast.

**KISS Implementation:**

```typescript
// src/lib/services/preflight.ts

export interface PreFlightResult {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; message?: string }>;
}

export async function runPreFlight(mission: Mission): Promise<PreFlightResult> {
  const checks = [];

  // Check 1: Skills exist
  const skillIds = getAllSkillIds(mission);
  const missingSkills = await findMissingSkills(skillIds);
  checks.push({
    name: 'Skills Available',
    passed: missingSkills.length === 0,
    message: missingSkills.length > 0 ? `Missing: ${missingSkills.join(', ')}` : undefined
  });

  // Check 2: Project directory exists
  const projectExists = await pathExists(mission.context.projectPath);
  checks.push({
    name: 'Project Path',
    passed: projectExists,
    message: !projectExists ? 'Project directory not found' : undefined
  });

  // Check 3: Package.json exists (for npm projects)
  const hasPackageJson = await pathExists(`${mission.context.projectPath}/package.json`);
  checks.push({
    name: 'Package.json',
    passed: hasPackageJson,
    message: !hasPackageJson ? 'No package.json found' : undefined
  });

  return {
    passed: checks.every(c => c.passed),
    checks
  };
}
```

**Integration Point:** `mission-executor.ts` before `execute()`

---

### 2. Skill Loading Enforcement

**Purpose:** Ensure skills are actually loaded before task execution.

**KISS Implementation:**

```typescript
// Add to mission-executor.ts

private loadedSkillsThisSession: Set<string> = new Set();

private async ensureSkillsLoaded(taskId: string): Promise<boolean> {
  const requiredSkills = this.progress.taskSkillMap.get(taskId) || [];
  const missing = requiredSkills.filter(s => !this.loadedSkillsThisSession.has(s));

  if (missing.length > 0) {
    this.addLocalLog('warning', `Task ${taskId} requires skills not yet loaded: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

// Track when skills are loaded (called from event bridge)
public markSkillLoaded(skillId: string): void {
  this.loadedSkillsThisSession.add(skillId);
}
```

**Execution Prompt Addition:**
```markdown
## Skill Loading Protocol

When you load a skill, report it:
```bash
curl -X POST ${eventUrl}/api/events -d '{"type":"skill_loaded","skillId":"SKILL_ID"}'
```

This tracks skill usage and enables verification.
```

---

### 3. Task Completion Gates

**Purpose:** Prevent marking tasks complete without verification.

**KISS Implementation:**

```typescript
// Add to mission-executor.ts

interface CompletionGate {
  type: 'build' | 'test' | 'typecheck' | 'lint' | 'manual';
  command?: string;
  required: boolean;
}

const TASK_CATEGORY_GATES: Record<string, CompletionGate[]> = {
  'setup': [{ type: 'build', command: 'npm run build', required: false }],
  'testing': [{ type: 'test', command: 'npm run test', required: true }],
  'deployment': [{ type: 'build', command: 'npm run build', required: true }],
  'default': []  // Features don't block on gates, but track completion quality
};

private getCompletionGates(task: MissionTask): CompletionGate[] {
  return TASK_CATEGORY_GATES[task.category] || TASK_CATEGORY_GATES['default'];
}
```

**Completion Quality Score:**
```typescript
interface TaskCompletionQuality {
  skillsLoaded: boolean;      // +25 points
  artifactsCreated: boolean;  // +25 points
  noErrors: boolean;          // +25 points
  gatesPassed: boolean;       // +25 points
  score: number;              // 0-100
}
```

---

### 4. End-of-Project Checkpoint

**Purpose:** Single human verification point AFTER all automated work is done.

**KISS Implementation:**

```typescript
// src/lib/services/checkpoint.ts

export interface ProjectCheckpoint {
  missionId: string;
  missionName: string;
  completedAt: Date;

  // Automated Results
  automated: {
    tasksCompleted: number;
    tasksFailed: number;
    testsRun: number;
    testsPassed: number;
    buildSucceeded: boolean;
    typeCheckPassed: boolean;
    lintPassed: boolean;
  };

  // Quality Metrics
  quality: {
    skillUsageRatio: number;      // 0-1
    averageTaskQuality: number;   // 0-100
    artifactCoverage: number;     // 0-1
  };

  // For Human Review
  review: {
    summary: string;
    filesCreated: string[];
    filesModified: string[];
    manualTestSuggestions: string[];
    knownIssues: string[];
  };
}

export async function generateCheckpoint(mission: Mission): Promise<ProjectCheckpoint> {
  // Run all automated checks
  const buildResult = await runCommand('npm run build');
  const testResult = await runCommand('npm run test');
  const typeResult = await runCommand('npx tsc --noEmit');
  const lintResult = await runCommand('npm run lint');

  // Calculate quality metrics
  const skillUsageRatio = calculateSkillUsage(mission);
  const taskQuality = calculateAverageTaskQuality(mission);

  // Generate review summary
  const summary = generateReviewSummary(mission, {
    buildResult,
    testResult,
    typeResult,
    lintResult
  });

  // Suggest manual tests based on features implemented
  const manualTests = generateManualTestSuggestions(mission);

  return {
    missionId: mission.id,
    missionName: mission.name,
    completedAt: new Date(),
    automated: {
      tasksCompleted: mission.tasks.filter(t => t.status === 'completed').length,
      tasksFailed: mission.tasks.filter(t => t.status === 'failed').length,
      testsRun: testResult.testsRun || 0,
      testsPassed: testResult.testsPassed || 0,
      buildSucceeded: buildResult.exitCode === 0,
      typeCheckPassed: typeResult.exitCode === 0,
      lintPassed: lintResult.exitCode === 0
    },
    quality: {
      skillUsageRatio,
      averageTaskQuality: taskQuality,
      artifactCoverage: calculateArtifactCoverage(mission)
    },
    review: {
      summary,
      filesCreated: await getCreatedFiles(mission),
      filesModified: await getModifiedFiles(mission),
      manualTestSuggestions: manualTests,
      knownIssues: collectKnownIssues(mission)
    }
  };
}
```

**UI Component:** `CheckpointReview.svelte`
- Shows automated test results
- Lists files created/modified
- Provides manual test checklist
- Allows user to mark project as "Verified" or "Needs Work"

---

## Phase 2: Important Implementations

### 5. Artifact Tracking

**Purpose:** Track what each task produces, verify expected outputs.

**KISS Implementation:**

```typescript
// src/lib/services/artifacts.ts

export interface ExpectedArtifacts {
  files: string[];        // Glob patterns
  exports?: string[];     // For code files
}

// Simple category-based expectations
const CATEGORY_ARTIFACTS: Record<string, ExpectedArtifacts> = {
  'auth': {
    files: ['**/auth/**/*.ts', '**/auth/**/*.tsx'],
  },
  'database': {
    files: ['**/db/**/*.ts', '**/schema*.ts', 'drizzle.config.ts'],
  },
  'testing': {
    files: ['**/*.test.ts', '**/*.spec.ts', 'vitest.config.ts'],
  },
  'deployment': {
    files: ['.github/workflows/*.yml', 'Dockerfile', 'docker-compose.yml'],
  }
};

export async function verifyArtifacts(
  category: string,
  projectPath: string
): Promise<{ found: string[]; missing: string[] }> {
  const expected = CATEGORY_ARTIFACTS[category];
  if (!expected) return { found: [], missing: [] };

  const found: string[] = [];
  const missing: string[] = [];

  for (const pattern of expected.files) {
    const matches = await glob(pattern, { cwd: projectPath });
    if (matches.length > 0) {
      found.push(...matches);
    } else {
      missing.push(pattern);
    }
  }

  return { found, missing };
}
```

---

### 6. Confidence Scoring

**Purpose:** Rate completion confidence to flag uncertain tasks.

**KISS Implementation:**

```typescript
// Add to mission-executor.ts

interface ConfidenceFactors {
  skillsLoaded: boolean;      // 0.25
  noErrors: boolean;          // 0.25
  artifactsFound: boolean;    // 0.25
  durationReasonable: boolean; // 0.25
}

function calculateConfidence(factors: ConfidenceFactors): number {
  let score = 0;
  if (factors.skillsLoaded) score += 0.25;
  if (factors.noErrors) score += 0.25;
  if (factors.artifactsFound) score += 0.25;
  if (factors.durationReasonable) score += 0.25;
  return score;
}

// Flag low-confidence completions
if (confidence < 0.5) {
  this.addLocalLog('warning', `Task ${taskId} completed with low confidence (${confidence})`);
}
```

---

### 7. Testing Integration

**Purpose:** Maximize automated testing before human checkpoint.

**Testing Tools for Spawner:**

| Tool | Purpose | Integration |
|------|---------|-------------|
| **Vitest** | Unit tests | `npm run test` |
| **Playwright** | E2E tests | `npm run test:e2e` |
| **TypeScript** | Type checking | `npx tsc --noEmit` |
| **ESLint** | Code quality | `npm run lint` |
| **Lighthouse CI** | Performance | `npx lhci autorun` |

**KISS Implementation:**

```typescript
// src/lib/services/testing.ts

export interface TestSuite {
  name: string;
  command: string;
  required: boolean;
  parseOutput: (output: string) => TestResult;
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'Unit Tests',
    command: 'npm run test:run 2>&1 || true',
    required: true,
    parseOutput: parseVitestOutput
  },
  {
    name: 'Type Check',
    command: 'npx tsc --noEmit 2>&1 || true',
    required: true,
    parseOutput: parseTscOutput
  },
  {
    name: 'Lint',
    command: 'npm run lint 2>&1 || true',
    required: false,
    parseOutput: parseEslintOutput
  },
  {
    name: 'Build',
    command: 'npm run build 2>&1 || true',
    required: true,
    parseOutput: parseBuildOutput
  }
];

export async function runAllTests(projectPath: string): Promise<TestResults> {
  const results: TestResults = { suites: [], allPassed: true };

  for (const suite of TEST_SUITES) {
    const output = await exec(suite.command, { cwd: projectPath });
    const result = suite.parseOutput(output);
    results.suites.push({ name: suite.name, ...result });

    if (suite.required && !result.passed) {
      results.allPassed = false;
    }
  }

  return results;
}
```

**Manual Test Suggestion Generator:**

```typescript
// Generate manual test suggestions based on implemented features
function generateManualTestSuggestions(mission: Mission): string[] {
  const suggestions: string[] = [];

  const features = mission.tasks.filter(t =>
    t.status === 'completed' &&
    !['setup', 'testing', 'deployment'].includes(t.category)
  );

  for (const feature of features) {
    // Auth features
    if (feature.category === 'auth') {
      suggestions.push('[ ] Test login flow with valid credentials');
      suggestions.push('[ ] Test login with invalid credentials');
      suggestions.push('[ ] Test logout functionality');
      suggestions.push('[ ] Verify session persists on refresh');
    }

    // Payment features
    if (feature.category === 'payments') {
      suggestions.push('[ ] Test checkout with Stripe test card');
      suggestions.push('[ ] Verify webhook handling');
      suggestions.push('[ ] Test subscription upgrade/downgrade');
    }

    // Real-time features
    if (feature.category === 'realtime') {
      suggestions.push('[ ] Test WebSocket connection');
      suggestions.push('[ ] Verify real-time updates across tabs');
      suggestions.push('[ ] Test reconnection after disconnect');
    }

    // Game features
    if (feature.category === 'game') {
      suggestions.push('[ ] Test game start/end flow');
      suggestions.push('[ ] Verify score calculation');
      suggestions.push('[ ] Test multiplayer synchronization');
    }
  }

  return [...new Set(suggestions)]; // Dedupe
}
```

---

## Phase 3: Nice to Have

### 8. Skill Dependencies

**Purpose:** Ensure skills are loaded in correct order.

**KISS Implementation:**

```typescript
// src/lib/data/skill-dependencies.ts

// Only track critical dependencies, not everything
export const SKILL_DEPENDENCIES: Record<string, string[]> = {
  'stripe-integration': ['auth-specialist'],
  'subscription-billing': ['stripe-integration', 'database-architect'],
  'nft-engineer': ['wallet-integration'],
  'game-networking': ['realtime-engineer'],
};

export function getSkillLoadOrder(skills: string[]): string[] {
  const ordered: string[] = [];
  const visited = new Set<string>();

  function visit(skill: string) {
    if (visited.has(skill)) return;
    visited.add(skill);

    const deps = SKILL_DEPENDENCIES[skill] || [];
    for (const dep of deps) {
      if (skills.includes(dep)) {
        visit(dep);
      }
    }
    ordered.push(skill);
  }

  for (const skill of skills) {
    visit(skill);
  }

  return ordered;
}
```

---

### 9. Execution Health Monitoring

**Purpose:** Detect stalls and issues during execution.

**KISS Implementation:**

```typescript
// Add to mission-executor.ts

private lastProgressTime: number = Date.now();
private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

private startHealthMonitoring(): void {
  this.healthCheckInterval = setInterval(() => {
    const minutesSinceProgress = (Date.now() - this.lastProgressTime) / 60000;

    if (minutesSinceProgress > 5) {
      this.addLocalLog('warning', `No progress for ${Math.round(minutesSinceProgress)} minutes`);
    }
  }, 60000); // Check every minute
}

// Update on any progress
private updateLastProgress(): void {
  this.lastProgressTime = Date.now();
}
```

---

### 10. Learning Feedback Loop

**Purpose:** Learn from executions to improve future missions.

**KISS Implementation:**

```typescript
// After mission completion, record to Mind
async function recordMissionLearnings(mission: Mission, checkpoint: ProjectCheckpoint): void {
  // Only record significant learnings
  if (checkpoint.quality.skillUsageRatio < 0.5) {
    await memoryClient.recordLearning('mission-executor', {
      content: `Mission "${mission.name}" used only ${Math.round(checkpoint.quality.skillUsageRatio * 100)}% of listed skills`,
      patternType: 'improvement_needed'
    });
  }

  if (checkpoint.automated.tasksFailed > 0) {
    const failedTasks = mission.tasks.filter(t => t.status === 'failed');
    await memoryClient.recordLearning('mission-executor', {
      content: `Tasks failed: ${failedTasks.map(t => t.title).join(', ')}`,
      patternType: 'failure'
    });
  }

  if (checkpoint.quality.averageTaskQuality >= 80) {
    await memoryClient.recordLearning('mission-executor', {
      content: `Mission "${mission.name}" completed with high quality (${checkpoint.quality.averageTaskQuality}/100)`,
      patternType: 'success'
    });
  }
}
```

---

## Execution Prompt Improvements

Add to `generateExecutionPrompt()` in `mission-builder.ts`:

```markdown
## Completion Protocol

### Per-Task Requirements
1. **Load Skills First** - Report: `curl POST /api/events {"type":"skill_loaded","skillId":"..."}`
2. **Execute Task** - Follow skill patterns, avoid anti-patterns
3. **Report Progress** - At 25%, 50%, 75%
4. **Verify Before Complete** - Check artifacts exist, no errors

### DO NOT
- Skip feature tasks after infrastructure
- Mark "complete" without verification
- Ignore listed skills
- Rush to "mission_completed"

### Mission Completion
Only send `mission_completed` after ALL tasks are done.
The system will then run automated tests and generate a checkpoint for human review.
```

---

## File Structure

```
src/lib/services/
  preflight.ts          # Pre-flight validation
  checkpoint.ts         # End-of-project checkpoint
  testing.ts            # Test suite runner
  artifacts.ts          # Artifact tracking

src/lib/data/
  skill-dependencies.ts # Skill load order

src/lib/components/
  CheckpointReview.svelte   # Human review UI
  PreFlightStatus.svelte    # Pre-flight check UI
```

---

## Implementation Order

1. **Week 1: Foundation**
   - [ ] Pre-flight validation (`preflight.ts`)
   - [ ] Skill loading tracking (modify `mission-executor.ts`)
   - [ ] Update execution prompt

2. **Week 2: Verification**
   - [ ] Testing integration (`testing.ts`)
   - [ ] Artifact tracking (`artifacts.ts`)
   - [ ] Confidence scoring

3. **Week 3: Checkpoint**
   - [ ] Checkpoint generator (`checkpoint.ts`)
   - [ ] `CheckpointReview.svelte` UI
   - [ ] Manual test suggestions

4. **Week 4: Polish**
   - [ ] Health monitoring
   - [ ] Skill dependencies
   - [ ] Mind learning integration

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Task completion rate | 26% | >90% |
| Skill usage rate | 11% | >70% |
| Automated test coverage | 0% | >60% |
| Build success rate | Unknown | >95% |
| Human checkpoint efficiency | N/A | <5 min review |

---

## KISS Checklist

Before implementing any feature, verify:

- [ ] Is this the simplest solution?
- [ ] Can this be done with existing code?
- [ ] Does this add more than 50 lines? If yes, reconsider.
- [ ] Is the abstraction necessary?
- [ ] Would a junior developer understand this?
- [ ] Can this fail silently without breaking the system?

---

## References

- Original analysis: ReelRoyale mission execution failure
- Related files:
  - `src/lib/services/mission-executor.ts`
  - `src/lib/services/mission-builder.ts`
  - `src/lib/utils/prd-analyzer.ts`
  - `src/lib/services/h70-skill-matcher.ts`
