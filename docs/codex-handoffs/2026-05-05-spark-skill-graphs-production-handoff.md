# Spark Skill Graphs Production Handoff

Date: 2026-05-05

## Repo, Paths, And Branches

Primary handoff repo:

- Repo: `spawner-ui`
- Path: `C:\Users\USER\Desktop\spawner-ui`
- Current local branch: `codex/launch-hosted-preview`
- Current local HEAD: `5adee00 Add Spark Pro gating smoke`
- `origin/main`: `770ae41` from merged PR #23
- Note: local checkout remains on `codex/launch-hosted-preview`; `main` was in use by another local worktree during the session, so do not assume branch name equals production source. The tree has been merged to `origin/main`.

Related repos used in this session:

- Repo: `spark-skill-graphs`
- Path: `C:\Users\USER\Desktop\spark-skill-graphs`
- Branch: `main`
- HEAD: `20daf76 Prepare hosted MCP auth smoke`

- Repo: `spark-pro-systems`
- Path: `C:\Users\USER\Desktop\spark-pro-systems`
- Branch: `master`
- HEAD: `6075473 polish: rebalance payment access rails`

Production services touched or verified:

- Spawner UI Railway: `attractive-light / production / spawner-ui`
- Spawner custom domain: `https://spawner.sparkswarm.ai`
- Spawner Railway service id: `9274b08b-20ac-4adc-9919-7c2167591e15`
- Spawner latest deployed runtime: `d29eacd5-6a33-4b1f-85fd-7bd57a2abc61`
- Spark Pro production: `https://pro.sparkswarm.ai`
- Spark Skill Graphs hosted MCP: `https://mcp.sparkswarm.ai/skill-graphs/mcp`

## Current Goal

Get Spark Skill Graphs, Spawner UI, and Spark Pro production integration ready for real MCP and product testing:

- Spark Skill Graphs should expose the full 656-skill Pro corpus and the 30-skill free tier correctly.
- Hosted MCP should require Spark Pro member proof and initialize successfully for a real member.
- Spawner should not leak Pro skill bodies to free users.
- Spark Pro should enforce Pro/free drop entitlements across downloads, hosted tools, CLI, R2 packages, and MCP proof.
- Public hosted Spawner should remain landing-only locked until the public account/workspace model exists.
- Design and dashboard work should stay aligned with the Spawner/domain-chip family.

## Completed

Spark Skill Graphs:

- Integrated the expanded operational skill corpus.
- Preserved curated `pairs_with` relationships in the portable manifest/export/schema path.
- Added matcher eval prompts covering new operational categories.
- Regenerated manifests and eval output.
- Verified final tier shape:
  - `open_source`: 30
  - `full_pro_access`: 656
  - `pro_exclusive`: 626
- Verified hosted MCP:
  - health returns 656 skills and 41 categories
  - OAuth protected resource metadata advertises `drop.skills`
  - anonymous initialize returns a discoverable 401 challenge
  - real Spark Pro member initialize passes with server `spark-skills-graph` version `2.0.0`

Spawner UI:

- Synced Spark skill tiers into Spawner.
- Fixed Pro skill content leakage:
  - free/open-source skills load without Spark Pro proof
  - Pro skills require Spark Pro member proof
  - missing/invalid proof returns 401
  - insufficient entitlement returns 403
  - entitlement service outage returns 503
- Added Spark Pro entitlement verification helper.
- Added route gating tests for free skill, Pro missing proof, Pro HEAD, and Pro entitled access.
- Changed unknown/missing tier default to `base` instead of `pro` for safer production behavior.
- Added executable runbook smoke: `npm run smoke:spark-pro-gating`.
- Verified the smoke with a real production Spark Pro acceptance token without printing the token.
- Deployed Spawner UI to Railway production:
  - deploy id: `d29eacd5-6a33-4b1f-85fd-7bd57a2abc61`
  - health: `/api/health/live` returns 200
  - hosted lock smoke passes
- Merged Spawner PRs:
  - #22 `Gate Pro skill content with Spark entitlements`, merge commit `d225b97936a09e59a0dc9a5d1538bb0abf7a076a`
  - #23 `Add Spark Pro gating smoke`, merge commit `770ae417be96d1b866d2ba57801d96f7274e72e8`

Spark Pro:

