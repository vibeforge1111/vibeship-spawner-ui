# Hosted Spawner Private Preview Gate

Hosted Spawner is not public by default.

Spawner can pause, resume, cancel, and eventually dispatch work that may touch a user's computer through a local worker. Treat the hosted UI as a control surface, not a normal public dashboard.

## Default Release Posture

When Spawner looks hosted, the app returns a private-preview lock page unless this is explicitly configured:

```text
SPARK_HOSTED_PRIVATE_PREVIEW=1
SPARK_WORKSPACE_ID=<private workspace slug>
SPARK_UI_API_KEY=<long random access key>
```

Hosted mode is detected when any of these are true:

- `SPARK_LIVE_CONTAINER=1`
- `SPARK_SPAWNER_HOST=0.0.0.0`
- `SPARK_ALLOWED_HOSTS` is set

Without the explicit preview flag, users cannot enter Kanban, Canvas, Mission Control, Commerce, or API surfaces. This is intentional for the current release.

## Login Contract

Private preview login requires both:

- Workspace ID
- Access key

The server stores both as `HttpOnly`, `Secure`, `SameSite=Strict` cookies after successful login. JavaScript cannot read them.

The workspace ID is not a complete multi-tenant account model. It is a preview gate that makes the hosted surface feel and behave less like a shared console while the real workspace/account model is built.

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
