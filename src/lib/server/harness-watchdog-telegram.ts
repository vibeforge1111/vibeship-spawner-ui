import { getMissionControlRelaySnapshot, type MissionControlRelaySnapshot } from './mission-control-relay';
import type {
	WatchdogEvidenceRef,
	WatchdogOpenBlocker,
	WatchdogTelegramProofRow
} from '$lib/services/harness-watchdog';
import {
	artifactMissionId,
	artifactRequestId,
	artifactTraceRef,
	evidenceRef,
	isRecord,
	makeOpenBlocker,
	makeWatchdogRow,
	mergeEvidenceRefs,
	numberField,
	readWatchdogJsonArtifact,
	resolveWatchdogCorrelation,
	stringField,
	type WatchdogCorrelation
} from './harness-watchdog-state';

export interface CollectHarnessWatchdogTelegramOptions {
	requestId?: string | null;
	missionId?: string | null;
	traceRef?: string | null;
	stateDir?: string;
	checkedAt?: string;
	getRelaySnapshot?: (missionId?: string) => MissionControlRelaySnapshot;
}

export interface HarnessWatchdogTelegramSnapshot {
	requestId: string | null;
	missionId: string | null;
	traceRef: string | null;
	checkedAt: string;
	rows: WatchdogTelegramProofRow[];
	openBlockers: WatchdogOpenBlocker[];
	evidenceRefs: WatchdogEvidenceRef[];
}

interface RelayProofMetadata {
	relayProfile: string | null;
	relayPort: number | null;
	eventSource: string | null;
}

type CorrelationField = 'requestId' | 'missionId' | 'traceRef';

function makeTelegramRow(input: {
	id: string;
	label: string;
	status: WatchdogTelegramProofRow['status'];
	severity?: WatchdogTelegramProofRow['severity'];
	source: string;
	checkedAt: string;
	summary: string;
	evidenceRef: string | null;
	correlation: WatchdogCorrelation;
	relay: RelayProofMetadata;
	details?: string[];
}): WatchdogTelegramProofRow {
	return {
		...makeWatchdogRow(input),
		relayProfile: input.relay.relayProfile,
		relayPort: input.relay.relayPort,
		eventSource: input.relay.eventSource
	};
}

function relayFromRecord(record: Record<string, unknown> | null): { profile: string | null; port: number | null } {
	if (!record) return { profile: null, port: null };
	const nestedRelay = isRecord(record.relay) ? record.relay : {};
	const telegramRelay = isRecord(record.telegramRelay)
		? record.telegramRelay
		: isRecord(nestedRelay.telegramRelay)
			? nestedRelay.telegramRelay
			: {};
	return {
		profile:
			stringField(telegramRelay.profile) ||
			stringField(record.telegramRelayProfile) ||
			stringField(nestedRelay.telegramRelayProfile),
		port:
			numberField(telegramRelay.port) ||
			numberField(record.telegramRelayPort) ||
			numberField(nestedRelay.telegramRelayPort)
	};
}

function valuesByField(input: {
	pendingRequest: Record<string, unknown> | null;
	lastCanvasLoad: Record<string, unknown> | null;
	event: MissionControlRelaySnapshot['recent'][number] | null;
	correlation: WatchdogCorrelation;
}): Record<CorrelationField, Array<{ source: string; value: string | null }>> {
	return {
		requestId: [
			{ source: 'requested', value: input.correlation.requestId },
			{ source: 'pending-request', value: artifactRequestId(input.pendingRequest) },
			{ source: 'canvas-load', value: artifactRequestId(input.lastCanvasLoad) },
			{ source: 'mission-control', value: stringField(input.event?.requestId) }
		],
		missionId: [
			{ source: 'requested', value: input.correlation.missionId },
			{ source: 'pending-request', value: artifactMissionId(input.pendingRequest) },
			{ source: 'canvas-load', value: artifactMissionId(input.lastCanvasLoad) },
			{ source: 'mission-control', value: stringField(input.event?.missionId) }
		],
		traceRef: [
			{ source: 'requested', value: input.correlation.traceRef },
			{ source: 'pending-request', value: artifactTraceRef(input.pendingRequest) },
			{ source: 'canvas-load', value: artifactTraceRef(input.lastCanvasLoad) },
			{ source: 'mission-control', value: stringField(input.event?.traceRef) }
		]
	};
}

