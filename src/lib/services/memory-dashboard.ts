import {
	MEMORY_DASHBOARD_CATEGORIES,
	MEMORY_DASHBOARD_SOURCES,
	MEMORY_DASHBOARD_STATUSES,
	type MemoryDashboardDataset,
	type MemoryDashboardFilters,
	type MemoryDashboardMetricDefinition,
	type MemoryDashboardRecord
} from './memory-dashboard-types';

export {
	MEMORY_DASHBOARD_CATEGORIES,
	MEMORY_DASHBOARD_SOURCES,
	MEMORY_DASHBOARD_STATUSES,
	type MemoryDashboardDataset,
	type MemoryDashboardFilters,
	type MemoryDashboardMetricDefinition,
	type MemoryDashboardRecord
};

export const MEMORY_DASHBOARD_METRIC_CONTRACT: MemoryDashboardMetricDefinition[] = [
	{
		id: 'memory-volume',
		label: 'Memory volume',
		meaning: 'How many memory records are available in the current dashboard slice.',
		calculationSource: 'Count of records after category, status, and time-range filters are applied.',
		seededFallback: 'Counts the bundled sample records and keeps the sample-data marker visible.'
	},
	{
		id: 'retrieval-usefulness',
		label: 'Retrieval usefulness',
		meaning: 'How often retrieved memories appear to help instead of distract or drift.',
		calculationSource: 'Useful retrievals divided by total retrievals for records in the current slice.',
		seededFallback: 'Uses deterministic usefulRetrievals and retrievalCount fields from sample records.'
	},
	{
		id: 'stale-risky',
		label: 'Stale or risky memories',
		meaning: 'How many records should be reviewed because they are old, low-confidence, or explicitly risky.',
		calculationSource: 'Count of records with stale or risky status, low confidence, or age over the stale threshold.',
		seededFallback: 'Flags sample stale and risky records so warning states render without live memory data.'
	}
];

export async function loadMemoryDashboardDataset(): Promise<MemoryDashboardDataset> {
	return {
		memories: sampleMemoryDashboardRecords(),
		generatedAt: new Date().toISOString(),
		isSampleData: true,
		sourceLabel: 'Seeded sample memory records',
		warnings: ['Live memory records are not connected yet; v1 is rendering deterministic sample data.'],
		metricContract: MEMORY_DASHBOARD_METRIC_CONTRACT
	};
}

