import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { env } from '$env/dynamic/private';
import {
	getMissionControlBoard,
	getMissionControlRelaySnapshot,
	type MissionControlBoardEntry
} from './mission-control-relay';
import {
	enrichMissionControlBoardWithProviderResults,
	type MissionControlResultSummary
} from './mission-control-results';
import type { ProviderMissionResultSnapshot } from './provider-runtime';
import type { MissionControlTracePhase } from '$lib/types/mission-control';

type BoardBuckets = Record<string, Array<MissionControlBoardEntry & MissionControlResultSummary>>;

export interface MissionControlTrace {
	ok: true;
	missionId: string | null;
	requestId: string | null;
	phase: MissionControlTracePhase;
	summary: string;
	progress: {
		percent: number;
		taskCounts: MissionControlBoardEntry['taskStatusCounts'] | null;
		currentTask: string | null;
	};
	surfaces: {
		telegram: {
			relay: MissionControlBoardEntry['telegramRelay'] | null;
			chatId: string | null;
			userId: string | null;
		};
		canvas: {
			pipelineId: string | null;
			pipelineName: string | null;
			autoRun: boolean | null;
			nodeCount: number | null;
		};
		kanban: {
			bucket: string | null;
			entry: (MissionControlBoardEntry & MissionControlResultSummary) | null;
		};
		dispatch: {
			allComplete: boolean;
			anyFailed: boolean;
			paused: boolean;
			providers: Record<string, string>;
			lastReason: string | null;
		} | null;
	};
	artifacts: {
		pendingRequest: Record<string, unknown> | null;
		analysisResult: Record<string, unknown> | null;
		lastCanvasLoad: Record<string, unknown> | null;
	};
	timeline: ReturnType<typeof getMissionControlRelaySnapshot>['recent'];
	providerResults: MissionControlResultSummary['providerResults'];
	providerSummary: string | null;
	serverTime: string;
}

function getSpawnerDir(): string {
	return process.env.SPAWNER_STATE_DIR || env.SPAWNER_STATE_DIR || path.resolve(process.cwd(), '.spawner');
}

function normalizeId(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed || null;
}

function relayFromArtifact(artifact: Record<string, unknown> | null): Record<string, unknown> | null {
	return artifact?.relay && typeof artifact.relay === 'object'
		? (artifact.relay as Record<string, unknown>)
		: null;
}

function artifactRequestId(artifact: Record<string, unknown> | null): string | null {
	const relay = relayFromArtifact(artifact);
	return (
		(typeof artifact?.requestId === 'string' && artifact.requestId) ||
		(typeof relay?.requestId === 'string' && relay.requestId) ||
		null
	);
}

function artifactMissionId(artifact: Record<string, unknown> | null): string | null {
	const relay = relayFromArtifact(artifact);
	return (
		(typeof artifact?.missionId === 'string' && artifact.missionId) ||
		(typeof relay?.missionId === 'string' && relay.missionId) ||
		null
	);
}

function artifactMatches(
	artifact: Record<string, unknown> | null,
	missionId: string | null,
	requestId: string | null
): boolean {
	if (!artifact) return false;
	if (!missionId && !requestId) return true;
	const candidateMissionId = artifactMissionId(artifact);
	const candidateRequestId = artifactRequestId(artifact);
	return Boolean(
		(missionId && candidateMissionId === missionId) ||
		(requestId && candidateRequestId === requestId)
	);
}

