import { env } from '$env/dynamic/private';
import { redirect, type Handle } from '@sveltejs/kit';
import {
	hostedUiAuthEnabled,
	hostedUiAuthClientKey,
	hostedUiAuthPathIsExempt,
	hostedUiAuthRateLimitStatus,
	hostedUiRequestToken,
	hostedUiTokenIsValid,
	recordHostedUiAuthFailure,
	clearHostedUiAuthFailures,
	persistHostedUiAuth,
	redirectWithoutAuthQuery
} from '$lib/server/hosted-ui-auth';

export const handle: Handle = async ({ event, resolve }) => {
	if (!hostedUiAuthEnabled(env) || hostedUiAuthPathIsExempt(event.url.pathname)) {
		return resolve(event);
	}

	const clientKey = hostedUiAuthClientKey(event.request);
	const token = hostedUiRequestToken(event.request, event.url, event.cookies);
	if (!hostedUiTokenIsValid(token, env)) {
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
	if (event.url.searchParams.has('uiKey') || event.url.searchParams.has('apiKey')) {
		redirectWithoutAuthQuery(event.url);
	}

	return resolve(event);
};
