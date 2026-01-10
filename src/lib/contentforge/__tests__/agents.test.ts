/**
 * ContentForge Agent Tests
 *
 * Unit tests for all agent implementations.
 * Following test-architect principles: test behavior, not implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketingAgent } from '../agents/marketing-agent';
import { CopywritingAgent } from '../agents/copywriting-agent';
import { ResearchAgent } from '../agents/research-agent';
import { PsychologyAgent } from '../agents/psychology-agent';
import type { ScrapedData } from '../types';

// Test fixture factory - creates consistent test data
function createTestData(overrides: Partial<ScrapedData> = {}): ScrapedData {
	return {
		postId: 'test-post-123',
		url: 'https://x.com/testuser/status/123',
		author: {
			username: 'testuser',
			displayName: 'Test User',
			followers: 10000,
			verified: false
		},
		content: {
			text: 'Here\'s my secret to success: consistency beats everything. I built my startup from zero to $1M ARR in 12 months.',
			hashtags: ['startup', 'success', 'buildinpublic'],
			mentions: [],
			media: [],
			threadLength: 1
		},
		metrics: {
			likes: 5000,
			retweets: 1500,
			replies: 300,
			bookmarks: 800,
			views: 250000,
			engagementRate: 2.72
		},
		temporal: {
			postedAt: '2024-01-15T14:30:00Z',
			scrapedAt: new Date().toISOString()
		},
		...overrides
	};
}

describe('MarketingAgent', () => {
	let agent: MarketingAgent;

	beforeEach(() => {
		agent = new MarketingAgent();
	});

	it('should analyze content and return success', async () => {
		const data = createTestData();
		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.agentType).toBe('marketing');
		expect(result.data).toBeDefined();
	});

	it('should identify target audience correctly', async () => {
		const data = createTestData({
			content: {
				text: 'As a founder, I learned these 5 lessons building my dev tool...',
				hashtags: ['founder', 'devtools', 'startup'],
				mentions: [],
				media: [],
				threadLength: 1
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.targetAudience.demographics).toBeDefined();
		expect(result.data?.targetAudience.psychographics).toBeDefined();
	});

	it('should detect high shareability for viral content', async () => {
		const data = createTestData({
			metrics: {
				likes: 50000,
				retweets: 15000,
				replies: 3000,
				bookmarks: 8000,
				views: 2500000,
				engagementRate: 2.8
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.distributionFactors.shareability).toBeGreaterThanOrEqual(5);
	});

	it('should identify thought leader positioning from credibility indicators', async () => {
		const data = createTestData({
			author: {
				username: 'expert',
				displayName: 'Industry Expert',
				followers: 500000,
				verified: true
			},
			content: {
				text: 'After 15 years in the industry and advising 100+ startups...',
				hashtags: ['leadership', 'expertise'],
				mentions: [],
				media: [],
				threadLength: 1
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.positioning.authorityLevel).toBe('thought_leader');
	});
});

describe('CopywritingAgent', () => {
	let agent: CopywritingAgent;

	beforeEach(() => {
		agent = new CopywritingAgent();
	});

	it('should analyze content and return success', async () => {
		const data = createTestData();
		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.agentType).toBe('copywriting');
		expect(result.data).toBeDefined();
	});

	it('should detect question hook type', async () => {
		const data = createTestData({
			content: {
				text: 'Why do 90% of startups fail? Here\'s what nobody tells you...',
				hashtags: ['startup'],
				mentions: [],
				media: [],
				threadLength: 1
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.hook.type).toBe('question');
	});

	it('should detect statistic hook type', async () => {
		const data = createTestData({
			content: {
				text: '73% of developers waste 2 hours daily. Here\'s the fix:',
				hashtags: ['dev'],
				mentions: [],
				media: [],
				threadLength: 1
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.hook.type).toBe('statistic');
	});

	it('should identify power words', async () => {
		const data = createTestData({
			content: {
				text: 'I love building amazing things. Create something incredible today!',
				hashtags: [],
				mentions: [],
				media: [],
				threadLength: 1
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.powerWords).toBeDefined();
		expect(result.data?.powerWords.emotional.length + result.data?.powerWords.action.length).toBeGreaterThan(0);
	});

	it('should extract reusable templates', async () => {
		const data = createTestData({
			content: {
				text: 'X tips for Y that Z',
				hashtags: [],
				mentions: [],
				media: [],
				threadLength: 1
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.templates).toBeDefined();
		expect(Array.isArray(result.data?.templates)).toBe(true);
	});
});

describe('ResearchAgent', () => {
	let agent: ResearchAgent;

	beforeEach(() => {
		agent = new ResearchAgent();
	});

	it('should analyze content and return success', async () => {
		const data = createTestData();
		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.agentType).toBe('research');
		expect(result.data).toBeDefined();
	});

	it('should identify AI trends from content', async () => {
		const data = createTestData({
			content: {
				text: 'GPT-4 just changed everything. Here\'s how AI is revolutionizing...',
				hashtags: ['ai', 'gpt'],
				mentions: [],
				media: [],
				threadLength: 1
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.trendContext.currentTrends).toContain('Generative AI');
	});

	it('should calculate high relevance for viral content', async () => {
		const data = createTestData({
			metrics: {
				likes: 100000,
				retweets: 30000,
				replies: 5000,
				bookmarks: 15000,
				views: 5000000,
				engagementRate: 3.0
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.trendContext.relevanceScore).toBeGreaterThanOrEqual(0.8);
	});

	it('should identify opportunity gaps', async () => {
		const data = createTestData({
			content: {
				text: 'Quick tip for developers.',
				hashtags: [],
				mentions: [],
				media: [],
				threadLength: 1
			},
			metrics: {
				likes: 500,
				retweets: 50,
				replies: 100,
				bookmarks: 200,
				views: 10000,
				engagementRate: 0.85
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.opportunityGaps.length).toBeGreaterThan(0);
	});
});

describe('PsychologyAgent', () => {
	let agent: PsychologyAgent;

	beforeEach(() => {
		agent = new PsychologyAgent();
	});

	it('should analyze content and return success', async () => {
		const data = createTestData();
		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.agentType).toBe('psychology');
		expect(result.data).toBeDefined();
	});

	it('should identify FOMO when bookmarks are high', async () => {
		const data = createTestData({
			metrics: {
				likes: 1000,
				retweets: 200,
				replies: 50,
				bookmarks: 500, // Very high bookmark to like ratio
				views: 50000,
				engagementRate: 0.35
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.emotionalTriggers.primary).toContain('FOMO');
	});

	it('should detect social proof bias', async () => {
		const data = createTestData({
			content: {
				text: 'Over 50,000 people have already joined. Everyone is talking about this!',
				hashtags: [],
				mentions: [],
				media: [],
				threadLength: 1
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		const hasSocialProof = result.data?.cognitiveBiases.some(b => b.biasType === 'Social Proof');
		expect(hasSocialProof).toBe(true);
	});

	it('should detect scarcity bias', async () => {
		const data = createTestData({
			content: {
				text: 'Only 10 spots left! This exclusive offer ends today.',
				hashtags: [],
				mentions: [],
				media: [],
				threadLength: 1
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		const hasScarcity = result.data?.cognitiveBiases.some(b => b.biasType === 'Scarcity');
		expect(hasScarcity).toBe(true);
	});

	it('should identify developer in-group', async () => {
		const data = createTestData({
			content: {
				text: 'Fellow devs, here\'s a debugging trick...',
				hashtags: ['dev', 'programming'],
				mentions: [],
				media: [],
				threadLength: 1
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.identityResonance.inGroup).toContain('Developer');
	});

	it('should calculate emotional intensity from exclamations', async () => {
		const data = createTestData({
			content: {
				text: 'AMAZING!!! This is INCREDIBLE! You NEED to see this!!!',
				hashtags: [],
				mentions: [],
				media: [],
				threadLength: 1
			}
		});

		const result = await agent.analyze(data);

		expect(result.success).toBe(true);
		expect(result.data?.emotionalTriggers.intensity).toBeGreaterThanOrEqual(8);
	});
});
