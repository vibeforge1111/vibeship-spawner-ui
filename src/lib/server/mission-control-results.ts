import type { MissionControlBoardEntry } from './mission-control-relay';
import type { ProviderMissionResultSnapshot } from './provider-runtime';
import type { ProviderSessionStatus } from './provider-clients/types';

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

function compactText(value: string | null | undefined): string | null {
	if (!value) return null;
	const compact = value
		.replace(/\r/g, '')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.join(' ');
	if (!compact) return null;
	return compact.length > 360 ? `${compact.slice(0, 357)}...` : compact;
}

function providerLabel(providerId: string): string {
	if (providerId === 'codex') return 'Codex';
	if (providerId === 'claude') return 'Claude';
	return providerId;
}

export function summarizeProviderResults(
	results: ProviderMissionResultSnapshot[]
): MissionControlResultSummary {
	const providerResults = results.map((result) => {
		const responseSummary = compactText(result.response);
		const errorSummary = compactText(result.error);
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

export function enrichMissionControlBoardWithProviderResults(
	board: BoardBuckets,
	getResults: ResultLookup
): Record<string, Array<MissionControlBoardEntry & MissionControlResultSummary>> {
	return Object.fromEntries(
		Object.entries(board).map(([bucket, entries]) => [
			bucket,
			entries.map((entry) => ({
				...entry,
				...summarizeProviderResults(getResults(entry.missionId))
			}))
		])
	);
}
