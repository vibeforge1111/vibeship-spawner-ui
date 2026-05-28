# Bug Hunter Proof — PR #129

## Fix: `handleMissionStop` marks user-stopped missions as `cancelled` not `failed`

### Before

```typescript
// src/lib/services/spark-agent-bridge.ts — handleMissionStop
session.mission.status = 'failed';
session.mission.error = 'Stopped by Spark agent command';
```

Every deliberately stopped mission appeared in the **Failed** column on the Mission Board. The `spark_agent.mission.status` event carried `status: 'failed'`, causing downstream relay handlers to emit `mission_failed` for what was a clean user stop. Operators had no way to distinguish a crash from an intentional stop in the board or trace logs.

### After

```typescript
session.mission.status = 'cancelled';
session.mission.error = null;
```

Stopped missions land in the **Cancelled** column. No error is injected. The emitted `spark_agent.mission.status` event carries `status: 'cancelled'`, aligning with the existing `mission_cancelled` relay event type and the `'cancelled'` board bucket. `Mission.status` union in `mcp-client.ts` extended with `'cancelled'` for type safety.

### Why

`handleMissionStop` diverged from `handleMissionStatusChange` — the latter correctly routes lifecycle transitions, but `handleMissionStop` hard-coded `'failed'` + an error string. User-initiated stops are semantically `cancelled`, not failed. The relay, board, and `canRunCreatorMissionBoardCard` guard all already treat `'cancelled'` as a distinct terminal state.

### Evidence

| Field | Value |
|---|---|
| Files changed | `src/lib/services/spark-agent-bridge.ts`, `src/lib/services/mcp-client.ts` |
| Lines changed | 3 (status assignment, error assignment, type union) |
| Smoke test | node invariant check: `failed=false cancelled=true errorInject=false nullError=true` — pass |
| Packet validation | `pass` — 0 errors, 0 warnings |
| Side effects | None — private method, no callers outside the class, additive type union change |