function mismatchedFields(input: ReturnType<typeof valuesByField>): Array<{ field: CorrelationField; details: string[] }> {
	return (Object.entries(input) as Array<[CorrelationField, Array<{ source: string; value: string | null }>]>) 
		.map(([field, values]) => {
			const known = values.filter((entry): entry is { source: string; value: string } => Boolean(entry.value));
			const unique = new Set(known.map((entry) => entry.value));
			if (unique.size <= 1) return null;
			return {
				field,
				details: known.map((entry) => `${entry.source}: ${entry.value}`)
			};
		})
		.filter((entry): entry is { field: CorrelationField; details: string[] } => Boolean(entry));
}

function latestMissionEvent(
	snapshot: MissionControlRelaySnapshot,
	correlation: WatchdogCorrelation
): MissionControlRelaySnapshot['recent'][number] | null {
	return (
		snapshot.recent.find(
			(entry) =>
				(correlation.missionId && entry.missionId === correlation.missionId) ||
				(correlation.requestId && entry.requestId === correlation.requestId) ||
				(correlation.traceRef && entry.traceRef === correlation.traceRef)
		) ?? snapshot.recent[0] ?? null
	);
}

function blockerFromRow(row: WatchdogTelegramProofRow): WatchdogOpenBlocker | null {
	if (row.severity === 'healthy') return null;
	if (!['blocked', 'degraded', 'stale', 'error', 'empty'].includes(row.severity)) return null;
	return makeOpenBlocker({
		id: `blocker.${row.id}`,
		status: row.severity as WatchdogOpenBlocker['status'],
		source: row.source,
		checkedAt: row.checkedAt,
		summary: row.summary,
		evidenceRef: row.evidenceRef,
		correlation: {
			requestId: row.requestId ?? null,
			missionId: row.missionId ?? null,
			traceRef: row.traceRef ?? null
		},
		details: row.details
	});
}

