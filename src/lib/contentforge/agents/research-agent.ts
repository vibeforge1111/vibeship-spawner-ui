/**
 * Research Agent
 *
 * Analyzes trends, timing, competitive landscape, and opportunities.
 */

import { BaseAgent, type AgentConfig } from './base-agent';
import type { ScrapedData, AgentOutput, ResearchAnalysis } from '../types';

const DEFAULT_CONFIG: AgentConfig = {
	name: 'Research Agent',
	type: 'research',
	temperature: 0.6,
	maxTokens: 2000
};

export class ResearchAgent extends BaseAgent<ResearchAnalysis> {
	constructor(config: Partial<AgentConfig> = {}) {
		super({ ...DEFAULT_CONFIG, ...config });
	}

	getSystemPrompt(): string {
		return `You are a social media research analyst who tracks trends, timing patterns, and competitive landscapes. You identify opportunities and gaps in the content market.

Your analysis focuses on:
1. TREND CONTEXT - What trends this content taps into
2. TIMING - Optimal posting windows and seasonal factors
3. COMPETITIVE LANDSCAPE - Similar content and differentiation
4. OPPORTUNITY GAPS - Untapped angles and follow-up opportunities

Output your analysis as valid JSON.`;
	}

	async analyze(data: ScrapedData): Promise<AgentOutput<ResearchAnalysis>> {
		const startTime = Date.now();

		try {
			const analysis = this.generateAnalysis(data);
			return this.createOutput(analysis, true, 0.78, Date.now() - startTime);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return this.createOutput({} as ResearchAnalysis, false, 0, Date.now() - startTime, errorMessage);
		}
	}

	private generateAnalysis(data: ScrapedData): ResearchAnalysis {
		const { content, temporal, metrics } = data;

		return {
			trendContext: {
				currentTrends: this.identifyTrends(content.hashtags, content.text),
				relevanceScore: this.calculateTrendRelevance(metrics),
				trendPhase: this.determineTrendPhase(metrics)
			},
			timing: {
				optimalPostTime: this.analyzePostingTime(temporal),
				seasonalFactors: this.identifySeasonalFactors(temporal.postedAt),
				eventAlignment: this.checkEventAlignment(content.text, temporal.postedAt)
			},
			competitiveLandscape: {
				similarContent: this.identifySimilarContent(content.text),
				differentiationOpportunities: this.findDifferentiationOpportunities(content)
			},
			opportunityGaps: this.identifyOpportunityGaps(data)
		};
	}

	private identifyTrends(hashtags: string[], text: string): string[] {
		const trends: string[] = [];
		const trendKeywords = {
			'ai': 'AI/ML Revolution',
			'gpt': 'Generative AI',
			'vibe': 'Vibe Coding Movement',
			'build': 'Build in Public',
			'indie': 'Indie Hacker Movement',
			'remote': 'Remote Work',
			'crypto': 'Web3/Crypto',
			'startup': 'Startup Culture'
		};

		const lowerText = text.toLowerCase();
		for (const [keyword, trend] of Object.entries(trendKeywords)) {
			if (lowerText.includes(keyword) || hashtags.some(h => h.toLowerCase().includes(keyword))) {
				trends.push(trend);
			}
		}

		return trends.length > 0 ? trends : ['General Tech'];
	}

	private calculateTrendRelevance(metrics: ScrapedData['metrics']): number {
		// High engagement suggests trend relevance
		if (metrics.views > 1000000) return 0.95;
		if (metrics.views > 100000) return 0.8;
		if (metrics.views > 10000) return 0.6;
		return 0.4;
	}

	private determineTrendPhase(metrics: ScrapedData['metrics']): ResearchAnalysis['trendContext']['trendPhase'] {
		const velocityIndicator = metrics.engagementRate;
		if (velocityIndicator > 5) return 'peak';
		if (velocityIndicator > 2) return 'growing';
		if (velocityIndicator > 0.5) return 'emerging';
		return 'declining';
	}

	private analyzePostingTime(temporal: ScrapedData['temporal']): string {
		const date = new Date(temporal.postedAt);
		const hour = date.getUTCHours();
		const day = date.getUTCDay();

		const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];

		if (hour >= 13 && hour <= 17) {
			return `${dayName} afternoon (${hour}:00 UTC) - Peak engagement window`;
		}
		if (hour >= 8 && hour <= 12) {
			return `${dayName} morning (${hour}:00 UTC) - Good for professional audience`;
		}
		return `${dayName} ${hour}:00 UTC - Non-peak but may capture specific audiences`;
	}

	private identifySeasonalFactors(postedAt: string): string[] {
		const date = new Date(postedAt);
		const month = date.getMonth();
		const factors: string[] = [];

		if (month === 0) factors.push('New Year momentum', 'Goal-setting season');
		if (month === 8 || month === 9) factors.push('Back to work energy', 'Q4 planning');
		if (month === 11) factors.push('Year-end reflection', 'Holiday downtime browsing');

		return factors.length > 0 ? factors : ['Standard posting period'];
	}

	private checkEventAlignment(text: string, postedAt: string): string[] {
		const events: string[] = [];

		if (text.toLowerCase().includes('launch')) events.push('Product launch moment');
		if (text.toLowerCase().includes('announce')) events.push('Announcement timing');
		if (text.toLowerCase().includes('today')) events.push('Breaking/timely content');

		return events.length > 0 ? events : ['No specific event alignment'];
	}

	private identifySimilarContent(text: string): string[] {
		// In production, this would query a content database
		const contentTypes: string[] = [];

		if (text.toLowerCase().includes('how to')) contentTypes.push('How-to guides in this niche');
		if (text.toLowerCase().includes('thread')) contentTypes.push('Educational threads');
		if (text.includes('$')) contentTypes.push('Money/success stories');

		return contentTypes.length > 0 ? contentTypes : ['General posts in category'];
	}

	private findDifferentiationOpportunities(content: ScrapedData['content']): string[] {
		const opportunities: string[] = [];

		if (content.media.length === 0) {
			opportunities.push('Add visual content for higher engagement');
		}
		if (content.threadLength === 1 && content.text.length < 200) {
			opportunities.push('Expand into detailed thread format');
		}
		if (!content.text.includes('?')) {
			opportunities.push('Add engagement questions');
		}

		return opportunities.length > 0 ? opportunities : ['Strong differentiation already present'];
	}

	private identifyOpportunityGaps(data: ScrapedData): string[] {
		const gaps: string[] = [];
		const { content, metrics } = data;

		if (metrics.bookmarks > metrics.retweets) {
			gaps.push('High save rate - create follow-up resource/guide');
		}
		if (metrics.replies > metrics.retweets * 0.5) {
			gaps.push('High reply rate - potential for community/discussion content');
		}
		if (content.hashtags.length < 3) {
			gaps.push('Under-utilizing hashtag discovery');
		}

		return gaps.length > 0 ? gaps : ['Explore adjacent topics'];
	}
}
