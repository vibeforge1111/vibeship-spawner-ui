/**
 * Content Improvement Engine
 *
 * Analyzes draft content and provides improvement recommendations
 * based on learned patterns from Mind v5.
 *
 * Works alongside Analyze Mode - this is "Improve Mode"
 */

import {
	extractTopicsFromContent,
	getTopicInsights,
	getSubtopicStats,
	type ExtractedTopics,
	type TopicInsight,
	type SubtopicPerformance
} from './topic-learning';

import {
	getPatternStats,
	getTopPatterns,
	type PatternStats,
	type ViralPattern
} from './viral-patterns';

import {
	getUserStyle,
	type UserStyle
} from './contentforge-mind';

// =============================================================================
// TYPES
// =============================================================================

export type HookType =
	| 'contrarian'
	| 'curiosity_gap'
	| 'transformation'
	| 'number_list'
	| 'direct_claim'
	| 'question'
	| 'story'
	| 'shock'
	| 'none';

export type EmotionType =
	| 'fomo'
	| 'aspiration'
	| 'curiosity'
	| 'validation'
	| 'outrage'
	| 'awe'
	| 'none';

export type Effectiveness = 'weak' | 'moderate' | 'strong';
export type ImpactLevel = 'low' | 'medium' | 'high';

export interface HookAnalysis {
	detected: boolean;
	type: HookType | null;
	strength: number; // 0-1
	suggestions: string[];
	basedOn: string; // "Your top hooks: curiosity_gap (avg 78)"
}

export interface TopicAnalysis {
	detected: string[];
	missing: string[]; // Hot topics not mentioned
	subtopicGaps: string[]; // Hot subtopics to consider
	keywordsToAdd: string[];
	recommendation: string;
}

export interface DetectedEmotion {
	type: EmotionType;
	strength: number; // 0-1
}

export interface EmotionAnalysis {
	detected: DetectedEmotion[];
	suggestions: string[];
	basedOn: string;
}

export interface StructureAnalysis {
	current: string;
	optimal: string;
	recommendation: string;
	example: string;
}

export interface LineImprovement {
	lineNumber: number;
	original: string;
	type: 'weak_hook' | 'anti_pattern' | 'opportunity' | 'missing_emotion';
	suggestion: string | null;
	reason: string;
}

export interface AntiPatternWarning {
	type: string;
	severity: 'low' | 'medium' | 'high';
	message: string;
	suggestion: string | null;
	line: string | null;
}

export interface FullRewrite {
	version: string; // "Hook-focused", "Emotion-focused", etc.
	content: string;
	estimatedScore: number;
	changes: string[];
}

export interface ContentImprovements {
	currentScore: number;
	potentialScore: number;
	hook: HookAnalysis;
	topics: TopicAnalysis;
	emotion: EmotionAnalysis;
	structure: StructureAnalysis;
	lineImprovements: LineImprovement[];
	warnings: AntiPatternWarning[];
	fullRewrites: FullRewrite[];
}

export interface ImprovementRequest {
	content: string;
	platform?: 'twitter' | 'linkedin' | 'threads';
	targetTopic?: string;
}

// =============================================================================
// VISUAL ANALYSIS TYPES
// =============================================================================

export interface VisualAnalysis {
	composition: {
		type: 'centered' | 'rule_of_thirds' | 'golden_ratio' | 'symmetrical' | 'dynamic' | 'unknown';
		score: number; // 0-100
		recommendation: string | null;
	};
	colors: {
		dominantColors: string[]; // hex codes
		contrast: 'low' | 'medium' | 'high';
		brightness: 'dark' | 'balanced' | 'bright';
		recommendation: string | null;
	};
	textOverlay: {
		detected: boolean;
		readable: boolean | null;
		recommendation: string | null;
	};
	scrollStop: {
		score: number; // 0-100
		strengths: string[];
		weaknesses: string[];
		recommendation: string | null;
	};
	platformFit: {
		aspectRatio: string; // "16:9", "1:1", "4:3", etc.
		optimal: boolean;
		recommendation: string | null;
	};
	altText: {
		current: string | null;
		suggested: string;
	};
}

export interface MediaAnalysisRequest {
	file: File;
	platform: 'twitter' | 'linkedin' | 'threads';
	contentContext?: string; // The text content for alt text generation
}

// =============================================================================
// HOOK DETECTION PATTERNS
// =============================================================================

