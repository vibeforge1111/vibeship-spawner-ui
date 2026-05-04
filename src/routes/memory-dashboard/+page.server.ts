import { summarizeMemoryDashboard } from '$lib/services/memory-dashboard-aggregates';
import { loadMemoryDashboardDataset } from '$lib/services/memory-dashboard';

export async function load() {
	try {
		const dataset = await loadMemoryDashboardDataset();
		return {
			state: 'ready' as const,
			dataset,
			summary: summarizeMemoryDashboard(dataset.memories),
			error: null
		};
	} catch (error) {
		return {
			state: 'error' as const,
			dataset: {
				memories: [],
				generatedAt: new Date().toISOString(),
				isSampleData: true,
				sourceLabel: 'Seeded sample memory records',
				warnings: ['Memory dashboard data could not be loaded.'],
				metricContract: []
			},
			summary: summarizeMemoryDashboard([]),
			error: error instanceof Error ? error.message : 'Memory dashboard data could not be loaded.'
		};
	}
}
