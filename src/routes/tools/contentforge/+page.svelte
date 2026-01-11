<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import {
		initContentForgeBridge,
		requestContentForgeAnalysis,
		isClaudeCodeConnected
	} from '$lib/services/contentforge-bridge';

	let inputText = $state(`Here's my secret to building a $1M ARR startup in 12 months:

1. Ship fast, iterate faster
2. Talk to users every single day
3. Focus on one metric that matters
4. Build in public - your journey is your marketing

The hardest part? Staying consistent when nobody's watching.

But that's exactly when you build the foundation for success.`);

	let loading = $state(false);
	let result: any = $state(null);
	let error: string | null = $state(null);
	let showWorkerSetup = $state(false);
	let copied = $state(false);

	// Worker status: 'connected' (green), 'disconnected' (yellow), 'error' (red)
	let workerStatus = $state<'connected' | 'disconnected' | 'error'>('disconnected');
	let statusMessage = $state('Checking worker status...');
	let statusCheckInterval: ReturnType<typeof setInterval> | null = null;

	const workerPrompt = `You are the ContentForge analysis worker. Poll http://localhost:5174/api/contentforge/bridge/pending every 10 seconds. When pending=true, analyze the content as Marketing, Copywriting, Research, and Psychology agents. Send full analysis via POST to http://localhost:5174/api/events with type "contentforge_analysis_complete". Then DELETE the pending request. Run autonomously - no questions, just analyze and respond. Start now.`;

	function copyPrompt() {
		navigator.clipboard.writeText(workerPrompt);
		copied = true;
		setTimeout(() => copied = false, 2000);
	}

	async function checkWorkerStatus() {
		try {
			const response = await fetch('/api/contentforge/bridge/status');
			if (!response.ok) {
				workerStatus = 'error';
				statusMessage = 'Status check failed';
				return;
			}
			const data = await response.json();
			if (data.connected) {
				workerStatus = 'connected';
				statusMessage = 'Worker connected';
			} else if (data.error) {
				workerStatus = 'error';
				statusMessage = data.error;
			} else {
				workerStatus = 'disconnected';
				statusMessage = 'Worker not connected';
			}
		} catch (e) {
			workerStatus = 'error';
			statusMessage = 'Failed to check status';
		}
	}

	onMount(async () => {
		await initContentForgeBridge();
		// Check status immediately and then every 10 seconds
		await checkWorkerStatus();
		statusCheckInterval = setInterval(checkWorkerStatus, 10000);
	});

	onDestroy(() => {
		if (statusCheckInterval) {
			clearInterval(statusCheckInterval);
		}
	});

	async function analyze() {
		loading = true;
		error = null;
		result = null;
		try {
			const bridgeResult = await requestContentForgeAnalysis(inputText);
			result = bridgeResult;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Analysis failed. Make sure the worker is running.';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>ContentForge - Viral Content Analysis</title>
</svelte:head>

<Navbar />

<div class="min-h-screen bg-bg-primary text-text-primary p-8">
	<div class="max-w-6xl mx-auto">
		<header class="mb-8">
			<h1 class="text-3xl font-bold mb-2">ContentForge</h1>
			<p class="text-text-secondary">Viral Content Analysis Pipeline</p>
		</header>

		<!-- Worker Status Indicator -->
		<div class="mb-6 flex items-center gap-4">
			<span class="text-text-secondary text-sm">Worker Status:</span>
			<div class="flex items-center gap-2 px-3 py-1.5 border border-surface-border">
				{#if workerStatus === 'connected'}
					<span class="w-2 h-2 bg-green-500 animate-pulse"></span>
					<span class="text-sm text-green-400">{statusMessage}</span>
				{:else if workerStatus === 'disconnected'}
					<span class="w-2 h-2 bg-yellow-500"></span>
					<span class="text-sm text-yellow-400">{statusMessage}</span>
				{:else}
					<span class="w-2 h-2 bg-red-500"></span>
					<span class="text-sm text-red-400">{statusMessage}</span>
				{/if}
			</div>
			<button
				onclick={() => showWorkerSetup = true}
				class="px-3 py-1.5 text-sm border border-accent-primary text-accent-primary hover:bg-accent-primary hover:text-white transition-colors"
			>
				{workerStatus === 'connected' ? 'Worker Instructions' : 'Start Worker'}
			</button>
		</div>

		<!-- Worker Setup Modal -->
		{#if showWorkerSetup}
			<div class="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onclick={() => showWorkerSetup = false}>
				<div class="bg-bg-secondary border border-surface-border p-6 max-w-xl w-full mx-4" onclick={(e) => e.stopPropagation()}>
					<div class="flex justify-between items-center mb-4">
						<h3 class="text-lg font-semibold">Start ContentForge Worker</h3>
						<button onclick={() => showWorkerSetup = false} class="text-text-tertiary hover:text-text-primary text-xl">&times;</button>
					</div>

					<div class="space-y-4 text-sm">
						<div class="space-y-2">
							<p class="text-text-secondary"><span class="text-accent-primary font-bold">1.</span> Open a new terminal</p>
							<p class="text-text-secondary"><span class="text-accent-primary font-bold">2.</span> Run <code class="bg-bg-primary px-2 py-0.5 text-accent-primary">claude</code></p>
							<p class="text-text-secondary"><span class="text-accent-primary font-bold">3.</span> Paste this prompt:</p>
						</div>

						<div class="bg-bg-primary border border-surface-border p-3 font-mono text-xs text-text-secondary leading-relaxed">
							{workerPrompt}
						</div>

						<button
							onclick={copyPrompt}
							class="w-full py-2 bg-accent-primary text-white font-semibold hover:bg-accent-secondary transition-colors"
						>
							{copied ? 'Copied!' : 'Copy Prompt'}
						</button>

						<p class="text-text-tertiary text-xs text-center">
							Worker runs autonomously - just click "Analyze Content" and it responds.
						</p>
					</div>
				</div>
			</div>
		{/if}

		<div class="mb-8 bg-bg-secondary p-6 border border-surface-border">
			<h2 class="text-xl font-semibold mb-4">Content to Analyze</h2>
			<textarea bind:value={inputText} class="w-full h-48 bg-bg-primary border border-surface-border p-4 font-mono text-sm" placeholder="Paste content..."></textarea>
			<button onclick={analyze} disabled={loading} class="mt-4 px-6 py-2 bg-accent-primary text-white font-semibold">
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
			<div class="mb-8 bg-bg-secondary p-6 border border-surface-border">
				<h2 class="text-xl font-semibold mb-4">Virality Score</h2>
				<div class="flex items-center gap-4">
					<div class="text-5xl font-bold text-accent-primary">{result.synthesis.viralityScore}</div>
					<div class="text-text-secondary">/ 100</div>
					<div class="flex-1 h-4 bg-bg-primary border border-surface-border">
						<div class="h-full bg-accent-primary transition-all duration-500" style="width: {result.synthesis.viralityScore}%"></div>
					</div>
				</div>
			</div>

			<!-- Key Insights -->
			<div class="mb-8 bg-bg-secondary p-6 border border-surface-border">
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
				<div class="bg-bg-secondary p-6 border border-surface-border">
					<h3 class="text-lg font-semibold mb-4 text-blue-400">Marketing Agent</h3>
					<div class="space-y-3 text-sm">
						<div><span class="text-text-secondary">Authority:</span> <span class="ml-2">{result.orchestrator.agentResults.marketing?.data?.positioning?.authorityLevel}</span></div>
						<div><span class="text-text-secondary">Niche:</span> <span class="ml-2">{result.orchestrator.agentResults.marketing?.data?.positioning?.niche}</span></div>
						<div><span class="text-text-secondary">Shareability:</span> <span class="ml-2 text-accent-primary font-bold">{result.orchestrator.agentResults.marketing?.data?.distributionFactors?.shareability}/10</span></div>
					</div>
				</div>
				<div class="bg-bg-secondary p-6 border border-surface-border">
					<h3 class="text-lg font-semibold mb-4 text-green-400">Copywriting Agent</h3>
					<div class="space-y-3 text-sm">
						<div><span class="text-text-secondary">Hook Type:</span> <span class="ml-2">{result.orchestrator.agentResults.copywriting?.data?.hook?.type}</span></div>
						<div><span class="text-text-secondary">Hook Effectiveness:</span> <span class="ml-2 text-accent-primary font-bold">{result.orchestrator.agentResults.copywriting?.data?.hook?.effectiveness}/10</span></div>
						<div><span class="text-text-secondary">Structure:</span> <span class="ml-2">{result.orchestrator.agentResults.copywriting?.data?.structure?.format}</span></div>
					</div>
				</div>
				<div class="bg-bg-secondary p-6 border border-surface-border">
					<h3 class="text-lg font-semibold mb-4 text-yellow-400">Research Agent</h3>
					<div class="space-y-3 text-sm">
						<div><span class="text-text-secondary">Trends:</span> <span class="ml-2">{result.orchestrator.agentResults.research?.data?.trendContext?.currentTrends?.join(', ')}</span></div>
						<div><span class="text-text-secondary">Trend Phase:</span> <span class="ml-2">{result.orchestrator.agentResults.research?.data?.trendContext?.trendPhase}</span></div>
						<div><span class="text-text-secondary">Relevance:</span> <span class="ml-2 text-accent-primary font-bold">{Math.round((result.orchestrator.agentResults.research?.data?.trendContext?.relevanceScore || 0) * 100)}%</span></div>
					</div>
				</div>
				<div class="bg-bg-secondary p-6 border border-surface-border">
					<h3 class="text-lg font-semibold mb-4 text-purple-400">Psychology Agent</h3>
					<div class="space-y-3 text-sm">
						<div><span class="text-text-secondary">Primary Emotion:</span> <span class="ml-2">{result.orchestrator.agentResults.psychology?.data?.emotionalTriggers?.primary}</span></div>
						<div><span class="text-text-secondary">In-Group:</span> <span class="ml-2">{result.orchestrator.agentResults.psychology?.data?.identityResonance?.inGroup}</span></div>
						<div><span class="text-text-secondary">Emotion Intensity:</span> <span class="ml-2 text-accent-primary font-bold">{result.orchestrator.agentResults.psychology?.data?.emotionalTriggers?.intensity}/10</span></div>
					</div>
				</div>
			</div>

			<!-- Playbook -->
			<div class="mb-8 bg-bg-secondary p-6 border border-surface-border">
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

			<!-- Processing Stats -->
			<div class="text-text-secondary text-sm">
				<p>Processing time: {result.orchestrator.processingTimeMs}ms</p>
				<p>Post ID: {result.postId}</p>
				<p class="text-green-400 mt-2">Analyzed with Claude AI Worker</p>
			</div>
		{/if}
	</div>
</div>
