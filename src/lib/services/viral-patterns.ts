/**
 * Viral Pattern Extraction & Storage Service
 *
 * Extracts patterns from ContentForge analyses and stores them in Mind
 * for use in content generation. The goal: learn what works, then use
 * that knowledge to generate consistently viral content.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ViralPattern {
	id: string;
	category: 'hook' | 'structure' | 'emotion' | 'timing' | 'format' | 'topic';
	pattern: string;
	description: string;
	examples: PatternExample[];
	avgScore: number;
	sampleSize: number;
	confidence: 'low' | 'medium' | 'high' | 'very_high';
	lastSeen: string;
	createdAt: string;
}

export interface PatternExample {
	content: string;
	score: number;
	source: 'tweet' | 'text';
	author?: string;
	timestamp: string;
}

export interface ExtractedPatterns {
	hooks: string[];
	structures: string[];
	emotions: string[];
	techniques: string[];
	antiPatterns: string[];
}

export interface PatternStats {
	totalPatterns: number;
	byCategory: Record<string, number>;
	topPerformers: ViralPattern[];
	recentlyLearned: ViralPattern[];
}

// =============================================================================
// HOOK PATTERN DETECTION
// =============================================================================

const HOOK_PATTERNS = {
	contrarian: {
		keywords: ['unpopular opinion', 'hot take', 'controversial', 'against the grain', 'most people think', 'everyone says'],
		description: 'Challenges conventional wisdom or popular beliefs'
	},
	curiosity_gap: {
		keywords: ['the secret', 'what nobody tells you', 'hidden', 'discovered', 'changed everything', 'the real reason'],
		description: 'Creates information asymmetry that demands resolution'
	},
	transformation: {
		keywords: ['years ago', 'went from', 'used to', 'now I', 'before and after', 'journey from'],
		description: 'Personal transformation story with relatable struggle'
	},
	number_list: {
		keywords: ['\\d+ ways', '\\d+ things', '\\d+ tips', '\\d+ lessons', '\\d+ mistakes', 'top \\d+'],
		description: 'Numbered list promising specific value'
	},
	direct_claim: {
		keywords: ['will 10x', 'guarantee', 'the best', 'most powerful', 'game changer', 'must-have'],
		description: 'Bold, direct claim about results'
	},
	question: {
		keywords: ['^why', '^how', '^what if', '^have you', '^do you', '^ever wonder'],
		description: 'Opens with engaging question'
	},
	story: {
		keywords: ['yesterday', 'last week', 'true story', 'let me tell you', 'picture this', 'imagine'],
		description: 'Narrative hook that draws reader in'
	},
	shock: {
		keywords: ['mind-?blown', 'insane', 'crazy', 'wild', 'unbelievable', 'jaw-dropping'],
		description: 'Shock value to stop the scroll'
	}
};

const STRUCTURE_PATTERNS = {
	single_punch: {
		indicators: ['< 200 chars', 'one liner', 'single tweet'],
		description: 'Concise, impactful single statement'
	},
	thread: {
		indicators: ['thread', '🧵', '1/', 'a thread'],
		description: 'Multi-tweet thread format'
	},
	visual_text: {
		indicators: ['image', 'video', 'screenshot', 'chart', 'graph'],
		description: 'Visual content with supporting text'
	},
	listicle: {
		indicators: ['numbered list', 'bullet points', 'step by step'],
		description: 'Easy-to-scan list format'
	}
};

const EMOTION_PATTERNS = {
	fomo: {
		keywords: ['missing out', 'everyone is', 'don\'t be left', 'while you'],
		description: 'Fear of missing out'
	},
	aspiration: {
		keywords: ['dream', 'goal', 'achieve', 'success', 'level up', 'become'],
		description: 'Aspirational motivation'
	},
	curiosity: {
		keywords: ['wonder', 'fascinating', 'interesting', 'surprising', 'unexpected'],
		description: 'Intellectual curiosity'
	},
	validation: {
		keywords: ['you\'re not alone', 'it\'s okay', 'normal to', 'many people'],
		description: 'Emotional validation'
	},
	outrage: {
		keywords: ['wrong', 'broken', 'terrible', 'unacceptable', 'needs to change'],
		description: 'Righteous indignation'
	},
	awe: {
		keywords: ['amazing', 'incredible', 'beautiful', 'stunning', 'remarkable'],
		description: 'Wonder and amazement'
	}
};

// =============================================================================
// PATTERN EXTRACTION
// =============================================================================

/**
 * Extract patterns from analysis result
 */
