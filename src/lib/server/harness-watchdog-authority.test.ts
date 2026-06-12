import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	buildServerGovernorDecisionAuthority,
	buildServerTurnIntentVNextAuthority
} from './harness-authority';
import { collectHarnessWatchdogAuthority } from './harness-watchdog-authority';

const checkedAt = '2026-06-07T21:45:00.000Z';
const requestId = 'tg-build-02c441099b20-1780867252235';
const missionId = 'mission-1780867252235';
const traceRef = 'trace:spawner-prd:mission-1780867252235';

let stateDir: string;

function dispatchAuthority() {
	return buildServerGovernorDecisionAuthority({
		source: 'watchdog-authority-test',
		reason: 'Operator requested dispatch from the PRD canvas.',
		toolName: 'spawner.dispatch',
		mutationClass: 'launches_mission',
		requestId,
		target: missionId
	});
}

function vnextAuthority() {
	return buildServerTurnIntentVNextAuthority({
		source: 'watchdog-authority-test',
		reason: 'Operator requested dispatch from the PRD canvas.',
		toolName: 'spawner.dispatch',
		mutationClass: 'launches_mission',
		requestId,
		target: missionId
	});
}

async function writeJson(relativePath: string, value: unknown) {
	const filePath = path.join(stateDir, relativePath);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

async function writeBaseState(extraPendingLoad: Record<string, unknown> = {}) {
	await writeJson('pending-request.json', {
		requestId,
		missionId,
		traceRef,
		relay: {
			requestId,
			missionId,
			traceRef,
			chatId: '8319079055',
			userId: '8319079055',
			goal: 'Do not leak this raw prompt body.'
		}
	});
	await writeJson('last-canvas-load.json', {
		requestId,
		missionId,
		traceRef,
		pipelineId: `prd-${requestId}`,
		source: 'prd-bridge',
		canvasLoadedAt: checkedAt
	});
	await writeJson('pending-load.json', {
		requestId,
		missionId,
		traceRef,
		timestamp: checkedAt,
		...extraPendingLoad
	});
}

describe('collectHarnessWatchdogAuthority', () => {
	beforeEach(async () => {
		stateDir = await mkdtemp(path.join(tmpdir(), 'harness-watchdog-authority-'));
		await mkdir(path.join(stateDir, 'results'), { recursive: true });
	});

	afterEach(async () => {
		await rm(stateDir, { recursive: true, force: true });
	});

	it('reports stored native Governor evidence as stale residue without leaking private state', async () => {
		await writeBaseState({ executionAuthority: dispatchAuthority() });

		const snapshot = await collectHarnessWatchdogAuthority({ stateDir, checkedAt });

		expect(snapshot.requestId).toBe(requestId);
		expect(snapshot.missionId).toBe(missionId);
		expect(snapshot.traceRef).toBe(traceRef);
		expect(snapshot.rows.find((row) => row.gate === 'governor')).toMatchObject({
			status: 'stale',
			severity: 'stale'
		});
		expect(snapshot.rows.find((row) => row.gate === 'capability')).toMatchObject({
			status: 'missing'
		});
		expect(snapshot.rows.find((row) => row.gate === 'owner')).toMatchObject({
			status: 'missing'
		});
		expect(snapshot.openBlockers.some((blocker) => blocker.summary.includes('Stored executionAuthority residue'))).toBe(true);
		const payload = JSON.stringify(snapshot);
		expect(payload).not.toContain('8319079055');
		expect(payload).not.toContain('Do not leak this raw prompt body');
	});

	it('reports high-agency execution blocked when Governor evidence is absent', async () => {
		await writeBaseState();

		const snapshot = await collectHarnessWatchdogAuthority({ stateDir, checkedAt });

		const governor = snapshot.rows.find((row) => row.gate === 'governor');
		expect(governor).toMatchObject({
			status: 'missing',
			severity: 'blocked'
		});
		expect(snapshot.openBlockers.map((blocker) => blocker.id)).toContain('blocker.authority.governor');
		expect(JSON.stringify(snapshot)).not.toContain('chatId');
		expect(JSON.stringify(snapshot)).not.toContain('userId');
	});

	it('demotes machine-origin policy evidence to a visible blocker', async () => {
		await writeBaseState({
			executionAuthority: {
				schema: 'spark.machine_origin_policy.v1',
				origin: 'test',
				source: 'watchdog-authority-test',
				reason: 'Legacy machine route attempted dispatch.'
			}
		});

		const snapshot = await collectHarnessWatchdogAuthority({ stateDir, checkedAt });

		expect(snapshot.rows.find((row) => row.gate === 'machine_policy')).toMatchObject({
			status: 'machine-policy-origin',
			severity: 'blocked'
		});
		expect(snapshot.openBlockers.some((blocker) => blocker.summary.includes('machine-origin'))).toBe(true);
	});

	it('surfaces stored bare VNext evidence as stale residue', async () => {
		const authority = vnextAuthority() as unknown as Record<string, unknown>;
		const freshness = authority.freshness as Record<string, unknown>;
		freshness.pending_state_used_as_authority = true;
		await writeBaseState({ executionAuthority: authority });

		const snapshot = await collectHarnessWatchdogAuthority({ stateDir, checkedAt });

		expect(snapshot.rows.find((row) => row.gate === 'governor')).toMatchObject({
			status: 'stale',
			severity: 'stale'
		});
		expect(snapshot.rows.find((row) => row.gate === 'freshness')).toMatchObject({
			status: 'missing',
			severity: 'blocked'
		});
		expect(snapshot.openBlockers.map((blocker) => blocker.status)).toContain('stale');
	});

	it('reports stored denied Governor outcomes as stale residue', async () => {
		const authority = dispatchAuthority() as unknown as Record<string, unknown>;
		authority.outcome = 'chat_only';
		await writeBaseState({ executionAuthority: authority });

		const snapshot = await collectHarnessWatchdogAuthority({ stateDir, checkedAt });

		expect(snapshot.rows.find((row) => row.gate === 'governor')).toMatchObject({
			status: 'stale',
			severity: 'stale'
		});
		expect(snapshot.openBlockers.some((blocker) => blocker.summary.includes('Stored executionAuthority residue'))).toBe(true);
	});
});