export async function collectHarnessWatchdogTelegram(
	options: CollectHarnessWatchdogTelegramOptions = {}
): Promise<HarnessWatchdogTelegramSnapshot> {
	const checkedAt = options.checkedAt ?? new Date().toISOString();
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
	const correlation = resolveWatchdogCorrelation({
		requestId: options.requestId,
		missionId: options.missionId,
		traceRef: options.traceRef,
		pendingRequest: pendingRequest.value,
		lastCanvasLoad: lastCanvasLoad.value
	});
	const snapshot = (options.getRelaySnapshot ?? getMissionControlRelaySnapshot)(correlation.missionId ?? undefined);
	const event = latestMissionEvent(snapshot, correlation);
	const eventRelay = event?.telegramRelay ?? null;
	const pendingRelay = relayFromRecord(pendingRequest.value);
	const canvasRelay = relayFromRecord(lastCanvasLoad.value);
	const relay: RelayProofMetadata = {
		relayProfile: pendingRelay.profile || canvasRelay.profile || eventRelay?.profile || null,
		relayPort: pendingRelay.port || canvasRelay.port || eventRelay?.port || null,
		eventSource: stringField(event?.source)
	};
	const correlationValues = valuesByField({
		pendingRequest: pendingRequest.value,
		lastCanvasLoad: lastCanvasLoad.value,
		event,
		correlation
	});
	const mismatches = mismatchedFields(correlationValues);
	const rows: WatchdogTelegramProofRow[] = [];
	const relayEvidence = evidenceRef({
		id: 'telegram.mission-control-relay',
		source: 'mission-control',
		label: 'Mission Control relay metadata',
		kind: 'relay_snapshot',
		redaction: event ? 'metadata_only' : 'not_available',
		checkedAt
	});
	const evidenceRefs = mergeEvidenceRefs([pendingRequest.evidenceRef, lastCanvasLoad.evidenceRef, relayEvidence]);

	rows.push(
		makeTelegramRow({
			id: 'telegram.relay',
			label: 'Telegram relay',
			status: relay.relayProfile || relay.relayPort ? 'healthy' : 'missing',
			severity: relay.relayProfile || relay.relayPort ? 'healthy' : 'degraded',
			source: 'telegram-relay',
			checkedAt,
			summary: relay.relayProfile || relay.relayPort
				? 'Relay profile or port metadata is available.'
				: 'Relay profile and port metadata are missing.',
			evidenceRef: relay.relayProfile || relay.relayPort ? pendingRequest.evidenceRef.id : relayEvidence.id,
			correlation,
			relay
		})
	);

	rows.push(
		makeTelegramRow({
			id: 'telegram.pending_request',
			label: 'Pending request proof',
			status: pendingRequest.exists && pendingRequest.value ? 'healthy' : 'missing',
			severity: pendingRequest.exists && pendingRequest.value ? 'healthy' : 'degraded',
			source: 'spawner-state',
			checkedAt,
			summary: pendingRequest.exists && pendingRequest.value
				? 'Pending request carries safe request, mission, and trace metadata.'
				: 'Pending request metadata is unavailable.',
			evidenceRef: pendingRequest.evidenceRef.id,
			correlation,
			relay
		})
	);

	rows.push(
		makeTelegramRow({
			id: 'telegram.canvas_load',
			label: 'Canvas load proof',
			status: lastCanvasLoad.exists && lastCanvasLoad.value ? 'healthy' : 'missing',
			severity: lastCanvasLoad.exists && lastCanvasLoad.value ? 'healthy' : 'degraded',
			source: 'prd-bridge',
			checkedAt,
			summary: lastCanvasLoad.exists && lastCanvasLoad.value
				? 'Last Canvas load carries safe request, mission, and trace metadata.'
				: 'Last Canvas load metadata is unavailable.',
			evidenceRef: lastCanvasLoad.evidenceRef.id,
			correlation,
			relay
		})
	);

	rows.push(
		makeTelegramRow({
			id: 'telegram.event_source',
			label: 'Last event source',
			status: event ? 'healthy' : 'missing',
			severity: event ? 'healthy' : 'degraded',
			source: 'mission-control',
			checkedAt,
			summary: event ? `Latest Mission Control relay source is ${event.source}.` : 'No Mission Control relay event is available.',
			evidenceRef: relayEvidence.id,
			correlation,
			relay,
			details: event ? [`eventType: ${event.eventType}`, `timestamp: ${event.timestamp}`] : undefined
		})
	);

	rows.push(
		makeTelegramRow({
			id: 'telegram.correlation',
			label: 'Correlation proof',
			status: mismatches.length ? 'blocked' : 'healthy',
			severity: mismatches.length ? 'blocked' : 'healthy',
			source: 'mission-control',
			checkedAt,
			summary: mismatches.length
				? 'Pending request, Canvas load, or Mission Control trace metadata disagree.'
				: 'requestId, missionId, and traceRef are aligned across available Telegram proof.',
			evidenceRef: relayEvidence.id,
			correlation,
			relay,
			details: mismatches.flatMap((mismatch) => [`mismatch: ${mismatch.field}`, ...mismatch.details])
		})
	);

	const openBlockers = rows
		.map(blockerFromRow)
		.filter((blocker): blocker is WatchdogOpenBlocker => Boolean(blocker));

	return {
		...correlation,
		checkedAt,
		rows,
		openBlockers,
		evidenceRefs
	};
}
