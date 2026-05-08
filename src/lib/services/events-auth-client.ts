function readPublicKey(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function getEventsApiKey(): string | null {
	return (
		readPublicKey(import.meta.env.PUBLIC_EVENTS_API_KEY) ||
		readPublicKey(import.meta.env.PUBLIC_MCP_API_KEY)
	);
}

export function withEventsAuth(path: string): string {
	return path;
}

export function getEventsAuthHeaders(): Record<string, string> {
	const apiKey = getEventsApiKey();
	if (!apiKey) {
		return {};
	}
	return { 'x-api-key': apiKey };
}
