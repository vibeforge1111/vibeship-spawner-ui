import { describe, expect, it } from 'vitest';
import { buildClaudePrintSpawnCommand, buildDeterministicEnrichment, isSparseUnderstandingClarification } from './brief-enricher';

describe('brief-enricher', () => {
	it('builds a deterministic enrichment for vague project briefs', () => {
		const result = buildDeterministicEnrichment('build me a useful dashboard');

		expect(result.wasEnriched).toBe(true);
		expect(result.enrichedContent).toContain('# Inferred Project Brief');
		expect(result.enrichedContent).toContain('Original user request: build me a useful dashboard');
		expect(result.addedAssumptions).toContain('Assume this is a responsive web dashboard unless another surface is specified.');
		expect(result.openQuestions).toContain('What is the main decision this dashboard should help you make?');
	});

	it('asks project-specific questions for vague game briefs', () => {
		const result = buildDeterministicEnrichment("let's build a maze game");

		expect(result.wasEnriched).toBe(true);
		expect(result.enrichedContent).toContain('Build a small, playable browser game');
		expect(result.addedAssumptions).toContain('Assume no accounts or backend in v1; keep state local to the browser.');
		expect(result.openQuestions).toContain(
			'What should make this game feel surprising: shifting walls, power-ups, enemies, time pressure, or something stranger?'
		);
		expect(result.openQuestions.join('\n')).not.toContain('Does it need accounts/login in v1?');
	});

	it('preserves sparse understanding checks instead of inventing product scope', () => {
		const result = buildDeterministicEnrichment('did you understand what i said');

		expect(isSparseUnderstandingClarification('did you understand what i said?')).toBe(true);
		expect(result.wasEnriched).toBe(false);
		expect(result.enrichedContent).toBe('did you understand what i said');
		expect(result.addedAssumptions).toEqual([]);
		expect(result.openQuestions).toContain('What concrete workflow should Spark build or change?');
	});

	it('uses a direct Claude executable on Windows when one exists beside the cmd shim', () => {
		const command = buildClaudePrintSpawnCommand('C:\\Tools\\claude.exe', 'win32');

		expect(command).toEqual({
			command: 'C:\\Tools\\claude.exe',
			args: ['--print'],
			shell: false
		});
	});

	it('wraps Windows cmd shims without enabling shell interpolation', () => {
		const command = buildClaudePrintSpawnCommand('C:\\Tools\\claude.cmd', 'win32');

		expect(command.command.toLowerCase()).toContain('cmd');
		expect(command.args).toEqual(['/d', '/c', '"C:\\Tools\\claude.cmd" --print']);
		expect(command.shell).toBe(false);
		expect(command.windowsVerbatimArguments).toBe(true);
	});
});
