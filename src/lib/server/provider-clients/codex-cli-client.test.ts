import { describe, expect, it } from 'vitest';
import { parseCodexCliCommand } from './codex-cli-client';

describe('parseCodexCliCommand', () => {
	it('adds skip-git-repo-check for model-based Codex exec commands', () => {
		expect(parseCodexCliCommand('codex exec --model gpt-5.5')).toEqual({
			binary: 'codex',
			args: ['exec', '--ignore-user-config', '--skip-git-repo-check', '--model', 'gpt-5.5']
		});
	});

	it('adds skip-git-repo-check for yolo Codex exec commands', () => {
		expect(parseCodexCliCommand('codex exec --yolo', { allowHighAgency: true })).toEqual({
			binary: 'codex',
			args: ['exec', '--ignore-user-config', '--skip-git-repo-check', '--yolo']
		});
	});

	it('accepts model-based high-agency Codex exec commands when allowed', () => {
		expect(parseCodexCliCommand('codex exec --model gpt-5.5 --dangerously-bypass-approvals-and-sandbox', { allowHighAgency: true })).toEqual({
			binary: 'codex',
			args: ['exec', '--ignore-user-config', '--skip-git-repo-check', '--model', 'gpt-5.5', '--dangerously-bypass-approvals-and-sandbox']
		});
	});

	it('accepts templates that already include ignore-user-config', () => {
		expect(parseCodexCliCommand('codex exec --ignore-user-config --model gpt-5.5')).toEqual({
			binary: 'codex',
			args: ['exec', '--ignore-user-config', '--skip-git-repo-check', '--model', 'gpt-5.5']
		});
	});
});
