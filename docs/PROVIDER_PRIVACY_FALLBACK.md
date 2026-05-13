# Provider Privacy Hardening Fallback

Status: release fallback runbook  
Owner: Spawner  
Last updated: 2026-05-13

## Purpose

Spawner now keeps mission-provider results metadata-only by default. Raw provider prompts and raw provider outputs must not enter `mission-provider-results.json`, Mission Control traces, Spark OS read models, Cockpit, Telegram final-answer metadata, or support artifacts.

This runbook defines the fallback path if that privacy hardening makes a local investigation harder or if a release needs to be rolled back.

## Default Behavior

- Raw provider prompts are not persisted by default.
- Raw provider outputs are not persisted by default.
- Mission results expose only metadata such as presence, length, redaction status, project path, preview URL, changed file count, duration, and token usage.
- Provider output that is present is represented as `response: null` plus `responsePresent: true` and `responseRedacted: true`.

## Local Private Debug Fallback

Use only on a trusted local machine for short debugging windows.

```powershell
$env:SPARK_SPAWNER_RETAIN_RAW_PROVIDER_PROMPTS = "1"
$env:SPARK_SPAWNER_RETAIN_RAW_PROVIDER_OUTPUT = "1"
```

With those flags:

- raw provider prompts are written under the configured Spawner state root `prompts-private/`
- raw provider outputs are written under the configured Spawner state root `provider-output-private/`
- metadata receipts are written under `prompt-metadata/` and `provider-output-metadata/`
- public mission result snapshots still remain redacted

Turn the fallback off after the debugging run:

```powershell
Remove-Item Env:\SPARK_SPAWNER_RETAIN_RAW_PROVIDER_PROMPTS -ErrorAction SilentlyContinue
Remove-Item Env:\SPARK_SPAWNER_RETAIN_RAW_PROVIDER_OUTPUT -ErrorAction SilentlyContinue
```

Do not copy private archive folders into support bundles, Cockpit projections, release artifacts, installer metadata, docs, or public traces.

## Release Rollback Fallback

Until the hardened Spawner commit is intentionally repinned through `spark-cli`, the public installer remains pinned to the previous Spawner release ref. If the hardened local runtime behaves badly before publication, keep the public registry pin unchanged and revert the local release-source branch by a named follow-up patch.

After publication, rollback is registry-first:

1. repin Spawner to the previous known-good release ref
2. regenerate installer manifest/checksums
3. run registry, provenance, installer, onboarding, and OS compile verification
4. publish hosted installer metadata only after the rollback gate passes

Do not restore raw output persistence as a public default to make a release pass.

## Verification

Run the focused fallback/privacy tests:

```bash
npm test -- --run src/lib/server/provider-private-archives.test.ts src/lib/server/provider-runtime.spark-agent.test.ts src/lib/server/mission-control-results.test.ts src/routes/api/spark-agent/spark-agent.integration.test.ts
```

Run broader Spawner checks before promotion:

```bash
npm run check
npm test -- --run
npm run build
```

Privacy scan expectation:

- no raw provider output in `mission-provider-results.json`
- no raw prompt text in default state
- private archive folders exist only when the explicit fallback flags are set
- Cockpit/read-model artifacts never read from `prompts-private/` or `provider-output-private/`