const HOOK_PATTERNS: Record<HookType, RegExp[]> = {
	contrarian: [
		/unpopular opinion/i,
		/hot take/i,
		/controversial/i,
		/everyone['']s wrong about/i,
		/stop (saying|doing|believing)/i,
		/the truth about/i,
		/nobody talks about/i
	],
	curiosity_gap: [
		/the (one|only) (thing|trick|secret)/i,
		/what (nobody|no one) tells you/i,
		/here['']s (what|why)/i,
		/the (secret|hidden|real) reason/i,
		/most people (don['']t|never)/i,
		/what i (wish|learned)/i
	],
	transformation: [
		/i (went|changed) from .* to/i,
		/how i (went|changed)/i,
		/\d+ (months?|years?|weeks?) ago/i,
		/before.*after/i,
		/used to.*now/i,
		/changed (my|how|everything)/i
	],
	number_list: [
		/^\d+\s+(things?|ways?|tips?|lessons?|mistakes?|reasons?)/i,
		/top \d+/i,
		/\d+ (simple|easy|quick)/i
	],
	direct_claim: [
		/^(this|it)['']s (the best|amazing|incredible)/i,
		/game.?changer/i,
		/^you (need|should|must)/i
	],
	question: [
		/^(why|what|how|when|where|who|which) /i,
		/\?$/,
		/ever wonder/i
	],
	story: [
		/^(last|yesterday|today|this) (week|month|year|morning)/i,
		/^i (just|recently)/i,
		/^so (i|we|this)/i,
		/let me tell you/i,
		/true story/i
	],
	shock: [
		/\$[\d,]+/,
		/\d+%/,
		/(insane|crazy|wild|unbelievable)/i,
		/you won['']t believe/i,
		/mind.?blown/i
	],
	none: []
};

// =============================================================================
// EMOTION DETECTION PATTERNS
// =============================================================================

const EMOTION_PATTERNS: Record<EmotionType, RegExp[]> = {
	fomo: [
		/don['']t miss/i,
		/limited (time|spots?)/i,
		/before it['']s (too late|gone)/i,
		/everyone['']s (doing|using|talking)/i,
		/you['']re missing out/i
	],
	aspiration: [
		/achieve/i,
		/success/i,
		/dream/i,
		/goal/i,
		/level up/i,
		/10x/i,
		/transform/i,
		/unlock/i
	],
	curiosity: [
		/secret/i,
		/hidden/i,
		/discover/i,
		/reveal/i,
		/the truth/i,
		/find out/i,
		/learn (how|why|what)/i
	],
	validation: [
		/you['']re (right|not alone)/i,
		/we['']ve all/i,
		/it['']s okay to/i,
		/you deserve/i,
		/finally someone/i
	],
	outrage: [
		/this is (wrong|broken|insane)/i,
		/can['']t believe/i,
		/ridiculous/i,
		/unacceptable/i,
		/needs to stop/i
	],
	awe: [
		/amazing/i,
		/incredible/i,
		/beautiful/i,
		/mind.?blow/i,
		/wow/i,
		/breathtaking/i
	],
	none: []
};

// =============================================================================
// ANTI-PATTERNS (What NOT to do)
// =============================================================================

const ANTI_PATTERNS: { pattern: RegExp; name: string; fix: string; example: string; severity: 'low' | 'medium' | 'high' }[] = [
	{
		pattern: /it['']s (pretty |really |quite )?(good|nice|cool|interesting)/i,
		name: 'Vague praise',
		fix: 'Use specific metrics or outcomes instead',
		example: '"Good" → "Saved me 3 hours daily"',
		severity: 'medium'
	},
	{
		pattern: /various (things|stuff|aspects)/i,
		name: 'Generic language',
		fix: 'List 2-3 specific examples',
		example: '"Various things" → "Debugging, refactoring, and test generation"',
		severity: 'medium'
	},
	{
		pattern: /would recommend/i,
		name: 'Weak call-to-action',
		fix: 'Make a direct value statement',
		example: '"Would recommend" → "This will change how you code"',
		severity: 'low'
	},
	{
		pattern: /i think (that )?maybe/i,
		name: 'Hedging language',
		fix: 'Be direct and confident',
		example: '"I think maybe" → "Here\'s the truth:"',
		severity: 'medium'
	},
	{
		pattern: /^(so|well|anyway|basically),? /i,
		name: 'Weak opener',
		fix: 'Start with the hook immediately',
		example: '"So basically..." → Lead with the value',
		severity: 'high'
	},
	{
		pattern: /a lot of|many|some|several/i,
		name: 'Vague quantities',
		fix: 'Use specific numbers',
		example: '"A lot of" → "47" or "3x more"',
		severity: 'low'
	},
	{
		pattern: /in my (humble )?opinion/i,
		name: 'Opinion qualifier',
		fix: 'State it directly (readers know it\'s your opinion)',
		example: 'Remove "in my opinion" entirely',
		severity: 'low'
	},
	{
		pattern: /just wanted to (share|say|mention)/i,
		name: 'Apologetic language',
		fix: 'Share directly without permission-seeking',
		example: '"Just wanted to share" → "Here\'s what I learned:"',
		severity: 'medium'
	}
];

// =============================================================================
// CORE IMPROVEMENT FUNCTIONS
// =============================================================================

/**
 * Main entry point - analyze draft and generate improvements
 */
