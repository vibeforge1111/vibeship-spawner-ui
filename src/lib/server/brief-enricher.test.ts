import { describe, expect, it } from 'vitest';
import { buildClaudePrintSpawnCommand, buildDeterministicEnrichment } from './brief-enricher';

describe('brief-enricher', () => {
	it('builds a deterministic enrichment for vague project briefs', () => {
		const result = buildDeterministicEnrichment('build me a useful dashboard');

		expect(result.wasEnriched).toBe(true);
		expect(result.enrichedContent).toContain('# Inferred Project Brief');
		expect(result.enrichedContent).toContain('Original user request: build me a useful dashboard');
		expect(result.addedAssumptions).toContain(
			'Assume this is a web app unless the user specifies mobile, desktop, or another surface.'
		);
		expect(result.openQuestions).toContain('What is the one action the app must make easy?');
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
