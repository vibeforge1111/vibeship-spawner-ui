<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';

	const MIND_API = 'http://localhost:8080';

	// Pattern types for UI display
	interface LearnedPattern {
		pattern: string;
		category: 'hook' | 'structure' | 'emotion' | 'visual' | 'timing';
		occurrences: number;
		avgViralityScore: number;
		bestPerformance: number;
		trend: 'improving' | 'stable' | 'declining';
		examples: string[];
	}

	interface ContentInsight {
		insight: string;
		confidence: number;
		source: 'analysis' | 'feedback' | 'pattern';
		actionable: boolean;
	}

	interface StyleProfile {
		dominantTone: string;
		hookPreference: string[];
		emotionalRange: string[];
		visualStyle: string;
		optimalLength: { min: number; max: number };
		bestPlatforms: string[];
		postingTimes: { day: string; hour: number; performance: number }[];
	}

	// Raw memory from Mind API
	interface MindMemory {
		content: string;
		metadata?: {
			type?: string;
			virality_score?: number;
			hook_type?: string;
			emotional_trigger?: string;
			patterns?: string[];
			timestamp?: string;
		};
		created_at?: string;
	}

	// State
	let loading = $state(true);
	let mindConnected = $state(false);
	let patterns = $state<LearnedPattern[]>([]);
	let insights = $state<ContentInsight[]>([]);
	let styleProfile = $state<StyleProfile | null>(null);
	let totalAnalyses = $state(0);
	let avgViralityScore = $state(0);
	let improvementRate = $state(0);
	let activeTab = $state<'patterns' | 'insights' | 'style' | 'timeline'>('patterns');
	let rawMemories = $state<MindMemory[]>([]);

	// Determine pattern category from pattern name
	function categorizePattern(patternName: string): 'hook' | 'structure' | 'emotion' | 'visual' | 'timing' {
		const lower = patternName.toLowerCase();
		if (lower.includes('hook') || lower.includes('contrarian') || lower.includes('reveal') || lower.includes('question')) {
			return 'hook';
		}
		if (lower.includes('list') || lower.includes('structure') || lower.includes('thread') || lower.includes('format')) {
			return 'structure';
		}
		if (lower.includes('emotion') || lower.includes('aspiration') || lower.includes('fomo') || lower.includes('curiosity') || lower.includes('value')) {
			return 'emotion';
		}
		if (lower.includes('visual') || lower.includes('image') || lower.includes('video') || lower.includes('dark') || lower.includes('color')) {
			return 'visual';
		}
		if (lower.includes('timing') || lower.includes('morning') || lower.includes('evening') || lower.includes('day')) {
			return 'timing';
		}
		return 'structure'; // Default
	}

	// Process raw memories into patterns
	function processMemoriesIntoPatterns(memories: MindMemory[]): LearnedPattern[] {
		const patternData: Record<string, { scores: number[]; examples: string[] }> = {};

		for (const memory of memories) {
			const meta = memory.metadata;
			if (!meta?.type?.includes('contentforge') || !meta.virality_score) continue;

			// Extract hook type
			if (meta.hook_type) {
				const key = meta.hook_type;
				if (!patternData[key]) patternData[key] = { scores: [], examples: [] };
				patternData[key].scores.push(meta.virality_score);
				// Extract a short example from content
				const excerpt = memory.content.slice(0, 100);
				if (!patternData[key].examples.includes(excerpt)) {
					patternData[key].examples.push(excerpt);
				}
			}

			// Extract emotional triggers
			if (meta.emotional_trigger) {
				const key = `${meta.emotional_trigger} Emotion`;
				if (!patternData[key]) patternData[key] = { scores: [], examples: [] };
				patternData[key].scores.push(meta.virality_score);
			}

			// Extract other patterns
			if (meta.patterns) {
				for (const p of meta.patterns) {
					if (!patternData[p]) patternData[p] = { scores: [], examples: [] };
					patternData[p].scores.push(meta.virality_score);
				}
			}
		}

		// Convert to LearnedPattern array
		return Object.entries(patternData)
			.filter(([_, data]) => data.scores.length >= 1)
			.map(([pattern, data]) => {
				const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
				const best = Math.max(...data.scores);
				const recentScores = data.scores.slice(-3);
				const olderScores = data.scores.slice(0, -3);
				let trend: 'improving' | 'stable' | 'declining' = 'stable';
				if (recentScores.length >= 2 && olderScores.length >= 1) {
					const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
					const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
					if (recentAvg > olderAvg + 5) trend = 'improving';
					else if (recentAvg < olderAvg - 5) trend = 'declining';
				}
				return {
					pattern,
					category: categorizePattern(pattern),
					occurrences: data.scores.length,
					avgViralityScore: Math.round(avg),
					bestPerformance: Math.round(best),
					trend,
					examples: data.examples.slice(0, 3)
				};
			})
			.sort((a, b) => b.avgViralityScore - a.avgViralityScore)
			.slice(0, 15);
	}

	// Generate insights from patterns and raw data
	function generateInsights(patterns: LearnedPattern[], memories: MindMemory[]): ContentInsight[] {
		const insights: ContentInsight[] = [];

		// Find best performing patterns
		const topPatterns = patterns.filter(p => p.avgViralityScore >= 75).slice(0, 3);
		for (const p of topPatterns) {
			insights.push({
				insight: `"${p.pattern}" pattern averages ${p.avgViralityScore}/100 virality - use this more`,
				confidence: Math.min(0.5 + p.occurrences * 0.05, 0.95),
				source: 'pattern',
				actionable: true
			});
		}

		// Analyze improvement trend
		const improvingPatterns = patterns.filter(p => p.trend === 'improving');
		if (improvingPatterns.length > 0) {
			insights.push({
				insight: `${improvingPatterns.length} patterns are improving over time: ${improvingPatterns.map(p => p.pattern).join(', ')}`,
				confidence: 0.8,
				source: 'analysis',
				actionable: true
			});
		}

		// Category analysis
		const categoryScores: Record<string, number[]> = {};
		for (const p of patterns) {
			if (!categoryScores[p.category]) categoryScores[p.category] = [];
			categoryScores[p.category].push(p.avgViralityScore);
		}
		const bestCategory = Object.entries(categoryScores)
			.map(([cat, scores]) => ({ cat, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
			.sort((a, b) => b.avg - a.avg)[0];
		if (bestCategory) {
			insights.push({
				insight: `Your ${bestCategory.cat} elements are your strongest (${Math.round(bestCategory.avg)} avg score)`,
				confidence: 0.85,
				source: 'analysis',
				actionable: true
			});
		}

		// Add general recommendations based on data volume
		if (memories.length < 10) {
			insights.push({
				insight: 'Analyze more content to build stronger pattern recognition - aim for 20+ analyses',
				confidence: 0.9,
				source: 'feedback',
				actionable: true
			});
		}

		return insights.slice(0, 8);
	}

	// Build style profile from memories
	function buildStyleProfile(memories: MindMemory[], patterns: LearnedPattern[]): StyleProfile | null {
		const hookCounts: Record<string, number> = {};
		const emotionCounts: Record<string, number> = {};

		for (const memory of memories) {
			const meta = memory.metadata;
			if (!meta?.type?.includes('contentforge')) continue;
			if (meta.hook_type) {
				hookCounts[meta.hook_type] = (hookCounts[meta.hook_type] || 0) + 1;
			}
			if (meta.emotional_trigger) {
				emotionCounts[meta.emotional_trigger] = (emotionCounts[meta.emotional_trigger] || 0) + 1;
			}
		}

		const topHooks = Object.entries(hookCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(h => h[0]);
		const topEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

		if (topHooks.length === 0 && topEmotions.length === 0) {
			return null;
		}

		// Determine dominant tone based on patterns
		let dominantTone = 'Content Creator';
		const hookPatterns = patterns.filter(p => p.category === 'hook');
		if (hookPatterns.some(p => p.pattern.toLowerCase().includes('contrarian'))) {
			dominantTone = 'Contrarian Thought Leader';
		} else if (hookPatterns.some(p => p.pattern.toLowerCase().includes('reveal') || p.pattern.toLowerCase().includes('secret'))) {
			dominantTone = 'Insider Expert';
		} else if (hookPatterns.some(p => p.pattern.toLowerCase().includes('practical') || p.pattern.toLowerCase().includes('how'))) {
			dominantTone = 'Practical Educator';
		}

		return {
			dominantTone,
			hookPreference: topHooks.length > 0 ? topHooks : ['Not enough data'],
			emotionalRange: topEmotions.length > 0 ? topEmotions : ['Not enough data'],
			visualStyle: 'Analyze more content with images to determine',
			optimalLength: { min: 180, max: 280 },
			bestPlatforms: ['Twitter', 'LinkedIn'],
			postingTimes: [
				{ day: 'Tuesday', hour: 9, performance: 0 },
				{ day: 'Wednesday', hour: 8, performance: 0 },
				{ day: 'Thursday', hour: 10, performance: 0 }
			]
		};
	}

	async function checkMindConnection() {
		try {
			const response = await fetch(`${MIND_API}/health`);
			mindConnected = response.ok;
		} catch {
			mindConnected = false;
		}
	}

	async function loadLearnings() {
		loading = true;
		await checkMindConnection();

		if (mindConnected) {
			try {
				// Search for ContentForge analyses in Mind
				const response = await fetch(`${MIND_API}/v1/memories/retrieve`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						query: 'contentforge analysis virality',
						limit: 100
					})
				});

				if (response.ok) {
					const data = await response.json();
					rawMemories = data.memories || [];

					if (rawMemories.length > 0) {
						// Filter to ContentForge analyses by content (not metadata)
						const cfMemories = rawMemories.filter((m: MindMemory) =>
							m.content?.includes('ContentForge Analysis Result') ||
							m.content?.includes('Virality Score:')
						);

						console.log('[Learn] Found', cfMemories.length, 'ContentForge analyses in Mind');

						if (cfMemories.length > 0) {
							// Extract virality scores from content text
							const extractedData = cfMemories.map((m: MindMemory) => {
								const scoreMatch = m.content?.match(/Virality Score:\*?\*?\s*(\d+)/);
								const hookMatch = m.content?.match(/Hook Type:\s*([^\n]+)/);
								const emotionMatch = m.content?.match(/Primary Emotion:\s*([^\n]+)/);
								const patternsMatch = m.content?.match(/Patterns Identified:\n([\s\S]*?)(?:\n\n|\*\*Score Category)/);

								return {
									...m,
									extractedScore: scoreMatch ? parseInt(scoreMatch[1]) : null,
									extractedHook: hookMatch ? hookMatch[1].trim() : null,
									extractedEmotion: emotionMatch ? emotionMatch[1].trim() : null,
									extractedPatterns: patternsMatch
										? patternsMatch[1].split('\n').filter(p => p.trim().startsWith('-')).map(p => p.replace(/^-\s*/, '').trim())
										: []
								};
							});

							// Enrich rawMemories with extracted data for processing
							rawMemories = extractedData.map(d => ({
								...d,
								metadata: {
									...d.metadata,
									type: 'contentforge_analysis',
									virality_score: d.extractedScore,
									hook_type: d.extractedHook,
									emotional_trigger: d.extractedEmotion,
									patterns: d.extractedPatterns
								}
							}));

							// Process enriched data
							patterns = processMemoriesIntoPatterns(rawMemories);
							insights = generateInsights(patterns, rawMemories);
							styleProfile = buildStyleProfile(rawMemories, patterns);

							// Calculate stats from extracted scores
							totalAnalyses = cfMemories.length;
							const scores = extractedData
								.map(m => m.extractedScore)
								.filter((s): s is number => typeof s === 'number');
							avgViralityScore = scores.length > 0
								? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
								: 0;

							// Calculate improvement rate (compare recent vs older)
							if (scores.length >= 4) {
								const recentHalf = scores.slice(-Math.floor(scores.length / 2));
								const olderHalf = scores.slice(0, Math.floor(scores.length / 2));
								const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
								const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
								improvementRate = olderAvg > 0 ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100) : 0;
							}

							loading = false;
							return;
						}
					}
				}
			} catch (e) {
				console.warn('Failed to load from Mind:', e);
			}
		}

		// No data or Mind not connected - show empty state
		patterns = [];
		insights = [];
		styleProfile = null;
		totalAnalyses = 0;
		avgViralityScore = 0;
		improvementRate = 0;

		loading = false;
	}

	function getCategoryColor(category: string): string {
		switch (category) {
			case 'hook': return 'text-cyan-400 border-cyan-400/30 bg-cyan-400/10';
			case 'structure': return 'text-green-400 border-green-400/30 bg-green-400/10';
			case 'emotion': return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
			case 'visual': return 'text-pink-400 border-pink-400/30 bg-pink-400/10';
			case 'timing': return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
			default: return 'text-gray-400 border-gray-400/30 bg-gray-400/10';
		}
	}

	function getTrendIcon(trend: string): string {
		switch (trend) {
			case 'improving': return '↑';
			case 'declining': return '↓';
			default: return '→';
		}
	}

	function getTrendColor(trend: string): string {
		switch (trend) {
			case 'improving': return 'text-green-400';
			case 'declining': return 'text-red-400';
			default: return 'text-gray-400';
		}
	}

	onMount(() => {
		loadLearnings();
	});
