import type { MissionControlBoardEntry } from './mission-control-relay';
import type { ProviderMissionResultSnapshot } from './provider-runtime';
import type { ProviderSessionStatus } from './provider-clients/types';
import type { MissionControlCompletionEvidence } from '$lib/types/mission-control';
import { compactMissionControlDisplayText, compactProviderHandoffText } from './mission-control-display';
import { projectPreviewUrl } from './project-preview';
import { env } from '$env/dynamic/private';

export interface MissionControlProviderResultSummary {
	providerId: string;
	status: ProviderSessionStatus;
	requestId?: string | null;
	traceRef?: string | null;
	summary: string;
	durationMs: number | null;
	completedAt: string | null;
	projectPath?: string;
	project_path?: string;
	previewUrl?: string;
	preview_url?: string;
}

export interface MissionControlResultSummary {
	providerResults: MissionControlProviderResultSummary[];
	providerSummary: string | null;
	completionEvidence?: MissionControlCompletionEvidence;
}

type BoardBuckets = Record<string, MissionControlBoardEntry[]>;
type ResultLookup = (missionId: string) => ProviderMissionResultSnapshot[];
const NON_TERMINAL_PROVIDER_STATUSES: ProviderSessionStatus[] = ['idle', 'running'];
const TERMINAL_PROVIDER_STATUSES: ProviderSessionStatus[] = ['completed', 'failed', 'cancelled'];
const DEFAULT_STALLED_RUNNING_MS = 30 * 60 * 1000;

function providerLabel(providerId: string): string {
	if (providerId === 'codex') return 'Codex';
	if (providerId === 'claude') return 'Claude';
	return providerId;
}

function stalledRunningMs(): number {
	const raw = Number((env as Record<string, string | undefined>).MISSION_CONTROL_STALLED_RUNNING_MS);
	return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STALLED_RUNNING_MS;
}

