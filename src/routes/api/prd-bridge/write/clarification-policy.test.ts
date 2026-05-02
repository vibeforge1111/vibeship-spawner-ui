import { describe, expect, it } from 'vitest';
import { _shouldRequestBriefClarification } from './+server';

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

		expect(_shouldRequestBriefClarification({
			content,
			buildMode: 'direct',
			openQuestions: ['Should the cafe feel modern or rustic?']
		})).toBe(false);
	});

	it('still asks on vague short builds', () => {
		expect(_shouldRequestBriefClarification({
			content: 'Build something cool.',
			buildMode: 'direct',
			openQuestions: ['Who is this for?']
		})).toBe(true);
	});

	it('respects force dispatch and missing questions', () => {
		expect(_shouldRequestBriefClarification({
			content: 'Build something cool.',
			buildMode: 'direct',
			openQuestions: ['Who is this for?'],
			forceDispatch: true
		})).toBe(false);

		expect(_shouldRequestBriefClarification({
			content: 'Build something cool.',
			buildMode: 'direct',
			openQuestions: []
		})).toBe(false);
	});
});
