# Multi-LLM Quickstart (Beginner)

## 1) Open Mission Settings

Go to `Execution Panel -> Mission Settings -> Multi-LLM Orchestrator`.

## 2) Enable Multi-LLM

Turn on `Enable`.

## 3) Add API Keys

Paste keys into provider rows you want to use:
- OpenAI -> `OPENAI_API_KEY`
- Minimax -> `MINIMAX_API_KEY`
- Kimi -> `KIMI_API_KEY`
- OpenRouter -> `OPENROUTER_API_KEY`
- Replicate -> `REPLICATE_API_TOKEN`
- Runway -> `RUNWAY_API_KEY`

These keys are stored in your local browser storage on your machine.

## 4) Turn On Automation

Enable:
- `Auto-enable by API keys`
- `Auto-route by task type`

This lets Spawner automatically:
- activate providers that have keys
- route tasks based on capability (code/image/video/database/research/deploy)

## 5) Connect MCPs (Optional, Recommended)

If you connect MCPs, Spawner now:
- detects capability + tool catalogs from connected instances
- generates explicit MCP tool plans per task
- marks blocked tasks with deterministic fallback guidance when a required MCP tool is missing

Examples:
- DB MCPs improve data-task routing
- image/video MCPs improve media-task routing
- web-search MCPs improve research-task routing

Use `MCPs -> Connect`:
1. Pick an MCP from Discover.
2. Add config rows (`KEY` / `value`) if needed.
3. Click `Connect`.
4. Spawner auto-runs a smoke test and stores pass/fail status.

## 6) Run

Click `Run Workflow`.

In the progress panel:
- `Copy Master` for global orchestration
- `Copy Prompt` per provider
- `Copy Launch` per provider

During run preparation, Spawner logs:
- MCP plans ready per task
- blocked MCP requirements with fallback suggestions

## 7) Resume After Interruptions

Spawner stores multi-provider state in `/api/mission/active`.

You can resume using the same provider assignments and prompts.

## 8) Optional: Enable External Control APIs

For Openclaw + external command control, set API keys before exposing endpoints:
- `OPENCLAW_API_KEY`
- `EVENTS_API_KEY`
- `MCP_API_KEY` (for MCP control routes)

Optional origin allowlists:
- `OPENCLAW_ALLOWED_ORIGINS`
- `EVENTS_ALLOWED_ORIGINS`
- `MCP_ALLOWED_ORIGINS`
