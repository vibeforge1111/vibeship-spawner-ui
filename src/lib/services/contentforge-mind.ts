/**
 * ContentForge Mind Integration
 *
 * Connects ContentForge to Mind v5 for learning and pattern recognition.
 *
 * Features:
 * - Save analysis results as memories
 * - Query past patterns before analyzing
 * - Build a model of user's style over time
 * - Recommend based on what worked before
 */

import { browser } from '$app/environment';

const MIND_API = 'http://localhost:8080';
const DEFAULT_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

// =============================================================================
// TYPES
// =============================================================================

export interface ContentForgeMemory {
	content: string;
	viralityScore: number;
	keyPatterns: string[];
	hookType: string;
	emotionalTrigger: string;
	platform?: string;
	timestamp: string;
}

export interface LearnedPattern {
	pattern: string;
	averageScore: number;
	occurrences: number;
	recommendation: string;
}

export interface UserStyle {
	toneMarkers: string[];
	preferredHookTypes: string[];
	strongEmotions: string[];
	averageViralityScore: number;
	totalAnalyzed: number;
}

// Enhanced types for richer learning insights
export interface EngagementCorrelation {
	pattern: string; // e.g., "Contrarian Hook", "Aspiration Emotion"
	category: 'hook' | 'emotion' | 'structure' | 'visual';
	avgEngagementRate: number; // percentage
	avgBookmarkRate: number;
	avgRetweetRate: number;
	sampleSize: number;
	trend: 'improving' | 'stable' | 'declining';
}

export interface VisualInsight {
	type: string; // e.g., "Image", "Video", "No Media"
	avgViralityScore: number;
	avgEngagement: number;
	bestPerformingStyle: string;
	sampleSize: number;
}

export interface ContentTypePerformance {
	contentType: string; // e.g., "Thread", "Single Post", "Quote Tweet"
	avgViralityScore: number;
	avgEngagement: number;
	count: number;
	topPatterns: string[];
}

export interface TrendDataPoint {
	date: string; // ISO date string
	viralityScore: number;
	engagementRate?: number;
}

export interface EnhancedLearnings {
	engagementCorrelations: EngagementCorrelation[];
	visualInsights: VisualInsight[];
	contentTypePerformance: ContentTypePerformance[];
	trendData: TrendDataPoint[];
	totalAnalyzed: number;
	lastUpdated: string;
}

// =============================================================================
// SAVE TO MIND
// =============================================================================

/**
 * Save an analysis result to Mind for learning
 */
