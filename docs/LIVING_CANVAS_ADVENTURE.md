# Living Canvas + Adventure/Joy Preset

## Intent
This update makes canvas workflows feel alive while keeping UX organized:

- quick-add a structured **Adventure / Joy** pipeline from `/canvas`
- show live execution state directly on nodes and paths (not just in logs)
- run with **Codex + Claude together** from a normal Run flow when both API keys are present

## How it is intended to work

### 1) Adventure / Joy quick preset
On `/canvas`, the second toolbar row now includes an **Adventure/Joy** button.

Clicking it will:
- add a multi-node template with organized lanes (discover -> build -> validate -> ship)
- auto-connect the flow
- frame the newly-added nodes in view

The preset is also available in Builder templates as **Adventure / Joy Pipeline**.

### 2) Live canvas motion during execution
During Run flow:
- nodes visibly transition `idle -> running -> success/fail`
- running nodes show pulse/ring activity
- active connections are highlighted in brighter teal
- active paths show a moving traveler dot for step motion cues
- completed/error paths use stable success/error colors

This keeps movement cues obvious without flooding the canvas.

### 3) Codex + Claude simultaneous run
If both provider keys are present in Mission Settings:
- `claude` key
- `codex` key

Then Run flow automatically uses:
- multi-LLM enabled
- `parallel_consensus` strategy
- auto-dispatch enabled
- both providers turned on

So a single **Run Workflow** action starts both agents in parallel.

## How to invoke

1. Open `/canvas`
2. Click **Adventure/Joy** in the toolbar
3. Open **Run**
4. In Mission Settings (if first run), set provider keys:
   - Claude (`ANTHROPIC_API_KEY`)
   - Codex (`OPENAI_API_KEY`)
5. Click **Run Workflow**

## How to verify real-time movement + execution

### Visual checks on canvas
Look for all of the following during active run:
- one or more nodes in `running` state with pulse ring
- connection segments turning active teal
- moving dot traveling along active path
- nodes settling into success/error badges as tasks complete
- path colors stabilizing to success/error after completion

### Execution panel checks
- "Live Agent Activity" shows both providers progressing
- "Task Event Stream" updates in real time
- logs continue to append while node/path visuals update

## Validation command
Run locally on port `3334`:

```bash
npm run dev -- --port 3334
```

Open:

- http://localhost:3334/canvas

## Known gaps

- auto dual-provider enable depends on local key presence in browser storage
- no per-connection percentage (active path is state-based, not numeric)
- traveler animation is visual-only (not currently tied to exact progress value)

## Recommended next incremental improvements

1. add per-edge progress percentages for long-running tasks
2. add a lightweight lane header overlay (Discovery / Build / Validate / Ship)
3. let users save custom "quick presets" from current selection
4. add an explicit "Dual Run" toggle near Run button for deterministic UX
