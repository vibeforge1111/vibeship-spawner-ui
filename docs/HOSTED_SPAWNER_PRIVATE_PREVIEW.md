# Hosted Spawner Private Preview Gate

Hosted Spawner is not public by default.

Spawner can pause, resume, cancel, and eventually dispatch work that may touch a user's computer through a local worker. Treat the hosted UI as a control surface, not a normal public dashboard.

The public landing page may be reachable so people can understand the product. For this release it renders a locked account/waitlist shell, not the live app. The app/control surfaces are not part of the public release yet.

## Default Release Posture

When Spawner looks hosted, the app returns a private-preview lock page unless this complete private preview is explicitly configured:

```text
SPARK_HOSTED_PRIVATE_PREVIEW=1
SPARK_WORKSPACE_ID=<private workspace slug>
SPARK_UI_API_KEY=<long random access key>
```

Hosted mode is detected when any of these are true:

- `SPARK_LIVE_CONTAINER=1`
- `SPARK_SPAWNER_HOST=0.0.0.0`
- `SPARK_ALLOWED_HOSTS` is set
- `RAILWAY_PUBLIC_DOMAIN` is set
- `RENDER_EXTERNAL_URL` is set
- `FLY_APP_NAME` is set
- `VERCEL_URL` is set
- `NETLIFY=true`

Without the explicit preview flag, users cannot enter Kanban, Canvas, Mission Control, Commerce, setup/login, preview, or API surfaces. This is intentional for the current release.

The only public path through the release lock is `/`, plus static assets needed to render it. The root page must not open event streams, mission polling, local-worker bridges, or any other control-plane connection.

Hosted responses also carry baseline security headers, including frame blocking, MIME sniff protection, a no-referrer policy, and a hosted Content Security Policy. Mutating hosted browser requests must come from the same origin unless they use an explicit API key header or bearer token.

## Hosted Site vs Private Railway/VPS

Use this matrix before shipping a deployment:

| Deployment | Landing page | Canvas/Kanban/API | Required env |
| --- | --- | --- | --- |
| Public Spark marketing site | Locked account/waitlist shell | Locked | Do not set `SPARK_HOSTED_PRIVATE_PREVIEW` |
| Trusted Railway/VPS owner preview | Open after login where applicable | Available after workspace ID + access key | Set `SPARK_HOSTED_PRIVATE_PREVIEW=1`, `SPARK_WORKSPACE_ID`, `SPARK_UI_API_KEY`, `SPARK_BRIDGE_API_KEY`, exact `SPARK_ALLOWED_HOSTS` |
| Local developer machine | Open | Available locally | No hosted flag required |

If a public hosted site still shows Canvas or Kanban, check the environment first. It is either not being detected as hosted or `SPARK_HOSTED_PRIVATE_PREVIEW=1` is set on a public deployment.

## Login Contract

Private preview login requires both:

- Workspace ID
- Access key

The server stores both as `HttpOnly`, `Secure`, `SameSite=Strict` cookies after successful login. JavaScript cannot read them.

The workspace ID is not a complete multi-tenant account model. It is a preview gate that makes the hosted surface feel and behave less like a shared console while the real workspace/account model is built.

After successful private-preview login, the browser receives only an opaque `HttpOnly`, `Secure`, `SameSite=Strict` session cookie. The UI key, bridge key, events key, and workspace ID are not persisted as browser-readable or browser-stored raw key cookies.

When hosted with `SPARK_WORKSPACE_ID`, core runtime files are stored below:

```text
<SPAWNER_STATE_DIR>/workspaces/<workspace-id>/
```

That workspace namespace covers Mission Control relay state, PRD bridge files, Canvas pipeline loads, active mission state, provider results, creator mission traces, schedules, event-result fallback files, and provider prompt references. Local development without hosted env signals still uses the existing `SPAWNER_STATE_DIR` or `.spawner/` path unchanged.

## Verification

For the public hosted deployment:

```text
GET /                         -> 200 locked public account/waitlist shell
GET /canvas                   -> 503 private preview locked
GET /kanban                   -> 503 private preview locked
GET /missions                 -> 503 private preview locked
GET /api/mission-control/board -> 503 private preview locked
```

Also verify the root HTML does not contain direct links such as `href="/canvas"` or `href="/kanban"`.

The automated version of this check is:

```text
npm run build
npm run smoke:hosted-lock
```

For a trusted Railway/VPS owner preview:

```text
SPARK_HOSTED_PRIVATE_PREVIEW=1
SPARK_WORKSPACE_ID=<private workspace slug>
SPARK_UI_API_KEY=<long random access key>
SPARK_BRIDGE_API_KEY=<different long random access key>
SPARK_ALLOWED_HOSTS=<exact public host>
```

Then verify:

```text
GET /canvas without login -> 303 /spark-live/login
GET /canvas after login   -> 200
POST mutating APIs        -> requires configured API key/session
```

## Not Yet Public-Ready

Do not use this as a multi-user hosted product until these are implemented and tested:

- per-workspace state isolation
- per-route workspace authorization
- password hashing or external identity provider
- short-lived elevated tokens for mutating commands
- local worker approval for risky computer-control actions
- audit trail for pause/resume/cancel/run/improve
- clear hosted-vs-local data boundary in the UI

Until then, hosted Spawner should be a trusted private preview only.
