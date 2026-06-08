import { env } from '$env/dynamic/private';
import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	clearHostedUiAuthFailures,
	hostedUiCredentialsAreValid,
	hostedUiAuthClientKey,
	hostedUiAuthRateLimitStatus,
	persistHostedUiAuth,
	recordHostedUiAuthFailure,
	hostedUiWorkspaceId,
	hostedUiShouldAutoPersistLocalOperatorSession
} from '$lib/server/hosted-ui-auth';

function safeNext(value: FormDataEntryValue | string | null): string {
	const raw = String(value || '/kanban').trim();
	if (!raw.startsWith('/') || raw.startsWith('//')) return '/kanban';
	return raw;
}

export const load: PageServerLoad = ({ cookies, request, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (hostedUiShouldAutoPersistLocalOperatorSession(request, url, env)) {
		persistHostedUiAuth(cookies, env);
		throw redirect(303, next);
	}

	return {
		next,
		workspaceRequired: Boolean(hostedUiWorkspaceId(env))
	};
};

export const actions: Actions = {
	default: async ({ cookies, request }) => {
		const data = await request.formData();
		const next = safeNext(data.get('next'));
		const workspaceId = String(data.get('workspaceId') || '').trim();
		const token = String(data.get('uiKey') || '').trim();
		const clientKey = hostedUiAuthClientKey(request);

		if (hostedUiCredentialsAreValid(workspaceId, token, env)) {
			clearHostedUiAuthFailures(clientKey);
			persistHostedUiAuth(cookies, env, workspaceId);
			throw redirect(303, next);
		}

		const rateLimit = hostedUiAuthRateLimitStatus(clientKey);
		if (rateLimit.blocked) {
			return fail(429, {
				next,
				workspaceId,
				message: `Too many attempts. Wait ${rateLimit.retryAfterSeconds}s, then try again.`
			});
		}

		recordHostedUiAuthFailure(clientKey);
		return fail(401, {
			next,
			workspaceId,
			message: 'That workspace ID or access key did not work.'
		});
	}
};
