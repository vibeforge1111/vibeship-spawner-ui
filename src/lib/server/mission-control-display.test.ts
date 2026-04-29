import { describe, expect, it } from 'vitest';
import {
	compactMissionControlDisplayText,
	sanitizeMissionControlDisplayText
} from './mission-control-display';

describe('mission-control-display', () => {
	it('redacts local paths from markdown links, backticks, Windows paths, and home paths', () => {
		const text = [
			'Created [index.html](C:/Users/USER/Desktop/demo/index.html)',
			'Opened `C:\\Users\\USER\\Desktop\\demo\\app.js`',
			'Checked /Users/leventcem/.spark/workspaces/default/result.md',
			'Stored /home/spark/.spark/state/mission.json',
			'Ran file:///C:/Users/USER/Desktop/demo/README.md'
		].join('\n');

		const sanitized = sanitizeMissionControlDisplayText(text);

		expect(sanitized).toContain('[index.html]([local path])');
		expect(sanitized).toContain('`[local path]`');
		expect(sanitized).toContain('Checked [local path]');
		expect(sanitized).toContain('Stored [local path]');
		expect(sanitized).toContain('Ran [local path]');
		expect(sanitized).not.toContain('C:/Users/USER');
		expect(sanitized).not.toContain('C:\\Users\\USER');
		expect(sanitized).not.toContain('/Users/leventcem');
		expect(sanitized).not.toContain('/home/spark');
	});

	it('compacts multi-line provider text without losing the useful summary', () => {
		const compact = compactMissionControlDisplayText(`
			Built and verified Spark Route Probe.

			Created files:
			- index.html
			- styles.css

			Verification passed.
		`);

		expect(compact).toBe(
			'Built and verified Spark Route Probe. Created files: - index.html - styles.css Verification passed.'
		);
	});

	it('returns null for blank values after trimming noise', () => {
		expect(compactMissionControlDisplayText(null)).toBeNull();
		expect(compactMissionControlDisplayText(undefined)).toBeNull();
		expect(compactMissionControlDisplayText('\n \r\n')).toBeNull();
	});

	it('truncates compact text at the requested boundary', () => {
		const compact = compactMissionControlDisplayText('Spark '.repeat(20), 25);

		expect(compact).toHaveLength(25);
		expect(compact?.endsWith('...')).toBe(true);
	});
});
