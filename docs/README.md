# Spawner UI Documentation

Start here when maintaining Spawner UI.

## Current Spark Stack

- [Architecture](../ARCHITECTURE.md) - current local execution-plane architecture.
- [Security](../SECURITY.md) - local control surface, secrets, and launch boundaries.
- [Agent instructions](../CLAUDE.md) - coding-agent rules for this repo.
- [Maintainability log](../test.md) - step-by-step record of recent hardening work.

## Mission Control

- [Mission lifecycle](MISSION_LIFECYCLE.md) - mission/task status vocabulary and maintenance rules.
- [Mission Control trace](SPARK_MISSION_CONTROL_TRACE.md) - Telegram, PRD, Canvas, Dispatch, Kanban, provider, and trace flow.
- [Spark agent bridge API](SPARK_AGENT_BRIDGE_API.md) - `/api/spark-agent/*` contract.
- [Spark agent canvas localhost runbook](SPARK_AGENT_CANVAS_LOCALHOST_RUNBOOK.md) - local bridge smoke test.
- [Multi-LLM quickstart](MULTI_LLM_QUICKSTART.md) - provider setup and execution visibility.
- [Multi-LLM orchestrator](MULTI_LLM_ORCHESTRATOR.md) - provider routing model.
- [Multi-LLM routing matrix](MULTI_LLM_ROUTING_MATRIX.md) - provider routing reference.

## Product And Planning Notes

These documents are planning/spec artifacts. Treat them as context, not the active route contract.

- [Goal to workflow](GOAL-TO-WORKFLOW.md)
- [PRD skill matching](PRD-SKILL-MATCHING.md)
- [Kanban scheduler handoff](KANBAN_SCHEDULER_HANDOFF.md)
- [Spark personality thesis](SPARK_PERSONALITY_THESIS.md)
- [Spark personality visible runbook](SPARK_PERSONALITY_VISIBLE_RUNBOOK.md)
- [Spark personality pipeline template](SPARK_PERSONALITY_PIPELINE_TEMPLATE.md)
- [Codebase remediation plan](CODEBASE_REMEDIATION_PLAN.md)
- [Optimization cleanup plan](OPTIMIZATION-CLEANUP-PLAN.md)
- [Stability improvements](STABILITY-IMPROVEMENTS.md)

## Archive

- [Retired external bridge archive](archive/retired-external-bridge/README.md) - historical notes only. Active Spawner/Spark docs use the Spark agent bridge.
