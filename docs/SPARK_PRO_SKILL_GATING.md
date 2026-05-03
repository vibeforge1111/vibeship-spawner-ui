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
