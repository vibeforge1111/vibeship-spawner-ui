/**
 * Mind Learning Intelligence Service
 *
 * Orchestrates multiple H70 skill-powered agents to collaboratively analyze
 * accumulated Mind Learning data and generate cross-agent insights.
 *
 * Agents:
 * 1. Marketing Agent (viral-marketing) - STEPPS analysis, viral potential patterns
 * 2. Copywriting Agent (copywriting) - PAS/AIDA effectiveness, hook analysis
 * 3. Viral Hooks Agent (viral-hooks) - Hook formula performance, curiosity gaps
 * 4. Content Strategy Agent (content-strategy) - Distribution patterns, platform fit
 * 5. Psychology Agent (persuasion-psychology) - Emotional triggers, identity resonance
 * 6. Research Agent (audience-psychology) - Trend alignment, audience fit
 * 7. Algorithm Agent (platform-algorithms) - Platform-specific optimizations
 * 8. Visual Agent (narrative-craft) - Visual/narrative impact analysis
 *
 * Each agent analyzes data from their expertise and contributes to:
 * - Pattern correlations within their domain
 * - Cross-domain insights (shared with other agents)
 * - Recommendations for improvement
 * - Gap identification (what we're NOT tracking but should)
 * - System improvement suggestions
 */

import { browser } from '$app/environment';
import {
	getEnhancedLearnings,
	queryLearnedPatterns,
	getUserStyle,
	type EnhancedLearnings,
	type LearnedPattern,
	type UserStyle,
	type EngagementCorrelation,
	type VisualInsight,
	type ContentTypePerformance,
	type TrendDataPoint
} from './contentforge-mind';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Individual Agent Analysis Result
 */
export interface AgentAnalysis {
	agentId: string;
	agentName: string;
	expertise: string;
	h70Skill: string;

	// Core findings
	topFindings: string[];
	patterns: PatternInsight[];
	recommendations: AgentRecommendation[];

	// Cross-agent references
	correlatesWith: string[]; // Other agent IDs this correlates with
	dependencies: string[]; // Patterns from other agents this depends on

	// Meta
	confidence: number; // 0-1
	dataPointsAnalyzed: number;
	lastUpdated: string;
}

export interface PatternInsight {
	pattern: string;
	category: string;
	performance: 'high' | 'medium' | 'low';
	avgScore: number;
	sampleSize: number;
	trend: 'improving' | 'stable' | 'declining';
	insight: string;
	actionable: string;
}

export interface AgentRecommendation {
	priority: 'critical' | 'high' | 'medium' | 'low';
	type: 'improvement' | 'gap' | 'opportunity' | 'warning';
	title: string;
	description: string;
	rationale: string;
	expectedImpact: string;
	relatedPatterns: string[];
}

/**
 * Cross-Agent Collaboration Result
 */
export interface AgentCollaboration {
	sessionId: string;
	timestamp: string;
	dataAnalyzed: number;

	// Individual agent analyses
	agents: AgentAnalysis[];

	// Collaborative synthesis
	synthesis: CollaborativeSynthesis;

	// System-level insights
	systemInsights: SystemInsight[];
}

export interface CollaborativeSynthesis {
	// Cross-agent patterns
	crossAgentPatterns: CrossAgentPattern[];

	// Unified recommendations (merged from all agents)
	unifiedRecommendations: UnifiedRecommendation[];

	// Gaps identified across all agents
	gaps: GapAnalysis[];

	// Overall health score
	learningHealthScore: number; // 0-100
	healthBreakdown: {
		dataQuantity: number;
		dataQuality: number;
		patternDiversity: number;
		trendClarity: number;
	};
}

export interface CrossAgentPattern {
	pattern: string;
	contributingAgents: string[];
	correlation: number;
	description: string;
	combinedInsight: string;
}

export interface UnifiedRecommendation {
	id: string;
	priority: number; // 1-10
	title: string;
	description: string;
	contributingAgents: string[];
	expectedImpact: string;
	implementation: string[];
	trackingMetrics: string[];
}

export interface GapAnalysis {
	area: string;
	description: string;
	identifiedBy: string[];
	severity: 'critical' | 'moderate' | 'minor';
	suggestedFix: string;
}

export interface SystemInsight {
	type: 'algorithm' | 'psychology' | 'content' | 'platform' | 'improvement';
	title: string;
	insight: string;
	evidence: string[];
	recommendation: string;
}

// =============================================================================
// AGENT DEFINITIONS (H70 Skill-Powered)
// =============================================================================

interface AgentDefinition {
	id: string;
	name: string;
	h70Skill: string;
	expertise: string;
	analyzeFunction: (data: LearningData) => AgentAnalysis;
}

interface LearningData {
	enhanced: EnhancedLearnings | null;
	patterns: LearnedPattern[];
	userStyle: UserStyle | null;
}

// =============================================================================
// MARKETING AGENT (viral-marketing)
// =============================================================================

