import { providerRuntime, type ProviderMissionResultSnapshot } from './provider-runtime';
import { getMissionControlBoard } from './mission-control-relay';
import type { MissionControlBoardEntry } from '$lib/types/mission-control';
import type { WatchdogEvidenceRef, WatchdogOpenBlocker, WatchdogProbeRow } from '$lib/services/harness-watchdog';
import {
	artifactMatchesCorrelation,
	artifactRequestId,
	artifactTimestamp,
	artifactTraceRef,
	makeOpenBlocker,
	makeWatchdogRow,
	mergeEvidenceRefs,
	readWatchdogJsonArtifact,
	resolveWatchdogCorrelation,
	safeRequestFileSegment,
	stringField,
	type WatchdogCorrelation
} from './harness-watchdog-state';

const DEFAULT_STALE_MS = 24 * 60 * 60 * 1000;

export interface WatchdogDispatchStatus {
	allComplete: boolean;
	anyFailed: boolean;
	paused: boolean;
	pausedReason: string | null;
	lastReason: string | null;
	snapshotAvailable: boolean;
	resumeable: boolean;
	resumeBlocker: string | null;
	providers: Record<string, string>;
}

export interface CollectHarnessWatchdogRuntimeOptions {
	requestId?: string | null;
	missionId?: string | null;
	traceRef?: string | null;
	stateDir?: string;
	checkedAt?: string;
	nowMs?: number;
	staleMs?: number;
	getProviderResults?: (missionId: string) => ProviderMissionResultSnapshot[];
	getDispatchStatus?: (missionId: string) => WatchdogDispatchStatus;
	getBoard?: () => Record<string, MissionControlBoardEntry[]>;
}

export interface HarnessWatchdogRuntimeSnapshot {
	requestId: string | null;
	missionId: string | null;
	traceRef: string | null;
	checkedAt: string;
	rows: WatchdogProbeRow[];
	openBlockers: WatchdogOpenBlocker[];
	evidenceRefs: WatchdogEvidenceRef[];
}

function allBoardEntries(board: Record<string, MissionControlBoardEntry[]>): MissionControlBoardEntry[] {
	return Object.values(board).flat();
}

function findBoardEntry(
	board: Record<string, MissionControlBoardEntry[]>,
	missionId: string | null
): MissionControlBoardEntry | null {
	if (!missionId) return null;
	return allBoardEntries(board).find((entry) => entry.missionId === missionId) ?? null;
}

function providerStatusSummary(results: ProviderMissionResultSnapshot[]): string {
	const counts = new Map<string, number>();
	for (const result of results) {
		counts.set(result.status, (counts.get(result.status) ?? 0) + 1);
	}
	return [...counts.entries()].map(([status, count]) => `${count} ${status}`).join(', ');
}

function isStaleTimestamp(timestamp: string | null, nowMs: number, staleMs: number): boolean {
	if (!timestamp) return false;
	const parsed = Date.parse(timestamp);
	return Number.isFinite(parsed) && nowMs - parsed > staleMs;
}

function rowAndBlockerForMissing(input: {
	id: string;
	label: string;
	source: string;
	checkedAt: string;
	correlation: WatchdogCorrelation;
	evidenceRef: string;
	summary: string;
	blockerId: string;
}): { row: WatchdogProbeRow; blocker: WatchdogOpenBlocker } {
	return {
		row: makeWatchdogRow({
			id: input.id,
			label: input.label,
			status: 'missing',
			severity: 'degraded',
			source: input.source,
			checkedAt: input.checkedAt,
			summary: input.summary,
			evidenceRef: input.evidenceRef,
			correlation: input.correlation
		}),
		blocker: makeOpenBlocker({
			id: input.blockerId,
			status: 'degraded',
			source: input.source,
			checkedAt: input.checkedAt,
			summary: input.summary,
			evidenceRef: input.evidenceRef,
			correlation: input.correlation
		})
	};
}

