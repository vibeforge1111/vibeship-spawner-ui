# Spark Build Loop Handoff

Internal handoff for the Spawner UI, Telegram bot, Canvas, Kanban, and project preview build loop.

Last updated: 2026-05-01

## Purpose

Spark should not treat "shipped" as the end of a project.

The target product loop is:

1. User shapes or sends a build request in Telegram.
2. Spark creates a mission with the right project name, path, task split, skills, and verification plan.
3. Kanban shows mission state clearly.
4. Canvas shows task flow, skill pairing, execution status, and trace without looking frozen or spammy.
5. Telegram gives short, human-readable updates at meaningful moments.
6. Spark ships a local preview link for the built app.
7. User reviews the app and gives natural feedback.
8. Spark starts an iteration mission against the existing project, not a new scaffold.
9. Each iteration keeps the app moving toward a stronger product.

This document records what is working, what is not good enough yet, and what we need to test before calling the loop reliable.

## What Works Well Now

### Mission routing

- Detailed build prompts now route to the builder instead of being intercepted by mission update preferences or local service replies.
- Big briefs with numbered lists, paths, files, and README requirements are recognized as build intent.
- Build intent can carry mission update and link preferences without stopping the mission.
- Telegram routes build requests through the PRD bridge and includes chat, user, tier, and relay metadata.

### Mission surfaces

- Kanban receives mission lifecycle updates and generally shows the right final state after a mission completes.
- Canvas links are mission-scoped with `pipeline` and `mission` query parameters.
- Mission Control relay has stronger task history retention after `6efd69a stabilize mission trace task history`, so unrelated event noise should not collapse planned task counts for new missions.
- Mission detail routes exist and completed Kanban cards have actions for Details, Canvas, Trace, and Result.

### Project previews

- Spawner UI has local project preview routes under `/preview/[token]/index.html`.
- Telegram completion formatting can extract `project_path` and create a preview URL.
- Completion messages now avoid dumping raw command lists, exact file links, and large JSON payloads in normal mode.

### Shipped project improvement loop

- Telegram now records the latest shipped project context per chat when a provider handoff contains a project path.
- Natural feedback like "make this more Spark colored" can become an improvement mission for the existing project.
- The generated improvement mission says to read existing files, preserve the workflow, avoid scaffolding a new app, update only needed files, and verify the old smoke path plus the new change.
- This is stage one. It is enough to test the user loop, but not enough to call the iteration product complete.

### Verification coverage already in place

- Spawner UI has strong unit coverage around mission control relay, trace, board cards, project preview links, mission execution progress, skill tiers, PRD bridge, provider runtime, and route rendering.
- Telegram bot has tests for build routing, conversation intent, mission relay formatting, provider routing, access policy, workspace inspection, and Spawner summaries.
- Recent targeted Telegram test run passed with the new shipped-project improvement tests.

## What Does Not Work Good Enough Yet

### Improvement missions are not first-class in Spawner UI yet

The Telegram bot can now start an improvement mission against an existing folder, but Spawner UI does not yet have a first-class `parentMissionId`, `iterationNumber`, or `projectId` concept across Kanban, Canvas, trace, and result views.

Current risk:

- Improvement missions can look like independent new missions.
- Users may not see the lineage from "first build" to "polish pass 2".
- Canvas and Kanban do not yet tell a clear story like "Founder Signal Room, iteration 2".

### Canvas still needs a calmer execution model

Recent live runs exposed that Canvas can still feel frozen or misleading while provider work is happening.

Known symptoms:

- Overall progress can stay at zero until completion if task completion events arrive late.
- All tasks can appear running at once when the provider starts a task pack together.
- Per-task progress bars created a false sense of precision and have been a recurring source of confusion.
- Skill tags are not consistently visible on nodes during live runs.
- Execution logs can repeat low-signal heartbeat text instead of showing meaningful build activity.

Preferred direction:

- Use one mission-level progress bar based on completed tasks.
- Show task state changes, not fake per-task progress.
- If parallel execution is real, show it explicitly as a parallel batch.
- If execution is single-provider packed work, make it visually clear that Spark is working through a task pack.
- Keep logs focused on meaningful checkpoints: planning ready, task started, task completed, verification started, verification passed, blocker found, shipped.

### Telegram still needs more conversation-loop testing

We improved deterministic interception, but the highest-risk area is still natural conversation.

Current risk:

- A short phrase can still be interpreted by an older deterministic route.
- Follow-up references like "that", "the second", "make it brighter", or "continue from here" need broad coverage.
- The bot needs to know when to ask one helpful question and when to start building.
- Telegram completion should consistently provide the project preview link, not the Spawner UI link, when the user asks for the shipped app.

### Preview service defaults need operational discipline

