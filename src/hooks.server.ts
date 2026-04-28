import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import {
	hostedUiAuthEnabled,
	hostedUiAuthPathIsExempt,
	hostedUiRequestToken,
	hostedUiTokenIsValid,
	persistHostedUiAuth,
	redirectWithoutAuthQuery
} from '$lib/server/hosted-ui-auth';

export const handle: Handle = async ({ event, resolve }) => {
	if (!hostedUiAuthEnabled(env) || hostedUiAuthPathIsExempt(event.url.pathname)) {
		return resolve(event);
	}

	const token = hostedUiRequestToken(event.request, event.url, event.cookies);
	if (!hostedUiTokenIsValid(token, env)) {
		return new Response('Spawner is private. Open this Spark Live URL with ?uiKey=<your-ui-key>.', {
			status: 401,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	}

	persistHostedUiAuth(event.cookies, env);
	if (event.url.searchParams.has('uiKey') || event.url.searchParams.has('apiKey')) {
		redirectWithoutAuthQuery(event.url);
	}

	return resolve(event);
};
