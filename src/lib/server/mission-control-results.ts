import type { MissionControlBoardEntry } from './mission-control-relay';
import type { ProviderMissionResultSnapshot } from './provider-runtime';
import type { ProviderSessionStatus } from './provider-clients/types';
import { compactMissionControlDisplayText, compactProviderHandoffText } from './mission-control-display';
import { projectPreviewUrl } from './project-preview';
import { env } from '$env/dynamic/private';

export interface MissionControlProviderResultSummary {
	providerId: string;
	status: ProviderSessionStatus;
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
}

type BoardBuckets = Record<string, MissionControlBoardEntry[]>;
type ResultLookup = (missionId: string) => ProviderMissionResultSnapshot[];
const NON_TERMINAL_PROVIDER_STATUSES: ProviderSessionStatus[] = ['idle', 'running'];
const TERMINAL_PROVIDER_STATUSES: ProviderSessionStatus[] = ['completed', 'failed', 'cancelled'];

function providerLabel(providerId: string): string {
	if (providerId === 'codex') return 'Codex';
	if (providerId === 'claude') return 'Claude';
	return providerId;
}

function stringField(record: Record<string, unknown>, key: string): string | null {
	const value = record[key];
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function previewBaseUrl(): string {
	const envRecord = env as Record<string, string | undefined>;
	const raw =
		process.env.SPARK_PROJECT_PREVIEW_URL?.trim() ||
		process.env.SPAWNER_PROJECT_PREVIEW_BASE_URL?.trim() ||
		process.env.SPARK_PROJECT_PREVIEW_BASE_URL?.trim() ||
		process.env.SPAWNER_UI_PUBLIC_URL?.trim() ||
		process.env.PUBLIC_SPAWNER_UI_URL?.trim() ||
		process.env.RAILWAY_PUBLIC_DOMAIN?.trim() ||
		process.env.RAILWAY_STATIC_URL?.trim() ||
		envRecord.SPARK_PROJECT_PREVIEW_URL?.trim() ||
		envRecord.SPAWNER_PROJECT_PREVIEW_BASE_URL?.trim() ||
			envRecord.SPARK_PROJECT_PREVIEW_BASE_URL?.trim() ||
			envRecord.SPAWNER_UI_PUBLIC_URL?.trim() ||
			envRecord.PUBLIC_SPAWNER_UI_URL?.trim() ||
			envRecord.SPAWNER_UI_URL?.trim() ||
			envRecord.RAILWAY_PUBLIC_DOMAIN?.trim() ||
			envRecord.RAILWAY_STATIC_URL?.trim() ||
			'http://127.0.0.1:3333';
	if (!raw) return '';
	return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function parseProviderResponseMetadata(response: string | null): {
	summary?: string;
	projectPath?: string;
	project_path?: string;
	previewUrl?: string;
	preview_url?: string;
} {
	if (!response?.trim()) return {};
	try {
		const parsed = JSON.parse(response) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		const record = parsed as Record<string, unknown>;
		const summary = compactProviderHandoffText(stringField(record, 'summary'));
		const projectPath = stringField(record, 'project_path') || stringField(record, 'projectPath');
		const explicitPreviewUrl =
			stringField(record, 'preview_url') ||
			stringField(record, 'previewUrl') ||
			stringField(record, 'open_url') ||
			stringField(record, 'openUrl');
		const baseUrl = previewBaseUrl();
		const previewUrl = explicitPreviewUrl || (projectPath && baseUrl ? projectPreviewUrl(baseUrl, projectPath) : null);
		return {
			...(summary ? { summary } : {}),
			...(projectPath ? { projectPath, project_path: projectPath } : {}),
			...(previewUrl ? { previewUrl, preview_url: previewUrl } : {})
		};
	} catch {
		return {};
	}
}

export function summarizeProviderResults(
	results: ProviderMissionResultSnapshot[]
): MissionControlResultSummary {
	const providerResults = results.map((result) => {
		const metadata = parseProviderResponseMetadata(result.response);
		const responseSummary = compactProviderHandoffText(result.response);
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
			summary: metadata.summary || responseSummary || errorSummary || fallback,
			durationMs: result.durationMs,
			completedAt: result.completedAt,
			...metadata
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
		const terminalStatus: ProviderSessionStatus =
			entry.status === 'completed' ? 'completed' : entry.status === 'cancelled' ? 'cancelled' : 'failed';
		return {
			...result,
			status: terminalStatus,
			response:
				entry.status === 'completed'
					? 'completed from Mission Control lifecycle events'
					: result.response,
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

function reconcileEntryWithProviderResults(
	entry: MissionControlBoardEntry,
	results: ProviderMissionResultSnapshot[]
): MissionControlBoardEntry {
	const providerStatus = statusFromProviderResults(results);
	if (!providerStatus) return entry;
	if (entry.status === 'paused' && providerStatus !== 'running') return entry;
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
			enriched[bucket].push({
				...reconciled,
				...summarizeProviderResults(results)
			});
		}
	}

	for (const entries of Object.values(enriched)) {
		entries.sort((a, b) => Date.parse(b.lastUpdated) - Date.parse(a.lastUpdated));
	}

	return enriched;
}
