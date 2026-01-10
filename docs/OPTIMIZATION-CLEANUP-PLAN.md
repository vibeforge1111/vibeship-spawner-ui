# Optimization, Cleanup & Maintainability Plan

> **Analysis Date:** January 2026
> **Codebase:** spawner-ui
> **Files Analyzed:** 129 TypeScript/Svelte files
> **H70 Skills Applied:** performance-optimization, sveltekit, test-architect, code-quality, security-owasp, typescript-strict

---

## Executive Summary

This document outlines a comprehensive plan to improve the spawner-ui codebase across six critical areas:

| Area | Issues Found | Priority |
|------|--------------|----------|
| **Security** | 3 critical, 2 medium | P0 |
| **Type Safety** | 12 `any` usages, 5 missing tsconfig options | P1 |
| **Code Duplication** | 2 files with overlapping functionality | P1 |
| **Dead Code & Logging** | 291 console.* calls, 3 TODOs | P2 |
| **Test Coverage** | 4 test files for 129 source files (~3%) | P2 |
| **Maintainability** | Scattered localStorage, large files | P3 |

---

## Phase 1: Security Hardening (P0)

### Task 1.1: Fix XSS Vulnerability in ChatPanel

**File:** `src/lib/components/chat/ChatPanel.svelte`
**Line:** 106
**Issue:** User content rendered as HTML without sanitization

```svelte
<!-- CURRENT (VULNERABLE) -->
{@html formatMarkdown(message.content)}
```

**H70 Skills:** security-owasp
**Fix:** Install DOMPurify and sanitize all user content

```bash
npm install dompurify
npm install -D @types/dompurify
```

```typescript
// formatMarkdown function - add sanitization
import DOMPurify from 'dompurify';

function formatMarkdown(text: string): string {
  const formatted = text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-bg-primary p-2 my-1 overflow-x-auto text-xs"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-bg-primary px-1 text-accent-primary">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-text-primary">$1</strong>')
    .replace(/^### (.+)$/gm, '<h3 class="font-semibold text-text-primary mt-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-semibold text-text-primary mt-2">$1</h2>')
    .replace(/^- (.+)$/gm, '<div class="pl-2">• $1</div>')
    .replace(/\n/g, '<br/>');

  // CRITICAL: Sanitize before rendering
  return DOMPurify.sanitize(formatted, {
    ALLOWED_TAGS: ['pre', 'code', 'strong', 'h2', 'h3', 'div', 'br'],
    ALLOWED_ATTR: ['class']
  });
}
```

---

### Task 1.2: Remove Debug Functions from Production

**File:** `src/lib/services/canvas-sync.ts`
**Lines:** 1348-1352
**Issue:** Test functions exposed globally via `window` object

```typescript
// CURRENT (SECURITY RISK)
if (typeof window !== 'undefined') {
  (window as any).testCanvasSync = testCanvasSync;
  (window as any).addSkillsToCanvas = addSkillsFromClaude;
}
```

**H70 Skills:** security-owasp, code-quality
**Fix:** Remove or gate behind development mode

```typescript
// Option 1: Remove entirely (RECOMMENDED)
// Delete lines 1348-1352

// Option 2: Gate behind dev mode
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).testCanvasSync = testCanvasSync;
  (window as any).addSkillsToCanvas = addSkillsFromClaude;
}
```

---

### Task 1.3: Add JSON Parse Validation with Zod

**Issue:** 40+ instances of `JSON.parse` without schema validation
**H70 Skills:** typescript-strict, security-owasp

**Files to Fix:**

| File | Line | Context |
|------|------|---------|
| `stores/canvas.svelte.ts` | 1182, 1245, 1342 | Canvas state loading |
| `stores/pipelines.svelte.ts` | 90, 101, 214, 373, 451 | Pipeline data |
| `stores/skills.svelte.ts` | 149 | Skills loading |
| `services/persistence.ts` | 53, 237, 258, 550 | State persistence |
| `services/event-bridge.ts` | 96 | SSE events |
| `routes/api/analyze/+server.ts` | 178 | Claude API response |

**Fix Pattern:**

