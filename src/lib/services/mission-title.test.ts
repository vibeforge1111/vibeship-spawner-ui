import { describe, expect, it } from 'vitest';
import { polishMissionTitleForDisplay } from './mission-title';

describe('polishMissionTitleForDisplay', () => {
	it('title-cases lowercase mission names for display', () => {
		expect(polishMissionTitleForDisplay('maze game')).toBe('Maze Game');
		expect(polishMissionTitleForDisplay('tiny maze game')).toBe('Tiny Maze Game');
	});

	it('trims route wrapper and planning suffix noise', () => {
		expect(polishMissionTitleForDisplay('through Spawner Mission Control: spark paddle')).toBe('Spark Paddle');
		expect(polishMissionTitleForDisplay('tiny maze game plan and build')).toBe('Tiny Maze Game');
	});

	it('makes mission id fallbacks readable without showing slug casing', () => {
		expect(polishMissionTitleForDisplay('mission-command-orphan-pause')).toBe('Mission Command Orphan Pause');
	});

	it('preserves acronyms and useful existing capitalization', () => {
		expect(polishMissionTitleForDisplay('Spark Thread QA')).toBe('Spark Thread QA');
		expect(polishMissionTitleForDisplay('PRD link routing UI')).toBe('PRD Link Routing UI');
	});
});
