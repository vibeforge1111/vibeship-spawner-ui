/**
 * Trust-boundary tests for getMissionControlBoard — stale bucket routing.
 *
 * Boundary: relay state (accumulated via relayMissionControlEvent)
 *   → getMissionControlBoard (builds board from relayState.recent)
 *   → stale non-terminal missions routed to board.stale, not dropped
 *
 * Before fix: isStaleNonTerminalStatus guard called `continue`, silently
 *             dropping missions quiet for >24h — no stale indicator shown.
 * After fix:  stale missions routed to board.stale bucket and remain visible.
 *
 * Tests cover: valid relay data (stale/fresh routing), malformed data, missing
 * result fields, bounded board keys, no auth/relay token exposure.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';

const testState = vi.hoisted(() => {
	const originalSpawnerStateDir = process.env.SPAWNER_STATE_DIR;
	const tempRoot = process.env.TMPDIR || process.env.TEMP || process.env.TMP || process.cwd();
	const spawnerStateDir = `${tempRoot}/spawner-ui-board-stale-test-${process.pid}-${Date.now()}`;
	process.env.SPAWNER_STATE_DIR = spawnerStateDir;
	return { originalSpawnerStateDir, spawnerStateDir };
});

import { getMissionControlBoard, relayMissionControlEvent } from './mission-control-relay';

const STALE_MS = 25 * 60 * 60 * 1000; // 25h — past the 24h STALE_NON_TERMINAL_MS threshold

function staleIso(): string {
	return new Date(Date.now() - STALE_MS).toISOString();
}

function freshIso(): string {
	return new Date().toISOString();
}

describe('getMissionControlBoard — stale bucket routing', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	afterAll(() => {
		if (testState.originalSpawnerStateDir === undefined) {
			delete process.env.SPAWNER_STATE_DIR;
		} else {
			process.env.SPAWNER_STATE_DIR = testState.originalSpawnerStateDir;
		}
		rmSync(testState.spawnerStateDir, { recursive: true, force: true });
	});

	// ---------------------------------------------------------------------------
	// Valid relay data — stale routing
	// ---------------------------------------------------------------------------

	it('stale running mission routes to board.stale, not board.running', async () => {
		const missionId = `mission-stale-running-${Date.now()}`;
		await relayMissionControlEvent({
			type: 'mission_started',
			missionId,
			missionName: 'Stale Pipeline Run',
			source: 'test',
			timestamp: staleIso(),
			data: { telegramRelay: { port: 1 } }
		});

		const board = getMissionControlBoard();
		expect(board.stale.some((e) => e.missionId === missionId)).toBe(true);
		expect(board.running.some((e) => e.missionId === missionId)).toBe(false);
	});

	it('fresh running mission routes to board.running, not board.stale', async () => {
		const missionId = `mission-fresh-running-${Date.now()}`;
		await relayMissionControlEvent({
			type: 'mission_started',
			missionId,
			missionName: 'Active Pipeline Run',
			source: 'test',
			timestamp: freshIso(),
			data: { telegramRelay: { port: 1 } }
		});

		const board = getMissionControlBoard();
		expect(board.running.some((e) => e.missionId === missionId)).toBe(true);
		expect(board.stale.some((e) => e.missionId === missionId)).toBe(false);
	});

	it('terminal missions are never routed to stale even when old', async () => {
		const missionId = `mission-old-completed-${Date.now()}`;
		await relayMissionControlEvent({
			type: 'mission_completed',
			missionId,
			missionName: 'Completed Long Ago',
			source: 'test',
			timestamp: staleIso(),
			data: { telegramRelay: { port: 1 } }
		});

		const board = getMissionControlBoard();
		expect(board.stale.some((e) => e.missionId === missionId)).toBe(false);
		expect(board.completed.some((e) => e.missionId === missionId)).toBe(true);
	});

	// ---------------------------------------------------------------------------
	// Malformed relay data — safe handling
	// ---------------------------------------------------------------------------

	it('event with no timestamp (defaults to now) does not crash getMissionControlBoard', async () => {
		const missionId = `mission-no-ts-${Date.now()}`;
		await relayMissionControlEvent({
			type: 'mission_started',
			missionId,
			missionName: 'No Timestamp Mission',
			source: 'test',
			data: { telegramRelay: { port: 1 } }
			// no timestamp — relay defaults to Date.now() → fresh
		});

		expect(() => getMissionControlBoard()).not.toThrow();
		const board = getMissionControlBoard();
		// should land in running (fresh default timestamp)
		expect(board.running.some((e) => e.missionId === missionId)).toBe(true);
	});

	it('event with no missionName or result data does not crash board construction', async () => {
		const missionId = `mission-minimal-${Date.now()}`;
		await relayMissionControlEvent({
			type: 'mission_created',
			missionId,
			source: 'test',
			timestamp: staleIso()
			// no missionName, no data, no taskName
		});

		expect(() => getMissionControlBoard()).not.toThrow();
		const board = getMissionControlBoard();
		const entry = Object.values(board).flat().find((e) => e.missionId === missionId);
		expect(entry).toBeDefined();
		expect(entry?.missionId).toBe(missionId);
	});

	// ---------------------------------------------------------------------------
	// Bounded output — relay authority not widened
	// ---------------------------------------------------------------------------

	it('board output keys are bounded to the defined MissionControlBoardStatus set', () => {
		const board = getMissionControlBoard();
		const defined = new Set(['running', 'paused', 'completed', 'failed', 'cancelled', 'created', 'stale']);
		for (const key of Object.keys(board)) {
			expect(defined.has(key)).toBe(true);
		}
	});

	it('stale board entry does not expose raw auth tokens or internal relay keys', async () => {
		const missionId = `mission-auth-boundary-${Date.now()}`;
		await relayMissionControlEvent({
			type: 'mission_started',
			missionId,
			missionName: 'Auth Boundary Check',
			source: 'test',
			timestamp: staleIso(),
			data: { telegramRelay: { port: 1 } }
		});

		const board = getMissionControlBoard();
		const entry = board.stale.find((e) => e.missionId === missionId);
		expect(entry).toBeDefined();

		const keys = Object.keys(entry!);
		expect(keys).not.toContain('secret');
		expect(keys).not.toContain('token');
		expect(keys).not.toContain('apiKey');
		expect(keys).not.toContain('bearerToken');
	});
});