function analyzeAsMarketingAgent(data: LearningData): AgentAnalysis {
	const findings: string[] = [];
	const patterns: PatternInsight[] = [];
	const recommendations: AgentRecommendation[] = [];

	const correlations = data.enhanced?.engagementCorrelations || [];
	const visualInsights = data.enhanced?.visualInsights || [];

	// STEPPS Framework Analysis
	const steppsElements = {
		socialCurrency: 0,
		triggers: 0,
		emotion: 0,
		public: 0,
		practicalValue: 0,
		stories: 0
	};

	// Analyze patterns through STEPPS lens
	for (const corr of correlations) {
		// Social Currency: Makes people look good/smart
		if (/contrarian|insight|secret|exclusive/i.test(corr.pattern)) {
			steppsElements.socialCurrency++;
		}
		// Triggers: Environmental reminders
		if (/morning|routine|daily|habit|monday/i.test(corr.pattern)) {
			steppsElements.triggers++;
		}
		// Emotion: High-arousal emotions
		if (/aspiration|excitement|awe|anger|anxiety|curiosity/i.test(corr.pattern)) {
			steppsElements.emotion++;
		}
		// Practical Value: Useful information
		if (/how-to|list|tips|hack|framework/i.test(corr.pattern)) {
			steppsElements.practicalValue++;
		}
		// Stories: Narrative structure
		if (/story|journey|transformation|before.*after/i.test(corr.pattern)) {
			steppsElements.stories++;
		}
	}

	// Generate STEPPS findings
	const strongestSTEPPS = Object.entries(steppsElements)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3);
	const weakestSTEPPS = Object.entries(steppsElements)
		.filter(([, count]) => count === 0)
		.map(([element]) => element);

	if (strongestSTEPPS.length > 0) {
		findings.push(`Strongest STEPPS elements: ${strongestSTEPPS.map(([e, c]) => `${e} (${c} patterns)`).join(', ')}`);
	}

	if (weakestSTEPPS.length > 0) {
		findings.push(`Missing STEPPS elements: ${weakestSTEPPS.join(', ')} - potential growth areas`);
		recommendations.push({
			priority: 'high',
			type: 'gap',
			title: `Add ${weakestSTEPPS[0]} to content strategy`,
			description: `Your content lacks ${weakestSTEPPS[0]} elements which are proven viral drivers`,
			rationale: 'STEPPS framework shows all 6 elements contribute to shareability',
			expectedImpact: '15-25% increase in share rate',
			relatedPatterns: ['STEPPS Framework', 'Viral Loop']
		});
	}

	// K-Factor Analysis (Viral Coefficient)
	const avgEngagement = correlations.reduce((sum, c) => sum + c.avgEngagementRate, 0) / Math.max(correlations.length, 1);
	const avgRetweet = correlations.reduce((sum, c) => sum + c.avgRetweetRate, 0) / Math.max(correlations.length, 1);

	const estimatedKFactor = (avgRetweet / 100) * 0.1; // Simplified K-factor estimate
	findings.push(`Estimated K-Factor: ${estimatedKFactor.toFixed(3)} (${estimatedKFactor >= 0.01 ? 'viral potential' : 'needs improvement'})`);

	if (estimatedKFactor < 0.01) {
		recommendations.push({
			priority: 'critical',
			type: 'improvement',
			title: 'Increase viral coefficient through share triggers',
			description: 'Add explicit share triggers and calls-to-action to boost K-factor',
			rationale: 'K-factor < 0.01 means content is not self-propagating',
			expectedImpact: 'Each 0.01 K-factor increase = 10% organic reach growth',
			relatedPatterns: ['Share Trigger', 'CTA Optimization']
		});
	}

	// Visual content analysis
	const videoInsight = visualInsights.find(v => v.type === 'Video');
	const imageInsight = visualInsights.find(v => v.type === 'Image');
	const noMediaInsight = visualInsights.find(v => v.type === 'No Media');

	if (videoInsight && noMediaInsight && videoInsight.avgViralityScore > noMediaInsight.avgViralityScore + 10) {
		findings.push(`Video content outperforms text-only by ${videoInsight.avgViralityScore - noMediaInsight.avgViralityScore} points`);
		recommendations.push({
			priority: 'high',
			type: 'opportunity',
			title: 'Prioritize video content creation',
			description: 'Data shows significant performance lift with video',
			rationale: `Video avg: ${videoInsight.avgViralityScore}, Text-only avg: ${noMediaInsight.avgViralityScore}`,
			expectedImpact: `+${videoInsight.avgViralityScore - noMediaInsight.avgViralityScore} virality score on average`,
			relatedPatterns: ['Video Content', 'Media Optimization']
		});
	}

	// Build pattern insights from engagement correlations
	for (const corr of correlations.slice(0, 5)) {
		patterns.push({
			pattern: corr.pattern,
			category: corr.category,
			performance: corr.avgEngagementRate > 5 ? 'high' : corr.avgEngagementRate > 2 ? 'medium' : 'low',
			avgScore: corr.avgEngagementRate,
			sampleSize: corr.sampleSize,
			trend: corr.trend,
			insight: `${corr.pattern} shows ${corr.avgEngagementRate.toFixed(2)}% engagement`,
			actionable: corr.trend === 'improving' ? 'Double down on this pattern' : 'Test variations'
		});
	}

	return {
		agentId: 'marketing',
		agentName: 'Marketing Agent',
		expertise: 'Viral mechanics, STEPPS framework, K-factor analysis, distribution strategy',
		h70Skill: 'viral-marketing',
		topFindings: findings.slice(0, 5),
		patterns,
		recommendations,
		correlatesWith: ['psychology', 'content-strategy', 'algorithm'],
		dependencies: ['emotionalTriggers', 'platformMetrics'],
		confidence: Math.min(0.95, 0.5 + (correlations.length * 0.05)),
		dataPointsAnalyzed: data.enhanced?.totalAnalyzed || 0,
		lastUpdated: new Date().toISOString()
	};
}

// =============================================================================
// COPYWRITING AGENT (copywriting)
// =============================================================================

function analyzeAsCopywritingAgent(data: LearningData): AgentAnalysis {
	const findings: string[] = [];
	const patterns: PatternInsight[] = [];
	const recommendations: AgentRecommendation[] = [];

	const correlations = data.enhanced?.engagementCorrelations || [];
	const hookCorrelations = correlations.filter(c => c.category === 'hook');
	const structureCorrelations = correlations.filter(c => c.category === 'structure');

	// PAS Framework Analysis (Problem-Agitate-Solve)
	const pasPatterns = {
		problem: correlations.filter(c => /problem|pain|struggle|frustrated/i.test(c.pattern)),
		agitate: correlations.filter(c => /fear|worry|risk|miss.*out/i.test(c.pattern)),
		solve: correlations.filter(c => /solution|fix|hack|method|framework/i.test(c.pattern))
	};

	// AIDA Framework Analysis
	const aidaPatterns = {
		attention: hookCorrelations,
		interest: correlations.filter(c => /curiosity|reveal|secret/i.test(c.pattern)),
		desire: correlations.filter(c => /aspiration|benefit|transform/i.test(c.pattern)),
		action: correlations.filter(c => /cta|click|try|start/i.test(c.pattern))
	};

	// Analyze hook effectiveness
	if (hookCorrelations.length > 0) {
		const avgHookEngagement = hookCorrelations.reduce((sum, c) => sum + c.avgEngagementRate, 0) / hookCorrelations.length;
		findings.push(`Hook patterns average ${avgHookEngagement.toFixed(2)}% engagement`);

		const topHook = hookCorrelations.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];
		if (topHook) {
			findings.push(`Best performing hook: "${topHook.pattern}" (${topHook.avgEngagementRate.toFixed(2)}% engagement)`);
			patterns.push({
				pattern: topHook.pattern,
				category: 'hook',
				performance: 'high',
				avgScore: topHook.avgEngagementRate,
				sampleSize: topHook.sampleSize,
				trend: topHook.trend,
				insight: 'Your top-performing hook type',
				actionable: 'Use this hook structure in 50%+ of your content'
			});
		}
	}

	// 4 U's Analysis (Useful, Urgent, Unique, Ultra-specific)
	const fourUs = {
		useful: correlations.filter(c => /practical|how-to|tips|guide/i.test(c.pattern)).length,
		urgent: correlations.filter(c => /now|today|immediately|don.*t.*wait/i.test(c.pattern)).length,
		unique: correlations.filter(c => /only|first|exclusive|never.*before/i.test(c.pattern)).length,
		ultraSpecific: correlations.filter(c => /\d+|specific|exact|precise/i.test(c.pattern)).length
	};

	const strongUs = Object.entries(fourUs).filter(([, count]) => count > 0);
	const weakUs = Object.entries(fourUs).filter(([, count]) => count === 0);

	if (strongUs.length > 0) {
		findings.push(`4 U's strengths: ${strongUs.map(([u, c]) => `${u} (${c})`).join(', ')}`);
	}

	if (weakUs.length > 0) {
		const [weakestU] = weakUs[0];
		recommendations.push({
			priority: 'medium',
			type: 'improvement',
			title: `Add more "${weakestU}" elements to headlines`,
			description: `Your content lacks ${weakestU} elements which drive clicks`,
			rationale: 'The 4 U\'s framework: headlines need all 4 for maximum impact',
			expectedImpact: '10-20% CTR improvement',
			relatedPatterns: ['Headline Optimization', '4 U\'s Framework']
		});
	}

	// Structure analysis
	if (structureCorrelations.length > 0) {
		const topStructure = structureCorrelations.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];
		findings.push(`Best structure: "${topStructure.pattern}" with ${topStructure.avgEngagementRate.toFixed(2)}% engagement`);
	}

	// Check for PAS completeness
	const hasPAS = pasPatterns.problem.length > 0 && pasPatterns.solve.length > 0;
	if (!hasPAS) {
		recommendations.push({
			priority: 'high',
			type: 'gap',
			title: 'Implement PAS framework consistently',
			description: 'Problem-Agitate-Solve structure is missing from most content',
			rationale: 'PAS is the most proven copywriting framework for conversions',
			expectedImpact: '25-40% engagement lift on posts using PAS',
			relatedPatterns: ['PAS Framework', 'Copywriting Structure']
		});
	}

	return {
		agentId: 'copywriting',
		agentName: 'Copywriting Agent',
		expertise: 'PAS/AIDA frameworks, 4 U\'s, headline optimization, persuasive structure',
		h70Skill: 'copywriting',
		topFindings: findings.slice(0, 5),
		patterns,
		recommendations,
		correlatesWith: ['viral-hooks', 'psychology', 'marketing'],
		dependencies: ['hookTypes', 'structureFormats'],
		confidence: Math.min(0.95, 0.5 + (hookCorrelations.length * 0.08)),
		dataPointsAnalyzed: data.enhanced?.totalAnalyzed || 0,
		lastUpdated: new Date().toISOString()
	};
}

