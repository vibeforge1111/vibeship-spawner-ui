import { describe, expect, it } from 'vitest';
import { formatVerificationPlanGuidance, generateVerificationPlan } from './verification-plan-generator';

describe('verification-plan-generator', () => {
	it('builds static app checks around exact static files', () => {
		const plan = generateVerificationPlan(
			{ projectKind: 'static-app', verificationDepth: 'light' },
			{ targetFolder: 'C:\\Users\\USER\\Desktop\\spark-clock' }
		);

		expect(plan.projectKind).toBe('static-app');
		expect(plan.depth).toBe('light');
		expect(plan.commands.join('\n')).toContain('index.html');
		expect(plan.commands.join('\n')).toContain('node --check');
		expect(plan.acceptanceCriteria.join('\n')).toContain('no-build static file shape');
	});

	it('requires render, interaction, mobile, and fallback checks for Three.js work', () => {
		const plan = generateVerificationPlan({ projectKind: 'threejs-app', verificationDepth: 'deep' });

		expect(plan.depth).toBe('deep');
		expect(plan.acceptanceCriteria.join('\n')).toContain('nonblank pixels');
		expect(plan.acceptanceCriteria.join('\n')).toContain('WebGL fallback');
		expect(plan.commands.join('\n')).toContain('headless browser smoke test');
	});

	it('covers full surface alignment for multi-system Spark missions', () => {
		const plan = generateVerificationPlan({ projectKind: 'multi-system', verificationDepth: 'deep' });

		expect(plan.commands).toEqual(expect.arrayContaining(['npm run check', 'npm run test:run', 'npm run build']));
		expect(plan.acceptanceCriteria.join('\n')).toContain('Telegram, Kanban, Canvas, Trace');
		expect(plan.notes.join('\n')).toContain('mission ID');
	});

	it('formats compact prompt guidance', () => {
		const guidance = formatVerificationPlanGuidance(
			generateVerificationPlan({ projectKind: 'dashboard', verificationDepth: 'standard' })
		);

		expect(guidance).toContain('Verification planning guidance:');
		expect(guidance).toContain('Project kind: dashboard');
		expect(guidance).toContain('Useful checks:');
	});
});
