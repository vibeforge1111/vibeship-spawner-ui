import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCodexCliCommand, writeProviderPromptReference } from './codex-cli-client';

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

	it('persists provider prompt metadata without raw prompt content by default', () => {
		const stateDir = mkdtempSync(join(tmpdir(), 'spawner-codex-prompt-'));
		const previousStateDir = process.env.SPAWNER_STATE_DIR;
		process.env.SPAWNER_STATE_DIR = stateDir;
		try {
			const metadata = writeProviderPromptReference({
				missionId: 'mission-prompt-redaction',
				providerId: 'codex',
				prompt: 'SECRET_PROVIDER_PROMPT_BODY'
			});
			const metadataPath = join(
				stateDir,
				'prompt-metadata',
				'mission-prompt-redaction-codex.json'
			);
			const metadataRaw = readFileSync(metadataPath, 'utf-8');

			expect(metadata).toMatchObject({
				promptPresent: true,
				promptLength: 'SECRET_PROVIDER_PROMPT_BODY'.length,
				rawPromptStored: false,
				rawPromptPath: null
			});
			expect(metadataRaw).not.toContain('SECRET_PROVIDER_PROMPT_BODY');
			expect(existsSync(join(stateDir, 'prompts'))).toBe(false);
			expect(existsSync(join(stateDir, 'prompts-private'))).toBe(false);
		} finally {
			if (previousStateDir === undefined) {
				delete process.env.SPAWNER_STATE_DIR;
			} else {
				process.env.SPAWNER_STATE_DIR = previousStateDir;
			}
			rmSync(stateDir, { recursive: true, force: true });
		}
	});
});