// =============================================================================
// VIRAL HOOKS AGENT (viral-hooks)
// =============================================================================

function analyzeAsViralHooksAgent(data: LearningData): AgentAnalysis {
	const findings: string[] = [];
	const patterns: PatternInsight[] = [];
	const recommendations: AgentRecommendation[] = [];

	const correlations = data.enhanced?.engagementCorrelations || [];
	const userPatterns = data.patterns || [];

	// Hook Formula Library Analysis
	const hookFormulas = {
		curiosityGap: { regex: /curiosity|reveal|secret|hidden|discover/i, instances: 0, scores: [] as number[] },
		contrarian: { regex: /wrong|myth|lie|actually|truth/i, instances: 0, scores: [] as number[] },
		storyHook: { regex: /story|journey|was about to|happened|realized/i, instances: 0, scores: [] as number[] },
		directClaim: { regex: /\d+x|doubled|tripled|10x|100x/i, instances: 0, scores: [] as number[] },
		question: { regex: /^why|^how|^what|^did you/i, instances: 0, scores: [] as number[] },
		numberList: { regex: /^\d+\s|top \d|ways|tips|lessons|mistakes/i, instances: 0, scores: [] as number[] }
	};

	// Analyze each hook type
	for (const corr of correlations) {
		for (const [hookType, data] of Object.entries(hookFormulas)) {
			if (data.regex.test(corr.pattern)) {
				data.instances++;
				data.scores.push(corr.avgEngagementRate);
			}
		}
	}

	// Generate hook formula insights
	const hookPerformance = Object.entries(hookFormulas)
		.map(([type, data]) => ({
			type,
			instances: data.instances,
			avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0
		}))
		.filter(h => h.instances > 0)
		.sort((a, b) => b.avgScore - a.avgScore);

	if (hookPerformance.length > 0) {
		findings.push(`Top performing hook formula: ${hookPerformance[0].type} (${hookPerformance[0].avgScore.toFixed(2)}% avg engagement)`);

		for (const hook of hookPerformance.slice(0, 3)) {
			patterns.push({
				pattern: hook.type,
				category: 'hook-formula',
				performance: hook.avgScore > 5 ? 'high' : hook.avgScore > 2 ? 'medium' : 'low',
				avgScore: hook.avgScore,
				sampleSize: hook.instances,
				trend: 'stable',
				insight: `${hook.type} hooks generate ${hook.avgScore.toFixed(2)}% engagement`,
				actionable: hook.avgScore > 5 ? 'Use liberally' : 'Test variations'
			});
		}
	}

	// Curiosity Gap Analysis
	const curiosityPatterns = correlations.filter(c => /curiosity|gap|reveal|secret/i.test(c.pattern));
	if (curiosityPatterns.length > 0) {
		const avgCuriosityEngagement = curiosityPatterns.reduce((sum, c) => sum + c.avgEngagementRate, 0) / curiosityPatterns.length;
		findings.push(`Curiosity gap patterns: ${avgCuriosityEngagement.toFixed(2)}% avg engagement (${curiosityPatterns.length} samples)`);
	} else {
		recommendations.push({
			priority: 'high',
			type: 'gap',
			title: 'Add curiosity gap hooks',
			description: 'No curiosity gap patterns detected in your content',
			rationale: 'Curiosity gaps are the #1 driver of click-through rates',
			expectedImpact: '30-50% CTR increase when properly implemented',
			relatedPatterns: ['Curiosity Gap', 'Information Asymmetry']
		});
	}

	// Check for hook diversity
	const usedHookTypes = hookPerformance.filter(h => h.instances > 0).length;
	if (usedHookTypes < 3) {
		recommendations.push({
			priority: 'medium',
			type: 'opportunity',
			title: 'Diversify hook formulas',
			description: `Only using ${usedHookTypes} hook types. Expand repertoire.`,
			rationale: 'Hook fatigue reduces effectiveness over time',
			expectedImpact: 'Sustained engagement as audience grows',
			relatedPatterns: ['Hook Diversity', 'Audience Fatigue Prevention']
		});
	}

	// Platform-specific hook optimization
	const trendData = data.enhanced?.trendData || [];
	const recentTrend = trendData.slice(-7);
	if (recentTrend.length >= 3) {
		const recentAvg = recentTrend.reduce((sum, t) => sum + t.viralityScore, 0) / recentTrend.length;
		const olderData = trendData.slice(-14, -7);
		const olderAvg = olderData.length > 0 ? olderData.reduce((sum, t) => sum + t.viralityScore, 0) / olderData.length : recentAvg;

		if (recentAvg < olderAvg - 5) {
			findings.push(`Hook effectiveness declining: ${recentAvg.toFixed(0)} vs ${olderAvg.toFixed(0)} (last week vs prior week)`);
			recommendations.push({
				priority: 'critical',
				type: 'warning',
				title: 'Hook effectiveness declining',
				description: 'Recent hooks underperforming compared to earlier content',
				rationale: 'May indicate hook fatigue or algorithm shift',
				expectedImpact: 'Stopping the decline prevents 10-20% reach loss',
				relatedPatterns: ['Hook Refresh', 'Algorithm Adaptation']
			});
		}
	}

	return {
		agentId: 'viral-hooks',
		agentName: 'Viral Hooks Agent',
		expertise: 'Hook formula library, curiosity gap engineering, scroll-stopping openers',
		h70Skill: 'viral-hooks',
		topFindings: findings.slice(0, 5),
		patterns,
		recommendations,
		correlatesWith: ['copywriting', 'psychology', 'algorithm'],
		dependencies: ['hookPerformance', 'platformMetrics'],
		confidence: Math.min(0.95, 0.5 + (hookPerformance.length * 0.1)),
		dataPointsAnalyzed: data.enhanced?.totalAnalyzed || 0,
		lastUpdated: new Date().toISOString()
	};
}

// =============================================================================
// CONTENT STRATEGY AGENT (content-strategy)
// =============================================================================