export async function improveContent(
	request: ImprovementRequest
): Promise<ContentImprovements> {
	// Load all learned data in parallel
	const [topicInsights, patternStats, userStyle, topPatterns, subtopicStats] = await Promise.all([
		getTopicInsights(),
		getPatternStats(),
		getUserStyle(),
		getTopPatterns(undefined, 20),
		getSubtopicStats()
	]);

	// Extract what's in the draft
	const extractedTopics = extractTopicsFromContent(request.content);

	// Generate all analyses
	const hookAnalysis = analyzeHook(request.content, patternStats, userStyle, topPatterns);
	const topicAnalysis = analyzeTopics(extractedTopics, topicInsights, subtopicStats);
	const emotionAnalysis = analyzeEmotion(request.content, patternStats, userStyle);
	const structureAnalysis = analyzeStructure(request.content, patternStats);
	const lineImprovements = generateLineImprovements(request.content);
	const warnings = detectAntiPatterns(request.content);

	// Calculate scores
	const currentScore = estimateCurrentScore(hookAnalysis, topicAnalysis, emotionAnalysis, warnings);
	const potentialScore = estimatePotentialScore(currentScore, hookAnalysis, topicAnalysis, emotionAnalysis);

	// Generate full rewrites (local generation - no AI call)
	const fullRewrites = generateLocalRewrites(request.content, hookAnalysis, topicAnalysis, emotionAnalysis);

	return {
		currentScore,
		potentialScore,
		hook: hookAnalysis,
		topics: topicAnalysis,
		emotion: emotionAnalysis,
		structure: structureAnalysis,
		lineImprovements,
		warnings,
		fullRewrites
	};
}

/**
 * Detect hook type in content
 */
function detectHookType(content: string): HookType {
	const firstLine = content.split('\n')[0].trim();
	const textToCheck = firstLine || content.slice(0, 200);

	for (const [hookType, patterns] of Object.entries(HOOK_PATTERNS)) {
		if (hookType === 'none') continue;
		for (const pattern of patterns) {
			if (pattern.test(textToCheck)) {
				return hookType as HookType;
			}
		}
	}

	return 'none';
}

/**
 * Analyze hook and generate suggestions
 */
function analyzeHook(
	content: string,
	patternStats: PatternStats | null,
	userStyle: UserStyle | null,
	topPatterns: ViralPattern[]
): HookAnalysis {
	const detectedType = detectHookType(content);
	const hasHook = detectedType !== 'none';

	// Find user's best hooks from patterns
	const hookPatterns = topPatterns.filter(p => p.category === 'hook');
	const bestHooks = hookPatterns.slice(0, 3);
	const basedOn = bestHooks.length > 0
		? `Your top hooks: ${bestHooks.map(h => `${h.id} (avg ${h.avgScore})`).join(', ')}`
		: 'Analyze more content to learn your best hooks';

	// Determine strength (0-1)
	let strength = 0;
	if (hasHook) {
		const matchingPattern = hookPatterns.find(p =>
			p.id.toLowerCase().includes(detectedType.replace('_', ' '))
		);
		if (matchingPattern) {
			strength = matchingPattern.avgScore / 100;
		} else {
			strength = 0.5; // Has a hook but no data on it
		}
	}

	// Generate suggestions
	const suggestions: string[] = [];
	const subject = extractMainSubject(content);

	if (!hasHook) {
		// No hook - suggest some based on best performers
		suggestions.push(
			`The one thing nobody tells you about ${subject}...`,
			`I went from struggling to ${subject} mastery in 6 months. Here's how:`,
			`Unpopular opinion: Most people are using ${subject} wrong.`
		);
	} else if (strength < 0.6) {
		// Weak hook - suggest improvements
		suggestions.push(
			`Here's what ${subject} actually taught me (not what you'd expect):`,
			`The ${subject} trick that changed everything:`,
			`Why ${subject} works differently than you think:`
		);
	}

	return {
		detected: hasHook,
		type: hasHook ? detectedType : null,
		strength,
		suggestions,
		basedOn
	};
}

/**
 * Analyze topics and identify gaps
 */
function analyzeTopics(
	extracted: ExtractedTopics,
	insights: TopicInsight,
	subtopicStats: SubtopicPerformance[]
): TopicAnalysis {
	// Hot topics user isn't mentioning
	const hotTopicNames = insights.hotTopics.map(t => t.topic.toLowerCase());
	const detectedLower = extracted.primary.map(t => t.toLowerCase());
	const missingHot = hotTopicNames.filter(t => !detectedLower.includes(t));

	// Hot subtopics user isn't mentioning
	const hotSubtopics = insights.hotSubtopics || [];
	const detectedSubtopics = extracted.subtopics.map(s => s.subtopic.toLowerCase());
	const missingSubtopics = hotSubtopics
		.filter(s => !detectedSubtopics.includes(s.subtopic.toLowerCase()))
		.map(s => `${s.subtopic} (in ${s.mainTopic})`);

	// Keywords that perform well
	const keywordsToAdd: string[] = [];
	if (insights.hotSubtopics && insights.hotSubtopics.length > 0) {
		keywordsToAdd.push(...insights.hotSubtopics.slice(0, 3).map(s => s.subtopic));
	}

	// Generate recommendation
	let recommendation = '';
	if (extracted.primary.length === 0) {
		recommendation = 'No niche topics detected. Add relevant keywords for your audience.';
	} else if (missingSubtopics.length > 0) {
		recommendation = `Good topic coverage! Consider adding trending subtopics: ${missingSubtopics.slice(0, 2).join(', ')}`;
	} else {
		recommendation = 'Strong topic coverage for your niche.';
	}

	return {
		detected: extracted.primary,
		missing: missingHot.slice(0, 5),
		subtopicGaps: missingSubtopics.slice(0, 5),
		keywordsToAdd: keywordsToAdd.slice(0, 5),
		recommendation
	};
}

