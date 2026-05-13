import { describe, expect, it } from 'vitest';
import { extractExplicitProjectPath } from './project-path-extraction';

describe('project path extraction', () => {
	it('does not treat game win/lose wording as an absolute path', () => {
		const text = [
			'Build a browser game.',
			'- Keyboard controls, restart, win/lose state, score or progress feedback.',
			'- Use localStorage for best score.'
		].join('\n');

		expect(extractExplicitProjectPath(text)).toBeNull();
	});

	it('does not treat GitHub URL slugs as project paths', () => {
		const text = 'Take art inspiration from https://github.com/akiraxtwo/sakura-musou-vercel.';

		expect(extractExplicitProjectPath(text)).toBeNull();
	});

	it('keeps explicit Windows and workspace-root POSIX paths', () => {
		expect(extractExplicitProjectPath('Build this in C:\\Users\\USER\\.spark\\workspaces\\demo.')).toBe(
			'C:\\Users\\USER\\.spark\\workspaces\\demo'
		);
		expect(extractExplicitProjectPath('Build this in /data/workspaces/demo.')).toBe('/data/workspaces/demo');
	});
});
