# Security

Spawner UI is the local execution plane for Spark missions. It should be treated as a local control surface, not a public internet service.

## Launch Boundaries

- Does not own Telegram ingress.
- Does not receive Telegram webhooks.
- Receives mission requests from `spark-telegram-bot` and local UI flows.
- Sends mission lifecycle events back to Telegram through the secret-protected local relay.

## Secrets

Never commit:

- `.env`, `.env.*`
- provider API keys
- Telegram bot tokens
- local logs, caches, mission state, or generated project files containing private data

Spark CLI starter setup should provide `MISSION_CONTROL_WEBHOOK_URLS` and `TELEGRAM_RELAY_SECRET`. Keep cloud LLM API keys in the Spark secret backend where possible; Spawner should receive non-secret provider metadata unless a provider integration explicitly needs a key at runtime.

## Launch Checks

Run:

```bash
npm run check
npm run test:run
npm run build
npm run smoke:routes
npm run smoke:mission-surfaces
npm audit --omit=dev --audit-level=high
```

Do not expose local control APIs on `0.0.0.0` without an explicit auth and origin policy.

## Spark Agent Bridge

The Spark agent bridge (`/api/spark-agent/*`) is local-first. If it is exposed outside loopback, configure:

- `SPARK_AGENT_API_KEY`
- `SPARK_AGENT_ALLOWED_ORIGINS`

Session commands also support `x-spark-agent-session-id` scoping. Keep this aligned with `docs/SPARK_AGENT_BRIDGE_API.md`.

## Execution Lanes

`/api/access/execution-lanes` is a read-only capability endpoint. It redacts local filesystem paths for unauthenticated browser callers; configured UI, bridge, or MCP API credentials can receive full local workspace details.

Leave `SPARK_DOCKER_AVAILABLE` unset for normal installs so Spawner can probe `docker info` with a short timeout and cache. Set it to `1` or `0` only when an install needs an explicit Docker availability override. Keep `SPARK_CODEX_SANDBOX=workspace-write` and `SPARK_ALLOW_HIGH_AGENCY_WORKERS=0` unless this is a trusted local operator install.
