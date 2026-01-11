/**
 * Topic Learning System
 *
 * Learns what TOPICS resonate in your niche, not just patterns.
 * Tracks categories like "vibe coding", "Claude", "AI tools" etc.
 *
 * Example niches:
 * - Vibe coding, Claude Code, AI-assisted development
 * - AI tools building, automation
 * - Indie hacking, bootstrapping
 */

// =============================================================================
// TYPES
// =============================================================================

export interface NicheConfig {
	name: string;
	description: string;
	primaryTopics: string[]; // Main focus areas
	relatedTopics: string[]; // Adjacent topics that may resonate
	keywords: string[]; // Keywords to detect these topics
}

export interface TopicPerformance {
	topic: string;
	category: string; // primary, related, discovered
	sampleSize: number;
	avgViralityScore: number;
	bestScore: number;
	worstScore: number;
	examples: Array<{
		content: string;
		score: number;
		source?: string;
		date: string;
	}>;
	trend: 'rising' | 'stable' | 'declining' | 'new';
	confidence: 'low' | 'medium' | 'high' | 'very_high';
	lastSeen: string;
}

export interface SubtopicPerformance {
	mainTopic: string;
	subtopic: string;
	sampleSize: number;
	avgViralityScore: number;
	bestScore: number;
	trend: 'rising' | 'stable' | 'declining' | 'new';
}

export interface TopicInsight {
	hotTopics: TopicPerformance[]; // Currently performing well
	risingTopics: TopicPerformance[]; // Trending up
	saturatedTopics: TopicPerformance[]; // Declining or oversaturated
	gapTopics: string[]; // Topics in niche not yet explored
	recommendations: string[]; // Content ideas based on learnings
	// NEW: Subtopic intelligence
	hotSubtopics: SubtopicPerformance[]; // Best performing subtopics
	risingSubtopics: SubtopicPerformance[]; // Trending subtopics
	subtopicsByTopic: Record<string, SubtopicPerformance[]>; // Subtopics grouped by main topic
}

export interface ExtractedSubtopic {
	mainTopic: string; // Parent topic (e.g., "claude code")
	subtopic: string; // Specific aspect (e.g., "skills", "legal", "optimization")
	context: string; // The specific phrase/context extracted
}

export interface ExtractedTopics {
	primary: string[]; // Main topics identified
	secondary: string[]; // Supporting/mentioned topics
	subtopics: ExtractedSubtopic[]; // Specific aspects within topics
	sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
	angle: string; // The unique angle/perspective
}

// =============================================================================
// DEFAULT NICHE CONFIGURATIONS
// =============================================================================

/**
 * Pre-defined niche for AI/vibe coding content
 */
export const VIBE_CODING_NICHE: NicheConfig = {
	name: 'Vibe Coding & AI Tools',
	description: 'Content about AI-assisted development, Claude, and building with AI',
	primaryTopics: [
		'vibe coding',
		'claude code',
		'ai coding',
		'ai assisted development',
		'cursor ai',
		'copilot',
		'ai agents',
		'mcp servers',
		'prompt engineering'
	],
	relatedTopics: [
		'developer productivity',
		'automation',
		'no-code low-code',
		'indie hacking',
		'saas building',
		'open source',
		'typescript',
		'python',
		'api development',
		'ai workflows'
	],
	keywords: [
		// Vibe coding
		'vibe', 'vibes', 'vibe coding', 'vibe-coding', 'vibeship',
		// Claude
		'claude', 'claude code', 'anthropic', 'claude-code', 'opus', 'sonnet', 'haiku',
		// AI coding
		'ai coding', 'ai-assisted', 'ai assisted', 'ai development', 'ai dev',
		'cursor', 'copilot', 'codeium', 'tabnine', 'replit',
		// Agents
		'ai agent', 'ai agents', 'autonomous', 'agentic', 'mcp', 'model context protocol',
		// Building
		'build with ai', 'building with ai', 'ship', 'shipping', 'deploy',
		// Prompts
		'prompt', 'prompting', 'prompt engineering', 'system prompt', 'jailbreak',
		// Meta
		'llm', 'gpt', 'openai', 'gemini', 'mistral', 'ollama', 'local llm'
	]
};

/**
 * Current active niche configuration
 * Can be customized per user in the future
 */
let activeNiche: NicheConfig = VIBE_CODING_NICHE;

