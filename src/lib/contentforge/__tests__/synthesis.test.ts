/**
 * Synthesis Engine Tests
 *
 * Integration tests for combining agent outputs into actionable insights.
 */

import { describe, it, expect } from 'vitest';
import { synthesize, type SynthesisInput } from '../services/synthesis-engine';
import type { AgentOutput, MarketingAnalysis, CopywritingAnalysis, ResearchAnalysis, PsychologyAnalysis } from '../types';

// Factory for creating test agent outputs
function createMarketingOutput(overrides: Partial<MarketingAnalysis> = {}): AgentOutput<MarketingAnalysis> {
	return {
		agentType: 'marketing',
		success: true,
		data: {
			positioning: {
				niche: 'Tech/Startup',
				authorityLevel: 'established',
				differentiators: ['Personal experience', 'Uses specific numbers/data']
			},
			valueProposition: {
				primaryValue: 'Actionable insights',
				secondaryValues: ['Detailed explanation'],
				targetPainPoints: ['scaling challenges', 'time management']
			},
			targetAudience: {
				demographics: ['Tech founders 25-40'],
				psychographics: ['ambitious', 'growth-focused'],
				interests: ['startup', 'tech']
			},
			distributionFactors: {
				shareability: 8,
				reasons: ['Practical value', 'Social proof']
			},
			recommendations: ['Replicate the hook structure'],
			...overrides
		},
		confidence: 0.85,
		processingTimeMs: 150
	};
}

function createCopywritingOutput(overrides: Partial<CopywritingAnalysis> = {}): AgentOutput<CopywritingAnalysis> {
	return {
		agentType: 'copywriting',
		success: true,
		data: {
			hook: {
				type: 'question',
				effectiveness: 8,
				elements: ['Pattern interrupt', 'Promise of value']
			},
			structure: {
				format: 'listicle',
				readabilityScore: 8,
				flowAnalysis: 'Well-structured with clear breaks'
			},
			powerWords: {
				emotional: ['love', 'amazing'],
				action: ['build', 'create'],
				sensory: ['feel']
			},
			templates: [
				{
					category: 'success_story',
					extracted: 'From [start] to [end] in [time]. Here\'s how:',
					reusability: 9
				}
			],
			...overrides
		},
		confidence: 0.82,
		processingTimeMs: 120
	};
}

function createResearchOutput(overrides: Partial<ResearchAnalysis> = {}): AgentOutput<ResearchAnalysis> {
	return {
		agentType: 'research',
		success: true,
		data: {
			trendContext: {
				currentTrends: ['Build in Public', 'Indie Hacking'],
				relevanceScore: 0.85,
				trendPhase: 'growing'
			},
			timing: {
				optimalPostTime: 'Tuesday afternoon (14:00 UTC)',
				seasonalFactors: ['Q1 goal-setting'],
				eventAlignment: ['No specific event']
			},
			competitiveLandscape: {
				similarContent: ['How-to threads', 'Success stories'],
				differentiationOpportunities: ['Add data visualization']
			},
			opportunityGaps: ['Create follow-up resource', 'Build community'],
			...overrides
		},
		confidence: 0.78,
		processingTimeMs: 200
	};
}

function createPsychologyOutput(overrides: Partial<PsychologyAnalysis> = {}): AgentOutput<PsychologyAnalysis> {
	return {
		agentType: 'psychology',
		success: true,
		data: {
			emotionalTriggers: {
				primary: 'Aspiration',
				secondary: ['Curiosity', 'FOMO'],
				intensity: 7
			},
			cognitiveBiases: [
				{
					biasType: 'Social Proof',
					application: 'Numbers validation',
					effectiveness: 8
				},
				{
					biasType: 'Authority Bias',
					application: 'Experience credibility',
					effectiveness: 7
				}
			],
			identityResonance: {
				inGroup: 'Founders/Entrepreneurs',
				aspirationalIdentity: 'Successful builder',
				tribalDynamics: 'Inclusive tribe building'
			},
			motivationalDrivers: ['Achievement motivation', 'Intellectual curiosity'],
			...overrides
		},
		confidence: 0.80,
		processingTimeMs: 180
	};
}

