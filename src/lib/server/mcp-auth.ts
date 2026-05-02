import { env } from '$env/dynamic/private';
import { json, type RequestEvent } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const rateLimitBuckets = new Map<string, number[]>();

function constantTimeEquals(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);

	if (leftBuffer.length !== rightBuffer.length) {
		return false;
	}

	return timingSafeEqual(leftBuffer, rightBuffer);
}

interface ApiKeyExtractionOptions {
	queryParam?: string;
	cookieName?: string;
}

function getCookieValue(cookieHeader: string | null, cookieName: string | undefined): string | null {
	if (!cookieHeader || !cookieName) {
		return null;
	}

	const pairs = cookieHeader.split(';');
	for (const pair of pairs) {
		const [rawName, ...rawValue] = pair.trim().split('=');
		if (rawName === cookieName) {
			const value = rawValue.join('=').trim();
			return value.length > 0 ? decodeURIComponent(value) : null;
		}
	}

	return null;
}

function extractApiKey(event: RequestEvent, options: ApiKeyExtractionOptions = {}): string | null {
	const apiKeyHeader = event.request.headers.get('x-mcp-api-key') || event.request.headers.get('x-api-key');
	if (apiKeyHeader && apiKeyHeader.trim().length > 0) {
		return apiKeyHeader.trim();
	}

	const authorization = event.request.headers.get('authorization');
	if (authorization) {
		const match = authorization.match(/^Bearer\s+(.+)$/i);
		const bearerToken = match?.[1]?.trim() || null;
		if (bearerToken) {
			return bearerToken;
		}
	}

	if (options.queryParam) {
		try {
			const value = new URL(event.request.url).searchParams.get(options.queryParam);
			if (value && value.trim().length > 0) {
				return value.trim();
			}
		} catch {
			// Ignore malformed URLs and continue to cookie fallback.
		}
	}

	const cookieToken = getCookieValue(event.request.headers.get('cookie'), options.cookieName);
	if (cookieToken) {
		return cookieToken;
	}

	const genericCookieToken =
		getCookieValue(event.request.headers.get('cookie'), 'spawner_control_api_key') ||
		getCookieValue(event.request.headers.get('cookie'), 'spawner_events_api_key');
	if (genericCookieToken) {
		return genericCookieToken;
	}

	return null;
}

function getClientIdentity(event: RequestEvent): string {
	const apiKey = extractApiKey(event);
	if (apiKey) return `key:${apiKey}`;
	try {
		return `ip:${event.getClientAddress()}`;
	} catch {
		return `host:${new URL(event.request.url).hostname}`;
	}
}

function parseCsv(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(',')
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

function isOriginAllowed(event: RequestEvent, allowedOriginsEnvVar?: string): boolean {
	const origin = event.request.headers.get('origin');
	if (!origin) return true;

	const allowedOrigins = parseCsv(env[allowedOriginsEnvVar as keyof typeof env] as string | undefined);
	if (!allowedOriginsEnvVar || allowedOrigins.length === 0) {
		try {
			return new URL(origin).origin === new URL(event.request.url).origin;
		} catch {
			return false;
		}
	}
	if (allowedOrigins.length === 0) return true;
	if (allowedOrigins.includes('*')) {
		return (env.SPAWNER_ALLOW_WILDCARD_ORIGINS as string | undefined)?.trim() === '1';
	}
	return allowedOrigins.includes(origin);
}

export interface ControlAuthOptions {
	surface: string;
	apiKeyEnvVar?: string;
	fallbackApiKeyEnvVar?: string;
	fallbackApiKeyEnvVars?: string[];
	apiKeyQueryParam?: string;
	apiKeyCookieName?: string;
	allowLoopbackWithoutKey?: boolean;
	allowedOriginsEnvVar?: string;
}

export interface RateLimitOptions {
	scope: string;
	limit: number;
	windowMs: number;
}

export function requireControlAuth(event: RequestEvent, options: ControlAuthOptions): Response | null {
	const allowLoopback = options.allowLoopbackWithoutKey !== false;
	const keyEnvVars = [
		options.apiKeyEnvVar,
		options.fallbackApiKeyEnvVar,
		...(options.fallbackApiKeyEnvVars || [])
	].filter((key): key is string => Boolean(key));
	const configuredKeys = keyEnvVars
		.map((key) => (env[key as keyof typeof env] as string | undefined)?.trim())
		.filter((key): key is string => Boolean(key));

	if (!isOriginAllowed(event, options.allowedOriginsEnvVar)) {
		return json(
			{ error: `Origin is not allowed for ${options.surface}` },
			{ status: 403 }
		);
	}

	if (allowLoopback && isLoopbackRequest(event)) {
		return null;
	}

	if (configuredKeys.length > 0) {
		const incomingKey = extractApiKey(event, {
			queryParam: options.apiKeyQueryParam,
			cookieName: options.apiKeyCookieName
		});
		if (!incomingKey || !configuredKeys.some((configuredKey) => constantTimeEquals(configuredKey, incomingKey))) {
			return json({ error: `Unauthorized ${options.surface} request` }, { status: 401 });
		}
		return null;
	}

	return json(
		{
			error: `${options.surface} routes require API key for non-local requests`
		},
		{ status: 401 }
	);
}

export function enforceRateLimit(event: RequestEvent, options: RateLimitOptions): Response | null {
	const now = Date.now();
	const identity = getClientIdentity(event);
	const bucketKey = `${options.scope}:${identity}`;
	const windowStart = now - options.windowMs;
	const existing = rateLimitBuckets.get(bucketKey) || [];
	const active = existing.filter((timestamp) => timestamp >= windowStart);
	if (active.length >= options.limit) {
		return json(
			{
				error: 'Rate limit exceeded',
				scope: options.scope,
				limit: options.limit,
				windowMs: options.windowMs
			},
			{ status: 429 }
		);
	}

	active.push(now);
	rateLimitBuckets.set(bucketKey, active);
	return null;
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
		// Production loopback bypass must not rely on a spoofable Host header alone.
		return process.env.NODE_ENV === 'test';
	}
}

/**
 * Guard MCP routes with either a configured API key or localhost-only access.
 */
export function requireMcpAuth(event: RequestEvent): Response | null {
	return requireControlAuth(event, {
		surface: 'MCP',
		apiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'MCP_ALLOWED_ORIGINS'
	});
}