/**
 * Subtopic patterns for each main topic
 * These define specific aspects/angles within a topic that we want to track
 */
const SUBTOPIC_PATTERNS: Record<string, string[]> = {
	'claude code': [
		'skills', 'custom skills', 'skill files',
		'legal', 'contracts', 'lawyer', 'paralegal',
		'optimization', 'optimizing', 'faster', 'speed', 'performance',
		'prompts', 'system prompt', 'prompt engineering',
		'memory', 'context', 'remember',
		'hooks', 'custom hooks', 'automation',
		'mcp', 'servers', 'tools',
		'limits', 'rate limit', 'tokens',
		'cost', 'pricing', 'expensive', 'cheap',
		'tips', 'tricks', 'hacks',
		'workflow', 'workflows', 'pipeline',
		'debugging', 'debug', 'errors',
		'comparison', 'vs', 'versus', 'better than'
	],
	'ai agents': [
		'autonomous', 'self-improving', 'recursive',
		'multi-agent', 'swarm', 'collaboration',
		'tools', 'tool use', 'function calling',
		'memory', 'long-term memory', 'remember',
		'planning', 'reasoning', 'chain of thought',
		'deployment', 'production', 'scaling',
		'cost', 'efficient', 'optimization',
		'safety', 'guardrails', 'alignment',
		'frameworks', 'langchain', 'autogen', 'crewai',
		'use cases', 'applications', 'real-world'
	],
	'vibe coding': [
		'workflow', 'process', 'methodology',
		'prompts', 'prompting', 'instructions',
		'iteration', 'iterating', 'refining',
		'planning', 'architecture', 'design',
		'debugging', 'fixing', 'errors',
		'shipping', 'launching', 'deploying',
		'learning', 'teaching', 'beginners',
		'productivity', 'speed', 'fast'
	],
	'ai coding': [
		'autocomplete', 'completion', 'suggestions',
		'refactoring', 'refactor', 'clean up',
		'testing', 'tests', 'test generation',
		'documentation', 'docs', 'comments',
		'code review', 'review', 'feedback',
		'debugging', 'debug', 'fix bugs',
		'learning', 'understand code', 'explain',
		'migration', 'upgrade', 'convert'
	],
	'prompt engineering': [
		'system prompt', 'system prompts',
		'chain of thought', 'cot', 'reasoning',
		'few-shot', 'examples', 'shots',
		'persona', 'role', 'acting as',
		'structured output', 'json', 'format',
		'temperature', 'sampling', 'creativity',
		'context window', 'context', 'tokens',
		'jailbreak', 'bypass', 'tricks'
	],
	'mcp servers': [
		'tools', 'custom tools', 'tool building',
		'resources', 'context', 'data',
		'prompts', 'prompt templates',
		'integration', 'integrating', 'connect',
		'examples', 'use cases', 'ideas',
		'debugging', 'troubleshooting', 'errors'
	]
};

// =============================================================================
// TOPIC EXTRACTION
// =============================================================================

/**
 * Extract topics from content
 */
export function extractTopicsFromContent(content: string): ExtractedTopics {
	const lowerContent = content.toLowerCase();

	const foundPrimary: Set<string> = new Set();
	const foundSecondary: Set<string> = new Set();
	const foundSubtopics: ExtractedSubtopic[] = [];

	// Check for primary topics
	for (const topic of activeNiche.primaryTopics) {
		if (lowerContent.includes(topic.toLowerCase())) {
			foundPrimary.add(topic);
		}
	}

	// Check for related topics
	for (const topic of activeNiche.relatedTopics) {
		if (lowerContent.includes(topic.toLowerCase())) {
			foundSecondary.add(topic);
		}
	}

	// Check for keywords that map to topics
	for (const keyword of activeNiche.keywords) {
		if (lowerContent.includes(keyword.toLowerCase())) {
			// Map keyword to most relevant primary topic
			const mappedTopic = mapKeywordToTopic(keyword);
			if (mappedTopic) {
				foundPrimary.add(mappedTopic);
			}
		}
	}

	// Extract subtopics for each found primary topic
	for (const topic of foundPrimary) {
		const subtopics = extractSubtopicsForTopic(content, topic);
		foundSubtopics.push(...subtopics);
	}

	// Detect sentiment
	const sentiment = detectSentiment(content);

	// Extract the angle/perspective
	const angle = extractAngle(content);

	return {
		primary: Array.from(foundPrimary),
		secondary: Array.from(foundSecondary),
		subtopics: foundSubtopics,
		sentiment,
		angle
	};
}

