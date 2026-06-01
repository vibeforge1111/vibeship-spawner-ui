export function parseRetryAfterMs(headerValue: string | null, fallbackMs: number, nowMs = Date.now()): number {
	if (!headerValue) return fallbackMs;
	const trimmed = headerValue.trim();
	if (!trimmed) return fallbackMs;

	if (/^\d+$/.test(trimmed)) {
		const seconds = Number.parseInt(trimmed, 10);
		return Number.isFinite(seconds) ? seconds * 1000 : fallbackMs;
	}

	const looksLikeHttpDate = /,/.test(trimmed) && /\bGMT\b/i.test(trimmed);
	const retryAtMs = looksLikeHttpDate ? Date.parse(trimmed) : Number.NaN;
	if (Number.isFinite(retryAtMs)) {
		return Math.max(0, retryAtMs - nowMs);
	}

	return fallbackMs;
}
