import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnerStateDir } from './spawner-state';
import { extractTraceRef } from './trace-ref';
import type {
	WatchdogBoardStatus,
	WatchdogEvidenceRef,
	WatchdogOpenBlocker,
	WatchdogProbeRow,
	WatchdogRowStatus
} from '$lib/services/harness-watchdog';

export interface WatchdogJsonArtifact {
	id: string;
	label: string;
	source: string;
	fileName: string;
	value: Record<string, unknown> | null;
	exists: boolean;
	error: string | null;
	modifiedAt: string | null;
	evidenceRef: WatchdogEvidenceRef;
}

export interface WatchdogCorrelation {
	requestId: string | null;
	missionId: string | null;
	traceRef: string | null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function stringField(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function numberField(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value.trim());
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

export function safeRequestFileSegment(requestId: string): string {
	return requestId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function missionIdFromRequestId(requestId: string): string {
	const stamp = requestId.match(/(\d{10,})$/)?.[1];
	return `mission-${stamp || safeRequestFileSegment(requestId)}`;
}

export function relayFromArtifact(artifact: Record<string, unknown> | null): Record<string, unknown> | null {
	return isRecord(artifact?.relay) ? artifact.relay : null;
}

export function artifactRequestId(artifact: Record<string, unknown> | null): string | null {
	const relay = relayFromArtifact(artifact);
	return stringField(artifact?.requestId) || stringField(relay?.requestId);
}

export function artifactMissionId(artifact: Record<string, unknown> | null): string | null {
	const relay = relayFromArtifact(artifact);
	return stringField(artifact?.missionId) || stringField(relay?.missionId);
}

export function artifactTraceRef(artifact: Record<string, unknown> | null): string | null {
	const relay = relayFromArtifact(artifact);
	return extractTraceRef(artifact, relay) || null;
}

export function artifactTimestamp(artifact: Record<string, unknown> | null): string | null {
	return (
		stringField(artifact?.checkedAt) ||
		stringField(artifact?.updatedAt) ||
		stringField(artifact?.canvasLoadedAt) ||
		stringField(artifact?.timestamp) ||
		stringField(artifact?.createdAt)
	);
}

export function evidenceRef(input: {
	id: string;
	source: string;
	label: string;
	kind?: string;
	checkedAt: string;
	redaction?: WatchdogEvidenceRef['redaction'];
}): WatchdogEvidenceRef {
	return {
		id: input.id,
		source: input.source,
		label: input.label,
		kind: input.kind ?? 'state_ref',
		redaction: input.redaction ?? 'metadata_only',
		checkedAt: input.checkedAt
	};
}

export function mergeEvidenceRefs(...groups: WatchdogEvidenceRef[][]): WatchdogEvidenceRef[] {
	const byId = new Map<string, WatchdogEvidenceRef>();
	for (const group of groups) {
		for (const ref of group) {
			byId.set(ref.id, ref);
		}
	}
	return [...byId.values()];
}

export function makeWatchdogRow(input: {
	id: string;
	label: string;
	status: WatchdogRowStatus;
	severity?: WatchdogBoardStatus;
	source: string;
	checkedAt: string;
	summary: string;
	evidenceRef?: string | null;
	correlation: WatchdogCorrelation;
	details?: string[];
}): WatchdogProbeRow {
	return {
		id: input.id,
		label: input.label,
		status: input.status,
		severity: input.severity ?? severityFromRowStatus(input.status),
		source: input.source,
		checkedAt: input.checkedAt,
		summary: input.summary,
		evidenceRef: input.evidenceRef ?? null,
		requestId: input.correlation.requestId,
		missionId: input.correlation.missionId,
		traceRef: input.correlation.traceRef,
		...(input.details?.length ? { details: input.details } : {})
	};
}

export function makeOpenBlocker(input: {
	id: string;
	status: WatchdogOpenBlocker['status'];
	source: string;
	checkedAt: string;
	summary: string;
	evidenceRef?: string | null;
	correlation: WatchdogCorrelation;
	details?: string[];
	rollbackNoteId?: string | null;
}): WatchdogOpenBlocker {
	return {
		id: input.id,
		status: input.status,
		source: input.source,
		checkedAt: input.checkedAt,
		summary: input.summary,
		evidenceRef: input.evidenceRef ?? null,
		requestId: input.correlation.requestId,
		missionId: input.correlation.missionId,
		traceRef: input.correlation.traceRef,
		...(input.details?.length ? { details: input.details } : {}),
		...(input.rollbackNoteId ? { rollbackNoteId: input.rollbackNoteId } : {})
	};
}

export function severityFromRowStatus(status: WatchdogRowStatus): WatchdogBoardStatus {
	if (status === 'approved') return 'healthy';
	if (status === 'denied' || status === 'missing' || status === 'interrupted' || status === 'machine-policy-origin') {
		return 'blocked';
	}
	return status;
}

export function resolveWatchdogCorrelation(input: {
	requestId?: string | null;
	missionId?: string | null;
	traceRef?: string | null;
	pendingRequest?: Record<string, unknown> | null;
	lastCanvasLoad?: Record<string, unknown> | null;
	boardTraceRef?: string | null;
}): WatchdogCorrelation {
	const requestId =
		stringField(input.requestId) ||
		artifactRequestId(input.pendingRequest ?? null) ||
		artifactRequestId(input.lastCanvasLoad ?? null);
	const missionId =
		stringField(input.missionId) ||
		artifactMissionId(input.pendingRequest ?? null) ||
		artifactMissionId(input.lastCanvasLoad ?? null) ||
		(requestId ? missionIdFromRequestId(requestId) : null);
	const traceRef =
		stringField(input.traceRef) ||
		artifactTraceRef(input.pendingRequest ?? null) ||
		artifactTraceRef(input.lastCanvasLoad ?? null) ||
		stringField(input.boardTraceRef);

	return {
		requestId,
		missionId,
		traceRef
	};
}

export function artifactMatchesCorrelation(
	artifact: Record<string, unknown> | null,
	correlation: Pick<WatchdogCorrelation, 'requestId' | 'missionId'>
): boolean {
	if (!artifact) return false;
	const requestId = artifactRequestId(artifact);
	const missionId = artifactMissionId(artifact);
	return Boolean(
		(correlation.requestId && requestId === correlation.requestId) ||
		(correlation.missionId && missionId === correlation.missionId)
	);
}

export async function readWatchdogJsonArtifact(input: {
	stateDir?: string;
	fileName: string;
	id: string;
	label: string;
	source: string;
	checkedAt: string;
}): Promise<WatchdogJsonArtifact> {
	const stateDir = input.stateDir ?? spawnerStateDir();
	const filePath = path.join(stateDir, input.fileName);
	const ref = evidenceRef({
		id: input.id,
		source: input.source,
		label: input.label,
		checkedAt: input.checkedAt,
		redaction: existsSync(filePath) ? 'metadata_only' : 'not_available'
	});

	if (!existsSync(filePath)) {
		return {
			id: input.id,
			label: input.label,
			source: input.source,
			fileName: input.fileName,
			value: null,
			exists: false,
			error: null,
			modifiedAt: null,
			evidenceRef: ref
		};
	}

	try {
		const [raw, stats] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)]);
		return {
			id: input.id,
			label: input.label,
			source: input.source,
			fileName: input.fileName,
			value: JSON.parse(raw) as Record<string, unknown>,
			exists: true,
			error: null,
			modifiedAt: stats.mtime.toISOString(),
			evidenceRef: ref
		};
	} catch (error) {
		return {
			id: input.id,
			label: input.label,
			source: input.source,
			fileName: input.fileName,
			value: null,
			exists: true,
			error: error instanceof Error ? error.message : String(error),
			modifiedAt: null,
			evidenceRef: {
				...ref,
				redaction: 'metadata_only'
			}
		};
	}
}
