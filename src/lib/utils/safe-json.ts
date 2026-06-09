type JsonParseResult<T> =
	| { ok: true; value: T; error?: undefined }
	| { ok: false; value: T; error: unknown };

function errorMessage(error: unknown): string {
	return error instanceof Error && error.message ? error.message : String(error);
}

export function stripJsonBom(raw: string): string {
	return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

export function tryParseJson<T>(
	raw: string | null | undefined,
	fallback: T,
	label = 'payload'
): JsonParseResult<T> {
	if (!raw || !String(raw).trim()) return { ok: true, value: fallback };

	try {
		return { ok: true, value: JSON.parse(stripJsonBom(raw)) as T };
	} catch (error) {
		console.warn(`[safe-json] Invalid JSON (${label}): ${errorMessage(error)}`);
		return { ok: false, value: fallback, error };
	}
}

export function parseJsonOrThrow<T>(raw: string, label = 'payload'): T {
	try {
		return JSON.parse(stripJsonBom(raw)) as T;
	} catch (error) {
		throw new Error(`Invalid JSON (${label}): ${errorMessage(error)}`);
	}
}

export function parseJsonOrFallback<T>(
	raw: string | null | undefined,
	fallback: T,
	label = 'payload'
): T {
	return tryParseJson(raw, fallback, label).value;
}
