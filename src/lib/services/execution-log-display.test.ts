import { describe, expect, it } from 'vitest';
import {
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
});
