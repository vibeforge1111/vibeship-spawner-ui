import skillDetails from '$lib/data/skill-details.json';
import { describe, expect, it } from 'vitest';
import { matchTaskToSkillRecommendations, matchTaskToSkills, rankSkillsForText } from './h70-skill-matcher';

const skillIds = new Set(Object.keys(skillDetails));

function idsFor(text: string, maxResults = 8): string[] {
	return rankSkillsForText(text, maxResults).map((rank) => rank.skillId);
}

describe('Spark catalog skill matcher', () => {
	it('selects real RAG and LLM skills without unrelated finance, game, or NFT matches', () => {
		const ids = idsFor(
			'Build a production RAG chatbot with embeddings, vector retrieval, semantic search, citations, and prompt evaluation'
		);

		expect(ids).toContain('llm-architect');
		expect(ids.some((id) => ['rag-engineer', 'semantic-search', 'vector-specialist'].includes(id))).toBe(true);
		expect(ids).not.toContain('nft-engineer');
		expect(ids).not.toContain('streamer-bait-design');
		expect(ids).not.toContain('portfolio-optimization');
	});

	it('selects art consistency and generation skills without backend commerce noise', () => {
		const ids = idsFor(
			'Create a consistent AI art series with the same character, visual style, image generation, and shot continuity'
		);

		expect(ids).toContain('art-consistency');
		expect(ids.some((id) => ['ai-image-generation', 'ai-video-generation'].includes(id))).toBe(true);
		expect(ids).not.toContain('rate-limiting');
		expect(ids).not.toContain('digital-product-delivery');
	});

	it('selects current mobile skills and avoids removed mobile-development ids', () => {
		const ids = idsFor(
			'Build a mobile app with Expo and React Native, native iOS and Android integrations, push notifications, and app store deployment'
		);

		expect(ids).toContain('expo');
		expect(ids).toContain('react-native-specialist');
		expect(ids).not.toContain('mobile-development');
	});

	it('only returns skill ids that exist in the generated Spark details', () => {
		const matched = matchTaskToSkills(
			'Design a secure API for auth, payments, webhooks, analytics, and frontend state',
			undefined,
			10
		);

		expect(matched.length).toBeGreaterThan(0);
		for (const id of matched) {
			expect(skillIds.has(id)).toBe(true);
		}
	});

	it('matches task-level security, Web3, voice, and realtime domains to concrete skills', () => {
		expect(matchTaskToSkills('Implement OAuth login, sessions, and MFA', undefined, 6)).toEqual(
			expect.arrayContaining(['auth-specialist', 'authentication-oauth'])
		);

		expect(matchTaskToSkills('Create NFT minting smart contracts with wallet login', undefined, 8)).toEqual(
			expect.arrayContaining(['nft-engineer', 'smart-contract-engineer', 'wallet-integration'])
		);

		expect(matchTaskToSkills('Build Twilio voice AI calls with speech to text', undefined, 8)).toEqual(
			expect.arrayContaining(['voice-ai-development', 'twilio-communications'])
		);

		const realtime = matchTaskToSkills('Realtime websocket whiteboard presence sync', undefined, 10);
		expect(realtime).toEqual(expect.arrayContaining(['presence-indicators']));
		expect(realtime).not.toContain('kubernetes');
	});

	it('labels recommendations as core, supporting, or related without changing the flat API', () => {
		const ranks = matchTaskToSkillRecommendations(
			'Build a GraphQL API with schema design, resolvers, subscriptions, and auth guards',
			undefined,
			10
		);
		const tierById = new Map(ranks.map((rank) => [rank.skillId, rank.recommendationTier]));

		expect(matchTaskToSkills('Build a GraphQL API with schema design, resolvers, subscriptions, and auth guards', undefined, 3))
			.toEqual(ranks.slice(0, 3).map((rank) => rank.skillId));
		expect(tierById.get('graphql')).toBe('core');
		expect(tierById.get('graphql-architect')).toBe('core');
		expect(ranks.some((rank) => rank.recommendationTier !== 'core')).toBe(true);
		expect(ranks.every((rank) => ['core', 'supporting', 'related'].includes(rank.recommendationTier))).toBe(true);
	});

	it('honors negative selection hints when expanding related skills', () => {
		const ids = idsFor('Add observability with structured logs, traces, metrics, alerts, and Sentry error tracking', 10);

		expect(ids).toEqual(expect.arrayContaining(['observability', 'sentry-error-tracking']));
		expect(ids).not.toContain('postgres-wizard');
		expect(ids).not.toContain('data-engineer');
		expect(ids).not.toContain('data-pipeline');
		expect(ids).not.toContain('sustainability-metrics');
	});
});