/**
 * Extract specific subtopics for a given main topic
 */
function extractSubtopicsForTopic(content: string, mainTopic: string): ExtractedSubtopic[] {
	const lowerContent = content.toLowerCase();
	const subtopics: ExtractedSubtopic[] = [];
	const patterns = SUBTOPIC_PATTERNS[mainTopic] || [];

	for (const pattern of patterns) {
		if (lowerContent.includes(pattern.toLowerCase())) {
			// Extract context around the subtopic (up to 100 chars)
			const index = lowerContent.indexOf(pattern.toLowerCase());
			const start = Math.max(0, index - 50);
			const end = Math.min(content.length, index + pattern.length + 50);
			const context = content.slice(start, end).trim();

			// Normalize subtopic name (group related patterns)
			const normalizedSubtopic = normalizeSubtopic(pattern, mainTopic);

			// Avoid duplicates
			if (!subtopics.some(s => s.subtopic === normalizedSubtopic)) {
				subtopics.push({
					mainTopic,
					subtopic: normalizedSubtopic,
					context
				});
			}
		}
	}

	return subtopics;
}

/**
 * Normalize subtopic patterns to canonical names
 */
function normalizeSubtopic(pattern: string, mainTopic: string): string {
	const patternLower = pattern.toLowerCase();

	// Claude Code subtopics
	if (mainTopic === 'claude code') {
		if (['skills', 'custom skills', 'skill files'].includes(patternLower)) return 'custom skills';
		if (['legal', 'contracts', 'lawyer', 'paralegal'].includes(patternLower)) return 'legal/contracts';
		if (['optimization', 'optimizing', 'faster', 'speed', 'performance'].includes(patternLower)) return 'performance optimization';
		if (['prompts', 'system prompt', 'prompt engineering'].includes(patternLower)) return 'prompts & instructions';
		if (['memory', 'context', 'remember'].includes(patternLower)) return 'memory & context';
		if (['hooks', 'custom hooks', 'automation'].includes(patternLower)) return 'hooks & automation';
		if (['mcp', 'servers', 'tools'].includes(patternLower)) return 'MCP & tools';
		if (['limits', 'rate limit', 'tokens'].includes(patternLower)) return 'limits & tokens';
		if (['cost', 'pricing', 'expensive', 'cheap'].includes(patternLower)) return 'cost & pricing';
		if (['tips', 'tricks', 'hacks'].includes(patternLower)) return 'tips & tricks';
		if (['workflow', 'workflows', 'pipeline'].includes(patternLower)) return 'workflows';
		if (['debugging', 'debug', 'errors'].includes(patternLower)) return 'debugging';
		if (['comparison', 'vs', 'versus', 'better than'].includes(patternLower)) return 'comparisons';
	}

	// AI Agents subtopics
	if (mainTopic === 'ai agents') {
		if (['autonomous', 'self-improving', 'recursive'].includes(patternLower)) return 'autonomous agents';
		if (['multi-agent', 'swarm', 'collaboration'].includes(patternLower)) return 'multi-agent systems';
		if (['tools', 'tool use', 'function calling'].includes(patternLower)) return 'tool use';
		if (['memory', 'long-term memory', 'remember'].includes(patternLower)) return 'agent memory';
		if (['planning', 'reasoning', 'chain of thought'].includes(patternLower)) return 'planning & reasoning';
		if (['deployment', 'production', 'scaling'].includes(patternLower)) return 'production deployment';
		if (['cost', 'efficient', 'optimization'].includes(patternLower)) return 'cost optimization';
		if (['safety', 'guardrails', 'alignment'].includes(patternLower)) return 'safety & guardrails';
		if (['frameworks', 'langchain', 'autogen', 'crewai'].includes(patternLower)) return 'agent frameworks';
		if (['use cases', 'applications', 'real-world'].includes(patternLower)) return 'use cases';
	}

	// Vibe Coding subtopics
	if (mainTopic === 'vibe coding') {
		if (['workflow', 'process', 'methodology'].includes(patternLower)) return 'workflow';
		if (['prompts', 'prompting', 'instructions'].includes(patternLower)) return 'prompting';
		if (['iteration', 'iterating', 'refining'].includes(patternLower)) return 'iteration';
		if (['planning', 'architecture', 'design'].includes(patternLower)) return 'planning';
		if (['debugging', 'fixing', 'errors'].includes(patternLower)) return 'debugging';
		if (['shipping', 'launching', 'deploying'].includes(patternLower)) return 'shipping';
		if (['learning', 'teaching', 'beginners'].includes(patternLower)) return 'learning';
		if (['productivity', 'speed', 'fast'].includes(patternLower)) return 'productivity';
	}

	// Default: return pattern as-is
	return pattern;
}

