import { env } from '$env/dynamic/private';
import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	clearHostedUiAuthFailures,
	hostedUiAuthClientKey,
	hostedUiAuthRateLimitStatus,
	hostedUiTokenIsValid,
	persistHostedUiAuth,
	recordHostedUiAuthFailure
} from '$lib/server/hosted-ui-auth';

function safeNext(value: FormDataEntryValue | string | null): string {
	const raw = String(value || '/').trim();
	if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
	return raw;
}

export const load: PageServerLoad = ({ url }) => {
	return {
		next: safeNext(url.searchParams.get('next'))
	};
};

export const actions: Actions = {
	default: async ({ cookies, request }) => {
		const data = await request.formData();
		const next = safeNext(data.get('next'));
		const token = String(data.get('uiKey') || '').trim();
		const clientKey = hostedUiAuthClientKey(request);

		if (hostedUiTokenIsValid(token, env)) {
			clearHostedUiAuthFailures(clientKey);
			persistHostedUiAuth(cookies, env);
			throw redirect(303, next);
		}

		const rateLimit = hostedUiAuthRateLimitStatus(clientKey);
		if (rateLimit.blocked) {
			return fail(429, {
				next,
				message: `Too many attempts. Wait ${rateLimit.retryAfterSeconds}s, then try again.`
			});
		}

		recordHostedUiAuthFailure(clientKey);
		return fail(401, {
			next,
			message: 'That Spark Live access key did not work.'
		});
	}
};