export function extractPatternsFromAnalysis(
	content: string,
	analysisResult: any,
	source: 'tweet' | 'text',
	author?: string
): ExtractedPatterns {
	const contentLower = content.toLowerCase();
	const patterns: ExtractedPatterns = {
		hooks: [],
		structures: [],
		emotions: [],
		techniques: [],
		antiPatterns: []
	};

	// Extract hook patterns
	for (const [hookType, config] of Object.entries(HOOK_PATTERNS)) {
		for (const keyword of config.keywords) {
			const regex = new RegExp(keyword, 'i');
			if (regex.test(contentLower)) {
				patterns.hooks.push(hookType);
				break;
			}
		}
	}

	// Extract emotion patterns
	for (const [emotion, config] of Object.entries(EMOTION_PATTERNS)) {
		for (const keyword of config.keywords) {
			if (contentLower.includes(keyword)) {
				patterns.emotions.push(emotion);
				break;
			}
		}
	}

	// Detect structure from content length and format
	if (content.length < 200) {
		patterns.structures.push('single_punch');
	} else if (content.length > 500 || content.includes('1/') || content.includes('🧵')) {
		patterns.structures.push('thread');
	}

	// Extract techniques from agent insights
	if (analysisResult?.agents) {
		// Marketing insights
		if (analysisResult.agents.marketing?.insights) {
			for (const insight of analysisResult.agents.marketing.insights) {
				if (insight.toLowerCase().includes('stepps')) patterns.techniques.push('stepps_framework');
				if (insight.toLowerCase().includes('social currency')) patterns.techniques.push('social_currency');
				if (insight.toLowerCase().includes('practical value')) patterns.techniques.push('practical_value');
			}
		}

		// Copywriting insights
		if (analysisResult.agents.copywriting?.insights) {
			for (const insight of analysisResult.agents.copywriting.insights) {
				if (insight.toLowerCase().includes('4 u')) patterns.techniques.push('4us_framework');
				if (insight.toLowerCase().includes('pas')) patterns.techniques.push('pas_framework');
			}
		}

		// Psychology insights
		if (analysisResult.agents.psychology?.insights) {
			for (const insight of analysisResult.agents.psychology.insights) {
				if (insight.toLowerCase().includes('cialdini')) patterns.techniques.push('cialdini_principles');
				if (insight.toLowerCase().includes('reciprocity')) patterns.techniques.push('reciprocity');
				if (insight.toLowerCase().includes('authority')) patterns.techniques.push('authority');
				if (insight.toLowerCase().includes('social proof')) patterns.techniques.push('social_proof');
			}
		}
	}

	// Identify anti-patterns (low score indicators)
	const score = analysisResult?.synthesis?.viralityScore || 0;
	if (score < 50) {
		if (content.length > 1000) patterns.antiPatterns.push('too_long');
		if (!patterns.hooks.length) patterns.antiPatterns.push('weak_hook');
		if (!patterns.emotions.length) patterns.antiPatterns.push('no_emotion');
	}

	// Deduplicate
	patterns.hooks = [...new Set(patterns.hooks)];
	patterns.structures = [...new Set(patterns.structures)];
	patterns.emotions = [...new Set(patterns.emotions)];
	patterns.techniques = [...new Set(patterns.techniques)];
	patterns.antiPatterns = [...new Set(patterns.antiPatterns)];

	return patterns;
}

// =============================================================================
// MIND STORAGE
// =============================================================================

const MIND_API = 'http://localhost:8080';

/**
 * Store extracted patterns in Mind
 */