/**
 * Analyze emotional content
 */
function analyzeEmotion(
	content: string,
	patternStats: PatternStats | null,
	userStyle: UserStyle | null
): EmotionAnalysis {
	const detectedEmotions: DetectedEmotion[] = [];

	// Detect all emotions and their strengths
	for (const [emotionType, patterns] of Object.entries(EMOTION_PATTERNS)) {
		if (emotionType === 'none') continue;
		let count = 0;
		for (const pattern of patterns) {
			if (pattern.test(content)) count++;
		}
		if (count > 0) {
			// Strength is based on how many patterns matched vs total patterns
			const strength = Math.min(1, count / Math.max(1, patterns.length) + 0.3);
			detectedEmotions.push({
				type: emotionType as EmotionType,
				strength
			});
		}
	}

	// Sort by strength
	detectedEmotions.sort((a, b) => b.strength - a.strength);

	// Get user's best emotions
	const strongEmotions = userStyle?.strongEmotions || [];
	const basedOn = strongEmotions.length > 0
		? `Your audience responds to: ${strongEmotions.slice(0, 2).join(', ')}`
		: 'Analyze more content to learn what emotions resonate';

	// Generate suggestions
	const suggestions: string[] = [];

	if (detectedEmotions.length === 0) {
		suggestions.push(
			'Add outcome: "...and it changed everything"',
			'Add curiosity: "Here\'s what most people miss:"',
			'Add aspiration: "This is how you level up:"'
		);
	} else {
		const topEmotion = detectedEmotions[0];
		if (topEmotion.strength < 0.6) {
			suggestions.push(
				'Intensify with numbers: "3x faster", "80% less time"',
				'Add personal stake: "I wish I knew this sooner"'
			);
		}
		// Suggest emotions that perform well for this user
		if (strongEmotions.length > 0) {
			const missing = strongEmotions.filter(
				e => !detectedEmotions.find(d => d.type === e)
			);
			if (missing.length > 0) {
				suggestions.push(`Consider adding ${missing[0]} - it performs well for you`);
			}
		}
	}

	return {
		detected: detectedEmotions.slice(0, 3), // Top 3 emotions
		suggestions,
		basedOn
	};
}

/**
 * Analyze content structure
 */
function analyzeStructure(
	content: string,
	patternStats: PatternStats | null
): StructureAnalysis {
	const lines = content.split('\n').filter(l => l.trim());
	const hasBullets = /^[\-\*•]\s/m.test(content);
	const hasNumbers = /^\d+[\.\)]\s/m.test(content);
	const lineCount = lines.length;

	let current = 'single_block';
	if (hasBullets || hasNumbers) {
		current = 'list';
	} else if (lineCount > 5) {
		current = 'multi_paragraph';
	} else if (lineCount > 1) {
		current = 'short_paragraphs';
	}

	// Determine optimal based on content length
	const wordCount = content.split(/\s+/).length;
	let optimal = current;
	let recommendation = '';
	let example = '';

	if (wordCount > 100 && current === 'single_block') {
		optimal = 'list';
		recommendation = 'Long content works better as a list or with clear breaks.';
		example = 'Break into: Hook → 3-5 bullet points → CTA';
	} else if (wordCount < 50 && !hasBullets) {
		optimal = 'single_punch';
		recommendation = 'Short content - make every word count. Consider a punchy single statement.';
		example = 'Hook + One powerful insight + Clear takeaway';
	} else {
		recommendation = 'Structure looks appropriate for content length.';
		example = current;
	}

	return {
		current,
		optimal,
		recommendation,
		example
	};
}

/**
 * Generate line-by-line improvements
 */
function generateLineImprovements(content: string): LineImprovement[] {
	const improvements: LineImprovement[] = [];
	const lines = content.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line.trim()) continue;

		// Check each anti-pattern
		for (const ap of ANTI_PATTERNS) {
			if (ap.pattern.test(line)) {
				const rewrite = generateLineRewrite(line, ap);
				improvements.push({
					lineNumber: i + 1,
					original: line.slice(0, 100) + (line.length > 100 ? '...' : ''),
					type: 'anti_pattern',
					suggestion: rewrite !== line ? rewrite : null,
					reason: `${ap.name}: ${ap.fix}`
				});
				break; // One issue per line
			}
		}
	}

	return improvements.slice(0, 5); // Max 5 suggestions
}

/**
 * Generate a rewrite for a specific line issue
 */
function generateLineRewrite(line: string, antiPattern: typeof ANTI_PATTERNS[0]): string {
	// Simple pattern-based rewrites
	let rewrite = line;

	if (antiPattern.name === 'Vague praise') {
		rewrite = line.replace(/it['']s (pretty |really |quite )?(good|nice|cool|interesting)/i, 'it transformed my workflow');
	} else if (antiPattern.name === 'Generic language') {
		rewrite = line.replace(/various (things|stuff|aspects)/i, 'debugging, testing, and refactoring');
	} else if (antiPattern.name === 'Weak call-to-action') {
		rewrite = line.replace(/would recommend/i, 'will change how you work');
	} else if (antiPattern.name === 'Hedging language') {
		rewrite = line.replace(/i think (that )?maybe/i, 'The truth is:');
	} else if (antiPattern.name === 'Weak opener') {
		rewrite = line.replace(/^(so|well|anyway|basically),? /i, '');
	}

	return rewrite;
}

