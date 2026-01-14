# Spawner Workflow Execution Rules

These rules govern how Claude Code executes Spawner workflows and missions.

---

## Core Principles

### 1. Autonomous Execution
Claude executes workflows **autonomously** without human intervention. The user initiates the workflow, and Claude completes it entirely.

### 2. 100% Completion
Projects are completed **fully**, not partially. No "I've done the setup, you can continue" - that's abandonment, not completion.

### 3. Quality Through Testing
Completion includes verification. A project isn't done until it runs and core features work.

---

## Execution Rules

### Rule 1: NO PAUSING

**NEVER pause mid-workflow for any reason:**

| Forbidden | Why |
|-----------|-----|
| "Should I continue?" | Breaks UI state, wastes user time |
| "Do you want me to proceed?" | Same - user already said yes by starting |
| "Let me know if you want the rest" | Abandonment disguised as politeness |
| "I'll wait for your confirmation" | Workflow will timeout and corrupt |

**Instead:** Execute continuously. Report progress via events API.

### Rule 2: COMPLETE THE PROJECT

**What "complete" means:**

- [ ] All tasks in the pipeline executed
- [ ] All files created/modified as needed
- [ ] Project builds without errors
- [ ] Core functionality works when tested
- [ ] No placeholder code left for user to fill in

**What "complete" does NOT mean:**

- ❌ "Foundation is set up"
- ❌ "Basic structure is in place"
- ❌ "You can add the rest yourself"
- ❌ "I've done 80%, the rest is straightforward"

### Rule 3: TEST BEFORE DECLARING DONE

**After all tasks complete:**

1. Run the build: `npm run build` or equivalent
2. Start the dev server: `npm run dev`
3. Test core functionality manually
4. Fix any errors discovered
5. Only then report completion

**Testing checklist:**
- Does it compile/build?
- Does it start without errors?
- Do the main features work?
- Are there any console errors?

### Rule 4: PROGRESS REPORTING

**Report to Spawner UI via events API:**

```bash
# Task started
POST /api/events
{"type": "task_started", "data": {"taskId": "task-1", "title": "..."}}

# Progress update
POST /api/events
{"type": "task_progress", "data": {"taskId": "task-1", "progress": 50, "message": "..."}}

# Task completed
POST /api/events
{"type": "task_completed", "data": {"taskId": "task-1", "success": true}}

# Mission completed
POST /api/events
{"type": "mission_completed", "data": {"success": true, "summary": "..."}}
```

### Rule 5: ERROR HANDLING

**When errors occur:**

1. **Try to fix it** - Most errors are fixable
2. **Log the error** - Send to events API
3. **Continue to next task** - Don't stop the whole workflow
4. **Report at end** - Summarize all issues after completion

**Never do:**
- Stop everything for one error
- Ask user how to proceed
- Leave broken state without attempting fix

---

## Quality Standards

### Code Quality
- Follow H70 skill patterns for the tech stack
- No `any` types in TypeScript
- No hardcoded secrets
- Proper error handling

### Project Structure
- Follow framework conventions (SvelteKit routes, etc.)
- Organize by feature, not by type
- Clear file naming

### Documentation
- README with setup instructions
- Environment variables documented
- Key decisions noted

---

## PRD Analysis Response Rules

### ⚠️ CRITICAL: RequestId Matching

When responding to PRD analysis requests, **ALWAYS fetch the current requestId first**:

```bash
# STEP 1: Get current requestId (MANDATORY)
curl http://localhost:5173/api/prd-bridge/pending
# Response: {"pending": true, "requestId": "prd-xxx", ...}

# STEP 2: Use THAT requestId in your response
curl -X POST http://localhost:5173/api/events \
  -H "Content-Type: application/json" \
  -d '{"type": "prd_analysis_complete", "data": {"requestId": "prd-xxx", ...}}'
```

**Why this is critical:**
- UI generates a NEW requestId each time user submits/refreshes
- UI only polls for results matching its CURRENT requestId
- Old requestIds are ignored - results stored but never displayed
- This is the #1 cause of "PRD analysis didn't work" reports

**The pattern that fails:**
1. User submits PRD → requestId A
2. Claude analyzes (takes time)...
3. User refreshes → requestId B (A is now stale!)
4. Claude sends result with A → IGNORED
5. User sees nothing

**The fix:** Fetch `/api/prd-bridge/pending` RIGHT BEFORE sending to get current requestId.

---

## What Breaks the System

These actions **corrupt the workflow state** and must be avoided:

| Action | Consequence |
|--------|-------------|
| Pausing for confirmation | UI loses sync, bridge corrupts |
| Stopping at partial completion | User gets broken project |
| Not reporting progress | UI shows stale state |
| Asking clarifying questions mid-task | Workflow times out |

---

## Summary

```
START → Execute All Tasks → Test → Fix Issues → Report Completion → DONE
         ↑                                              |
         |_____________ NO STOPS IN BETWEEN ____________|
```

**The user trusts Claude to finish what was started. Honor that trust.**