function analyzeAsContentStrategyAgent(data: LearningData): AgentAnalysis {
	const findings: string[] = [];
	const patterns: PatternInsight[] = [];
	const recommendations: AgentRecommendation[] = [];

	const contentTypes = data.enhanced?.contentTypePerformance || [];
	const visualInsights = data.enhanced?.visualInsights || [];
	const trendData = data.enhanced?.trendData || [];

	// Content Mix Analysis
	if (contentTypes.length > 0) {
		const totalContent = contentTypes.reduce((sum, c) => sum + c.count, 0);
		const contentMix = contentTypes.map(c => ({
			type: c.contentType,
			percentage: (c.count / totalContent) * 100,
			avgScore: c.avgViralityScore
		}));

		findings.push(`Content mix: ${contentMix.map(c => `${c.type} (${c.percentage.toFixed(0)}%)`).join(', ')}`);

		// Check for over-reliance on one content type
		const dominant = contentMix.find(c => c.percentage > 60);
		if (dominant) {
			recommendations.push({
				priority: 'medium',
				type: 'warning',
				title: `Diversify beyond ${dominant.type} content`,
				description: `${dominant.percentage.toFixed(0)}% of your content is ${dominant.type}`,
				rationale: 'Content diversity improves algorithm favor and audience retention',
				expectedImpact: '10-15% reach improvement through content variety',
				relatedPatterns: ['Content Pillar Strategy', 'Format Diversity']
			});
		}

		// Find best performing content type
		const bestType = contentTypes.sort((a, b) => b.avgViralityScore - a.avgViralityScore)[0];
		if (bestType) {
			findings.push(`Best performing type: ${bestType.contentType} (avg score: ${bestType.avgViralityScore})`);
			patterns.push({
				pattern: bestType.contentType,
				category: 'content-type',
				performance: 'high',
				avgScore: bestType.avgViralityScore,
				sampleSize: bestType.count,
				trend: 'stable',
				insight: `${bestType.contentType} is your highest-performing format`,
				actionable: 'Increase production of this content type by 25%'
			});
		}
	}

	// Topic Cluster Analysis (based on pattern frequency)
	const correlations = data.enhanced?.engagementCorrelations || [];
	const topicClusters = new Map<string, number>();

	for (const corr of correlations) {
		// Group patterns into topic clusters
		const topics = extractTopics(corr.pattern);
		for (const topic of topics) {
			topicClusters.set(topic, (topicClusters.get(topic) || 0) + 1);
		}
	}

	const topClusters = Array.from(topicClusters.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);

	if (topClusters.length > 0) {
		findings.push(`Top topic clusters: ${topClusters.map(([t, c]) => `${t} (${c})`).join(', ')}`);
	}

	// Content Repurposing Opportunities
	if (contentTypes.length > 0 && visualInsights.length > 0) {
		const textOnlyPerf = visualInsights.find(v => v.type === 'No Media');
		const videoPerf = visualInsights.find(v => v.type === 'Video');

		if (textOnlyPerf && videoPerf && videoPerf.avgViralityScore > textOnlyPerf.avgViralityScore) {
			recommendations.push({
				priority: 'high',
				type: 'opportunity',
				title: 'Repurpose top text posts as videos',
				description: 'Video outperforms text. Convert best text posts to video format.',
				rationale: `Video: ${videoPerf.avgViralityScore} avg score vs Text: ${textOnlyPerf.avgViralityScore}`,
				expectedImpact: `+${(videoPerf.avgViralityScore - textOnlyPerf.avgViralityScore).toFixed(0)} virality score per repurposed piece`,
				relatedPatterns: ['Content Repurposing Ladder', 'Format Optimization']
			});
		}
	}

	// Posting Frequency Analysis
	if (trendData.length >= 7) {
		const daysWithContent = new Set(trendData.map(t => t.date)).size;
		const dateRange = Math.ceil((new Date(trendData[trendData.length - 1].date).getTime() - new Date(trendData[0].date).getTime()) / (1000 * 60 * 60 * 24)) + 1;
		const postingFrequency = daysWithContent / dateRange;

		findings.push(`Posting frequency: ${(postingFrequency * 100).toFixed(0)}% of days (${daysWithContent}/${dateRange} days)`);

		if (postingFrequency < 0.5) {
			recommendations.push({
				priority: 'medium',
				type: 'improvement',
				title: 'Increase posting consistency',
				description: 'Posting less than 50% of days reduces algorithm momentum',
				rationale: 'Consistent posting maintains audience engagement and algorithm favor',
				expectedImpact: '15-25% reach increase with daily posting',
				relatedPatterns: ['Consistency', 'Algorithm Momentum']
			});
		}
	}

	return {
		agentId: 'content-strategy',
		agentName: 'Content Strategy Agent',
		expertise: 'Topic clusters, content repurposing, editorial calendar, distribution strategy',
		h70Skill: 'content-strategy',
		topFindings: findings.slice(0, 5),
		patterns,
		recommendations,
		correlatesWith: ['marketing', 'algorithm', 'research'],
		dependencies: ['contentTypes', 'platformMetrics', 'audienceData'],
		confidence: Math.min(0.95, 0.5 + (contentTypes.length * 0.15)),
		dataPointsAnalyzed: data.enhanced?.totalAnalyzed || 0,
		lastUpdated: new Date().toISOString()
	};
}

// =============================================================================
// PSYCHOLOGY AGENT (persuasion-psychology, audience-psychology)
// =============================================================================