</script>

<svelte:head>
	<title>Mind Learning - ContentForge</title>
</svelte:head>

<Navbar />

<div class="min-h-screen bg-bg-primary text-text-primary p-8">
	<div class="max-w-6xl mx-auto">
		<!-- Header -->
		<header class="mb-8">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold mb-2">Mind Learning</h1>
					<p class="text-text-secondary">Your personal viral content intelligence</p>
				</div>
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2 px-3 py-1.5 border border-surface-border">
						{#if mindConnected}
							<span class="w-2 h-2 bg-purple-500 animate-pulse"></span>
							<span class="text-sm text-purple-400">Mind Connected</span>
						{:else}
							<span class="w-2 h-2 bg-gray-500"></span>
							<span class="text-sm text-gray-400">Mind Offline</span>
						{/if}
					</div>
				</div>
			</div>
		</header>

		<!-- Stats Overview -->
		<div class="grid grid-cols-4 gap-4 mb-8">
			<div class="bg-bg-secondary p-4 border border-surface-border">
				<div class="text-text-tertiary text-sm mb-1">Total Analyses</div>
				<div class="text-2xl font-bold">{totalAnalyses}</div>
			</div>
			<div class="bg-bg-secondary p-4 border border-surface-border">
				<div class="text-text-tertiary text-sm mb-1">Avg Virality Score</div>
				<div class="text-2xl font-bold text-accent-primary">{avgViralityScore}<span class="text-sm text-text-tertiary">/100</span></div>
			</div>
			<div class="bg-bg-secondary p-4 border border-surface-border">
				<div class="text-text-tertiary text-sm mb-1">Patterns Learned</div>
				<div class="text-2xl font-bold">{patterns.length}</div>
			</div>
			<div class="bg-bg-secondary p-4 border border-surface-border">
				<div class="text-text-tertiary text-sm mb-1">Improvement Rate</div>
				<div class="text-2xl font-bold text-green-400">+{improvementRate}%</div>
			</div>
		</div>

		<!-- Tabs -->
		<div class="flex border-b border-surface-border mb-6">
			<button
				onclick={() => activeTab = 'patterns'}
				class="px-6 py-3 text-sm font-medium transition-colors {activeTab === 'patterns' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary hover:text-text-primary'}"
			>
				Patterns
			</button>
			<button
				onclick={() => activeTab = 'insights'}
				class="px-6 py-3 text-sm font-medium transition-colors {activeTab === 'insights' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary hover:text-text-primary'}"
			>
				Insights
			</button>
			<button
				onclick={() => activeTab = 'style'}
				class="px-6 py-3 text-sm font-medium transition-colors {activeTab === 'style' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary hover:text-text-primary'}"
			>
				Your Style
			</button>
			<button
				onclick={() => activeTab = 'timeline'}
				class="px-6 py-3 text-sm font-medium transition-colors {activeTab === 'timeline' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-secondary hover:text-text-primary'}"
			>
				Timeline
			</button>
		</div>

		{#if loading}
			<div class="text-center py-12 text-text-secondary">Loading your learning data...</div>
		{:else if !mindConnected}
			<!-- Mind Not Connected -->
			<div class="bg-bg-secondary border border-surface-border p-8 text-center">
				<div class="text-4xl mb-4">🧠</div>
				<h2 class="text-xl font-semibold mb-2">Mind Not Connected</h2>
				<p class="text-text-secondary mb-6">Start Mind v5 to enable learning and pattern recognition.</p>
				<div class="bg-bg-primary p-4 border border-surface-border font-mono text-sm text-left max-w-md mx-auto mb-6">
					<p class="text-text-tertiary mb-2"># Start Mind v5:</p>
					<p class="text-accent-primary">cd C:\Users\USER\Desktop\the-mind</p>
					<p class="text-accent-primary">start_mind_lite.bat</p>
				</div>
				<button onclick={() => loadLearnings()} class="px-4 py-2 bg-accent-primary text-white font-medium hover:bg-accent-secondary transition-colors">
					Retry Connection
				</button>
			</div>
		{:else if totalAnalyses === 0}
			<!-- No Data Yet -->
			<div class="bg-bg-secondary border border-surface-border p-8 text-center">
				<div class="text-4xl mb-4">📊</div>
				<h2 class="text-xl font-semibold mb-2">No Analyses Yet</h2>
				<p class="text-text-secondary mb-6">Start analyzing content in ContentForge to build your learning profile.</p>
				<a href="/tools/contentforge" class="inline-block px-4 py-2 bg-accent-primary text-white font-medium hover:bg-accent-secondary transition-colors">
					Analyze Your First Content
				</a>
			</div>
		{:else}
			<!-- Patterns Tab -->
			{#if activeTab === 'patterns'}
				<div class="space-y-4">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-semibold">Learned Patterns</h2>
						<div class="flex items-center gap-4">
							<p class="text-text-tertiary text-sm">Patterns that work for YOUR content</p>
							<button onclick={() => loadLearnings()} class="text-sm text-accent-primary hover:underline">Refresh</button>
						</div>
					</div>

					{#if patterns.length === 0}
						<div class="bg-bg-secondary border border-surface-border p-6 text-center text-text-secondary">
							<p>Not enough data to identify patterns yet. Analyze more content!</p>
						</div>
					{:else}
						<div class="grid gap-4">
							{#each patterns as pattern}
								<div class="bg-bg-secondary p-4 border border-surface-border hover:border-accent-primary/30 transition-colors">
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<div class="flex items-center gap-3 mb-2">
												<h3 class="font-semibold">{pattern.pattern}</h3>
												<span class="px-2 py-0.5 text-xs border {getCategoryColor(pattern.category)}">{pattern.category}</span>
												<span class="{getTrendColor(pattern.trend)} text-sm">{getTrendIcon(pattern.trend)} {pattern.trend}</span>
											</div>
											<div class="flex items-center gap-6 text-sm text-text-secondary mb-3">
												<span>Used {pattern.occurrences}x</span>
												<span>Avg Score: <span class="text-accent-primary font-medium">{pattern.avgViralityScore}</span></span>
												<span>Best: <span class="text-green-400 font-medium">{pattern.bestPerformance}</span></span>
											</div>
											{#if pattern.examples.length > 0}
												<div class="text-sm text-text-tertiary">
													Examples: {pattern.examples.join(' • ')}
												</div>
											{/if}
										</div>
										<div class="text-right">
											<div class="text-2xl font-bold text-accent-primary">{pattern.avgViralityScore}</div>
											<div class="text-xs text-text-tertiary">avg score</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Insights Tab -->
			{#if activeTab === 'insights'}
				<div class="space-y-4">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-semibold">Actionable Insights</h2>
						<p class="text-text-tertiary text-sm">Data-driven recommendations for your content</p>
					</div>

					{#if insights.length === 0}
						<div class="bg-bg-secondary border border-surface-border p-6 text-center text-text-secondary">
							<p>No insights yet. Keep analyzing content to build recommendations!</p>
						</div>
					{:else}
						<div class="grid gap-4">
							{#each insights as insight}
								<div class="bg-bg-secondary p-4 border border-surface-border {insight.actionable ? 'border-l-2 border-l-accent-primary' : ''}">
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<p class="text-text-primary mb-2">{insight.insight}</p>
											<div class="flex items-center gap-4 text-sm">
												<span class="text-text-tertiary">Source: {insight.source}</span>
												<span class="text-text-tertiary">Confidence: <span class="text-accent-primary">{Math.round(insight.confidence * 100)}%</span></span>
											</div>
										</div>
										{#if insight.actionable}
											<span class="px-2 py-1 text-xs bg-accent-primary/20 text-accent-primary border border-accent-primary/30">Actionable</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Style Tab -->
			{#if activeTab === 'style'}
				<div class="space-y-6">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-semibold">Your Content Style</h2>
						<p class="text-text-tertiary text-sm">Your unique voice and what resonates</p>
					</div>

					{#if !styleProfile}
						<div class="bg-bg-secondary border border-surface-border p-6 text-center text-text-secondary">
							<p>No style profile yet. Analyze more content to discover your unique voice!</p>
						</div>
					{:else}
						<div class="grid grid-cols-2 gap-6">
							<!-- Tone -->
							<div class="bg-bg-secondary p-6 border border-surface-border">
								<h3 class="font-semibold mb-4 text-text-secondary">Dominant Tone</h3>
								<p class="text-2xl font-bold text-accent-primary">{styleProfile.dominantTone}</p>
							</div>

							<!-- Optimal Length -->
							<div class="bg-bg-secondary p-6 border border-surface-border">
								<h3 class="font-semibold mb-4 text-text-secondary">Optimal Length</h3>
								<p class="text-2xl font-bold">{styleProfile.optimalLength.min}-{styleProfile.optimalLength.max} <span class="text-sm text-text-tertiary">characters</span></p>
							</div>

							<!-- Hook Preferences -->
							<div class="bg-bg-secondary p-6 border border-surface-border">
								<h3 class="font-semibold mb-4 text-text-secondary">Best Hook Types</h3>
								<div class="flex flex-wrap gap-2">
									{#each styleProfile.hookPreference as hook}
										<span class="px-3 py-1 text-sm bg-cyan-400/10 text-cyan-400 border border-cyan-400/30">{hook}</span>
									{/each}
								</div>
							</div>

							<!-- Emotional Range -->
							<div class="bg-bg-secondary p-6 border border-surface-border">
								<h3 class="font-semibold mb-4 text-text-secondary">Emotional Range</h3>
								<div class="flex flex-wrap gap-2">
									{#each styleProfile.emotionalRange as emotion}
										<span class="px-3 py-1 text-sm bg-purple-400/10 text-purple-400 border border-purple-400/30">{emotion}</span>
									{/each}
								</div>
							</div>

							<!-- Best Platforms -->
							<div class="bg-bg-secondary p-6 border border-surface-border">
								<h3 class="font-semibold mb-4 text-text-secondary">Best Platforms</h3>
								<div class="flex gap-4">
									{#each styleProfile.bestPlatforms as platform}
										<span class="text-lg font-medium">{platform}</span>
									{/each}
								</div>
							</div>

							<!-- Visual Style -->
							<div class="bg-bg-secondary p-6 border border-surface-border">
								<h3 class="font-semibold mb-4 text-text-secondary">Visual Style</h3>
								<p class="text-text-primary">{styleProfile.visualStyle}</p>
							</div>
						</div>

						<!-- Best Posting Times -->
						<div class="bg-bg-secondary p-6 border border-surface-border">
							<h3 class="font-semibold mb-4 text-text-secondary">Best Posting Times</h3>
							<div class="grid grid-cols-3 gap-4">
								{#each styleProfile.postingTimes as time}
									<div class="bg-bg-primary p-4 border border-surface-border">
										<div class="text-lg font-semibold">{time.day}</div>
										<div class="text-text-tertiary">{time.hour}:00</div>
										<div class="text-accent-primary font-bold">{time.performance > 0 ? `${time.performance}% engagement` : 'No data yet'}</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Timeline Tab -->
			{#if activeTab === 'timeline'}
				<div class="space-y-4">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-semibold">Learning Timeline</h2>
						<p class="text-text-tertiary text-sm">How your content has evolved</p>
					</div>

					<div class="bg-bg-secondary p-6 border border-surface-border">
						<div class="text-center text-text-tertiary py-8">
							<p class="mb-2">Timeline visualization coming soon</p>
							<p class="text-sm">Track your virality score improvements over time</p>
						</div>
					</div>
				</div>
			{/if}
		{/if}

		<!-- Quick Actions -->
		<div class="mt-8 pt-8 border-t border-surface-border">
			<h3 class="font-semibold mb-4">Quick Actions</h3>
			<div class="flex gap-4">
				<a href="/tools/contentforge" class="px-4 py-2 bg-accent-primary text-white font-medium hover:bg-accent-secondary transition-colors">
					Analyze New Content
				</a>
				<button class="px-4 py-2 border border-surface-border text-text-secondary hover:text-text-primary transition-colors">
					Export Patterns
				</button>
				<button class="px-4 py-2 border border-surface-border text-text-secondary hover:text-text-primary transition-colors">
					Reset Learning
				</button>
			</div>
		</div>
	</div>
</div>