function compactDuration(ms: number): string {
	const minutes = Math.max(1, Math.round(ms / 60_000));
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function stringField(record: Record<string, unknown>, key: string): string | null {
	const value = record[key];
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function previewBaseUrl(): string {
	const envRecord = env as Record<string, string | undefined>;
	const processEnv = typeof process !== 'undefined' ? process.env : {};
	const raw =
		envRecord.SPARK_PROJECT_PREVIEW_URL?.trim() ||
		processEnv.SPARK_PROJECT_PREVIEW_URL?.trim() ||
		envRecord.SPAWNER_PROJECT_PREVIEW_BASE_URL?.trim() ||
		processEnv.SPAWNER_PROJECT_PREVIEW_BASE_URL?.trim() ||
		envRecord.SPARK_PROJECT_PREVIEW_BASE_URL?.trim() ||
		processEnv.SPARK_PROJECT_PREVIEW_BASE_URL?.trim() ||
		envRecord.SPAWNER_UI_PUBLIC_URL?.trim() ||
		processEnv.SPAWNER_UI_PUBLIC_URL?.trim() ||
		envRecord.PUBLIC_SPAWNER_UI_URL?.trim() ||
		processEnv.PUBLIC_SPAWNER_UI_URL?.trim() ||
		envRecord.RAILWAY_PUBLIC_DOMAIN?.trim() ||
		processEnv.RAILWAY_PUBLIC_DOMAIN?.trim() ||
		envRecord.RAILWAY_STATIC_URL?.trim() ||
		processEnv.RAILWAY_STATIC_URL?.trim() ||
		'';
	if (!raw) return '';
	return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function parseProviderResponseRecord(response: string | null): Record<string, unknown> | null {
	if (!response?.trim()) return null;
	try {
		const parsed = JSON.parse(response) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
		return parsed as Record<string, unknown>;
	} catch {
		return null;
	}
}

function parseProviderResponseMetadata(response: string | null): {
	projectPath?: string;
	project_path?: string;
	previewUrl?: string;
	preview_url?: string;
} {
	const record = parseProviderResponseRecord(response);
	if (!record) return {};
	const projectPath = stringField(record, 'project_path') || stringField(record, 'projectPath');
	const explicitPreviewUrl =
		stringField(record, 'preview_url') ||
		stringField(record, 'previewUrl') ||
		stringField(record, 'open_url') ||
		stringField(record, 'openUrl');
	const baseUrl = previewBaseUrl();
	const previewUrl = explicitPreviewUrl || (projectPath && baseUrl ? projectPreviewUrl(baseUrl, projectPath) : null);
	return {
		...(projectPath ? { projectPath, project_path: projectPath } : {}),
		...(previewUrl ? { previewUrl, preview_url: previewUrl } : {})
	};
}

function parseProviderResponseSummary(response: string | null): string | null {
	const record = parseProviderResponseRecord(response);
	if (!record) return null;
	return stringField(record, 'summary') || stringField(record, 'message') || null;
}

export function summarizeProviderResults(
	results: ProviderMissionResultSnapshot[]
): MissionControlResultSummary {
	const providerResults = results.map((result) => {
		const responseSummary = compactProviderHandoffText(
			parseProviderResponseSummary(result.response) || result.response
		);
		const errorSummary = compactMissionControlDisplayText(result.error);
		const fallback =
			result.status === 'completed'
				? 'completed without a text response'
				: result.status === 'failed'
					? 'failed without an error message'
					: result.status;
		return {
			providerId: result.providerId,
			status: result.status,
			...(result.requestId ? { requestId: result.requestId } : {}),
			...(result.traceRef ? { traceRef: result.traceRef } : {}),
			summary: responseSummary || errorSummary || fallback,
			durationMs: result.durationMs,
			completedAt: result.completedAt,
			...parseProviderResponseMetadata(result.response)
		};
	});

	const preferred =
		providerResults.find((result) => result.status === 'completed') ||
		providerResults.find((result) => result.status === 'failed') ||
		providerResults[0];
	const providerSummary = preferred
		? `${providerLabel(preferred.providerId)}: ${preferred.summary}`
		: null;

	return { providerResults, providerSummary };
}

function alignProviderResultsWithBoardStatus(
	entry: MissionControlBoardEntry,
	results: ProviderMissionResultSnapshot[]
): ProviderMissionResultSnapshot[] {
	if (entry.status === 'paused') {
		return results.map((result) => {
			if (result.status !== 'cancelled') return result;
			return {
				...result,
				error: 'paused; ready to resume',
				completedAt: result.completedAt || entry.lastUpdated
			};
		});
	}
	if (entry.status !== 'completed' && entry.status !== 'failed' && entry.status !== 'cancelled') return results;

	return results.map((result) => {
		if (!NON_TERMINAL_PROVIDER_STATUSES.includes(result.status)) return result;
		if (entry.status === 'completed') return result;
		const terminalStatus: ProviderSessionStatus =
			entry.status === 'cancelled' ? 'cancelled' : 'failed';
		return {
			...result,
			status: terminalStatus,
			response: result.response,
			error:
				entry.status === 'failed'
					? result.error || 'failed from Mission Control lifecycle events'
					: entry.status === 'cancelled'
						? result.error || 'cancelled from Mission Control lifecycle events'
					: result.error,
			completedAt: result.completedAt || entry.lastUpdated
		};
	});
}

function statusFromProviderResults(
	results: ProviderMissionResultSnapshot[]
): MissionControlBoardEntry['status'] | null {
	if (results.length === 0) return null;
	if (results.some((result) => result.status === 'running')) return 'running';
	if (!results.every((result) => TERMINAL_PROVIDER_STATUSES.includes(result.status))) return null;
	if (results.every((result) => result.status === 'cancelled')) return 'cancelled';
	if (results.some((result) => result.status === 'failed' || result.status === 'cancelled')) return 'failed';
	return 'completed';
}

function taskStatusCounts(entry: MissionControlBoardEntry): MissionControlBoardEntry['taskStatusCounts'] {
	const counts: MissionControlBoardEntry['taskStatusCounts'] = {
		queued: 0,
		running: 0,
		completed: 0,
		failed: 0,
		cancelled: 0,
		total: entry.tasks.length
	};
	for (const task of entry.tasks) {
		counts[task.status ?? 'queued'] += 1;
	}
	return counts;
}

function isTerminalEvent(eventType: string): boolean {
	return (
		eventType === 'mission_completed' ||
		eventType === 'mission_failed' ||
		eventType === 'mission_cancelled' ||
		eventType === 'provider_completed' ||
		eventType === 'provider_failed' ||
		eventType === 'provider_cancelled'
	);
}

function terminalEvidenceSummary(missing: string[]): string {
	if (missing.length === 0) return 'Completion evidence present.';
	return `Completion evidence incomplete: missing ${missing.join(', ')}.`;
}

function buildCompletionEvidence(
	entry: MissionControlBoardEntry,
	results: ProviderMissionResultSnapshot[],
	summary: MissionControlResultSummary
): MissionControlCompletionEvidence {
	if (entry.status !== 'completed' && entry.status !== 'failed' && entry.status !== 'cancelled') {
		return {
			state: 'not_terminal',
			summary: 'Mission is not terminal yet.',
			missing: [],
			providerResultCount: results.length,
			providerTerminal: false,
			hasTerminalEvent: false,
			hasProviderCompletionTime: false,
			hasProviderSummary: Boolean(summary.providerSummary),
			hasArtifactReference: summary.providerResults.some((result) => Boolean(result.projectPath || result.previewUrl)),
			tasksTerminal: entry.taskStatusCounts.running === 0 && entry.taskStatusCounts.queued === 0
		};
	}

	const hasTerminalEvent = isTerminalEvent(entry.lastEventType);
	const providerTerminal =
		results.length > 0 &&
		results.every((result) => TERMINAL_PROVIDER_STATUSES.includes(result.status));
	const hasProviderCompletionTime = results.some((result) => Boolean(result.completedAt));
	const hasProviderSummary = Boolean(summary.providerSummary);
	const hasArtifactReference = summary.providerResults.some((result) => Boolean(result.projectPath || result.previewUrl));
	const tasksTerminal = entry.taskStatusCounts.running === 0 && entry.taskStatusCounts.queued === 0;
	const missing: string[] = [];

	if (!hasTerminalEvent) missing.push('terminal_event');
	if (results.length === 0) missing.push('provider_result');
	if (results.length > 0 && !providerTerminal) missing.push('provider_terminal_status');
	if (results.length > 0 && providerTerminal && !hasProviderCompletionTime) missing.push('provider_completion_time');
	if (!hasProviderSummary) missing.push('provider_summary');
	if (!tasksTerminal) missing.push('terminal_task_state');

	return {
		state: missing.length === 0 ? 'complete' : 'incomplete',
		summary: terminalEvidenceSummary(missing),
		missing,
		providerResultCount: results.length,
		providerTerminal,
		hasTerminalEvent,
		hasProviderCompletionTime,
		hasProviderSummary,
		hasArtifactReference,
		tasksTerminal
	};
}

function reconcileEntryWithProviderResults(
	entry: MissionControlBoardEntry,
	results: ProviderMissionResultSnapshot[]
): MissionControlBoardEntry {
	const lastUpdatedMs = Date.parse(entry.lastUpdated);
	const stalledMs = stalledRunningMs();
	const hasTerminalProvider = results.some((result) => TERMINAL_PROVIDER_STATUSES.includes(result.status));
	if (
		entry.status !== 'completed' &&
		entry.status !== 'failed' &&
		entry.status !== 'cancelled' &&
		entry.status !== 'paused' &&
		!hasTerminalProvider &&
		Number.isFinite(lastUpdatedMs) &&
		Date.now() - lastUpdatedMs > stalledMs
	) {
		const tasks = entry.tasks.map((task) => ({
			...task,
			status:
				task.status === 'completed' || task.status === 'cancelled'
					? task.status
					: ('failed' as const)
		}));
		const reconciled = {
			...entry,
			status: 'failed' as const,
			lastEventType: 'provider_stalled',
			lastSummary: `Mission stalled: no progress for ${compactDuration(Date.now() - lastUpdatedMs)}.`,
			tasks
		};
		return {
			...reconciled,
			taskStatusCounts: taskStatusCounts(reconciled)
		};
	}

	const providerStatus = statusFromProviderResults(results);
	if (!providerStatus) return entry;
	if (entry.status === 'paused' && providerStatus !== 'running') return entry;
	if (entry.status === 'completed' && providerStatus === 'running') {
		const tasks = entry.tasks.map((task) => ({
			...task,
			status:
				task.status === 'failed' || task.status === 'cancelled'
					? task.status
					: ('running' as const)
		}));
		const reconciled = {
			...entry,
			status: providerStatus,
			lastEventType: 'provider_running',
			lastSummary: 'Completion evidence missing: provider is still running.',
			tasks
		};
		return {
			...reconciled,
			taskStatusCounts: taskStatusCounts(reconciled)
		};
	}
	if (entry.status === 'completed' || entry.status === 'failed' || entry.status === 'cancelled' || entry.status === providerStatus) return entry;

	const tasks =
		providerStatus === 'completed'
			? entry.tasks.map((task) => ({
					...task,
					status:
						task.status === 'failed' || task.status === 'cancelled'
							? task.status
							: ('completed' as const)
				}))
			: entry.tasks;

	const reconciled = {
		...entry,
		status: providerStatus,
		lastEventType: `provider_${providerStatus}`,
		tasks
	};
	return {
		...reconciled,
		taskStatusCounts: taskStatusCounts(reconciled)
	};
}

export function enrichMissionControlBoardWithProviderResults(
	board: BoardBuckets,
	getResults: ResultLookup
): Record<string, Array<MissionControlBoardEntry & MissionControlResultSummary>> {
	const enriched: Record<string, Array<MissionControlBoardEntry & MissionControlResultSummary>> = {};
	for (const bucket of Object.keys(board)) {
		enriched[bucket] = [];
	}

	for (const entries of Object.values(board)) {
		for (const entry of entries) {
			const providerResults = getResults(entry.missionId);
			const reconciled = reconcileEntryWithProviderResults(entry, providerResults);
			const results = alignProviderResultsWithBoardStatus(reconciled, providerResults);
			const bucket = reconciled.status;
			if (!enriched[bucket]) enriched[bucket] = [];
			const summary = summarizeProviderResults(results);
			enriched[bucket].push({
				...reconciled,
				...summary,
				completionEvidence: buildCompletionEvidence(reconciled, results, summary)
			});
		}
	}

	for (const entries of Object.values(enriched)) {
		entries.sort((a, b) => Date.parse(b.lastUpdated) - Date.parse(a.lastUpdated));
	}

	return enriched;
}
