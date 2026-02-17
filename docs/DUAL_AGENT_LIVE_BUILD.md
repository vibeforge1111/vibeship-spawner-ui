# Dual Agent Live Build

## Run Narrative
Codex drafts a focused build task → sends to Claude via OpenClaw bridge → Claude executes in worker environment → returns logs/artifacts → Codex validates against criteria → optional refinement pass → outcome recorded.

## Codex Draft Phase
1. **Define objective**: One clear build goal with measurable acceptance criteria
2. **Prepare command**: Format task as `worker.run` command with constraints
3. **Send to bridge**: POST to `/api/openclaw/command` endpoint
4. **Capture runId**: Store for tracking and log retrieval

## Claude Refinement Phase
1. **Receive task**: OpenClaw delivers Codex's build request to Claude worker
2. **Execute build**: Claude implements solution meeting specified criteria
3. **Stream progress**: Real-time logs flow back through bridge
4. **Return artifacts**: Completed code, tests, and build outputs delivered
5. **Enable iteration**: Codex can request refinements based on results

## Practical Checklist
- [ ] Set `OPENCLAW_BASE_URL` (default: `http://localhost:3000`)
- [ ] Obtain auth token from OpenClaw admin
- [ ] Get target `workerId` from available workers
- [ ] Write focused task: goal, constraints, done criteria
- [ ] Execute PowerShell snippet below
- [ ] Monitor `runId` for completion status
- [ ] Validate output against acceptance criteria
- [ ] Save artifacts and record outcome

## Reusable PowerShell Template
```powershell
# Configuration
$baseUrl = "http://localhost:3000"
$token = "<OPENCLAW_TOKEN>"
$workerId = "<worker-id>"

# Task definition (customize this)
$task = @"
Goal: Build a React component for user authentication
Constraints: Use TypeScript, include tests, no external auth libs
Done when: Login form works, validates input, has 80% test coverage
"@

# Send command
$body = @{
  command = "worker.run"
  payload = @{
    workerId = $workerId
    task = $task
    meta = @{
      initiatedBy = "codex"
      flow = "dual-agent-build"
      timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }
  }
} | ConvertTo-Json -Depth 8

# Execute and display
$response = Invoke-RestMethod -Method Post `
  -Uri "$baseUrl/api/openclaw/command" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $body

Write-Host "Run ID: $($response.runId)" -ForegroundColor Green
$response | Format-List
```
