import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';

const testState = vi.hoisted(() => {
	const originalSpawnerStateDir = process.env.SPAWNER_STATE_DIR;
	const tempRoot = process.env.TMPDIR || process.env.TEMP || process.env.TMP || process.cwd();
	const spawnerStateDir = `${tempRoot}/spawner-ui-mission-control-board-eligible-test-${process.pid}-${Date.now()}`;
	process.env.SPAWNER_STATE_DIR = spawnerStateDir;
	return { originalSpawnerStateDir, spawnerStateDir };
});

import {
	getMissionControlBoard,
	getMissionControlRelaySnapshot,
	isMissionControlMissionId,
	relayMissionControlEvent
} from './mission-control-relay';

describe('mission-control board eligibility', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
	});

	afterAll(() => {
		if (testState.originalSpawnerStateDir === undefined) {
			delete process.env.SPAWNER_STATE_DIR;
		} else {
			process.env.SPAWNER_STATE_DIR = testState.originalSpawnerStateDir;
		}
		rmSync(testState.spawnerStateDir, { recursive: true, force: true });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('accepts spark- and mission- prefixed ids for board persistence', () => {
		expect(isMissionControlMissionId('spark-alpha_1')).toBe(true);
		expect(isMissionControlMissionId('mission-board-eligible')).toBe(true);
		expect(isMissionControlMissionId('  mission-trimmed  ')).toBe(true);
	});

	it('rejects ids that do not match the Mission Control board pattern', () => {
		expect(isMissionControlMissionId('not-spark-id')).toBe(false);
		expect(isMissionControlMissionId('creator-mission-1')).toBe(false);
		expect(isMissionControlMissionId('')).toBe(false);
		expect(isMissionControlMissionId(null)).toBe(false);
	});

	it('warns with structured metadata when a mission-scoped event is not board eligible', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await relayMissionControlEvent({
			type: 'mission_started',
			missionId: 'bad-mission-id',
			source: 'telegram',
			data: { telegramRelay: { port: 1 } }
		});

		expect(warnSpy).toHaveBeenCalledWith(
			'[MissionControlRelay] Mission event omitted from Kanban persistence',
			expect.objectContaining({
				reason: 'mission_id_not_board_eligible',
				eventType: 'mission_started',
				missionId: 'bad-mission-id'
			})
		);
		expect(getMissionControlRelaySnapshot('bad-mission-id').recent).toEqual([]);
		expect(getMissionControlBoard().running.find((entry) => entry.missionId === 'bad-mission-id')).toBeUndefined();

		warnSpy.mockRestore();
	});

	it('does not warn when the event has no missionId', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await relayMissionControlEvent({
			type: 'progress',
			source: 'codex',
			message: 'Working without a mission scope'
		});

		expect(warnSpy).not.toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it('persists eligible mission ids on the board without a drop warning', async () => {
		const missionId = `mission-board-eligible-${Date.now()}`;
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await relayMissionControlEvent({
			type: 'mission_started',
			missionId,
			source: 'codex',
			data: { telegramRelay: { port: 1 } }
		});

		expect(warnSpy).not.toHaveBeenCalled();
		expect(getMissionControlRelaySnapshot(missionId).recent.length).toBeGreaterThanOrEqual(1);
		expect(getMissionControlBoard().running.find((entry) => entry.missionId === missionId)).toBeDefined();

		warnSpy.mockRestore();
	});
});