function analyzeAsPsychologyAgent(data: LearningData): AgentAnalysis {
	const findings: string[] = [];
	const patterns: PatternInsight[] = [];
	const recommendations: AgentRecommendation[] = [];

	const correlations = data.enhanced?.engagementCorrelations || [];
	const emotionCorrelations = correlations.filter(c => c.category === 'emotion');

	// Emotional Trigger Analysis
	const emotionalTriggers = {
		aspiration: { count: 0, scores: [] as number[] },
		curiosity: { count: 0, scores: [] as number[] },
		fear: { count: 0, scores: [] as number[] },
		anger: { count: 0, scores: [] as number[] },
		awe: { count: 0, scores: [] as number[] },
		excitement: { count: 0, scores: [] as number[] },
		nostalgia: { count: 0, scores: [] as number[] },
		validation: { count: 0, scores: [] as number[] }
	};

	for (const corr of emotionCorrelations) {
		for (const [emotion, data] of Object.entries(emotionalTriggers)) {
			if (corr.pattern.toLowerCase().includes(emotion)) {
				data.count++;
				data.scores.push(corr.avgEngagementRate);
			}
		}
	}

	// Calculate emotion performance
	const emotionPerformance = Object.entries(emotionalTriggers)
		.map(([emotion, data]) => ({
			emotion,
			count: data.count,
			avgScore: data.scores.length > 0 ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length : 0
		}))
		.filter(e => e.count > 0)
		.sort((a, b) => b.avgScore - a.avgScore);

	if (emotionPerformance.length > 0) {
		findings.push(`Top emotional trigger: ${emotionPerformance[0].emotion} (${emotionPerformance[0].avgScore.toFixed(2)}% engagement)`);

		for (const emotion of emotionPerformance.slice(0, 3)) {
			patterns.push({
				pattern: emotion.emotion,
				category: 'emotion',
				performance: emotion.avgScore > 5 ? 'high' : emotion.avgScore > 2 ? 'medium' : 'low',
				avgScore: emotion.avgScore,
				sampleSize: emotion.count,
				trend: 'stable',
				insight: `${emotion.emotion} triggers ${emotion.avgScore.toFixed(2)}% avg engagement`,
				actionable: `Incorporate ${emotion.emotion} in hook or body`
			});
		}
	}

	// Cialdini's Principles Analysis
	const cialdiniPrinciples = {
		reciprocity: correlations.filter(c => /free|give|value.*first/i.test(c.pattern)).length,
		commitment: correlations.filter(c => /consistency|commit|small.*step/i.test(c.pattern)).length,
		socialProof: correlations.filter(c => /others|everyone|millions|popular/i.test(c.pattern)).length,
		authority: correlations.filter(c => /expert|research|study|proven/i.test(c.pattern)).length,
		liking: correlations.filter(c => /story|personal|relatable|vulnerable/i.test(c.pattern)).length,
		scarcity: correlations.filter(c => /limited|exclusive|rare|only/i.test(c.pattern)).length
	};

	const usedPrinciples = Object.entries(cialdiniPrinciples).filter(([, count]) => count > 0);
	const unusedPrinciples = Object.entries(cialdiniPrinciples).filter(([, count]) => count === 0);

	findings.push(`Cialdini principles used: ${usedPrinciples.length}/6 (${usedPrinciples.map(([p]) => p).join(', ')})`);

	if (unusedPrinciples.length > 0) {
		const [principle] = unusedPrinciples[0];
		recommendations.push({
			priority: 'medium',
			type: 'gap',
			title: `Add ${principle} persuasion principle`,
			description: `Your content doesn't leverage ${principle} which is a proven persuasion driver`,
			rationale: 'Cialdini\'s 6 principles are the foundation of persuasive content',
			expectedImpact: '10-20% conversion improvement per principle added',
			relatedPatterns: [`Cialdini: ${principle}`, 'Persuasion Psychology']
		});
	}

	// Identity Resonance Analysis
	const identityPatterns = correlations.filter(c =>
		/founder|developer|creator|entrepreneur|builder|parent|professional/i.test(c.pattern)
	);

	if (identityPatterns.length > 0) {
		const topIdentity = identityPatterns.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];
		findings.push(`Strongest identity resonance: ${topIdentity.pattern} (${topIdentity.avgEngagementRate.toFixed(2)}% engagement)`);
	} else {
		recommendations.push({
			priority: 'high',
			type: 'gap',
			title: 'Add identity-based messaging',
			description: 'Content lacks clear identity targeting (who is this for?)',
			rationale: 'People share content that reinforces their identity',
			expectedImpact: '25-40% share rate increase with strong identity resonance',
			relatedPatterns: ['Identity Resonance', 'In-Group Signaling']
		});
	}

	// Cognitive Bias Detection
	const biasUsage = {
		anchoring: correlations.some(c => /\d+.*then|\$.*\$|was.*now/i.test(c.pattern)),
		bandwagon: correlations.some(c => /everyone|millions|most people/i.test(c.pattern)),
		lossAversion: correlations.some(c => /don.*t.*lose|miss.*out|avoid/i.test(c.pattern)),
		confirmation: correlations.some(c => /you.*re.*right|you.*knew|validates/i.test(c.pattern))
	};

	const usedBiases = Object.entries(biasUsage).filter(([, used]) => used);
	if (usedBiases.length > 0) {
		findings.push(`Cognitive biases leveraged: ${usedBiases.map(([b]) => b).join(', ')}`);
	}

	return {
		agentId: 'psychology',
		agentName: 'Psychology Agent',
		expertise: 'Emotional triggers, Cialdini principles, cognitive biases, identity resonance',
		h70Skill: 'persuasion-psychology',
		topFindings: findings.slice(0, 5),
		patterns,
		recommendations,
		correlatesWith: ['copywriting', 'marketing', 'viral-hooks'],
		dependencies: ['emotionalData', 'audienceInsights'],
		confidence: Math.min(0.95, 0.5 + (emotionCorrelations.length * 0.1)),
		dataPointsAnalyzed: data.enhanced?.totalAnalyzed || 0,
		lastUpdated: new Date().toISOString()
	};
}

// =============================================================================
// ALGORITHM AGENT (platform-algorithms)
// =============================================================================

function analyzeAsAlgorithmAgent(data: LearningData): AgentAnalysis {
	const findings: string[] = [];
	const patterns: PatternInsight[] = [];
	const recommendations: AgentRecommendation[] = [];

	const correlations = data.enhanced?.engagementCorrelations || [];
	const trendData = data.enhanced?.trendData || [];

	// Engagement Rate Analysis (Algorithm Signals)
	const avgEngagement = correlations.reduce((sum, c) => sum + c.avgEngagementRate, 0) / Math.max(correlations.length, 1);
	const avgBookmark = correlations.reduce((sum, c) => sum + c.avgBookmarkRate, 0) / Math.max(correlations.length, 1);
	const avgRetweet = correlations.reduce((sum, c) => sum + c.avgRetweetRate, 0) / Math.max(correlations.length, 1);

	findings.push(`Algorithm signals: ${avgEngagement.toFixed(2)}% engagement, ${avgBookmark.toFixed(3)}% save, ${avgRetweet.toFixed(3)}% repost`);

	// High-value engagement analysis (saves/bookmarks are weighted heavily)
	if (avgBookmark > 0) {
		const bookmarkToEngagementRatio = avgBookmark / avgEngagement;
		findings.push(`Save-to-engagement ratio: ${(bookmarkToEngagementRatio * 100).toFixed(1)}%`);

		if (bookmarkToEngagementRatio < 0.05) {
			recommendations.push({
				priority: 'high',
				type: 'improvement',
				title: 'Increase save-worthy content',
				description: 'Low save rate indicates content lacks reference value',
				rationale: 'Saves/bookmarks are heavily weighted by Twitter/X algorithm',
				expectedImpact: 'Each 0.1% save rate increase = ~10% reach boost',
				relatedPatterns: ['Save-Worthy Content', 'Reference Value']
			});
		}
	}

	// Reply ratio analysis
	const replyPatterns = correlations.filter(c => /reply|comment|conversation|discussion/i.test(c.pattern));
	if (replyPatterns.length > 0) {
		findings.push(`Reply-driving patterns: ${replyPatterns.length} detected`);
	} else {
		recommendations.push({
			priority: 'medium',
			type: 'gap',
			title: 'Add conversation starters',
			description: 'No patterns that drive replies detected',
			rationale: 'Replies are highest-weighted engagement for algorithmic reach',
			expectedImpact: '20-40% reach increase from reply-driving content',
			relatedPatterns: ['Conversation Starter', 'Reply Trigger']
		});
	}

	// Timing analysis
	if (trendData.length >= 7) {
		// Group by day of week (if we had that data)
		const weekdayPerformance: Record<string, number[]> = {};
		for (const t of trendData) {
			const day = new Date(t.date).toLocaleDateString('en-US', { weekday: 'long' });
			if (!weekdayPerformance[day]) weekdayPerformance[day] = [];
			weekdayPerformance[day].push(t.viralityScore);
		}

		const dayAverages = Object.entries(weekdayPerformance)
			.map(([day, scores]) => ({
				day,
				avg: scores.reduce((a, b) => a + b, 0) / scores.length,
				count: scores.length
			}))
			.sort((a, b) => b.avg - a.avg);

		if (dayAverages.length > 0 && dayAverages[0].count >= 2) {
			findings.push(`Best performing day: ${dayAverages[0].day} (avg: ${dayAverages[0].avg.toFixed(0)})`);
			patterns.push({
				pattern: `Post on ${dayAverages[0].day}`,
				category: 'timing',
				performance: 'high',
				avgScore: dayAverages[0].avg,
				sampleSize: dayAverages[0].count,
				trend: 'stable',
				insight: `${dayAverages[0].day} shows highest average performance`,
				actionable: 'Schedule important posts for this day'
			});
		}
	}

	// Algorithm momentum analysis
	if (trendData.length >= 14) {
		const recent = trendData.slice(-7);
		const prior = trendData.slice(-14, -7);
		const recentAvg = recent.reduce((sum, t) => sum + t.viralityScore, 0) / recent.length;
		const priorAvg = prior.reduce((sum, t) => sum + t.viralityScore, 0) / prior.length;

		const momentum = ((recentAvg - priorAvg) / priorAvg) * 100;
		findings.push(`Algorithm momentum: ${momentum > 0 ? '+' : ''}${momentum.toFixed(1)}% week-over-week`);

		if (momentum < -10) {
			recommendations.push({
				priority: 'critical',
				type: 'warning',
				title: 'Algorithm momentum declining',
				description: `Performance down ${Math.abs(momentum).toFixed(1)}% vs last week`,
				rationale: 'Declining momentum compounds - act quickly to reverse',
				expectedImpact: 'Reversing decline prevents 30%+ reach loss',
				relatedPatterns: ['Algorithm Recovery', 'Momentum Building']
			});
		} else if (momentum > 20) {
			findings.push(`Strong positive momentum - capitalize on algorithmic favor!`);
		}
	}

	return {
		agentId: 'algorithm',
		agentName: 'Algorithm Agent',
		expertise: 'Platform algorithms, engagement weighting, timing optimization, momentum analysis',
		h70Skill: 'platform-algorithms',
		topFindings: findings.slice(0, 5),
		patterns,
		recommendations,
		correlatesWith: ['marketing', 'content-strategy', 'research'],
		dependencies: ['engagementMetrics', 'timingData'],
		confidence: Math.min(0.95, 0.5 + (trendData.length * 0.03)),
		dataPointsAnalyzed: data.enhanced?.totalAnalyzed || 0,
		lastUpdated: new Date().toISOString()
	};
}

