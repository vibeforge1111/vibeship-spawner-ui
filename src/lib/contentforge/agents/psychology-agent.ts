/**
 * Psychology Agent
 *
 * Identifies emotional triggers, cognitive biases, and identity resonance.
 */

import { BaseAgent, type AgentConfig } from './base-agent';
import type { ScrapedData, AgentOutput, PsychologyAnalysis } from '../types';

const DEFAULT_CONFIG: AgentConfig = {
	name: 'Psychology Agent',
	type: 'psychology',
	temperature: 0.7,
	maxTokens: 2000
};

export class PsychologyAgent extends BaseAgent<PsychologyAnalysis> {
	constructor(config: Partial<AgentConfig> = {}) {
		super({ ...DEFAULT_CONFIG, ...config });
	}

	getSystemPrompt(): string {
		return `You are a behavioral psychologist specializing in social media engagement and viral content. You understand the deep psychological patterns that make content resonate.

Your analysis focuses on:
1. EMOTIONAL TRIGGERS - What emotions drive engagement
2. COGNITIVE BIASES - Which biases the content leverages
3. IDENTITY RESONANCE - How content connects to audience identity
4. MOTIVATIONAL DRIVERS - What motivates sharing and engagement

You identify the unconscious patterns that make people engage.

Output your analysis as valid JSON.`;
	}

	async analyze(data: ScrapedData): Promise<AgentOutput<PsychologyAnalysis>> {
		const startTime = Date.now();

		try {
			const analysis = this.generateAnalysis(data);
			return this.createOutput(analysis, true, 0.80, Date.now() - startTime);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			return this.createOutput({} as PsychologyAnalysis, false, 0, Date.now() - startTime, errorMessage);
		}
	}

	private generateAnalysis(data: ScrapedData): PsychologyAnalysis {
		const { content, metrics } = data;
		const text = content.text;

		return {
			emotionalTriggers: {
				primary: this.identifyPrimaryEmotion(text, metrics),
				secondary: this.identifySecondaryEmotions(text),
				intensity: this.calculateEmotionalIntensity(text, metrics)
			},
			cognitiveBiases: this.identifyCognitiveBiases(text),
			identityResonance: {
				inGroup: this.identifyInGroup(text, content.hashtags),
				aspirationalIdentity: this.identifyAspirations(text),
				tribalDynamics: this.analyzeTribalDynamics(text)
			},
			motivationalDrivers: this.identifyMotivationalDrivers(text, metrics)
		};
	}

	private identifyPrimaryEmotion(text: string, metrics: ScrapedData['metrics']): string {
		const lowerText = text.toLowerCase();

		// High bookmark = valuable/FOMO
		if (metrics.bookmarks > metrics.likes * 0.15) {
			return 'FOMO / Fear of missing valuable information';
		}

		// Emotion keywords
		if (lowerText.includes('amazing') || lowerText.includes('incredible')) return 'Awe/Wonder';
		if (lowerText.includes('struggle') || lowerText.includes('hard')) return 'Empathy/Relatability';
		if (lowerText.includes('secret') || lowerText.includes('reveal')) return 'Curiosity';
		if (lowerText.includes('mistake') || lowerText.includes('wrong')) return 'Fear of failure';
		if (lowerText.includes('success') || lowerText.includes('won')) return 'Aspiration/Hope';

		// High engagement general
		if (metrics.engagementRate > 3) return 'Strong emotional resonance';

		return 'Interest/Curiosity';
	}

	private identifySecondaryEmotions(text: string): string[] {
		const emotions: string[] = [];
		const lowerText = text.toLowerCase();

		const emotionMap: Record<string, string> = {
			'happy': 'Joy',
			'excited': 'Excitement',
			'angry': 'Anger/Frustration',
			'sad': 'Sadness',
			'surprised': 'Surprise',
			'inspired': 'Inspiration',
			'motivated': 'Motivation',
			'grateful': 'Gratitude',
			'proud': 'Pride'
		};

		for (const [keyword, emotion] of Object.entries(emotionMap)) {
			if (lowerText.includes(keyword)) {
				emotions.push(emotion);
			}
		}

		return emotions.length > 0 ? emotions : ['Mild interest'];
	}

	private calculateEmotionalIntensity(text: string, metrics: ScrapedData['metrics']): number {
		let intensity = 5;

		// Exclamation points increase intensity
		const exclamations = (text.match(/!/g) || []).length;
		intensity += Math.min(exclamations, 3);

		// ALL CAPS words
		const capsWords = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
		intensity += Math.min(capsWords, 2);

		// High engagement validates emotional impact
		if (metrics.engagementRate > 3) intensity += 1;

		return Math.min(10, intensity);
	}

