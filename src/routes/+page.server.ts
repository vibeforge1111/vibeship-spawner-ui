import { env } from '$env/dynamic/private';
import { hostedUiReleaseLocked } from '$lib/server/hosted-ui-auth';

export function load() {
	return {
		publicPreviewLocked: hostedUiReleaseLocked(env)
	};
}

