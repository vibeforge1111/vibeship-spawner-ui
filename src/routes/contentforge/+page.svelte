<script lang="ts">
	let inputText = `Here's my secret to building a $1M ARR startup in 12 months:

1. Ship fast, iterate faster
2. Talk to users every single day
3. Focus on one metric that matters
4. Build in public - your journey is your marketing

The hardest part? Staying consistent when nobody's watching.

But that's exactly when you build the foundation for success.`;

	let loading = false;
	let result: any = null;
	let error: string | null = null;

	async function analyze() {
		loading = true;
		error = null;
		result = null;

		try {
			const response = await fetch('/api/contentforge/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ demo: inputText || true })
			});

			const data = await response.json();
			if (data.error) {
				error = data.error;
			} else {
				result = data.data;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Analysis failed';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>ContentForge - Viral Content Analysis</title>
</svelte:head>

<div class="min-h-screen bg-surface-bg text-text-primary p-8">
	<div class="max-w-6xl mx-auto">
		<header class="mb-8">
			<h1 class="text-3xl font-bold mb-2">ContentForge</h1>
			<p class="text-text-secondary">Viral Content Analysis Pipeline</p>
		</header>

		<!-- Input Section -->
		<div class="mb-8 bg-surface-raised p-6 border border-surface-border">
			<h2 class="text-xl font-semibold mb-4">Content to Analyze</h2>
			<textarea
				bind:value={inputText}
				class="w-full h-48 bg-surface-bg border border-surface-border p-4 text-text-primary font-mono text-sm resize-none focus:outline-none focus:border-accent-primary"
				placeholder="Paste your content here..."
			></textarea>
			<button
				onclick={analyze}
				disabled={loading}
				class="mt-4 px-6 py-2 bg-accent-primary text-white font-semibold disabled:opacity-50 hover:bg-accent-secondary transition-colors"
			>
				{loading ? 'Analyzing...' : 'Analyze Content'}
			</button>
		</div>

		{#if error}
			<div class="bg-red-900/20 border border-red-500 p-4 mb-8">
				<p class="text-red-400">{error}</p>
			</div>
		{/if}

		{#if result}
			<!-- Virality Score -->
			<div class="mb-8 bg-surface-raised p-6 border border-surface-border">
				<h2 class="text-xl font-semibold mb-4">Virality Score</h2>
				<div class="flex items-center gap-4">
					<div class="text-5xl font-bold text-accent-primary">
						{result.synthesis.viralityScore}
					</div>
					<div class="text-text-secondary">/ 100</div>
					<div class="flex-1 h-4 bg-surface-bg border border-surface-border">
						<div
							class="h-full bg-accent-primary transition-all duration-500"
							style="width: {result.synthesis.viralityScore}%"
						></div>
					</div>
				</div>
			</div>

			<!-- Key Insights -->
			<div class="mb-8 bg-surface-raised p-6 border border-surface-border">
				<h2 class="text-xl font-semibold mb-4">Key Insights</h2>
				<ul class="space-y-2">
					{#each result.synthesis.keyInsights as insight}
						<li class="flex items-start gap-2">
							<span class="text-accent-primary">→</span>
							<span>{insight}</span>
						</li>
					{/each}
				</ul>
			</div>

			<!-- Agent Results Grid -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
				<!-- Marketing -->
				<div class="bg-surface-raised p-6 border border-surface-border">
					<h3 class="text-lg font-semibold mb-4 text-blue-400">Marketing Agent</h3>
					<div class="space-y-3 text-sm">
						<div>
							<span class="text-text-secondary">Authority:</span>
							<span class="ml-2">{result.orchestrator.agentResults.marketing?.data?.positioning?.authorityLevel}</span>
						</div>
						<div>
							<span class="text-text-secondary">Niche:</span>
							<span class="ml-2">{result.orchestrator.agentResults.marketing?.data?.positioning?.niche}</span>
						</div>
						<div>
							<span class="text-text-secondary">Shareability:</span>
							<span class="ml-2 text-accent-primary font-bold">{result.orchestrator.agentResults.marketing?.data?.distributionFactors?.shareability}/10</span>
						</div>
					</div>
				</div>

				<!-- Copywriting -->
				<div class="bg-surface-raised p-6 border border-surface-border">
					<h3 class="text-lg font-semibold mb-4 text-green-400">Copywriting Agent</h3>
					<div class="space-y-3 text-sm">
						<div>
							<span class="text-text-secondary">Hook Type:</span>
							<span class="ml-2">{result.orchestrator.agentResults.copywriting?.data?.hook?.type}</span>
						</div>
						<div>
							<span class="text-text-secondary">Hook Effectiveness:</span>
							<span class="ml-2 text-accent-primary font-bold">{result.orchestrator.agentResults.copywriting?.data?.hook?.effectiveness}/10</span>
						</div>
						<div>
							<span class="text-text-secondary">Structure:</span>
							<span class="ml-2">{result.orchestrator.agentResults.copywriting?.data?.structure?.format}</span>
						</div>
					</div>
				</div>

				<!-- Research -->
				<div class="bg-surface-raised p-6 border border-surface-border">
					<h3 class="text-lg font-semibold mb-4 text-yellow-400">Research Agent</h3>
					<div class="space-y-3 text-sm">
						<div>
							<span class="text-text-secondary">Trends:</span>
							<span class="ml-2">{result.orchestrator.agentResults.research?.data?.trendContext?.currentTrends?.join(', ')}</span>
						</div>
						<div>
							<span class="text-text-secondary">Trend Phase:</span>
							<span class="ml-2">{result.orchestrator.agentResults.research?.data?.trendContext?.trendPhase}</span>
						</div>
						<div>
							<span class="text-text-secondary">Relevance:</span>
							<span class="ml-2 text-accent-primary font-bold">{Math.round((result.orchestrator.agentResults.research?.data?.trendContext?.relevanceScore || 0) * 100)}%</span>
						</div>
					</div>
				</div>

				<!-- Psychology -->
				<div class="bg-surface-raised p-6 border border-surface-border">
					<h3 class="text-lg font-semibold mb-4 text-purple-400">Psychology Agent</h3>
					<div class="space-y-3 text-sm">
						<div>
							<span class="text-text-secondary">Primary Emotion:</span>
							<span class="ml-2">{result.orchestrator.agentResults.psychology?.data?.emotionalTriggers?.primary}</span>
						</div>
						<div>
							<span class="text-text-secondary">In-Group:</span>
							<span class="ml-2">{result.orchestrator.agentResults.psychology?.data?.identityResonance?.inGroup}</span>
						</div>
						<div>
							<span class="text-text-secondary">Emotion Intensity:</span>
							<span class="ml-2 text-accent-primary font-bold">{result.orchestrator.agentResults.psychology?.data?.emotionalTriggers?.intensity}/10</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Playbook -->
			<div class="mb-8 bg-surface-raised p-6 border border-surface-border">
				<h2 class="text-xl font-semibold mb-4">{result.synthesis.playbook.title}</h2>
				<p class="text-text-secondary mb-4">{result.synthesis.playbook.summary}</p>
				<ol class="space-y-4">
					{#each result.synthesis.playbook.steps as step}
						<li class="flex gap-4">
							<span class="text-accent-primary font-bold text-lg">{step.order}.</span>
							<div>
								<p class="font-medium">{step.action}</p>
								<p class="text-text-secondary text-sm">{step.rationale}</p>
							</div>
						</li>
					{/each}
				</ol>
			</div>

			<!-- Thread Expansion -->
			<div class="mb-8 bg-surface-raised p-6 border border-surface-border">
				<h2 class="text-xl font-semibold mb-4">Thread Expansion</h2>
				<p class="text-text-secondary mb-4">{result.creative.threadExpansion.estimatedReadTime}</p>
				<div class="space-y-4">
					{#each result.creative.threadExpansion.tweets as tweet}
						<div class="bg-surface-bg p-4 border border-surface-border">
							<div class="flex gap-2 mb-2">
								<span class="text-accent-primary font-bold">{tweet.position}/</span>
								<span class="text-text-secondary text-sm uppercase">{tweet.purpose}</span>
							</div>
							<p class="whitespace-pre-wrap">{tweet.content}</p>
							<p class="text-text-secondary text-xs mt-2">{tweet.characterCount} chars</p>
						</div>
					{/each}
				</div>
			</div>

			<!-- Image Recommendations -->
			<div class="mb-8 bg-surface-raised p-6 border border-surface-border">
				<h2 class="text-xl font-semibold mb-4">Image Recommendations</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					{#each result.creative.imageRecommendations as rec}
						<div class="bg-surface-bg p-4 border border-surface-border">
							<div class="flex justify-between mb-2">
								<span class="text-accent-primary font-semibold capitalize">{rec.platform}</span>
								<span class="text-text-secondary">{rec.aspectRatio}</span>
							</div>
							<p class="text-sm mb-2">Style: <span class="font-medium">{rec.style}</span></p>
							<p class="text-text-secondary text-sm">{rec.rationale}</p>
						</div>
					{/each}
				</div>
			</div>

			<!-- Processing Stats -->
			<div class="text-text-secondary text-sm">
				<p>Processing time: {result.orchestrator.processingTimeMs}ms</p>
				<p>Post ID: {result.postId}</p>
			</div>
		{/if}
	</div>
</div>