- Verified auth accepts `spark_pro_session` cookie or `Authorization: Bearer`.
- Verified feature contract:
  - Pro feature list includes `spark_pro`, `drop.skills`, `drop.mutations`, `tool.xcontent`, `future_drops`.
  - `skill-graphs` requires `spark_pro` and `drop.skills`.
  - `agent-mutations-crypto` requires `spark_pro` and `drop.mutations`.
  - `x-content-engine` requires `spark_pro` and `tool.xcontent`.
- Verified current delivery path is R2 signed package downloads, not per-member GitHub repos.
- Ran production DB, R2, launch, ops, acceptance, CLI, and entitlement checks.
- Verified production acceptance:
  - Pro member sees all three drops as available.
  - Free member sees all three drops as locked.
  - Free install is denied.
  - Pro `skill-graphs` install returns signed URL.
  - R2 download succeeds and SHA-256 matches.
  - Activation returns active.
- Verified full launch drop matrix with temporary Pro grant:
  - `skill-graphs`: package download and activation OK.
  - `agent-mutations-crypto`: package download and activation OK.
  - `x-content-engine`: hosted tool unlock OK.
  - CLI device start, approve, poll, status, drops list, install skills, install mutations, install x-content all OK.

## Files Touched

Spawner UI:

- `package.json`
  - Added `smoke:spark-pro-gating`.
- `scripts/smoke-spark-pro-gating.mjs`
  - New smoke test for free skill access, Pro missing proof, Pro invalid proof, Pro HEAD, and Pro success with bearer token.
- `src/lib/server/skill-tiers.ts`
  - Earlier session change: unknown or missing tier falls back to `base`.
- `src/lib/server/skill-tiers.test.ts`
  - Updated tier fallback expectation.
- `src/lib/server/spark-pro-entitlements.ts`
  - New helper for Spark Pro bearer/cookie proof and entitlement checks.
- `src/lib/server/spark-pro-entitlements.test.ts`
  - Tests bearer/cookie extraction and entitlement outcomes.
- `src/lib/server/h70-skills-route-gating.test.ts`
  - Tests free and Pro route gates.
- `src/lib/server/prd-auto-dispatch.test.ts`
  - Updated fixture to make Pro tier explicit.
- `src/routes/api/h70-skills/[skillId]/+server.ts`
  - Added Spark Pro gating to GET and HEAD.
- `scripts/sync-runtime.cjs`
  - Included new entitlement helper in runtime sync.

Spark Skill Graphs:

- Manifest/export/schema/eval files were updated before this handoff.
- Important repo state is in commits through `20daf76`.
- Files investigated and verified include:
  - `tools/mcp-hosted-smoke.mjs`
  - tier validation tooling
  - MCP HTTP smoke tooling
  - generated manifest/eval outputs

Spark Pro:

- No new source changes in the last pass.
- Files investigated:
  - `server/auth.mjs`
  - `server/member-service.mjs`
  - `server/r2.mjs`
  - `scripts/check-access-invariants.mjs`
  - `scripts/check-r2-production.mjs`
  - `scripts/check-launch-readiness.mjs`
  - `scripts/check-ops-health.mjs`
  - `scripts/run-production-acceptance.mjs`
  - `scripts/check-launch-drop-flows.mjs`
  - `scripts/check-entitlement-contract.mjs`
  - `scripts/check-cli-compatibility.mjs`

## Commands And Checks Run

Spawner UI local:

```powershell
npm run build
npm run check
npm run test:run -- src/lib/server/spark-pro-entitlements.test.ts src/lib/server/h70-skills-route-gating.test.ts
npm run test:run -- src/lib/server/skill-tiers.test.ts src/lib/server/spark-pro-entitlements.test.ts src/lib/server/h70-skills-route-gating.test.ts src/lib/server/prd-auto-dispatch.test.ts
npm run smoke:spark-skill-tiers
npm run smoke:hosted-lock
npm run smoke:spark-pro-gating
npm run sync:runtime
npm run sync:check
git diff --check
```

Spawner UI production/Railway:

```powershell
railway link --project f3e387e7-d58b-4f2e-ad23-7ee82503c527 --environment e9c3bf0d-37b6-47ef-b4fb-0b14d2c43489 --service 9274b08b-20ac-4adc-9919-7c2167591e15
railway up --detach
railway deployment list --service spawner-ui --json
railway service status --json
```