/**
 * Detect anti-patterns in content
 */
function detectAntiPatterns(content: string): AntiPatternWarning[] {
	const warnings: AntiPatternWarning[] = [];

	for (const ap of ANTI_PATTERNS) {
		const match = content.match(ap.pattern);
		if (match) {
			warnings.push({
				type: ap.name,
				severity: ap.severity || 'medium',
				message: `Detected "${ap.name}": "${match[0]}"`,
				suggestion: ap.fix,
				line: match[0]
			});
		}
	}

	return warnings;
}

/**
 * Estimate current score based on analysis
 */
function estimateCurrentScore(
	hook: HookAnalysis,
	topics: TopicAnalysis,
	emotion: EmotionAnalysis,
	warnings: AntiPatternWarning[]
): number {
	let score = 50; // Base score

	// Hook contribution (0-25 points)
	if (hook.detected) {
		score += hook.strength >= 0.7 ? 25 : hook.strength >= 0.5 ? 15 : 5;
	}

	// Topic contribution (0-15 points)
	if (topics.detected.length > 0) {
		score += Math.min(15, topics.detected.length * 5);
	}

	// Emotion contribution (0-15 points)
	if (emotion.detected.length > 0) {
		const topStrength = emotion.detected[0]?.strength || 0;
		score += topStrength >= 0.7 ? 15 : topStrength >= 0.5 ? 10 : 5;
	}

	// Anti-pattern penalty (-5 per warning, max -20)
	score -= Math.min(20, warnings.length * 5);

	return Math.max(0, Math.min(100, score));
}

/**
 * Estimate potential score after improvements
 */
function estimatePotentialScore(
	currentScore: number,
	hook: HookAnalysis,
	topics: TopicAnalysis,
	emotion: EmotionAnalysis
): number {
	let potential = currentScore;

	// Hook improvement potential
	if (hook.strength < 0.7) {
		potential += hook.strength >= 0.5 ? 10 : 20;
	}

	// Topic improvement potential
	if (topics.subtopicGaps.length > 0) {
		potential += Math.min(10, topics.subtopicGaps.length * 3);
	}

	// Emotion improvement potential
	const topStrength = emotion.detected[0]?.strength || 0;
	if (topStrength < 0.7) {
		potential += topStrength >= 0.5 ? 5 : 15;
	}

	return Math.min(100, potential);
}

/**
 * Extract main subject from content (simple heuristic)
 */
function extractMainSubject(content: string): string {
	// Look for common tech terms
	const techTerms = ['claude', 'ai', 'coding', 'development', 'programming', 'tools', 'workflow'];
	const lowerContent = content.toLowerCase();

	for (const term of techTerms) {
		if (lowerContent.includes(term)) {
			if (term === 'claude') return 'Claude Code';
			if (term === 'ai') return 'AI';
			return term;
		}
	}

	// Fall back to first noun-like word
	const words = content.split(/\s+/).slice(0, 20);
	for (const word of words) {
		if (word.length > 4 && /^[A-Z]/.test(word)) {
			return word;
		}
	}

	return 'this';
}

/**
 * Generate local rewrites (no AI call)
 */
function generateLocalRewrites(
	content: string,
	hook: HookAnalysis,
	topics: TopicAnalysis,
	emotion: EmotionAnalysis
): FullRewrite[] {
	const rewrites: FullRewrite[] = [];
	const firstLine = content.split('\n')[0] || '';
	const restOfContent = content.split('\n').slice(1).join('\n');

	// Hook-optimized rewrite
	if (hook.suggestions.length > 0) {
		rewrites.push({
			version: 'Hook-Optimized',
			content: `${hook.suggestions[0]}\n\n${restOfContent || content}`,
			estimatedScore: Math.min(100, estimateCurrentScore(
				{ ...hook, detected: true, strength: 0.8 },
				topics,
				emotion,
				[]
			) + 15),
			changes: ['Stronger opening hook', 'Curiosity-driven intro']
		});
	}

	// Emotion-focused rewrite
	const emotionEnhanced = content + '\n\nThis changed everything for me.';
	const strongEmotion: DetectedEmotion = { type: 'aspiration', strength: 0.8 };
	rewrites.push({
		version: 'Emotion-Amplified',
		content: emotionEnhanced,
		estimatedScore: Math.min(100, estimateCurrentScore(
			hook,
			topics,
			{ ...emotion, detected: [strongEmotion, ...emotion.detected] },
			[]
		) + 10),
		changes: ['Added emotional closer', 'Personal transformation element']
	});

	// Topic-rich rewrite
	if (topics.keywordsToAdd.length > 0) {
		const keywords = topics.keywordsToAdd.slice(0, 2).join(' and ');
		const topicEnhanced = `${firstLine}\n\nKey insight on ${keywords}:\n${restOfContent || content}`;
		rewrites.push({
			version: 'Topic-Enhanced',
			content: topicEnhanced,
			estimatedScore: Math.min(100, estimateCurrentScore(
				hook,
				{ ...topics, detected: [...topics.detected, ...topics.keywordsToAdd] },
				emotion,
				[]
			) + 8),
			changes: [`Added trending subtopics: ${keywords}`, 'Better keyword coverage']
		});
	}

	return rewrites;
}

