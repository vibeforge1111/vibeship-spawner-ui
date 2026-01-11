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
// QUERY MIND FOR PATTERNS
// =============================================================================

/**
 * Query Mind for learned patterns before analyzing new content
 */
export async function queryLearnedPatterns(contentHint?: string): Promise<LearnedPattern[]> {
	if (!browser) return [];

	try {
		const query = contentHint
			? `contentforge analysis ${contentHint}`
			: 'contentforge analysis high virality score patterns';

		const response = await fetch(`${MIND_API}/v1/memories/retrieve`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query,
				limit: 20
			})
		});

		if (!response.ok) return [];

		const data = await response.json();
		const memories = data.memories || [];

		// Extract patterns from memories
		return extractPatternsFromMemories(memories);
	} catch (e) {
		console.warn('[ContentForge Mind] Failed to query patterns:', e);
		return [];
	}
}

/**
 * Extract actionable patterns from past analyses
 */
function extractPatternsFromMemories(memories: Array<{ content: string; metadata?: Record<string, unknown> }>): LearnedPattern[] {
	const patternCounts: Record<string, { scores: number[]; count: number }> = {};

	for (const memory of memories) {
		const metadata = memory.metadata as {
			virality_score?: number;
			hook_type?: string;
			emotional_trigger?: string;
			patterns?: string[];
		} | undefined;

		if (!metadata?.virality_score) continue;

		// Count hook types
		if (metadata.hook_type) {
			const key = `Hook: ${metadata.hook_type}`;
			if (!patternCounts[key]) patternCounts[key] = { scores: [], count: 0 };
			patternCounts[key].scores.push(metadata.virality_score);
			patternCounts[key].count++;
		}

		// Count emotional triggers
		if (metadata.emotional_trigger) {
			const key = `Emotion: ${metadata.emotional_trigger}`;
			if (!patternCounts[key]) patternCounts[key] = { scores: [], count: 0 };
			patternCounts[key].scores.push(metadata.virality_score);
			patternCounts[key].count++;
		}

		// Count other patterns
		if (metadata.patterns) {
			for (const pattern of metadata.patterns) {
				if (!patternCounts[pattern]) patternCounts[pattern] = { scores: [], count: 0 };
				patternCounts[pattern].scores.push(metadata.virality_score);
				patternCounts[pattern].count++;
			}
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
		.slice(0, 10);
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
 */
export async function getUserStyle(): Promise<UserStyle | null> {
	if (!browser) return null;

	try {
		const response = await fetch(`${MIND_API}/v1/memories/retrieve`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: 'contentforge analysis',
				limit: 50
			})
		});

		if (!response.ok) return null;

		const data = await response.json();
		const memories = data.memories || [];

		if (memories.length === 0) return null;

		// Aggregate style markers
		const hookTypes: Record<string, number> = {};
		const emotions: Record<string, number> = {};
		let totalScore = 0;
		let count = 0;

		for (const memory of memories) {
			const metadata = memory.metadata as {
				virality_score?: number;
				hook_type?: string;
				emotional_trigger?: string;
			} | undefined;

			if (metadata?.virality_score) {
				totalScore += metadata.virality_score;
				count++;
			}
			if (metadata?.hook_type) {
				hookTypes[metadata.hook_type] = (hookTypes[metadata.hook_type] || 0) + 1;
			}
			if (metadata?.emotional_trigger) {
				emotions[metadata.emotional_trigger] = (emotions[metadata.emotional_trigger] || 0) + 1;
			}
		}

		// Get top patterns
		const sortedHooks = Object.entries(hookTypes).sort((a, b) => b[1] - a[1]);
		const sortedEmotions = Object.entries(emotions).sort((a, b) => b[1] - a[1]);

		return {
			toneMarkers: [], // Would need NLP to extract
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