// =============================================================================
// RESEARCH AGENT (audience-psychology)
// =============================================================================

function analyzeAsResearchAgent(data: LearningData): AgentAnalysis {
	const findings: string[] = [];
	const patterns: PatternInsight[] = [];
	const recommendations: AgentRecommendation[] = [];

	const correlations = data.enhanced?.engagementCorrelations || [];
	const userStyle = data.userStyle;
	const trendData = data.enhanced?.trendData || [];

	// Audience Analysis
	if (userStyle) {
		findings.push(`Total content analyzed: ${userStyle.totalAnalyzed} pieces`);
		findings.push(`Average virality: ${userStyle.averageViralityScore}`);

		if (userStyle.preferredHookTypes.length > 0) {
			findings.push(`Audience responds to: ${userStyle.preferredHookTypes.join(', ')}`);
		}

		if (userStyle.strongEmotions.length > 0) {
			findings.push(`Emotional resonance: ${userStyle.strongEmotions.join(', ')}`);
		}
	}

	// Trend Phase Analysis
	if (trendData.length >= 14) {
		const recent = trendData.slice(-7);
		const prior = trendData.slice(-14, -7);

		const recentAvg = recent.reduce((sum, t) => sum + t.viralityScore, 0) / recent.length;
		const priorAvg = prior.reduce((sum, t) => sum + t.viralityScore, 0) / prior.length;
		const variance = recent.reduce((sum, t) => sum + Math.pow(t.viralityScore - recentAvg, 2), 0) / recent.length;
		const stdDev = Math.sqrt(variance);

		let trendPhase = 'Stable';
		if (recentAvg > priorAvg + 5 && stdDev < 10) trendPhase = 'Growth';
		else if (recentAvg > priorAvg + 10) trendPhase = 'Peak';
		else if (recentAvg < priorAvg - 5) trendPhase = 'Decline';

		findings.push(`Current trend phase: ${trendPhase} (variance: ${stdDev.toFixed(1)})`);

		patterns.push({
			pattern: trendPhase,
			category: 'trend-phase',
			performance: trendPhase === 'Growth' || trendPhase === 'Peak' ? 'high' : 'medium',
			avgScore: recentAvg,
			sampleSize: recent.length,
			trend: recentAvg > priorAvg ? 'improving' : recentAvg < priorAvg ? 'declining' : 'stable',
			insight: `Currently in ${trendPhase} phase`,
			actionable: trendPhase === 'Peak' ? 'Maximize output now' : trendPhase === 'Decline' ? 'Pivot strategy' : 'Maintain consistency'
		});
	}

	// Topic Relevance Scoring
	const topicClusters = new Map<string, { count: number; scores: number[] }>();
	for (const corr of correlations) {
		const topics = extractTopics(corr.pattern);
		for (const topic of topics) {
			if (!topicClusters.has(topic)) {
				topicClusters.set(topic, { count: 0, scores: [] });
			}
			const cluster = topicClusters.get(topic)!;
			cluster.count++;
			cluster.scores.push(corr.avgEngagementRate);
		}
	}

	const topTopics = Array.from(topicClusters.entries())
		.map(([topic, data]) => ({
			topic,
			count: data.count,
			avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length
		}))
		.sort((a, b) => b.avgScore - a.avgScore)
		.slice(0, 5);

	if (topTopics.length > 0) {
		findings.push(`Trending topics in your content: ${topTopics.map(t => t.topic).join(', ')}`);
	}

	// Gap identification - what audiences might we be missing?
	const commonAudiences = ['developers', 'founders', 'marketers', 'designers', 'creators', 'managers'];
	const detectedAudiences = correlations.filter(c =>
		commonAudiences.some(aud => c.pattern.toLowerCase().includes(aud))
	);

	if (detectedAudiences.length === 0) {
		recommendations.push({
			priority: 'medium',
			type: 'gap',
			title: 'Define clear target audience',
			description: 'No clear audience targeting detected in patterns',
			rationale: 'Specific audience targeting improves relevance and shareability',
			expectedImpact: '20-30% engagement lift with clear audience focus',
			relatedPatterns: ['Audience Targeting', 'Niche Down']
		});
	}

	// Platform fit analysis
	const visualInsights = data.enhanced?.visualInsights || [];
	const hasVideo = visualInsights.some(v => v.type === 'Video' && v.sampleSize > 0);
	const hasImages = visualInsights.some(v => v.type === 'Image' && v.sampleSize > 0);

	if (!hasVideo && !hasImages) {
		recommendations.push({
			priority: 'high',
			type: 'opportunity',
			title: 'Add visual content for platform optimization',
			description: 'All analyzed content is text-only',
			rationale: 'Visual content receives 2-3x algorithmic boost on most platforms',
			expectedImpact: '50-150% reach increase with visual content',
			relatedPatterns: ['Visual Content', 'Platform Optimization']
		});
	}

	return {
		agentId: 'research',
		agentName: 'Research Agent',
		expertise: 'Audience analysis, trend phases, topic relevance, platform fit',
		h70Skill: 'audience-psychology',
		topFindings: findings.slice(0, 5),
		patterns,
		recommendations,
		correlatesWith: ['content-strategy', 'marketing', 'algorithm'],
		dependencies: ['audienceData', 'trendData'],
		confidence: Math.min(0.95, 0.5 + ((data.userStyle?.totalAnalyzed || 0) * 0.02)),
		dataPointsAnalyzed: data.enhanced?.totalAnalyzed || 0,
		lastUpdated: new Date().toISOString()
	};
}

