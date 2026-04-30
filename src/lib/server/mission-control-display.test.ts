import { describe, expect, it } from 'vitest';
import {
	compactProviderHandoffText,
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

	it('compacts provider handoffs without local links or noisy file bullets', () => {
		const compact = compactProviderHandoffText(`
			OpenAI Codex says:

			Done. Built the direct static app in \`C:\\Users\\USER\\Desktop\\spark-orbit-forge\`.

			Created exactly the requested files:
			- [index.html](C:/Users/USER/Desktop/spark-orbit-forge/index.html)
			- [styles.css](C:/Users/USER/Desktop/spark-orbit-forge/styles.css)
			- [app.js](C:/Users/USER/Desktop/spark-orbit-forge/app.js)
			- [README.md](C:/Users/USER/Desktop/spark-orbit-forge/README.md)

			What shipped:
			- Full-viewport Three.js orbital forge from CDN, no bundler.
			- Compact dark mission-control overlay.

			Verification passed:
			- node --check app.js
			- Headless Chrome desktop/mobile visual checks passed.

			Mission: mission-1777464236780
		`);

		expect(compact).toContain('Built the direct static app');
		expect(compact).toContain('Full-viewport Three.js orbital forge');
		expect(compact).toContain('Verification passed');
		expect(compact).not.toContain('OpenAI Codex says');
		expect(compact).not.toContain('C:/Users/USER');
		expect(compact).not.toContain('C:\\Users\\USER');
		expect(compact).not.toContain('[index.html]');
		expect(compact).not.toContain('Mission: mission-');
	});
});