export async function storePatternsInMind(
	content: string,
	score: number,
	patterns: ExtractedPatterns,
	source: 'tweet' | 'text',
	author?: string
): Promise<void> {
	const timestamp = new Date().toISOString();

	// Store each hook pattern
	for (const hook of patterns.hooks) {
		await storePattern({
			category: 'hook',
			pattern: hook,
			description: HOOK_PATTERNS[hook as keyof typeof HOOK_PATTERNS]?.description || hook,
			example: {
				content: content.slice(0, 500),
				score,
				source,
				author,
				timestamp
			}
		});
	}

	// Store each emotion pattern
	for (const emotion of patterns.emotions) {
		await storePattern({
			category: 'emotion',
			pattern: emotion,
			description: EMOTION_PATTERNS[emotion as keyof typeof EMOTION_PATTERNS]?.description || emotion,
			example: {
				content: content.slice(0, 500),
				score,
				source,
				author,
				timestamp
			}
		});
	}

	// Store structure patterns
	for (const structure of patterns.structures) {
		await storePattern({
			category: 'structure',
			pattern: structure,
			description: STRUCTURE_PATTERNS[structure as keyof typeof STRUCTURE_PATTERNS]?.description || structure,
			example: {
				content: content.slice(0, 500),
				score,
				source,
				author,
				timestamp
			}
		});
	}

	// Store techniques
	for (const technique of patterns.techniques) {
		await storePattern({
			category: 'technique',
			pattern: technique,
			description: `Technique: ${technique.replace(/_/g, ' ')}`,
			example: {
				content: content.slice(0, 500),
				score,
				source,
				author,
				timestamp
			}
		});
	}

	// Store anti-patterns (only for low scores)
	if (score < 50) {
		for (const antiPattern of patterns.antiPatterns) {
			await storeAntiPattern(antiPattern, content.slice(0, 500), score);
		}
	}

	console.log(`[ViralPatterns] Stored ${patterns.hooks.length} hooks, ${patterns.emotions.length} emotions, ${patterns.structures.length} structures, ${patterns.techniques.length} techniques`);
}

async function storePattern(data: {
	category: string;
	pattern: string;
	description: string;
	example: PatternExample;
}): Promise<void> {
	try {
		// Create structured memory for pattern
		const content = `**Viral Pattern: ${data.pattern}**
Category: ${data.category}
Description: ${data.description}
Score: ${data.example.score}
Source: ${data.example.source}${data.example.author ? ` (@${data.example.author})` : ''}

Example:
"${data.example.content}"

Timestamp: ${data.example.timestamp}`;

		await fetch(`${MIND_API}/v1/memories/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				content,
				temporal_level: 3, // Seasonal - project-level learning
				content_type: 'viral_pattern',
				salience: data.example.score >= 80 ? 0.9 : data.example.score >= 60 ? 0.7 : 0.5,
				metadata: {
					pattern_category: data.category,
					pattern_name: data.pattern,
					score: data.example.score,
					source: data.example.source,
					author: data.example.author
				}
			})
		});
	} catch (e) {
		console.warn('[ViralPatterns] Failed to store pattern:', e);
	}
}

async function storeAntiPattern(pattern: string, content: string, score: number): Promise<void> {
	try {
		const memoryContent = `**Anti-Pattern: ${pattern}**
What NOT to do - this pattern correlates with low virality.

Score: ${score}
Example of what failed:
"${content}"

Avoid this pattern in content generation.`;

		await fetch(`${MIND_API}/v1/memories/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				content: memoryContent,
				temporal_level: 3,
				content_type: 'anti_pattern',
				salience: 0.8, // High salience - important to remember what NOT to do
				metadata: {
					pattern_category: 'anti_pattern',
					pattern_name: pattern,
					score
				}
			})
		});
	} catch (e) {
		console.warn('[ViralPatterns] Failed to store anti-pattern:', e);
	}
}

// =============================================================================
// PATTERN QUERIES
// =============================================================================

/**
 * Get top performing patterns by category
 */