/**
 * Map a keyword to its parent topic
 */
function mapKeywordToTopic(keyword: string): string | null {
	const keywordLower = keyword.toLowerCase();

	// Claude-related
	if (['claude', 'anthropic', 'opus', 'sonnet', 'haiku', 'claude code', 'claude-code'].includes(keywordLower)) {
		return 'claude code';
	}

	// Vibe coding
	if (['vibe', 'vibes', 'vibe coding', 'vibe-coding', 'vibeship'].includes(keywordLower)) {
		return 'vibe coding';
	}

	// AI coding general
	if (['cursor', 'copilot', 'codeium', 'tabnine', 'ai coding', 'ai-assisted'].includes(keywordLower)) {
		return 'ai coding';
	}

	// Agents
	if (['ai agent', 'ai agents', 'autonomous', 'agentic', 'mcp'].includes(keywordLower)) {
		return 'ai agents';
	}

	// Prompts
	if (['prompt', 'prompting', 'prompt engineering', 'system prompt'].includes(keywordLower)) {
		return 'prompt engineering';
	}

	return null;
}

/**
 * Detect content sentiment
 */
function detectSentiment(content: string): 'positive' | 'neutral' | 'negative' | 'mixed' {
	const lower = content.toLowerCase();

	const positiveIndicators = [
		'amazing', 'incredible', 'love', 'game changer', 'mind blown', 'insane',
		'best', 'finally', 'breakthrough', 'excited', 'wow', '🔥', '🚀', '💯'
	];

	const negativeIndicators = [
		'hate', 'terrible', 'worst', 'disappointed', 'broken', 'useless',
		'overhyped', 'scam', 'waste', 'frustrating', 'annoying'
	];

	const positiveCount = positiveIndicators.filter(i => lower.includes(i)).length;
	const negativeCount = negativeIndicators.filter(i => lower.includes(i)).length;

	if (positiveCount > 0 && negativeCount > 0) return 'mixed';
	if (positiveCount > negativeCount) return 'positive';
	if (negativeCount > positiveCount) return 'negative';
	return 'neutral';
}

/**
 * Extract the unique angle/perspective of the content
 */
function extractAngle(content: string): string {
	const lower = content.toLowerCase();

	// Common angles in tech content
	if (lower.includes('unpopular opinion') || lower.includes('hot take')) {
		return 'contrarian';
	}
	if (lower.includes('how to') || lower.includes('tutorial') || lower.includes('guide')) {
		return 'educational';
	}
	if (lower.includes('just shipped') || lower.includes('launched') || lower.includes('built')) {
		return 'build-in-public';
	}
	if (lower.includes('thread') || lower.includes('breakdown')) {
		return 'deep-dive';
	}
	if (lower.includes('mistake') || lower.includes('learned') || lower.includes('lesson')) {
		return 'lessons-learned';
	}
	if (lower.includes('prediction') || lower.includes('future') || lower.includes('next year')) {
		return 'prediction';
	}
	if (lower.includes('vs') || lower.includes('comparison') || lower.includes('better than')) {
		return 'comparison';
	}
	if (lower.includes('saved me') || lower.includes('hours') || lower.includes('productivity')) {
		return 'productivity-hack';
	}

	return 'general';
}

// =============================================================================
// MIND INTEGRATION
// =============================================================================

const MIND_API = 'http://localhost:8080';

/**
 * Store topic performance data in Mind
 */
