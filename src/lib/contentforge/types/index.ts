/**
 * ContentForge Types
 *
 * Type definitions for the viral content analysis pipeline.
 * Following TypeScript strict mode patterns.
 */

// =============================================================================
// Faucet Module Types
// =============================================================================

export interface FaucetInput {
	url: string;
	category: ContentCategory;
	priority: 'low' | 'normal' | 'high' | 'urgent';
	tags: string[];
	requestedAgents: AgentType[] | 'all';
	callbackUrl?: string;
}

export type ContentCategory =
	| 'vibe_coding'
	| 'tech_ai'
	| 'business'
	| 'lifestyle'
	| 'educational';

export type AgentType =
	| 'marketing'
	| 'copywriting'
	| 'research'
	| 'psychology';

// =============================================================================
// Scraped Data Types
// =============================================================================

export interface ScrapedData {
	postId: string;
	url: string;
	author: AuthorInfo;
	content: ContentInfo;
	metrics: EngagementMetrics;
	temporal: TemporalInfo;
}

export interface AuthorInfo {
	username: string;
	displayName: string;
	followers: number;
	verified: boolean;
	bio?: string;
	profileImageUrl?: string;
}

export interface ContentInfo {
	text: string;
	media: MediaItem[];
	hashtags: string[];
	mentions: string[];
	threadLength: number;
}

export interface MediaItem {
	type: 'image' | 'video' | 'gif';
	url: string;
	altText?: string;
	duration?: number;
}

export interface EngagementMetrics {
	likes: number;
	retweets: number;
	replies: number;
	bookmarks: number;
	views: number;
	engagementRate: number;
}

export interface TemporalInfo {
	postedAt: string;
	scrapedAt: string;
}

// =============================================================================
// Agent Output Types
// =============================================================================

export interface AgentOutput<T = unknown> {
	agentType: AgentType;
	success: boolean;
	error?: string;
	data: T;
	confidence: number; // 0-1
	processingTimeMs: number;
}

export interface MarketingAnalysis {
	positioning: {
		authorityLevel: 'emerging' | 'established' | 'thought_leader';
		niche: string;
		differentiators: string[];
	};
	valueProposition: {
		primaryValue: string;
		secondaryValues: string[];
		targetPainPoints: string[];
	};
	targetAudience: {
		demographics: string[];
		psychographics: string[];
		interests: string[];
	};
	distributionFactors: {
		shareability: number; // 0-10
		reasons: string[];
	};
	recommendations: string[];
}

export interface CopywritingAnalysis {
	hook: {
		type: 'question' | 'statement' | 'story' | 'statistic' | 'contrarian';
		effectiveness: number; // 0-10
		elements: string[];
	};
	structure: {
		format: 'single' | 'thread' | 'listicle' | 'story';
		readabilityScore: number;
		flowAnalysis: string;
	};
	powerWords: {
		emotional: string[];
		action: string[];
		sensory: string[];
	};
	templates: {
		extracted: string;
		category: string;
		reusability: number; // 0-10
	}[];
}

export interface ResearchAnalysis {
	trendContext: {
		currentTrends: string[];
		relevanceScore: number;
		trendPhase: 'emerging' | 'growing' | 'peak' | 'declining';
	};
	timing: {
		optimalPostTime: string;
		seasonalFactors: string[];
		eventAlignment: string[];
	};
	competitiveLandscape: {
		similarContent: string[];
		differentiationOpportunities: string[];
	};
	opportunityGaps: string[];
}

export interface PsychologyAnalysis {
	emotionalTriggers: {
		primary: string;
		secondary: string[];
		intensity: number; // 0-10
	};
	cognitiveBiases: {
		biasType: string;
		application: string;
		effectiveness: number;
	}[];
	identityResonance: {
		inGroup: string;
		aspirationalIdentity: string;
		tribalDynamics: string;
	};
	motivationalDrivers: string[];
}

// =============================================================================
// Synthesis Types
// =============================================================================

export interface SynthesisResult {
	postId: string;
	viralityScore: number; // 0-100
	keyInsights: string[];
	patternCorrelations: PatternCorrelation[];
	playbook: ContentPlaybook;
	createdAt: string;
}

export interface PatternCorrelation {
	pattern: string;
	agents: AgentType[];
	confidence: number;
	impact: 'high' | 'medium' | 'low';
}

export interface ContentPlaybook {
	title: string;
	summary: string;
	steps: PlaybookStep[];
	estimatedImpact: number;
}

export interface PlaybookStep {
	order: number;
	action: string;
	rationale: string;
	examples?: string[];
}

// =============================================================================
// Queue Types
// =============================================================================

export interface QueueItem {
	id: string;
	input: FaucetInput;
	status: QueueStatus;
	priority: number;
	createdAt: string;
	startedAt?: string;
	completedAt?: string;
	error?: string;
}

export type QueueStatus =
	| 'pending'
	| 'processing'
	| 'completed'
	| 'failed'
	| 'cancelled';
