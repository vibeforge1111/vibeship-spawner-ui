# Multi-LLM Orchestrator

## Overview

Spawner now supports a provider-agnostic orchestration layer that can coordinate multiple LLMs in one mission run.

Current built-in providers:
- `claude` (terminal CLI template)
- `codex` (terminal CLI template)
- `openai` (OpenAI-compatible API template)
- `minimax` (OpenAI-compatible API template)
- `kimi` (OpenAI-compatible API template)
- `openrouter` (OpenAI-compatible API template)
- `ollama` (OpenAI-compatible API template)
- `replicate` (custom image/video provider template)
- `runway` (custom video provider template)

## Core Design

Implementation lives in:
- `src/lib/services/multi-llm-orchestrator.ts`
- `src/lib/services/mission-executor.ts`
- `src/lib/components/ExecutionPanel.svelte`

The orchestrator builds a `MultiLLMExecutionPack` containing:
- provider registry and active providers
- strategy and primary provider
- task assignments per provider
- master orchestration prompt
- provider-specific prompts
- provider launch command templates

## Strategies

- `single`: one provider executes all tasks
- `round_robin`: tasks distributed by index across active providers
- `parallel_consensus`: all providers run all tasks, primary reports lifecycle events
- `lead_reviewer`: primary executes tasks, others emit `provider_feedback`

When **Auto-route by task type** is enabled, `round_robin` becomes capability-aware:
- image tasks route to image-capable providers
- video tasks route to video-capable providers
- database/deploy/research tasks route to matching providers when available

## Mission Execution Flow

1. Spawner builds the mission from canvas.
2. Spawner generates the standard single-agent prompt.
3. If multi-LLM is enabled, Spawner also builds the `MultiLLMExecutionPack`.
4. Mission state persists both prompt styles for resume support.
5. Execution panel exposes:
   - copy master prompt
   - copy provider prompt
   - copy provider launch command

## Event Protocol

All providers can report to:
- `POST /api/events`

Expected event patterns:
- executors: `task_started`, `progress`, `task_completed`, `mission_completed`
- reviewers: `provider_feedback`

`source` is now provider-agnostic (string), so custom provider IDs are accepted.

## UI Usage

In **Execution Panel -> Mission Settings -> Multi-LLM Orchestrator**:

1. Enable Multi-LLM.
2. (Beginner mode) paste provider API keys into the provider rows.
3. Turn on `Auto-enable by API keys` to activate providers automatically.
4. Turn on `Auto-route by task type` to let Spawner route tasks by capability.
5. Select strategy and primary provider.
6. Run workflow.
7. Copy prompts/launch commands from the execution progress section.

Notes:
- API keys entered in the panel are stored in browser local storage on that machine.
- The orchestrator only uses key presence for readiness/routing decisions.
- The generated launch commands still use environment-variable placeholders.

## MCP-Aware Routing

Spawner reads capabilities from connected MCP instances and includes them in orchestration prompts.

Examples:
- `database` MCP connected -> DB tasks are tagged for DB-capable providers.
- `image_gen`/`video_gen` MCP connected -> media tasks are routed with stronger multimodal hints.
- `web_search` MCP connected -> research tasks include web-search execution hints.

## Extending with New Providers

1. Add a provider in `DEFAULT_MULTI_LLM_PROVIDERS`.
2. Set `kind`:
   - `terminal_cli` for local CLI launch templates
   - `openai_compat` for OpenAI-style API endpoints
   - `custom` for external integration hooks
3. Add model/base URL/API key env metadata.
4. (Optional) add UI defaults for provider-specific controls.

## Resume Compatibility

`/api/mission/active` now stores and returns `multiLLMExecution`, allowing interruption-safe resume with provider context.
