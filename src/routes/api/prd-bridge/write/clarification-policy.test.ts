import { describe, expect, it } from 'vitest';
import { shouldRequestBriefClarification } from './+server';

describe('PRD bridge clarification policy', () => {
	it('lets concrete direct static builds continue without clarification', () => {
		const content = [
			'# Cafe Landing Page',
			'',
			'Build mode: direct',
			'Build mode reason: compact static build.',
			'',
			'Build a tiny static landing page for a cafe with a menu section.'
		].join('\n');

		expect(shouldRequestBriefClarification({
			content,
			buildMode: 'direct',
			openQuestions: ['Should the cafe feel modern or rustic?']
		})).toBe(false);
	});

	it('still asks on vague short builds', () => {
		expect(shouldRequestBriefClarification({
			content: 'Build something cool.',
			buildMode: 'direct',
			openQuestions: ['Who is this for?']
		})).toBe(true);
	});

	it('respects force dispatch and missing questions', () => {
		expect(shouldRequestBriefClarification({
			content: 'Build something cool.',
			buildMode: 'direct',
			openQuestions: ['Who is this for?'],
			forceDispatch: true
		})).toBe(false);

		expect(shouldRequestBriefClarification({
			content: 'Build something cool.',
			buildMode: 'direct',
			openQuestions: []
		})).toBe(false);
	});
});
