/**
 * Synthesis Engine
 *
 * Combines all agent outputs into unified insights with virality scoring.
 */

import type {
	AgentOutput,
	MarketingAnalysis,
	CopywritingAnalysis,
	ResearchAnalysis,
	PsychologyAnalysis,
	SynthesisResult,
	PatternCorrelation,
	ContentPlaybook,
	AgentType
} from '../types';

export interface SynthesisInput {
	postId: string;
	marketing?: AgentOutput<MarketingAnalysis>;
	copywriting?: AgentOutput<CopywritingAnalysis>;
	research?: AgentOutput<ResearchAnalysis>;
	psychology?: AgentOutput<PsychologyAnalysis>;
}

/**
 * Synthesize all agent outputs into actionable insights.
 */
export function synthesize(input: SynthesisInput): SynthesisResult {
	const { postId, marketing, copywriting, research, psychology } = input;

	// Calculate virality score based on all factors
	const viralityScore = calculateViralityScore(input);

	// Extract key insights across all agents
	const keyInsights = extractKeyInsights(input);

	// Find pattern correlations between agents
	const patternCorrelations = findPatternCorrelations(input);

	// Generate actionable playbook
	const playbook = generatePlaybook(input, viralityScore);

	return {
		postId,
		viralityScore,
		keyInsights,
		patternCorrelations,
		playbook,
		createdAt: new Date().toISOString()
	};
}

function calculateViralityScore(input: SynthesisInput): number {
	let score = 0;
	let factors = 0;

	// Marketing factors (max 25 points)
	if (input.marketing?.success && input.marketing.data) {
		const m = input.marketing.data;
		score += m.distributionFactors.shareability * 2.5; // 0-25
		factors++;
	}

	// Copywriting factors (max 25 points)
	if (input.copywriting?.success && input.copywriting.data) {
		const c = input.copywriting.data;
		score += c.hook.effectiveness * 1.5; // 0-15
		score += c.structure.readabilityScore; // 0-10
		factors++;
	}

	// Research factors (max 25 points)
	if (input.research?.success && input.research.data) {
		const r = input.research.data;
		score += r.trendContext.relevanceScore * 25; // 0-25
		factors++;
	}

	// Psychology factors (max 25 points)
	if (input.psychology?.success && input.psychology.data) {
		const p = input.psychology.data;
		score += p.emotionalTriggers.intensity * 1.5; // 0-15
		score += p.cognitiveBiases.reduce((sum, b) => sum + b.effectiveness, 0) / Math.max(p.cognitiveBiases.length, 1); // 0-10
		factors++;
	}

	// Normalize to 0-100
	if (factors === 0) return 0;
	return Math.min(100, Math.round(score / factors * (4 / factors) * 1.5));
}

function extractKeyInsights(input: SynthesisInput): string[] {
	const insights: string[] = [];

	if (input.marketing?.success && input.marketing.data) {
		const m = input.marketing.data;
		if (m.distributionFactors.shareability >= 7) {
			insights.push(`High shareability (${m.distributionFactors.shareability}/10) - ${m.distributionFactors.reasons[0] || 'Strong viral potential'}`);
		}
		if (m.positioning.authorityLevel === 'thought_leader') {
			insights.push(`Author positioned as thought leader in ${m.positioning.niche}`);
		}
	}

	if (input.copywriting?.success && input.copywriting.data) {
		const c = input.copywriting.data;
		if (c.hook.effectiveness >= 7) {
			insights.push(`Highly effective ${c.hook.type} hook - ${c.hook.elements.join(', ')}`);
		}
		if (c.templates.length > 0 && c.templates[0].reusability >= 7) {
			insights.push(`Reusable template identified: ${c.templates[0].extracted}`);
		}
	}

	if (input.research?.success && input.research.data) {
		const r = input.research.data;
		if (r.trendContext.trendPhase === 'growing' || r.trendContext.trendPhase === 'peak') {
			insights.push(`Riding ${r.trendContext.currentTrends.join(', ')} trend (${r.trendContext.trendPhase} phase)`);
		}
		if (r.opportunityGaps.length > 0) {
			insights.push(`Opportunity: ${r.opportunityGaps[0]}`);
		}
	}

	if (input.psychology?.success && input.psychology.data) {
		const p = input.psychology.data;
		insights.push(`Primary emotional driver: ${p.emotionalTriggers.primary}`);
		if (p.cognitiveBiases.length > 0) {
			const topBias = p.cognitiveBiases.reduce((a, b) => a.effectiveness > b.effectiveness ? a : b);
			insights.push(`Leverages ${topBias.biasType} bias effectively`);
		}
	}

	return insights.slice(0, 8); // Cap at 8 key insights
}