Important live checks:

```powershell
$env:SPARK_HOSTED_LOCK_BASE_URL='https://spawner.sparkswarm.ai'; npm run smoke:hosted-lock; Remove-Item Env:\SPARK_HOSTED_LOCK_BASE_URL
```

Live Spawner status after deploy:

- `/` returns 200.
- `/api/health/live` returns 200 and `{"ok":true,"service":"spawner-ui"}`.
- `/canvas`, `/api/h70-skills/frontend-engineer`, and `/api/h70-skills/usage-metering-entitlements` return 503 while public hosted lock is active.

Spark Skill Graphs:

```powershell
npm run validate:tiers
npm run mcp:http-smoke
npm run mcp:hosted-smoke
npm run validate:all
npm run test:unit
npm run pack:dry
npm run eval:check
```

Spark Pro:

```powershell
npm run check
npm run compat:cli
npm run entitlements:contract -- --self-test
railway run npm run access:check
railway run npm run r2:check
railway run npm run ops:health
railway run npm run launch:check
railway run npm run production:preflight
railway run npm run acceptance:production
railway run node scripts/check-launch-drop-flows.mjs --confirm-write --grant-pro
```

Live Spark Pro checks:

```powershell
node -e "const urls=['https://pro.sparkswarm.ai/api/health','https://pro.sparkswarm.ai/api/member/entitlements']; (async()=>{for(const u of urls){const r=await fetch(u,{redirect:'manual'}); const text=await r.text(); console.log(u, r.status, text.slice(0,240).replace(/\s+/g,' '));}})().catch(e=>{console.error(e); process.exit(1);})"
```

Real member MCP smoke was run by minting a short-lived acceptance session with Railway env and passing it to `npm run mcp:hosted-smoke` without printing the token.

## Known Errors, Warnings, And Non-Blocking Issues

- Public Spawner is intentionally locked for all app/API surfaces except `/` and `/api/health/live`.
  - This is by design per `docs/HOSTED_SPAWNER_SECURITY_RELEASE_PROCESS.md`.
  - Do not set `SPARK_HOSTED_PRIVATE_PREVIEW=1` on public `spawner.sparkswarm.ai` unless intentionally running a trusted owner-only preview.
- `gh pr checks` reported no GitHub checks for PR #22 or #23.
  - Local checks were run manually and passed.
- `git switch main` in `spawner-ui` failed earlier because `main` is already used by another worktree at `C:\Users\USER\AppData\Local\Temp\spawner-hosted-local-provider-diagnose`.
  - This is a local worktree constraint, not a repo failure.
- `git diff --check` emitted CRLF normalization warnings for files touched on Windows.
  - No whitespace errors were reported.
- Spark Skill Graphs still has known dangling delegate refs as warnings, not failures.
  - Last known count: 118.
- Spark Pro launch readiness notes:
  - Paid x402 Base mainnet testing is intentionally deferred.
  - Stripe subscriptions are implemented but not part of the current launch gate.
  - Ops health shows one open risk event in `watch` state, but status remains OK.
- Spawner public route-level Spark Pro gating cannot be observed on `spawner.sparkswarm.ai` while the global hosted lock is active.
  - Gating is verified locally with production token via `npm run smoke:spark-pro-gating`.
  - Hosted lock is verified live via `npm run smoke:hosted-lock`.

## Open Decisions

- When to move Spawner from public landing-only lock to a real public account system.
  - Current answer: not yet. The release process requires durable accounts, workspace isolation, per-route authorization, CSRF hardening, audit trail, and local-worker approval.
- Whether to enable a trusted private preview on `spawner.sparkswarm.ai` or keep that domain public locked and use a separate owner-only URL.
- Whether any of the 30 free/open-source Spark skills should change before launch.
  - Current tier shape is 30 free, 626 Pro-exclusive.
- Whether to reduce the remaining Spark Skill Graphs dangling delegate refs before broader MCP testing.
- Whether to add CI for the Spawner smoke/check scripts so PRs no longer show "no checks reported."
- Whether to deploy PR #23 to Railway.
  - Runtime app code did not change; only test tooling changed, so no redeploy was done after PR #23.

## Constraints, Preferences, And Do-Not-Touch Areas