```typescript
// BEFORE (unsafe)
const data = JSON.parse(saved);

// AFTER (with Zod validation)
import { z } from 'zod';

const SavedCanvasStateSchema = z.object({
  nodes: z.array(CanvasNodeSchema),
  connections: z.array(ConnectionSchema),
  zoom: z.number().optional(),
  pan: z.object({ x: z.number(), y: z.number() }).optional()
});

const result = SavedCanvasStateSchema.safeParse(JSON.parse(saved));
if (!result.success) {
  console.error('Invalid canvas state:', result.error);
  return defaultState;
}
const data = result.data;
```

---

## Phase 2: Type Safety Improvements (P1)

### Task 2.1: Enhance tsconfig.json

**File:** `tsconfig.json`
**H70 Skills:** typescript-strict

**Current:**
```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

**Enhanced:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true
  }
}
```

**Impact:** This will surface additional type errors. Fix incrementally.

---

### Task 2.2: Replace `any` Types

| File | Line | Current | Replacement |
|------|------|---------|-------------|
| `stores/pipelines.svelte.ts` | 25-26 | `nodes: any[]` | `nodes: CanvasNode[]` |
| `stores/pipelines.svelte.ts` | 132, 235 | `canvasData: any` | `canvasData: PipelineData` |
| `stores/skills.svelte.ts` | 198 | `data.map((s: any)` | `data.map((s: SkillResponse)` |
| `stores/stack.svelte.ts` | 380 | `Record<string, any>` | `Record<string, MCPConfig>` |
| `services/canvas-sync.ts` | 1350-1351 | `window as any` | Type assertion or remove |
| `utils/prd-analyzer.ts` | 1009 | `category as any` | Proper union type |
| `services/goal-to-workflow.ts` | 209 | `category as any` | Proper union type |
| `services/learning-query.ts` | 76 | `as any` | Type guard |

**H70 Skills:** typescript-strict

---

### Task 2.3: Add ESLint Rules for Type Safety

**File:** `.eslintrc.cjs` or `eslint.config.js`

```javascript
rules: {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'warn',
  '@typescript-eslint/consistent-type-assertions': ['error', {
    assertionStyle: 'never'
  }]
}
```

---

## Phase 3: Eliminate Code Duplication (P1)

### Task 3.1: Consolidate Workflow Generators

**Issue:** Two files with overlapping functionality:
- `src/lib/services/workflow-generator.ts` - Skills to canvas nodes
- `src/lib/utils/workflow-generator.ts` - Tasks to canvas nodes

**H70 Skills:** code-quality

**Analysis:**
| Feature | services/workflow-generator | utils/workflow-generator |
|---------|---------------------------|------------------------|
| Position calculation | Tier-based layout | Dependency-based layers |
| Skill relationships | Hardcoded mapping | Task dependencies |
| Used by | goal-to-workflow.ts | project-docs component |

**Recommendation:** Consolidate into single service with configurable layout strategies

```typescript
// src/lib/services/workflow-generator.ts (unified)

export type LayoutStrategy = 'tier' | 'dependency' | 'category';

export interface WorkflowGeneratorOptions {
  layout: LayoutStrategy;
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalGap?: number;
  verticalGap?: number;
}

export function generateWorkflow(
  input: MatchedSkill[] | ParsedTask[],
  options: WorkflowGeneratorOptions
): GeneratedWorkflow {
  // Unified implementation with strategy pattern
}
```

---

## Phase 4: Dead Code & Logging Cleanup (P2)

### Task 4.1: Remove Excessive Console Logging

**Issue:** 291 `console.*` calls across 48 files
**H70 Skills:** code-quality

**Top Offenders:**
| File | console.* count |
|------|-----------------|
| `services/canvas-sync.ts` | 53 |
| `services/mission-executor.ts` | 41 |
| `services/persistence.ts` | 21 |
| `services/sync-client.ts` | 15 |
| `components/Welcome.svelte` | 11 |
| `stores/pipelines.svelte.ts` | 11 |

**Fix Strategy:**

