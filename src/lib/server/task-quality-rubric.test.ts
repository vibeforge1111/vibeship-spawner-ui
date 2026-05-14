import { describe, expect, it } from 'vitest';
import { assessTaskQuality, formatTaskQualityGuidance } from './task-quality-rubric';

describe('task-quality-rubric', () => {
	it('passes a concrete task plan with targets, skills, criteria, and checks', () => {
		const report = assessTaskQuality(
			[
				{
					id: 'task-static-shell',
					title: 'Create static app shell',
					summary: 'Create index, style, script, and readme files for the browser app.',
					skills: ['frontend-engineer', 'ui-design'],
					workspaceTargets: ['C:\\Users\\USER\\Desktop\\spark-clock'],
					acceptanceCriteria: ['The app loads directly from index.html.'],
					verificationCommands: ['Test-Path index.html']
				},
				{
					id: 'task-state',
					title: 'Implement countdown state and persistence',
					summary: 'Wire countdown updates, launch state, reset, and localStorage persistence.',
					skills: ['state-management', 'testing-strategies'],
					dependencies: ['task-static-shell'],
					workspaceTargets: ['app.js'],
					acceptanceCriteria: ['The countdown restores target time after refresh.'],
					verificationCommands: ['node --check app.js']
				}
			],
			{ suggestedTaskRange: [2, 4], verificationDepth: 'standard' }
		);

		expect(report.passed).toBe(true);
		expect(report.score).toBe(100);
		expect(report.findings).toEqual([]);
	});

	it('flags empty plans and missing task contracts', () => {
		const emptyReport = assessTaskQuality([]);

		expect(emptyReport.passed).toBe(false);
		expect(emptyReport.findings.map((finding) => finding.code)).toContain('empty_plan');

		const weakReport = assessTaskQuality([
			{
				id: 'task-1',
				title: 'Build app',
				summary: '',
				skills: [],
				dependencies: ['missing-task']
			}
		]);

		expect(weakReport.passed).toBe(false);
		expect(weakReport.weakTaskIds).toContain('task-1');
		expect(weakReport.findings.map((finding) => finding.code)).toEqual(
			expect.arrayContaining([
				'vague_title',
				'missing_description',
				'missing_skills',
				'missing_acceptance_criteria',
				'missing_verification',
				'missing_targets',
				'unknown_dependency'
			])
		);
	});

	it('warns when task count drifts outside the mission size prior', () => {
		const report = assessTaskQuality(
			[
				{
					id: 'only-task',
					title: 'Implement memory dashboard route',
					summary: 'Create the route, loader, UI, manual eval, and tests.',
					skills: ['frontend-engineer'],
					workspaceTargets: ['src/routes/memory-quality'],
					acceptanceCriteria: ['The route renders dashboard metrics.'],
					verificationCommands: ['npm run test:run']
				}
			],
			{ suggestedTaskRange: [5, 8], verificationDepth: 'standard' }
		);

		expect(report.passed).toBe(true);
		expect(report.findings.map((finding) => finding.code)).toContain('task_count_low');
	});

	it('warns on template bucket titles that make builds feel generic', () => {
		const report = assessTaskQuality([
			{
				id: 'task-shell',
				title: 'Create the app shell and project structure',
				summary: 'Create the starter app files.',
				skills: ['frontend-engineer'],
				workspaceTargets: ['src/routes/example'],
				acceptanceCriteria: ['The first screen renders.'],
				verificationCommands: ['npm run build']
			},
			{
				id: 'task-core',
				title: 'Implement the core interaction and state',
				summary: 'Wire the main interaction.',
				skills: ['frontend-engineer'],
				workspaceTargets: ['src/routes/example'],
				acceptanceCriteria: ['The interaction changes state.'],
				verificationCommands: ['npm run build']
			}
		]);

		expect(report.passed).toBe(true);
		expect(report.findings.filter((finding) => finding.code === 'vague_title')).toHaveLength(2);
		expect(report.findings.map((finding) => finding.taskId)).toEqual(
			expect.arrayContaining(['task-shell', 'task-core'])
		);
	});

	it('exports compact guidance for PRD analyzer prompts', () => {
		const guidance = formatTaskQualityGuidance();

		expect(guidance).toContain('Task quality requirements:');
		expect(guidance).toContain('1-5 valid skills');
		expect(guidance).toContain('Create the app shell and project structure');
	});
});