export async function storeTopicPerformance(
	topics: ExtractedTopics,
	viralityScore: number,
	content: string,
	source?: string
): Promise<boolean> {
	try {
		// Store each primary topic with its performance
		for (const topic of topics.primary) {
			// Find subtopics for this main topic
			const relatedSubtopics = topics.subtopics
				.filter(s => s.mainTopic === topic)
				.map(s => s.subtopic);

			const memory = {
				content: `[TOPIC LEARNING] Topic: ${topic}
Category: primary
Score: ${viralityScore}
Angle: ${topics.angle}
Sentiment: ${topics.sentiment}
Subtopics: ${relatedSubtopics.join(', ') || 'none'}
Content Sample: ${content.slice(0, 200)}...
Source: ${source || 'direct-input'}
Related Topics: ${topics.secondary.join(', ') || 'none'}
Niche: ${activeNiche.name}`,
				temporal_level: 3, // Seasonal - important for learning
				salience: viralityScore >= 70 ? 0.9 : viralityScore >= 50 ? 0.7 : 0.5,
				content_type: 'topic_learning'
			};

			await fetch(`${MIND_API}/v1/memories/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(memory)
			});
		}

		// Store subtopic-specific learnings for detailed tracking
		for (const subtopic of topics.subtopics) {
			const memory = {
				content: `[SUBTOPIC LEARNING] MainTopic: ${subtopic.mainTopic}
Subtopic: ${subtopic.subtopic}
Score: ${viralityScore}
Context: ${subtopic.context}
Angle: ${topics.angle}
Sentiment: ${topics.sentiment}`,
				temporal_level: 3,
				salience: viralityScore >= 70 ? 0.85 : viralityScore >= 50 ? 0.65 : 0.45,
				content_type: 'subtopic_learning'
			};

			await fetch(`${MIND_API}/v1/memories/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(memory)
			});
		}

		console.log(`[TopicLearning] Stored ${topics.primary.length} topic + ${topics.subtopics.length} subtopic learnings`);
		return true;
	} catch (e) {
		console.warn('[TopicLearning] Failed to store:', e);
		return false;
	}
}

/**
 * Get topic performance stats from Mind
 */
export async function getTopicStats(): Promise<TopicPerformance[]> {
	try {
		const response = await fetch(`${MIND_API}/v1/memories/?limit=500`);
		if (!response.ok) return [];

		const data = await response.json();
		const memories: Array<{ content: string; created_at?: string }> = Array.isArray(data)
			? data
			: data.memories || [];

		// Filter to topic learnings
		const topicMemories = memories.filter(m =>
			m.content?.includes('[TOPIC LEARNING]')
		);

		// Aggregate by topic
		const topicMap = new Map<string, {
			scores: number[];
			examples: Array<{ content: string; score: number; date: string }>;
			angles: string[];
			lastSeen: string;
		}>();

		for (const m of topicMemories) {
			const topicMatch = m.content.match(/Topic: ([^\n]+)/);
			const scoreMatch = m.content.match(/Score: (\d+)/);
			const angleMatch = m.content.match(/Angle: ([^\n]+)/);
			const sampleMatch = m.content.match(/Content Sample: ([^\n]+)/);

			if (topicMatch && scoreMatch) {
				const topic = topicMatch[1].trim();
				const score = parseInt(scoreMatch[1]);
				const angle = angleMatch?.[1]?.trim() || 'general';
				const sample = sampleMatch?.[1]?.trim() || '';
				const date = m.created_at || new Date().toISOString();

				if (!topicMap.has(topic)) {
					topicMap.set(topic, { scores: [], examples: [], angles: [], lastSeen: date });
				}

				const data = topicMap.get(topic)!;
				data.scores.push(score);
				data.angles.push(angle);
				data.lastSeen = date > data.lastSeen ? date : data.lastSeen;

				if (data.examples.length < 5) {
					data.examples.push({ content: sample, score, date });
				}
			}
		}

		// Convert to TopicPerformance array
		const performances: TopicPerformance[] = [];

		for (const [topic, data] of topicMap) {
			const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
			const sampleSize = data.scores.length;

			// Determine trend (simplified - would need time-series analysis for real trend)
			let trend: TopicPerformance['trend'] = 'stable';
			if (sampleSize <= 2) trend = 'new';
			else if (data.scores.slice(-3).every((s, i, arr) => i === 0 || s >= arr[i - 1])) trend = 'rising';
			else if (data.scores.slice(-3).every((s, i, arr) => i === 0 || s <= arr[i - 1])) trend = 'declining';

			// Determine confidence
			let confidence: TopicPerformance['confidence'] = 'low';
			if (sampleSize >= 10) confidence = 'very_high';
			else if (sampleSize >= 5) confidence = 'high';
			else if (sampleSize >= 3) confidence = 'medium';

			// Determine category
			const category = activeNiche.primaryTopics.includes(topic) ? 'primary' :
				activeNiche.relatedTopics.includes(topic) ? 'related' : 'discovered';

			performances.push({
				topic,
				category,
				sampleSize,
				avgViralityScore: Math.round(avgScore),
				bestScore: Math.max(...data.scores),
				worstScore: Math.min(...data.scores),
				examples: data.examples.sort((a, b) => b.score - a.score),
				trend,
				confidence,
				lastSeen: data.lastSeen
			});
		}

		// Sort by average score
		return performances.sort((a, b) => b.avgViralityScore - a.avgViralityScore);
	} catch (e) {
		console.warn('[TopicLearning] Failed to get stats:', e);
		return [];
	}
}