export async function getTopPatterns(category?: string, limit: number = 10): Promise<ViralPattern[]> {
	try {
		const query = category
			? `viral pattern ${category} high score`
			: 'viral pattern high score';

		const response = await fetch(`${MIND_API}/v1/memories/retrieve`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query, limit: limit * 2 }) // Get more to filter
		});

		if (!response.ok) return [];

		const data = await response.json();
		const memories = data.memories || [];

		// Parse patterns from memories
		const patterns: ViralPattern[] = [];
		const patternMap = new Map<string, { scores: number[]; examples: PatternExample[]; desc: string }>();

		for (const m of memories) {
			if (!m.content?.includes('Viral Pattern:')) continue;

			const patternMatch = m.content.match(/Viral Pattern:\s*([^\n*]+)/);
			const categoryMatch = m.content.match(/Category:\s*([^\n]+)/);
			const scoreMatch = m.content.match(/Score:\s*(\d+)/);
			const descMatch = m.content.match(/Description:\s*([^\n]+)/);
			const exampleMatch = m.content.match(/Example:\s*\n"([^"]+)"/);

			if (patternMatch && scoreMatch) {
				const patternName = patternMatch[1].trim();
				const score = parseInt(scoreMatch[1]);
				const key = `${categoryMatch?.[1]?.trim() || 'unknown'}-${patternName}`;

				if (!patternMap.has(key)) {
					patternMap.set(key, { scores: [], examples: [], desc: descMatch?.[1] || '' });
				}

				const entry = patternMap.get(key)!;
				entry.scores.push(score);
				if (exampleMatch) {
					entry.examples.push({
						content: exampleMatch[1],
						score,
						source: 'tweet',
						timestamp: m.created_at || new Date().toISOString()
					});
				}
			}
		}

		// Convert to ViralPattern objects
		for (const [key, data] of patternMap) {
			const [cat, name] = key.split('-');
			const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;

			patterns.push({
				id: key,
				category: cat as ViralPattern['category'],
				pattern: name,
				description: data.desc,
				examples: data.examples.slice(0, 3),
				avgScore: Math.round(avgScore),
				sampleSize: data.scores.length,
				confidence: data.scores.length >= 10 ? 'very_high' : data.scores.length >= 5 ? 'high' : data.scores.length >= 3 ? 'medium' : 'low',
				lastSeen: data.examples[0]?.timestamp || new Date().toISOString(),
				createdAt: data.examples[data.examples.length - 1]?.timestamp || new Date().toISOString()
			});
		}

		// Sort by average score descending
		patterns.sort((a, b) => b.avgScore - a.avgScore);

		return patterns.slice(0, limit);
	} catch (e) {
		console.warn('[ViralPatterns] Failed to get top patterns:', e);
		return [];
	}
}

/**
 * Get patterns for a specific topic
 */
export async function getPatternsForTopic(topic: string): Promise<{
	recommendedHooks: string[];
	recommendedEmotions: string[];
	recommendedStructure: string;
	antiPatterns: string[];
}> {
	try {
		// Query Mind for patterns related to this topic
		const response = await fetch(`${MIND_API}/v1/memories/retrieve`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: `viral pattern ${topic} high score successful`,
				limit: 20
			})
		});

		if (!response.ok) {
			return getDefaultRecommendations();
		}

		const data = await response.json();
		const memories = data.memories || [];

		// Analyze what patterns work for this topic
		const hookCounts: Record<string, number[]> = {};
		const emotionCounts: Record<string, number[]> = {};
		const structureCounts: Record<string, number[]> = {};

		for (const m of memories) {
			const categoryMatch = m.content?.match(/Category:\s*([^\n]+)/);
			const patternMatch = m.content?.match(/Viral Pattern:\s*([^\n*]+)/);
			const scoreMatch = m.content?.match(/Score:\s*(\d+)/);

			if (!categoryMatch || !patternMatch || !scoreMatch) continue;

			const category = categoryMatch[1].trim();
			const pattern = patternMatch[1].trim();
			const score = parseInt(scoreMatch[1]);

			if (category === 'hook') {
				if (!hookCounts[pattern]) hookCounts[pattern] = [];
				hookCounts[pattern].push(score);
			} else if (category === 'emotion') {
				if (!emotionCounts[pattern]) emotionCounts[pattern] = [];
				emotionCounts[pattern].push(score);
			} else if (category === 'structure') {
				if (!structureCounts[pattern]) structureCounts[pattern] = [];
				structureCounts[pattern].push(score);
			}
		}

		// Calculate averages and sort
		const sortByAvg = (counts: Record<string, number[]>) => {
			return Object.entries(counts)
				.map(([pattern, scores]) => ({
					pattern,
					avg: scores.reduce((a, b) => a + b, 0) / scores.length
				}))
				.sort((a, b) => b.avg - a.avg)
				.map(x => x.pattern);
		};

		const hooks = sortByAvg(hookCounts);
		const emotions = sortByAvg(emotionCounts);
		const structures = sortByAvg(structureCounts);

		return {
			recommendedHooks: hooks.slice(0, 3).length ? hooks.slice(0, 3) : ['curiosity_gap', 'transformation'],
			recommendedEmotions: emotions.slice(0, 2).length ? emotions.slice(0, 2) : ['curiosity', 'aspiration'],
			recommendedStructure: structures[0] || 'single_punch',
			antiPatterns: ['too_long', 'weak_hook', 'no_emotion'] // Default anti-patterns
		};
	} catch (e) {
		console.warn('[ViralPatterns] Failed to get patterns for topic:', e);
		return getDefaultRecommendations();
	}
}

