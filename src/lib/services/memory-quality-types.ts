export const MEMORY_FAILURE_MODES = [
	'confabulation',
	'omission',
	'drift',
	'stale recall',
	'source unavailable'
] as const;

export const MEMORY_OUTCOMES = ['hit', 'miss', 'drift', 'unsure'] as const;

export const MEMORY_SOURCES = [
	'domain-chip-memory',
	'Telegram conversation memory',
	'structured evidence retrieval',
	'current-state injection'
] as const;

export const SOURCE_STATUSES = ['healthy', 'degraded', 'offline', 'unknown'] as const;

export type MemoryFailureMode = (typeof MEMORY_FAILURE_MODES)[number];
export type MemoryOutcome = (typeof MEMORY_OUTCOMES)[number];
export type MemorySource = (typeof MEMORY_SOURCES)[number];
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export interface MemoryRecallEvent {
	id: string;
	timestamp: string;
	query: string;
	source: MemorySource;
	outcome: MemoryOutcome;
	latencyMs: number;
	failureMode: MemoryFailureMode | null;
	notes: string;
	evaluator?: string;
	manual?: boolean;
}

export interface MemorySourceHealth {
	source: MemorySource;
	status: SourceStatus;
	lastSeenAt: string | null;
	successRate: number;
	warningCount: number;
	notes: string;
}

export interface MemorySourceWarning {
	source: string;
	message: string;
	path?: string;
}

export interface MemoryQualityDataset {
	events: MemoryRecallEvent[];
	sourceHealth: MemorySourceHealth[];
	generatedAt: string;
	isSampleData: boolean;
	warnings: MemorySourceWarning[];
}