/**
 * Get subtopic performance stats from Mind
 */
export async function getSubtopicStats(): Promise<SubtopicPerformance[]> {
	try {
		const response = await fetch(`${MIND_API}/v1/memories/?limit=500`);
		if (!response.ok) return [];

		const data = await response.json();
		const memories: Array<{ content: string; created_at?: string }> = Array.isArray(data)
			? data
			: data.memories || [];

		// Filter to subtopic learnings
		const subtopicMemories = memories.filter(m =>
			m.content?.includes('[SUBTOPIC LEARNING]')
		);

		// Aggregate by mainTopic + subtopic
		const subtopicMap = new Map<string, {
			mainTopic: string;
			subtopic: string;
			scores: number[];
		}>();

		for (const m of subtopicMemories) {
			const mainTopicMatch = m.content.match(/MainTopic: ([^\n]+)/);
			const subtopicMatch = m.content.match(/Subtopic: ([^\n]+)/);
			const scoreMatch = m.content.match(/Score: (\d+)/);

			if (mainTopicMatch && subtopicMatch && scoreMatch) {
				const mainTopic = mainTopicMatch[1].trim();
				const subtopic = subtopicMatch[1].trim();
				const score = parseInt(scoreMatch[1]);
				const key = `${mainTopic}::${subtopic}`;

				if (!subtopicMap.has(key)) {
					subtopicMap.set(key, { mainTopic, subtopic, scores: [] });
				}

				subtopicMap.get(key)!.scores.push(score);
			}
		}

		// Convert to SubtopicPerformance array
		const performances: SubtopicPerformance[] = [];

		for (const [, data] of subtopicMap) {
			const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
			const sampleSize = data.scores.length;

			// Determine trend
			let trend: SubtopicPerformance['trend'] = 'stable';
			if (sampleSize <= 2) trend = 'new';
			else if (data.scores.slice(-3).every((s, i, arr) => i === 0 || s >= arr[i - 1])) trend = 'rising';
			else if (data.scores.slice(-3).every((s, i, arr) => i === 0 || s <= arr[i - 1])) trend = 'declining';

			performances.push({
				mainTopic: data.mainTopic,
				subtopic: data.subtopic,
				sampleSize,
				avgViralityScore: Math.round(avgScore),
				bestScore: Math.max(...data.scores),
				trend
			});
		}

		// Sort by average score
		return performances.sort((a, b) => b.avgViralityScore - a.avgViralityScore);
	} catch (e) {
		console.warn('[TopicLearning] Failed to get subtopic stats:', e);
		return [];
	}
}

/**
 * Get topic insights and recommendations
 */
