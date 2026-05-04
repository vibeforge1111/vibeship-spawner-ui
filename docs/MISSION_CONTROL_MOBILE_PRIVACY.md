# Mission Control Mobile Access And Privacy Contract

Mission Control links sent to Telegram must not pretend that `localhost` works on a phone.

`localhost` always means the current device. A link like `http://127.0.0.1:3333/kanban` opens Spawner UI on the desktop that is running it, but from Telegram on a phone it points at the phone itself.

## Access Modes

Spawner UI now describes Mission Control access with one small contract:

```ts
{
  mode: 'hosted' | 'lan' | 'local-only',
  url: string | null,
  mobileReachable: boolean,
  message: string,
  privacy: {
    defaultPayload: 'status-metadata',
    privatePayloadsStayLocal: true
  }
}
```

### Hosted

Set one of:

```text
SPAWNER_MISSION_CONTROL_PUBLIC_URL=https://mission.example.com
MISSION_CONTROL_PUBLIC_URL=https://mission.example.com
SPARK_MISSION_CONTROL_PUBLIC_URL=https://mission.example.com
```

Hosted HTTPS, non-private URLs are treated as mobile reachable. This is the safest product direction when paired with a local worker/provider bridge, because the user's computer makes outbound connections instead of exposing a local dev server.

### LAN

Set one of:

```text
SPAWNER_MISSION_CONTROL_LAN_URL=http://192.168.1.42:3333
MISSION_CONTROL_LAN_URL=http://192.168.1.42:3333
```

LAN URLs are same-network only. They are useful at home or in an office, but they are not treated as "on the go" mobile links.

### Local-Only

If no safe URL is configured, Mission Control access is:

```text
mode: local-only
url: null
mobileReachable: false
```

Telegram should show the included message instead of sending a dead localhost link.

## Privacy Boundary

Default hosted payloads should be status metadata only:

- mission id
- mission name
- status / phase
- progress percent
- task titles and task counts when allowed
- timestamps
- sanitized summaries
- mobile access state

The hosted control plane should not receive by default:

- source code
- local file contents
- `.env` values or secrets
- full prompts
- full model outputs
- full execution logs
- private Telegram conversation text beyond the minimal mission request metadata
- local absolute paths unless the user explicitly opts in for debugging

The local worker/provider remains the private data plane. It executes against local files and can expose a small, redacted state stream to hosted Mission Control.

## Command Safety

Hosted Mission Control should default to read-only inspection until the user is authenticated and authorized.

Controls that mutate execution state need scoped command tokens:

- cancel
- pause/resume
- rerun
- improve
- push
- delete/cleanup

Tokens should be short-lived, mission-scoped, and auditable. A Telegram link should not become a permanent bearer token for controlling the user's local machine.

## Relay Behavior

Mission-control relay payloads include `missionControl` / `missionControlAccess` metadata so Telegram and future hosted surfaces can decide what to show:

- hosted: show the configured mobile URL
- lan: say it only works on the same network
- local-only: say Mission Control is local to the computer

This keeps the Telegram bot from guessing and keeps localhost from leaking into mobile UX as a fake answer.

External relay payloads are also redacted before they leave Spawner UI. The relay keeps status-safe fields such as mission ids, task names, progress, task skills, access mode, and Telegram relay profile/port. It drops or scrubs local paths, localhost preview URLs, prompt/output/log blobs, environment objects, and token-shaped secrets. Full local execution detail stays in the local worker unless the user explicitly opts into a broader debug share.