export async function collectHarnessWatchdogRuntime(
	options: CollectHarnessWatchdogRuntimeOptions = {}
): Promise<HarnessWatchdogRuntimeSnapshot> {
	const checkedAt = options.checkedAt ?? new Date().toISOString();
	const nowMs = options.nowMs ?? Date.now();
	const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
	const pendingRequest = await readWatchdogJsonArtifact({
		stateDir: options.stateDir,
		fileName: 'pending-request.json',
		id: 'state.pending-request',
		label: 'pending-request.json',
		source: 'spawner-state',
		checkedAt
	});
	const lastCanvasLoad = await readWatchdogJsonArtifact({
		stateDir: options.stateDir,
		fileName: 'last-canvas-load.json',
		id: 'state.last-canvas-load',
		label: 'last-canvas-load.json',
		source: 'prd-bridge',
		checkedAt
	});

	const board = (options.getBoard ?? getMissionControlBoard)();
	const provisionalCorrelation = resolveWatchdogCorrelation({
		requestId: options.requestId,
		missionId: options.missionId,
		traceRef: options.traceRef,
		pendingRequest: pendingRequest.value,
		lastCanvasLoad: lastCanvasLoad.value
	});
	const boardEntry = findBoardEntry(board, provisionalCorrelation.missionId);
	const correlation = resolveWatchdogCorrelation({
		...provisionalCorrelation,
		boardTraceRef: boardEntry?.traceRef ?? null
	});
	const rows: WatchdogProbeRow[] = [];
	const openBlockers: WatchdogOpenBlocker[] = [];
	const evidenceRefs = [pendingRequest.evidenceRef, lastCanvasLoad.evidenceRef];

	const resultArtifact = correlation.requestId
		? await readWatchdogJsonArtifact({
				stateDir: options.stateDir,
				fileName: `results/${safeRequestFileSegment(correlation.requestId)}.json`,
				id: 'state.prd-result',
				label: 'results/<requestId>.json',
				source: 'prd-bridge',
				checkedAt
			})
		: null;
	if (resultArtifact) evidenceRefs.push(resultArtifact.evidenceRef);

	if (!correlation.requestId || !resultArtifact || !resultArtifact.exists) {
		const missing = rowAndBlockerForMissing({
			id: 'runtime.prd_result',
			label: 'PRD result',
			source: 'prd-bridge',
			checkedAt,
			correlation,
			evidenceRef: resultArtifact?.evidenceRef.id ?? 'state.prd-result',
			summary: 'No PRD result file is available for the requested correlation.',
			blockerId: 'blocker.runtime.prd_result_missing'
		});
		rows.push(missing.row);
		openBlockers.push(missing.blocker);
	} else if (resultArtifact.error || !resultArtifact.value) {
		rows.push(makeWatchdogRow({
			id: 'runtime.prd_result',
			label: 'PRD result',
			status: 'error',
			severity: 'blocked',
			source: 'prd-bridge',
			checkedAt,
			summary: 'PRD result exists but could not be parsed.',
			evidenceRef: resultArtifact.evidenceRef.id,
			correlation
		}));
		openBlockers.push(makeOpenBlocker({
			id: 'blocker.runtime.prd_result_parse',
			status: 'blocked',
			source: 'prd-bridge',
			checkedAt,
			summary: 'PRD result JSON is unreadable.',
			evidenceRef: resultArtifact.evidenceRef.id,
			correlation
		}));
	} else {
		const resultRequestId = artifactRequestId(resultArtifact.value) || stringField(resultArtifact.value.requestId);
		const tasks = Array.isArray(resultArtifact.value.tasks) ? resultArtifact.value.tasks : [];
		const resultMatches = !resultRequestId || resultRequestId === correlation.requestId;
		const success = resultArtifact.value.success === true;
		const healthy = success && tasks.length > 0 && resultMatches;
		rows.push(makeWatchdogRow({
			id: 'runtime.prd_result',
			label: 'PRD result',
			status: healthy ? 'healthy' : 'degraded',
			severity: resultMatches ? (healthy ? 'healthy' : 'degraded') : 'blocked',
			source: 'prd-bridge',
			checkedAt,
			summary: healthy
				? `Canonical PRD result is present with ${tasks.length} task${tasks.length === 1 ? '' : 's'}.`
				: resultMatches
					? 'PRD result is present but not complete enough to claim healthy.'
					: 'PRD result requestId does not match the requested correlation.',
			evidenceRef: resultArtifact.evidenceRef.id,
			correlation
		}));
		if (!resultMatches) {
			openBlockers.push(makeOpenBlocker({
				id: 'blocker.runtime.prd_result_mismatch',
				status: 'blocked',
				source: 'prd-bridge',
				checkedAt,
				summary: 'PRD result belongs to a different requestId.',
				evidenceRef: resultArtifact.evidenceRef.id,
				correlation
			}));
		}
	}

	if (!lastCanvasLoad.exists || !lastCanvasLoad.value) {
		const missing = rowAndBlockerForMissing({
			id: 'runtime.canvas_load',
			label: 'Canvas load',
			source: 'prd-bridge',
			checkedAt,
			correlation,
			evidenceRef: lastCanvasLoad.evidenceRef.id,
			summary: 'No last Canvas load is available for the requested correlation.',
			blockerId: 'blocker.runtime.canvas_load_missing'
		});
		rows.push(missing.row);
		openBlockers.push(missing.blocker);
	} else {
		const matches = artifactMatchesCorrelation(lastCanvasLoad.value, correlation);
		const nodes = Array.isArray(lastCanvasLoad.value.nodes) ? lastCanvasLoad.value.nodes : [];
		const timestamp = artifactTimestamp(lastCanvasLoad.value) || lastCanvasLoad.modifiedAt;
		const stale = isStaleTimestamp(timestamp, nowMs, staleMs);
		rows.push(makeWatchdogRow({
			id: 'runtime.canvas_load',
			label: 'Canvas load',
			status: !matches ? 'blocked' : stale ? 'stale' : nodes.length > 0 ? 'healthy' : 'degraded',
			source: 'prd-bridge',
			checkedAt,
			summary: !matches
				? 'Last Canvas load belongs to a different mission or request.'
				: stale
					? 'Last Canvas load is stale for a live retest.'
					: nodes.length > 0
						? `Canvas load is aligned with ${nodes.length} node${nodes.length === 1 ? '' : 's'}.`
						: 'Canvas load is present but has no nodes.',
			evidenceRef: lastCanvasLoad.evidenceRef.id,
			correlation,
			details: [
				`pipelineId: ${stringField(lastCanvasLoad.value.pipelineId) || 'unknown'}`,
				`source: ${stringField(lastCanvasLoad.value.source) || 'unknown'}`
			]
		}));
		if (!matches || stale) {
			openBlockers.push(makeOpenBlocker({
				id: !matches ? 'blocker.runtime.canvas_load_mismatch' : 'blocker.runtime.canvas_load_stale',
				status: !matches ? 'blocked' : 'stale',
				source: 'prd-bridge',
				checkedAt,
				summary: !matches
					? 'Canvas load correlation does not match the requested mission/request.'
					: 'Canvas load is older than the accepted live retest window.',
				evidenceRef: lastCanvasLoad.evidenceRef.id,
				correlation
			}));
		}
	}

	if (!correlation.missionId) {
		const missing = rowAndBlockerForMissing({
			id: 'runtime.dispatch',
			label: 'Dispatch status',
			source: 'dispatch',
			checkedAt,
			correlation,
			evidenceRef: 'runtime.dispatch',
			summary: 'No missionId is available to read dispatch status.',
			blockerId: 'blocker.runtime.mission_id_missing'
		});
		rows.push(missing.row);
		openBlockers.push(missing.blocker);
	} else {
		const dispatchStatus = (options.getDispatchStatus ?? ((id) => providerRuntime.getMissionStatus(id)))(correlation.missionId);
		const providerCount = Object.keys(dispatchStatus.providers || {}).length;
		const blocked = dispatchStatus.anyFailed || Boolean(dispatchStatus.resumeBlocker);
		rows.push(makeWatchdogRow({
			id: 'runtime.dispatch',
			label: 'Dispatch status',
			status: blocked ? 'blocked' : providerCount > 0 || dispatchStatus.snapshotAvailable ? 'healthy' : 'degraded',
			source: 'dispatch',
			checkedAt,
			summary: blocked
				? 'Dispatch status has a failure or resume blocker.'
				: providerCount > 0
					? `Dispatch knows ${providerCount} provider${providerCount === 1 ? '' : 's'}.`
					: 'Dispatch status is available but has no provider snapshot.',
			evidenceRef: 'runtime.dispatch',
			correlation,
			details: [
				`allComplete: ${dispatchStatus.allComplete}`,
				`paused: ${dispatchStatus.paused}`,
				`snapshotAvailable: ${dispatchStatus.snapshotAvailable}`
			]
		}));
		if (blocked) {
			openBlockers.push(makeOpenBlocker({
				id: 'blocker.runtime.dispatch_blocked',
				status: 'blocked',
				source: 'dispatch',
				checkedAt,
				summary: 'Dispatch status reports failed provider state or a resume blocker.',
				evidenceRef: 'runtime.dispatch',
				correlation,
				details: dispatchStatus.resumeBlocker ? ['Resume blocker is present; raw text omitted.'] : undefined
			}));
		}

		const providerResults = (options.getProviderResults ?? ((id) => providerRuntime.getMissionResults(id)))(correlation.missionId);
		const terminalStatuses = new Set(['completed', 'failed', 'cancelled']);
		const failed = providerResults.filter((result) => result.status === 'failed' || result.status === 'cancelled');
		const allTerminal = providerResults.length > 0 && providerResults.every((result) => terminalStatuses.has(result.status));
		rows.push(makeWatchdogRow({
			id: 'runtime.provider',
			label: 'Provider runtime',
			status: providerResults.length === 0 ? 'missing' : failed.length > 0 ? 'blocked' : 'healthy',
			severity: providerResults.length === 0 ? 'degraded' : failed.length > 0 ? 'blocked' : 'healthy',
			source: 'provider-runtime',
			checkedAt,
			summary: providerResults.length === 0
				? 'Provider runtime has no result snapshot for this mission.'
				: `Provider runtime reports ${providerStatusSummary(providerResults)}${allTerminal ? ' terminal' : ''}.`,
			evidenceRef: 'runtime.provider-results',
			correlation,
			details: providerResults.map((result) => `${result.providerId}: ${result.status}`).slice(0, 8)
		}));
		evidenceRefs.push({
			id: 'runtime.provider-results',
			source: 'provider-runtime',
			label: 'provider result metadata',
			kind: 'runtime_snapshot',
			redaction: providerResults.length > 0 ? 'metadata_only' : 'not_available',
			checkedAt
		});
		if (providerResults.length === 0 || failed.length > 0) {
			openBlockers.push(makeOpenBlocker({
				id: providerResults.length === 0 ? 'blocker.runtime.provider_missing' : 'blocker.runtime.provider_failed',
				status: providerResults.length === 0 ? 'degraded' : 'blocked',
				source: 'provider-runtime',
				checkedAt,
				summary: providerResults.length === 0
					? 'Provider runtime evidence is missing.'
					: 'Provider runtime has failed or cancelled provider evidence.',
				evidenceRef: 'runtime.provider-results',
				correlation
			}));
		}
	}

	evidenceRefs.push({
		id: 'runtime.dispatch',
		source: 'dispatch',
		label: 'provider dispatch status metadata',
		kind: 'runtime_snapshot',
		redaction: correlation.missionId ? 'metadata_only' : 'not_available',
		checkedAt
	});

	if (!boardEntry) {
		rows.push(makeWatchdogRow({
			id: 'runtime.mission_control_board',
			label: 'Mission Control board',
			status: 'missing',
			severity: 'degraded',
			source: 'mission-control',
			checkedAt,
			summary: 'Mission Control board has no entry for this mission.',
			evidenceRef: 'runtime.mission-control-board',
			correlation
		}));
		openBlockers.push(makeOpenBlocker({
			id: 'blocker.runtime.board_missing',
			status: 'degraded',
			source: 'mission-control',
			checkedAt,
			summary: 'Mission Control board entry is missing.',
			evidenceRef: 'runtime.mission-control-board',
			correlation
		}));
	} else {
		const stale = isStaleTimestamp(boardEntry.lastUpdated, nowMs, staleMs);
		const blocked = boardEntry.status === 'failed' || boardEntry.status === 'cancelled';
		rows.push(makeWatchdogRow({
			id: 'runtime.mission_control_board',
			label: 'Mission Control board',
			status: blocked ? 'blocked' : stale ? 'stale' : boardEntry.status === 'created' ? 'degraded' : 'healthy',
			source: 'mission-control',
			checkedAt,
			summary: `Mission Control board reports ${boardEntry.status}.`,
			evidenceRef: 'runtime.mission-control-board',
			correlation,
			details: [
				`lastEventType: ${boardEntry.lastEventType}`,
				`taskCount: ${boardEntry.taskCount}`,
				`lastUpdated: ${boardEntry.lastUpdated}`
			]
		}));
		if (blocked || stale) {
			openBlockers.push(makeOpenBlocker({
				id: blocked ? 'blocker.runtime.board_terminal_blocked' : 'blocker.runtime.board_stale',
				status: blocked ? 'blocked' : 'stale',
				source: 'mission-control',
				checkedAt,
				summary: blocked
					? 'Mission Control board has terminal failed/cancelled state.'
					: 'Mission Control board entry is stale.',
				evidenceRef: 'runtime.mission-control-board',
				correlation
			}));
		}
	}
	evidenceRefs.push({
		id: 'runtime.mission-control-board',
		source: 'mission-control',
		label: 'Mission Control board entry metadata',
		kind: 'board_snapshot',
		redaction: boardEntry ? 'metadata_only' : 'not_available',
		checkedAt
	});

	const traceCandidates = [
		correlation.traceRef,
		artifactTraceRef(pendingRequest.value),
		artifactTraceRef(lastCanvasLoad.value),
		stringField(boardEntry?.traceRef)
	].filter((value): value is string => Boolean(value));
	const traceSet = new Set(traceCandidates);
	const traceBlocked = traceSet.size > 1;
	rows.push(makeWatchdogRow({
		id: 'runtime.trace',
		label: 'Trace availability',
		status: traceCandidates.length === 0 ? 'missing' : traceBlocked ? 'blocked' : 'healthy',
		severity: traceCandidates.length === 0 ? 'degraded' : traceBlocked ? 'blocked' : 'healthy',
		source: 'mission-control',
		checkedAt,
		summary: traceCandidates.length === 0
			? 'No traceRef is available from Spawner state.'
			: traceBlocked
				? 'Trace refs disagree across Spawner evidence.'
				: 'Trace ref is available and aligned.',
		evidenceRef: 'runtime.trace',
		correlation
	}));
	evidenceRefs.push({
		id: 'runtime.trace',
		source: 'mission-control',
		label: 'traceRef metadata',
		kind: 'trace_ref',
		redaction: traceCandidates.length > 0 ? 'metadata_only' : 'not_available',
		checkedAt
	});
	if (traceCandidates.length === 0 || traceBlocked) {
		openBlockers.push(makeOpenBlocker({
			id: traceBlocked ? 'blocker.runtime.trace_mismatch' : 'blocker.runtime.trace_missing',
			status: traceBlocked ? 'blocked' : 'degraded',
			source: 'mission-control',
			checkedAt,
			summary: traceBlocked ? 'Trace refs do not agree across pending, Canvas, and board evidence.' : 'Trace ref is missing.',
			evidenceRef: 'runtime.trace',
			correlation
		}));
	}

	return {
		...correlation,
		checkedAt,
		rows,
		openBlockers,
		evidenceRefs: mergeEvidenceRefs(evidenceRefs)
	};
}
