# Hosted Spawner Security Next Steps Handoff

Date: 2026-05-05

## Repo

- Path: `C:\Users\USER\.spark\modules\spawner-ui\source`
- Branch: `main`
- Remote: `https://github.com/vibeforge1111/vibeship-spawner-ui`
- Railway project: `attractive-light`
- Railway environment: `production`
- Railway service: `spawner-ui`
- Hosted domain: `https://spawner.sparkswarm.ai`

## Current Goal

Keep the public hosted Spawner site safe while the full account, workspace, pairing, and command-authority model is designed and implemented.

The immediate public-host goal is complete: the landing page can remain visible, but Canvas, Kanban, Trace, Skills, Settings, Missions, and control APIs must not be usable by random visitors.

## Current Verified State

The public deployment is locked.

Verified after Railway deployment `bf197498-8d2d-41c7-9b0d-f74cae65a20d` reached `SUCCESS`:

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

`npm run smoke:hosted-lock` also passed against `https://spawner.sparkswarm.ai`.

## What Is Already Completed

- Public hosted release gate:
  - Hosted Spawner locks by default when it detects Railway/public-host signals.
  - Public app routes return `503` when private preview is not explicitly configured.
  - Public API routes return `503` under the same lock.
  - Root route shows the locked public preview shell instead of leaking app navigation.

- Hosted security headers:
  - `X-Frame-Options: DENY`
  - CSP frame guard with `frame-ancestors 'none'`

- Private preview auth hardening:
  - Browser auth no longer stores raw access keys in long-lived cookies.
  - Private preview login creates opaque server-side `spawner_ui_session` cookies.
  - Sessions have idle and absolute expiry.
  - Legacy raw cookies are deleted on auth.

- Hosted workspace state scoping:
  - Hosted state is scoped under `<SPAWNER_STATE_DIR>/workspaces/<workspace-id>/`.
  - Local dev behavior remains unchanged: local uses `SPAWNER_STATE_DIR` or `.spawner/`.

- Deployment wiring:
  - This checkout is now linked to Railway `attractive-light / production / spawner-ui`.
  - Current `main` was deployed with `railway up --detach`.

## Key Commits In Place

```text
e22670f Scope hosted spawner state by workspace
d20ed1c Use server-side hosted preview sessions
cc01329 Harden hosted spawner release gate
c6d4735 Add hosted spawner public lock shell
ed09e10 Keep hosted spawner app surfaces locked
42d9224 Lock hosted spawner behind private preview gate
```

## Files Touched Or Investigated

Security/auth/runtime files:

- `src/hooks.server.ts`
- `src/lib/server/hosted-ui-auth.ts`
- `src/lib/server/hosted-ui-auth.test.ts`
- `src/lib/server/mcp-auth.ts`
- `src/lib/server/spawner-state.ts`
- `src/lib/server/spawner-state.test.ts`
- `src/lib/server/hosted-setup-status.ts`
- `src/routes/spark-live/login/+page.server.ts`
- `src/routes/spark-live/login/+page.svelte`

State scoping call sites:

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

Docs:

- `docs/HOSTED_SPAWNER_SECURITY_RELEASE_PROCESS.md`
- `docs/HOSTED_SPAWNER_PRIVATE_PREVIEW.md`
- `docs/codex-handoffs/2026-05-04-spawner-ui-mission-control.md`

Deployment/config:

- `Dockerfile`
- `package.json`
- `svelte.config.js`
- Railway project variables for `attractive-light / production / spawner-ui`

## Commands And Tests Already Run

Local checks:

```powershell
npm run test:run -- src/lib/server/hosted-ui-auth.test.ts src/routes/api/events/events.auth.test.ts
npm run test:run -- src/lib/server/spawner-state.test.ts src/lib/server/hosted-ui-auth.test.ts src/routes/api/prd-bridge/write/write.integration.test.ts src/routes/api/prd-bridge/load-to-canvas/load-to-canvas.integration.test.ts src/routes/api/pipeline-loader/pipeline-loader.integration.test.ts src/routes/api/mission/active/active-mission.integration.test.ts src/lib/server/mission-control-trace.test.ts src/lib/server/mission-control-relay.test.ts src/lib/server/provider-runtime.spark-agent.test.ts src/lib/server/creator-mission.test.ts
npm run test:run
npm run check
npm run build
npm run smoke:hosted-lock
```

Full test result before deploy:

```text
80 test files passed
456 tests passed
```

Hosted checks:

```powershell
$env:SPARK_HOSTED_LOCK_BASE_URL='https://spawner.sparkswarm.ai'
npm run smoke:hosted-lock
Remove-Item Env:\SPARK_HOSTED_LOCK_BASE_URL
```

Result:

