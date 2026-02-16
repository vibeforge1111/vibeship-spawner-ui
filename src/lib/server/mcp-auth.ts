import { env } from '$env/dynamic/private';
import { json, type RequestEvent } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function constantTimeEquals(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);

	if (leftBuffer.length !== rightBuffer.length) {
		return false;
	}

	return timingSafeEqual(leftBuffer, rightBuffer);
}

function extractApiKey(event: RequestEvent): string | null {
	const apiKeyHeader = event.request.headers.get('x-mcp-api-key') || event.request.headers.get('x-api-key');
	if (apiKeyHeader && apiKeyHeader.trim().length > 0) {
		return apiKeyHeader.trim();
	}

	const authorization = event.request.headers.get('authorization');
	if (!authorization) {
		return null;
	}

	const match = authorization.match(/^Bearer\s+(.+)$/i);
	return match?.[1]?.trim() || null;
}

function isLoopbackRequest(event: RequestEvent): boolean {
	const requestHost = new URL(event.request.url).hostname;
	if (!LOOPBACK_HOSTS.has(requestHost)) {
		return false;
	}

	try {
		const clientAddress = event.getClientAddress();
		return LOOPBACK_HOSTS.has(clientAddress);
	} catch {
		// Some adapters do not expose client address; host validation is still enforced.
		return true;
	}
}

/**
 * Guard MCP routes with either a configured API key or localhost-only access.
 */
export function requireMcpAuth(event: RequestEvent): Response | null {
	const configuredKey = env.MCP_API_KEY?.trim();
	if (configuredKey) {
		const incomingKey = extractApiKey(event);
		if (!incomingKey || !constantTimeEquals(configuredKey, incomingKey)) {
			return json({ error: 'Unauthorized MCP request' }, { status: 401 });
		}
		return null;
	}

	if (!isLoopbackRequest(event)) {
		return json(
			{
				error: 'MCP routes require MCP_API_KEY for non-local requests',
			},
			{ status: 401 }
		);
	}

	return null;
}