function getDefaultRecommendations() {
	return {
		recommendedHooks: ['curiosity_gap', 'transformation', 'contrarian'],
		recommendedEmotions: ['curiosity', 'aspiration'],
		recommendedStructure: 'single_punch',
		antiPatterns: ['too_long', 'weak_hook', 'no_emotion']
	};
}

/**
 * Get pattern statistics
 */
export async function getPatternStats(): Promise<PatternStats> {
	try {
		const response = await fetch(`${MIND_API}/v1/memories/?limit=200`);
		if (!response.ok) {
			return { totalPatterns: 0, byCategory: {}, topPerformers: [], recentlyLearned: [] };
		}

		const memories = await response.json();
		const mems = Array.isArray(memories) ? memories : memories.memories || [];

		const byCategory: Record<string, number> = {};
		let total = 0;

		for (const m of mems) {
			if (m.content?.includes('Viral Pattern:')) {
				total++;
				const categoryMatch = m.content.match(/Category:\s*([^\n]+)/);
				if (categoryMatch) {
					const cat = categoryMatch[1].trim();
					byCategory[cat] = (byCategory[cat] || 0) + 1;
				}
			}
		}

		const topPerformers = await getTopPatterns(undefined, 5);

		return {
			totalPatterns: total,
			byCategory,
			topPerformers,
			recentlyLearned: topPerformers.slice(0, 3) // Simplified for now
		};
	} catch (e) {
		console.warn('[ViralPatterns] Failed to get stats:', e);
		return { totalPatterns: 0, byCategory: {}, topPerformers: [], recentlyLearned: [] };
	}
}

// =============================================================================
// CONTENT GENERATION HELPERS
// =============================================================================

/**
 * Generate content prompt using learned patterns
 */
export function generateContentPrompt(
	topic: string,
	patterns: {
		recommendedHooks: string[];
		recommendedEmotions: string[];
		recommendedStructure: string;
		antiPatterns: string[];
	}
): string {
	const hookDescriptions = patterns.recommendedHooks
		.map(h => `- **${h}**: ${HOOK_PATTERNS[h as keyof typeof HOOK_PATTERNS]?.description || h}`)
		.join('\n');

	const emotionDescriptions = patterns.recommendedEmotions
		.map(e => `- **${e}**: ${EMOTION_PATTERNS[e as keyof typeof EMOTION_PATTERNS]?.description || e}`)
		.join('\n');

	return `Generate viral content about: ${topic}

## LEARNED PATTERNS (Use These!)

### Recommended Hooks (ranked by past performance):
${hookDescriptions}

### Target Emotions:
${emotionDescriptions}

### Structure: ${patterns.recommendedStructure}
${STRUCTURE_PATTERNS[patterns.recommendedStructure as keyof typeof STRUCTURE_PATTERNS]?.description || ''}

## ANTI-PATTERNS (Avoid These!)
${patterns.antiPatterns.map(ap => `- ${ap.replace(/_/g, ' ')}`).join('\n')}

## REQUIREMENTS
1. Use at least one recommended hook type
2. Evoke at least one target emotion
3. Follow the recommended structure
4. Keep it concise and punchy
5. Make it shareable (social currency)

Generate 3 variations, each using a different hook type.`;
}
