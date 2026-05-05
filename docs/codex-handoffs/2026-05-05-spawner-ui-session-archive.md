# Spawner UI Session Archive Handoff

Date: 2026-05-05

## Repo, Path, Branch

- Repo path: `C:\Users\USER\.spark\modules\spawner-ui\source`
- Branch in this checkout: `main`
- Remote: `origin` -> `https://github.com/vibeforge1111/vibeship-spawner-ui`
- Current local git state at archive time:
  - `main...origin/main [ahead 1, behind 8]`
  - The local ahead commit is a duplicate doc note: `ffe9bc4 docs: note hosted spawner dirty tree handoff`
  - `origin/main` already has the equivalent pushed doc note as `57e3b12 docs: note hosted spawner dirty tree handoff`
  - Do not force push. Reconcile carefully in the next session.
- Existing handoff docs:
  - `docs/codex-handoffs/2026-05-04-spawner-ui-mission-control.md`
  - `docs/codex-handoffs/2026-05-05-hosted-spawner-security-next-steps.md`
  - this document

## Current Goal

Spawner UI is being shaped into a polished, trustworthy control surface for Spark/Spawner missions.

The latest priority is security for hosted Spawner:

- public landing can be visible,
- hosted Canvas/Kanban/Trace/Skills/Settings/Missions must stay locked,
- control APIs must stay locked,
- users must eventually feel clearly inside their own private workspace,
- hosted UI must not silently connect to or command a user's local machine.

## What We Already Completed

### UI And Product Polish

- Kanban cards were simplified and made more readable:
  - removed repeated "Mission Control" labels from logs/cards,
  - reduced noisy status labels,
  - made card click go to mission detail,
  - kept Canvas button as the specific Canvas target,
  - improved task count/progress display,
  - changed done column language toward completed/completion,
  - improved date placement and card visual hierarchy.

- Mission detail pages were upgraded:
  - better progress treatment,
  - completed/status badge polish,
  - action buttons moved into a cleaner right-side grid,
  - task/progress metrics made more visible,
  - execution output sections made easier to scan.

- Execution panel was condensed and cleaned:
  - moved workflow progress to a top-middle live panel instead of bottom-left/minimap collision,
  - made the execution panel more compact for smaller screens,
  - improved running/pause/cancel visual states,
  - reduced repeated mission ID labels,
  - moved mission ID lower where it is less distracting,
  - made "Skill at work" more prominent and chunkier,
  - made provider-running state greener and clearer,
  - improved task/done/active/queued/failed counters.

- Canvas nodes and graph were polished:
  - larger but then tuned-down connection dots,
  - better line/circle alignment,
  - removed unnecessary `PROJ` caps label,
  - moved status tags near the skill/upper-right area,
  - improved skill tag density,
  - added hover/expand behavior for hidden skills,
  - made hidden-skill popover easier to move into and scroll,
  - improved minimap styling, border, rounding, and zoom-out feel,
  - moved canvas background lighter/greyer to match Spark Swarm style.

- Skill search palette was ported and improved:
  - header search was removed where it looked awkward,
  - search modal/palette style was brought closer to Spark Swarm,
  - category and recommendation details added,
  - description readability improved,
  - category icons diversified,
  - name-match tags moved/reworked so they do not obscure descriptions,
  - scan animation slowed and made less visually noisy.

### Hosted Security And Release Gate

- Public hosted Spawner is locked by default when hosted signals are present.
- App routes return `503` when private preview is not configured.
- Control APIs return `503` under public lock.
- Root route shows a locked public shell instead of app navigation.
- Security headers are present on hosted responses:
  - `X-Frame-Options: DENY`
  - CSP frame guard with `frame-ancestors 'none'`
- Private preview browser auth no longer stores raw API keys in cookies.
- Private preview auth now creates opaque server-side `spawner_ui_session` cookies.
- Legacy raw cookies are deleted on auth.
- Hosted state is scoped by workspace under `<SPAWNER_STATE_DIR>/workspaces/<workspace-id>/`.
- Local dev behavior remains unchanged.

### Deployment

- Railway service was identified and linked:
  - project: `attractive-light`
  - environment: `production`
  - service: `spawner-ui`
  - domain: `https://spawner.sparkswarm.ai`
- Current latest Railway deployment at archive time:
  - `d29eacd5-6a33-4b1f-85fd-7bd57a2abc61`
  - status: `SUCCESS`
  - timestamp: `2026-05-05 01:39:12 +04:00`
