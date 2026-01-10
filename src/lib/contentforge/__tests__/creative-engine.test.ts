/**
 * Creative Engine Tests
 *
 * Tests for image recommendations and thread expansion.
 */

import { describe, it, expect } from 'vitest';
import {
	generateImageRecommendations,
	expandToThread,
	type ImageRecommendation,
	type ThreadExpansion
} from '../services/creative-engine';
import type { SynthesisResult, ContentInfo } from '../types';

// Factory for test synthesis result
function createTestSynthesis(overrides: Partial<SynthesisResult> = {}): SynthesisResult {
	return {
		postId: 'test-post',
		viralityScore: 65,
		keyInsights: [
			'High shareability (8/10) - Strong viral potential',
			'Effective curiosity hook',
			'Riding AI trend (growing phase)'
		],
		patternCorrelations: [],
		playbook: {
			title: 'Growth-Focused Playbook',
			summary: '4-step strategy',
			steps: [
				{ order: 1, action: 'Use a curiosity hook', rationale: 'High effectiveness', examples: ['Pattern interrupt'] },
				{ order: 2, action: 'Target aspiration emotion', rationale: 'Primary driver', examples: ['Success'] }
			],
			estimatedImpact: 65
		},
		createdAt: new Date().toISOString(),
		...overrides
	};
}

function createTestContent(overrides: Partial<ContentInfo> = {}): ContentInfo {
	return {
		text: 'Here\'s my secret to building a successful startup. I went from zero to $1M ARR in 12 months. A thread:',
		hashtags: ['startup', 'buildinpublic', 'entrepreneurship'],
		mentions: [],
		media: [],
		threadLength: 1,
		...overrides
	};
}

describe('Image Recommendations', () => {
	it('should generate recommendations for Twitter and Instagram', () => {
		const synthesis = createTestSynthesis();
		const content = createTestContent();

		const recommendations = generateImageRecommendations(synthesis, content);

		expect(recommendations.length).toBeGreaterThanOrEqual(2);

		const platforms = recommendations.map(r => r.platform);
		expect(platforms).toContain('twitter');
		expect(platforms).toContain('instagram');
	});

	it('should include LinkedIn for high virality content', () => {
		const synthesis = createTestSynthesis({ viralityScore: 75 });
		const content = createTestContent();

		const recommendations = generateImageRecommendations(synthesis, content);

		const platforms = recommendations.map(r => r.platform);
		expect(platforms).toContain('linkedin');
	});

	it('should not include LinkedIn for low virality content', () => {
		const synthesis = createTestSynthesis({ viralityScore: 40 });
		const content = createTestContent();

		const recommendations = generateImageRecommendations(synthesis, content);

		const platforms = recommendations.map(r => r.platform);
		expect(platforms).not.toContain('linkedin');
	});

	it('should use correct aspect ratios per platform', () => {
		const synthesis = createTestSynthesis({ viralityScore: 80 });
		const content = createTestContent();

		const recommendations = generateImageRecommendations(synthesis, content);

		const twitter = recommendations.find(r => r.platform === 'twitter');
		const instagram = recommendations.find(r => r.platform === 'instagram');
		const linkedin = recommendations.find(r => r.platform === 'linkedin');

		expect(twitter?.aspectRatio).toBe('16:9');
		expect(instagram?.aspectRatio).toBe('1:1');
		expect(linkedin?.aspectRatio).toBe('1:1');
	});

	it('should detect technical style for code content', () => {
		const synthesis = createTestSynthesis();
		const content = createTestContent({
			text: 'Here\'s a dev tip for your API. This code trick saves hours.'
		});

		const recommendations = generateImageRecommendations(synthesis, content);

		const techRec = recommendations.find(r => r.style === 'technical');
		expect(techRec).toBeDefined();
	});

	it('should detect appropriate style for casual content', () => {
		const synthesis = createTestSynthesis();
		const content = createTestContent({
			text: 'lol when your code works first try 😂 This meme is too real'
		});

		const recommendations = generateImageRecommendations(synthesis, content);

		// Should generate some recommendations with a style
		expect(recommendations.length).toBeGreaterThan(0);
		expect(recommendations[0].style).toBeDefined();
	});

	it('should detect bold style for high virality', () => {
		const synthesis = createTestSynthesis({ viralityScore: 85 });
		const content = createTestContent();

		const recommendations = generateImageRecommendations(synthesis, content);

		const boldRec = recommendations.find(r => r.style === 'bold');
		expect(boldRec).toBeDefined();
	});

	it('should include rationale for each recommendation', () => {
		const synthesis = createTestSynthesis();
		const content = createTestContent();

		const recommendations = generateImageRecommendations(synthesis, content);

		recommendations.forEach(rec => {
			expect(rec.rationale).toBeDefined();
			expect(rec.rationale.length).toBeGreaterThan(0);
		});
	});

	it('should generate prompts with key insights', () => {
		const synthesis = createTestSynthesis({
			keyInsights: ['Revolutionary AI discovery']
		});
		const content = createTestContent();

		const recommendations = generateImageRecommendations(synthesis, content);

		const twitterRec = recommendations.find(r => r.platform === 'twitter');
		expect(twitterRec?.prompt).toContain('Revolutionary AI discovery');
	});
});

