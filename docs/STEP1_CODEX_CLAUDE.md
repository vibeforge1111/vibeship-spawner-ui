# Step 1 — Codex + Claude catalog/config readiness

## What changed

- Limited default multi-LLM provider registry to **only** `claude` and `codex`.
- Added required key metadata for dispatch readiness:
  - `claude` -> `ANTHROPIC_API_KEY`
  - `codex` -> `OPENAI_API_KEY`
- Tightened `/api/dispatch` validation:
  - rejects unsupported provider IDs (anything except `claude`, `codex`)
  - validates required API key readiness before dispatch
- Updated docs and env examples to reflect Step-1 scope.
- Updated orchestrator tests to match the two-provider catalog.

## Quick test

```bash
# from repo root
npm run test -- src/lib/services/multi-llm-orchestrator.test.ts

# optional: run app and verify UI provider list in Execution Panel
npm run dev
```

Manual UI check:
1. Open Execution Panel -> Mission Settings -> Multi-LLM Orchestrator.
2. Enable Multi-LLM.
3. Confirm provider list shows only **Claude** and **Codex**.
