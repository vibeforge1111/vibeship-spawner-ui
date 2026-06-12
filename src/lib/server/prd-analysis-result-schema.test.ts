import { describe, expect, it } from 'vitest';
import {
	projectStoredPrdAnalysisResult,
	projectStoredPrdAnalysisResultForTier,
	sanitizePrdAnalysisResultForTier
} from './prd-analysis-result-schema';

describe('PRD analysis result storage projection', () => {
	it('omits raw execution prompt text from stored result artifacts', () => {
		const stored = projectStoredPrdAnalysisResult('request-1', {
			requestId: 'request-1',
			success: true,
			projectName: 'Proof Project',
			tasks: [{ id: 'task-1', title: 'Build proof page' }],
			skills: [],
			executionPrompt: 'Raw execution instructions must not be stored.',
			executionAuthority: { schema_version: 'governor-decision-v1' },
			execution_authority: { schema_version: 'governor-decision-v1' },
			governorDecision: { schema_version: 'governor-decision-v1' },
			governor_decision: { schema_version: 'governor-decision-v1' },
			metadata: {
				executionPrompt: 'Nested raw instructions must not be stored either.',
				executionAuthority: { schema_version: 'governor-decision-v1' },
				nested: {
					governorDecision: { schema_version: 'governor-decision-v1' }
				},
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
				taskQuality: {
					passed: false,
					taskCount: 1,
					findings: expect.arrayContaining([
						expect.objectContaining({ code: 'missing_acceptance_criteria' }),
						expect.objectContaining({ code: 'missing_verification' })
					])
				},
				instructionTextRedacted: true,
				instructionTextStorage: 'omitted_from_result_artifact'
			}
		});
		expect(JSON.stringify(stored)).not.toContain('executionPrompt');
		expect(JSON.stringify(stored)).not.toContain('executionAuthority');
		expect(JSON.stringify(stored)).not.toContain('execution_authority');
		expect(JSON.stringify(stored)).not.toContain('governorDecision');
		expect(JSON.stringify(stored)).not.toContain('governor_decision');
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
		expect(stored.metadata?.taskQuality).toMatchObject({
			passed: false,
			taskCount: 1
		});
		expect(JSON.stringify(stored)).not.toContain('executionPrompt');
	});

	it('normalizes provider system complexity labels to moderate', () => {
		const stored = projectStoredPrdAnalysisResult('request-system-complexity', {
			requestId: 'request-system-complexity',
			success: true,
			projectName: 'System Complexity Proof',
			complexity: 'system',
			tasks: [
				{
					id: 'task-1',
					title: 'Build governed app path',
					acceptanceCriteria: ['Provider result is accepted.'],
					verificationCommands: ['npm test']
				}
			],
			skills: []
		});

		expect(stored.complexity).toBe('moderate');
	});

	it('normalizes provider tech stack arrays into stored objects', () => {
		const stored = projectStoredPrdAnalysisResult('request-tech-stack-array', {
			requestId: 'request-tech-stack-array',
			success: true,
			projectName: 'Tech Stack Array Proof',
			techStack: ['SvelteKit', 'TypeScript', 'CSS', 'Local development server'],
			tasks: [
				{
					id: 'task-1',
					title: 'Build governed app path',
					acceptanceCriteria: ['Provider result is accepted.'],
					verificationCommands: ['npm test']
				}
			],
			skills: []
		});

		expect(stored.techStack).toMatchObject({
			framework: 'SvelteKit',
			language: 'TypeScript',
			styling: 'CSS',
			deployment: 'Local development server'
		});
		expect((stored.techStack as Record<string, unknown>).entries).toEqual([
			'SvelteKit',
			'TypeScript',
			'CSS',
			'Local development server'
		]);
	});

	it('normalizes nested provider tech stack arrays into canonical string fields', () => {
		const stored = projectStoredPrdAnalysisResult('request-tech-stack-nested-array', {
			requestId: 'request-tech-stack-nested-array',
			success: true,
			projectName: 'Nested Tech Stack Array Proof',
			techStack: {
				framework: 'Existing project',
				language: ['TypeScript', 'JavaScript'],
				styling: ['scoped app CSS', 'responsive dashboard layout'],
				deployment: [{ name: 'local canvas' }, { technology: 'static preview' }]
			},
			tasks: [
				{
					id: 'task-1',
					title: 'Build governed app path',
					acceptanceCriteria: ['Provider result is accepted.'],
					verificationCommands: ['npm test']
				}
			],
			skills: []
		});

		expect(stored.techStack).toMatchObject({
			framework: 'Existing project',
			language: 'TypeScript, JavaScript',
			styling: 'scoped app CSS, responsive dashboard layout',
			deployment: 'local canvas, static preview'
		});
	});

	it('strips pro-only skill ids from base-tier PRD analysis results', async () => {
		const sanitized = await sanitizePrdAnalysisResultForTier('request-base', {
			requestId: 'request-base',
			success: true,
			projectName: 'Base Skill Gate',
			tasks: [
				{
					id: 'task-1',
					title: 'Build the surface',
					skills: ['frontend-engineer', 'threejs-3d-graphics', 'frontend-engineer']
				}
			],
			skills: ['frontend-engineer', 'qa-engineering', 'threejs-3d-graphics'],
			executionAuthority: { schema_version: 'governor-decision-v1' },
			metadata: {
				kept: true,
				executionAuthority: { schema_version: 'governor-decision-v1' }
			}
		}, 'base');

		expect(sanitized.result.tasks[0].skills).toEqual(['frontend-engineer']);
		expect(sanitized.result.skills).toEqual(['frontend-engineer']);
		expect(sanitized.summary.strippedSkillCount).toBeGreaterThanOrEqual(2);
		expect(sanitized.result.metadata).toMatchObject({
			kept: true,
			skillTier: 'base',
			skillGate: {
				applied: true,
				tier: 'base'
			}
		});
		expect(JSON.stringify(sanitized.result)).not.toContain('executionAuthority');
		expect(JSON.stringify(projectStoredPrdAnalysisResult('request-base', sanitized.result))).not.toContain('executionAuthority');
	});

	it('preserves pro skills for pro-tier PRD analysis results', async () => {
		const sanitized = await sanitizePrdAnalysisResultForTier('request-pro', {
			requestId: 'request-pro',
			success: true,
			projectName: 'Pro Skill Gate',
			tasks: [
				{
					id: 'task-1',
					title: 'Build the 3D surface',
					skills: ['frontend-engineer', 'threejs-3d-graphics']
				}
			],
			skills: ['frontend-engineer', 'threejs-3d-graphics']
		}, 'pro');

		expect(sanitized.result.tasks[0].skills).toEqual(['frontend-engineer', 'threejs-3d-graphics']);
		expect(sanitized.result.skills).toEqual(['frontend-engineer', 'threejs-3d-graphics']);
		expect(sanitized.summary.strippedSkillCount).toBe(0);
	});

	it('stores task quality metadata after tier skill filtering', async () => {
		const stored = await projectStoredPrdAnalysisResultForTier('request-quality', {
			requestId: 'request-quality',
			success: true,
			projectName: 'Quality Gate',
			tasks: [
				{
					id: 'task-1',
					title: 'Create the app shell and project structure',
					summary: 'Create the starter app shell.',
					skills: ['frontend-engineer', 'threejs-3d-graphics'],
					workspaceTargets: ['src/routes/quality-gate'],
					acceptanceCriteria: ['The first screen renders.'],
					verificationCommands: ['npm run build']
				}
			],
			skills: ['frontend-engineer', 'threejs-3d-graphics']
		}, 'base');

		const storedTasks = stored.tasks as Array<{ skills: string[] }>;
		expect(storedTasks[0].skills).toEqual(['frontend-engineer']);
		expect(stored.metadata).toMatchObject({
			skillTier: 'base',
			skillGate: {
				applied: true,
				tier: 'base',
				strippedSkillCount: expect.any(Number)
			},
			taskQuality: {
				passed: true,
				taskCount: 1,
				findings: expect.arrayContaining([
					expect.objectContaining({ code: 'vague_title', taskId: 'task-1' })
				])
			}
		});
	});
});