export async function saveAnalysisToMind(
	content: string,
	result: {
		viralityScore: number;
		keyInsights: string[];
		hookType?: string;
		emotionalTrigger?: string;
		patterns?: string[];
	}
): Promise<boolean> {
	if (!browser) return false;

	try {
		// Create a structured memory content
		const memoryContent = `
## ContentForge Analysis Result

**Virality Score:** ${result.viralityScore}/100

**Content Analyzed:**
${content.slice(0, 500)}${content.length > 500 ? '...' : ''}

**Key Insights:**
${result.keyInsights?.map(i => `- ${i}`).join('\n') || 'None'}

**Patterns Identified:**
- Hook Type: ${result.hookType || 'Unknown'}
- Primary Emotion: ${result.emotionalTrigger || 'Unknown'}
${result.patterns?.map(p => `- ${p}`).join('\n') || ''}

**Score Category:** ${getScoreCategory(result.viralityScore)}
`.trim();

		const response = await fetch(`${MIND_API}/v1/memories/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				content: memoryContent,
				temporal_level: 3, // Seasonal - project-level learning
				content_type: 'observation',
				salience: calculateSalience(result.viralityScore),
				metadata: {
					type: 'contentforge_analysis',
					virality_score: result.viralityScore,
					hook_type: result.hookType,
					emotional_trigger: result.emotionalTrigger,
					patterns: result.patterns,
					timestamp: new Date().toISOString()
				}
			})
		});

		if (response.ok) {
			console.log('[ContentForge Mind] Saved analysis to Mind');
			return true;
		}
		return false;
	} catch (e) {
		console.warn('[ContentForge Mind] Failed to save to Mind:', e);
		return false;
	}
}

/**
 * Calculate salience based on virality score
 * High-scoring content is more important to remember
 */
function calculateSalience(viralityScore: number): number {
	if (viralityScore >= 90) return 0.95;
	if (viralityScore >= 80) return 0.85;
	if (viralityScore >= 70) return 0.75;
	if (viralityScore >= 50) return 0.6;
	return 0.5; // Low scores still valuable as negative examples
}

function getScoreCategory(score: number): string {
	if (score >= 90) return 'Exceptional - Study this pattern';
	if (score >= 80) return 'Strong - Replicable patterns';
	if (score >= 70) return 'Good - Room for optimization';
	if (score >= 50) return 'Average - Needs improvement';
	return 'Below Average - Analyze what went wrong';
}

// =============================================================================
// KEYWORD-BASED RETRIEVAL (Works with Lite tier)
// =============================================================================

/**
 * Fetch memories by content type using list endpoint (works in Lite tier)
 * This replaces semantic search which requires embeddings
 */
async function fetchMemoriesByType(contentTypes: string[], limit: number = 100): Promise<Array<{ content: string; metadata?: Record<string, unknown>; content_type?: string }>> {
	try {
		// Fetch more than needed to filter client-side
		const response = await fetch(`${MIND_API}/v1/memories/?limit=${limit * 2}`);
		if (!response.ok) return [];

		const memories = await response.json();
		if (!Array.isArray(memories)) return [];

		// Filter by content types
		return memories.filter((m: { content_type?: string }) =>
			contentTypes.includes(m.content_type || '')
		).slice(0, limit);
	} catch (e) {
		console.warn('[ContentForge Mind] Failed to fetch memories:', e);
		return [];
	}
}

/**
 * Query Mind for learned patterns before analyzing new content
 * Uses keyword-based retrieval that works with Lite tier
 */
export async function queryLearnedPatterns(contentHint?: string): Promise<LearnedPattern[]> {
	if (!browser) return [];

	try {
		// Fetch observation memories (ContentForge analysis results) and viral patterns
		const memories = await fetchMemoriesByType(['observation', 'viral_pattern'], 50);

		if (memories.length === 0) {
			console.log('[ContentForge Mind] No past analyses found for learning');
			return [];
		}

		console.log(`[ContentForge Mind] Found ${memories.length} memories for pattern learning`);

		// Extract patterns from memories
		return extractPatternsFromMemories(memories);
	} catch (e) {
		console.warn('[ContentForge Mind] Failed to query patterns:', e);
		return [];
	}
}

/**
 * Extract actionable patterns from past analyses
 * Handles both observation (full analysis) and viral_pattern (pattern-specific) memories
 */
function extractPatternsFromMemories(memories: Array<{ content: string; content_type?: string; metadata?: Record<string, unknown> }>): LearnedPattern[] {
	const patternCounts: Record<string, { scores: number[]; count: number }> = {};

	for (const memory of memories) {
		let score: number | undefined;
		let patternName: string | undefined;
		let hookType: string | undefined;
		let emotionalTrigger: string | undefined;

		// Handle viral_pattern content type (extract from content text)
		if (memory.content_type === 'viral_pattern') {
			// Parse: "**Viral Pattern: single_punch**\nCategory: structure\n...Score: 91"
			const scoreMatch = memory.content.match(/Score:\s*(\d+)/);
			const patternMatch = memory.content.match(/\*\*Viral Pattern:\s*([^*]+)\*\*/);
			const categoryMatch = memory.content.match(/Category:\s*(\w+)/);

			if (scoreMatch) score = parseInt(scoreMatch[1]);
			if (patternMatch) patternName = patternMatch[1].trim();
			if (categoryMatch) {
				const category = categoryMatch[1];
				if (category !== 'structure') patternName = `${category}: ${patternName || 'pattern'}`;
			}
		}
		// Handle observation content type (full analysis result)
		else if (memory.content_type === 'observation') {
			// Parse: "**Virality Score:** 90/100" and insights
			const scoreMatch = memory.content.match(/\*\*Virality Score:\*\*\s*(\d+)/);
			const hookMatch = memory.content.match(/Hook Type:\s*([^\n]+)/);
			const emotionMatch = memory.content.match(/Primary Emotion:\s*([^\n]+)/);

			if (scoreMatch) score = parseInt(scoreMatch[1]);
			if (hookMatch && hookMatch[1] !== 'Unknown') hookType = hookMatch[1].trim();
			if (emotionMatch && emotionMatch[1] !== 'Unknown') emotionalTrigger = emotionMatch[1].trim();

			// Extract key insights as patterns
			const insightsMatch = memory.content.match(/\*\*Key Insights:\*\*\n([\s\S]*?)\n\n/);
			if (insightsMatch && score) {
				const insights = insightsMatch[1].split('\n- ').filter(i => i.trim());
				for (const insight of insights.slice(0, 3)) { // Top 3 insights
					const cleanInsight = insight.replace(/^-\s*/, '').trim().slice(0, 60);
					if (cleanInsight && cleanInsight !== 'None') {
						if (!patternCounts[cleanInsight]) patternCounts[cleanInsight] = { scores: [], count: 0 };
						patternCounts[cleanInsight].scores.push(score);
						patternCounts[cleanInsight].count++;
					}
				}
			}
		}
		// Fallback to metadata
		else {
			const metadata = memory.metadata as {
				virality_score?: number;
				hook_type?: string;
				emotional_trigger?: string;
				patterns?: string[];
			} | undefined;

			score = metadata?.virality_score;
			hookType = metadata?.hook_type;
			emotionalTrigger = metadata?.emotional_trigger;

			if (metadata?.patterns && score) {
				for (const pattern of metadata.patterns) {
					if (!patternCounts[pattern]) patternCounts[pattern] = { scores: [], count: 0 };
					patternCounts[pattern].scores.push(score);
					patternCounts[pattern].count++;
				}
			}
		}

		if (!score || score === 0) continue;

		// Count pattern name
		if (patternName) {
			const key = `Structure: ${patternName}`;
			if (!patternCounts[key]) patternCounts[key] = { scores: [], count: 0 };
			patternCounts[key].scores.push(score);
			patternCounts[key].count++;
		}

		// Count hook types
		if (hookType) {
			const key = `Hook: ${hookType}`;
			if (!patternCounts[key]) patternCounts[key] = { scores: [], count: 0 };
			patternCounts[key].scores.push(score);
			patternCounts[key].count++;
		}

		// Count emotional triggers
		if (emotionalTrigger) {
			const key = `Emotion: ${emotionalTrigger}`;
			if (!patternCounts[key]) patternCounts[key] = { scores: [], count: 0 };
			patternCounts[key].scores.push(score);
			patternCounts[key].count++;
		}
	}

	// Convert to LearnedPattern array
	return Object.entries(patternCounts)
		.map(([pattern, data]) => {
			const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
			return {
				pattern,
				averageScore: Math.round(avgScore),
				occurrences: data.count,
				recommendation: generateRecommendation(pattern, avgScore, data.count)
			};
		})
		.filter(p => p.occurrences >= 2) // Only patterns seen multiple times
		.sort((a, b) => b.averageScore - a.averageScore)
		.slice(0, 15); // Return top 15 patterns
}

function generateRecommendation(pattern: string, avgScore: number, occurrences: number): string {
	if (avgScore >= 80) {
		return `Strong performer (${avgScore} avg). Use this pattern.`;
	} else if (avgScore >= 60) {
		return `Moderate performer (${avgScore} avg). Consider with improvements.`;
	} else {
		return `Below average (${avgScore} avg). Avoid or rethink approach.`;
	}
}

// =============================================================================
// USER STYLE ANALYSIS
// =============================================================================

/**
 * Get user's learned style from past analyses
 * Uses keyword-based retrieval that works with Lite tier
 */
export async function getUserStyle(): Promise<UserStyle | null> {
	if (!browser) return null;

	try {
		// Fetch ContentForge analysis memories
		const memories = await fetchMemoriesByType(['observation', 'viral_pattern'], 100);

		if (memories.length === 0) {
			console.log('[ContentForge Mind] No past analyses found for style learning');
			return null;
		}

		console.log(`[ContentForge Mind] Analyzing ${memories.length} memories for user style`);

		// Aggregate style markers
		const hookTypes: Record<string, number> = {};
		const emotions: Record<string, number> = {};
		const structures: Record<string, number> = {};
		let totalScore = 0;
		let count = 0;

		for (const memory of memories) {
			let score: number | undefined;
			let hookType: string | undefined;
			let emotionalTrigger: string | undefined;
			let structure: string | undefined;

			// Parse viral_pattern content
			if (memory.content_type === 'viral_pattern') {
				const scoreMatch = memory.content.match(/Score:\s*(\d+)/);
				const patternMatch = memory.content.match(/\*\*Viral Pattern:\s*([^*]+)\*\*/);

				if (scoreMatch) score = parseInt(scoreMatch[1]);
				if (patternMatch) structure = patternMatch[1].trim();
			}
			// Parse observation content
			else if (memory.content_type === 'observation') {
				const scoreMatch = memory.content.match(/\*\*Virality Score:\*\*\s*(\d+)/);
				const hookMatch = memory.content.match(/Hook Type:\s*([^\n]+)/);
				const emotionMatch = memory.content.match(/Primary Emotion:\s*([^\n]+)/);

				if (scoreMatch) score = parseInt(scoreMatch[1]);
				if (hookMatch && hookMatch[1] !== 'Unknown') hookType = hookMatch[1].trim();
				if (emotionMatch && emotionMatch[1] !== 'Unknown') emotionalTrigger = emotionMatch[1].trim();
			}

			if (score && score > 0) {
				totalScore += score;
				count++;
			}
			if (hookType) {
				hookTypes[hookType] = (hookTypes[hookType] || 0) + 1;
			}
			if (emotionalTrigger) {
				emotions[emotionalTrigger] = (emotions[emotionalTrigger] || 0) + 1;
			}
			if (structure) {
				structures[structure] = (structures[structure] || 0) + 1;
			}
		}

		// Get top patterns
		const sortedHooks = Object.entries(hookTypes).sort((a, b) => b[1] - a[1]);
		const sortedEmotions = Object.entries(emotions).sort((a, b) => b[1] - a[1]);
		const sortedStructures = Object.entries(structures).sort((a, b) => b[1] - a[1]);

		// Use structures as tone markers if hooks are empty
		const toneMarkers = sortedStructures.slice(0, 3).map(s => s[0]);

		return {
			toneMarkers,
			preferredHookTypes: sortedHooks.slice(0, 3).map(h => h[0]),
			strongEmotions: sortedEmotions.slice(0, 3).map(e => e[0]),
			averageViralityScore: count > 0 ? Math.round(totalScore / count) : 0,
			totalAnalyzed: count
		};
	} catch (e) {
		console.warn('[ContentForge Mind] Failed to get user style:', e);
		return null;
	}
}

// =============================================================================
// CREATIVE RECOMMENDATIONS
// =============================================================================

export interface CreativeRecommendation {
	format: string;
	reason: string;
	confidence: number;
}

/**
 * Get creative format recommendations based on content and learned patterns
 */
export async function getCreativeRecommendations(
	content: string,
	viralityScore: number,
	patterns: string[]
): Promise<CreativeRecommendation[]> {
	const recommendations: CreativeRecommendation[] = [];

	// Analyze content characteristics
	const hasNumbers = /\d+/.test(content);
	const hasSteps = /^\d+\.|step \d/im.test(content);
	const isShort = content.length < 280;
	const hasList = /^[-•*]\s/m.test(content) || /^\d+\./m.test(content);
	const hasQuote = /"[^"]+"/g.test(content);
	const hasQuestion = /\?/.test(content);

	// Thread/Carousel for list content
	if (hasList || hasSteps) {
		recommendations.push({
			format: 'Thread/Carousel',
			reason: 'Content has natural breakpoints for multi-part format',
			confidence: 0.9
		});
	}

	// Infographic for data/numbers
	if (hasNumbers && viralityScore >= 70) {
		recommendations.push({
			format: 'Infographic',
			reason: 'Data-rich content performs well as visual',
			confidence: 0.85
		});
	}

	// Short video for high-scoring content
	if (viralityScore >= 80) {
		recommendations.push({
			format: 'Short Video (< 60s)',
			reason: 'High virality content converts well to video format',
			confidence: 0.8
		});
	}

	// Quote card for memorable lines
	if (hasQuote || isShort) {
		recommendations.push({
			format: 'Quote Card',
			reason: 'Shareable snippet that drives curiosity to full content',
			confidence: 0.75
		});
	}

	// Tool/Calculator for how-to content
	if (hasSteps && patterns.some(p => p.toLowerCase().includes('practical'))) {
		recommendations.push({
			format: 'Interactive Tool/Calculator',
			reason: 'Practical content could become a useful tool',
			confidence: 0.7
		});
	}

	// Meme format for contrarian takes
	if (patterns.some(p => p.toLowerCase().includes('contrarian'))) {
		recommendations.push({
			format: 'Meme Format',
			reason: 'Contrarian take fits viral meme structures',
			confidence: 0.65
		});
	}

	return recommendations.sort((a, b) => b.confidence - a.confidence);
}

// =============================================================================
// CHECK MIND CONNECTION
// =============================================================================

export async function isMindConnected(): Promise<boolean> {
	try {
		const response = await fetch(`${MIND_API}/health`);
		return response.ok;
	} catch {
		return false;
	}
}

// =============================================================================
// ENHANCED LEARNINGS - Rich data extraction from Mind
// =============================================================================

interface ParsedMemoryData {
	viralityScore: number;
	hookType: string | null;
	emotion: string | null;
	engagementRate: number | null;
	bookmarkRate: number | null;
	retweetRate: number | null;
	hasMedia: boolean;
	mediaType: 'image' | 'video' | 'none';
	contentType: 'thread' | 'single' | 'quote' | 'reply' | 'unknown';
	structure: string | null;
	timestamp: string;
	patterns: string[];
}

/**
 * Parse a memory's content text to extract structured data
 * Mind Lite stores data in content, not metadata fields
 */
function parseMemoryContent(content: string, createdAt?: string): ParsedMemoryData | null {
	// Extract virality score
	const scoreMatch = content.match(/Virality Score:\*?\*?\s*(\d+)/i);
	if (!scoreMatch) return null;

	const viralityScore = parseInt(scoreMatch[1]);

	// Extract hook type
	const hookMatch = content.match(/Hook Type:\s*([^\n]+)/i);
	const hookType = hookMatch ? hookMatch[1].trim() : null;

	// Extract emotion
	const emotionMatch = content.match(/Primary Emotion:\s*([^\n]+)/i);
	const emotion = emotionMatch ? emotionMatch[1].trim() : null;

	// Extract engagement rates from tweet data
	const engagementRateMatch = content.match(/Total Engagement Rate:\s*([\d.]+)%/i);
	const engagementRate = engagementRateMatch ? parseFloat(engagementRateMatch[1]) : null;

	const bookmarkRateMatch = content.match(/Save\/Bookmark Rate:\s*([\d.]+)%/i);
	const bookmarkRate = bookmarkRateMatch ? parseFloat(bookmarkRateMatch[1]) : null;

	const retweetRateMatch = content.match(/Retweet Rate:\s*([\d.]+)%/i);
	const retweetRate = retweetRateMatch ? parseFloat(retweetRateMatch[1]) : null;

	// Check for media
	const hasMedia = /Media Attached|photo|video|animated_gif/i.test(content);
	let mediaType: 'image' | 'video' | 'none' = 'none';
	if (/video/i.test(content)) mediaType = 'video';
	else if (/photo|image/i.test(content)) mediaType = 'image';

	// Detect content type
	let contentType: 'thread' | 'single' | 'quote' | 'reply' | 'unknown' = 'unknown';
	if (/Thread|carousel/i.test(content)) contentType = 'thread';
	else if (/Quote Tweet/i.test(content)) contentType = 'quote';
	else if (/Reply/i.test(content)) contentType = 'reply';
	else if (/Original Tweet|Single Post/i.test(content)) contentType = 'single';

	// Extract structure
	const structureMatch = content.match(/Structure:\s*([^\n]+)/i) ||
		content.match(/Format:\s*([^\n]+)/i);
	const structure = structureMatch ? structureMatch[1].trim() : null;

	// Extract patterns
	const patterns: string[] = [];
	const patternMatches = content.matchAll(/Pattern[s]?:?\s*([^\n]+)/gi);
	for (const match of patternMatches) {
		const p = match[1].trim();
		if (p && !p.includes('Identified:')) patterns.push(p);
	}
	// Also extract from pattern correlations section
	const corrMatches = content.matchAll(/"pattern":\s*"([^"]+)"/g);
	for (const match of corrMatches) {
		patterns.push(match[1]);
	}

	return {
		viralityScore,
		hookType,
		emotion,
		engagementRate,
		bookmarkRate,
		retweetRate,
		hasMedia,
		mediaType,
		contentType,
		structure,
		timestamp: createdAt || new Date().toISOString(),
		patterns
	};
}

/**
 * Get enhanced learnings with engagement correlations, visual insights, etc.
 */
export async function getEnhancedLearnings(): Promise<EnhancedLearnings | null> {
	if (!browser) return null;

	try {
		// Fetch all ContentForge memories
		const response = await fetch(`${MIND_API}/v1/memories/?limit=100`);
		if (!response.ok) return null;

		const allMemories = await response.json();
		const memories: Array<{ content: string; created_at?: string }> = Array.isArray(allMemories)
			? allMemories
			: allMemories.memories || [];

		// Filter to ContentForge analyses
		const cfMemories = memories.filter(m =>
			m.content?.includes('ContentForge Analysis') ||
			m.content?.includes('Virality Score:')
		);

		if (cfMemories.length === 0) {
			return {
				engagementCorrelations: [],
				visualInsights: [],
				contentTypePerformance: [],
				trendData: [],
				totalAnalyzed: 0,
				lastUpdated: new Date().toISOString()
			};
		}

		// Parse all memories
		const parsedData: ParsedMemoryData[] = [];
		for (const m of cfMemories) {
			const parsed = parseMemoryContent(m.content, m.created_at);
			if (parsed) parsedData.push(parsed);
		}

		// Calculate engagement correlations by pattern
		const engagementCorrelations = calculateEngagementCorrelations(parsedData);

		// Calculate visual insights
		const visualInsights = calculateVisualInsights(parsedData);

		// Calculate content type performance
		const contentTypePerformance = calculateContentTypePerformance(parsedData);

		// Build trend data (last 30 data points)
		const trendData = buildTrendData(parsedData);

		return {
			engagementCorrelations,
			visualInsights,
			contentTypePerformance,
			trendData,
			totalAnalyzed: parsedData.length,
			lastUpdated: new Date().toISOString()
		};
	} catch (e) {
		console.warn('[ContentForge Mind] Failed to get enhanced learnings:', e);
		return null;
	}
}

/**
 * Calculate engagement correlations by pattern type
 */
function calculateEngagementCorrelations(data: ParsedMemoryData[]): EngagementCorrelation[] {
	const patternStats: Record<string, {
		category: 'hook' | 'emotion' | 'structure' | 'visual';
		engagementRates: number[];
		bookmarkRates: number[];
		retweetRates: number[];
		viralityScores: number[];
		timestamps: string[];
	}> = {};

	for (const d of data) {
		// Track hook types
		if (d.hookType) {
			const key = d.hookType;
			if (!patternStats[key]) {
				patternStats[key] = {
					category: 'hook',
					engagementRates: [], bookmarkRates: [], retweetRates: [],
					viralityScores: [], timestamps: []
				};
			}
			patternStats[key].viralityScores.push(d.viralityScore);
			patternStats[key].timestamps.push(d.timestamp);
			if (d.engagementRate !== null) patternStats[key].engagementRates.push(d.engagementRate);
			if (d.bookmarkRate !== null) patternStats[key].bookmarkRates.push(d.bookmarkRate);
			if (d.retweetRate !== null) patternStats[key].retweetRates.push(d.retweetRate);
		}

		// Track emotions
		if (d.emotion) {
			const key = d.emotion;
			if (!patternStats[key]) {
				patternStats[key] = {
					category: 'emotion',
					engagementRates: [], bookmarkRates: [], retweetRates: [],
					viralityScores: [], timestamps: []
				};
			}
			patternStats[key].viralityScores.push(d.viralityScore);
			patternStats[key].timestamps.push(d.timestamp);
			if (d.engagementRate !== null) patternStats[key].engagementRates.push(d.engagementRate);
			if (d.bookmarkRate !== null) patternStats[key].bookmarkRates.push(d.bookmarkRate);
			if (d.retweetRate !== null) patternStats[key].retweetRates.push(d.retweetRate);
		}

		// Track structure patterns
		if (d.structure) {
			const key = d.structure;
			if (!patternStats[key]) {
				patternStats[key] = {
					category: 'structure',
					engagementRates: [], bookmarkRates: [], retweetRates: [],
					viralityScores: [], timestamps: []
				};
			}
			patternStats[key].viralityScores.push(d.viralityScore);
			patternStats[key].timestamps.push(d.timestamp);
			if (d.engagementRate !== null) patternStats[key].engagementRates.push(d.engagementRate);
			if (d.bookmarkRate !== null) patternStats[key].bookmarkRates.push(d.bookmarkRate);
			if (d.retweetRate !== null) patternStats[key].retweetRates.push(d.retweetRate);
		}
	}

	// Convert to correlations
	const correlations: EngagementCorrelation[] = [];
	for (const [pattern, stats] of Object.entries(patternStats)) {
		if (stats.viralityScores.length < 1) continue;

		const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

		// Calculate trend (improving, stable, declining)
		let trend: 'improving' | 'stable' | 'declining' = 'stable';
		if (stats.viralityScores.length >= 3) {
			const sorted = [...stats.viralityScores];
			const first = sorted.slice(0, Math.ceil(sorted.length / 2));
			const second = sorted.slice(Math.ceil(sorted.length / 2));
			const firstAvg = avg(first);
			const secondAvg = avg(second);
			if (secondAvg > firstAvg + 5) trend = 'improving';
			else if (secondAvg < firstAvg - 5) trend = 'declining';
		}

		correlations.push({
			pattern,
			category: stats.category,
			avgEngagementRate: Math.round(avg(stats.engagementRates) * 100) / 100,
			avgBookmarkRate: Math.round(avg(stats.bookmarkRates) * 1000) / 1000,
			avgRetweetRate: Math.round(avg(stats.retweetRates) * 1000) / 1000,
			sampleSize: stats.viralityScores.length,
			trend
		});
	}

	// Sort by sample size and engagement rate
	return correlations
		.filter(c => c.sampleSize >= 1)
		.sort((a, b) => {
			// Prioritize patterns with engagement data
			const aHasEngagement = a.avgEngagementRate > 0 ? 1 : 0;
			const bHasEngagement = b.avgEngagementRate > 0 ? 1 : 0;
			if (aHasEngagement !== bHasEngagement) return bHasEngagement - aHasEngagement;
			return b.sampleSize - a.sampleSize;
		})
		.slice(0, 15);
}

/**
 * Calculate visual insights (media type performance)
 */
function calculateVisualInsights(data: ParsedMemoryData[]): VisualInsight[] {
	const mediaStats: Record<string, {
		viralityScores: number[];
		engagementRates: number[];
	}> = {
		'Image': { viralityScores: [], engagementRates: [] },
		'Video': { viralityScores: [], engagementRates: [] },
		'No Media': { viralityScores: [], engagementRates: [] }
	};

	for (const d of data) {
		let key = 'No Media';
		if (d.mediaType === 'video') key = 'Video';
		else if (d.mediaType === 'image') key = 'Image';

		mediaStats[key].viralityScores.push(d.viralityScore);
		if (d.engagementRate !== null) {
			mediaStats[key].engagementRates.push(d.engagementRate);
		}
	}

	const insights: VisualInsight[] = [];
	for (const [type, stats] of Object.entries(mediaStats)) {
		if (stats.viralityScores.length === 0) continue;

		const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

		insights.push({
			type,
			avgViralityScore: Math.round(avg(stats.viralityScores)),
			avgEngagement: Math.round(avg(stats.engagementRates) * 100) / 100,
			bestPerformingStyle: type === 'Video' ? 'Short-form clips' : type === 'Image' ? 'Bold text overlays' : 'Text-only posts',
			sampleSize: stats.viralityScores.length
		});
	}

	return insights.sort((a, b) => b.avgViralityScore - a.avgViralityScore);
}

/**
 * Calculate content type performance
 */
function calculateContentTypePerformance(data: ParsedMemoryData[]): ContentTypePerformance[] {
	const typeStats: Record<string, {
		viralityScores: number[];
		engagementRates: number[];
		patterns: string[];
	}> = {};

	for (const d of data) {
		const type = d.contentType === 'unknown' ? 'Single Post' : capitalize(d.contentType);
		if (!typeStats[type]) {
			typeStats[type] = { viralityScores: [], engagementRates: [], patterns: [] };
		}

		typeStats[type].viralityScores.push(d.viralityScore);
		if (d.engagementRate !== null) {
			typeStats[type].engagementRates.push(d.engagementRate);
		}
		typeStats[type].patterns.push(...d.patterns);
		if (d.hookType) typeStats[type].patterns.push(d.hookType);
	}

	const performance: ContentTypePerformance[] = [];
	for (const [contentType, stats] of Object.entries(typeStats)) {
		if (stats.viralityScores.length === 0) continue;

		const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

		// Get top patterns by frequency
		const patternCounts: Record<string, number> = {};
		for (const p of stats.patterns) {
			patternCounts[p] = (patternCounts[p] || 0) + 1;
		}
		const topPatterns = Object.entries(patternCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([p]) => p);

		performance.push({
			contentType,
			avgViralityScore: Math.round(avg(stats.viralityScores)),
			avgEngagement: Math.round(avg(stats.engagementRates) * 100) / 100,
			count: stats.viralityScores.length,
			topPatterns
		});
	}

	return performance.sort((a, b) => b.count - a.count);
}

/**
 * Build trend data points for visualization
 */
function buildTrendData(data: ParsedMemoryData[]): TrendDataPoint[] {
	// Sort by timestamp
	const sorted = [...data].sort((a, b) =>
		new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
	);

	return sorted.slice(-30).map(d => ({
		date: d.timestamp.split('T')[0],
		viralityScore: d.viralityScore,
		engagementRate: d.engagementRate || undefined
	}));
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
