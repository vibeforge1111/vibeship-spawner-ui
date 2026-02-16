import { browser } from '$app/environment';

const MIND_API = 'http://localhost:8080';
const CONTENTFORGE_QUERY = 'ContentForge Analysis Result Virality Score';

interface RawMemoryRecord {
	content?: string;
	created_at?: string;
}

interface ParsedMemory {
	content: string;
	createdAt: string;
	viralityScore: number;
	hookType: string | null;
	emotionalTrigger: string | null;
	patterns: string[];
}

export interface EngagementCorrelation {
	pattern: string;
	category: string;
	avgEngagementRate: number;
	avgRetweetRate: number;
	avgBookmarkRate: number;
	sampleSize: number;
	trend: 'improving' | 'stable' | 'declining';
}

export interface VisualInsight {
	type: 'Video' | 'Image' | 'No Media' | string;
	avgViralityScore: number;
	avgEngagement: number;
	sampleSize: number;
	bestPerformingStyle: string;
}

export interface ContentTypePerformance {
	contentType: string;
	count: number;
	avgViralityScore: number;
}

export interface TrendDataPoint {
	date: string;
	viralityScore: number;
}

export interface EnhancedLearnings {
	totalAnalyzed: number;
	engagementCorrelations: EngagementCorrelation[];
	visualInsights: VisualInsight[];
	contentTypePerformance: ContentTypePerformance[];
	trendData: TrendDataPoint[];
}

export interface LearnedPattern {
	pattern: string;
	occurrences: number;
	avgScore: number;
}

export interface UserStyle {
	totalAnalyzed: number;
	averageViralityScore: number;
	preferredHookTypes: string[];
	strongEmotions: string[];
}

function categoryForPattern(pattern: string): string {
	const lower = pattern.toLowerCase();
	if (/hook|reveal|secret|question|contrarian/.test(lower)) return 'hook';
	if (/emotion|aspiration|fear|anger|curiosity|awe|excitement/.test(lower)) return 'emotion';
	if (/video|image|visual|photo/.test(lower)) return 'visual';
	if (/morning|evening|day|time|schedule/.test(lower)) return 'timing';
	return 'structure';
}

function detectVisualType(content: string): 'Video' | 'Image' | 'No Media' {
	const lower = content.toLowerCase();
	if (/(video|reel|clip|shorts)/.test(lower)) return 'Video';
	if (/(image|photo|graphic|screenshot|carousel)/.test(lower)) return 'Image';
	return 'No Media';
}

function detectContentType(content: string): string {
	const lower = content.toLowerCase();
	if (lower.includes('thread')) return 'Thread';
	if (lower.includes('carousel')) return 'Carousel';
	if (lower.includes('video') || lower.includes('reel')) return 'Video';
	if (lower.includes('image') || lower.includes('photo')) return 'Image Post';
	return 'Single Post';
}

function trendFromScores(scores: number[]): 'improving' | 'stable' | 'declining' {
	if (scores.length < 4) return 'stable';
	const midpoint = Math.floor(scores.length / 2);
	const first = scores.slice(0, midpoint);
	const second = scores.slice(midpoint);
	const firstAvg = first.reduce((sum, value) => sum + value, 0) / first.length;
	const secondAvg = second.reduce((sum, value) => sum + value, 0) / second.length;
	if (secondAvg > firstAvg + 3) return 'improving';
	if (secondAvg < firstAvg - 3) return 'declining';
	return 'stable';
}

function parsePatterns(content: string): string[] {
	const match = content.match(/Patterns Identified:\s*([\s\S]*?)(?:\n\n|$)/i);
	if (!match?.[1]) return [];
	return match[1]
		.split('\n')
		.map((line) => line.replace(/^[\s*-]+/, '').trim())
		.filter((line) => line.length > 0);
}

function parseMemory(memory: RawMemoryRecord): ParsedMemory | null {
	const content = memory.content || '';
	if (!content) return null;

	const scoreMatch = content.match(/Virality Score:\*?\*?\s*(\d{1,3})/i);
	const hookMatch = content.match(/Hook Type:\s*([^\n]+)/i);
	const emotionMatch = content.match(/Primary Emotion:\s*([^\n]+)/i);
	const viralityScore = scoreMatch ? Number.parseInt(scoreMatch[1], 10) : Number.NaN;

	if (!Number.isFinite(viralityScore)) {
		return null;
	}

	return {
		content,
		createdAt: memory.created_at || new Date().toISOString(),
		viralityScore,
		hookType: hookMatch?.[1]?.trim() || null,
		emotionalTrigger: emotionMatch?.[1]?.trim() || null,
		patterns: parsePatterns(content)
	};
}

async function fetchContentForgeMemories(): Promise<ParsedMemory[]> {
	if (!browser) return [];

	try {
		const response = await fetch(`${MIND_API}/v1/memories/retrieve`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: CONTENTFORGE_QUERY,
				limit: 200
			})
		});

		if (!response.ok) {
			return [];
		}

		const payload = await response.json();
		const rows: unknown[] = Array.isArray(payload?.memories) ? payload.memories : [];
		const normalizedRows: RawMemoryRecord[] = rows.map((row: unknown): RawMemoryRecord => {
			if (row && typeof row === 'object' && 'memory' in row) {
				return (row as { memory: RawMemoryRecord }).memory;
			}
			return row as RawMemoryRecord;
		});

		return normalizedRows
			.map((memory: RawMemoryRecord) => parseMemory(memory))
			.filter((parsed): parsed is ParsedMemory => parsed !== null)
			.sort((a: ParsedMemory, b: ParsedMemory) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
	} catch {
		return [];
	}
}