- Hosted lock smoke passed after this latest deployment.

## Key Commits

Security and hosted lock commits:

```text
57e3b12 docs: note hosted spawner dirty tree handoff
d225b97 Gate Pro skill content with Spark entitlements
55dd9b8 Merge pull request #21 from vibeforge1111/codex/launch-hosted-preview
64bc74b Sync Spark skill tiers into Spawner
c55a2e9 Document hosted private preview envs
e0c4c83 Prepare hosted preview launch path
ca6d4a1 docs: add hosted spawner security handoff
e22670f Scope hosted spawner state by workspace
d20ed1c Use server-side hosted preview sessions
cc01329 Harden hosted spawner release gate
c6d4735 Add hosted spawner public lock shell
ed09e10 Keep hosted spawner app surfaces locked
42d9224 Lock hosted spawner behind private preview gate
```

Note: local checkout also has `ffe9bc4`, a duplicate of the pushed doc note. Do not force push it.

## Files Touched Or Investigated

### Security/Auth/Hosted Runtime

- `src/hooks.server.ts`
- `src/lib/server/hosted-ui-auth.ts`
- `src/lib/server/hosted-ui-auth.test.ts`
- `src/lib/server/mcp-auth.ts`
- `src/lib/server/spawner-state.ts`
- `src/lib/server/spawner-state.test.ts`
- `src/lib/server/hosted-setup-status.ts`
- `src/routes/spark-live/login/+page.server.ts`
- `src/routes/spark-live/login/+page.svelte`
- `docs/HOSTED_SPAWNER_SECURITY_RELEASE_PROCESS.md`
- `docs/HOSTED_SPAWNER_PRIVATE_PREVIEW.md`

### Hosted State Scoping

- `src/routes/api/events/+server.ts`
- `src/routes/api/pipeline-loader/+server.ts`
- `src/routes/api/mission/active/+server.ts`
- `src/routes/api/prd-bridge/write/+server.ts`
- `src/routes/api/prd-bridge/load-to-canvas/+server.ts`
- `src/routes/api/prd-bridge/result/+server.ts`
- `src/routes/api/prd-bridge/pending/+server.ts`
- `src/lib/server/mission-control-trace.ts`
- `src/lib/server/mission-control-relay.ts`
- `src/lib/server/provider-runtime.ts`
- `src/lib/server/creator-mission.ts`
- `src/lib/server/mission-control-command.ts`
- `src/lib/server/scheduler.ts`
- `src/lib/server/provider-clients/codex-cli-client.ts`

### Mission/Kanban/Execution/Canvas UI

- `src/lib/components/MissionBoard.svelte`
- `src/lib/components/ExecutionPanel.svelte`
- `src/routes/missions/[id]/+page.svelte`
- `src/routes/kanban/+page.svelte`
- `src/routes/canvas/+page.svelte`
- `src/lib/components/nodes/SkillNode.svelte`
- `src/lib/components/nodes/DraggableNode.svelte`
- `src/lib/components/ConnectionLine.svelte`
- `src/lib/components/Minimap.svelte`
- `src/lib/components/SkillSearchPalette.svelte`
- `src/lib/components/SkillsPanel.svelte`
- `src/lib/components/Navbar.svelte`
- `src/lib/components/PublicSpawnerPreview.svelte`
- `src/lib/components/Welcome.svelte`
- `src/lib/components/Footer.svelte`

### Skill Tiers / Pro Entitlements Work Seen At Archive Time

These files had local modifications or new files at archive time. They overlap with remote commits that landed after the handoff work, so inspect carefully before editing:

- `src/lib/server/claude-auto-analysis.ts`
- `src/lib/server/mission-control-relay.ts`
- `src/lib/server/mission-control-results.ts`
- `src/lib/server/provider-clients/codex-cli-client.ts`
- `src/lib/server/provider-runtime.ts`
- `src/lib/server/skill-tiers.ts`
- `src/lib/services/mission-board-cards.ts`
- `src/routes/api/h70-skills/[skillId]/+server.ts`
- `src/routes/api/prd-bridge/load-to-canvas/+server.ts`
- `src/routes/api/prd-bridge/write/+server.ts`
- `src/routes/api/spark/run/+server.ts`
- `static/bundles/mobile-app-launch.yaml`
- `static/skills.json`
- `src/lib/server/spark-pro-entitlements.ts`
- `static/skill-tiers.json`

## Commands And Tests Already Run

Local tests and checks:

