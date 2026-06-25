// Provider clients call sleep() with the value returned here before the
// next retry attempt. Without an upper bound a single 429/5xx response
// that carries `Retry-After: 86400` (one day -- some quota tiers emit
// this on hard daily caps) freezes the mission executor for 24h per
// attempt, blocking the Spawner mission queue and producing no visible
// progress to the operator. Cap the honoured delay so a misbehaving or
// quota-exhausted upstream cannot stall a mission for hours.
const MAX_RETRY_AFTER_MS = 60_000;

export function parseRetryAfterMs(headerValue: string | null, fallbackMs: number, nowMs = Date.now()): number {
	if (!headerValue) return fallbackMs;
	const trimmed = headerValue.trim();
	if (!trimmed) return fallbackMs;

	if (/^\d+$/.test(trimmed)) {
		const seconds = Number.parseInt(trimmed, 10);
		if (!Number.isFinite(seconds)) return fallbackMs;
		return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
	}

	const looksLikeHttpDate = /,/.test(trimmed) && /\bGMT\b/i.test(trimmed);
	const retryAtMs = looksLikeHttpDate ? Date.parse(trimmed) : Number.NaN;
	if (Number.isFinite(retryAtMs)) {
		const delta = Math.max(0, retryAtMs - nowMs);
		return Math.min(delta, MAX_RETRY_AFTER_MS);
	}

	return fallbackMs;
}
