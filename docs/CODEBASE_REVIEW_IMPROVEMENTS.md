# Codebase Review Improvements

## Summary

This repository currently has a non-green type-check baseline (`npm run check` reports existing errors unrelated to the new orchestrator feature).

The multi-LLM orchestrator feature was implemented in isolated commits, but these baseline issues should be resolved to improve delivery safety.

## Highest Priority Findings

1. Type-level contract drift in MCP and memory models.
   - `src/lib/types/mcp.ts`
   - `src/lib/stores/mcps.svelte.ts`
   - `src/lib/stores/mind.svelte.ts`

2. API response typing mismatch in analyzer and import/export paths.
   - `src/routes/api/analyze/+server.ts`
   - `src/lib/components/LearningsExportImport.svelte`

3. Runtime-state/type mismatch in Mind panel state initialization.
   - `src/lib/components/MindPanel.svelte`

4. Narrow pattern type filtering causing invalid comparisons.
   - `src/lib/services/learning-query.ts`

## Reliability Improvements

1. Add end-to-end coverage for mission resume paths with:
   - single-agent prompt
   - multi-provider execution pack
   - partial completion and restart

2. Add integration tests for `/api/events` with non-Claude `source` values.

3. Add schema-level validation for `/api/mission/active` payloads to prevent malformed resume files.

4. Add regression tests for `ExecutionPanel.svelte` settings persistence:
   - default settings
   - provider toggles
   - strategy and primary provider restoration

## Suggested Cleanup Sequence

1. Fix type errors in MCP and Mind store contracts.
2. Fix analyzer/import-export cast mismatches.
3. Add schema guards on mission-state API.
4. Add orchestration integration tests.
5. Re-run and enforce a green `npm run check` gate in CI.
