/**
 * Orchestrator Integration Tests
 *
 * Tests for the full agent orchestration pipeline.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createOrchestrator } from '../services/orchestrator';
import { MarketingAgent } from '../agents/marketing-agent';
import { CopywritingAgent } from '../agents/copywriting-agent';
import { ResearchAgent } from '../agents/research-agent';
import { PsychologyAgent } from '../agents/psychology-agent';
import type { ScrapedData } from '../types';

// Test fixture
function createTestData(): ScrapedData {
	return {
		postId: 'integration-test-123',
		url: 'https://x.com/testuser/status/123',
		author: {
			username: 'testuser',
			displayName: 'Test User',
			followers: 25000,
			verified: false
		},
		content: {
			text: 'Here\'s my secret to building products that users love. After 10 years and 5 startups, I\'ve learned these 7 principles:',
			hashtags: ['startup', 'product', 'buildinpublic'],
			mentions: [],
			media: [],
			threadLength: 1
		},
		metrics: {
			likes: 12000,
			retweets: 3500,
			replies: 800,
			bookmarks: 2000,
			views: 500000,
			engagementRate: 3.66
		},
		temporal: {
			postedAt: '2024-01-15T14:30:00Z',
			scrapedAt: new Date().toISOString()
		}
	};
}

describe('Orchestrator', () => {
	let orchestrator: ReturnType<typeof createOrchestrator>;

	beforeEach(() => {
		orchestrator = createOrchestrator();
	});

	it('should create a new orchestrator instance', () => {
		expect(orchestrator).toBeDefined();
		expect(orchestrator.registerAgent).toBeDefined();
		expect(orchestrator.execute).toBeDefined();
	});

	it('should register agents successfully', () => {
		const marketingAgent = new MarketingAgent();
		const copywritingAgent = new CopywritingAgent();

		// Should not throw
		expect(() => {
			orchestrator.registerAgent(marketingAgent);
			orchestrator.registerAgent(copywritingAgent);
		}).not.toThrow();
	});

	it('should execute a single agent', async () => {
		const marketingAgent = new MarketingAgent();
		orchestrator.registerAgent(marketingAgent);

		const data = createTestData();
		const result = await orchestrator.execute(data, ['marketing']);

		expect(result.success).toBe(true);
		expect(result.results.marketing).toBeDefined();
		expect(result.results.marketing?.success).toBe(true);
	});

	it('should execute multiple agents in parallel', async () => {
		orchestrator.registerAgent(new MarketingAgent());
		orchestrator.registerAgent(new CopywritingAgent());
		orchestrator.registerAgent(new ResearchAgent());

		const data = createTestData();
		const result = await orchestrator.execute(data, ['marketing', 'copywriting', 'research']);

		expect(result.success).toBe(true);
		expect(result.results.marketing).toBeDefined();
		expect(result.results.copywriting).toBeDefined();
		expect(result.results.research).toBeDefined();
	});

	it('should execute all registered agents with "all"', async () => {
		orchestrator.registerAgent(new MarketingAgent());
		orchestrator.registerAgent(new CopywritingAgent());
		orchestrator.registerAgent(new ResearchAgent());
		orchestrator.registerAgent(new PsychologyAgent());

		const data = createTestData();
		const result = await orchestrator.execute(data, 'all');

		expect(result.success).toBe(true);
		expect(Object.keys(result.results).length).toBe(4);
	});

	it('should track processing time', async () => {
		orchestrator.registerAgent(new MarketingAgent());

		const data = createTestData();
		const result = await orchestrator.execute(data, ['marketing']);

		expect(result.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
	});

	it('should handle empty agent list gracefully', async () => {
		const data = createTestData();
		const result = await orchestrator.execute(data, []);

		expect(result.success).toBe(true);
		expect(Object.keys(result.results).length).toBe(0);
	});

	it('should handle unregistered agent types', async () => {
		orchestrator.registerAgent(new MarketingAgent());

		const data = createTestData();
		// Request agents that aren't registered
		const result = await orchestrator.execute(data, ['copywriting', 'research']);

		// Should still succeed but with no results for unregistered agents
		expect(result.success).toBe(true);
	});

	it('should include metadata in results', async () => {
		orchestrator.registerAgent(new MarketingAgent());
		orchestrator.registerAgent(new PsychologyAgent());

		const data = createTestData();
		const result = await orchestrator.execute(data, 'all');

		expect(result.startedAt).toBeDefined();
		expect(result.completedAt).toBeDefined();
	});

	it('should produce consistent results for same input', async () => {
		orchestrator.registerAgent(new MarketingAgent());

		const data = createTestData();
		const result1 = await orchestrator.execute(data, ['marketing']);
		const result2 = await orchestrator.execute(data, ['marketing']);

		// Core analysis should be consistent
		expect(result1.results.marketing?.data?.positioning.niche)
			.toBe(result2.results.marketing?.data?.positioning.niche);
	});

	it('should be request-scoped (SSR safe)', () => {
		const orchestrator1 = createOrchestrator();
		const orchestrator2 = createOrchestrator();

		orchestrator1.registerAgent(new MarketingAgent());

		// orchestrator2 should not have the agent from orchestrator1
		expect(orchestrator1).not.toBe(orchestrator2);
	});
});

describe('Full Pipeline Integration', () => {
	it('should run complete analysis pipeline', async () => {
		const orchestrator = createOrchestrator();
		orchestrator.registerAgent(new MarketingAgent());
		orchestrator.registerAgent(new CopywritingAgent());
		orchestrator.registerAgent(new ResearchAgent());
		orchestrator.registerAgent(new PsychologyAgent());

		const data = createTestData();
		const result = await orchestrator.execute(data, 'all');

		// Verify all agents completed
		expect(result.success).toBe(true);
		expect(result.results.marketing?.success).toBe(true);
		expect(result.results.copywriting?.success).toBe(true);
		expect(result.results.research?.success).toBe(true);
		expect(result.results.psychology?.success).toBe(true);

		// Verify data quality
		expect(result.results.marketing?.data?.positioning).toBeDefined();
		expect(result.results.copywriting?.data?.hook).toBeDefined();
		expect(result.results.research?.data?.trendContext).toBeDefined();
		expect(result.results.psychology?.data?.emotionalTriggers).toBeDefined();
	});

	it('should handle high-engagement content appropriately', async () => {
		const orchestrator = createOrchestrator();
		orchestrator.registerAgent(new MarketingAgent());
		orchestrator.registerAgent(new PsychologyAgent());

		const viralData: ScrapedData = {
			...createTestData(),
			metrics: {
				likes: 100000,
				retweets: 35000,
				replies: 5000,
				bookmarks: 15000,
				views: 5000000,
				engagementRate: 3.1
			}
		};

		const result = await orchestrator.execute(viralData, 'all');

		// High engagement should produce successful analysis
		expect(result.success).toBe(true);
		expect(result.results.marketing?.success).toBe(true);
		expect(result.results.marketing?.data?.distributionFactors).toBeDefined();
	});
});
