# Codebase Remediation Plan

Date: 2026-02-16

This document tracks the review findings and the implementation sequence. Each section is intended to be completed and committed independently.

## 1. Secure MCP execution endpoints
- Files:
  - `src/routes/api/mcp/+server.ts`
  - `src/routes/api/mcp/call/+server.ts`
  - `src/lib/services/mcp/client.ts`
- Actions:
  - Add authentication/authorization guard for MCP routes.
  - Add strict server-side allowlist for executable commands.
  - Reject arbitrary environment injection.
  - Add clear error responses for denied requests.
- Commit message:
  - `fix(security): protect mcp endpoints and restrict process execution`

## 2. Block path traversal in file-backed APIs
- Files:
  - `src/routes/api/prd-bridge/result/+server.ts`
  - `src/routes/api/events/+server.ts`
  - `src/routes/api/h70-skills/[skillId]/+server.ts`
- Actions:
  - Validate `requestId` and `skillId` with strict ID regex.
  - Enforce base-directory containment after `resolve`.
  - Return `400` for invalid IDs and `403` for containment violations.
- Commit message:
  - `fix(security): validate ids and enforce safe file path boundaries`

## 3. Fix canvas mount lifecycle cleanup
- Files:
  - `src/routes/canvas/+page.svelte`
- Actions:
  - Convert `onMount(async () => ...)` to sync mount + internal async bootstrap.
  - Ensure cleanup function is returned synchronously.
- Commit message:
  - `fix(canvas): ensure onMount cleanup is registered correctly`

## 4. Unify pipeline and canvas types
- Files:
  - `src/lib/stores/pipelines.svelte.ts`
  - `src/lib/stores/canvas.svelte.ts`
  - `src/lib/services/pipeline-loader.ts`
  - `src/routes/canvas/+page.svelte`
  - `src/lib/components/Welcome.svelte`
- Actions:
  - Define canonical pipeline node/connection types.
  - Replace generic `Record<string, unknown>` arrays with shared types.
  - Update callers to use normalized typed data.
- Commit message:
  - `refactor(types): align pipeline and canvas data contracts`

## 5. Resolve missing contentforge dependency path
- Files:
  - `src/lib/services/mind-learning-intelligence.ts`
  - `src/lib/services/contentforge-mind.ts` (new if needed)
- Actions:
  - Restore missing module or add supported fallback adapter.
  - Remove implicit-`any` propagation from unresolved imports.
- Commit message:
  - `fix(mind): restore contentforge integration module boundary`

## 6. Fix schema/type drift in skill drop and learning page nullability
- Files:
  - `src/lib/types/schemas.ts`
  - `src/lib/stores/skills.svelte.ts`
  - `src/routes/canvas/+page.svelte`
  - `src/routes/learn/+page.svelte`
- Actions:
  - Align dropped skill payload with `Skill` requirements.
  - Standardize nullable/optional numeric field handling.
- Commit message:
  - `fix(types): resolve dropped skill and learning nullability mismatches`

## 7. Address priority accessibility violations
- Files (initial high-impact set):
  - `src/routes/status-dashboard/+page.svelte`
  - `src/routes/mcps/+page.svelte`
  - `src/lib/components/ExecutionPanel.svelte`
  - `src/lib/components/ConnectionLine.svelte`
  - `src/lib/components/ValidationPanel.svelte`
  - `src/lib/components/PostMissionReview.svelte`
  - `src/routes/canvas/+page.svelte`
- Actions:
  - Replace click-only non-interactive elements with semantic controls.
  - Add keyboard handlers, roles, and tabindex where needed.
  - Resolve top build-time accessibility warnings.
- Commit message:
  - `fix(a11y): add keyboard and semantic support for interactive ui`

## 8. Remove hardcoded absolute paths
- Files:
  - `src/routes/api/h70-skills/[skillId]/+server.ts`
  - `src/routes/api/teams/+server.ts`
  - `src/lib/services/storage.ts` or central config module (if added)
- Actions:
  - Introduce env-configured base paths with safe defaults.
  - Validate configured directories on startup/access.
- Commit message:
  - `refactor(config): replace absolute windows paths with env configuration`

## 9. Fix mojibake / encoding issues
- Files:
  - `src/lib/components/Welcome.svelte`
  - `src/lib/components/PipelineSelector.svelte`
  - `src/routes/learn/+page.svelte`
  - other affected UI files
- Actions:
  - Replace corrupted literals with clean UTF-8 text.
  - Keep files ASCII-only where practical.
- Commit message:
  - `fix(ui): normalize corrupted strings and encoding artifacts`

## Validation after each step
- Run:
  - `npm run check` (or targeted typecheck where practical)
  - `npm run test:run` for behavior-sensitive changes
  - `npm run build` for compile + a11y warning tracking
- Track deltas in commit notes.

## Completion criteria
- All security findings remediated and tested.
- No unresolved missing-module errors.
- Type alignment across pipeline/canvas and reviewed pages.
- Accessibility warning count reduced for targeted hotspots.
- Environment portability improved via path configuration.
