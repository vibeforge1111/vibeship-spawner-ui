# Spark Build Quality Roadmap

Purpose: make Spark meaningfully better than sending a prompt to a single agent harness. Spark should understand the job, plan the work, pair the right skills, verify the artifact, and help the user continue from real state instead of restarting from scratch.

## Order Of Attack

### Batch 1: Easy, High Leverage

1. **Mission Size Classifier**
   - Decide if a request is a tiny task, direct build, advanced PRD build, domain chip, repo feature, or multi-system project.
   - Use the class to choose PRD depth, task count, test depth, and Telegram update style.

2. **Task Count Heuristics**
   - Stop defaulting to 4 tasks.
   - Tiny static builds can use 3-5 tasks. Real tools need 6-10. Backend or multi-system work needs 10-16.
   - Add tests that prove complex briefs produce more granular task graphs.

3. **Task Quality Rubric**
   - Each task must have a clear outcome, owner skill set, acceptance criteria, and verification step.
   - Reject vague tasks like "implement core features" when the brief needs sharper division.

4. **Skill Pairing Score**
   - Score every task by how many relevant H70 skills were attached.
   - Show weak pairings in Trace and mission diagnostics before dispatch.

5. **Verification Plan Generator**
   - Generate checks before execution starts.
   - Include file checks, build checks, unit tests, browser smoke, visual smoke, WebGL fallback, API route smoke, or Python hook tests depending on project type.

6. **Final Handoff Sanitizer**
   - Convert raw provider output into a clean user-facing completion note.
   - Hide file-link spam and command noise unless the user asks for details.

7. **Completion Score**
   - Score the mission across planning, skill pairing, implementation evidence, tests, design fit, docs, and artifact readiness.
   - Start internal only, then expose as "Spark confidence" in Kanban and Trace.

8. **Resume Plan Builder**
   - If a mission fails or partially completes, generate a continuation plan from completed tasks, failed tasks, missing acceptance criteria, and provider output.
   - Never restart blindly when a project already exists.

9. **Project Name Normalizer**
   - Turn long natural language ideas into clean project names.
   - Ask only if confidence is low. Otherwise choose a useful name and mention it.

10. **Telegram Brief Compacting**
   - Convert huge prompts into compact mission cards.
   - Keep links, mission id, project path, and current phase. Move long goal text into Trace.

### Batch 2: Medium Complexity, Big Quality Lift

11. **Design Input Intake**
   - Accept `DESIGN.md`, UI wizard output, screenshots, brand notes, or existing CSS as design constraints.
   - Feed them into frontend planning and verification.

12. **Design Review Pass**
   - After frontend builds, run a visual checklist for hierarchy, spacing, responsiveness, text fit, empty states, and domain fit.
   - For Three.js and canvas apps, check nonblank rendering and controls.

13. **Artifact Contract Per Project Type**
   - Static app: exact requested files, direct launch path, no hidden build tooling.
   - Domain chip: `spark-chip.json`, package, hooks, tests, docs.
   - Svelte feature: route, server service, tests, docs, no private data leakage.
   - Backend/API: schema, route, validation, persistence, integration tests.

14. **Acceptance Criteria Diff**
   - Parse acceptance criteria from the PRD and mark each as proven, unproven, failed, or out of scope.
   - Use this to decide whether a mission is truly complete.

15. **Provider Output Auditor**
   - Detect when an agent says "done" without evidence.
   - Require actual checks, changed files, and acceptance evidence before Spark marks the mission complete.

16. **File System Reality Check**
   - After completion, inspect the target directory.
   - Confirm expected files exist, no unwanted package files appeared, no empty files, and no secret or runtime junk was created.

17. **Route And Preview Link Resolver**
   - Share a useful local link when possible.
   - Static apps get direct file or preview link. Svelte routes get localhost route. Repo projects get project folder and test command.

18. **Quality Gates By Risk**
   - Low risk: static file checks and syntax.
   - Medium risk: unit tests and browser smoke.
   - High risk: integration tests, route smoke, visual checks, and continuation plan if anything is unproven.

19. **Mission Trace Bundle**
   - Keep the full raw trace in one place: PRD, task graph, skill map, provider events, checks, failures, and final evidence.
   - Let Telegram and Kanban stay compact while Trace keeps the truth.

20. **Build Activity Deduper**
   - Merge repeated "still working" and duplicate progress entries.
   - Promote only meaningful changes: task started, skill loaded, file set changed, check passed, blocker found, task completed.

### Batch 3: Advanced Differentiators

21. **Architecture Review Stage**
   - For larger builds, create an architecture note before execution.
   - Check boundaries, data model, user flows, test seams, and likely failure modes.

22. **Test Authoring Stage**
   - For nontrivial projects, add tests as a first-class task instead of a final afterthought.
   - Include unit tests for core logic and route rendering where applicable.

23. **Independent Verifier Agent**
   - After the builder finishes, run a separate verification pass with a different prompt and stricter acceptance criteria.
   - This is how Spark beats one-agent completion bias.

24. **Design QA Agent**
   - Separate builder from design reviewer.
   - The reviewer should inspect screenshots, mobile layout, text fit, and visual polish.

25. **Project Continuation Memory**
   - Store project decisions, design constraints, test gaps, and unresolved tasks.
   - When the user says "continue this," Spark should know where to resume.

26. **Skill Coverage Suggestions**
   - If a project lacks needed skills, suggest the missing skill family before or during planning.
   - Example: "This needs realtime plus observability, but only frontend skills were paired."

27. **Build Quality Benchmark Suite**
   - Maintain fixed scenario prompts for static apps, Three.js tools, dashboards, domain chips, backend services, and multi-system features.
   - Run them after major Spawner changes to catch regressions.

28. **User Feedback To Repair Plan**
   - When the user says "this part is not plugged in," translate feedback into a scoped repair mission.
   - Preserve existing completed work and only target missing pieces.

29. **Done Definition Registry**
   - Define "done" per project type.
   - Spark should not use one generic completion standard for games, dashboards, domain chips, and backend APIs.

30. **Outcome Comparison Against Raw Agent**
   - For selected benchmark prompts, compare Spark output to a direct Codex or Claude run.
   - Measure whether Spark improved task division, test coverage, design quality, and final usability.

## First Work Items

Start here because each item is small enough to land safely and gives visible quality gains:

1. Add a mission size classifier.
2. Add task count heuristic tests.
3. Add a task quality rubric helper.
4. Add skill pairing score to Trace data.
5. Add a verification plan generator for static, Three.js, Svelte route, backend/API, and domain-chip projects.
6. Add final handoff sanitizer tests for Telegram completion messages.

## Success Bar

Spark is improving when:

- Complex briefs produce richer task graphs without bloating small tasks.
- Each task has useful skills, acceptance criteria, and verification.
- Canvas, Kanban, Trace, and Telegram all show the same state.
- Provider "done" is treated as a claim until Spark verifies it.
- The user can resume partial work instead of starting again.
- The final project is more usable, better tested, and better explained than a raw one-agent run.