```powershell
npm run test:run -- src/lib/server/hosted-ui-auth.test.ts src/routes/api/events/events.auth.test.ts
npm run test:run -- src/lib/server/spawner-state.test.ts src/lib/server/hosted-ui-auth.test.ts src/routes/api/prd-bridge/write/write.integration.test.ts src/routes/api/prd-bridge/load-to-canvas/load-to-canvas.integration.test.ts src/routes/api/pipeline-loader/pipeline-loader.integration.test.ts src/routes/api/mission/active/active-mission.integration.test.ts src/lib/server/mission-control-trace.test.ts src/lib/server/mission-control-relay.test.ts src/lib/server/provider-runtime.spark-agent.test.ts src/lib/server/creator-mission.test.ts
npm run test:run
npm run check
npm run build
npm run smoke:hosted-lock
```

Full test result from the security slice:

```text
80 test files passed
456 tests passed
```

Hosted verification:

```powershell
$env:SPARK_HOSTED_LOCK_BASE_URL='https://spawner.sparkswarm.ai'
npm run smoke:hosted-lock
Remove-Item Env:\SPARK_HOSTED_LOCK_BASE_URL
```

Latest result:

```text
hosted-lock smoke passed
```

Live route verification after lock deployment:

```text
/ => 200, CSP present, X-Frame-Options=DENY, lock shell visible
/canvas => 503, CSP present, X-Frame-Options=DENY
/kanban => 503, CSP present, X-Frame-Options=DENY
/trace => 503, CSP present, X-Frame-Options=DENY
/skills => 503, CSP present, X-Frame-Options=DENY
/settings => 503, CSP present, X-Frame-Options=DENY
/api/mission-control/board => 503
/api/prd-bridge/pending => 503
```

Railway commands:

```powershell
railway whoami
railway list --json
railway link --project f3e387e7-d58b-4f2e-ad23-7ee82503c527 --service 9274b08b-20ac-4adc-9919-7c2167591e15 --environment e9c3bf0d-37b6-47ef-b4fb-0b14d2c43489
railway status
railway variables --json
railway up --detach
railway deployment list --service spawner-ui
```

## Known Errors, Warnings, Or Failing Checks

- Before redeploy, live `/canvas` and `/kanban` were public. This is fixed and verified.
- `railway status` initially failed because the checkout was not linked. It is now linked.
- A push of local doc commit `ffe9bc4` was rejected because `origin/main` moved forward. The same doc note was then pushed safely through a clean temporary worktree as `57e3b12`.
- Current local checkout is dirty and divergent:
  - `ahead 1, behind 8`
  - several tracked files modified,
  - many untracked screenshots,
  - two untracked Spark Pro files.
- Full test suite had existing non-fatal warning noise:
  - malformed local `.spawner/mission-provider-results.json`,
  - PRD bridge mocked webhook relay warnings.
- No current hosted lock failure is known. Latest hosted smoke passed.

## Open Decisions

1. Durable account and session storage:
   - Current private-preview session store is in-memory.
   - Before public unlock, choose a durable store for accounts, sessions, workspaces, devices, and audit events.

2. Account/workspace UX:
   - Decide whether to use Spark Swarm login, workspace ID + password, magic link, or another access flow.
   - The first screen before Canvas/Kanban should make the user feel they are entering their own private workspace.

3. Local agent pairing:
   - Hosted UI must not imply that it is connected to the user's machine unless explicit pairing happened.
   - Need device names, pairing codes/tokens, last-seen state, and revoke controls.

4. Elevated command authority:
   - Running, improving, dispatching, pausing, canceling, MCP calls, and local worker actions need stronger protection than normal browsing.
   - Decide between step-up auth, short-lived command tokens, local approval prompts, or a combination.

5. Audit trail:
   - Need a user-readable log of security-relevant events.
   - Minimum events: login, logout/session expiry, pairing, revocation, command requested, command approved/denied, local agent connected/disconnected.

6. Public unlock threshold:
   - Keep public hosted app surfaces locked until the account, workspace, pairing, command, and audit model has adversarial tests.

7. Dirty local checkout reconciliation:
   - Decide whether to reset/sync current local `main` to `origin/main`, preserve the local dirty work, or create a branch for the dirty Spark Pro changes.
   - Do not force push.

## Constraints, User Preferences, And Do-Not-Touch Areas

