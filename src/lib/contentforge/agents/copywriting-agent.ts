/**
 * Copywriting Agent
 *
 * Deconstructs hooks, structure, power words, and templates.
 */

import { BaseAgent, type AgentConfig } from './base-agent';
import type { ScrapedData, AgentOutput, CopywritingAnalysis } from '../types';

const DEFAULT_CONFIG: AgentConfig = {
	name: 'Copywriting Agent',
	type: 'copywriting',
	temperature: 0.7,
	maxTokens: 2000
};

export class CopywritingAgent extends BaseAgent<CopywritingAnalysis> {
	constructor(config: Partial<AgentConfig> = {}) {
		super({ ...DEFAULT_CONFIG, ...config });
	}

	getSystemPrompt(): string {
		return `You are a master copywriter who has written viral content for major brands and influencers. You analyze the craft of writing that captures attention and drives action.

Your analysis focuses on:
1. HOOK - The opening that stops the scroll
2. STRUCTURE - How the content is organized for maximum impact
3. POWER WORDS - Emotional, action, and sensory language
4. TEMPLATES - Reusable patterns that can be adapted

You identify specific techniques, not vague observations.

Output your analysis as valid JSON.`;
	}

	async analyze(data: ScrapedData): Promise<AgentOutput<CopywritingAnalysis>> {
		const startTime = Date.now();

		try {
			const analysis = this.generateAnalysis(data);
			return this.createOutput(analysis, true, 0.82, Date.now() - startTime);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return this.createOutput({} as CopywritingAnalysis, false, 0, Date.now() - startTime, errorMessage);
		}
	}

	private generateAnalysis(data: ScrapedData): CopywritingAnalysis {
		const { content } = data;
		const text = content.text;
		const firstLine = text.split('\n')[0] || text.slice(0, 100);

		return {
			hook: {
				type: this.identifyHookType(firstLine),
				effectiveness: this.scoreHookEffectiveness(firstLine, data.metrics),
				elements: this.extractHookElements(firstLine)
			},
			structure: {
				format: this.identifyFormat(content),
				readabilityScore: this.calculateReadability(text),
				flowAnalysis: this.analyzeFlow(text)
			},
			powerWords: {
				emotional: this.findEmotionalWords(text),
				action: this.findActionWords(text),
				sensory: this.findSensoryWords(text)
			},
			templates: this.extractTemplates(text)
		};
	}

	private identifyHookType(firstLine: string): CopywritingAnalysis['hook']['type'] {
		if (firstLine.includes('?')) return 'question';
		if (/^\d/.test(firstLine) || firstLine.includes('%')) return 'statistic';
		if (firstLine.toLowerCase().includes('i ') && firstLine.toLowerCase().includes('when')) return 'story';
		if (firstLine.includes('not') || firstLine.includes("don't") || firstLine.includes('wrong')) return 'contrarian';
		return 'statement';
	}

	private scoreHookEffectiveness(hook: string, metrics: ScrapedData['metrics']): number {
		let score = 5;
		if (hook.length < 50) score += 1; // Concise
		if (hook.includes('?')) score += 1; // Question
		if (/\d/.test(hook)) score += 1; // Numbers
		if (metrics.engagementRate > 2) score += 2; // High engagement validates
		return Math.min(10, score);
	}

	private extractHookElements(hook: string): string[] {
		const elements: string[] = [];
		if (hook.includes('?')) elements.push('Question format');
		if (/\d/.test(hook)) elements.push('Specific numbers');
		if (hook.includes('you')) elements.push('Direct address');
		if (hook.length < 50) elements.push('Brevity');
		if (hook.includes('!')) elements.push('Emphasis');
		return elements.length > 0 ? elements : ['Standard opening'];
	}

	private identifyFormat(content: ScrapedData['content']): CopywritingAnalysis['structure']['format'] {
		if (content.threadLength > 1) return 'thread';
		if (content.text.includes('1.') || content.text.includes('•')) return 'listicle';
		if (content.text.toLowerCase().includes('once') || content.text.toLowerCase().includes('when i')) return 'story';
		return 'single';
	}

	private calculateReadability(text: string): number {
		const words = text.split(/\s+/).length;
		const sentences = text.split(/[.!?]+/).length;
		const avgWordsPerSentence = words / Math.max(sentences, 1);
		// Simpler = higher score
		return Math.max(1, Math.min(10, 15 - avgWordsPerSentence));
	}

	private analyzeFlow(text: string): string {
		const paragraphs = text.split('\n\n').length;
		if (paragraphs > 3) return 'Well-structured with clear breaks';
		if (text.includes('\n')) return 'Uses line breaks for rhythm';
		return 'Dense single block';
	}

	private findEmotionalWords(text: string): string[] {
		const emotionalPatterns = ['love', 'hate', 'fear', 'excited', 'amazing', 'incredible', 'terrifying', 'beautiful', 'shocking'];
		return emotionalPatterns.filter(word => text.toLowerCase().includes(word));
	}

	private findActionWords(text: string): string[] {
		const actionPatterns = ['build', 'create', 'launch', 'start', 'grow', 'scale', 'learn', 'master', 'achieve', 'transform'];
		return actionPatterns.filter(word => text.toLowerCase().includes(word));
	}

	private findSensoryWords(text: string): string[] {
		const sensoryPatterns = ['feel', 'see', 'hear', 'touch', 'taste', 'smooth', 'sharp', 'bright', 'loud', 'quiet'];
		return sensoryPatterns.filter(word => text.toLowerCase().includes(word));
	}

	private extractTemplates(text: string): CopywritingAnalysis['templates'] {
		const templates: CopywritingAnalysis['templates'] = [];

		// Pattern: "I did X. Here's what happened:"
		if (text.toLowerCase().includes("here's what")) {
			templates.push({
				extracted: '[Action]. Here\'s what happened: [Results]',
				category: 'Experience Share',
				reusability: 9
			});
		}

		// Pattern: "X things I learned from Y"
		if (/\d+\s+(things|lessons|tips)/.test(text.toLowerCase())) {
			templates.push({
				extracted: '[Number] [things/lessons/tips] I learned from [experience]',
				category: 'Listicle',
				reusability: 8
			});
		}

		// Pattern: Question opener
		if (text.startsWith('What') || text.startsWith('How') || text.startsWith('Why')) {
			templates.push({
				extracted: '[Question]? [Answer with insight]',
				category: 'Q&A Format',
				reusability: 7
			});
		}

		return templates.length > 0 ? templates : [{
			extracted: '[Hook] + [Value] + [CTA]',
			category: 'Standard',
			reusability: 5
		}];
	}
}