Recommended defaults are:

- Spawner UI: `http://127.0.0.1:3333`
- Project previews: `http://127.0.0.1:5555`

Current risk:

- Port `5555` can be occupied, causing ad hoc previews on `5556`.
- If the preview server is not managed by Spark, Telegram can provide a link that does not work.
- The system should detect preview port conflicts and either start a managed preview server or clearly report the fallback URL.

### Skill pairing visibility is incomplete

Skill pairing exists in the analysis and task pipeline, but it is not always visible in the final user-facing surfaces.

Current risk:

- Users cannot tell why Spark is better than a raw coding agent.
- Canvas nodes can lose the visible "this task is powered by these skills" feeling.
- Free and pro skill tiers need clearer runtime enforcement and visual explanation.

### Checkpoints and review are not productized enough

Spawner UI has checkpoint and partial resume code, but the review loop is not yet the user's natural path after a build ships.

Needed:

- A post-ship review panel.
- Clear "Improve this" action from Result, Kanban, Canvas, and project preview.
- A saved checklist of feedback items.
- Follow-up missions that target failed or weak checklist items.

## Unit Testing Gaps

### Spawner UI

Add or strengthen tests for:

1. Improvement mission lineage
   - Given a parent mission and project path, Kanban shows iteration metadata.
   - Canvas links preserve parent and current mission.
   - Trace exposes parent mission, project path, and iteration number.

2. Mission-level progress
   - Progress is `completedTasks / totalTasks`.
   - Running tasks do not count as completed.
   - Failed tasks are visible and do not silently mark mission complete.
   - Late task-completion bursts update progress once without duplicate jumps.

3. Parallel task display
   - A provider task pack with 10 tasks is shown as a batch, not as 10 completed tasks.
   - Parallel starts do not imply completion.
   - Single-provider packed work is labeled clearly.

4. Canvas node skill tags
   - Analysis skills appear on node metadata.
   - Free tier shows the limited skill set.
   - Pro tier shows expanded skill availability.
   - Missing skills produce a useful fallback badge, not an empty UI.

5. Project preview routing
   - Preview URL token decodes to the project path.
   - Preview roots reject unsafe paths.
   - Default port is `5555`.
   - If preview URL base is configured, all handoff links use it.

6. Completion and result views
   - Completed mission result includes project preview link when project path exists.
   - Result view does not show raw command noise in the primary summary.
   - "Improve this" action produces the right payload for an iteration mission.

7. Event retention
   - Task history remains stable after unrelated missions emit noisy events.
   - A mission with 10 planned tasks still renders 10 tasks after 100 unrelated events.
   - Trace API and Kanban agree on total, completed, running, failed, and waiting counts.

### Telegram Bot

Add or strengthen tests for:

1. Shipped project context
   - Provider handoff with `project_path` records active project context.
   - Freeform Codex response with "built at path" records active project context.
   - Preview URL in provider response can be decoded back to project path.
   - A second improvement on the same path increments iteration.

2. Natural improvement intent
   - "make this more Spark colored" starts an improvement mission.
   - "change the spacing here" starts an improvement mission.
   - "add a better onboarding screen" starts an improvement mission.
   - "remove the noisy stats section" starts an improvement mission.
   - "the mobile layout feels cramped" starts an improvement mission.
   - "give me the localhost" does not start an improvement mission.
   - "is it still running" does not start an improvement mission.

3. Context references
   - "the second" resolves against the latest local option list.
   - "first one" resolves against the latest local option list.
   - "last one" resolves against the latest local option list.
   - If no option list exists, Spark asks a natural clarification instead of saying "no prior list".

4. Deterministic route suppression
   - Detailed build prompt with preference language still starts a mission.
   - Localhost question after a shipped app returns the project preview link.
   - Workspace inspection replies do not steal explicit build prompts.
   - Access preference changes do not stop an obvious build request.

5. Conversational scoping
   - Vague "build a maze game" asks one or two useful questions.
   - Detailed project brief starts without unnecessary questions.
   - "you decide" after scoping starts with the recommended default.
   - "go" after scoping starts the mission.

6. Telegram message shape
   - Canvas-ready message is skimmable and includes all steps without code noise.
   - Task started messages are not spammy.
   - Heartbeats suppress repeated elapsed-time-only updates.
   - Completion message includes a project preview link and next-polish line.

## Telegram Conversation Probes

Use these as live tests after each routing or message-quality change.

### Probe 1: Detailed build must start

Send:

