import { describe, expect, it } from 'vitest';
import {
	executeMissionControlAction,
	parseDiscordMissionControlCommand
} from './mission-control-command';

describe('mission-control-command parser', () => {
	it('parses standard mission command', () => {
		const parsed = parseDiscordMissionControlCommand('mission status mission-123');
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.action).toBe('status');
			expect(parsed.missionId).toBe('mission-123');
		}
	});

	it('parses slash command form', () => {
		const parsed = parseDiscordMissionControlCommand('/mission pause abc');
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.action).toBe('pause');
			expect(parsed.missionId).toBe('abc');
		}
	});

	it('returns help when mission id is missing', () => {
		const parsed = parseDiscordMissionControlCommand('mission kill');
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.help).toContain('mission <status|pause|resume|kill> <missionId>');
		}
	});

	it('does not invent status for an unknown mission id', async () => {
		const result = await executeMissionControlAction({
			action: 'status',
			missionId: 'spark-definitely-not-real-status',
			source: 'test'
		});

		expect(result.ok).toBe(false);
		expect(result.error).toContain('not found');
	});

	it('does not pause an unknown mission id', async () => {
		const result = await executeMissionControlAction({
			action: 'pause',
			missionId: 'spark-definitely-not-real-pause',
			source: 'test'
		});

		expect(result.ok).toBe(false);
		expect(result.error).toContain('not found');
	});
});
