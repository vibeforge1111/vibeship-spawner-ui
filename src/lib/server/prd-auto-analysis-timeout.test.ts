import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recoverOverduePrdAutoAnalysisFromPending } from './prd-auto-analysis-timeout';

let stateDir = '';
const originalStateDir = process.env.SPAWNER_STATE_DIR;

async function writeJson(fileName: string, value: unknown): Promise<void> {
	const filePath = path.join(stateDir, fileName);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

describe('PRD auto-analysis timeout recovery', () => {
	beforeEach(async () => {
		stateDir = await mkdtemp(path.join(tmpdir(), 'prd-auto-timeout-'));
		process.env.SPAWNER_STATE_DIR = stateDir;
	});

	afterEach(async () => {
		if (originalStateDir === undefined) delete process.env.SPAWNER_STATE_DIR;
		else process.env.SPAWNER_STATE_DIR = originalStateDir;
		if (stateDir && existsSync(stateDir)) {
			await rm(stateDir, { recursive: true, force: true });
		}
	});

	it('marks overdue running PRD analysis as timeout from persisted pending state', async () => {
		const requestId = 'tg-build-timeout-recovery-1780942458715';
		const missionId = 'mission-1780942458715';
		const deadlineAt = '2026-06-08T18:21:22.593Z';
		await writeJson('pending-request.json', {
			requestId,
			missionId,
			projectName: 'Installer Evidence Snapshot Board',
			buildMode: 'direct',
			buildLane: 'fast_direct',
			tier: 'pro',
			traceRef: 'trace:spawner-prd:mission-1780942458715',
			status: 'pending',
			autoAnalysis: {
				provider: 'codex',
				status: 'running',
				startedAt: '2026-06-08T18:14:22.593Z',
				timeoutMs: 420_000,
				deadlineAt
			}
		});

		const recovery = await recoverOverduePrdAutoAnalysisFromPending({
			stateDir,
			nowMs: Date.parse('2026-06-08T18:22:23.000Z'),
			recoverySource: 'test_recovery'
		});

		expect(recovery).toMatchObject({
			recovered: true,
			reason: 'recovered_timeout',
			requestId,
			missionId,
			deadlineAt
		});

		const pending = JSON.parse(await readFile(path.join(stateDir, 'pending-request.json'), 'utf-8'));
		expect(pending).toMatchObject({
			requestId,
			status: 'timeout',
			reason: 'No canonical runtime analysis result written before timeout; recovered from persisted pending state.',
			autoAnalysis: {
				status: 'timeout',
				canonicalResultAvailable: false,
				provisionalDraftAvailable: false,
				recoveredBy: 'test_recovery'
			}
		});

		const traceRows = (await readFile(path.join(stateDir, 'prd-auto-trace.jsonl'), 'utf-8'))
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		expect(traceRows.at(-1)).toMatchObject({
			requestId,
			event: 'watchdog_timeout',
			recovered: true,
			recoverySource: 'test_recovery',
			projectName: 'Installer Evidence Snapshot Board'
		});

		const missionControl = JSON.parse(await readFile(path.join(stateDir, 'mission-control.json'), 'utf-8'));
		const missionEvents = missionControl.recent.filter((entry: { missionId?: string }) => entry.missionId === missionId);
		expect(missionEvents.map((entry: { eventType: string }) => entry.eventType)).toContain('task_failed');
		expect(missionEvents.map((entry: { eventType: string }) => entry.eventType)).toContain('mission_failed');
	});

	it('leaves non-overdue running PRD analysis untouched', async () => {
		const requestId = 'tg-build-timeout-recovery-fresh';
		await writeJson('pending-request.json', {
			requestId,
			status: 'pending',
			autoAnalysis: {
				status: 'running',
				deadlineAt: '2026-06-08T18:21:22.593Z'
			}
		});

		const recovery = await recoverOverduePrdAutoAnalysisFromPending({
			stateDir,
			nowMs: Date.parse('2026-06-08T18:20:00.000Z')
		});

		expect(recovery).toMatchObject({
			recovered: false,
			reason: 'not_overdue',
			requestId
		});
		const pending = JSON.parse(await readFile(path.join(stateDir, 'pending-request.json'), 'utf-8'));
		expect(pending.status).toBe('pending');
		expect(pending.autoAnalysis.status).toBe('running');
	});

	it('keeps a provisional draft advisory during the extra canonical grace window', async () => {
		const requestId = 'tg-build-timeout-recovery-provisional-grace';
		await writeJson('pending-request.json', {
			requestId,
			status: 'provisional',
			autoAnalysis: {
				status: 'running',
				startedAt: '2026-06-08T18:00:00.000Z',
				timeoutMs: 420_000,
				deadlineAt: '2026-06-08T18:07:00.000Z'
			}
		});
		await writeJson(`provisional-results/${requestId}.json`, {
			metadata: {
				provisional: true,
				resultAuthority: 'provisional_canvas_draft'
			}
		});

		const recovery = await recoverOverduePrdAutoAnalysisFromPending({
			stateDir,
			nowMs: Date.parse('2026-06-08T18:08:00.000Z')
		});

		expect(recovery).toMatchObject({
			recovered: false,
			reason: 'provisional_grace_active',
			requestId
		});
		const pending = JSON.parse(await readFile(path.join(stateDir, 'pending-request.json'), 'utf-8'));
		expect(pending.status).toBe('provisional');
		expect(pending.autoAnalysis.status).toBe('running');
	});

	it('marks a long-stale provisional request as canonical timeout without promoting the draft', async () => {
		const requestId = 'tg-build-timeout-recovery-provisional-stale';
		const missionId = 'mission-provisional-stale';
		await writeJson('pending-request.json', {
			requestId,
			missionId,
			projectName: 'Long Stale Provisional Board',
			buildMode: 'direct',
			buildLane: 'fast_direct',
			traceRef: 'trace:spawner-prd:mission-provisional-stale',
			status: 'provisional',
			autoAnalysis: {
				status: 'running',
				startedAt: '2026-06-08T18:00:00.000Z',
				timeoutMs: 420_000,
				deadlineAt: '2026-06-08T18:07:00.000Z'
			}
		});
		await writeJson(`provisional-results/${requestId}.json`, {
			metadata: {
				provisional: true,
				resultAuthority: 'provisional_canvas_draft'
			}
		});

		const recovery = await recoverOverduePrdAutoAnalysisFromPending({
			stateDir,
			nowMs: Date.parse('2026-06-08T18:15:00.000Z'),
			recoverySource: 'test_provisional_recovery'
		});

		expect(recovery).toMatchObject({
			recovered: true,
			reason: 'recovered_timeout',
			requestId,
			missionId
		});

		const pending = JSON.parse(await readFile(path.join(stateDir, 'pending-request.json'), 'utf-8'));
		expect(pending).toMatchObject({
			status: 'timeout',
			autoAnalysis: {
				status: 'timeout',
				canonicalResultAvailable: false,
				provisionalDraftAvailable: true,
				recoveredBy: 'test_provisional_recovery'
			}
		});

		const traceRows = (await readFile(path.join(stateDir, 'prd-auto-trace.jsonl'), 'utf-8'))
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		expect(traceRows.at(-1)).toMatchObject({
			requestId,
			event: 'watchdog_timeout',
			recovered: true,
			recoverySource: 'test_provisional_recovery',
			provisionalDraftAvailable: true
		});

		const missionControl = JSON.parse(await readFile(path.join(stateDir, 'mission-control.json'), 'utf-8'));
		const missionEvents = missionControl.recent.filter((entry: { missionId?: string }) => entry.missionId === missionId);
		expect(missionEvents.map((entry: { eventType: string }) => entry.eventType)).toContain('task_failed');
		expect(missionEvents.map((entry: { eventType: string }) => entry.eventType)).toContain('mission_failed');
	});
});