// =============================================================================
// VISUAL/NARRATIVE AGENT (narrative-craft)
// =============================================================================

function analyzeAsVisualAgent(data: LearningData): AgentAnalysis {
	const findings: string[] = [];
	const patterns: PatternInsight[] = [];
	const recommendations: AgentRecommendation[] = [];

	const visualInsights = data.enhanced?.visualInsights || [];
	const contentTypes = data.enhanced?.contentTypePerformance || [];
	const correlations = data.enhanced?.engagementCorrelations || [];

	// Visual Performance Analysis
	if (visualInsights.length > 0) {
		const sortedVisuals = [...visualInsights].sort((a, b) => b.avgViralityScore - a.avgViralityScore);
		const topVisual = sortedVisuals[0];

		findings.push(`Best visual format: ${topVisual.type} (${topVisual.avgViralityScore} avg score, ${topVisual.sampleSize} samples)`);

		for (const visual of sortedVisuals) {
			patterns.push({
				pattern: visual.type,
				category: 'visual',
				performance: visual.avgViralityScore >= 70 ? 'high' : visual.avgViralityScore >= 50 ? 'medium' : 'low',
				avgScore: visual.avgViralityScore,
				sampleSize: visual.sampleSize,
				trend: 'stable',
				insight: `${visual.type}: ${visual.avgViralityScore} avg virality, ${visual.avgEngagement.toFixed(2)}% engagement`,
				actionable: visual.bestPerformingStyle
			});
		}

		// Visual gap analysis
		const hasVideo = visualInsights.some(v => v.type === 'Video' && v.sampleSize > 0);
		const hasImage = visualInsights.some(v => v.type === 'Image' && v.sampleSize > 0);

		if (!hasVideo) {
			recommendations.push({
				priority: 'high',
				type: 'gap',
				title: 'Start creating video content',
				description: 'No video content in your analysis dataset',
				rationale: 'Video typically outperforms static content by 2-5x',
				expectedImpact: 'Potential 100-200% reach increase',
				relatedPatterns: ['Video Content', 'Short-form Video']
			});
		}

		if (!hasImage) {
			recommendations.push({
				priority: 'medium',
				type: 'gap',
				title: 'Add image content',
				description: 'No image content detected',
				rationale: 'Images stop the scroll and increase engagement',
				expectedImpact: '30-50% engagement lift with images',
				relatedPatterns: ['Image Content', 'Visual Hooks']
			});
		}
	}

	// Narrative Structure Analysis
	const narrativePatterns = correlations.filter(c =>
		/story|journey|transformation|beginning|middle|end|arc|tension|resolution/i.test(c.pattern)
	);

	if (narrativePatterns.length > 0) {
		const avgNarrativeEngagement = narrativePatterns.reduce((sum, c) => sum + c.avgEngagementRate, 0) / narrativePatterns.length;
		findings.push(`Narrative content: ${avgNarrativeEngagement.toFixed(2)}% avg engagement (${narrativePatterns.length} samples)`);
	} else {
		recommendations.push({
			priority: 'medium',
			type: 'opportunity',
			title: 'Add narrative structure to content',
			description: 'No story-based patterns detected',
			rationale: 'Stories are 22x more memorable than facts alone',
			expectedImpact: '40-60% retention and share rate improvement',
			relatedPatterns: ['Story Structure', 'Narrative Arc']
		});
	}

	// Thread/Long-form Analysis
	const threadPerformance = contentTypes.find(c => c.contentType.toLowerCase().includes('thread'));
	const singlePerformance = contentTypes.find(c => c.contentType.toLowerCase().includes('single'));

	if (threadPerformance && singlePerformance) {
		const diff = threadPerformance.avgViralityScore - singlePerformance.avgViralityScore;
		findings.push(`Thread vs Single: ${diff > 0 ? '+' : ''}${diff} virality difference`);

		if (diff > 10) {
			recommendations.push({
				priority: 'high',
				type: 'opportunity',
				title: 'Increase thread content production',
				description: `Threads outperform singles by ${diff} points`,
				rationale: 'Your audience engages more with long-form content',
				expectedImpact: `+${diff} virality score per thread`,
				relatedPatterns: ['Thread Strategy', 'Long-form Content']
			});
		}
	}

	// Visual style patterns
	const stylePatterns = correlations.filter(c =>
		/bold|minimal|dark|light|colorful|contrast|overlay|text/i.test(c.pattern)
	);

	if (stylePatterns.length > 0) {
		const topStyle = stylePatterns.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];
		findings.push(`Best visual style: ${topStyle.pattern} (${topStyle.avgEngagementRate.toFixed(2)}% engagement)`);
	}

	return {
		agentId: 'visual',
		agentName: 'Visual/Narrative Agent',
		expertise: 'Visual composition, narrative structure, story arcs, format optimization',
		h70Skill: 'narrative-craft',
		topFindings: findings.slice(0, 5),
		patterns,
		recommendations,
		correlatesWith: ['content-strategy', 'copywriting', 'psychology'],
		dependencies: ['visualData', 'narrativePatterns'],
		confidence: Math.min(0.95, 0.5 + (visualInsights.length * 0.15)),
		dataPointsAnalyzed: data.enhanced?.totalAnalyzed || 0,
		lastUpdated: new Date().toISOString()
	};
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function extractTopics(pattern: string): string[] {
	const topics: string[] = [];
	const topicPatterns = [
		{ regex: /founder|startup|entrepreneur/i, topic: 'Entrepreneurship' },
		{ regex: /developer|code|programming/i, topic: 'Development' },
		{ regex: /marketing|growth|viral/i, topic: 'Marketing' },
		{ regex: /ai|machine learning|gpt/i, topic: 'AI/ML' },
		{ regex: /productivity|efficiency|habit/i, topic: 'Productivity' },
		{ regex: /career|job|hire/i, topic: 'Career' },
		{ regex: /money|revenue|profit/i, topic: 'Business' },
		{ regex: /health|fitness|wellness/i, topic: 'Health' },
		{ regex: /design|ux|ui/i, topic: 'Design' },
		{ regex: /writing|content|copy/i, topic: 'Writing' }
	];

	for (const { regex, topic } of topicPatterns) {
		if (regex.test(pattern)) {
			topics.push(topic);
		}
	}

	return topics;
}

// =============================================================================
// MAIN ORCHESTRATION
// =============================================================================

/**
 * Run full agent collaboration analysis on Mind Learning data
 */
export async function runAgentCollaboration(): Promise<AgentCollaboration | null> {
	if (!browser) return null;

	try {
		// Gather all learning data
		const [enhanced, patterns, userStyle] = await Promise.all([
			getEnhancedLearnings(),
			queryLearnedPatterns(),
			getUserStyle()
		]);

		const learningData: LearningData = { enhanced, patterns, userStyle };

		// Check if we have enough data
		if (!enhanced || enhanced.totalAnalyzed === 0) {
			console.log('[MindLearningIntelligence] No data to analyze');
			return null;
		}

		// Run all agents
		const agents: AgentAnalysis[] = [
			analyzeAsMarketingAgent(learningData),
			analyzeAsCopywritingAgent(learningData),
			analyzeAsViralHooksAgent(learningData),
			analyzeAsContentStrategyAgent(learningData),
			analyzeAsPsychologyAgent(learningData),
			analyzeAsAlgorithmAgent(learningData),
			analyzeAsResearchAgent(learningData),
			analyzeAsVisualAgent(learningData)
		];

		// Synthesize cross-agent insights
		const synthesis = synthesizeAgentInsights(agents, learningData);

		// Generate system-level insights
		const systemInsights = generateSystemInsights(agents, learningData);

		return {
			sessionId: `collab-${Date.now()}`,
			timestamp: new Date().toISOString(),
			dataAnalyzed: enhanced.totalAnalyzed,
			agents,
			synthesis,
			systemInsights
		};
	} catch (e) {
		console.error('[MindLearningIntelligence] Collaboration failed:', e);
		return null;
	}
}