// =============================================================================
// AI-POWERED REWRITE GENERATION
// =============================================================================

export interface AIRewriteRequest {
	draft: string;
	improvements: ContentImprovements;
	platform?: 'twitter' | 'linkedin' | 'threads';
	style?: 'professional' | 'casual' | 'engaging';
}

export interface AIRewriteResult {
	success: boolean;
	rewrites: FullRewrite[];
	error?: string;
}

/**
 * Generate AI-powered rewrites via the Claude bridge
 * This sends a request to Claude Code for intelligent rewriting
 */
export async function requestAIRewrites(
	request: AIRewriteRequest
): Promise<AIRewriteResult> {
	const requestId = `rewrite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

	try {
		// Build context for Claude
		const context = buildRewriteContext(request);

		// Write to file for Claude to read
		const response = await fetch('/api/contentforge/rewrite/request', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				requestId,
				draft: request.draft,
				context,
				platform: request.platform || 'twitter',
				timestamp: new Date().toISOString()
			})
		});

		if (!response.ok) {
			throw new Error('Failed to submit rewrite request');
		}

		// Poll for result (Claude Code will process and respond)
		const result = await pollForRewriteResult(requestId, 60000); // 60s timeout
		return result;
	} catch (e) {
		console.error('[ContentImprover] AI rewrite failed:', e);
		return {
			success: false,
			rewrites: [],
			error: e instanceof Error ? e.message : 'Unknown error'
		};
	}
}

/**
 * Build context string for Claude to generate rewrites
 */
function buildRewriteContext(request: AIRewriteRequest): string {
	const { improvements } = request;
	const lines: string[] = [];

	lines.push('## Content Analysis Summary\n');

	// Hook analysis
	if (improvements.hook.detected) {
		lines.push(`Hook: ${improvements.hook.type} (${(improvements.hook.strength * 100).toFixed(0)}% strength)`);
	} else {
		lines.push('Hook: None detected - needs a strong opening');
	}

	// Topics
	if (improvements.topics.detected.length > 0) {
		lines.push(`Topics: ${improvements.topics.detected.join(', ')}`);
	}
	if (improvements.topics.missing.length > 0) {
		lines.push(`Missing hot topics: ${improvements.topics.missing.join(', ')}`);
	}
	if (improvements.topics.subtopicGaps.length > 0) {
		lines.push(`Subtopic opportunities: ${improvements.topics.subtopicGaps.join(', ')}`);
	}

	// Emotions
	if (improvements.emotion.detected.length > 0) {
		const emotions = improvements.emotion.detected.map(e => `${e.type} (${(e.strength * 100).toFixed(0)}%)`);
		lines.push(`Emotions detected: ${emotions.join(', ')}`);
	}
	if (improvements.emotion.suggestions.length > 0) {
		lines.push(`Emotion suggestions: ${improvements.emotion.suggestions.join('; ')}`);
	}

	// Anti-patterns
	if (improvements.warnings.length > 0) {
		lines.push('\n## Issues to Fix:');
		for (const w of improvements.warnings.slice(0, 3)) {
			lines.push(`- ${w.type}: ${w.message}`);
		}
	}

	// Scores
	lines.push(`\nCurrent estimated score: ${improvements.currentScore}`);
	lines.push(`Potential score: ${improvements.potentialScore}`);

	return lines.join('\n');
}

/**
 * Poll for rewrite result from Claude
 */
async function pollForRewriteResult(
	requestId: string,
	timeoutMs: number
): Promise<AIRewriteResult> {
	const startTime = Date.now();
	const pollInterval = 2000;

	while (Date.now() - startTime < timeoutMs) {
		try {
			const response = await fetch(`/api/contentforge/rewrite/result?requestId=${requestId}`);

			if (response.ok) {
				const data = await response.json();
				if (data.status === 'complete') {
					return {
						success: true,
						rewrites: data.rewrites || []
					};
				} else if (data.status === 'error') {
					return {
						success: false,
						rewrites: [],
						error: data.error
					};
				}
				// Still pending, continue polling
			}
		} catch (e) {
			console.warn('[ContentImprover] Poll error:', e);
		}

		await new Promise(resolve => setTimeout(resolve, pollInterval));
	}

	return {
		success: false,
		rewrites: [],
		error: 'Timeout waiting for AI rewrites'
	};
}

// =============================================================================
// VISUAL ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Platform optimal aspect ratios
 */
const PLATFORM_ASPECTS: Record<string, string[]> = {
	twitter: ['1:1', '16:9', '4:3'],
	linkedin: ['1.91:1', '1:1', '4:5'],
	threads: ['1:1', '4:5', '9:16']
};

/**
 * Analyze uploaded media for visual optimization
 */
export async function analyzeMedia(request: MediaAnalysisRequest): Promise<VisualAnalysis> {
	const { file, platform, contentContext } = request;

	// Load image for analysis
	const imageData = await loadImageData(file);

	// Analyze composition
	const composition = analyzeComposition(imageData);

	// Analyze colors
	const colors = analyzeColors(imageData);

	// Check for text overlay
	const textOverlay = analyzeTextOverlay(imageData);

	// Calculate scroll-stop score
	const scrollStop = calculateScrollStopScore(composition, colors, textOverlay);

	// Check platform fit
	const platformFit = analyzePlatformFit(imageData, platform);

	// Generate alt text suggestion
	const altText = generateAltText(contentContext, file.name);

	return {
		composition,
		colors,
		textOverlay,
		scrollStop,
		platformFit,
		altText
	};
}

/**
 * Load image data for analysis
 */
async function loadImageData(file: File): Promise<{
	width: number;
	height: number;
	aspectRatio: number;
	pixels?: Uint8ClampedArray;
}> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			// Sample at lower resolution for performance
			const maxSize = 200;
			const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
			canvas.width = img.width * scale;
			canvas.height = img.height * scale;

			if (ctx) {
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

				resolve({
					width: img.width,
					height: img.height,
					aspectRatio: img.width / img.height,
					pixels: imageData.data
				});
			} else {
				resolve({
					width: img.width,
					height: img.height,
					aspectRatio: img.width / img.height
				});
			}

			URL.revokeObjectURL(url);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}

/**
 * Analyze image composition
 */
function analyzeComposition(imageData: { width: number; height: number; pixels?: Uint8ClampedArray }): VisualAnalysis['composition'] {
	const { width, height, pixels } = imageData;

	// Without pixel data, make basic assessment based on aspect ratio
	if (!pixels) {
		return {
			type: 'unknown',
			score: 50,
			recommendation: 'Enable image analysis for detailed composition feedback'
		};
	}

	// Simple brightness distribution analysis to detect centering
	const centerWeight = calculateCenterWeight(pixels, Math.ceil(width * 0.1), Math.ceil(height * 0.1));

	let type: VisualAnalysis['composition']['type'] = 'unknown';
	let score = 50;
	let recommendation: string | null = null;

	if (centerWeight > 0.6) {
		type = 'centered';
		score = 60;
		recommendation = 'Consider using rule of thirds for more dynamic composition';
	} else if (centerWeight < 0.4) {
		type = 'dynamic';
		score = 75;
		recommendation = null;
	} else {
		type = 'rule_of_thirds';
		score = 80;
		recommendation = null;
	}

	return { type, score, recommendation };
}

/**
 * Calculate how much visual weight is in the center
 */
function calculateCenterWeight(pixels: Uint8ClampedArray, width: number, height: number): number {
	let centerBrightness = 0;
	let edgeBrightness = 0;
	let centerCount = 0;
	let edgeCount = 0;

	const centerX1 = width * 0.33;
	const centerX2 = width * 0.66;
	const centerY1 = height * 0.33;
	const centerY2 = height * 0.66;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;

			const isCenter = x >= centerX1 && x <= centerX2 && y >= centerY1 && y <= centerY2;

			if (isCenter) {
				centerBrightness += brightness;
				centerCount++;
			} else {
				edgeBrightness += brightness;
				edgeCount++;
			}
		}
	}

	const avgCenter = centerCount > 0 ? centerBrightness / centerCount : 0;
	const avgEdge = edgeCount > 0 ? edgeBrightness / edgeCount : 0;

	// Higher contrast in center = more centered composition
	return avgCenter > avgEdge ? 0.5 + (avgCenter - avgEdge) / 500 : 0.5 - (avgEdge - avgCenter) / 500;
}

/**
 * Analyze image colors
 */
function analyzeColors(imageData: { pixels?: Uint8ClampedArray }): VisualAnalysis['colors'] {
	const { pixels } = imageData;

	if (!pixels) {
		return {
			dominantColors: [],
			contrast: 'medium',
			brightness: 'balanced',
			recommendation: null
		};
	}

	// Sample colors
	const colorCounts = new Map<string, number>();
	let totalBrightness = 0;
	let minBrightness = 255;
	let maxBrightness = 0;

	for (let i = 0; i < pixels.length; i += 16) { // Sample every 4th pixel
		const r = pixels[i];
		const g = pixels[i + 1];
		const b = pixels[i + 2];

		// Quantize to reduce colors
		const qr = Math.round(r / 32) * 32;
		const qg = Math.round(g / 32) * 32;
		const qb = Math.round(b / 32) * 32;

		const hex = `#${qr.toString(16).padStart(2, '0')}${qg.toString(16).padStart(2, '0')}${qb.toString(16).padStart(2, '0')}`;
		colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);

		const brightness = (r + g + b) / 3;
		totalBrightness += brightness;
		minBrightness = Math.min(minBrightness, brightness);
		maxBrightness = Math.max(maxBrightness, brightness);
	}

	// Get dominant colors
	const sortedColors = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);
	const dominantColors = sortedColors.slice(0, 5).map(([color]) => color);

	// Calculate average brightness
	const avgBrightness = totalBrightness / (pixels.length / 16);
	const brightness: VisualAnalysis['colors']['brightness'] =
		avgBrightness < 85 ? 'dark' : avgBrightness > 170 ? 'bright' : 'balanced';

	// Calculate contrast
	const contrastRange = maxBrightness - minBrightness;
	const contrast: VisualAnalysis['colors']['contrast'] =
		contrastRange < 100 ? 'low' : contrastRange > 180 ? 'high' : 'medium';

	let recommendation: string | null = null;
	if (contrast === 'low') {
		recommendation = 'Add more contrast to make content pop in feeds';
	} else if (brightness === 'dark') {
		recommendation = 'Dark images may get lost in dark mode feeds - add highlights';
	}

	return { dominantColors, contrast, brightness, recommendation };
}

