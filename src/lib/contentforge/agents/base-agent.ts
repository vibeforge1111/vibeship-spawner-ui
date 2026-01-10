/**
 * Base Agent Interface
 *
 * Abstract base class for all ContentForge analysis agents.
 * Following SvelteKit patterns - no global state, request-scoped.
 */

import type { ScrapedData, AgentOutput, AgentType } from '../types';

export interface AgentConfig {
	name: string;
	type: AgentType;
	model?: string;
	temperature?: number;
	maxTokens?: number;
}

export abstract class BaseAgent<TOutput> {
	protected config: AgentConfig;

	constructor(config: AgentConfig) {
		this.config = config;
	}

	/**
	 * Analyze scraped content and return structured output.
	 * Must be implemented by each specialized agent.
	 */
	abstract analyze(data: ScrapedData): Promise<AgentOutput<TOutput>>;

	/**
	 * Get the system prompt for this agent.
	 * Each agent defines its own expertise and analysis focus.
	 */
	abstract getSystemPrompt(): string;

	/**
	 * Build the user prompt from scraped data.
	 * Formats the content for analysis.
	 */
	protected buildUserPrompt(data: ScrapedData): string {
		return `
Analyze the following viral content:

**Post Text:**
${data.content.text}

**Author:** @${data.author.username} (${data.author.followers.toLocaleString()} followers)
**Verified:** ${data.author.verified ? 'Yes' : 'No'}

**Engagement Metrics:**
- Likes: ${data.metrics.likes.toLocaleString()}
- Retweets: ${data.metrics.retweets.toLocaleString()}
- Quotes: ${data.metrics.quotes.toLocaleString()}
- Replies: ${data.metrics.replies.toLocaleString()}
- Bookmarks: ${data.metrics.bookmarks.toLocaleString()}
- Views: ${data.metrics.views.toLocaleString()}
- Engagement Rate: ${data.metrics.engagementRate.toFixed(2)}%

**Timing:**
- Posted: ${data.temporal.postedAt}
- Hours since post: ${data.temporal.hoursSincePost}
- Velocity: ${data.temporal.engagementVelocity}

**Hashtags:** ${data.content.hashtags.join(', ') || 'None'}
**Media:** ${data.content.media.length} item(s)
**Thread Length:** ${data.content.threadLength}

Provide your specialized analysis.
`.trim();
	}

	/**
	 * Wrap the result in AgentOutput format.
	 */
	protected createOutput(
		data: TOutput,
		success: boolean,
		confidence: number,
		processingTimeMs: number,
		error?: string
	): AgentOutput<TOutput> {
		return {
			agentType: this.config.type,
			success,
			error,
			data,
			confidence,
			processingTimeMs
		};
	}

	/**
	 * Get agent configuration.
	 */
	getConfig(): AgentConfig {
		return { ...this.config };
	}
}
