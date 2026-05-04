import { env } from '$env/dynamic/private';
import { redirect, type Handle } from '@sveltejs/kit';
import {
	hostedUiAuthEnabled,
	hostedUiCredentialsAreValid,
	hostedUiAuthClientKey,
	hostedUiAuthPathIsExempt,
	hostedUiAuthRateLimitStatus,
	hostedUiRequestToken,
	hostedUiRequestWorkspaceId,
	hostedUiReleaseLocked,
	recordHostedUiAuthFailure,
	clearHostedUiAuthFailures,
	persistHostedUiAuth,
	redirectWithoutAuthQuery
} from '$lib/server/hosted-ui-auth';

export const handle: Handle = async ({ event, resolve }) => {
	const staticAssetPath =
		event.url.pathname === '/robots.txt' ||
		event.url.pathname.startsWith('/_app/') ||
		event.url.pathname.startsWith('/favicon');
	if (staticAssetPath) {
		return resolve(event);
	}

	if (hostedUiReleaseLocked(env)) {
		if (event.request.headers.get('accept')?.includes('text/html')) {
			return new Response(
				`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Spawner private preview locked</title></head><body style="margin:0;background:#121414;color:#eff5f2;font-family:Inter,system-ui,sans-serif"><main style="min-height:100vh;display:grid;place-items:center;padding:24px"><section style="max-width:640px;border:1px solid rgba(148,163,184,.22);background:rgba(20,24,24,.92);border-radius:12px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.34)"><p style="margin:0 0 12px;color:#2ee6b8;text-transform:uppercase;letter-spacing:.16em;font-size:12px;font-weight:700">Private preview locked</p><h1 style="margin:0 0 14px;font-size:32px;line-height:1.1">Hosted Spawner is not public yet.</h1><p style="margin:0;color:#a8b3ad;line-height:1.65">This deployment is intentionally blocked until workspace isolation, password access, and command safety have been explicitly enabled. Set <code>SPARK_HOSTED_PRIVATE_PREVIEW=1</code>, <code>SPARK_WORKSPACE_ID</code>, and <code>SPARK_UI_API_KEY</code> only for a trusted private preview.</p></section></main></body></html>`,
				{ status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } }
			);
		}
		return new Response('Hosted Spawner is private-preview locked. Public access is disabled for this release.', {
			status: 503,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	}

	if (hostedUiAuthPathIsExempt(event.url.pathname)) {
		return resolve(event);
	}

	if (!hostedUiAuthEnabled(env)) {
		return resolve(event);
	}

	const clientKey = hostedUiAuthClientKey(event.request);
	const token = hostedUiRequestToken(event.request, event.url, event.cookies);
	const workspaceId = hostedUiRequestWorkspaceId(event.request, event.url, event.cookies);
	if (!hostedUiCredentialsAreValid(workspaceId, token, env)) {
		const rateLimit = hostedUiAuthRateLimitStatus(clientKey);
		if (rateLimit.blocked) {
			return new Response('Too many Spark Live access attempts. Wait a moment, then try again.', {
				status: 429,
				headers: {
					'content-type': 'text/plain; charset=utf-8',
					'retry-after': String(rateLimit.retryAfterSeconds)
				}
			});
		}
		recordHostedUiAuthFailure(clientKey);
		if (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html')) {
			const next = `${event.url.pathname}${event.url.search}${event.url.hash}`;
			throw redirect(303, `/spark-live/login?next=${encodeURIComponent(next)}`);
		}
		return new Response('Spawner is private. Open /spark-live/login in a browser, or pass x-spawner-ui-key for API access.', {
			status: 401,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	}

	clearHostedUiAuthFailures(clientKey);
	persistHostedUiAuth(event.cookies, env);
	if (
		event.url.searchParams.has('uiKey') ||
		event.url.searchParams.has('apiKey') ||
		event.url.searchParams.has('workspaceId') ||
		event.url.searchParams.has('workspace')
	) {
		redirectWithoutAuthQuery(event.url);
	}

	return resolve(event);
};
