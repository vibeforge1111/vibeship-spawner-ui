# Bug Hunter Proof — PR #130

## Fix: `selectWebhookUrlsForMissionEvent` falls back to all webhooks on relay target mismatch

### Before

```typescript
if (target.url) {
    return urls.filter((url) => url === target.url);
    // Returns [] when no configured webhook matches → all webhooks silently skip this event
}
return urls.filter((url) => {
    if (target.port !== null && webhookPort(url) === target.port) return true;
    return false;
    // Same silent drop when no webhook matches the port
});
```

When an event carried a `telegramRelay.url` not in `MISSION_CONTROL_WEBHOOK_URLS`, every configured webhook received nothing. The call site (`if (webhookUrls.length > 0)`) never posted. No log was emitted; the event was silently blackholed.

### After

```typescript
if (target.url) {
    const matched = urls.filter((url) => url === target.url);
    return matched.length > 0 ? matched : urls;  // fallback to all on no match
}
const portMatched = urls.filter((url) => {
    if (target.port !== null && webhookPort(url) === target.port) return true;
    return false;
});
return portMatched.length > 0 ? portMatched : urls;  // same fallback for port branch
```

Selective routing is preserved when a relay target matches a configured webhook. When there is no match, the full configured webhook list is used — no silent drops.

### Why

Relay targets are advisory routing hints, not hard suppression filters. An operator who configures `MISSION_CONTROL_WEBHOOK_URLS` expects to receive all mission events. A mismatched `telegramRelayUrl` field (different subdomain, HTTP vs HTTPS, local vs production) should narrow delivery when possible but never cancel it.

### Evidence

| Field | Value |
|---|---|
| File | `src/lib/server/mission-control-relay.ts` |
| Function | `selectWebhookUrlsForMissionEvent` |
| Change | 4 lines (2 per branch: named variable + conditional return) |
| Existing tests | All pass unchanged — URL match, port match, no-relay broadcast |
| New behaviour | Relay URL mismatch → returns full `urls` list instead of `[]` |
| Packet validation | `pass` — 0 errors, 0 warnings |
| Side effects | None — pure function, no I/O, no state |