/**
 * Check for text overlay
 */
function analyzeTextOverlay(imageData: { pixels?: Uint8ClampedArray }): VisualAnalysis['textOverlay'] {
	// Basic detection - would need OCR for real detection
	// For now, return conservative defaults
	return {
		detected: false,
		readable: null,
		recommendation: 'Consider adding a title overlay to increase scroll-stop'
	};
}

/**
 * Calculate scroll-stop score
 */
function calculateScrollStopScore(
	composition: VisualAnalysis['composition'],
	colors: VisualAnalysis['colors'],
	textOverlay: VisualAnalysis['textOverlay']
): VisualAnalysis['scrollStop'] {
	const strengths: string[] = [];
	const weaknesses: string[] = [];
	let score = 50;

	// Composition impact
	if (composition.type === 'rule_of_thirds' || composition.type === 'dynamic') {
		strengths.push('Good visual balance');
		score += 15;
	} else if (composition.type === 'centered') {
		weaknesses.push('Centered composition may feel static');
		score += 5;
	}

	// Color impact
	if (colors.contrast === 'high') {
		strengths.push('High contrast catches attention');
		score += 15;
	} else if (colors.contrast === 'low') {
		weaknesses.push('Low contrast may blend into feed');
		score -= 5;
	}

	if (colors.brightness === 'balanced') {
		strengths.push('Balanced brightness');
		score += 5;
	}

	// Text overlay impact
	if (textOverlay.detected && textOverlay.readable) {
		strengths.push('Text overlay adds context');
		score += 10;
	} else if (!textOverlay.detected) {
		weaknesses.push('No text overlay - missing hook opportunity');
	}

	// Cap score
	score = Math.max(0, Math.min(100, score));

	let recommendation: string | null = null;
	if (score < 60) {
		recommendation = weaknesses.length > 0
			? `Consider: ${weaknesses[0]}`
			: 'Add visual interest with annotations or text';
	}

	return { score, strengths, weaknesses, recommendation };
}

