# SPARK Personality Visible Runbook (localhost:3333)

Use this runbook to create and execute a visible multi-agent personality-evolution mission in Spawner.

---

## 0) Prerequisites

- Repo: `C:\Users\USER\Desktop\spawner-ui`
- Node deps installed (`npm install`)
- (Optional but recommended) provider keys in `.env`:
  - `OPENAI_API_KEY` (Codex)
  - `ANTHROPIC_API_KEY` (Claude)

---

## 1) Start Spawner on port 3333

```powershell
cd C:\Users\USER\Desktop\spawner-ui
npm run dev -- --port 3333
```

Open in browser:
- Canvas: `http://localhost:3333/canvas`
- Event stream endpoint: `http://localhost:3333/api/openclaw/events?sessionId=<SESSION_ID>`
- Canvas snapshot endpoint: `http://localhost:3333/api/openclaw/canvas-state`

---

## 2) Create a session + personality pipeline

Run in a second PowerShell terminal:

```powershell
$base = "http://localhost:3333"
$ts = Get-Date -Format 'yyyyMMddHHmmss'
$sid = "spark-personality-$ts"
$pid = "spark-personality-pipe-$ts"

# Start session
Invoke-RestMethod -Method Post -Uri "$base/api/openclaw/session/start" -ContentType "application/json" -Body (@{
  sessionId = $sid
  actor = 'spark'
  metadata = @{ missionId = "spark-personality-mission-$ts" }
} | ConvertTo-Json -Depth 6) | Out-Null

# Create pipeline
Invoke-RestMethod -Method Post -Uri "$base/api/openclaw/command" -ContentType "application/json" -Body (@{
  sessionId = $sid
  command = 'canvas.create_pipeline'
  params = @{ pipelineId = $pid; name = "Spark Personality Evolution $ts" }
} | ConvertTo-Json -Depth 6) | Out-Null

# Add nodes
$nodes = @(
  @{ nodeId='planner';       skillId='planner';        skillName='Planner';        description='Mission objective + acceptance criteria'; x=80;  y=120 },
  @{ nodeId='trait-modeler'; skillId='trait-modeler';  skillName='Trait Modeler';  description='Propose constrained trait deltas';      x=300; y=120 },
  @{ nodeId='codex-impl';    skillId='codex-worker';   skillName='Codex Impl';     description='Implement changes';                     x=540; y=40  },
  @{ nodeId='claude-review'; skillId='claude-reviewer';skillName='Claude Review';  description='Safety + quality review';               x=540; y=200 },
  @{ nodeId='tester';        skillId='tester';         skillName='Tester';         description='Regression + behavior checks';         x=780; y=120 },
  @{ nodeId='doc-writer';    skillId='doc-writer';     skillName='Doc Writer';     description='User-facing change notes';             x=540; y=320 },
  @{ nodeId='integrator';    skillId='integrator';     skillName='Integrator';     description='Finalize version + rollback pointer';  x=1020;y=120 }
)

foreach ($n in $nodes) {
  Invoke-RestMethod -Method Post -Uri "$base/api/openclaw/command" -ContentType "application/json" -Body (@{
    sessionId = $sid
    command = 'canvas.add_skill'
    params = @{
      nodeId = $n.nodeId
      skillId = $n.skillId
      skillName = $n.skillName
      description = $n.description
      position = @{ x = $n.x; y = $n.y }
    }
  } | ConvertTo-Json -Depth 8) | Out-Null
}

# Add connections
$conns = @(
  @{ id='c1'; source='planner';       target='trait-modeler' },
  @{ id='c2'; source='trait-modeler'; target='codex-impl' },
  @{ id='c3'; source='trait-modeler'; target='claude-review' },
  @{ id='c4'; source='trait-modeler'; target='doc-writer' },
  @{ id='c5'; source='codex-impl';    target='claude-review' },
  @{ id='c6'; source='claude-review'; target='tester' },
  @{ id='c7'; source='doc-writer';    target='integrator' },
  @{ id='c8'; source='tester';        target='integrator' }
)

foreach ($c in $conns) {
  Invoke-RestMethod -Method Post -Uri "$base/api/openclaw/command" -ContentType "application/json" -Body (@{
    sessionId = $sid
    command = 'canvas.add_connection'
    params = @{ connectionId=$c.id; sourceNodeId=$c.source; targetNodeId=$c.target }
  } | ConvertTo-Json -Depth 6) | Out-Null
}

# Quick snapshot check
$snap = Invoke-RestMethod -Method Get -Uri "$base/api/openclaw/canvas-state"
[pscustomobject]@{
  sessionId   = $sid
  pipelineId  = $pid
  nodes       = $snap.snapshot.nodes.Count
  connections = $snap.snapshot.connections.Count
  hasUpdate   = $snap.hasUpdate
} | Format-List
```

