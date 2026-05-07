# Spark VPS Docker Baseline

This is the supported starting shape for a self-hosted Spark VPS. Keep it
boring: one private Docker network, persistent `/data` mounts, one public
Spawner URL, and deploy doctor checks before declaring the install healthy.

## Topology

```text
Telegram polling -> spark-telegram-bot
spark-telegram-bot -> http://spawner-ui:3000
spawner-ui -> http://spark-telegram-bot:8788/spawner-events
Caddy/Nginx -> spawner-ui public HTTPS URL
```

Use private container names for service-to-service calls. Use the public Spawner
URL only for browser links and Telegram preview links.

## Compose Skeleton

```yaml
services:
  spawner-ui:
    build:
      context: ../spawner-ui
    restart: unless-stopped
    environment:
      HOST: 0.0.0.0
      PORT: 3000
      SPARK_LIVE_CONTAINER: "1"
      SPARK_HOSTED_PRIVATE_PREVIEW: "1"
      SPARK_WORKSPACE_ID: "${SPARK_WORKSPACE_ID}"
      SPARK_UI_API_KEY: "${SPARK_UI_API_KEY}"
      SPARK_BRIDGE_API_KEY: "${SPARK_BRIDGE_API_KEY}"
      TELEGRAM_RELAY_SECRET: "${TELEGRAM_RELAY_SECRET}"
      MISSION_CONTROL_WEBHOOK_URLS: "http://spark-telegram-bot:8788/spawner-events"
      SPARK_WORKSPACE_ROOT: /data/workspaces
      SPAWNER_STATE_DIR: /data/spawner
      SPARK_ALLOW_EXTERNAL_PROJECT_PATHS: "0"
      DEFAULT_MISSION_PROVIDER: "${DEFAULT_MISSION_PROVIDER:-zai}"
      ZAI_API_KEY: "${ZAI_API_KEY:-}"
      ZAI_BASE_URL: "${ZAI_BASE_URL:-https://api.z.ai/api/coding/paas/v4/}"
      ZAI_MODEL: "${ZAI_MODEL:-glm-5.1}"
    volumes:
      - spark-data:/data
    expose:
      - "3000"

  spark-telegram-bot:
    build:
      context: ../spark-telegram-bot
    restart: unless-stopped
    environment:
      BOT_TOKEN: "${BOT_TOKEN}"
      ADMIN_TELEGRAM_IDS: "${ADMIN_TELEGRAM_IDS}"
      TELEGRAM_GATEWAY_MODE: polling
      TELEGRAM_RELAY_HOST: "0.0.0.0"
      TELEGRAM_RELAY_PORT: "8788"
      TELEGRAM_RELAY_URL: "http://spark-telegram-bot:8788/spawner-events"
      TELEGRAM_RELAY_SECRET: "${TELEGRAM_RELAY_SECRET}"
      SPAWNER_UI_URL: "http://spawner-ui:3000"
      SPAWNER_UI_PUBLIC_URL: "${SPAWNER_UI_PUBLIC_URL}"
      SPARK_BRIDGE_API_KEY: "${SPARK_BRIDGE_API_KEY}"
      SPARK_UI_API_KEY: "${SPARK_UI_API_KEY}"
      SPARK_GATEWAY_STATE_DIR: /data/spark-gateway
      SPARK_MISSION_LLM_PROVIDER: "${SPARK_MISSION_LLM_PROVIDER:-claude}"
      SPARK_CHAT_LLM_PROVIDER: "${SPARK_CHAT_LLM_PROVIDER:-claude}"
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY:-}"
    volumes:
      - spark-data:/data
    expose:
      - "8788"

  caddy:
    image: caddy:2
    restart: unless-stopped
    depends_on:
      - spawner-ui
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config

volumes:
  spark-data:
  caddy-data:
  caddy-config:
```

Minimal `Caddyfile`:

```caddyfile
spark.example.com {
  reverse_proxy spawner-ui:3000
}
```

## Required `.env`

```text
SPAWNER_UI_PUBLIC_URL=https://spark.example.com
SPARK_WORKSPACE_ID=<private-non-guessable-slug>
BOT_TOKEN=<telegram-bot-token>
ADMIN_TELEGRAM_IDS=<your-telegram-id>
TELEGRAM_RELAY_SECRET=<32+ random chars>
SPARK_BRIDGE_API_KEY=<32+ random chars>
SPARK_UI_API_KEY=<32+ random chars>
ANTHROPIC_API_KEY=<optional-if-using-claude>
ZAI_API_KEY=<optional-if-using-zai>
```

Generate secrets with:

```bash
openssl rand -base64 32
```

Generate one value per secret row. Keep `SPARK_UI_API_KEY`,
`SPARK_BRIDGE_API_KEY`, and `TELEGRAM_RELAY_SECRET` different from each other,
then paste the matching value into both services where required.

Use `SPAWNER_UI_URL` for bot-to-Spawner traffic. `SPARK_SPAWNER_URL` is accepted
as a legacy alias, but new setup should stay on `SPAWNER_UI_URL`.

Do not set Spark Pro connection tokens for the current VPS flow. Those tokens
are paused and only belong in explicit internal compatibility checks.

## Preflight

After containers start, run:

```bash
node scripts/check-deploy-pair.mjs --spawner-env ./spawner.vps.env --bot-env ./bot.vps.env
docker compose exec spawner-ui node scripts/deploy-doctor.mjs --role spawner
docker compose exec spark-telegram-bot node scripts/deploy-doctor.mjs --role bot
docker compose exec spawner-ui node scripts/health-spark.mjs
docker compose exec spark-telegram-bot node scripts/run-health-runtime.cjs
```

Then send `/diagnose` to the Telegram bot. A healthy VPS should show the relay
reachable, Spawner reachable, and public Spawner links using the HTTPS public
domain rather than the private Docker hostname.

## Backup And Restore

Back up before upgrades:

```bash
docker compose stop spawner-ui spark-telegram-bot
docker run --rm -v spark-data:/data -v "$PWD/backups:/backup" alpine \
  tar czf /backup/spark-data-$(date +%Y%m%d-%H%M%S).tgz -C /data .
docker compose up -d
```

Restore into a fresh volume:

```bash
docker compose down
docker volume rm <project>_spark-data
docker volume create <project>_spark-data
docker run --rm -v <project>_spark-data:/data -v "$PWD/backups:/backup" alpine \
  tar xzf /backup/<backup-file>.tgz -C /data
docker compose up -d
```

After restore, run the preflight again and send `/diagnose`.

## Upgrade Rule

Before changing images, env, domains, or providers:

1. Take a `/data` backup.
2. Save `docker compose config` output.
3. Upgrade one service at a time.
4. Run deploy doctor and `/diagnose`.
5. Roll back by restoring the previous image/env and, if state changed, the
   latest known-good `/data` backup.
