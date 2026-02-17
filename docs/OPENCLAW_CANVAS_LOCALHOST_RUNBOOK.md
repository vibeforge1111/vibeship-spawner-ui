# OpenClaw ↔ Spawner Canvas Localhost Runbook

This is the practical checklist to reproduce the live OpenClaw-to-canvas sync flow locally and debug it fast.

---

## 1) Start local app

```powershell
cd C:\Users\USER\Desktop\spawner-ui
npm run dev -- --port 3333
```

Open:
- Canvas UI: `http://localhost:3333/canvas`
- Canvas snapshot API: `http://localhost:3333/api/openclaw/canvas-state`

---

## 2) Create a fresh pipeline through OpenClaw API

Run this in PowerShell (new terminal):

```powershell
$ts=Get-Date -Format 'yyyyMMddHHmmss'
$plid="pipe-live-final-$ts"
$sid="sess-live-final-$ts"

Invoke-RestMethod -Method Post -Uri "http://localhost:3333/api/openclaw/session/start" -ContentType "application/json" -Body (@{
  sessionId=$sid
  actor='spark'
  metadata=@{ missionId='ui-live-demo' }
} | ConvertTo-Json -Depth 6) | Out-Null

Invoke-RestMethod -Method Post -Uri "http://localhost:3333/api/openclaw/command" -ContentType "application/json" -Body (@{
  sessionId=$sid
  command='canvas.create_pipeline'
  params=@{ pipelineId=$plid; name="Live Final Demo $ts" }
} | ConvertTo-Json -Depth 6) | Out-Null

Invoke-RestMethod -Method Post -Uri "http://localhost:3333/api/openclaw/command" -ContentType "application/json" -Body (@{
  sessionId=$sid
  command='canvas.add_skill'
  params=@{
    nodeId='node-codex'
    skillId='codex-worker'
    skillName='Codex Worker'
    description='Implementation'
    position=@{x=180;y=170}
  }
} | ConvertTo-Json -Depth 6) | Out-Null

Invoke-RestMethod -Method Post -Uri "http://localhost:3333/api/openclaw/command" -ContentType "application/json" -Body (@{
  sessionId=$sid
  command='canvas.add_skill'
  params=@{
    nodeId='node-claude'
    skillId='claude-worker'
    skillName='Claude Worker'
    description='Review'
    position=@{x=500;y=170}
  }
} | ConvertTo-Json -Depth 6) | Out-Null

Invoke-RestMethod -Method Post -Uri "http://localhost:3333/api/openclaw/command" -ContentType "application/json" -Body (@{
  sessionId=$sid
  command='canvas.add_connection'
  params=@{
    connectionId='conn-codex-claude'
    sourceNodeId='node-codex'
    targetNodeId='node-claude'
  }
} | ConvertTo-Json -Depth 6) | Out-Null

$snap=Invoke-RestMethod -Method Get -Uri "http://localhost:3333/api/openclaw/canvas-state"
[pscustomobject]@{
  sessionId=$sid
  pipelineId=$plid
  snapshotPipelineId=$snap.snapshot.pipelineId
  nodes=$snap.snapshot.nodes.Count
  connections=$snap.snapshot.connections.Count
  hasUpdate=$snap.hasUpdate
} | ConvertTo-Json -Compress
```

Expected result:
- `snapshotPipelineId` == `pipelineId`
- `nodes` = `2`
- `connections` = `1`
- `hasUpdate` = `true`

The canvas page polls this endpoint and should auto-show the pipeline within ~1–2 seconds.

---

## 3) How the sync works (current behavior)

1. OpenClaw commands mutate in-memory session canvas state.
2. `GET /api/openclaw/canvas-state` returns latest snapshot (optionally using `?since=`).
3. `/canvas` polls this endpoint every ~1200ms while mounted.
4. On update, canvas store is replaced with snapshot nodes/connections and pipeline metadata (`pipelineId`, `pipelineName`) is preserved.

---

## 4) Troubleshooting quick map

### A) API shows `hasUpdate: false`
No new OpenClaw canvas change yet. Re-run create/add commands.

### B) API has data, canvas still looks stale
- Hard refresh `http://localhost:3333/canvas` (`Ctrl+Shift+R`)
- Wait 2 seconds for poll tick
- Ensure snapshot `pipelineId` matches what you expect

### C) New pipeline appears but no nodes
Only `canvas.create_pipeline` was sent. Add `canvas.add_skill` and `canvas.add_connection` commands.

### D) Random SIGKILL in terminal logs
Usually a terminated status/probe process, not pipeline failure. Validate actual state via `/api/openclaw/canvas-state`.

---

## 5) Rollback references

- Step 2 bridge commit: `67b610fd38ddbd9f6cc225948b5d09ec8b1844a0`
- Canvas live-sync fix: `c36e023e9fe6b7456d3257658398a843018ae6de`

Rollback command pattern:

```powershell
git revert <commit-hash>
```