```text
hosted-lock smoke passed
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

## Known Errors, Warnings, And Non-Blocking Noise

- Earlier live checks showed `/canvas` and `/kanban` were public before redeploy. This is now fixed and verified.
- `railway status` initially failed because the checkout was not linked. It is now linked to the correct project/service.
- Full tests produced existing non-fatal warning noise:
  - Local `.spawner/mission-provider-results.json` had malformed JSON in local runtime state.
  - Some PRD bridge integration test relay warnings came from mocked webhook fetch behavior.
- The repo root has many untracked screenshot artifacts. Leave them alone unless the user explicitly wants cleanup.
- Post-handoff closeout found additional local uncommitted tracked changes that were not part of this handoff or the hosted lock deployment. Treat them as user/background work and inspect before editing or committing:
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

## Open Decisions

1. Durable account/session store:
   - Current private-preview sessions are in-memory and suitable only for a trusted preview.
   - Before public unlock, choose a durable identity/session store.

2. Account UX:
   - Decide whether public hosted Spawner should use Spark Swarm account login, workspace ID + password, magic links, or another private access flow.
   - User preference: make people feel clearly inside their own private workspace before showing Canvas/Kanban/Trace/Skills/Settings.

3. Local agent pairing:
   - Hosted UI must not silently connect to a user computer.
   - Need explicit local-agent pairing, device naming, revocation, and clear status labels.

4. Elevated command authority:
   - Running, improving, pausing, canceling, dispatching, MCP calls, and local worker execution need stronger authority boundaries than normal browsing.
   - Decide whether to use short-lived elevated command tokens, step-up auth, approval prompts, or a combination.

5. Audit trail:
   - Decide what events must be captured for user confidence and post-incident review.
   - At minimum: login, pairing, command issued, command approved/denied, local agent connected/disconnected, workspace state access.

6. Public release threshold:
   - Keep hosted Spawner locked until the account, workspace isolation, pairing, command authority, and audit trail are tested from an adversarial security lens.

## Constraints And User Preferences

- Do not public-release usable hosted Canvas/Kanban/Trace/Skills/Settings until security is intentionally designed and tested.
- Landing/marketing page can be visible.
- Private Railway/VPS owner installs must remain possible.
- Users should feel safe and understand:
  - this is their own workspace,
  - whether a local computer is connected,
  - what authority the hosted site has,
  - what data is private,
  - how to revoke access.
- Do not break local Spawner workflows.
- Do not stage or delete unrelated screenshot artifacts.
- Commit often, with focused commits.
- Prefer simple, explicit security boundaries over clever implicit trust.

## Do-Not-Touch Areas

- Do not disable or remove the public lock until the remaining security work is complete.
- Do not set `SPARK_HOSTED_PRIVATE_PREVIEW=1` on the public `spawner.sparkswarm.ai` deployment unless intentionally running a trusted private preview.
- Do not expose raw API keys in browser cookies or localStorage.
- Do not add wildcard public origins.
- Do not let hosted browser sessions execute local-machine commands without explicit pairing and approval.
- Do not revert unrelated UI/visual work or screenshot artifacts.

## Next 3-7 Concrete Steps

1. Add a durable auth/session plan:
   - Pick the identity/session store.
   - Define account, workspace, user, device, and session records.
   - Keep the implementation small and inspectable.

2. Build the locked account shell:
   - Keep app routes locked.
   - Add a polished login/account gate that clearly says Spawner is private and not connected to any local machine yet.
   - Avoid implying the user already has control authority.

3. Design local-agent pairing:
   - Add pairing codes or device tokens.
   - Show connected device name, last seen time, workspace ID, and revocation action.
   - Fail closed when no local agent is paired.

4. Split normal browsing auth from command authority:
   - Normal session can view allowed workspace surfaces.
   - Elevated short-lived command token or approval must be required for run/improve/pause/cancel/dispatch/MCP/local worker actions.

5. Add audit logging:
   - Store security events per workspace.
   - Surface a readable activity log in settings or security panel.
   - Include enough data to answer "who did what, from where, and when?"

6. Add adversarial tests:
   - Unauthorized app route access.
   - Unauthorized API route access.
   - Cross-site POST rejection.
   - Session expiry.
   - Workspace isolation.
   - Command attempt without elevated authority.
   - Paired-device revocation.

7. Re-run hosted verification:
   - Local `npm run test:run`, `npm run check`, `npm run build`, `npm run smoke:hosted-lock`.
   - Deploy only after checks pass.
   - Verify `https://spawner.sparkswarm.ai` again before saying public surfaces are safe.

## Reactivation Prompt

Paste this into a fresh Codex chat:

```text
We are continuing hosted Spawner security work in:
C:\Users\USER\.spark\modules\spawner-ui\source

Start by reading:
docs/codex-handoffs/2026-05-05-hosted-spawner-security-next-steps.md
docs/HOSTED_SPAWNER_SECURITY_RELEASE_PROCESS.md
docs/HOSTED_SPAWNER_PRIVATE_PREVIEW.md

Current state:
- Branch is main.
- Hosted domain is https://spawner.sparkswarm.ai.
- Railway is linked to attractive-light / production / spawner-ui.
- Latest verified Railway deployment is bf197498-8d2d-41c7-9b0d-f74cae65a20d.
- Public hosted Spawner is locked: root shows the lock shell, app routes and control APIs return 503, CSP and X-Frame-Options are present.

Goal:
Continue the remaining security work before any public unlock. Do not make hosted Canvas/Kanban/Trace/Skills/Settings usable publicly yet. Plan and implement the next security slice around durable accounts/sessions, local-agent pairing, elevated command authority, and audit logs. Keep private Railway/VPS owner installs possible. Commit focused changes often.

Before changing code:
1. Run git status -sb and do not touch untracked screenshot artifacts.
2. Re-check the hosted lock with:
   $env:SPARK_HOSTED_LOCK_BASE_URL='https://spawner.sparkswarm.ai'; npm run smoke:hosted-lock; Remove-Item Env:\SPARK_HOSTED_LOCK_BASE_URL
3. Inspect current auth/state files:
   src/hooks.server.ts
   src/lib/server/hosted-ui-auth.ts
   src/lib/server/mcp-auth.ts
   src/lib/server/spawner-state.ts
   src/lib/server/hosted-setup-status.ts

Next recommended implementation slice:
Define the durable security model and implement the smallest useful foundation for it:
- account/workspace/session/device/pairing/audit data contracts,
- server helpers with tests,
- no public unlock yet,
- no local command authority without explicit pairing and elevated approval.
```
