import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertWatchdogPayloadRedacted } from '$lib/services/harness-watchdog';
import { collectHarnessWatchdogRuntime, type WatchdogDispatchStatus } from './harness-watchdog-runtime';
import type { ProviderMissionResultSnapshot } from './provider-runtime';
import type { MissionControlBoardEntry } from '$lib/types/mission-control';

let stateDir = '';

const checkedAt = '2026-06-07T21:35:00.000Z';
const requestId = 'tg-build-02c441099b20-1780867252235';
const missionId = 'mission-1780867252235';
const traceRef = 'trace:spawner-prd:mission-1780867252235';

async function writeJson(fileName: string, value: unknown): Promise<void> {
	const filePath = path.join(stateDir, fileName);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function providerResult(overrides: Partial<ProviderMissionResultSnapshot> = {}): ProviderMissionResultSnapshot {
	return {
		providerId: 'codex',
		status: 'running',
		requestId,
		traceRef,
		response: 'raw provider output body should not appear',
		error: null,
		durationMs: null,
		tokenUsage: null,
		startedAt: '2026-06-07T21:25:44.000Z',
		completedAt: null,
		...overrides
	};
}

function dispatchStatus(overrides: Partial<WatchdogDispatchStatus> = {}): WatchdogDispatchStatus {
	return {
		allComplete: false,
		anyFailed: false,
		paused: false,
		pausedReason: null,
		lastReason: 'Dispatch started',
		snapshotAvailable: true,
		resumeable: false,
		resumeBlocker: null,
		providers: { codex: 'running' },
		...overrides
	};
}

function boardEntry(overrides: Partial<MissionControlBoardEntry> = {}): MissionControlBoardEntry {
	return {
		missionId,
		traceRef,
		missionName: 'Small Harness Watchdog Probe Board',
		status: 'running',
		lastEventType: 'task_started',
		lastUpdated: '2026-06-07T21:30:00.000Z',
		executionStarted: true,
		executionPolicy: null,
		queuedAt: '2026-06-07T21:25:44.000Z',
		startedAt: '2026-06-07T21:25:44.000Z',
		lastSummary: 'Task started.',
		taskName: 'Collect Spawner runtime health from execution state',
		taskCount: 10,
		taskNames: [],
		taskStatusCounts: { queued: 9, running: 1, completed: 0, failed: 0, cancelled: 0, total: 10 },
		tasks: [],
		telegramRelay: { profile: 'spark-recursive', port: 8791, url: null },
		...overrides
	};
}

describe('harness watchdog runtime collector', () => {
	beforeEach(async () => {
		stateDir = await mkdtemp(path.join(tmpdir(), 'watchdog-runtime-'));
		process.env.SPAWNER_STATE_DIR = stateDir;
	});

	afterEach(async () => {
		delete process.env.SPAWNER_STATE_DIR;
		if (stateDir && existsSync(stateDir)) {
			await rm(stateDir, { recursive: true, force: true });
		}
	});

	it('collects aligned PRD, Canvas, dispatch, provider, board, and trace rows', async () => {
		await writeJson('pending-request.json', {
			requestId,
			missionId,
			projectName: 'Small Harness Watchdog Probe Board',
			status: 'canvas_loaded',
			traceRef,
			relay: {
				requestId,
				missionId,
				traceRef,
				chatId: 'private-chat-id',
				userId: 'private-user-id',
				goal: 'raw request body should stay out'
			}
		});
		await writeJson('last-canvas-load.json', {
			requestId,
			missionId,
			traceRef,
			pipelineId: `prd-${requestId}`,
			source: 'prd-bridge',
			timestamp: '2026-06-07T21:25:44.000Z',
			executionPrompt: 'raw prompt should stay out',
			nodes: [{ id: 'task-1' }]
		});
		await writeJson(`results/${requestId}.json`, {
			requestId,
			success: true,
			executionPrompt: 'raw PRD execution prompt should stay out',
			tasks: [{ id: 'task-1', title: 'Collect runtime health' }]
		});

		const snapshot = await collectHarnessWatchdogRuntime({
			requestId,
			stateDir,
			checkedAt,
			nowMs: Date.parse('2026-06-07T21:35:00.000Z'),
			getProviderResults: () => [providerResult()],
			getDispatchStatus: () => dispatchStatus(),
			getBoard: () => ({ running: [boardEntry()] })
		});

		expect(snapshot.requestId).toBe(requestId);
		expect(snapshot.missionId).toBe(missionId);
		expect(snapshot.traceRef).toBe(traceRef);
		expect(snapshot.rows.map((row) => row.id)).toEqual(
			expect.arrayContaining([
				'runtime.prd_result',
				'runtime.canvas_load',
				'runtime.dispatch',
				'runtime.provider',
				'runtime.mission_control_board',
				'runtime.trace'
			])
		);
		expect(snapshot.rows.every((row) => row.severity === 'healthy')).toBe(true);
		expect(snapshot.openBlockers).toHaveLength(0);
		expect(JSON.stringify(snapshot)).not.toContain('raw prompt');
		expect(JSON.stringify(snapshot)).not.toContain('private-chat-id');
		expect(JSON.stringify(snapshot)).not.toContain('raw provider output body');
		expect(() => assertWatchdogPayloadRedacted(snapshot)).not.toThrow();
	});

	it('turns missing state into degraded rows and blockers instead of throwing', async () => {
		const snapshot = await collectHarnessWatchdogRuntime({
			stateDir,
			checkedAt,
			getProviderResults: () => [],
			getDispatchStatus: () => dispatchStatus({ providers: {}, snapshotAvailable: false }),
			getBoard: () => ({ running: [] })
		});

		expect(snapshot.rows.some((row) => row.status === 'missing')).toBe(true);
		expect(snapshot.openBlockers.length).toBeGreaterThan(0);
		expect(snapshot.openBlockers.every((blocker) => blocker.status === 'degraded')).toBe(true);
	});

	it('surfaces stale or mismatched mission evidence as blockers', async () => {
		await writeJson('pending-request.json', { requestId, missionId, traceRef });
		await writeJson('last-canvas-load.json', {
			requestId: 'tg-build-other-1780867252235',
			missionId: 'mission-other',
			traceRef,
			timestamp: '2026-06-01T00:00:00.000Z',
			nodes: [{ id: 'task-1' }]
		});
		await writeJson(`results/${requestId}.json`, {
			requestId,
			success: true,
			tasks: [{ id: 'task-1' }]
		});

		const snapshot = await collectHarnessWatchdogRuntime({
			requestId,
			missionId,
			stateDir,
			checkedAt,
			nowMs: Date.parse('2026-06-07T21:35:00.000Z'),
			getProviderResults: () => [providerResult({ status: 'failed', error: 'raw error omitted' })],
			getDispatchStatus: () => dispatchStatus({ anyFailed: true, providers: { codex: 'failed' } }),
			getBoard: () => ({ running: [boardEntry({ lastUpdated: '2026-06-01T00:00:00.000Z' })] })
		});

		expect(snapshot.rows.find((row) => row.id === 'runtime.canvas_load')?.status).toBe('blocked');
		expect(snapshot.rows.find((row) => row.id === 'runtime.provider')?.status).toBe('blocked');
		expect(snapshot.rows.find((row) => row.id === 'runtime.mission_control_board')?.status).toBe('stale');
		expect(snapshot.openBlockers.map((blocker) => blocker.id)).toEqual(
			expect.arrayContaining([
				'blocker.runtime.canvas_load_mismatch',
				'blocker.runtime.dispatch_blocked',
				'blocker.runtime.provider_failed',
				'blocker.runtime.board_stale'
			])
		);
		expect(JSON.stringify(snapshot)).not.toContain('raw error omitted');
	});
});
