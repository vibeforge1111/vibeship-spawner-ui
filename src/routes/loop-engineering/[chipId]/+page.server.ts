import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getLoopEngineeringChipDetail } from '$lib/server/loop-engineering-registry';

export const load: PageServerLoad = async ({ params }) => {
	const chip = await getLoopEngineeringChipDetail(params.chipId);
	if (!chip) throw error(404, 'domain chip not found');
	return { chip };
};
