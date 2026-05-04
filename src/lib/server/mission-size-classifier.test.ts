import { describe, expect, it } from 'vitest';
import { classifyMissionSize, formatMissionSizeGuidance } from './mission-size-classifier';

describe('mission-size-classifier', () => {
	it('keeps tiny requests small', () => {
		const result = classifyMissionSize('Fix the typo in the README.');

		expect(result.size).toBe('tiny');
		expect(result.projectKind).toBe('general');
		expect(result.suggestedTaskRange).toEqual([2, 3]);
		expect(result.verificationDepth).toBe('light');
	});

	it('classifies sparse understanding checks as small clarification workflows', () => {
		const result = classifyMissionSize('did you understand what i said');

		expect(result.size).toBe('small');
		expect(result.projectKind).toBe('clarification');
		expect(result.suggestedTaskRange).toEqual([2, 3]);
		expect(result.verificationDepth).toBe('light');
		expect(result.reasons).toContain('sparse understanding clarification');
	});

	it('recognizes explicit no-build static apps as small builds', () => {
		const result = classifyMissionSize(
			'Build this at C:\\Users\\USER\\Desktop\\spark-clock: a vanilla-JS static app. Files: index.html, styles.css, app.js, README.md. No build step. Use localStorage and include a smoke test.'
		);

		expect(result.projectKind).toBe('static-app');
		expect(result.size).toBe('standard');
		expect(result.suggestedTaskRange).toEqual([5, 8]);
		expect(result.reasons).toContain('explicit static app constraints');
	});

	it('recognizes Three.js projects as richer frontend builds', () => {
		const result = classifyMissionSize(
			'Create a Three.js sprite creator with WebGL fallback, particles, responsive controls, saved sprites, and browser smoke tests.'
		);

		expect(result.projectKind).toBe('threejs-app');
		expect(result.size).toBe('large');
		expect(result.verificationDepth).toBe('deep');
	});

	it('recognizes multi-system Spark work as system-level', () => {
		const result = classifyMissionSize(
			'Improve spawner-ui so Telegram, Canvas, Kanban, Trace, mission control, skill pairing, and provider execution all stay aligned with tests.'
		);

		expect(result.projectKind).toBe('multi-system');
		expect(result.size).toBe('system');
		expect(result.suggestedTaskRange).toEqual([10, 18]);
		expect(result.verificationDepth).toBe('deep');
	});

	it('formats guidance for PRD analyzer prompts', () => {
		const result = classifyMissionSize('Build a dashboard with metrics, filters, tables, and tests.');
		const guidance = formatMissionSizeGuidance(result);

		expect(guidance).toContain('Mission size guidance:');
		expect(guidance).toContain('Suggested task range:');
		expect(guidance).toContain('Use this as a planning prior');
	});
});
