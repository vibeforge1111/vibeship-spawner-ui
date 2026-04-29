import { describe, expect, it } from 'vitest';
import { classifyBrief, formatBundleForPrompt, type BundleSpec } from './bundle-classifier';

describe('bundle-classifier', () => {
	it('matches a concrete SaaS billing brief to the SaaS bundle', async () => {
		const result = await classifyBrief(
			'Build a B2B SaaS dashboard with user accounts, Stripe subscription billing, invoices, seats, and admin settings.'
		);

		expect(result.bestMatch?.id).toBe('saas-with-auth-and-billing');
		expect(result.confidence).toBeGreaterThan(0.18);
		expect(result.alternatives).toHaveLength(3);
	});

	it('does not force a weak unrelated brief into a curated bundle', async () => {
		const result = await classifyBrief('Write a tiny poem about a blue sunrise.');

		expect(result.bestMatch).toBeNull();
		expect(result.alternatives.length).toBeLessThanOrEqual(3);
	});

	it('formats a bundle as a prompt hint without making the load order mandatory', () => {
		const bundle: BundleSpec = {
			id: 'test-dashboard',
			name: 'Internal dashboard',
			task_pattern: 'Build an internal operational dashboard',
			required_skills: ['frontend', 'state-management'],
			optional_skills: ['charts'],
			load_order: ['data model', 'dashboard UI', 'verification'],
			notes: 'Keep density high.\nAvoid marketing hero sections.'
		};

		const prompt = formatBundleForPrompt(bundle);

		expect(prompt).toContain('closest curated bundle: Internal dashboard');
		expect(prompt).toContain('  1. data model');
		expect(prompt).toContain('Required skills: frontend, state-management');
		expect(prompt).toContain('Optional skills (consider when relevant): charts');
		expect(prompt).toContain('Keep density high.');
		expect(prompt).toContain('starting template, NOT a strict requirement');
	});
});