/**
 * Synthesize insights across all agents
 */
function synthesizeAgentInsights(agents: AgentAnalysis[], data: LearningData): CollaborativeSynthesis {
	// Find cross-agent patterns
	const crossAgentPatterns: CrossAgentPattern[] = [];
	const patternMap = new Map<string, { agents: string[]; scores: number[] }>();

	for (const agent of agents) {
		for (const pattern of agent.patterns) {
			const key = pattern.pattern.toLowerCase();
			if (!patternMap.has(key)) {
				patternMap.set(key, { agents: [], scores: [] });
			}
			const entry = patternMap.get(key)!;
			entry.agents.push(agent.agentId);
			entry.scores.push(pattern.avgScore);
		}
	}

	// Patterns seen by multiple agents are cross-agent patterns
	for (const [pattern, { agents: agentIds, scores }] of patternMap.entries()) {
		if (agentIds.length >= 2) {
			crossAgentPatterns.push({
				pattern,
				contributingAgents: agentIds,
				correlation: agentIds.length / agents.length,
				description: `Pattern "${pattern}" identified by ${agentIds.length} agents`,
				combinedInsight: `Cross-validated pattern with ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)} avg score`
			});
		}
	}

	// Unify recommendations
	const allRecs = agents.flatMap(a => a.recommendations.map(r => ({ ...r, agentId: a.agentId })));
	const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
	const sortedRecs = allRecs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

	const unifiedRecommendations: UnifiedRecommendation[] = sortedRecs.slice(0, 10).map((rec, i) => ({
		id: `rec-${i + 1}`,
		priority: 10 - i,
		title: rec.title,
		description: rec.description,
		contributingAgents: [rec.agentId],
		expectedImpact: rec.expectedImpact,
		implementation: [rec.rationale],
		trackingMetrics: rec.relatedPatterns
	}));

	// Identify gaps across all agents
	const gaps: GapAnalysis[] = [];
	const gapRecs = allRecs.filter(r => r.type === 'gap');

	for (const gap of gapRecs) {
		gaps.push({
			area: gap.title,
			description: gap.description,
			identifiedBy: [gap.agentId],
			severity: gap.priority === 'critical' ? 'critical' : gap.priority === 'high' ? 'moderate' : 'minor',
			suggestedFix: gap.rationale
		});
	}

	// Calculate learning health score
	const dataQuantity = Math.min(100, (data.enhanced?.totalAnalyzed || 0) * 5);
	const dataQuality = Math.min(100, (data.enhanced?.engagementCorrelations?.length || 0) * 10);
	const patternDiversity = Math.min(100, crossAgentPatterns.length * 15);
	const trendClarity = Math.min(100, (data.enhanced?.trendData?.length || 0) * 4);

	const learningHealthScore = Math.round((dataQuantity + dataQuality + patternDiversity + trendClarity) / 4);

	return {
		crossAgentPatterns: crossAgentPatterns.slice(0, 10),
		unifiedRecommendations,
		gaps: gaps.slice(0, 5),
		learningHealthScore,
		healthBreakdown: {
			dataQuantity,
			dataQuality,
			patternDiversity,
			trendClarity
		}
	};
}

/**
 * Generate system-level insights about learning and improvement
 */
function generateSystemInsights(agents: AgentAnalysis[], data: LearningData): SystemInsight[] {
	const insights: SystemInsight[] = [];

	// Algorithm insight
	const algorithmAgent = agents.find(a => a.agentId === 'algorithm');
	if (algorithmAgent && algorithmAgent.topFindings.length > 0) {
		insights.push({
			type: 'algorithm',
			title: 'Algorithm Performance',
			insight: algorithmAgent.topFindings[0],
			evidence: algorithmAgent.topFindings.slice(1, 3),
			recommendation: algorithmAgent.recommendations[0]?.title || 'Continue current strategy'
		});
	}

	// Psychology insight
	const psychologyAgent = agents.find(a => a.agentId === 'psychology');
	if (psychologyAgent && psychologyAgent.topFindings.length > 0) {
		insights.push({
			type: 'psychology',
			title: 'Audience Psychology',
			insight: psychologyAgent.topFindings[0],
			evidence: psychologyAgent.topFindings.slice(1, 3),
			recommendation: psychologyAgent.recommendations[0]?.title || 'Maintain emotional resonance'
		});
	}

	// Content insight
	const contentAgent = agents.find(a => a.agentId === 'content-strategy');
	if (contentAgent && contentAgent.topFindings.length > 0) {
		insights.push({
			type: 'content',
			title: 'Content Strategy',
			insight: contentAgent.topFindings[0],
			evidence: contentAgent.topFindings.slice(1, 3),
			recommendation: contentAgent.recommendations[0]?.title || 'Diversify content types'
		});
	}

	// Platform insight
	const marketingAgent = agents.find(a => a.agentId === 'marketing');
	if (marketingAgent && marketingAgent.topFindings.length > 0) {
		insights.push({
			type: 'platform',
			title: 'Viral Mechanics',
			insight: marketingAgent.topFindings[0],
			evidence: marketingAgent.topFindings.slice(1, 3),
			recommendation: marketingAgent.recommendations[0]?.title || 'Optimize viral loops'
		});
	}

	// System improvement insight
	const totalData = data.enhanced?.totalAnalyzed || 0;
	const engagementCorrs = data.enhanced?.engagementCorrelations?.length || 0;

	if (totalData < 10) {
		insights.push({
			type: 'improvement',
			title: 'Need More Data',
			insight: `Only ${totalData} content pieces analyzed. Patterns are not yet statistically significant.`,
			evidence: ['Minimum 20+ analyses recommended', 'Current confidence levels are low'],
			recommendation: 'Analyze more content to improve pattern detection accuracy'
		});
	} else if (engagementCorrs < 5) {
		insights.push({
			type: 'improvement',
			title: 'Engagement Data Missing',
			insight: 'Limited engagement metrics in analyzed content',
			evidence: ['Tweet URL analysis captures real engagement', 'Manual entries lack engagement data'],
			recommendation: 'Use Tweet URL mode for richer engagement analytics'
		});
	} else {
		insights.push({
			type: 'improvement',
			title: 'Learning System Healthy',
			insight: `Strong data foundation: ${totalData} analyses with ${engagementCorrs} engagement patterns`,
			evidence: [`${agents.filter(a => a.confidence > 0.7).length}/8 agents have high confidence`],
			recommendation: 'Continue feeding content for even better insights'
		});
	}

	return insights;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
	analyzeAsMarketingAgent,
	analyzeAsCopywritingAgent,
	analyzeAsViralHooksAgent,
	analyzeAsContentStrategyAgent,
	analyzeAsPsychologyAgent,
	analyzeAsAlgorithmAgent,
	analyzeAsResearchAgent,
	analyzeAsVisualAgent
};
