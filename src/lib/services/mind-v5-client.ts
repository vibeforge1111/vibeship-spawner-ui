/**
 * Mind v5 Lite Client
 *
 * Unified client for Mind v5 API - replaces all old .mind/ file usage.
 * Uses the SQLite-backed API at localhost:8080.
 */

const MIND_API = 'http://localhost:8080';
const DEFAULT_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

// =============================================================================
// TYPES
// =============================================================================

export interface MindMemory {
	memory_id: string;
	user_id: string;
	content: string;
	content_type: string;
	temporal_level: number;
	temporal_level_name: string;
	effective_salience: number;
	base_salience: number;
	retrieval_count: number;
	decision_count: number;
	positive_outcomes: number;
	negative_outcomes: number;
	created_at: string;
}

export interface TopPattern {
	pattern: string;
	category: string;
	avgScore: number;
	sampleSize: number;
	confidence: number; // effective_salience
	trend: 'improving' | 'stable' | 'declining';
}

export interface PatternForPrompt {
	name: string;
	score: number;
	recommendation: string;
}

// =============================================================================
// CORE API FUNCTIONS
// =============================================================================

/**
 * Check if Mind v5 is connected
 */
export async function isMindV5Connected(): Promise<boolean> {
	try {
		const response = await fetch(`${MIND_API}/health`);
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Get all memories of a specific content type
 */
export async function getMemoriesByType(contentType: string, limit: number = 100): Promise<MindMemory[]> {
	try {
		const response = await fetch(`${MIND_API}/v1/memories/?limit=${limit}`);
		if (!response.ok) return [];

		const memories: MindMemory[] = await response.json();
		return memories.filter(m => m.content_type === contentType);
	} catch {
		return [];
	}
}

/**
 * Create a new memory
 */
export async function createMemory(
	content: string,
	contentType: string,
	salience: number = 0.7,
	temporalLevel: number = 3
): Promise<MindMemory | null> {
	try {
		const response = await fetch(`${MIND_API}/v1/memories/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				content,
				content_type: contentType,
				temporal_level: temporalLevel,
				salience
			})
		});

		if (!response.ok) return null;
		return await response.json();
	} catch {
		return null;
	}
}

/**
 * Update memory outcomes (feedback loop)
 */
export async function updateMemoryOutcome(
	memoryId: string,
	positive: boolean
): Promise<boolean> {
	try {
		// Mind v5 Lite uses PATCH for updates
		const response = await fetch(`${MIND_API}/v1/memories/${memoryId}/outcome`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				positive: positive ? 1 : 0,
				negative: positive ? 0 : 1
			})
		});
		return response.ok;
	} catch {
		return false;
	}
}

// =============================================================================
// PATTERN EXTRACTION FOR PROMPTS
// =============================================================================

/**
 * Get top performing patterns for injection into worker prompt
 * Returns patterns sorted by score and confidence
 */
export async function getTopPatternsForPrompt(limit: number = 10): Promise<PatternForPrompt[]> {
	try {
		const memories = await getMemoriesByType('viral_pattern', 200);
		if (memories.length === 0) return [];

		// Parse patterns and aggregate by name
		const patternStats: Record<string, {
			scores: number[];
			saliences: number[];
			category: string;
		}> = {};

		for (const memory of memories) {
			// Parse pattern name from content
			const nameMatch = memory.content.match(/\*\*Viral Pattern: ([^*]+)\*\*/);
			const scoreMatch = memory.content.match(/Score: (\d+)/);
			const categoryMatch = memory.content.match(/Category: (\w+)/);

			if (!nameMatch || !scoreMatch) continue;

			const name = nameMatch[1].trim();
			const score = parseInt(scoreMatch[1]);
			const category = categoryMatch?.[1] || 'unknown';

			if (!patternStats[name]) {
				patternStats[name] = { scores: [], saliences: [], category };
			}

			patternStats[name].scores.push(score);
			patternStats[name].saliences.push(memory.effective_salience);
		}

		// Convert to sorted list
		const patterns: PatternForPrompt[] = Object.entries(patternStats)
			.map(([name, stats]) => {
				const avgScore = Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length);
				const avgSalience = stats.saliences.reduce((a, b) => a + b, 0) / stats.saliences.length;

				let recommendation = '';
				if (avgScore >= 80) {
					recommendation = 'HIGH PERFORMER - Use this pattern';
				} else if (avgScore >= 65) {
					recommendation = 'Good performer - Consider using';
				} else if (avgScore >= 50) {
					recommendation = 'Average - Use with caution';
				} else {
					recommendation = 'AVOID - Low performance';
				}

				return {
					name: name.replace(/_/g, ' '),
					score: avgScore,
					recommendation
				};
			})
			.sort((a, b) => b.score - a.score)
			.slice(0, limit);

		return patterns;
	} catch (e) {
		console.error('[MindV5Client] Failed to get patterns:', e);
		return [];
	}
}

/**
 * Format patterns for inclusion in worker prompt
 */
export async function formatPatternsForPrompt(): Promise<string> {
	const patterns = await getTopPatternsForPrompt(8);

	if (patterns.length === 0) {
		return '> No learned patterns yet. Analyze more content to build your pattern library.';
	}

	const topPerformers = patterns.filter(p => p.score >= 70);
	const toAvoid = patterns.filter(p => p.score < 50);

	let output = '## YOUR LEARNED PATTERNS (from Mind v5)\n\n';

	if (topPerformers.length > 0) {
		output += '### Use These (High Performers)\n';
		for (const p of topPerformers) {
			output += `- **${p.name}** - avg ${p.score}/100 - ${p.recommendation}\n`;
		}
		output += '\n';
	}

	if (toAvoid.length > 0) {
		output += '### Avoid These (Low Performers)\n';
		for (const p of toAvoid) {
			output += `- ${p.name} - avg ${p.score}/100 - ${p.recommendation}\n`;
		}
		output += '\n';
	}

	return output;
}

// =============================================================================
// ANALYSIS STORAGE
// =============================================================================

/**
 * Save an analysis result to Mind v5
 */
export async function saveAnalysisToMindV5(
	content: string,
	viralityScore: number,
	patterns: string[],
	hookType?: string,
	emotion?: string
): Promise<string | null> {
	const memoryContent = `## ContentForge Analysis

**Virality Score:** ${viralityScore}/100
**Score Category:** ${getScoreCategory(viralityScore)}

**Content:**
${content.slice(0, 500)}${content.length > 500 ? '...' : ''}

**Patterns Found:**
- Hook: ${hookType || 'Unknown'}
- Emotion: ${emotion || 'Unknown'}
${patterns.map(p => `- ${p}`).join('\n')}

**Timestamp:** ${new Date().toISOString()}`;

	const salience = calculateSalience(viralityScore);
	const memory = await createMemory(memoryContent, 'contentforge_analysis', salience, 3);

	return memory?.memory_id || null;
}

/**
 * Record outcome for patterns used in an analysis (feedback loop)
 */
export async function recordPatternOutcome(
	patternNames: string[],
	wasSuccessful: boolean
): Promise<void> {
	const memories = await getMemoriesByType('viral_pattern', 200);

	for (const patternName of patternNames) {
		// Find memories matching this pattern
		const matching = memories.filter(m =>
			m.content.toLowerCase().includes(patternName.toLowerCase())
		);

		// Update first few matching memories
		for (const memory of matching.slice(0, 3)) {
			await updateMemoryOutcome(memory.memory_id, wasSuccessful);
		}
	}

	console.log(`[MindV5Client] Recorded ${wasSuccessful ? 'positive' : 'negative'} outcome for ${patternNames.length} patterns`);
}

// =============================================================================
// HELPERS
// =============================================================================

function calculateSalience(viralityScore: number): number {
	if (viralityScore >= 90) return 0.95;
	if (viralityScore >= 80) return 0.85;
	if (viralityScore >= 70) return 0.75;
	if (viralityScore >= 50) return 0.6;
	return 0.5;
}

function getScoreCategory(score: number): string {
	if (score >= 90) return 'Exceptional - Study this pattern';
	if (score >= 80) return 'Strong - Replicable patterns';
	if (score >= 70) return 'Good - Room for optimization';
	if (score >= 50) return 'Average - Needs improvement';
	return 'Below Average - Analyze what went wrong';
}

// =============================================================================
// STATS & INSIGHTS
// =============================================================================

/**
 * Get Mind v5 statistics for ContentForge
 */
export async function getMindV5Stats(): Promise<{
	totalAnalyses: number;
	totalPatterns: number;
	avgScore: number;
	topPattern: string | null;
	learningVelocity: string;
}> {
	try {
		const analyses = await getMemoriesByType('contentforge_analysis', 200);
		const patterns = await getMemoriesByType('viral_pattern', 200);

		// Extract scores from analyses
		const scores: number[] = [];
		for (const a of analyses) {
			const match = a.content.match(/Virality Score:\*?\*?\s*(\d+)/);
			if (match) scores.push(parseInt(match[1]));
		}

		const avgScore = scores.length > 0
			? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
			: 0;

		// Find top pattern
		const topPatterns = await getTopPatternsForPrompt(1);
		const topPattern = topPatterns[0]?.name || null;

		// Calculate learning velocity (analyses in last 24h)
		const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const recentAnalyses = analyses.filter(a => a.created_at > oneDayAgo).length;

		let learningVelocity = 'Inactive';
		if (recentAnalyses >= 10) learningVelocity = 'High';
		else if (recentAnalyses >= 5) learningVelocity = 'Medium';
		else if (recentAnalyses >= 1) learningVelocity = 'Low';

		return {
			totalAnalyses: analyses.length,
			totalPatterns: patterns.length,
			avgScore,
			topPattern,
			learningVelocity
		};
	} catch {
		return {
			totalAnalyses: 0,
			totalPatterns: 0,
			avgScore: 0,
			topPattern: null,
			learningVelocity: 'Error'
		};
	}
}
