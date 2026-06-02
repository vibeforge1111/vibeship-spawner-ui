# Spawner UI Agent Ruleset

## Repo Role

`spawner-ui` owns mission execution, the local visual control surface, provider runtime coordination, and the APIs that back Telegram gateway commands.

Canonical truth owned here:

- Mission execution lifecycle and mission-control APIs (`/run`, `/board`, `/mission`)
- PRD/project plan canvas and visual execution state
- Mission event relay to Telegram via the local relay URL
- Provider runtime coordination (LLM/model routing, provider config)
- Agent event ledger (`mission_changed_state` records) and PRD auto-trace
- Spawner access policy (execution lanes and confirmation-gated actions)
- High-agency worker definitions and mission control access levels

This repo does not own:

- Telegram ingress, bot token, or Telegram-specific reply composition
- Builder identity, AOC, route confidence, or memory orchestration
- CLI registry, installer, secret storage, or module lifecycle
- durable memory storage, memory proof-card truth, or memory mutation authority
- Cockpit read-model truth or cross-repo authority verdicts

## Start-of-Work Protocol

1. Run `git status --short --branch`.
2. Read this file plus the relevant server action, relay, or provider doc before edits.
3. Identify whether the change is Spawner-owned or belongs in Builder, CLI, Telegram bot, memory, or Cockpit.
4. Define the smallest user-visible behavior and stop-ship gate.
5. Add focused tests for mission lifecycle, provider routing, access lanes, or relay serialization.
6. Keep mission relay metadata-only; never include raw provider output or prompt bodies in relay payloads.

## Key Boundaries

- Mission state changes must emit `mission_changed_state` agent events to the ledger.
- Confirmation-gated actions must pass through the access execution lane checks.
- Provider secrets are read from keychain via CLI-managed env; never hard-code.
- The PRD auto-trace file (`prd-auto-trace.jsonl`) records authority verdict evidence; do not suppress.