/**
 * Check if image fits platform requirements
 */
function analyzePlatformFit(
	imageData: { width: number; height: number; aspectRatio: number },
	platform: string
): VisualAnalysis['platformFit'] {
	const { width, height, aspectRatio } = imageData;

	// Calculate aspect ratio string
	const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
	const divisor = gcd(width, height);
	const aspectW = width / divisor;
	const aspectH = height / divisor;

	// Simplify to common ratios
	let aspectString: string;
	if (Math.abs(aspectRatio - 1) < 0.05) {
		aspectString = '1:1';
	} else if (Math.abs(aspectRatio - 16 / 9) < 0.1) {
		aspectString = '16:9';
	} else if (Math.abs(aspectRatio - 4 / 3) < 0.1) {
		aspectString = '4:3';
	} else if (Math.abs(aspectRatio - 9 / 16) < 0.1) {
		aspectString = '9:16';
	} else if (Math.abs(aspectRatio - 4 / 5) < 0.1) {
		aspectString = '4:5';
	} else if (Math.abs(aspectRatio - 1.91) < 0.1) {
		aspectString = '1.91:1';
	} else {
		aspectString = `${aspectW}:${aspectH}`;
	}

	const optimalRatios = PLATFORM_ASPECTS[platform] || PLATFORM_ASPECTS.twitter;
	const optimal = optimalRatios.includes(aspectString);

	let recommendation: string | null = null;
	if (!optimal) {
		recommendation = `Crop to ${optimalRatios[0]} for better ${platform} feed presence`;
	}

	return { aspectRatio: aspectString, optimal, recommendation };
}

/**
 * Generate suggested alt text
 */
function generateAltText(
	contentContext?: string,
	fileName?: string
): VisualAnalysis['altText'] {
	// Extract keywords from content context
	const keywords: string[] = [];

	if (contentContext) {
		// Extract nouns/topics from content
		const words = contentContext.toLowerCase().split(/\s+/);
		const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'this', 'that']);

		for (const word of words) {
			const clean = word.replace(/[^a-z]/g, '');
			if (clean.length > 3 && !stopWords.has(clean)) {
				keywords.push(clean);
			}
		}
	}

	// Build suggested alt text
	let suggested = 'Image';

	if (keywords.length > 0) {
		const topKeywords = keywords.slice(0, 5);
		suggested = `Image related to ${topKeywords.join(', ')}`;
	} else if (fileName) {
		const cleanName = fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
		if (cleanName.length > 2) {
			suggested = `Image: ${cleanName}`;
		}
	}

	return {
		current: null,
		suggested
	};
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
	detectHookType,
	detectAntiPatterns,
	estimateCurrentScore,
	buildRewriteContext
};
