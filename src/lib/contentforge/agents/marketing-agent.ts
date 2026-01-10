/**
 * Marketing Agent
 *
 * Analyzes positioning, market fit, and distribution strategy.
 */

import { BaseAgent, type AgentConfig } from './base-agent';
import type { ScrapedData, AgentOutput, MarketingAnalysis } from '../types';

const DEFAULT_CONFIG: AgentConfig = {
	name: 'Marketing Agent',
	type: 'marketing',
	temperature: 0.7,
	maxTokens: 2000
};

export class MarketingAgent extends BaseAgent<MarketingAnalysis> {
	constructor(config: Partial<AgentConfig> = {}) {
		super({ ...DEFAULT_CONFIG, ...config });
	}

	getSystemPrompt(): string {
		return `You are an expert marketing strategist who has helped build multiple billion-dollar personal brands on social media. You analyze viral content to understand what makes it resonate with audiences.

Your analysis focuses on:
1. POSITIONING - How the content positions the author as an authority
2. VALUE PROPOSITION - What value is being delivered to the audience
3. TARGET AUDIENCE - Who this content resonates with and why
4. DISTRIBUTION FACTORS - What makes this content shareable
5. BRAND BUILDING - How this contributes to personal brand equity
6. CALL-TO-ACTION - Explicit or implicit asks
7. TREND ALIGNMENT - Connection to current market conversations

You provide actionable insights, not generic observations. Every analysis should help someone replicate the success.

Output your analysis as valid JSON matching this structure:
{
  "positioning": {
    "authorityLevel": "emerging" | "established" | "thought_leader",
    "niche": "string",
    "differentiators": ["string"]
  },
  "valueProposition": {
    "primaryValue": "string",
    "secondaryValues": ["string"],
    "targetPainPoints": ["string"]
  },
  "targetAudience": {
    "demographics": ["string"],
    "psychographics": ["string"],
    "interests": ["string"]
  },
  "distributionFactors": {
    "shareability": 0-10,
    "reasons": ["string"]
  },
  "recommendations": ["string"]
}`;
	}

	async analyze(data: ScrapedData): Promise<AgentOutput<MarketingAnalysis>> {
		const startTime = Date.now();

		try {
			// In production, this would call an LLM API
			// For now, return a structured analysis based on metrics
			const analysis = this.generateAnalysis(data);

			return this.createOutput(
				analysis,
				true,
				0.85,
				Date.now() - startTime
			);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return this.createOutput(
				{} as MarketingAnalysis,
				false,
				0,
				Date.now() - startTime,
				errorMessage
			);
		}
	}

	private generateAnalysis(data: ScrapedData): MarketingAnalysis {
		const { author, content, metrics } = data;

		// Determine authority level based on followers and engagement
		const authorityLevel =
			author.followers > 100000 ? 'thought_leader' :
			author.followers > 10000 ? 'established' : 'emerging';

		// Calculate shareability based on engagement patterns
		const shareability = Math.min(10, Math.round(
			(metrics.retweets / Math.max(metrics.likes, 1)) * 20 +
			(metrics.bookmarks / Math.max(metrics.likes, 1)) * 15 +
			(metrics.engagementRate / 2)
		));

		return {
			positioning: {
				authorityLevel,
				niche: this.inferNiche(content.hashtags, content.text),
				differentiators: this.extractDifferentiators(content.text)
			},
			valueProposition: {
				primaryValue: this.extractPrimaryValue(content.text),
				secondaryValues: this.extractSecondaryValues(content.text),
				targetPainPoints: this.extractPainPoints(content.text)
			},
			targetAudience: {
				demographics: this.inferDemographics(content.hashtags),
				psychographics: this.inferPsychographics(content.text),
				interests: content.hashtags.slice(0, 5)
			},
			distributionFactors: {
				shareability,
				reasons: this.analyzeShareability(content.text, metrics)
			},
			recommendations: this.generateRecommendations(data)
		};
	}

	private inferNiche(hashtags: string[], text: string): string {
		const techKeywords = ['code', 'dev', 'programming', 'ai', 'tech'];
		const businessKeywords = ['startup', 'entrepreneur', 'business', 'founder'];

		const lowerText = text.toLowerCase();
		const lowerTags = hashtags.map(t => t.toLowerCase());

		if (techKeywords.some(k => lowerText.includes(k) || lowerTags.some(t => t.includes(k)))) {
			return 'Tech/Developer';
		}
		if (businessKeywords.some(k => lowerText.includes(k) || lowerTags.some(t => t.includes(k)))) {
			return 'Business/Entrepreneurship';
		}
		return 'General/Lifestyle';
	}

	private extractDifferentiators(text: string): string[] {
		const differentiators: string[] = [];
		if (text.includes('I ') || text.includes("I've")) differentiators.push('Personal experience');
		if (/\d+/.test(text)) differentiators.push('Uses specific numbers/data');
		if (text.includes('?')) differentiators.push('Engages with questions');
		return differentiators.length > 0 ? differentiators : ['Unique voice'];
	}

	private extractPrimaryValue(text: string): string {
		if (text.toLowerCase().includes('how to')) return 'Educational/How-to content';
		if (text.toLowerCase().includes('secret') || text.toLowerCase().includes('reveal')) return 'Insider knowledge';
		if (text.includes('!')) return 'Motivation/Inspiration';
		return 'Information sharing';
	}

	private extractSecondaryValues(text: string): string[] {
		const values: string[] = [];
		if (text.length > 200) values.push('Detailed explanation');
		if (text.includes('@')) values.push('Community engagement');
		return values.length > 0 ? values : ['Entertainment'];
	}

	private extractPainPoints(text: string): string[] {
		const painPoints: string[] = [];
		if (text.toLowerCase().includes('struggle')) painPoints.push('Overcoming challenges');
		if (text.toLowerCase().includes('mistake')) painPoints.push('Avoiding errors');
		if (text.toLowerCase().includes('time')) painPoints.push('Time efficiency');
		return painPoints.length > 0 ? painPoints : ['General improvement'];
	}

	private inferDemographics(hashtags: string[]): string[] {
		return ['18-35 age range', 'Tech-savvy', 'English-speaking'];
	}

	private inferPsychographics(text: string): string[] {
		const traits: string[] = [];
		if (text.toLowerCase().includes('build')) traits.push('Builder mindset');
		if (text.toLowerCase().includes('learn')) traits.push('Growth-oriented');
		if (text.toLowerCase().includes('success')) traits.push('Achievement-driven');
		return traits.length > 0 ? traits : ['Curious', 'Engaged'];
	}

	private analyzeShareability(text: string, metrics: ScrapedData['metrics']): string[] {
		const reasons: string[] = [];
		if (metrics.retweets > metrics.likes * 0.1) reasons.push('High retweet ratio indicates strong shareability');
		if (metrics.bookmarks > metrics.likes * 0.1) reasons.push('High bookmark rate shows save-worthy content');
		if (metrics.replies > 500) reasons.push('High reply count indicates discussion-worthy');
		return reasons.length > 0 ? reasons : ['Moderate shareability'];
	}

	private generateRecommendations(data: ScrapedData): string[] {
		const recs: string[] = [];
		const { metrics, content } = data;

		if (metrics.engagementRate > 3) {
			recs.push('Replicate the hook structure in future posts');
		}
		if (content.media.length > 0) {
			recs.push('Continue using visual content to boost engagement');
		}
		if (content.threadLength === 1) {
			recs.push('Consider expanding into a thread for deeper engagement');
		}

		return recs.length > 0 ? recs : ['Study the timing and replicate'];
	}
}
