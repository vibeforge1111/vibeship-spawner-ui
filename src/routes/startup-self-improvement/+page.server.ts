import { loadStartupSelfImprovementDashboard } from '$lib/services/startup-self-improvement';

export async function load() {
	const dashboard = await loadStartupSelfImprovementDashboard();
	return { dashboard };
}
