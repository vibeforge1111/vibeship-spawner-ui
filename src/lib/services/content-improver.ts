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
// EXPORTS
// =============================================================================

export {
	detectHookType,
	detectAntiPatterns,
	estimateCurrentScore
};
