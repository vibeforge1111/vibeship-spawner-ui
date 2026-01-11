<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';

	// Pattern types
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

	// Mock data for demonstration - will be replaced with Mind API calls
	const mockPatterns: LearnedPattern[] = [
		{
			pattern: 'Contrarian Hook',
			category: 'hook',
			occurrences: 12,
			avgViralityScore: 78,
			bestPerformance: 92,
			trend: 'improving',
			examples: ['Not a budget option anymore', 'Everyone says X, but actually...']
		},
		{
			pattern: 'Evidence List Structure',
			category: 'structure',
			occurrences: 8,
			avgViralityScore: 74,
			bestPerformance: 86,
			trend: 'stable',
			examples: ['Claim + bullet proof points', 'Here\'s what actually works:']
		},
		{
			pattern: 'Practical Value Dominance',
			category: 'emotion',
			occurrences: 15,
			avgViralityScore: 71,
			bestPerformance: 84,
			trend: 'improving',
			examples: ['High bookmark rate', 'Save-worthy content']
		},
		{
			pattern: 'Dark Background + Accent',
			category: 'visual',
			occurrences: 6,
			avgViralityScore: 82,
			bestPerformance: 88,
			trend: 'stable',
			examples: ['High contrast visuals', 'Number overlays']
		}
	];

	const mockInsights: ContentInsight[] = [
		{
			insight: 'Your content performs 2.3x better when you lead with a specific number',
			confidence: 0.89,
			source: 'pattern',
			actionable: true
		},
		{
			insight: 'Bookmark rate exceeds like rate on 73% of your posts - you create reference content',
			confidence: 0.92,
			source: 'analysis',
			actionable: true
		},
		{
			insight: 'Tuesday-Thursday 8-10am posts get 40% more B2B engagement',
			confidence: 0.78,
			source: 'pattern',
			actionable: true
		},
		{
			insight: 'Contrarian reframes outperform direct claims by 1.4x for your audience',
			confidence: 0.85,
			source: 'analysis',
			actionable: true
		}
	];

	const mockStyleProfile: StyleProfile = {
		dominantTone: 'Authoritative Practitioner',
		hookPreference: ['Contrarian Reframe', 'Secret/Reveal', 'Number Lead'],
		emotionalRange: ['Empowerment', 'Aspiration', 'Curiosity'],
		visualStyle: 'High contrast, dark mode, minimal text',
		optimalLength: { min: 180, max: 280 },
		bestPlatforms: ['Twitter', 'LinkedIn'],
		postingTimes: [
			{ day: 'Tuesday', hour: 9, performance: 92 },
			{ day: 'Wednesday', hour: 8, performance: 88 },
			{ day: 'Thursday', hour: 10, performance: 85 }
		]
	};

	async function checkMindConnection() {
		try {
			const response = await fetch('http://localhost:8080/health');
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
				// Load from Mind API
				const response = await fetch('http://localhost:8080/v1/memories/?limit=100');
				if (response.ok) {
					const data = await response.json();
					// Process memories into patterns - for now use mock
					patterns = mockPatterns;
					insights = mockInsights;
					styleProfile = mockStyleProfile;
					totalAnalyses = 47;
					avgViralityScore = 72;
					improvementRate = 12;
				}
			} catch (e) {
				console.warn('Failed to load from Mind:', e);
			}
		}

		// Use mock data for now
		patterns = mockPatterns;
		insights = mockInsights;
		styleProfile = mockStyleProfile;
		totalAnalyses = 47;
		avgViralityScore = 72;
		improvementRate = 12;

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
		{:else}
			<!-- Patterns Tab -->
			{#if activeTab === 'patterns'}
				<div class="space-y-4">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-semibold">Learned Patterns</h2>
						<p class="text-text-tertiary text-sm">Patterns that work for YOUR content</p>
					</div>

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
										<div class="text-sm text-text-tertiary">
											Examples: {pattern.examples.join(' • ')}
										</div>
									</div>
									<div class="text-right">
										<div class="text-2xl font-bold text-accent-primary">{pattern.avgViralityScore}</div>
										<div class="text-xs text-text-tertiary">avg score</div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Insights Tab -->
			{#if activeTab === 'insights'}
				<div class="space-y-4">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-semibold">Actionable Insights</h2>
						<p class="text-text-tertiary text-sm">Data-driven recommendations for your content</p>
					</div>

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
				</div>
			{/if}

			<!-- Style Tab -->
			{#if activeTab === 'style' && styleProfile}
				<div class="space-y-6">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-semibold">Your Content Style</h2>
						<p class="text-text-tertiary text-sm">Your unique voice and what resonates</p>
					</div>

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
									<div class="text-accent-primary font-bold">{time.performance}% engagement</div>
								</div>
							{/each}
						</div>
					</div>
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
