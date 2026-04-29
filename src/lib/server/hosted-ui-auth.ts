import { redirect, type Cookies } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';

export interface HostedUiAuthEnv {
	[key: string]: string | undefined;
	SPARK_UI_API_KEY?: string;
	SPARK_BRIDGE_API_KEY?: string;
	EVENTS_API_KEY?: string;
	MCP_API_KEY?: string;
}

const STATIC_PREFIXES = ['/_app/', '/favicon', '/robots.txt', '/spark-live/login'];
const COOKIE_OPTIONS = {
	httpOnly: true,
	sameSite: 'strict' as const,
	secure: true,
	path: '/',
	maxAge: 60 * 60 * 12
};
const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX_FAILURES = 12;
const authFailures = new Map<string, { count: number; resetAt: number }>();

function constantTimeEquals(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function hostedUiAuthEnabled(env: HostedUiAuthEnv): boolean {
	return Boolean(env.SPARK_UI_API_KEY?.trim());
}

export function hostedUiAuthClientKey(request: Request): string {
	const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
	return forwardedFor || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export function hostedUiAuthRateLimitStatus(clientKey: string, now = Date.now()): {
	blocked: boolean;
	retryAfterSeconds: number;
} {
	const current = authFailures.get(clientKey);
	if (!current || current.resetAt <= now) {
		authFailures.delete(clientKey);
		return { blocked: false, retryAfterSeconds: 0 };
	}
	return {
		blocked: current.count >= AUTH_MAX_FAILURES,
		retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
	};
}

export function recordHostedUiAuthFailure(clientKey: string, now = Date.now()): void {
	const current = authFailures.get(clientKey);
	if (!current || current.resetAt <= now) {
		authFailures.set(clientKey, { count: 1, resetAt: now + AUTH_WINDOW_MS });
		return;
	}
	current.count += 1;
}

export function clearHostedUiAuthFailures(clientKey: string): void {
	authFailures.delete(clientKey);
}

export function resetHostedUiAuthRateLimits(): void {
	authFailures.clear();
}

export function hostedUiAuthPathIsExempt(pathname: string): boolean {
	return STATIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

export function hostedUiRequestToken(request: Request, url: URL, cookies: Cookies): string | null {
	const headerToken =
		request.headers.get('x-spawner-ui-key') ||
		request.headers.get('x-api-key') ||
		request.headers.get('x-mcp-api-key');
	if (headerToken?.trim()) return headerToken.trim();

	const authorization = request.headers.get('authorization');
	const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
	if (bearer) return bearer;

	const queryToken = url.searchParams.get('uiKey') || url.searchParams.get('apiKey');
	if (queryToken?.trim()) return queryToken.trim();

	return cookies.get('spawner_ui_api_key') || null;
}

export function hostedUiTokenIsValid(token: string | null, env: HostedUiAuthEnv): boolean {
	const expected = env.SPARK_UI_API_KEY?.trim();
	return Boolean(token && expected && constantTimeEquals(token, expected));
}

export function persistHostedUiAuth(cookies: Cookies, env: HostedUiAuthEnv): void {
	const uiKey = env.SPARK_UI_API_KEY?.trim();
	if (uiKey) {
		cookies.set('spawner_ui_api_key', uiKey, COOKIE_OPTIONS);
	}

	const controlKey = env.SPARK_BRIDGE_API_KEY?.trim() || env.MCP_API_KEY?.trim();
	if (controlKey) {
		cookies.set('spawner_control_api_key', controlKey, COOKIE_OPTIONS);
	}

	const eventsKey = env.EVENTS_API_KEY?.trim() || env.MCP_API_KEY?.trim() || controlKey;
	if (eventsKey) {
		cookies.set('spawner_events_api_key', eventsKey, COOKIE_OPTIONS);
	}
}

export function redirectWithoutAuthQuery(url: URL): never {
	const clean = new URL(url);
	clean.searchParams.delete('uiKey');
	clean.searchParams.delete('apiKey');
	throw redirect(303, clean.pathname + clean.search + clean.hash);
}
