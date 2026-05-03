# Spark Pro Skill Gating

Spawner treats spark-skill-graphs as two tiers:

- Free foundation: the 30 skills marked `tier: "free"` in `static/skills.json`.
- Pro catalog: every synced skill, currently 613 skills.

The matcher defaults to the Pro catalog because that gives the best task-to-skill
result. Production access is enforced at the skill content boundary:

```text
GET  /api/h70-skills/:skillId
HEAD /api/h70-skills/:skillId
```

When `:skillId` is free, Spawner serves it without a Spark Pro check. When
`:skillId` is Pro and enforcement is enabled, Spawner forwards the incoming
`Cookie` and `Authorization` headers to Spark Pro:

```text
GET <SPARK_PRO_API_BASE_URL>/api/member/entitlements
```

Access is granted when the response includes either feature:

- `spark_pro`
- `drop.skills`

## Production Environment

Use these settings for hosted production:

```text
SPARK_PRO_API_BASE_URL=https://pro.sparkswarm.ai
SPAWNER_PRO_SKILL_ENFORCEMENT=enforce
```

`SPAWNER_SPARK_PRO_API_BASE_URL` can be used instead when Spawner needs a
different internal origin than the public Spark Pro site.

## Development Fallback

Without enforcement, Pro skills remain loadable for local development and
standalone testing. This is intentional so the open-source graph can be tested
without forcing a paid membership loop on every contributor.

Production should not rely on client-side labels alone. The catalog, Canvas UI,
execution prompts, and `/api/h70-skills/:skillId` route all need to agree on the
same free/Pro split.

## Live Smoke

Run this against a running Spawner instance before release:

```text
npm run smoke:spark-pro-gating
```

For a production gate with a real member session:

```text
SPAWNER_SMOKE_BASE_URL=https://agent.sparkswarm.ai \
SPARK_PRO_API_BASE_URL=https://pro.sparkswarm.ai \
SPAWNER_EXPECT_PRO_ENFORCEMENT=1 \
SPAWNER_REQUIRE_PRO_AUTH_SMOKE=1 \
SPARK_PRO_COOKIE="spark_pro_session=..." \
npm run smoke:spark-pro-gating
```

The smoke verifies that a free starter skill loads, a Pro skill fails closed
without member proof, the same Pro skill loads with member proof, and Spark Pro
returns either `spark_pro` or `drop.skills` from `/api/member/entitlements`.

## Cross-System Release Order

Run the gates in this order so failures point at the owning repo:

1. In `spark-pro-systems`, verify the member entitlement contract:
   `npm run entitlements:contract -- --bearer-token <member-token>`.
2. In `spark-skill-graphs`, verify hosted MCP auth behavior:
   `npm run mcp:http-smoke`.
3. In `spawner-ui`, verify free/Pro skill serving:
   `npm run smoke:spark-pro-gating`.

If step 1 fails, fix Spark Pro membership grants or sessions first. If step 2
fails, fix hosted MCP token validation. If step 3 fails after the first two pass,
fix Spawner's skill catalog sync or `/api/h70-skills/:skillId` gate.

## Hosted Spawner Deploy

This repo includes a Node Dockerfile and `railway.json`. Production environment
should include:

```text
NODE_ENV=production
SPAWNER_PRO_SKILL_ENFORCEMENT=enforce
SPARK_PRO_API_BASE_URL=https://pro.sparkswarm.ai
SPAWNER_SKILLS_JSON=/app/static/skills.json
```

The static catalog supports skill discovery and tier gating from the Spawner
image. If hosted Spawner must serve full YAML skill bodies, copy or mount the
`spark-skill-graphs` source into the container and set `SPAWNER_H70_SKILLS_DIR`
to that mounted path.

`agent.sparkswarm.ai` must point at this Spawner service, not the marketing site.
The release smoke intentionally fails when `/api/h70-skills/:skillId` returns
HTML instead of a skill JSON payload.