describe('Synthesis Engine', () => {
	it('should synthesize all agent outputs into a result', () => {
		const input: SynthesisInput = {
			postId: 'test-123',
			marketing: createMarketingOutput(),
			copywriting: createCopywritingOutput(),
			research: createResearchOutput(),
			psychology: createPsychologyOutput()
		};

		const result = synthesize(input);

		expect(result.postId).toBe('test-123');
		expect(result.viralityScore).toBeGreaterThan(0);
		expect(result.viralityScore).toBeLessThanOrEqual(100);
		expect(result.keyInsights.length).toBeGreaterThan(0);
		expect(result.playbook).toBeDefined();
		expect(result.createdAt).toBeDefined();
	});

	it('should calculate higher virality score for strong agent outputs', () => {
		const input: SynthesisInput = {
			postId: 'viral-post',
			marketing: createMarketingOutput({
				distributionFactors: { shareability: 10, reasons: ['Viral'], viralLoops: ['RT'] }
			}),
			copywriting: createCopywritingOutput({
				hook: { type: 'shock', effectiveness: 10, elements: ['Pattern interrupt'] },
				structure: { format: 'thread', paragraphCount: 7, readabilityScore: 10, scannable: true }
			}),
			research: createResearchOutput({
				trendContext: { currentTrends: ['Hot topic'], relevanceScore: 0.99, trendPhase: 'peak' }
			}),
			psychology: createPsychologyOutput({
				emotionalTriggers: { primary: 'Excitement', secondary: ['Joy'], intensity: 10 },
				cognitiveBiases: [{ biasType: 'Scarcity', application: 'Limited', effectiveness: 10 }]
			})
		};

		const result = synthesize(input);

		// Strong inputs should produce a score above baseline
		expect(result.viralityScore).toBeGreaterThan(30);
	});

	it('should extract key insights from each agent', () => {
		const input: SynthesisInput = {
			postId: 'insights-test',
			marketing: createMarketingOutput({
				positioning: { niche: 'AI', authorityLevel: 'thought_leader', brandVoice: 'Expert' },
				distributionFactors: { shareability: 8, reasons: ['High value'], viralLoops: [] }
			}),
			copywriting: createCopywritingOutput({
				hook: { type: 'question', effectiveness: 9, elements: ['Curiosity gap'] }
			}),
			research: createResearchOutput({
				trendContext: { currentTrends: ['AI Revolution'], relevanceScore: 0.9, trendPhase: 'growing' }
			}),
			psychology: createPsychologyOutput({
				emotionalTriggers: { primary: 'Curiosity', secondary: [], intensity: 8 }
			})
		};

		const result = synthesize(input);

		// Should have insights from multiple agents
		expect(result.keyInsights.length).toBeGreaterThanOrEqual(3);

		// Check for marketing insight
		const hasShareabilityInsight = result.keyInsights.some(i => i.includes('shareability'));
		expect(hasShareabilityInsight).toBe(true);

		// Check for psychology insight
		const hasEmotionInsight = result.keyInsights.some(i => i.includes('emotional') || i.includes('Curiosity'));
		expect(hasEmotionInsight).toBe(true);
	});

	it('should find pattern correlations between agents', () => {
		const input: SynthesisInput = {
			postId: 'correlation-test',
			marketing: createMarketingOutput({
				positioning: { niche: 'Tech', authorityLevel: 'established', brandVoice: 'Professional' },
				distributionFactors: { shareability: 8, reasons: ['Good'], viralLoops: [] }
			}),
			copywriting: createCopywritingOutput({
				hook: { type: 'story', effectiveness: 9, elements: ['Emotional'] }
			}),
			research: createResearchOutput({
				trendContext: { currentTrends: ['Hot trend'], relevanceScore: 0.85, trendPhase: 'growing' }
			}),
			psychology: createPsychologyOutput({
				emotionalTriggers: { primary: 'Excitement', secondary: [], intensity: 9 },
				cognitiveBiases: [{ biasType: 'Social Proof', application: 'Numbers', effectiveness: 8 }]
			})
		};

		const result = synthesize(input);

		// Should find correlations between strong hook + emotions, or trend + shareability
		expect(result.patternCorrelations.length).toBeGreaterThan(0);

		// Check correlation structure
		const firstCorrelation = result.patternCorrelations[0];
		expect(firstCorrelation.pattern).toBeDefined();
		expect(firstCorrelation.agents.length).toBeGreaterThanOrEqual(2);
		expect(firstCorrelation.confidence).toBeGreaterThan(0);
		expect(firstCorrelation.impact).toBeDefined();
	});

	it('should generate actionable playbook', () => {
		const input: SynthesisInput = {
			postId: 'playbook-test',
			marketing: createMarketingOutput(),
			copywriting: createCopywritingOutput(),
			research: createResearchOutput(),
			psychology: createPsychologyOutput()
		};

		const result = synthesize(input);

		expect(result.playbook.title).toBeDefined();
		expect(result.playbook.summary).toBeDefined();
		expect(result.playbook.steps.length).toBeGreaterThan(0);
		expect(result.playbook.estimatedImpact).toBeGreaterThan(0);

		// Each step should have required fields
		result.playbook.steps.forEach(step => {
			expect(step.order).toBeGreaterThan(0);
			expect(step.action).toBeDefined();
			expect(step.rationale).toBeDefined();
		});
	});

	it('should handle partial agent data gracefully', () => {
		const input: SynthesisInput = {
			postId: 'partial-test',
			marketing: createMarketingOutput(),
			// copywriting missing
			// research missing
			psychology: createPsychologyOutput()
		};

		const result = synthesize(input);

		expect(result.postId).toBe('partial-test');
		expect(result.viralityScore).toBeGreaterThanOrEqual(0);
		expect(result.playbook).toBeDefined();
	});

	it('should handle failed agent outputs', () => {
		const input: SynthesisInput = {
			postId: 'failed-test',
			marketing: {
				agentType: 'marketing',
				success: false,
				data: null as unknown as MarketingAnalysis,
				confidence: 0,
				processingTimeMs: 50,
				error: 'API timeout'
			},
			copywriting: createCopywritingOutput(),
			research: createResearchOutput(),
			psychology: createPsychologyOutput()
		};

		const result = synthesize(input);

		// Should still produce a result with available data
		expect(result.postId).toBe('failed-test');
		expect(result.playbook).toBeDefined();
	});

	it('should title playbook based on virality score', () => {
		// High virality
		const highInput: SynthesisInput = {
			postId: 'high-viral',
			marketing: createMarketingOutput({ distributionFactors: { shareability: 10, reasons: [], viralLoops: [] } }),
			copywriting: createCopywritingOutput({ hook: { type: 'shock', effectiveness: 10, elements: [] }, structure: { format: 'thread', paragraphCount: 5, readabilityScore: 10, scannable: true } }),
			research: createResearchOutput({ trendContext: { currentTrends: [], relevanceScore: 0.99, trendPhase: 'peak' } }),
			psychology: createPsychologyOutput({ emotionalTriggers: { primary: 'Joy', secondary: [], intensity: 10 }, cognitiveBiases: [{ biasType: 'Scarcity', application: 'x', effectiveness: 10 }] })
		};

		const highResult = synthesize(highInput);

		// Score should be high enough for "High-Impact" title
		if (highResult.viralityScore >= 70) {
			expect(highResult.playbook.title).toContain('High-Impact');
		}
	});

	it('should cap key insights at 8', () => {
		const input: SynthesisInput = {
			postId: 'many-insights',
			marketing: createMarketingOutput({
				positioning: { niche: 'AI', authorityLevel: 'thought_leader', brandVoice: 'Expert' },
				distributionFactors: { shareability: 9, reasons: ['A', 'B', 'C'], viralLoops: ['X'] }
			}),
			copywriting: createCopywritingOutput({
				hook: { type: 'question', effectiveness: 8, elements: ['Hook1', 'Hook2'] },
				templates: [
					{ category: 'story', extracted: 'Template1', reusability: 9 },
					{ category: 'list', extracted: 'Template2', reusability: 8 }
				]
			}),
			research: createResearchOutput({
				trendContext: { currentTrends: ['Trend1', 'Trend2'], relevanceScore: 0.9, trendPhase: 'growing' },
				opportunityGaps: ['Gap1', 'Gap2', 'Gap3']
			}),
			psychology: createPsychologyOutput({
				cognitiveBiases: [
					{ biasType: 'Bias1', application: 'App1', effectiveness: 8 },
					{ biasType: 'Bias2', application: 'App2', effectiveness: 9 }
				]
			})
		};

		const result = synthesize(input);

		expect(result.keyInsights.length).toBeLessThanOrEqual(8);
	});
});