Expected:
- `nodes = 7`
- `connections = 8`
- canvas updates live in browser

---

## 3) Build and start mission

```powershell
$base = "http://localhost:3333"

Invoke-RestMethod -Method Post -Uri "$base/api/openclaw/command" -ContentType "application/json" -Body (@{
  sessionId = $sid
  command = 'mission.build'
  params = @{ name = "Spark Personality Evolution Mission $ts" }
} | ConvertTo-Json -Depth 6)

Invoke-RestMethod -Method Post -Uri "$base/api/openclaw/command" -ContentType "application/json" -Body (@{
  sessionId = $sid
  command = 'mission.start'
} | ConvertTo-Json -Depth 6)
```

Optional explicit provider tasks (to make Codex/Claude work visibility obvious):

```powershell
# Codex implementation task
Invoke-RestMethod -Method Post -Uri "$base/api/openclaw/command" -ContentType "application/json" -Body (@{
  sessionId = $sid
  command = 'worker.run'
  params = @{
    providerId = 'codex'
    missionId = "spark-personality-mission-$ts"
    taskId = 'codex-impl'
    model = 'gpt-5.5'
    prompt = 'Implement trait delta scaffolding and tests for concise communication mode.'
  }
} | ConvertTo-Json -Depth 8)

# Claude review task
Invoke-RestMethod -Method Post -Uri "$base/api/openclaw/command" -ContentType "application/json" -Body (@{
  sessionId = $sid
  command = 'worker.run'
  params = @{
    providerId = 'claude'
    missionId = "spark-personality-mission-$ts"
    taskId = 'claude-review'
    model = 'claude-opus-4-1'
    prompt = 'Review implementation for safety boundaries, reversibility, and user-guided evolution constraints.'
  }
} | ConvertTo-Json -Depth 8)
```

---

## 4) Observe who is doing what in real time

## A) Canvas view
In `http://localhost:3333/canvas`:
- active nodes should visually change state as tasks run
- Codex-related node (`codex-impl`) and Claude-related node (`claude-review`) show progression at different times
- integrator should remain waiting until upstream nodes complete

## B) Event panel / stream
Use SSE stream in terminal:

```powershell
curl.exe -N "http://localhost:3333/api/openclaw/events?sessionId=$sid"
```

Look for provider-specific events:
- `task_started` with `providerId:"codex"` or `providerId:"claude"`
- `task_progress` with percentages
- `task_completed` / `task_failed`

This gives a direct timeline of **which agent worked on which task**.

## C) Mission status checks

```powershell
Invoke-RestMethod -Method Post -Uri "$base/api/openclaw/command" -ContentType "application/json" -Body (@{
  sessionId = $sid
  command = 'mission.status'
} | ConvertTo-Json -Depth 6)
```

---

## 5) End session (clean shutdown)

```powershell
Invoke-RestMethod -Method Post -Uri "$base/api/openclaw/session/end" -ContentType "application/json" -Body (@{
  sessionId = $sid
  reason = 'runbook-complete'
} | ConvertTo-Json -Depth 4)
```

---

## 6) Fast troubleshooting

- Canvas not updating: refresh canvas and re-check `/api/openclaw/canvas-state`.
- No provider events: verify `worker.run` command and provider IDs (`codex`, `claude`).
- `mission.start` runs but no visible parallel activity: trigger explicit `worker.run` tasks for both providers.
- Auth errors on non-localhost: configure required API keys for bridge endpoints.