describe('Thread Expansion', () => {
	it('should expand content to target thread length', () => {
		const content = createTestContent();
		const synthesis = createTestSynthesis();

		const expansion = expandToThread(content, synthesis, 7);

		expect(expansion.tweets.length).toBe(7);
		expect(expansion.totalLength).toBe(7);
	});

	it('should start with a hook tweet', () => {
		const content = createTestContent();
		const synthesis = createTestSynthesis();

		const expansion = expandToThread(content, synthesis);

		const firstTweet = expansion.tweets[0];
		expect(firstTweet.position).toBe(1);
		expect(firstTweet.purpose).toBe('hook');
		expect(firstTweet.content).toContain('🧵');
	});

	it('should end with a CTA tweet', () => {
		const content = createTestContent();
		const synthesis = createTestSynthesis();

		const expansion = expandToThread(content, synthesis);

		const lastTweet = expansion.tweets[expansion.tweets.length - 1];
		expect(lastTweet.purpose).toBe('cta');
		expect(lastTweet.content).toContain('Follow');
	});

	it('should include context tweet after hook', () => {
		const content = createTestContent();
		const synthesis = createTestSynthesis();

		const expansion = expandToThread(content, synthesis);

		const contextTweet = expansion.tweets.find(t => t.purpose === 'context');
		expect(contextTweet).toBeDefined();
		expect(contextTweet?.position).toBe(2);
	});

	it('should include insight tweets from synthesis', () => {
		const content = createTestContent();
		const synthesis = createTestSynthesis({
			keyInsights: ['Insight 1', 'Insight 2', 'Insight 3']
		});

		const expansion = expandToThread(content, synthesis, 7);

		const insightTweets = expansion.tweets.filter(t => t.purpose === 'insight');
		expect(insightTweets.length).toBeGreaterThan(0);
	});

	it('should calculate estimated read time', () => {
		const content = createTestContent();
		const synthesis = createTestSynthesis();

		const expansion = expandToThread(content, synthesis);

		expect(expansion.estimatedReadTime).toBeDefined();
		expect(expansion.estimatedReadTime).toMatch(/\d+ min read/);
	});

	it('should include engagement hooks', () => {
		const content = createTestContent();
		const synthesis = createTestSynthesis();

		const expansion = expandToThread(content, synthesis);

		expect(expansion.engagementHooks.length).toBeGreaterThan(0);
	});

	it('should number insight tweets correctly', () => {
		const content = createTestContent();
		const synthesis = createTestSynthesis({
			keyInsights: ['First insight', 'Second insight']
		});

		const expansion = expandToThread(content, synthesis, 6);

		const insightTweets = expansion.tweets.filter(t => t.purpose === 'insight');
		insightTweets.forEach(tweet => {
			expect(tweet.content).toMatch(/^\d+\//);
		});
	});

	it('should include hashtags in CTA', () => {
		const content = createTestContent({
			hashtags: ['startup', 'tech', 'buildinpublic']
		});
		const synthesis = createTestSynthesis();

		const expansion = expandToThread(content, synthesis);

		const ctaTweet = expansion.tweets.find(t => t.purpose === 'cta');
		expect(ctaTweet?.content).toContain('#startup');
	});

	it('should track character counts for each tweet', () => {
		const content = createTestContent();
		const synthesis = createTestSynthesis();

		const expansion = expandToThread(content, synthesis);

		expansion.tweets.forEach(tweet => {
			expect(tweet.characterCount).toBeGreaterThan(0);
		});
	});

	it('should handle short target lengths', () => {
		const content = createTestContent();
		const synthesis = createTestSynthesis();

		const expansion = expandToThread(content, synthesis, 3);

		expect(expansion.tweets.length).toBeGreaterThanOrEqual(3);
		expect(expansion.tweets[0].purpose).toBe('hook');
		expect(expansion.tweets[expansion.tweets.length - 1].purpose).toBe('cta');
	});

	it('should fill with examples when needed', () => {
		const content = createTestContent();
		const synthesis = createTestSynthesis({
			keyInsights: ['Just one insight'],
			playbook: {
				title: 'Test',
				summary: 'Test',
				steps: [
					{ order: 1, action: 'Step 1', rationale: 'Why', examples: ['Example A', 'Example B'] }
				],
				estimatedImpact: 50
			}
		});

		const expansion = expandToThread(content, synthesis, 7);

		const exampleTweets = expansion.tweets.filter(t => t.purpose === 'example');
		expect(exampleTweets.length).toBeGreaterThan(0);
	});
});