function findPatternCorrelations(input: SynthesisInput): PatternCorrelation[] {
	const correlations: PatternCorrelation[] = [];

	// Check for hook + emotion correlation
	if (input.copywriting?.data?.hook && input.psychology?.data?.emotionalTriggers) {
		if (input.copywriting.data.hook.effectiveness >= 7 && input.psychology.data.emotionalTriggers.intensity >= 7) {
			correlations.push({
				pattern: 'Strong hook + high emotional intensity = viral combination',
				agents: ['copywriting', 'psychology'],
				confidence: 0.85,
				impact: 'high'
			});
		}
	}

	// Check for trend + shareability correlation
	if (input.research?.data?.trendContext && input.marketing?.data?.distributionFactors) {
		if (input.research.data.trendContext.trendPhase !== 'declining' && input.marketing.data.distributionFactors.shareability >= 6) {
			correlations.push({
				pattern: 'Active trend + shareable content = amplified reach',
				agents: ['research', 'marketing'],
				confidence: 0.78,
				impact: 'high'
			});
		}
	}

	// Check for authority + social proof correlation
	if (input.marketing?.data?.positioning && input.psychology?.data?.cognitiveBiases) {
		const hasSocialProof = input.psychology.data.cognitiveBiases.some(b => b.biasType === 'Social Proof');
		if (input.marketing.data.positioning.authorityLevel !== 'emerging' && hasSocialProof) {
			correlations.push({
				pattern: 'Established authority + social proof = trust multiplier',
				agents: ['marketing', 'psychology'],
				confidence: 0.82,
				impact: 'medium'
			});
		}
	}

	return correlations;
}

function generatePlaybook(input: SynthesisInput, viralityScore: number): ContentPlaybook {
	const steps: ContentPlaybook['steps'] = [];
	let stepOrder = 1;

	// Step 1: Hook strategy
	if (input.copywriting?.data?.hook) {
		steps.push({
			order: stepOrder++,
			action: `Use a ${input.copywriting.data.hook.type} hook`,
			rationale: `This hook type scored ${input.copywriting.data.hook.effectiveness}/10 effectiveness`,
			examples: input.copywriting.data.hook.elements
		});
	}

	// Step 2: Emotional angle
	if (input.psychology?.data?.emotionalTriggers) {
		steps.push({
			order: stepOrder++,
			action: `Target the ${input.psychology.data.emotionalTriggers.primary} emotion`,
			rationale: 'This was the primary driver of engagement',
			examples: input.psychology.data.emotionalTriggers.secondary
		});
	}

	// Step 3: Audience targeting
	if (input.marketing?.data?.targetAudience) {
		steps.push({
			order: stepOrder++,
			action: `Speak to ${input.marketing.data.targetAudience.psychographics.join(', ')} audience`,
			rationale: 'These psychographic traits showed highest resonance'
		});
	}

	// Step 4: Timing
	if (input.research?.data?.timing) {
		steps.push({
			order: stepOrder++,
			action: `Post during ${input.research.data.timing.optimalPostTime}`,
			rationale: 'Timing analysis suggests this window for maximum reach',
			examples: input.research.data.timing.seasonalFactors
		});
	}

	// Step 5: Template application
	if (input.copywriting?.data?.templates && input.copywriting.data.templates.length > 0) {
		const bestTemplate = input.copywriting.data.templates[0];
		steps.push({
			order: stepOrder++,
			action: `Apply the "${bestTemplate.category}" template: ${bestTemplate.extracted}`,
			rationale: `Reusability score: ${bestTemplate.reusability}/10`
		});
	}

	return {
		title: viralityScore >= 70 ? 'High-Impact Viral Playbook' :
			viralityScore >= 40 ? 'Growth-Focused Playbook' : 'Foundation Building Playbook',
		summary: `${steps.length}-step strategy based on ${Object.values(input).filter(a => a?.success).length} agent analyses`,
		steps,
		estimatedImpact: viralityScore
	};
}

export type { SynthesisInput };