- Commit often, with focused commits.
- Do not revert user/background changes without explicit permission.
- Do not stage or delete screenshot artifacts unless the user asks.
- Do not public-release hosted Canvas/Kanban/Trace/Skills/Settings/Missions yet.
- Landing/marketing shell can stay visible.
- Private Railway/VPS owner installs should remain possible.
- Preserve local Spawner workflows.
- Do not set `SPARK_HOSTED_PRIVATE_PREVIEW=1` on the public hosted deployment unless intentionally running a trusted private preview.
- Do not store raw API keys in browser cookies or localStorage.
- Do not allow wildcard public origins.
- Do not allow hosted browser sessions to execute local-machine commands without explicit pairing and approval.
- UI taste preferences from this session:
  - readable, calmer, less corporate,
  - less repeated labels,
  - avoid noisy status badges,
  - make progress/action states feel alive but clean,
  - use rounded but not overly pill-shaped components,
  - make dense surfaces clearer rather than bigger for its own sake.

## Next 3-7 Concrete Steps

1. Reconcile the local checkout safely:
   - Run `git status -sb`.
   - Compare local dirty files with `origin/main`.
   - Do not force push.
   - Decide whether to branch dirty work, stash it, or reset only with explicit user approval.

2. Re-verify hosted lock:
   - Run the hosted smoke against `https://spawner.sparkswarm.ai`.
   - Confirm app routes and APIs still return locked responses.

3. Define the durable security model:
   - account,
   - workspace,
   - user,
   - session,
   - device/local-agent pairing,
   - command authority,
   - audit event.

4. Implement the smallest durable foundation:
   - typed contracts,
   - server helpers,
   - unit tests,
   - no public unlock yet.

5. Build the locked account shell:
   - before Canvas/Kanban/Trace/Skills/Settings,
   - clearly communicate private workspace status,
   - clearly say whether a local machine is connected.

6. Add elevated command protection:
   - normal browsing session can view allowed surfaces,
   - run/improve/pause/cancel/dispatch/MCP/local worker actions require explicit elevated authority.

7. Add adversarial tests before release:
   - unauthorized app route,
   - unauthorized API route,
   - cross-site POST,
   - expired session,
   - workspace isolation,
   - unpaired local agent,
   - command attempt without approval,
   - revoked pairing.

## Reactivation Prompt

Paste this into a fresh Codex chat:

```text
We are continuing Spawner UI work in:
C:\Users\USER\.spark\modules\spawner-ui\source

Start by reading:
docs/codex-handoffs/2026-05-05-spawner-ui-session-archive.md
docs/codex-handoffs/2026-05-05-hosted-spawner-security-next-steps.md
docs/HOSTED_SPAWNER_SECURITY_RELEASE_PROCESS.md
docs/HOSTED_SPAWNER_PRIVATE_PREVIEW.md

Important current state:
- Branch is main.
- The local checkout may be dirty and divergent from origin/main.
- At archive time it was main...origin/main [ahead 1, behind 8].
- Do not force push.
- Do not reset or revert local changes without explicit user approval.
- There are many untracked screenshot artifacts; leave them alone unless asked.
- Hosted domain is https://spawner.sparkswarm.ai.
- Railway is linked to attractive-light / production / spawner-ui.
- Latest seen Railway deployment was d29eacd5-6a33-4b1f-85fd-7bd57a2abc61 and hosted-lock smoke passed.

Current product/security goal:
Keep hosted Spawner publicly locked while implementing a trustworthy account/workspace/local-agent security model. Landing can be visible, but Canvas/Kanban/Trace/Skills/Settings/Missions and control APIs must not become publicly usable yet.

First actions:
1. Run git status -sb.
2. Inspect divergence with:
   git log --oneline --left-right --decorate main...origin/main
3. Do not force push.
4. Re-run hosted lock smoke:
   $env:SPARK_HOSTED_LOCK_BASE_URL='https://spawner.sparkswarm.ai'; npm run smoke:hosted-lock; Remove-Item Env:\SPARK_HOSTED_LOCK_BASE_URL
5. Inspect these security files before editing:
   src/hooks.server.ts
   src/lib/server/hosted-ui-auth.ts
   src/lib/server/mcp-auth.ts
   src/lib/server/spawner-state.ts
   src/lib/server/hosted-setup-status.ts

Recommended next implementation slice:
Safely reconcile the local checkout, then define and implement the smallest durable security foundation:
- account/workspace/session/device/pairing/audit contracts,
- server helpers and tests,
- no public unlock,
- no local command authority without explicit pairing and elevated approval.
```
