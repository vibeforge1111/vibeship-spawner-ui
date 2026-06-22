import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectHarnessWatchdogTelegram } from './harness-watchdog-telegram';
import type { MissionControlRelaySnapshot } from './mission-control-relay';

const checkedAt = '2026-06-07T22:00:00.000Z';
const requestId = 'tg-build-02c441099b20-1780867252235';
const missionId = 'mission-1780867252235';
const traceRef = 'trace:spawner-prd:mission-1780867252235';

let stateDir: string;

function relaySnapshot(overrides: Partial<MissionControlRelaySnapshot['recent'][number]> = {}): MissionControlRelaySnapshot {
	return {
		enabled: { sparkIngest: false, webhooks: true },
		persistence: { path: '<redacted>', exists: true, sizeBytes: 1 },
		targets: { sparkIngestUrl: null, webhookCount: 1 },
		stats: { totalRelayed: 1, perMission: { [missionId]: 1 } },
		recent: [
			{
				eventType: 'task_started',
				missionId,
				missionName: 'Small Harness Watchdog Probe Board',
				executionPolicy: 'manual_run',
				taskId: 'node-4-task-4',
				taskName: 'Collect Telegram proof',
				taskSkills: [],
				plannedTasks: [],
				assignedTaskIds: [],
				requestId,
				traceRef,
				progress: 50,
				summary: 'Task started.',
				timestamp: checkedAt,
				source: 'codex',
				telegramRelay: { port: 8791, profile: 'spark-recursive', url: null },
				missionControlAccess: null,
				projectLineage: null,
				...overrides
			}
		]
	};
}

async function writeJson(relativePath: string, value: unknown) {
	const filePath = path.join(stateDir, relativePath);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

async function writeBaseState(canvasOverrides: Record<string, unknown> = {}) {
	await writeJson('pending-request.json', {
		requestId,
		missionId,
		traceRef,
		status: 'canvas_loaded',
		relay: {
			requestId,
			missionId,
			traceRef,
			chatId: '1000000001',
			userId: '1000000001',
			goal: 'Do not expose this raw prompt.',
			telegramRelay: { port: 8791, profile: 'spark-recursive', url: 'http://127.0.0.1:8791/spawner-events' }
		}
	});
	await writeJson('last-canvas-load.json', {
		requestId,
		missionId,
		traceRef,
		pipelineId: `prd-${requestId}`,
		source: 'prd-bridge',
		canvasLoadedAt: checkedAt,
		telegramRelay: { port: 8791, profile: 'spark-recursive' },
		...canvasOverrides
	});
}

describe('collectHarnessWatchdogTelegram', () => {
	beforeEach(async () => {
		stateDir = await mkdtemp(path.join(tmpdir(), 'harness-watchdog-telegram-'));
	});

	afterEach(async () => {
		await rm(stateDir, { recursive: true, force: true });
	});

	it('reports aligned Telegram relay proof with safe mission correlation fields', async () => {
		await writeBaseState();

		const snapshot = await collectHarnessWatchdogTelegram({
			stateDir,
			checkedAt,
			getRelaySnapshot: () => relaySnapshot()
		});

		expect(snapshot.requestId).toBe(requestId);
		expect(snapshot.missionId).toBe(missionId);
		expect(snapshot.traceRef).toBe(traceRef);
		expect(snapshot.rows.find((row) => row.id === 'telegram.relay')).toMatchObject({
			status: 'healthy',
			relayProfile: 'spark-recursive',
			relayPort: 8791
		});
		expect(snapshot.rows.find((row) => row.id === 'telegram.event_source')).toMatchObject({
			status: 'healthy',
			eventSource: 'codex'
		});
		expect(snapshot.rows.find((row) => row.id === 'telegram.correlation')).toMatchObject({
			status: 'healthy'
		});
		expect(snapshot.openBlockers).toEqual([]);
		const payload = JSON.stringify(snapshot);
		expect(payload).not.toContain('1000000001');
		expect(payload).not.toContain('chatId');
		expect(payload).not.toContain('userId');
		expect(payload).not.toContain('Do not expose this raw prompt');
		expect(payload).not.toContain('127.0.0.1:8791');
	});

	it('surfaces requestId, missionId, or traceRef mismatches as open blockers', async () => {
		await writeBaseState({
			requestId: 'tg-build-other-request',
			traceRef: 'trace:spawner-prd:mission-other'
		});

		const snapshot = await collectHarnessWatchdogTelegram({
			stateDir,
			checkedAt,
			requestId,
			missionId,
			traceRef,
			getRelaySnapshot: () => relaySnapshot({ traceRef: 'trace:spawner-prd:mission-event-mismatch' })
		});

		const correlation = snapshot.rows.find((row) => row.id === 'telegram.correlation');
		expect(correlation).toMatchObject({
			status: 'blocked',
			severity: 'blocked'
		});
		expect(correlation?.details?.join(' ')).toContain('requestId');
		expect(correlation?.details?.join(' ')).toContain('traceRef');
		expect(snapshot.openBlockers.map((blocker) => blocker.id)).toContain('blocker.telegram.correlation');
	});

	it('turns missing Telegram state into degraded rows instead of throwing', async () => {
		const snapshot = await collectHarnessWatchdogTelegram({
			stateDir,
			checkedAt,
			requestId,
			missionId,
			traceRef,
			getRelaySnapshot: () => ({ ...relaySnapshot(), recent: [] })
		});

		expect(snapshot.rows.find((row) => row.id === 'telegram.pending_request')).toMatchObject({
			status: 'missing',
			severity: 'degraded'
		});
		expect(snapshot.rows.find((row) => row.id === 'telegram.canvas_load')).toMatchObject({
			status: 'missing',
			severity: 'degraded'
		});
		expect(snapshot.rows.find((row) => row.id === 'telegram.event_source')).toMatchObject({
			status: 'missing',
			severity: 'degraded'
		});
		expect(snapshot.openBlockers.length).toBeGreaterThan(0);
	});
});