1. **Create structured logger:**
```typescript
// src/lib/utils/logger.ts
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
} as const;

const currentLevel = import.meta.env.DEV ? 'debug' : 'warn';

export const logger = {
  debug: (msg: string, ...args: unknown[]) => {
    if (LOG_LEVELS.debug >= LOG_LEVELS[currentLevel]) {
      console.debug(`[DEBUG] ${msg}`, ...args);
    }
  },
  info: (msg: string, ...args: unknown[]) => {
    if (LOG_LEVELS.info >= LOG_LEVELS[currentLevel]) {
      console.info(`[INFO] ${msg}`, ...args);
    }
  },
  warn: (msg: string, ...args: unknown[]) => {
    if (LOG_LEVELS.warn >= LOG_LEVELS[currentLevel]) {
      console.warn(`[WARN] ${msg}`, ...args);
    }
  },
  error: (msg: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${msg}`, ...args);
  }
};
```

2. **Replace console.log with logger.debug** (development-only)
3. **Replace console.error with logger.error** (always shown)
4. **Remove debugging console.logs entirely**

---

### Task 4.2: Resolve TODO Comments

| File | Line | TODO |
|------|------|------|
| `routes/mind/+page.svelte` | 186 | Open modal with evidence from source missions |
| `stores/mcps.svelte.ts` | 587 | Actually send to Mind API |
| `services/learning-query.ts` | 63 | Support multiple agent filtering |

**H70 Skills:** code-quality

**Action:** Either implement or create GitHub issues and update comments with issue links

```typescript
// BEFORE
// TODO: Support multiple agent filtering

// AFTER (if deferring)
// TODO(#123): Support multiple agent filtering
// See: https://github.com/your-org/spawner-ui/issues/123
```

---

### Task 4.3: Fix Empty Catch Block

**File:** `src/lib/services/mission-executor.ts`
**Line:** 1416

```typescript
// CURRENT (swallows errors)
}).catch(() => {});

// FIX (log errors)
}).catch((error) => {
  logger.error('Failed to [action]:', error);
});
```

---

## Phase 5: Test Coverage Improvement (P2)

### Task 5.1: Current Test Coverage Audit

**H70 Skills:** test-architect

| Category | Files | Tests | Coverage |
|----------|-------|-------|----------|
| Stores | 15 | 1 | 6.7% |
| Services | 28 | 3 | 10.7% |
| Components | 40+ | 0 | 0% |
| Utils | 3 | 0 | 0% |
| **Total** | **129** | **4** | **~3%** |

### Task 5.2: Priority Test Files to Add

Based on test-architect H70 skill (70% unit, 20% integration, 10% E2E):

**Critical Services (add unit tests):**
1. `services/canvas-sync.ts` - Core synchronization logic
2. `services/mission-executor.ts` - Mission state management
3. `services/mission-builder.ts` - Mission construction
4. `services/persistence.ts` - Data persistence
5. `services/h70-skills.ts` - H70 skill loading

**Critical Stores (add unit tests):**
1. `stores/canvas.svelte.ts` - Canvas state
2. `stores/skills.svelte.ts` - Skills state
3. `stores/missions.svelte.ts` - Missions state

**Test Template:**
```typescript
// src/lib/services/canvas-sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initCanvasSync, broadcastCanvasState } from './canvas-sync';

describe('canvas-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initCanvasSync', () => {
    it('sets up sync event handlers', () => {
      // Test implementation
    });
  });

  describe('broadcastCanvasState', () => {
    it('broadcasts current canvas state to connected clients', () => {
      // Test implementation
    });
  });
});
```

---

## Phase 6: Maintainability Improvements (P3)

### Task 6.1: Centralize localStorage Access

**Issue:** 62 localStorage usages across 12 files
**H70 Skills:** code-quality

**Create storage abstraction:**
```typescript
// src/lib/services/storage.ts
import { browser } from '$app/environment';

const PREFIX = 'spawner-';

