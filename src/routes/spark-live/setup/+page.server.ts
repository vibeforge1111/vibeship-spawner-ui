import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';
import { buildHostedSetupStatus } from '$lib/server/hosted-setup-status';

export const load: PageServerLoad = () => {
	return {
		status: buildHostedSetupStatus(env)
	};
};