export async function getTopicInsights(): Promise<TopicInsight> {
	const stats = await getTopicStats();
	const subtopicStats = await getSubtopicStats();

	// Hot topics: high score, good sample size
	const hotTopics = stats.filter(t =>
		t.avgViralityScore >= 70 && t.sampleSize >= 3
	).slice(0, 5);

	// Rising topics: trend is rising
	const risingTopics = stats.filter(t =>
		t.trend === 'rising' || (t.trend === 'new' && t.avgViralityScore >= 60)
	).slice(0, 5);

	// Saturated topics: declining trend
	const saturatedTopics = stats.filter(t =>
		t.trend === 'declining' || (t.sampleSize >= 5 && t.avgViralityScore < 50)
	).slice(0, 5);

	// Gap topics: in niche but not explored
	const exploredTopics = new Set(stats.map(t => t.topic.toLowerCase()));
	const gapTopics = activeNiche.primaryTopics.filter(t =>
		!exploredTopics.has(t.toLowerCase())
	);

	// Generate recommendations
	const recommendations: string[] = [];

	if (hotTopics.length > 0) {
		const bestTopic = hotTopics[0];
		recommendations.push(`Double down on "${bestTopic.topic}" - avg score ${bestTopic.avgViralityScore} from ${bestTopic.sampleSize} posts`);
	}

	if (risingTopics.length > 0) {
		recommendations.push(`"${risingTopics[0].topic}" is trending up - good time to create more content`);
	}

	if (gapTopics.length > 0) {
		recommendations.push(`Unexplored in your niche: ${gapTopics.slice(0, 3).join(', ')}`);
	}

	if (saturatedTopics.length > 0) {
		recommendations.push(`Consider fresh angles on "${saturatedTopics[0].topic}" - scores are declining`);
	}

	// Add angle-based recommendations
	const allAngles = stats.flatMap(t => t.examples.map(e => ({ angle: 'general', score: e.score })));
	// This is simplified - would need to track angles properly

	// NEW: Subtopic intelligence
	const hotSubtopics = subtopicStats.filter(s =>
		s.avgViralityScore >= 70 && s.sampleSize >= 2
	).slice(0, 8);

	const risingSubtopics = subtopicStats.filter(s =>
		s.trend === 'rising' || (s.trend === 'new' && s.avgViralityScore >= 60)
	).slice(0, 8);

	// Group subtopics by main topic
	const subtopicsByTopic: Record<string, SubtopicPerformance[]> = {};
	for (const s of subtopicStats) {
		if (!subtopicsByTopic[s.mainTopic]) {
			subtopicsByTopic[s.mainTopic] = [];
		}
		subtopicsByTopic[s.mainTopic].push(s);
	}

	// Add subtopic-based recommendations
	if (hotSubtopics.length > 0) {
		const best = hotSubtopics[0];
		recommendations.push(`Hot subtopic: "${best.subtopic}" in ${best.mainTopic} (avg ${best.avgViralityScore})`);
	}

	if (risingSubtopics.length > 0) {
		const rising = risingSubtopics[0];
		recommendations.push(`Rising: "${rising.subtopic}" in ${rising.mainTopic} - momentum building`);
	}

	return {
		hotTopics,
		risingTopics,
		saturatedTopics,
		gapTopics,
		recommendations,
		// NEW: Subtopic data
		hotSubtopics,
		risingSubtopics,
		subtopicsByTopic
	};
}

// =============================================================================
// NICHE MANAGEMENT
// =============================================================================

/**
 * Get current niche configuration
 */
export function getCurrentNiche(): NicheConfig {
	return activeNiche;
}

/**
 * Set custom niche configuration
 */
export function setNiche(config: NicheConfig): void {
	activeNiche = config;
	console.log(`[TopicLearning] Niche set to: ${config.name}`);
}

/**
 * Add topics to current niche
 */
export function addTopicsToNiche(topics: string[], type: 'primary' | 'related' | 'keywords'): void {
	if (type === 'primary') {
		activeNiche.primaryTopics.push(...topics);
	} else if (type === 'related') {
		activeNiche.relatedTopics.push(...topics);
	} else {
		activeNiche.keywords.push(...topics);
	}
	console.log(`[TopicLearning] Added ${topics.length} ${type} topics`);
}

// =============================================================================
// CONTENT IDEAS GENERATOR
// =============================================================================

/**
 * Generate content ideas based on learned topics
 */
export async function generateContentIdeas(): Promise<string[]> {
	const insights = await getTopicInsights();
	const ideas: string[] = [];

	// Ideas from hot topics
	for (const topic of insights.hotTopics.slice(0, 2)) {
		ideas.push(`New post about "${topic.topic}" - your audience loves this (avg ${topic.avgViralityScore})`);
	}

	// Ideas from rising topics
	for (const topic of insights.risingTopics.slice(0, 2)) {
		ideas.push(`Trending: "${topic.topic}" - ride the wave with a fresh take`);
	}

	// Ideas from gaps
	for (const topic of insights.gapTopics.slice(0, 2)) {
		ideas.push(`Unexplored: "${topic}" - be first in your niche to cover this`);
	}

	// Combination ideas
	if (insights.hotTopics.length >= 2) {
		const [a, b] = insights.hotTopics;
		ideas.push(`Combine "${a.topic}" + "${b.topic}" for maximum engagement`);
	}

	return ideas;
}
