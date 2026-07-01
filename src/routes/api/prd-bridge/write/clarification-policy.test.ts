import { describe, expect, it } from 'vitest';
import {
	_resolvePrdCodexCommandTemplate,
	_resolvePrdCodexModel,
	_shouldBypassBriefEnrichment,
	_shouldRequestBriefClarification
} from './+server';

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

	it('preserves governed direct-build briefs instead of deterministic enrichment', () => {
		const content =
			'Build a practical Harness Release Ops Mission Board. Use Spawner. Track authority gates, runtime health, Telegram proof, registry pin drift, rollback steps, open blockers, and the next QA queue. Include tests and a README.';

		expect(
			_shouldBypassBriefEnrichment({
				content,
				buildMode: 'direct',
				buildLane: 'direct'
			})
		).toEqual({
			bypass: true,
			reason: 'governed_direct_build_preserves_owner_brief'
		});

		expect(
			_shouldBypassBriefEnrichment({
				content,
				buildMode: 'advanced_prd',
				buildLane: 'advanced_prd'
			})
		).toEqual({ bypass: false, reason: null });
	});

	it('uses the fast Codex profile for PRD auto-analysis unless explicitly configured', () => {
		expect(_resolvePrdCodexModel({})).toBe('gpt-5.5');
		expect(_resolvePrdCodexModel({ SPAWNER_PRD_CODEX_MODEL: 'gpt-5.1' })).toBe('gpt-5.1');
		expect(_resolvePrdCodexCommandTemplate('gpt-5.5', {})).toBe(
			'codex exec --model gpt-5.5 --profile speed --sandbox workspace-write'
		);
		expect(
			_resolvePrdCodexCommandTemplate('gpt-5.5', {
				SPARK_CODEX_SANDBOX: 'danger-full-access',
				SPARK_ALLOW_HIGH_AGENCY_WORKERS: '1'
			})
		).toBe('codex exec --model gpt-5.5 --profile speed --sandbox danger-full-access');
		expect(
			_resolvePrdCodexCommandTemplate('gpt-5.5', {
				SPAWNER_PRD_CODEX_COMMAND_TEMPLATE: 'codex exec --model {model} --sandbox workspace-write'
			})
		).toBe('codex exec --model gpt-5.5 --sandbox workspace-write');
	});
});
