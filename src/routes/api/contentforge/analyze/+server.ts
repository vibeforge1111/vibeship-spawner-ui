/**
 * ContentForge Analysis API
 *
 * POST /api/contentforge/analyze
 * Analyzes a post URL or provided content through all agents.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createOrchestrator } from '$lib/contentforge/services/orchestrator';
import { synthesize } from '$lib/contentforge/services/synthesis-engine';
import { generateImageRecommendations, expandToThread } from '$lib/contentforge/services/creative-engine';
import { MarketingAgent } from '$lib/contentforge/agents/marketing-agent';
import { CopywritingAgent } from '$lib/contentforge/agents/copywriting-agent';
import { ResearchAgent } from '$lib/contentforge/agents/research-agent';
import { PsychologyAgent } from '$lib/contentforge/agents/psychology-agent';
import type { ScrapedData } from '$lib/contentforge/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		// Either accept scraped data directly or a URL to scrape
		let scrapedData: ScrapedData;

		if (body.scrapedData) {
			scrapedData = body.scrapedData;
		} else if (body.demo) {
			// Demo mode - use sample data
			const demoText = typeof body.demo === 'string' ? body.demo : (body.text || undefined);
			scrapedData = createDemoData(demoText);
		} else {
			return json({ error: 'Provide scrapedData or demo: true' }, { status: 400 });
		}

		// Validate content.text is a string
		if (typeof scrapedData.content?.text !== 'string') {
			console.error('Invalid content.text:', scrapedData.content);
			return json({ error: 'content.text must be a string' }, { status: 400 });
		}

		// Create orchestrator and register agents
		const orchestrator = createOrchestrator();
		orchestrator.registerAgent(new MarketingAgent());
		orchestrator.registerAgent(new CopywritingAgent());
		orchestrator.registerAgent(new ResearchAgent());
		orchestrator.registerAgent(new PsychologyAgent());

		// Run all agents
		const orchestratorResult = await orchestrator.execute(scrapedData, 'all');

		// Synthesize results
		const synthesis = synthesize({
			postId: scrapedData.postId,
			marketing: orchestratorResult.results.marketing,
			copywriting: orchestratorResult.results.copywriting,
			research: orchestratorResult.results.research,
			psychology: orchestratorResult.results.psychology
		});

		// Generate creative outputs
		const contentInfo = {
			text: scrapedData.content.text,
			hashtags: scrapedData.content.hashtags || [],
			mentions: scrapedData.content.mentions || [],
			media: scrapedData.content.media || [],
			threadLength: scrapedData.content.threadLength || 1
		};
		const imageRecommendations = generateImageRecommendations(synthesis, contentInfo);
		const threadExpansion = expandToThread(contentInfo, synthesis, 7);

		return json({
			success: true,
			data: {
				postId: scrapedData.postId,
				orchestrator: {
					success: orchestratorResult.success,
					processingTimeMs: orchestratorResult.totalProcessingTimeMs,
					agentResults: {
						marketing: orchestratorResult.results.marketing,
						copywriting: orchestratorResult.results.copywriting,
						research: orchestratorResult.results.research,
						psychology: orchestratorResult.results.psychology
					}
				},
				synthesis: {
					viralityScore: synthesis.viralityScore,
					keyInsights: synthesis.keyInsights,
					patternCorrelations: synthesis.patternCorrelations,
					playbook: synthesis.playbook
				},
				creative: {
					imageRecommendations,
					threadExpansion
				}
			}
		});
	} catch (error) {
		console.error('[ContentForge API Error]', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Analysis failed' },
			{ status: 500 }
		);
	}
};

function createDemoData(text?: string): ScrapedData {
	const demoText = text || `Here's my secret to building a $1M ARR startup in 12 months:

1. Ship fast, iterate faster
2. Talk to users every single day
3. Focus on one metric that matters
4. Build in public - your journey is your marketing

The hardest part? Staying consistent when nobody's watching.

But that's exactly when you build the foundation for success.

Thread 🧵`;

	return {
		postId: 'demo-' + Date.now(),
		url: 'https://x.com/demo/status/123456789',
		author: {
			username: 'viralcreator',
			displayName: 'Viral Content Creator',
			followers: 125000,
			verified: true
		},
		content: {
			text: demoText,
			hashtags: ['startup', 'buildinpublic', 'entrepreneurship'],
			mentions: [],
			media: [],
			threadLength: 1
		},
		metrics: {
			likes: 15420,
			retweets: 4230,
			replies: 890,
			bookmarks: 3200,
			views: 850000,
			engagementRate: 2.8
		},
		temporal: {
			postedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
			scrapedAt: new Date().toISOString()
		}
	};
}