export function missionIdFromRequestId(requestId: string): string {
	const stamp = requestId.match(/(\d{10,})$/)?.[1];
	return `mission-${stamp || requestId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

async function readJsonIfExists(filePath: string): Promise<Record<string, unknown> | null> {
	if (!existsSync(filePath)) return null;
	try {
		return JSON.parse(await readFile(filePath, 'utf-8')) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function findBoardEntry(board: BoardBuckets, missionId: string | null) {
	if (!missionId) return { bucket: null, entry: null };
	for (const [bucket, entries] of Object.entries(board)) {
		const entry = entries.find((candidate) => candidate.missionId === missionId);
		if (entry) return { bucket, entry };
	}
	return { bucket: null, entry: null };
}

function progressPercent(entry: MissionControlBoardEntry | null): number {
	if (!entry?.taskStatusCounts?.total) return 0;
	const { completed, failed, cancelled, running, total } = entry.taskStatusCounts;
	const terminalTasks = completed + failed + cancelled;
	if (terminalTasks >= total) return 100;
	if (entry.tasks.length > 0) {
		const progressSum = entry.tasks.reduce((sum, task) => {
			if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') return sum + 100;
			if (task.status === 'running') return sum + Math.max(1, Math.min(92, Math.round(task.progress ?? 35)));
			return sum;
		}, 0);
		const taskProgress = Math.round(progressSum / total);
		if (taskProgress > 0) return Math.min(99, taskProgress);
	}
	if (running > 0) {
		return Math.max(1, Math.round(((terminalTasks + running * 0.35) / total) * 100));
	}
	return Math.round((terminalTasks / total) * 100);
}

function phaseFor(input: {
	boardBucket: string | null;
	dispatchStatus: MissionControlTrace['surfaces']['dispatch'];
	pendingRequest: Record<string, unknown> | null;
	analysisResult: Record<string, unknown> | null;
	lastCanvasLoad: Record<string, unknown> | null;
}): MissionControlTracePhase {
	if (input.boardBucket === 'failed' || input.dispatchStatus?.anyFailed) return 'failed';
	if (input.boardBucket === 'cancelled') return 'cancelled';
	if (input.boardBucket === 'paused' || input.dispatchStatus?.paused) return 'paused';
	if (input.boardBucket === 'completed' || input.dispatchStatus?.allComplete) return 'completed';
	if (input.boardBucket === 'running' || Object.values(input.dispatchStatus?.providers || {}).includes('running')) {
		return 'executing';
	}
	if (input.lastCanvasLoad) return 'canvas_ready';
	if (input.analysisResult) return 'planning';
	if (input.pendingRequest) return 'planning';
	return 'unknown';
}

function summaryFor(phase: MissionControlTracePhase, entry: MissionControlBoardEntry | null): string {
	if (entry?.lastSummary) return entry.lastSummary;
	switch (phase) {
		case 'planning':
			return 'Spark is shaping the PRD and preparing the canvas.';
		case 'canvas_ready':
			return 'Canvas pipeline is ready for execution.';
		case 'executing':
			return 'Mission execution is in progress.';
		case 'completed':
			return 'Mission completed.';
		case 'failed':
			return 'Mission failed.';
		case 'paused':
			return 'Mission paused.';
		case 'cancelled':
			return 'Mission cancelled.';
		default:
			return 'No trace data found for this mission yet.';
	}
}

export async function buildMissionControlTrace(input: {
	missionId?: string | null;
	requestId?: string | null;
	getProviderResults: (missionId: string) => ProviderMissionResultSnapshot[];
	getDispatchStatus?: (missionId: string) => MissionControlTrace['surfaces']['dispatch'];
}): Promise<MissionControlTrace> {
	const requestedRequestId = normalizeId(input.requestId);
	const requestedMissionId = normalizeId(input.missionId);
	const spawnerDir = getSpawnerDir();
	const pendingRequestRaw = await readJsonIfExists(path.join(spawnerDir, 'pending-request.json'));
	const lastCanvasLoadRaw = await readJsonIfExists(path.join(spawnerDir, 'last-canvas-load.json'));
	const pendingRequest = artifactMatches(pendingRequestRaw, requestedMissionId, requestedRequestId)
		? pendingRequestRaw
		: null;
	const lastCanvasLoad = artifactMatches(lastCanvasLoadRaw, requestedMissionId, requestedRequestId)
		? lastCanvasLoadRaw
		: null;
	const requestId =
		requestedRequestId ||
		artifactRequestId(pendingRequest) ||
		artifactRequestId(lastCanvasLoad) ||
		null;
	const missionId =
		requestedMissionId ||
		artifactMissionId(pendingRequest) ||
		artifactMissionId(lastCanvasLoad) ||
		(requestId ? missionIdFromRequestId(requestId) : null);
	const analysisResult = requestId
		? await readJsonIfExists(path.join(spawnerDir, 'results', `${requestId}.json`))
		: null;

	const board = enrichMissionControlBoardWithProviderResults(
		getMissionControlBoard(),
		input.getProviderResults
	) as BoardBuckets;
	const { bucket, entry } = findBoardEntry(board, missionId);
	const dispatchStatus = missionId && input.getDispatchStatus ? input.getDispatchStatus(missionId) : null;
	const relay = entry?.telegramRelay ?? null;
	const traceSnapshot = getMissionControlRelaySnapshot(missionId || undefined);
	const phase = phaseFor({
		boardBucket: bucket,
		dispatchStatus,
		pendingRequest,
		analysisResult,
		lastCanvasLoad
	});

	return {
		ok: true,
		missionId,
		requestId,
		phase,
		summary: summaryFor(phase, entry),
		progress: {
			percent: progressPercent(entry),
			taskCounts: entry?.taskStatusCounts ?? null,
			currentTask: entry?.taskName ?? null
		},
		surfaces: {
			telegram: {
				relay,
				chatId:
					typeof pendingRequest?.relay === 'object' && pendingRequest.relay
						? ((pendingRequest.relay as Record<string, unknown>).chatId as string) || null
						: null,
				userId:
					typeof pendingRequest?.relay === 'object' && pendingRequest.relay
						? ((pendingRequest.relay as Record<string, unknown>).userId as string) || null
						: null
			},
			canvas: {
				pipelineId: typeof lastCanvasLoad?.pipelineId === 'string' ? lastCanvasLoad.pipelineId : null,
				pipelineName: typeof lastCanvasLoad?.pipelineName === 'string' ? lastCanvasLoad.pipelineName : null,
				autoRun: typeof lastCanvasLoad?.autoRun === 'boolean' ? lastCanvasLoad.autoRun : null,
				nodeCount: Array.isArray(lastCanvasLoad?.nodes) ? lastCanvasLoad.nodes.length : null
			},
			kanban: {
				bucket,
				entry
			},
			dispatch: dispatchStatus
		},
		artifacts: {
			pendingRequest,
			analysisResult,
			lastCanvasLoad
		},
		timeline: traceSnapshot.recent,
		providerResults: entry?.providerResults ?? [],
		providerSummary: entry?.providerSummary ?? null,
		serverTime: new Date().toISOString()
	};
}