	private identifyCognitiveBiases(text: string): PsychologyAnalysis['cognitiveBiases'] {
		const biases: PsychologyAnalysis['cognitiveBiases'] = [];
		const lowerText = text.toLowerCase();

		// Social Proof
		if (/\d+k|\d+,\d+|\d+ people/.test(text) || lowerText.includes('everyone')) {
			biases.push({
				biasType: 'Social Proof',
				application: 'Using numbers/popularity to validate',
				effectiveness: 8
			});
		}

		// Authority Bias
		if (lowerText.includes('expert') || lowerText.includes('years') || lowerText.includes('ceo') || lowerText.includes('founder')) {
			biases.push({
				biasType: 'Authority Bias',
				application: 'Establishing credibility through credentials',
				effectiveness: 7
			});
		}

		// Scarcity
		if (lowerText.includes('only') || lowerText.includes('limited') || lowerText.includes('exclusive')) {
			biases.push({
				biasType: 'Scarcity',
				application: 'Creating urgency through limited availability',
				effectiveness: 9
			});
		}

		// Loss Aversion
		if (lowerText.includes('miss') || lowerText.includes('lose') || lowerText.includes('mistake')) {
			biases.push({
				biasType: 'Loss Aversion',
				application: 'Highlighting potential losses',
				effectiveness: 8
			});
		}

		// Curiosity Gap
		if (text.includes('...') || lowerText.includes("here's") || lowerText.includes('secret')) {
			biases.push({
				biasType: 'Curiosity Gap',
				application: 'Creating information gap to drive engagement',
				effectiveness: 7
			});
		}

		return biases.length > 0 ? biases : [{
			biasType: 'Mere Exposure',
			application: 'Familiarity through consistent presence',
			effectiveness: 5
		}];
	}

	private identifyInGroup(text: string, hashtags: string[]): string {
		const lowerText = text.toLowerCase();
		const lowerTags = hashtags.map(h => h.toLowerCase());

		if (lowerText.includes('dev') || lowerTags.some(t => t.includes('dev'))) return 'Developers/Engineers';
		if (lowerText.includes('founder') || lowerTags.some(t => t.includes('startup'))) return 'Founders/Entrepreneurs';
		if (lowerText.includes('creator') || lowerTags.some(t => t.includes('creator'))) return 'Content Creators';
		if (lowerText.includes('indie') || lowerTags.some(t => t.includes('indie'))) return 'Indie Hackers';

		return 'Tech-forward professionals';
	}

	private identifyAspirations(text: string): string {
		const lowerText = text.toLowerCase();

		if (lowerText.includes('million') || lowerText.includes('rich')) return 'Financial freedom';
		if (lowerText.includes('freedom') || lowerText.includes('quit')) return 'Lifestyle independence';
		if (lowerText.includes('famous') || lowerText.includes('followers')) return 'Recognition/Fame';
		if (lowerText.includes('master') || lowerText.includes('expert')) return 'Expertise/Mastery';
		if (lowerText.includes('build') || lowerText.includes('create')) return 'Creator/Builder identity';

		return 'Professional growth';
	}

	private analyzeTribalDynamics(text: string): string {
		const lowerText = text.toLowerCase();

		if (lowerText.includes('we ') || lowerText.includes("we're")) return 'Inclusive tribe building';
		if (lowerText.includes('they ') || lowerText.includes('them')) return 'Us vs them framing';
		if (lowerText.includes('join') || lowerText.includes('together')) return 'Community invitation';

		return 'Individual to audience connection';
	}

	private identifyMotivationalDrivers(text: string, metrics: ScrapedData['metrics']): string[] {
		const drivers: string[] = [];
		const lowerText = text.toLowerCase();

		// Achievement
		if (lowerText.includes('achieve') || lowerText.includes('success') || lowerText.includes('goal')) {
			drivers.push('Achievement motivation');
		}

		// Belonging
		if (lowerText.includes('community') || lowerText.includes('together') || lowerText.includes('join')) {
			drivers.push('Need for belonging');
		}

		// Learning
		if (lowerText.includes('learn') || lowerText.includes('discover') || lowerText.includes('understand')) {
			drivers.push('Intellectual curiosity');
		}

		// Status
		if (metrics.retweets > metrics.likes * 0.2) {
			drivers.push('Status signaling (high retweet = people want to associate)');
		}

		return drivers.length > 0 ? drivers : ['General interest/entertainment'];
	}
}
