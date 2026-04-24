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
npm run test -- --run
npm run check
npm run build
npm audit --omit=dev --audit-level=high
```

Do not expose local control APIs on `0.0.0.0` without an explicit auth and origin policy.