export function sampleMemoryDashboardRecords(): MemoryDashboardRecord[] {
	return [
		{
			id: 'mem-sample-001',
			summary: 'Creator dossiers should only promote reusable mechanisms with observed outcome evidence.',
			category: 'creator research',
			confidence: 0.91,
			createdAt: '2026-04-10T09:15:00.000Z',
			lastTouchedAt: '2026-04-29T14:20:00.000Z',
			retrievalCount: 18,
			usefulRetrievals: 16,
			usefulnessSignal: 'strong',
			source: 'evidence packet',
			status: 'healthy',
			riskReasons: [],
			recommendedAction: 'keep'
		},
		{
			id: 'mem-sample-002',
			summary: 'Mission events must report task lifecycle updates to the local events API.',
			category: 'mission operations',
			confidence: 0.87,
			createdAt: '2026-04-11T12:30:00.000Z',
			lastTouchedAt: '2026-04-30T06:15:00.000Z',
			retrievalCount: 22,
			usefulRetrievals: 19,
			usefulnessSignal: 'strong',
			source: 'current state',
			status: 'healthy',
			riskReasons: [],
			recommendedAction: 'keep'
		},
		{
			id: 'mem-sample-003',
			summary: 'Dashboard v1 should be operational and compact, not a marketing-style hero page.',
			category: 'product direction',
			confidence: 0.84,
			createdAt: '2026-04-18T08:00:00.000Z',
			lastTouchedAt: '2026-04-30T07:05:00.000Z',
			retrievalCount: 10,
			usefulRetrievals: 8,
			usefulnessSignal: 'strong',
			source: 'conversation memory',
			status: 'healthy',
			riskReasons: [],
			recommendedAction: 'keep'
		},
		{
			id: 'mem-sample-004',
			summary: 'Content rules need contradiction checks before promotion into reusable memory.',
			category: 'content rules',
			confidence: 0.73,
			createdAt: '2026-03-12T10:45:00.000Z',
			lastTouchedAt: '2026-04-05T13:10:00.000Z',
			retrievalCount: 14,
			usefulRetrievals: 9,
			usefulnessSignal: 'mixed',
			source: 'domain chip',
			status: 'reinforce',
			riskReasons: ['Mixed usefulness signal'],
			recommendedAction: 'reinforce'
		},
		{
			id: 'mem-sample-005',
			summary: 'Older plan review notes mention external web search as optional for dashboard design.',
			category: 'system constraint',
			confidence: 0.58,
			createdAt: '2026-01-21T16:30:00.000Z',
			lastTouchedAt: '2026-02-08T11:00:00.000Z',
			retrievalCount: 7,
			usefulRetrievals: 2,
			usefulnessSignal: 'weak',
			source: 'sample seed',
			status: 'stale',
			riskReasons: ['Old instruction', 'Low usefulness'],
			recommendedAction: 'review'
		},
		{
			id: 'mem-sample-006',
			summary: 'The user prefers direct builds with clear verification instead of long speculative plans.',
			category: 'user preference',
			confidence: 0.79,
			createdAt: '2026-04-03T09:00:00.000Z',
			lastTouchedAt: '2026-04-27T18:45:00.000Z',
			retrievalCount: 11,
			usefulRetrievals: 8,
			usefulnessSignal: 'strong',
			source: 'conversation memory',
			status: 'healthy',
			riskReasons: [],
			recommendedAction: 'keep'
		},
		{
			id: 'mem-sample-007',
			summary: 'A prior routing note says all memory work belongs under the memory-quality page.',
			category: 'product direction',
			confidence: 0.42,
			createdAt: '2025-12-15T12:00:00.000Z',
			lastTouchedAt: '2026-01-09T15:25:00.000Z',
			retrievalCount: 5,
			usefulRetrievals: 1,
			usefulnessSignal: 'weak',
			source: 'sample seed',
			status: 'risky',
			riskReasons: ['Contradicts current v1 scope', 'Low confidence'],
			recommendedAction: 'archive'
		},
		{
			id: 'mem-sample-008',
			summary: 'Memory review rows should expose category, summary, last touched date, usefulness, and status.',
			category: 'product direction',
			confidence: 0.88,
			createdAt: '2026-04-28T08:30:00.000Z',
			lastTouchedAt: '2026-04-30T07:30:00.000Z',
			retrievalCount: 6,
			usefulRetrievals: 5,
			usefulnessSignal: 'strong',
			source: 'current state',
			status: 'healthy',
			riskReasons: [],
			recommendedAction: 'keep'
		},
		{
			id: 'mem-sample-009',
			summary: 'Seeded records should include enough variety to render filters, empty states, and warnings.',
			category: 'system constraint',
			confidence: 0.8,
			createdAt: '2026-04-26T10:00:00.000Z',
			lastTouchedAt: '2026-04-26T10:00:00.000Z',
			retrievalCount: 4,
			usefulRetrievals: 3,
			usefulnessSignal: 'mixed',
			source: 'current state',
			status: 'needs review',
			riskReasons: ['Needs live-data replacement path'],
			recommendedAction: 'review'
		},
		{
			id: 'mem-sample-010',
			summary: 'Use accessible controls and stable dashboard regions for filters and state fallbacks.',
			category: 'system constraint',
			confidence: 0.86,
			createdAt: '2026-04-20T13:00:00.000Z',
			lastTouchedAt: '2026-04-29T09:05:00.000Z',
			retrievalCount: 9,
			usefulRetrievals: 8,
			usefulnessSignal: 'strong',
			source: 'evidence packet',
			status: 'healthy',
			riskReasons: [],
			recommendedAction: 'keep'
		}
	];
}
