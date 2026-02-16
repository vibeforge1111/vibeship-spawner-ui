# Multi-LLM Orchestrator

## Overview

Spawner now supports a provider-agnostic orchestration layer that can coordinate multiple LLMs in one mission run.

Current built-in providers:
- `claude` (terminal CLI template)
- `codex` (terminal CLI template)
- `minimax` (OpenAI-compatible API template)
- `kimi` (OpenAI-compatible API template)
- `openrouter` (OpenAI-compatible API template)
- `ollama` (OpenAI-compatible API template)

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
2. Select strategy.
3. Select primary provider.
4. Toggle providers and set model names.
5. Run workflow.
6. Copy prompts/launch commands from the execution progress section.

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
