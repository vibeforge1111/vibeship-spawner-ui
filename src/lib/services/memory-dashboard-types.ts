export const MEMORY_DASHBOARD_CATEGORIES = [
	'creator research',
	'mission operations',
	'product direction',
	'content rules',
	'user preference',
	'system constraint'
] as const;

export const MEMORY_DASHBOARD_STATUSES = ['healthy', 'reinforce', 'needs review', 'stale', 'risky'] as const;

export const MEMORY_DASHBOARD_SOURCES = [
	'sample seed',
	'domain chip',
	'conversation memory',
	'evidence packet',
	'current state'
] as const;

export type MemoryDashboardCategory = (typeof MEMORY_DASHBOARD_CATEGORIES)[number];
export type MemoryDashboardStatus = (typeof MEMORY_DASHBOARD_STATUSES)[number];
export type MemoryDashboardSource = (typeof MEMORY_DASHBOARD_SOURCES)[number];

export interface MemoryDashboardRecord {
	id: string;
	summary: string;
	category: MemoryDashboardCategory;
	confidence: number;
	createdAt: string;
	lastTouchedAt: string;
	retrievalCount: number;
	usefulRetrievals: number;
	usefulnessSignal: 'strong' | 'mixed' | 'weak' | 'unknown';
	source: MemoryDashboardSource;
	status: MemoryDashboardStatus;
	riskReasons: string[];
	recommendedAction: 'keep' | 'reinforce' | 'review' | 'archive';
}

export interface MemoryDashboardDataset {
	memories: MemoryDashboardRecord[];
	generatedAt: string;
	isSampleData: boolean;
	sourceLabel: string;
	warnings: string[];
	metricContract: MemoryDashboardMetricDefinition[];
}

export interface MemoryDashboardMetricDefinition {
	id: 'memory-volume' | 'retrieval-usefulness' | 'stale-risky';
	label: string;
	meaning: string;
	calculationSource: string;
	seededFallback: string;
}

export interface MemoryDashboardFilters {
	category: MemoryDashboardCategory | 'all';
	status: MemoryDashboardStatus | 'all';
	timeRange: '7d' | '30d' | '90d' | 'all';
}
