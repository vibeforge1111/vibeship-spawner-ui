import { describe, expect, it } from 'vitest';
import { projectStoredPrdAnalysisResult } from './prd-analysis-result-schema';

describe('PRD analysis result storage projection', () => {
	it('omits raw execution prompt text from stored result artifacts', () => {
		const stored = projectStoredPrdAnalysisResult('request-1', {
			requestId: 'request-1',
			success: true,
			projectName: 'Proof Project',
			tasks: [{ id: 'task-1', title: 'Build proof page' }],
			skills: [],
			executionPrompt: 'Raw execution instructions must not be stored.',
			metadata: {
				executionPrompt: 'Nested raw instructions must not be stored either.',
				kept: true
			}
		});

		expect(stored).toMatchObject({
			requestId: 'request-1',
			success: true,
			projectName: 'Proof Project',
			instructionTextRedacted: true,
			metadata: {
				kept: true,
				instructionTextRedacted: true,
				instructionTextStorage: 'omitted_from_result_artifact'
			}
		});
		expect(JSON.stringify(stored)).not.toContain('executionPrompt');
		expect(JSON.stringify(stored)).not.toContain('Raw execution instructions');
		expect(JSON.stringify(stored)).not.toContain('Nested raw instructions');
	});

	it('accepts privacy-redacted provider results without storing instruction text', () => {
		const stored = projectStoredPrdAnalysisResult('request-2', {
			requestId: 'request-2',
			success: true,
			projectName: 'Runtime Proof',
			complexity: 'medium',
			tasks: [
				{
					id: 'task-1',
					title: 'Build proof files',
					targets: ['index.html', 'README.md']
				}
			],
			skills: []
		});

		expect(stored).toMatchObject({
			requestId: 'request-2',
			success: true,
			projectName: 'Runtime Proof',
			complexity: 'moderate',
			tasks: [
				expect.objectContaining({
					id: 'task-1',
					title: 'Build proof files',
					targets: ['index.html', 'README.md']
				})
			],
			instructionTextRedacted: true
		});
		expect(JSON.stringify(stored)).not.toContain('executionPrompt');
	});
});
