import { redirect, type Cookies } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';

export interface HostedUiAuthEnv {
	[key: string]: string | undefined;
	SPARK_UI_API_KEY?: string;
	SPARK_WORKSPACE_ID?: string;
	SPARK_HOSTED_PRIVATE_PREVIEW?: string;
	SPARK_LIVE_CONTAINER?: string;
	SPARK_SPAWNER_HOST?: string;
	SPARK_ALLOWED_HOSTS?: string;
	SPARK_BRIDGE_API_KEY?: string;
	EVENTS_API_KEY?: string;
	MCP_API_KEY?: string;
}

const EXEMPT_EXACT_PATHS = new Set(['/robots.txt', '/spark-live/login']);
const EXEMPT_PATH_PREFIXES = ['/_app/', '/favicon'];
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

export function hostedUiLooksHosted(env: HostedUiAuthEnv): boolean {
	return (
		env.SPARK_LIVE_CONTAINER === '1' ||
		env.SPARK_SPAWNER_HOST === '0.0.0.0' ||
		Boolean(env.SPARK_ALLOWED_HOSTS?.trim())
	);
}

export function hostedUiReleaseLocked(env: HostedUiAuthEnv): boolean {
	return hostedUiLooksHosted(env) && env.SPARK_HOSTED_PRIVATE_PREVIEW !== '1';
}

export function hostedUiWorkspaceId(env: HostedUiAuthEnv): string | null {
	const value = env.SPARK_WORKSPACE_ID?.trim();
	return value || null;
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
	return EXEMPT_EXACT_PATHS.has(pathname) || EXEMPT_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

export function hostedUiRequestWorkspaceId(request: Request, url: URL, cookies: Cookies): string | null {
	const headerWorkspace = request.headers.get('x-spawner-workspace-id');
	if (headerWorkspace?.trim()) return headerWorkspace.trim();

	const queryWorkspace = url.searchParams.get('workspaceId') || url.searchParams.get('workspace');
	if (queryWorkspace?.trim()) return queryWorkspace.trim();

	return cookies.get('spawner_workspace_id') || null;
}

export function hostedUiTokenIsValid(token: string | null, env: HostedUiAuthEnv): boolean {
	const expected = env.SPARK_UI_API_KEY?.trim();
	return Boolean(token && expected && constantTimeEquals(token, expected));
}

export function hostedUiCredentialsAreValid(
	workspaceId: string | null,
	token: string | null,
	env: HostedUiAuthEnv
): boolean {
	const expectedWorkspaceId = hostedUiWorkspaceId(env);
	if (expectedWorkspaceId && !workspaceId) return false;
	if (expectedWorkspaceId && workspaceId && !constantTimeEquals(workspaceId, expectedWorkspaceId)) return false;
	return hostedUiTokenIsValid(token, env);
}

export function persistHostedUiAuth(cookies: Cookies, env: HostedUiAuthEnv): void {
	const uiKey = env.SPARK_UI_API_KEY?.trim();
	if (uiKey) {
		cookies.set('spawner_ui_api_key', uiKey, COOKIE_OPTIONS);
	}

	const workspaceId = hostedUiWorkspaceId(env);
	if (workspaceId) {
		cookies.set('spawner_workspace_id', workspaceId, COOKIE_OPTIONS);
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
	clean.searchParams.delete('workspaceId');
	clean.searchParams.delete('workspace');
	throw redirect(303, clean.pathname + clean.search + clean.hash);
}
