import { readFile } from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { loadMemoryDashboardDataset, MEMORY_DASHBOARD_METRIC_CONTRACT } from '$lib/services/memory-dashboard';
import {
	defaultMemoryDashboardFilters,
	filterMemoryDashboardRecords,
	summarizeMemoryDashboard
} from '$lib/services/memory-dashboard-aggregates';

describe('/memory-dashboard route', () => {
	it('defines exactly the three v1 primary metrics with fallback behavior', () => {
		expect(MEMORY_DASHBOARD_METRIC_CONTRACT.map((metric) => metric.id)).toEqual([
			'memory-volume',
			'retrieval-usefulness',
			'stale-risky'
		]);
		for (const metric of MEMORY_DASHBOARD_METRIC_CONTRACT) {
			expect(metric.meaning.length).toBeGreaterThan(20);
			expect(metric.calculationSource.length).toBeGreaterThan(20);
			expect(metric.seededFallback).toContain('sample');
		}
	});

	it('loads clearly marked seed data and renders the expected dashboard regions', async () => {
		const dataset = await loadMemoryDashboardDataset();
		const summary = summarizeMemoryDashboard(dataset.memories);
		const routeSource = await readFile(path.join(process.cwd(), 'src/routes/memory-dashboard/+page.svelte'), 'utf-8');

		expect(dataset.isSampleData).toBe(true);
		expect(dataset.sourceLabel).toContain('Seeded sample');
		expect(dataset.memories.length).toBeGreaterThanOrEqual(10);
		expect(summary.metrics).toHaveLength(3);
		expect(summary.activityTrend.length).toBeGreaterThan(0);
		expect(summary.categoryDistribution.length).toBeGreaterThan(0);
		expect(summary.insights.length).toBeGreaterThan(0);
		expect(routeSource).toContain('Sample data');
		expect(routeSource).toContain('Primary memory metrics');
		expect(routeSource).toContain('Dashboard filters');
		expect(routeSource).toContain('Activity trend');
		expect(routeSource).toContain('Category distribution');
		expect(routeSource).toContain('Actionable memory insights');
		expect(routeSource).toContain('No memories match these filters');
	});

	it('updates metrics and list records when filters change', async () => {
		const dataset = await loadMemoryDashboardDataset();
		const filters = {
			...defaultMemoryDashboardFilters(),
			category: 'product direction' as const,
			status: 'healthy' as const
		};
		const filtered = filterMemoryDashboardRecords(dataset.memories, filters);
		const summary = summarizeMemoryDashboard(filtered);

		expect(filtered).toHaveLength(2);
		expect(summary.metrics[0].value).toBe('2');
		expect(summary.insights).toEqual([]);
	});
});
