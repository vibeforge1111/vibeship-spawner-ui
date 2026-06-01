import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClaudeClient } from './claude-api';

const fetchMock = vi.mocked(globalThis.fetch);

describe('ClaudeClient', () => {
	let client: ClaudeClient;

	beforeEach(() => {
		client = new ClaudeClient();
	});

	it('returns the HTTP status for non-2xx responses before parsing JSON', async () => {
		fetchMock.mockResolvedValue(
			new Response('<html>Bad Gateway</html>', {
				status: 502,
				headers: { 'content-type': 'text/html' }
			})
		);

		await expect(client.analyzeGoal('build a dashboard')).resolves.toEqual({
			success: false,
			error: 'API request failed (HTTP 502)',
			source: 'local',
			fallback: true
		});
	});

	it('preserves API fallback envelopes from successful JSON responses', async () => {
		fetchMock.mockResolvedValue(
			Response.json(
				{
					fallback: true,
					error: 'rate-limited'
				},
				{ status: 200 }
			)
		);

		await expect(client.analyzeGoal('build a dashboard')).resolves.toEqual({
			success: false,
			error: 'rate-limited',
			source: 'local',
			fallback: true
		});
	});

	it('returns Claude analysis for successful JSON responses', async () => {
		const analysis = {
			technologies: ['svelte'],
			features: ['mission board'],
			domains: ['frontend'],
			suggestedSkills: [],
			complexity: 'moderate' as const,
			summary: 'A concise mission board.',
			questions: [],
			workflowOrder: []
		};

		fetchMock.mockResolvedValue(Response.json({ analysis }, { status: 200 }));

		await expect(client.analyzeGoal('build a dashboard')).resolves.toEqual({
			success: true,
			analysis,
			source: 'claude'
		});
	});
});
