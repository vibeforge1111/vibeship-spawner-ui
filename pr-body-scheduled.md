## Bug Report

### Title
`/api/scheduled` endpoint allows unauthenticated CRUD on scheduled missions and loops

### Severity
**HIGH**

### Category
Authentication bypass / Authorization

### Target File(s)
- `src/routes/api/scheduled/+server.ts`

### Description
The `/api/scheduled` endpoint exposes GET (list), POST (create), and DELETE (remove) handlers for scheduled tasks — cron-based missions and loops that execute automatically. None of these handlers call `requireControlAuth()` or `enforceRateLimit()`.

When `hostedUiAuthEnabled` is false (typical self-hosted deployments), the global `hooks.server.ts` middleware skips auth entirely, leaving this endpoint completely unauthenticated. An attacker can:
1. **List** all scheduled tasks (information disclosure)
2. **Create** arbitrary scheduled missions/loops (resource abuse, unauthorized execution)
3. **Delete** any scheduled task (denial of service)

This contrasts with other sensitive endpoints like `/api/dispatch`, `/api/scan`, `/api/mission-control/command` which all enforce `requireControlAuth`.

### Steps to Reproduce
1. Deploy vibeship-spawner-ui without hosted UI auth enabled
2. `curl http://localhost:5173/api/scheduled` — lists all scheduled tasks without auth
3. `curl -X POST http://localhost:5173/api/scheduled -H 'Content-Type: application/json' -d '{"cron":"* * * * *","action":"mission","payload":{}}'` — creates a task
4. `curl -X DELETE "http://localhost:5173/api/scheduled?id=xxx"` — deletes a task

### Impact
- Unauthenticated attackers can create cron jobs that execute arbitrary missions
- Existing scheduled tasks can be deleted (DoS)
- Full CRUD access to the scheduler without any credentials

---

```json
{
  "pr": {
    "url": "https://github.com/vibeforge1111/vibeship-spawner-ui/pull/XXX",
    "body_must_include": "/api/scheduled|requireControlAuth|unauthenticated|CRUD|scheduled tasks"
  }
}
```
