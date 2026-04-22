# Spawner UI

Spawner UI is the execution plane and local dashboard for the Spark stack.

In the current supported starter architecture:

- `spark-telegram-bot` owns Telegram ingress
- `spark-intelligence-builder` is the Spark runtime core
- `spawner-ui` runs mission execution and the local visual control surface

Spawner UI does not own the Telegram bot token and does not receive Telegram
webhooks directly.

## What It Does

- provides the mission-building and mission-control UI
- exposes the local APIs used by the Telegram gateway for `/run`, `/board`, and
  `/mission`
- runs multi-step execution flows behind the gateway and Builder

## Current Role In The Spark Stack

```text
Telegram
  -> spark-telegram-bot
  -> spark-intelligence-builder
  -> spawner-ui when execution is needed
```

Spawner UI is the execution backend in that shape, not a competing ingress
surface.

## Local Development

1. Copy `.env.example` to `.env`.
2. Fill in only the provider keys and local settings you actually need.
3. Start the app:

```bash
npm install
npm run dev
```

Useful scripts:

```bash
npm run build
npm run check
npm run test:run
```

## Important Install Note

If you are installing the Telegram starter stack through the future `spark`
installer, the installer should configure this module automatically behind the
gateway. You should not need to hand-wire relay URLs, Telegram ownership, or
repo-to-repo boundaries yourself.
