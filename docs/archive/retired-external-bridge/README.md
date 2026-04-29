# Retired OpenClaw Bridge Archive

This archive records the bridge material that was removed from active Spawner UI documentation when the project standardized on the Spark ecosystem and `/api/spark-agent/*`.

These notes are historical only. Do not use them as implementation or operator instructions.

## Retired Documents

The following active docs were removed and replaced with Spark-agent documentation:

- `docs/DUAL_AGENT_LIVE_BUILD.md`
- `docs/MCP_OPENCLAW_ROADMAP.md`
- `docs/OPENCLAW_BRIDGE_API.md`
- `docs/OPENCLAW_CANVAS_LOCALHOST_RUNBOOK.md`
- `docs/STEP2_OPENCLOW_BRIDGE.md`

## Current Replacements

- `docs/SPARK_AGENT_BRIDGE_API.md`
- `docs/SPARK_AGENT_CANVAS_LOCALHOST_RUNBOOK.md`
- `docs/SPARK_MISSION_CONTROL_TRACE.md`
- `docs/MISSION_LIFECYCLE.md`

## Recovery

If the historical text is needed for archaeology, recover it from git history instead of restoring it to active docs:

```bash
git show 00290f6^:docs/OPENCLAW_BRIDGE_API.md
git show 00290f6^:docs/OPENCLAW_CANVAS_LOCALHOST_RUNBOOK.md
git show 00290f6^:docs/MCP_OPENCLAW_ROADMAP.md
git show 00290f6^:docs/DUAL_AGENT_LIVE_BUILD.md
git show 00290f6^:docs/STEP2_OPENCLOW_BRIDGE.md
```

Active Spawner UI work should continue through Spark agent bridge, Mission Control, Canvas, Kanban, Trace, and Telegram relay surfaces.
