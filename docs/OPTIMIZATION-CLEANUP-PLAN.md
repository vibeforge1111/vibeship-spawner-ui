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

## Implementation Checklist

### Week 1: Security (P0)
- [ ] Task 1.1: Add DOMPurify to ChatPanel
- [ ] Task 1.2: Remove/gate debug functions
- [ ] Task 1.3: Add Zod validation to critical JSON.parse calls

### Week 2: Type Safety (P1)
- [ ] Task 2.1: Update tsconfig.json with stricter options
- [ ] Task 2.2: Replace `any` types (start with stores)
- [ ] Task 2.3: Add ESLint type safety rules

### Week 3: Duplication & Cleanup (P1-P2)
- [ ] Task 3.1: Consolidate workflow generators
- [ ] Task 4.1: Create structured logger
- [ ] Task 4.2: Resolve or document TODOs
- [ ] Task 4.3: Fix empty catch block

### Week 4: Testing & Maintainability (P2-P3)
- [ ] Task 5.2: Add tests for 3 critical services
- [ ] Task 6.1: Create storage abstraction
- [ ] Task 6.2: Begin splitting large files

---

## Metrics to Track

| Metric | Current | Target |
|--------|---------|--------|
| `any` usages | 12 | 0 |
| console.* calls | 291 | <20 |
| Test coverage (files) | 3% | 40% |
| XSS vulnerabilities | 1 | 0 |
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
