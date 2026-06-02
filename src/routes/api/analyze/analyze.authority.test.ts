import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PRIVATE_ENV = vi.hoisted((): Record<string, string | undefined> => ({}));
vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

import { POST } from './+server';
import {
	buildServerGovernorDecisionAuthority,
	buildServerTurnIntentVNextAuthority
} from '$lib/server/harness-authority';

const originalFetch = globalThis.fetch;

function event(body: unknown) {
	return {
		request: new Request('http://127.0.0.1:3333/api/analyze', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1:3333/api/analyze'),
		getClientAddress: () => '127.0.0.1'
	};
}

function claudeResponse() {
	return new Response(
		JSON.stringify({
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						technologies: ['SvelteKit'],
						features: ['Project analysis'],
						domains: ['web-app'],
						suggestedSkills: [{ id: 'sveltekit', reason: 'Needed for the app.', tier: 1 }],
						complexity: 'moderate',
						summary: 'Build a governed Spark app analyzer.',
						workflowOrder: ['sveltekit'],
						questions: []
					})
				}
			]
		}),
		{ status: 200, headers: { 'content-type': 'application/json' } }
	);
}

function governorAuthority() {
	return buildServerGovernorDecisionAuthority({
		source: 'analyze-authority-test',
		reason: 'Focused external analysis authority regression.',
		toolName: 'spawner.analyze',
		mutationClass: 'external_network',
		requestId: 'analyze-authority-test',
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test',
		target: 'Analyze a project.',
		externalNetwork: true
	});
}

function bareVNextAuthority() {
	return buildServerTurnIntentVNextAuthority({
		source: 'analyze-authority-test',
		reason: 'Focused external analysis authority regression.',
		toolName: 'spawner.analyze',
		mutationClass: 'external_network',
		requestId: 'analyze-authority-test',
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test',
		target: 'Analyze a project.',
		externalNetwork: true
	});
}

describe('/api/analyze authority contract', () => {
	beforeEach(() => {
		PRIVATE_ENV.ANTHROPIC_API_KEY = 'test-anthropic-key';
		globalThis.fetch = vi.fn(async () => claudeResponse()) as typeof fetch;
	});

	afterEach(() => {
		delete PRIVATE_ENV.ANTHROPIC_API_KEY;
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it('blocks external Claude analysis without Harness authority', async () => {
		const response = await POST(event({ goal: 'Analyze this startup app.' }) as never);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.reasonCodes).toContain('missing_harness_authority');
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('blocks bare VNext authority for external Claude analysis', async () => {
		const response = await POST(
			event({
				goal: 'Analyze this startup app.',
				executionAuthority: bareVNextAuthority()
			}) as never
		);

		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.source).toBe('turn_intent_vnext');
		expect(body.authority.reasonCodes).toContain('native_governor_required');
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('allows external Claude analysis with native Governor authority', async () => {
		const response = await POST(
			event({
				goal: 'Analyze this startup app.',
				executionAuthority: governorAuthority()
			}) as never
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.source).toBe('claude');
		expect(body.analysis.summary).toBe('Build a governed Spark app analyzer.');
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});
});
