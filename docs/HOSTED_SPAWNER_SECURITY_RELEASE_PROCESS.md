# Hosted Spawner Security Release Process

This is the release process for turning hosted Spawner from a private owner tool into a public product. Until every launch gate below is complete, the public hosted site should expose the landing page only. Canvas, Kanban, Mission Control, preview, and API routes must stay locked.

## Current Decision

For the current release:

- Public hosted site: landing page only.
- Public hosted site: no usable Canvas, Kanban, Mission Control, setup/login, preview, or API surfaces.
- Private Railway/VPS installs: allowed when the owner explicitly enables private preview and configures workspace ID plus access keys.
- Localhost development: unchanged.

This protects users from the scary version of the product: a public control surface that appears connected to a computer without proving whose workspace it is, what it can do, and where the data goes.

The public hosted root now renders a locked account/waitlist shell. It may show the shape of future workspace access, but it must not accept a username, password, workspace ID, or access key until the account system is real.

## How The Lock Works

The app treats a runtime as hosted when it sees any of these signals:

- `SPARK_LIVE_CONTAINER=1`
- `SPARK_SPAWNER_HOST=0.0.0.0`
- `SPARK_ALLOWED_HOSTS` is set
- `RAILWAY_PUBLIC_DOMAIN` is set
- `RENDER_EXTERNAL_URL` is set
- `FLY_APP_NAME` is set
- `VERCEL_URL` is set
- `NETLIFY=true`

When hosted and a complete private preview is not configured:

- `/` is allowed so the locked public shell can be public.
- static assets are allowed so the landing page can render.
- the landing page must not open event streams, mission polling, local-worker bridges, or other app/control-plane connections on load.
- every app, setup/login, preview, mission, canvas, kanban, and API route returns the private-preview lock response.

Complete private preview means all of these are present:

```text
SPARK_HOSTED_PRIVATE_PREVIEW=1
SPARK_WORKSPACE_ID=<private non-guessable workspace slug>
SPARK_UI_API_KEY=<long random browser key>
```

When hosted private preview is complete:

- the app requires matching `SPARK_WORKSPACE_ID` and `SPARK_UI_API_KEY`.
- browser login requires both workspace ID and access key.
- trusted private Railway/VPS owners can still use their own instance.

## Environment Matrix

### Public Spark Site

Use this for today's public-facing release:

```text
SPARK_HOSTED_PRIVATE_PREVIEW must be unset
SPARK_WORKSPACE_ID may be unset
SPARK_UI_API_KEY may be unset
SPARK_ALLOWED_HOSTS=<exact public host, if this app receives public traffic>
```

Expected result:

```text
/                         -> locked public account/waitlist shell
/canvas                   -> locked
/kanban                   -> locked
/missions                 -> locked
/spark-live/login         -> locked
/api/mission-control/*    -> locked
/api/spark/run            -> locked
/api/prd-bridge/*         -> locked
```

### Private Railway Or VPS Owner Install

Use this when one owner is running Spawner for themself:

```text
SPARK_HOSTED_PRIVATE_PREVIEW=1
SPARK_WORKSPACE_ID=<private non-guessable workspace slug>
SPARK_UI_API_KEY=<long random browser key>
SPARK_BRIDGE_API_KEY=<different long random bridge key>
SPARK_ALLOWED_HOSTS=<exact owner hostname>
SPARK_ALLOW_HOSTED_FULL_ACCESS must be unset unless the owner explicitly accepts local-worker risk
```

Expected result:

```text
/canvas without credentials -> /spark-live/login
/canvas with credentials    -> app loads
API without key/session     -> 401
API with key/session        -> allowed according to the route
```

### Local Developer Machine

Use this while developing locally:

```text
npm run dev
```

Expected result:

```text
http://127.0.0.1:3333/canvas -> available
http://127.0.0.1:3333/kanban -> available
```

Localhost is not the public risk. The risk is a hosted URL that looks like it controls an owner machine without a clear workspace boundary.

## Public Launch Gates

Do not remove the landing-only lock for public hosted traffic until these are done:

- Real account identity: the UI must clearly say which account and workspace is active.
- Per-workspace state isolation: no shared state files across users or workspaces.
- Per-route authorization: every read and write route must check the active workspace.
- Server-side sessions: do not persist raw long-lived access keys as the browser session.
- CSRF protection for browser-mutating routes, beyond SameSite cookies.
- Short-lived elevated command tokens for pause, cancel, improve, run, dispatch, and local-worker actions.
- Local worker approval for actions that touch files, run commands, or expose previews.
- Audit trail for workspace login, mission creation, pause/resume/cancel, improve, dispatch, and preview access.
- Redacted hosted telemetry by default; raw prompts, logs, file paths, env values, and outputs stay in the private data plane unless explicitly shared.
- UI trust copy: hosted vs local boundary, workspace owner, and command authority must be visible enough that a new user is not spooked.

## Security Notes

The current implementation uses `HttpOnly`, `Secure`, `SameSite=Strict` cookies and exact-token comparison. That is a good private-preview baseline, but it is not a public account system.

The next hardening pass should replace raw key cookies with server-side session IDs, add CSRF tokens or origin checks for browser-mutating routes, and split read-only status access from elevated computer-control actions.

Security references used for this process:

- OWASP Session Management Cheat Sheet
- OWASP Authentication Cheat Sheet
- OWASP Access Control Cheat Sheet
- OWASP Cross-Site Request Forgery Prevention Cheat Sheet
- OWASP Application Security Verification Standard
