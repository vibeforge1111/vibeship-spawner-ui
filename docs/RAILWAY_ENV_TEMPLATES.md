# Railway Env Templates

Use these as copy-paste starting points for a two-service Railway deploy. Replace
all placeholders before deploy. Keep the two services in the same Railway
project/environment so `*.railway.internal` private DNS works.

Do not set Spark Pro connection tokens for this flow. They are paused for
member-facing Railway/VPS setup until the downstream hosted tool consumes them
in production.

## Shared Values

Generate once per secret. Paste each secret into both services where that row
appears, but keep the three secret values different from each other:

```bash
openssl rand -base64 32
```

Shared variables:

```text
SPARK_WORKSPACE_ID=<private-prod-spawner-slug>
SPARK_BRIDGE_API_KEY=<same-32-byte-secret-in-both-services>
SPARK_UI_API_KEY=<same-32-byte-secret-in-both-services>
SPARK_UI_PAIRING_CODE=<optional-one-time-browser-pairing-code>
TELEGRAM_RELAY_SECRET=<same-32-byte-secret-in-both-services>
```

`SPARK_BRIDGE_API_KEY` protects bot-to-Spawner control calls.
`SPARK_UI_API_KEY` protects Spawner browser/API reads.
`SPARK_UI_PAIRING_CODE` protects one temporary browser bootstrap URL and is
consumed once by Spawner.
`TELEGRAM_RELAY_SECRET` protects Spawner-to-bot mission callbacks.

Do not reuse one generated secret for every row. A leaked browser key
should not also authorize bridge control calls or mission callbacks.

## Spawner UI Service

Attach a Railway volume mounted at `/data`.

```text
HOST=0.0.0.0
PORT=3000
SPARK_LIVE_CONTAINER=1
SPARK_HOSTED_PRIVATE_PREVIEW=1
SPARK_WORKSPACE_ID=<same-private-prod-spawner-slug>
SPARK_BRIDGE_API_KEY=<same-bridge-secret-as-bot>
SPARK_UI_API_KEY=<same-ui-secret-as-bot>
SPARK_UI_PAIRING_CODE=<optional-one-time-browser-pairing-code>
TELEGRAM_RELAY_SECRET=<same-relay-secret-as-bot>
MISSION_CONTROL_WEBHOOK_URLS=http://spark-telegram-bot.railway.internal:8788/spawner-events
SPAWNER_STATE_DIR=/data/spawner
SPARK_WORKSPACE_ROOT=/data/workspaces
SPARK_ALLOW_EXTERNAL_PROJECT_PATHS=0
DEFAULT_MISSION_PROVIDER=zai
ZAI_API_KEY=<optional-zai-key>
ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4/
ZAI_MODEL=glm-5.1
MINIMAX_API_KEY=<optional-minimax-key>
MINIMAX_MODEL=MiniMax-M2.7
```

Run before calling the Spawner ready:

```bash
node scripts/deploy-doctor.mjs --role spawner
node scripts/deploy-doctor.mjs --role spawner --env-file ./spawner.railway.env
node scripts/health-spark.mjs
```

## Telegram Bot Service

Attach a Railway volume mounted at `/data`.

```text
BOT_TOKEN=<telegram-botfather-token>
ADMIN_TELEGRAM_IDS=<your-telegram-user-id>
TELEGRAM_GATEWAY_MODE=polling
TELEGRAM_RELAY_HOST=::
TELEGRAM_RELAY_PORT=8788
TELEGRAM_RELAY_URL=http://spark-telegram-bot.railway.internal:8788/spawner-events
TELEGRAM_RELAY_SECRET=<same-relay-secret-as-spawner>
SPAWNER_UI_URL=http://spawner-ui.railway.internal:3000
SPAWNER_UI_PUBLIC_URL=https://<your-spawner-public-domain>.up.railway.app
SPARK_BRIDGE_API_KEY=<same-bridge-secret-as-spawner>
SPARK_UI_API_KEY=<same-ui-secret-as-spawner>
SPARK_WORKSPACE_ID=<same-private-prod-spawner-slug>
SPARK_GATEWAY_STATE_DIR=/data/spark-gateway
SPARK_MISSION_LLM_PROVIDER=claude
SPARK_CHAT_LLM_PROVIDER=claude
ANTHROPIC_API_KEY=<optional-anthropic-key>
```

Run before calling the bot ready:

```bash
node scripts/deploy-doctor.mjs --role bot
node scripts/deploy-doctor.mjs --role bot --env-file ./bot.railway.env
node scripts/run-health-runtime.cjs
```

## Pair Check

Before pasting variables into Railway, compare the two local env files:

```bash
node scripts/check-deploy-pair.mjs --spawner-env ./spawner.railway.env --bot-env ./bot.railway.env
```

This catches mismatched shared secrets, mismatched `SPARK_WORKSPACE_ID`, and a
Spawner callback URL that does not match the bot's `TELEGRAM_RELAY_URL`.

Do not put `SPARK_UI_API_KEY` in a browser URL. If you need a quick first login,
use `?workspaceId=...&pairCode=...` with `SPARK_UI_PAIRING_CODE`, then unset or
rotate the pairing code after it is consumed.

## URL Rules

- `SPAWNER_UI_URL` is private service-to-service traffic. Use
  `http://spawner-ui.railway.internal:3000`.
- `SPARK_SPAWNER_URL` is accepted as a legacy compatibility alias for
  `SPAWNER_UI_URL`, but new setup should use `SPAWNER_UI_URL`.
- `SPAWNER_UI_PUBLIC_URL` is what Telegram users open. Use the public protected
  Spawner domain.
- `MISSION_CONTROL_WEBHOOK_URLS` points to the bot, not the Spawner.
- Railway private DNS needs an explicit port.
- Do not use `railway.internal` in any URL a Telegram user or browser must open.

## Volume Rules

- Spawner state: `/data/spawner`
- Spawner workspaces/previews: `/data/workspaces`
- Telegram gateway state: `/data/spark-gateway`

If these paths are not under `/data`, a redeploy can lose mission state,
generated projects, or gateway state.

## Expected `/diagnose`

A healthy two-service deploy should show:

```text
Bot mission relay (:8788/primary): OK
Spawner UI: OK
claude ping: OK
Builder bridge: unavailable (auto)
```

`Builder bridge: unavailable (auto)` is expected for a Railway deploy without a
separate Builder service.