- User wants the products to feel like one design family across Spark Skill Graphs, Spawner UI, and domain-chip-xcontent.
- Use Spawner/domain-chip component and color language rather than introducing new one-off visual styles.
- Avoid green left-edge accents on components unless the component system explicitly calls for them.
- Do not show the hidden graph legend UI that was removed earlier:
  - "Legend"
  - "Focus - currently selected"
  - "Active - recent use"
  - "In use this session"
  - "Idle"
  - "Unpaired skill"
- Public Spawner should not expose Canvas, Kanban, Mission Control, preview, setup/login, or API routes until the public account model is real.
- Do not print secrets, bearer tokens, Railway variables, R2 credentials, or session cookies.
- Prefer Railway `run` for production env checks that need secrets, and pipe/filter output so only non-sensitive status is shown.
- Do not force-push or reset branches.
- Do not revert user work or unrelated changes.
- Use `rg` for searches.
- Use `apply_patch` for file edits.
- Keep public/pro tier boundaries explicit and fail closed:
  - unknown tier should not accidentally become Pro-visible
  - Pro skill bodies require Spark Pro proof
  - free/open-source stays exactly 30 unless deliberately changed

## Next Steps

1. Decide whether to keep `spawner.sparkswarm.ai` public locked for the first MCP testing wave or create a separate trusted private preview URL.
2. If a private preview is wanted, configure a complete private preview only after choosing the hostname:
   - `SPARK_HOSTED_PRIVATE_PREVIEW=1`
   - `SPARK_WORKSPACE_ID=<private non-guessable slug>`
   - `SPARK_UI_API_KEY=<long random key>`
   - exact allowed hosts and bridge keys as required by the runbook.
3. Add CI for Spawner:
   - `npm run check`
   - focused Vitest route gating tests
   - `npm run smoke:spark-skill-tiers`
   - `npm run smoke:spark-pro-gating` with a safe mocked or CI-scoped token path
4. Add or run the next Spark Skill Graphs cleanup pass for the 118 dangling delegate refs.
5. Continue design family audit across Spark Skill Graphs, Spawner UI, and domain-chip-xcontent with screenshots and component-level diffs.
6. Start MCP testing in Claude Code with the real hosted server:
   - confirm MCP tools mount
   - confirm skill recommendations return relevant skills
   - confirm the server tells users they can track used skills with the localhost visualizer link
   - test free versus Pro behavior with and without Spark Pro proof
7. Before broader production announcement, rerun the full production checks listed above and record the fresh deploy/check ids.

## Reactivation Prompt

Paste this into a fresh Codex chat:

```text
Continue from this handoff:

Read `C:\Users\USER\Desktop\spawner-ui\docs\codex-handoffs\2026-05-05-spark-skill-graphs-production-handoff.md` first. Then inspect current git status in:

- `C:\Users\USER\Desktop\spawner-ui`
- `C:\Users\USER\Desktop\spark-skill-graphs`
- `C:\Users\USER\Desktop\spark-pro-systems`

Do not rely on old chat context. The goal is to continue production readiness and MCP testing for Spark Skill Graphs, Spawner UI, and Spark Pro.

Important state:

- Spawner PR #22 and #23 are merged to `origin/main`.
- Spawner production Railway service is `attractive-light / production / spawner-ui`.
- Latest deployed Spawner runtime is `d29eacd5-6a33-4b1f-85fd-7bd57a2abc61`.
- Public `https://spawner.sparkswarm.ai` is intentionally landing-only locked.
- Spark Skill Graphs tiers are expected to be 30 free/open-source, 656 full Pro, 626 Pro-exclusive.
- Hosted MCP is `https://mcp.sparkswarm.ai/skill-graphs/mcp`.
- Spark Pro production is `https://pro.sparkswarm.ai`.

First tasks:

1. Verify no repo has unexpected dirty changes.
2. Rerun the smallest relevant smoke checks before making changes.
3. If testing MCP in Claude Code, confirm the mounted server is the real hosted Spark Skill Graphs MCP and that real member initialize works.
4. Preserve the public Spawner hosted lock unless I explicitly ask to enable a trusted private preview.
5. Do not print secrets or bearer tokens.

Use `rg` for search, `apply_patch` for edits, and keep changes surgical.
```
