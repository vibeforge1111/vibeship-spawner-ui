type JsonParseResult<T> =
	| { ok: true; value: T; error?: undefined }
	| { ok: false; value: T; error: unknown };

function errorMessage(error: unknown): string {
	return error instanceof Error && error.message ? error.message : String(error);
}

export function tryParseJson<T>(
	raw: string | null | undefined,
	fallback: T,
	label = 'payload'
): JsonParseResult<T> {
	if (!raw || !String(raw).trim()) return { ok: true, value: fallback };

	try {
		return { ok: true, value: JSON.parse(raw) as T };
	} catch (error) {
		console.warn(`[safe-json] Invalid JSON (${label}): ${errorMessage(error)}`);
		return { ok: false, value: fallback, error };
	}
}

export function parseJsonOrFallback<T>(
	raw: string | null | undefined,
	fallback: T,
	label = 'payload'
): T {
	return tryParseJson(raw, fallback, label).value;
}
