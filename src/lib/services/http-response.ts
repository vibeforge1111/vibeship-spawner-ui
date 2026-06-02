export async function parseJsonResponse<T>(response: Response, fallback: T): Promise<T> {
	try {
		return (await response.json()) as T;
	} catch {
		return fallback;
	}
}

export async function responseTextSnippet(response: Response, maxLength = 200): Promise<string> {
	try {
		const text = await response.text();
		return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
	} catch {
		return '';
	}
}

export async function responseStatusMessage(
	response: Response,
	fallback: string,
	maxLength = 200
): Promise<string> {
	const detail = await responseTextSnippet(response, maxLength);
	return `${fallback} (HTTP ${response.status})${detail ? `: ${detail}` : ''}`;
}
