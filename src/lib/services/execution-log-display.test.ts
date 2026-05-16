import { describe, expect, it } from 'vitest';
import {
	filterExecutionLogsForDisplay,
	formatExecutionLogForDisplay,
	humanizeTaskId,
	normalizeExecutionLogMessage
} from './execution-log-display';

describe('execution-log-display', () => {
	it('humanizes task ids', () => {
		expect(humanizeTaskId('node-2-task-design-the-core-play-and-reasoning-loop')).toBe(
			'Design the Core Play and Reasoning Loop'
		);
	});

	it('normalizes skill source loader events', () => {
		expect(
			normalizeExecutionLogMessage(
				'SKILL_SOURCE:node-1-task-create-the-playable-game-shell:loaded:frontend-engineer,game-development,game-ui-design,responsive-mobile-first'
			)
		).toBe('Create the Playable Game Shell: Skills loaded: frontend-engineer, game-development, game-ui-design +1 more.');
		expect(
			normalizeExecutionLogMessage(
				'SKILL_SOURCE:node-1-task-create-the-playable-game-shell:unavailable:frontend-engineer game-development(curl: (3) URL rejected: Malformed input to a URL function)'
			)
		).toBe('Create the Playable Game Shell: using built-in task context.');
	});

	it('normalizes read-only workspace fallback messages', () => {
		expect(
			normalizeExecutionLogMessage(
				'Absolute /fail/restart is unavailable on this host because / is read-only; building the requested static target at workspace fail/restart.'
			)
		).toBe('Using workspace subfolder fail/restart; the requested root path was read-only.');
	});

	it('normalizes no-response provider completion copy', () => {
		expect(normalizeExecutionLogMessage('Codex: completed without a text response')).toBe(
			'Provider completed; no additional summary was returned.'
		);
	});

	it('assigns display tones and labels', () => {
		expect(formatExecutionLogForDisplay({ type: 'start', message: 'Mission started.' })).toMatchObject({
			tone: 'start',
			label: 'Running'
		});
		expect(formatExecutionLogForDisplay({ type: 'complete', message: 'Mission completed.' })).toMatchObject({
			tone: 'success',
			label: 'Done'
		});
		expect(formatExecutionLogForDisplay({ type: 'error', message: 'Provider failed.' })).toMatchObject({
			tone: 'error',
			label: 'Needs attention'
		});
	});

	it('hides generic task completion when mission completion is already present', () => {
		const logs = [
			{ type: 'complete' as const, message: 'Verify the playable loop is done.' },
			{ type: 'complete' as const, message: 'Mission completed.' },
			{ type: 'complete' as const, message: 'Task completed.' }
		];

		expect(filterExecutionLogsForDisplay(logs).map((log) => log.message)).toEqual([
			'Verify the playable loop is done.',
			'Mission completed.'
		]);
	});

	it('keeps generic task completion before the mission is terminal', () => {
		const logs = [{ type: 'complete' as const, message: 'Task completed.' }];
		expect(filterExecutionLogsForDisplay(logs)).toEqual(logs);
	});

	it('collapses low-signal running rows after a mission is complete', () => {
		const logs = [
			{ type: 'progress' as const, message: 'Telegram Golden Path Probe entered To do.' },
			{ type: 'start' as const, message: 'Dispatch started.' },
			{ type: 'start' as const, message: 'Execute goal is running.' },
			{ type: 'progress' as const, message: 'OpenAI Codex is still working through Execute goal.' },
			{ type: 'start' as const, message: 'Mission started.' },
			{ type: 'complete' as const, message: 'Mission completed.' }
		];

		expect(filterExecutionLogsForDisplay(logs).map((log) => log.message)).toEqual([
			'Telegram Golden Path Probe entered To do.',
			'Mission completed.'
		]);
	});
});
