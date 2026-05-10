import { json, type RequestHandler } from '@sveltejs/kit';
import { recommendAccessExecutionLane } from '$lib/server/access-execution-lanes';

function accessLevelFromUrl(url: URL): 4 | 5 {
	return url.searchParams.get('accessLevel') === '5' ? 5 : 4;
}

export const GET: RequestHandler = async ({ url }) => {
	const accessLevel = accessLevelFromUrl(url);
	const goal = url.searchParams.get('goal') || undefined;

	return json({
		success: true,
		access: recommendAccessExecutionLane({
			accessLevel,
			userGoal: goal
		})
	});
};
