# Spark Harness Contract Adoption

Status: planned for Milestone 0.2

## Role Of This Repo

`spawner-ui` is the mission and provider execution surface.

Spawner should:

- parse `TurnIntentEnvelopeV1`
- reject execution without a matching envelope verdict
- treat `autoRun` as a request flag, not authority
- bind mission execution, PRD write/load, Canvas execution, creator mission execution, and publish flows to tool policy
- record trace and evidence refs on missions

Spawner should not:

- launch from raw words
- treat Builder payloads as authority without the envelope
- publish or deploy when `noPublish` or `localOnly` is active
- execute stale pending state from another session scope

## Shared Source Of Truth

The proposed shared private contract repo is:

`/Users/alchemistab/Documents/Codex/2026-05-30/we-have-been-working-on-achieving/work/spark-harness-contracts`

Remote:

`https://github.com/vibeforge1111/spark-harness-contracts`

## First Spawner Slice

Bind one endpoint first:

- parse inbound envelope
- validate schema
- authorize `spawner.run`
- reject missing envelope in test mode
- add an evidence field to the mission record

Recommended first endpoint:

- `src/routes/api/spark/run/+server.ts`

Acceptance:

- explicit no-edit probe still runs when authorized
- no-action prompts cannot launch
- `autoRun` alone cannot launch
- local-only canary cannot publish