```text
Hey Spark, let’s build a real project called Founder Signal Room.

Build it at C:\Users\USER\Desktop\founder-signal-room.

This should be a private, no-build-step vanilla-JS web app for a founder who wants to turn messy weekly notes into a living strategy room.

Core workflow:
- paste messy weekly notes
- extract signals into customer pain, product bets, growth signals, risks, and decisions
- edit cards
- mark cards active, resolved, or needs evidence
- refresh a living strategy document
- persist data in localStorage

Please use advanced PRD planning first, attach relevant skills, show the mission in Kanban and Canvas, then build and verify it.
```

Expected:

- Build starts.
- No "saved preference only" reply.
- Project name is `Founder Signal Room`.
- Kanban link comes first.
- Canvas link arrives when ready.
- Task count matches scope.

### Probe 2: Natural post-ship improvement

After the project ships, send:

```text
make this more Spark colored and make the strategy document feel more alive
```

Expected:

- Spark recognizes the latest shipped project.
- Spark says it will improve that project.
- Mission targets the existing project path.
- Project name should look like `Founder Signal Room polish 2`.
- It should not create a brand-new scaffold.

### Probe 3: Preview link retrieval

Send:

```text
give me the localhost for this app
```

Expected:

- Spark sends the project preview link.
- It does not send only `http://127.0.0.1:3333`.
- It does not start a mission.

### Probe 4: Option references

Send:

```text
Hey Spark, I want to build something playful with Three.js, maybe a tiny magical object maker. Can we shape the idea first?
```

Then pick:

```text
the second
```

Expected:

- Spark resolves "the second" against its last option list.
- It should not say there is no prior list.
- It should continue the conversation naturally.

### Probe 5: One-word launch

After Spark recommends a direction, send:

```text
go
```

Expected:

- Spark starts the mission.
- It does not ask the same questions again.
- It uses the recommended direction in the build brief.

### Probe 6: Status versus improvement

Send during a run:

```text
is it still running
```

Expected:

- Spark gives status.
- It does not start an improvement mission.

Then after ship, send:

```text
the mobile layout feels cramped, fix that
```

Expected:

- Spark starts an improvement mission on the existing app.

### Probe 7: Mission update preference plus build

Send:

```text
Build this at C:\Users\USER\Desktop\spark-test-loop: a vanilla-JS static app called Spark Test Loop. Files: index.html, styles.css, app.js, README.md. No build step.

Make a compact dark tool for testing Spark build iterations.

Also keep Telegram updates normal and include both Kanban and Canvas links.
```

Expected:

- Build starts.
- Preferences are saved, but do not swallow the build.

## Recommended Stage Two

1. Add first-class project lineage in Spawner UI.
   - `projectId`
   - `parentMissionId`
   - `iterationNumber`
   - `projectPath`
   - `previewUrl`

2. Add "Improve this" actions.
   - Result page
   - Kanban card
   - Canvas execution panel
   - Project preview handoff message

3. Replace fake task progress with mission-level completion progress.
   - Use `done / total`.
   - Show running and failed counts separately.
   - Remove per-task bars unless a provider emits real subtask progress.

4. Make skill pairing visible again.
   - Node badges for matched skills.
   - Task status list skill chips.
   - Free versus pro skill availability surfaced without clutter.

5. Add a post-ship review checklist.
   - User feedback items.
   - Spark-suggested improvements.
   - Verification items.
   - "Run polish pass" action.

6. Add a managed preview server health check.
   - Default preview base: `http://127.0.0.1:5555`.
   - Detect port conflicts.
   - Surface fallback URL clearly.

7. Add live smoke harnesses.
   - Telegram natural build conversation.
   - Canvas mission progression.
   - Kanban status progression.
   - Preview link after completion.
   - Improvement mission after completion.

## Current Branch Notes

Spawner UI recent relevant commits:

- `6efd69a stabilize mission trace task history`
- `7b86719 merge origin main into spawner ui`

Telegram bot recent relevant commits:

- `198fb0a add shipped project improvement loop`
- `ebc836e prioritize build briefs in Telegram routing`
- `8b6dcc5 make Telegram tests token-safe`

Known local caveat:

- Spawner UI currently has unrelated memory-dashboard worktree files. Keep future mission-loop edits scoped and stage only explicit files.
- Telegram bot has unrelated dirty files in many modules from prior runtime work. Keep future routing changes scoped and stage only explicit files.

## Definition Of Good Enough For This Loop

The loop is not good enough until all of these are true:

- A non-technical user can build, review, and improve a project without learning commands.
- Spark always knows the latest shipped project in that chat.
- Natural feedback starts an iteration mission on the existing folder.
- Completion always includes the correct project preview link.
- Kanban and Canvas show iteration lineage clearly.
- The trace explains what happened without raw provider noise.
- Unit tests cover build start, ship, preview link, feedback, improvement mission, and second improvement.
- Live Telegram probes pass repeatedly without deterministic replies stealing the conversation.
