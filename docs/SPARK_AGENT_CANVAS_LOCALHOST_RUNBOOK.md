# Spark Agent Canvas Localhost Runbook

Use this checklist to reproduce the local Spark-agent-to-canvas sync flow and debug it quickly.

## 1) Start Local App

```powershell
cd <workspace>\spawner-ui
npm run dev -- --port 3333
```

Open:

- Canvas UI: `http://localhost:3333/canvas`
- Canvas snapshot API: `http://localhost:3333/api/spark-agent/canvas-state`

## 2) Create A Fresh Pipeline

Run this in a new PowerShell terminal:

```powershell
$ts=Get-Date -Format 'yyyyMMddHHmmss'
$plid="pipe-live-final-$ts"
$sid="sess-live-final-$ts"

Invoke-RestMethod -Method Post -Uri "http://localhost:3333/api/spark-agent/session/start" -ContentType "application/json" -Body (@{
  sessionId=$sid
  actor='spark'
  metadata=@{ missionId='ui-live-demo' }
} | ConvertTo-Json -Depth 6) | Out-Null

Invoke-RestMethod -Method Post -Uri "http://localhost:3333/api/spark-agent/command" -ContentType "application/json" -Body (@{
  sessionId=$sid
  command='canvas.create_pipeline'
  params=@{ pipelineId=$plid; name="Live Final Demo $ts" }
} | ConvertTo-Json -Depth 6) | Out-Null

Invoke-RestMethod -Method Post -Uri "http://localhost:3333/api/spark-agent/command" -ContentType "application/json" -Body (@{
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

Invoke-RestMethod -Method Post -Uri "http://localhost:3333/api/spark-agent/command" -ContentType "application/json" -Body (@{
  sessionId=$sid
  command='canvas.add_skill'
  params=@{
    nodeId='node-review'
    skillId='review-worker'
    skillName='Review Worker'
    description='Review'
    position=@{x=500;y=170}
  }
} | ConvertTo-Json -Depth 6) | Out-Null

Invoke-RestMethod -Method Post -Uri "http://localhost:3333/api/spark-agent/command" -ContentType "application/json" -Body (@{
  sessionId=$sid
  command='canvas.add_connection'
  params=@{
    connectionId='conn-build-review'
    sourceNodeId='node-codex'
    targetNodeId='node-review'
  }
} | ConvertTo-Json -Depth 6) | Out-Null

$snap=Invoke-RestMethod -Method Get -Uri "http://localhost:3333/api/spark-agent/canvas-state"
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

- `snapshotPipelineId` equals `pipelineId`
- `nodes` is `2`
- `connections` is `1`
- `hasUpdate` is `true`

The canvas page polls this endpoint and should auto-show the pipeline within one or two seconds.

## 3) Troubleshooting

If the API shows `hasUpdate: false`, no new canvas change has arrived yet. Re-run the create/add commands.

If the API has data but canvas looks stale, hard refresh `/canvas`, wait for the next poll tick, and confirm the snapshot `pipelineId`.

If a new pipeline appears with no nodes, only `canvas.create_pipeline` was sent. Send `canvas.add_skill` and `canvas.add_connection`.
