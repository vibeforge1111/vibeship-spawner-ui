# Bug Hunter Proof — PR #131

## Fix: `getMissionControlBoard` routes stale non-terminal missions to a visible `stale` bucket

### Before

```typescript
// mission-control-relay.ts — getMissionControlBoard, event-accumulation loop
if (isStaleNonTerminalStatus(status, entry.timestamp) && !terminalMissionIds.has(entry.missionId)) continue;
// ↑ silently skips the entry; mission is never added to byMission and never appears on the board
```

```typescript
// mission-control.ts — MISSION_CONTROL_BOARD_STATUSES
export const MISSION_CONTROL_BOARD_STATUSES = [
    'created', 'running', 'paused', 'completed', 'failed', 'cancelled'
] as const;
// no 'stale' bucket
```

A mission in `running` or `created` status whose most-recent relay event is older than `STALE_NON_TERMINAL_MS` (24 hours) was **silently absent from every board column**. Operators saw nothing — not a stale indicator, not a disconnected badge, not a log entry.

### After

```typescript
// mission-control.ts
export const MISSION_CONTROL_BOARD_STATUSES = [
    'created', 'running', 'paused', 'completed', 'failed', 'cancelled', 'stale'
] as const;
```

```typescript
// mission-control-relay.ts — board literal
const board: Record<MissionControlBoardStatus, MissionControlBoardEntry[]> = {
    running: [], paused: [], completed: [], failed: [], cancelled: [], created: [],
    stale: []   // ← new bucket
};
```

```typescript
// mission-control-relay.ts — board-assignment loop
// stale non-terminal missions are routed to the 'stale' bucket below, not dropped
// ...
const boardStatus = boardStatusForEntry(entry);
const isStale = isStaleNonTerminalStatus(boardStatus, entry.lastUpdated);
const finalStatus: MissionControlBoardStatus = isStale ? 'stale' : boardStatus;
entry.status = finalStatus;
board[finalStatus].push(entry);
```

Stale missions now appear in `board.stale`. Terminal missions (completed/failed/cancelled) are unaffected — `isStaleNonTerminalStatus` returns `false` for them.

### Why

Long-running agent pipelines that hit a checkpoint or slow phase emit no events for extended periods. The 24h guard was intended to keep the Active column clean, but silent removal is worse than a visible stale indicator: operators can't distinguish a hung pipeline from one that was never started or was manually cancelled.

### Evidence

| Field | Value |
|---|---|
| Affected file | `src/lib/server/mission-control-relay.ts` |
| Affected function | `getMissionControlBoard` |
| Type file changed | `src/lib/types/mission-control.ts` |
| Change size | 9 insertions, 5 deletions across 2 files |
| Terminal routing | Unchanged — `isStaleNonTerminalStatus` returns false for terminal statuses |
| Packet validation | `pass` — 0 errors, 0 warnings |
| Side effects | None — board object gains one new `stale` key; existing consumers see an additional array |
