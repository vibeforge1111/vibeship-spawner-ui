import { describe, expect, it } from 'vitest';
import { parseCodexCliCommand } from './codex-cli-client';

describe('parseCodexCliCommand', () => {
	it('adds skip-git-repo-check for model-based Codex exec commands', () => {
		expect(parseCodexCliCommand('codex exec --model gpt-5.5')).toEqual({
			binary: 'codex',
			args: ['exec', '--skip-git-repo-check', '--model', 'gpt-5.5']
		});
	});

	it('adds skip-git-repo-check for yolo Codex exec commands', () => {
		expect(parseCodexCliCommand('codex exec --yolo', { allowHighAgency: true })).toEqual({
			binary: 'codex',
			args: ['exec', '--skip-git-repo-check', '--yolo']
		});
	});
});
