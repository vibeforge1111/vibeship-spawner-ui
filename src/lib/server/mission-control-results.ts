import type { MissionControlBoardEntry } from './mission-control-relay';
import type { ProviderMissionResultSnapshot } from './provider-runtime';
import type { ProviderSessionStatus } from './provider-clients/types';
import { compactMissionControlDisplayText } from './mission-control-display';

export interface MissionControlProviderResultSummary {
	providerId: string;
	status: ProviderSessionStatus;
	summary: string;
	durationMs: number | null;
	completedAt: string | null;
}

export interface MissionControlResultSummary {
	providerResults: MissionControlProviderResultSummary[];
	providerSummary: string | null;
}

type BoardBuckets = Record<string, MissionControlBoardEntry[]>;
type ResultLookup = (missionId: string) => ProviderMissionResultSnapshot[];
const NON_TERMINAL_PROVIDER_STATUSES: ProviderSessionStatus[] = ['idle', 'running'];

function providerLabel(providerId: string): string {
	if (providerId === 'codex') return 'Codex';
	if (providerId === 'claude') return 'Claude';
	return providerId;
}

export function summarizeProviderResults(
	results: ProviderMissionResultSnapshot[]
): MissionControlResultSummary {
	const providerResults = results.map((result) => {
		const responseSummary = compactMissionControlDisplayText(result.response);
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
			summary: responseSummary || errorSummary || fallback,
			durationMs: result.durationMs,
			completedAt: result.completedAt
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
	if (entry.status !== 'completed' && entry.status !== 'failed') return results;

	return results.map((result) => {
		if (!NON_TERMINAL_PROVIDER_STATUSES.includes(result.status)) return result;
		const terminalStatus: ProviderSessionStatus = entry.status === 'completed' ? 'completed' : 'failed';
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
					: result.error,
			completedAt: result.completedAt || entry.lastUpdated
		};
	});
}

export function enrichMissionControlBoardWithProviderResults(
	board: BoardBuckets,
	getResults: ResultLookup
): Record<string, Array<MissionControlBoardEntry & MissionControlResultSummary>> {
	return Object.fromEntries(
		Object.entries(board).map(([bucket, entries]) => [
			bucket,
			entries.map((entry) => {
				const results = alignProviderResultsWithBoardStatus(entry, getResults(entry.missionId));
				return {
					...entry,
					...summarizeProviderResults(results)
				};
			})
		])
	);
}