export const storage = {
  get<T>(key: string, defaultValue: T): T {
    if (!browser) return defaultValue;
    try {
      const item = localStorage.getItem(PREFIX + key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): void {
    if (!browser) return;
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  },

  remove(key: string): void {
    if (!browser) return;
    localStorage.removeItem(PREFIX + key);
  },

  keys(): string[] {
    if (!browser) return [];
    return Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .map(k => k.slice(PREFIX.length));
  }
};
```

**Migration:** Replace direct localStorage calls with storage abstraction

---

### Task 6.2: Split Large Files

**Files exceeding complexity threshold:**

| File | Lines | Console.logs | Recommendation |
|------|-------|--------------|----------------|
| `canvas-sync.ts` | 1353+ | 53 | Split into modules |
| `mission-executor.ts` | 1512+ | 41 | Extract helpers |
| `canvas.svelte.ts` | 1342+ | 7 | Extract utilities |

**Suggested splits for canvas-sync.ts:**
```
services/canvas-sync/
├── index.ts          # Re-exports
├── handlers.ts       # Event handlers
├── commands.ts       # Canvas commands
├── templates.ts      # Workflow templates
└── broadcast.ts      # Broadcasting utilities
```

---

## Granular Implementation Checklist

> **Instructions:** Check off tasks as completed. Each section should be committed to GitHub after completion.

---

### SECTION A: Security Hardening (P0) - COMMIT AFTER COMPLETION

#### A1: XSS Fix in ChatPanel
- [ ] A1.1: Install DOMPurify (`npm install dompurify @types/dompurify`)
- [ ] A1.2: Import DOMPurify in `src/lib/components/chat/ChatPanel.svelte`
- [ ] A1.3: Wrap `formatMarkdown()` output with `DOMPurify.sanitize()`
- [ ] A1.4: Test chat with markdown and verify sanitization works
- [ ] **A1 COMPLETE** → Git commit: "fix(security): Add DOMPurify sanitization to ChatPanel"

#### A2: Remove Debug Functions
- [ ] A2.1: Open `src/lib/services/canvas-sync.ts`
- [ ] A2.2: Remove or gate lines 1348-1352 (window.testCanvasSync, window.addSkillsToCanvas)
- [ ] A2.3: Verify app still works without debug functions
- [ ] **A2 COMPLETE** → Git commit: "fix(security): Remove debug functions from production"

#### A3: JSON.parse Validation - Stores
- [ ] A3.1: Create Zod schemas in `src/lib/types/schemas.ts`
- [ ] A3.2: Fix `stores/canvas.svelte.ts` lines 1182, 1245, 1342 - add SavedCanvasStateSchema validation
- [ ] A3.3: Fix `stores/pipelines.svelte.ts` lines 90, 101, 214, 373, 451 - add PipelineDataSchema validation
- [ ] A3.4: Fix `stores/skills.svelte.ts` line 149 - add SkillArraySchema validation
- [ ] A3.5: Fix `stores/memory-settings.svelte.ts` line 48 - add MemorySettingsSchema validation
- [ ] A3.6: Fix `stores/mcps.svelte.ts` line 690 - add MCPStateSchema validation
- [ ] A3.7: Fix `stores/services.svelte.ts` lines 25, 35 - add ServiceStateSchema validation
- [ ] A3.8: Fix `stores/project-docs.svelte.ts` line 149 - add ProjectDocsSchema validation
- [ ] **A3 COMPLETE** → Git commit: "fix(security): Add Zod validation to store JSON.parse calls"

#### A4: JSON.parse Validation - Services
- [ ] A4.1: Fix `services/persistence.ts` lines 53, 237, 258, 550 - add appropriate schemas
- [ ] A4.2: Fix `services/event-bridge.ts` line 96 - add BridgeEventSchema validation
- [ ] A4.3: Fix `services/sync-client.ts` line 166 - add SyncEventSchema validation
- [ ] A4.4: Fix `services/memory-client.ts` line 485 - add AgentMemoryMetadataSchema validation
- [ ] A4.5: Fix `services/mcp-client.ts` line 199 - add MCPResponseSchema validation
- [ ] A4.6: Fix `services/status-storage.ts` lines 40, 95, 157, 233, 328 - add StatusSchemas
- [ ] A4.7: Fix `routes/api/analyze/+server.ts` line 178 - add ClaudeAnalysisSchema validation
- [ ] **A4 COMPLETE** → Git commit: "fix(security): Add Zod validation to service JSON.parse calls"

#### A5: JSON.parse Validation - Components & Routes
- [ ] A5.1: Fix `components/LearningsExportImport.svelte` line 196 - add ImportDataSchema validation
- [ ] A5.2: Fix `routes/canvas/+page.svelte` line 743 - add SkillSchema validation
- [ ] **A5 COMPLETE** → Git commit: "fix(security): Add Zod validation to component JSON.parse calls"

**🔒 SECTION A COMPLETE** → Git push to origin

---

### SECTION B: Type Safety (P1) - COMMIT AFTER COMPLETION

#### B1: Enhance tsconfig.json
- [ ] B1.1: Add `noUncheckedIndexedAccess: true` to tsconfig.json
- [ ] B1.2: Add `exactOptionalPropertyTypes: true` to tsconfig.json
- [ ] B1.3: Add `noPropertyAccessFromIndexSignature: true` to tsconfig.json
- [ ] B1.4: Add `noImplicitReturns: true` to tsconfig.json
- [ ] B1.5: Add `noFallthroughCasesInSwitch: true` to tsconfig.json
- [ ] B1.6: Add `noImplicitOverride: true` to tsconfig.json
- [ ] B1.7: Run `npm run check` and document new errors
- [ ] **B1 COMPLETE** → Git commit: "chore(types): Enhance tsconfig.json with stricter options"

#### B2: Fix `any` Types - Stores
- [ ] B2.1: Fix `stores/pipelines.svelte.ts` line 25 - replace `nodes: any[]` with `nodes: CanvasNode[]`
- [ ] B2.2: Fix `stores/pipelines.svelte.ts` line 26 - replace `connections: any[]` with `connections: Connection[]`
- [ ] B2.3: Fix `stores/pipelines.svelte.ts` line 132 - replace `canvasData: any` with proper type
- [ ] B2.4: Fix `stores/pipelines.svelte.ts` line 235 - replace `canvasData` any with proper type
- [ ] B2.5: Fix `stores/skills.svelte.ts` line 198 - replace `(s: any)` with `(s: SkillResponse)`
- [ ] B2.6: Fix `stores/stack.svelte.ts` line 380 - replace `Record<string, any>` with `Record<string, MCPConfig>`
- [ ] **B2 COMPLETE** → Git commit: "fix(types): Replace any types in stores"

#### B3: Fix `any` Types - Services
- [ ] B3.1: Fix `services/canvas-sync.ts` lines 1350-1351 - remove or properly type window assignment
- [ ] B3.2: Fix `services/goal-to-workflow.ts` line 209 - replace `as any` with proper union type
- [ ] B3.3: Fix `services/learning-query.ts` line 76 - replace `as any` with type guard
- [ ] **B3 COMPLETE** → Git commit: "fix(types): Replace any types in services"

#### B4: Fix `any` Types - Utils
- [ ] B4.1: Fix `utils/prd-analyzer.ts` line 1009 - replace `as any` with proper category type
- [ ] **B4 COMPLETE** → Git commit: "fix(types): Replace any types in utils"

#### B5: Add ESLint Type Safety Rules
- [ ] B5.1: Add `@typescript-eslint/no-explicit-any: error` to ESLint config
- [ ] B5.2: Add `@typescript-eslint/no-non-null-assertion: warn` to ESLint config
- [ ] B5.3: Run `npm run lint` and verify rules are enforced
- [ ] **B5 COMPLETE** → Git commit: "chore(lint): Add ESLint type safety rules"

**🔧 SECTION B COMPLETE** → Git push to origin

---

### SECTION C: Code Duplication (P1) - COMMIT AFTER COMPLETION

#### C1: Consolidate Workflow Generators
- [ ] C1.1: Analyze `services/workflow-generator.ts` - document all exports
- [ ] C1.2: Analyze `utils/workflow-generator.ts` - document all exports
- [ ] C1.3: Create unified `services/workflow-generator/index.ts` with strategy pattern
- [ ] C1.4: Create `services/workflow-generator/layouts.ts` for position calculation
- [ ] C1.5: Create `services/workflow-generator/relationships.ts` for skill relationships
- [ ] C1.6: Update all imports from old files to new unified module
- [ ] C1.7: Delete `utils/workflow-generator.ts` after migration
- [ ] C1.8: Run tests and verify functionality
- [ ] **C1 COMPLETE** → Git commit: "refactor: Consolidate workflow generators into unified module"

**🔀 SECTION C COMPLETE** → Git push to origin

---

### SECTION D: Logging Cleanup (P2) - COMMIT AFTER COMPLETION

#### D1: Create Structured Logger
- [ ] D1.1: Create `src/lib/utils/logger.ts` with log levels (debug, info, warn, error)
- [ ] D1.2: Add dev-only gating for debug logs
- [ ] D1.3: Export logger instance
- [ ] **D1 COMPLETE** → Git commit: "feat(logging): Create structured logger utility"

#### D2: Replace Console Logs - High Priority Files
- [ ] D2.1: Replace 53 console.* in `services/canvas-sync.ts` with logger
- [ ] D2.2: Replace 41 console.* in `services/mission-executor.ts` with logger
- [ ] D2.3: Replace 21 console.* in `services/persistence.ts` with logger
- [ ] D2.4: Replace 15 console.* in `services/sync-client.ts` with logger
- [ ] **D2 COMPLETE** → Git commit: "refactor(logging): Replace console.* with structured logger in services"

#### D3: Replace Console Logs - Stores
- [ ] D3.1: Replace 11 console.* in `stores/pipelines.svelte.ts` with logger
- [ ] D3.2: Replace 8 console.* in `stores/skills.svelte.ts` with logger
- [ ] D3.3: Replace 7 console.* in `stores/canvas.svelte.ts` with logger
- [ ] D3.4: Replace 7 console.* in `stores/mcps.svelte.ts` with logger
- [ ] **D3 COMPLETE** → Git commit: "refactor(logging): Replace console.* with structured logger in stores"

#### D4: Replace Console Logs - Components & Routes
- [ ] D4.1: Replace console.* in `components/Welcome.svelte` (11 calls)
- [ ] D4.2: Replace console.* in remaining component files
- [ ] D4.3: Replace console.* in `routes/canvas/+page.svelte` (7 calls)
- [ ] D4.4: Replace console.* in remaining route files
- [ ] **D4 COMPLETE** → Git commit: "refactor(logging): Replace console.* with structured logger in components"

**📝 SECTION D COMPLETE** → Git push to origin

---

### SECTION E: TODO Resolution (P2) - COMMIT AFTER COMPLETION

#### E1: Resolve TODOs
- [ ] E1.1: Fix `routes/mind/+page.svelte` line 186 - implement modal or create issue
- [ ] E1.2: Fix `stores/mcps.svelte.ts` line 587 - implement Mind API call or create issue
- [ ] E1.3: Fix `services/learning-query.ts` line 63 - implement multiple agent filtering or create issue
- [ ] **E1 COMPLETE** → Git commit: "fix: Resolve TODO comments or document as issues"

#### E2: Fix Empty Catch Block
- [ ] E2.1: Fix `services/mission-executor.ts` line 1416 - add proper error handling
- [ ] **E2 COMPLETE** → Git commit: "fix(error-handling): Replace empty catch block with proper error handling"

**📋 SECTION E COMPLETE** → Git push to origin

---

### SECTION F: Test Coverage (P2) - COMMIT AFTER COMPLETION

#### F1: Setup Test Infrastructure
- [ ] F1.1: Verify vitest is properly configured
- [ ] F1.2: Create test utilities in `src/tests/utils.ts`
- [ ] F1.3: Create mock factories for common types
- [ ] **F1 COMPLETE** → Git commit: "test: Setup test infrastructure and utilities"

#### F2: Add Service Tests
- [ ] F2.1: Create `services/canvas-sync.test.ts` - test core sync functions
- [ ] F2.2: Create `services/mission-builder.test.ts` - test mission building (expand existing)
- [ ] F2.3: Create `services/persistence.test.ts` - test state persistence
- [ ] **F2 COMPLETE** → Git commit: "test: Add unit tests for critical services"

#### F3: Add Store Tests
- [ ] F3.1: Create `stores/canvas.svelte.test.ts` - test canvas state management
- [ ] F3.2: Create `stores/skills.svelte.test.ts` - test skills state
- [ ] F3.3: Create `stores/missions.svelte.test.ts` - test missions state
- [ ] **F3 COMPLETE** → Git commit: "test: Add unit tests for critical stores"

**🧪 SECTION F COMPLETE** → Git push to origin

---

### SECTION G: Maintainability (P3) - COMMIT AFTER COMPLETION

#### G1: Create Storage Abstraction
- [ ] G1.1: Create `src/lib/services/storage.ts` with typed storage interface
- [ ] G1.2: Migrate `stores/canvas.svelte.ts` to use storage abstraction
- [ ] G1.3: Migrate `stores/pipelines.svelte.ts` to use storage abstraction
- [ ] G1.4: Migrate `stores/skills.svelte.ts` to use storage abstraction
- [ ] G1.5: Migrate `services/persistence.ts` to use storage abstraction
- [ ] G1.6: Migrate remaining localStorage usages
- [ ] **G1 COMPLETE** → Git commit: "refactor: Centralize localStorage access with storage abstraction"

#### G2: Split Large Files (Optional)
- [ ] G2.1: Split `canvas-sync.ts` into modular structure (if needed after logging cleanup)
- [ ] G2.2: Extract helpers from `mission-executor.ts` (if needed)
- [ ] **G2 COMPLETE** → Git commit: "refactor: Split large files into modular structure"

**🏗️ SECTION G COMPLETE** → Git push to origin

---

## Progress Tracker

| Section | Status | Commit | Date |
|---------|--------|--------|------|
| A: Security | ✅ Complete | `66173c8`, `238bae1`, `1a8471a`, `58ac231` | 2026-01-10 |
| B: Type Safety | ⬜ Not Started | - | - |
| C: Duplication | ⬜ Not Started | - | - |
| D: Logging | ⬜ Not Started | - | - |
| E: TODOs | ⬜ Not Started | - | - |
| F: Testing | ⬜ Not Started | - | - |
| G: Maintainability | ⬜ Not Started | - | - |

**Legend:** ⬜ Not Started | 🔄 In Progress | ✅ Complete

### Completed Tasks (Section A) ✅
- [x] A1.1: Install DOMPurify
- [x] A1.2: Import DOMPurify in ChatPanel.svelte
- [x] A1.3: Wrap formatMarkdown() with DOMPurify.sanitize()
- [x] A2.1-A2.3: Gate debug functions behind DEV mode
- [x] A3.1: Create Zod schemas file (src/lib/types/schemas.ts)
- [x] A3.2: Fix canvas.svelte.ts JSON.parse calls
- [x] A3.3: Fix pipelines.svelte.ts JSON.parse calls
- [x] A3.4: Fix skills.svelte.ts JSON.parse calls
- [x] A3.5: Fix project-docs.svelte.ts JSON.parse calls
- [x] A3.6: Fix mcps.svelte.ts JSON.parse calls
- [x] A3.7: Fix memory-settings.svelte.ts JSON.parse calls
- [x] A3.8: Fix services.svelte.ts JSON.parse calls
- [x] A4.1: Fix status-storage.ts JSON.parse calls (5 locations)
- [x] A4.2: Fix event-bridge.ts JSON.parse calls
- [x] A4.3: Fix sync-client.ts JSON.parse calls
- [x] A4.4: Fix persistence.ts JSON.parse calls
- [x] A4.5: Fix memory-client.ts JSON.parse calls
- [x] A5: Fix component/route JSON.parse calls (LearningsExportImport.svelte, canvas/+page.svelte, api/analyze/+server.ts)

---

## Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| `any` usages | 12 | 0 |
| console.* calls | 291 | <20 |
| Test coverage (files) | 3% | 40% |
| XSS vulnerabilities | 0 ✅ | 0 |
| JSON.parse vulnerabilities | 0 ✅ | 0 |
| Unresolved TODOs | 3 | 0 |
| Files >1000 lines | 3 | 0 |

---

## H70 Skills Reference

This plan was created using guidance from these H70 skills:

| Skill | Application |
|-------|-------------|
| **performance-optimization** | Measure first, optimize second philosophy |
| **sveltekit** | SvelteKit-specific patterns and anti-patterns |
| **test-architect** | Test pyramid (70/20/10) and isolation strategies |
| **code-quality** | Readability, naming, SOLID principles |
| **security-owasp** | XSS, input validation, output encoding |
| **typescript-strict** | Strict mode, type guards, Zod validation |

---

*Document generated by Claude with H70 skill guidance*
