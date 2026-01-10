/**
 * Creative Engine
 *
 * Generates image recommendations and expands content into threads.
 */

import type { SynthesisResult, ContentInfo } from '../types';

// =============================================================================
// Image Recommendations
// =============================================================================

export interface ImageRecommendation {
	prompt: string;
	style: 'minimalist' | 'bold' | 'technical' | 'artistic' | 'meme';
	aspectRatio: '1:1' | '16:9' | '9:16' | '4:5';
	platform: 'twitter' | 'instagram' | 'linkedin';
	rationale: string;
}

export function generateImageRecommendations(
	synthesis: SynthesisResult,
	content: ContentInfo
): ImageRecommendation[] {
	const recommendations: ImageRecommendation[] = [];

	// Main visual based on content type
	const mainStyle = determineVisualStyle(synthesis, content);

	// Twitter-optimized image
	recommendations.push({
		prompt: generateImagePrompt(synthesis, content, 'twitter'),
		style: mainStyle,
		aspectRatio: '16:9',
		platform: 'twitter',
		rationale: 'Optimized for Twitter timeline visibility'
	});

	// Instagram-optimized version
	recommendations.push({
		prompt: generateImagePrompt(synthesis, content, 'instagram'),
		style: mainStyle,
		aspectRatio: '1:1',
		platform: 'instagram',
		rationale: 'Square format for Instagram feed'
	});

	// LinkedIn professional version
	if (synthesis.viralityScore >= 50) {
		recommendations.push({
			prompt: generateImagePrompt(synthesis, content, 'linkedin'),
			style: 'minimalist',
			aspectRatio: '1:1',
			platform: 'linkedin',
			rationale: 'Professional styling for LinkedIn audience'
		});
	}

	return recommendations;
}

function determineVisualStyle(
	synthesis: SynthesisResult,
	content: ContentInfo
): ImageRecommendation['style'] {
	const text = content.text.toLowerCase();

	if (text.includes('code') || text.includes('dev') || text.includes('api')) {
		return 'technical';
	}
	if (text.includes('meme') || text.includes('lol') || text.includes('😂')) {
		return 'meme';
	}
	if (synthesis.viralityScore >= 70) {
		return 'bold';
	}
	if (text.includes('art') || text.includes('design') || text.includes('creative')) {
		return 'artistic';
	}
	return 'minimalist';
}

function generateImagePrompt(
	synthesis: SynthesisResult,
	content: ContentInfo,
	platform: string
): string {
	const keyInsight = synthesis.keyInsights[0] || 'Key insight visualization';
	const hashtags = content.hashtags.slice(0, 3).join(', ');

	const basePrompt = `Create a ${platform === 'linkedin' ? 'professional' : 'engaging'} visual that represents: "${keyInsight}"`;

	const styleGuide = platform === 'twitter'
		? 'Bold, eye-catching, optimized for quick scroll-stopping'
		: platform === 'instagram'
			? 'Aesthetic, shareable, visually cohesive'
			: 'Clean, professional, thought leadership';

	return `${basePrompt}. Style: ${styleGuide}. Related topics: ${hashtags || 'tech, innovation'}`;
}

// =============================================================================
// Thread Expander
// =============================================================================

export interface ThreadExpansion {
	tweets: ThreadTweet[];
	totalLength: number;
	estimatedReadTime: string;
	engagementHooks: string[];
}

export interface ThreadTweet {
	position: number;
	content: string;
	purpose: 'hook' | 'context' | 'insight' | 'example' | 'cta';
	characterCount: number;
}

export function expandToThread(
	content: ContentInfo,
	synthesis: SynthesisResult,
	targetLength: number = 7
): ThreadExpansion {
	const tweets: ThreadTweet[] = [];
	const originalText = content.text;

	// Tweet 1: Hook (from synthesis)
	const hook = synthesis.playbook.steps.find(s => s.action.includes('hook'))?.action
		|| extractHook(originalText);
	tweets.push({
		position: 1,
		content: `${hook}\n\nA thread 🧵`,
		purpose: 'hook',
		characterCount: hook.length + 12
	});

	// Tweet 2: Context
	tweets.push({
		position: 2,
		content: generateContextTweet(originalText, synthesis),
		purpose: 'context',
		characterCount: 0 // Will be set
	});
	tweets[1].characterCount = tweets[1].content.length;

	// Tweets 3-N-1: Insights
	const insights = synthesis.keyInsights.slice(0, targetLength - 3);
	insights.forEach((insight, i) => {
		tweets.push({
			position: 3 + i,
			content: `${3 + i}/ ${insight}`,
			purpose: 'insight',
			characterCount: insight.length + 4
		});
	});

	// If we need more tweets, add examples
	while (tweets.length < targetLength - 1) {
		const example = synthesis.playbook.steps[tweets.length - 2]?.examples?.[0]
			|| 'Practical example of applying this insight';
		tweets.push({
			position: tweets.length + 1,
			content: `${tweets.length + 1}/ Example: ${example}`,
			purpose: 'example',
			characterCount: example.length + 15
		});
	}

	// Final tweet: CTA
	tweets.push({
		position: tweets.length + 1,
		content: generateCTATweet(content.hashtags),
		purpose: 'cta',
		characterCount: 0
	});
	tweets[tweets.length - 1].characterCount = tweets[tweets.length - 1].content.length;

	const totalChars = tweets.reduce((sum, t) => sum + t.characterCount, 0);
	const readTime = Math.ceil(totalChars / 200); // ~200 chars per minute

	return {
		tweets,
		totalLength: tweets.length,
		estimatedReadTime: `${readTime} min read`,
		engagementHooks: [
			'Thread opener creates curiosity gap',
			'Numbered format encourages reading to completion',
			'CTA drives follow/engagement'
		]
	};
}

function extractHook(text: string): string {
	const firstLine = text.split('\n')[0] || text.slice(0, 200);
	if (firstLine.length <= 250) return firstLine;
	return firstLine.slice(0, 247) + '...';
}

function generateContextTweet(originalText: string, synthesis: SynthesisResult): string {
	const context = synthesis.playbook.summary || 'Here\'s what I learned';
	return `2/ ${context}\n\nLet me break it down:`;
}

function generateCTATweet(hashtags: string[]): string {
	const tags = hashtags.slice(0, 3).map(h => `#${h}`).join(' ');
	return `If this thread was valuable:\n\n• Follow me for more insights\n• Retweet the first tweet to share\n• Drop a comment with your thoughts\n\n${tags}`;
}

// =============================================================================
// Exports
// =============================================================================

export const CreativeEngine = {
	generateImageRecommendations,
	expandToThread
};