function buildEnhancedLearnings(memories: ParsedMemory[]): EnhancedLearnings {
	const patternScores = new Map<string, number[]>();
	const visualScores = new Map<string, number[]>();
	const contentTypeScores = new Map<string, number[]>();
	const trendData: TrendDataPoint[] = memories.map((memory) => ({
		date: memory.createdAt.slice(0, 10),
		viralityScore: memory.viralityScore
	}));

	for (const memory of memories) {
		const visualType = detectVisualType(memory.content);
		if (!visualScores.has(visualType)) {
			visualScores.set(visualType, []);
		}
		visualScores.get(visualType)!.push(memory.viralityScore);

		const contentType = detectContentType(memory.content);
		if (!contentTypeScores.has(contentType)) {
			contentTypeScores.set(contentType, []);
		}
		contentTypeScores.get(contentType)!.push(memory.viralityScore);

		if (memory.hookType) {
			if (!patternScores.has(memory.hookType)) {
				patternScores.set(memory.hookType, []);
			}
			patternScores.get(memory.hookType)!.push(memory.viralityScore);
		}

		if (memory.emotionalTrigger) {
			const emotionPattern = `${memory.emotionalTrigger} Emotion`;
			if (!patternScores.has(emotionPattern)) {
				patternScores.set(emotionPattern, []);
			}
			patternScores.get(emotionPattern)!.push(memory.viralityScore);
		}

		for (const pattern of memory.patterns) {
			if (!patternScores.has(pattern)) {
				patternScores.set(pattern, []);
			}
			patternScores.get(pattern)!.push(memory.viralityScore);
		}
	}

	const engagementCorrelations: EngagementCorrelation[] = Array.from(patternScores.entries())
		.filter(([, scores]) => scores.length > 0)
		.map(([pattern, scores]) => {
			const avgScore = scores.reduce((sum, value) => sum + value, 0) / scores.length;
			return {
				pattern,
				category: categoryForPattern(pattern),
				avgEngagementRate: avgScore / 10,
				avgRetweetRate: avgScore / 120,
				avgBookmarkRate: avgScore / 160,
				sampleSize: scores.length,
				trend: trendFromScores(scores)
			};
		})
		.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
		.slice(0, 60);

	const visualInsights: VisualInsight[] = Array.from(visualScores.entries()).map(([type, scores]) => {
		const avgViralityScore = scores.reduce((sum, value) => sum + value, 0) / scores.length;
		return {
			type,
			avgViralityScore,
			avgEngagement: avgViralityScore / 10,
			sampleSize: scores.length,
			bestPerformingStyle: `Prioritize ${type.toLowerCase()} variations with stronger hooks`
		};
	});

	const contentTypePerformance: ContentTypePerformance[] = Array.from(contentTypeScores.entries()).map(
		([contentType, scores]) => ({
			contentType,
			count: scores.length,
			avgViralityScore: scores.reduce((sum, value) => sum + value, 0) / scores.length
		})
	);

	return {
		totalAnalyzed: memories.length,
		engagementCorrelations,
		visualInsights,
		contentTypePerformance,
		trendData
	};
}

export async function getEnhancedLearnings(): Promise<EnhancedLearnings | null> {
	const memories = await fetchContentForgeMemories();
	if (memories.length === 0) return null;
	return buildEnhancedLearnings(memories);
}

export async function queryLearnedPatterns(): Promise<LearnedPattern[]> {
	const enhanced = await getEnhancedLearnings();
	if (!enhanced) return [];

	return enhanced.engagementCorrelations.slice(0, 30).map((corr) => ({
		pattern: corr.pattern,
		occurrences: corr.sampleSize,
		avgScore: corr.avgEngagementRate
	}));
}

export async function getUserStyle(): Promise<UserStyle | null> {
	const memories = await fetchContentForgeMemories();
	if (memories.length === 0) return null;

	const hookCounts = new Map<string, number>();
	const emotionCounts = new Map<string, number>();
	const averageViralityScore =
		memories.reduce((sum, memory) => sum + memory.viralityScore, 0) / Math.max(memories.length, 1);

	for (const memory of memories) {
		if (memory.hookType) {
			hookCounts.set(memory.hookType, (hookCounts.get(memory.hookType) || 0) + 1);
		}
		if (memory.emotionalTrigger) {
			emotionCounts.set(memory.emotionalTrigger, (emotionCounts.get(memory.emotionalTrigger) || 0) + 1);
		}
	}

	const preferredHookTypes = Array.from(hookCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([hook]) => hook);

	const strongEmotions = Array.from(emotionCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([emotion]) => emotion);

	return {
		totalAnalyzed: memories.length,
		averageViralityScore: Math.round(averageViralityScore * 100) / 100,
		preferredHookTypes,
		strongEmotions
	};
}
