<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import {
		initContentForgeBridge,
		requestContentForgeAnalysis,
		isClaudeCodeConnected,
		contentforgeResult,
		contentforgeStatus,
		contentforgeError,
		learnedPatterns,
		userStyle,
		creativeRecommendations,
		mindConnected,
		enhancedLearnings,
		getEnhancedLearnings,
		type LearnedPattern,
		type UserStyle,
		type CreativeRecommendation,
		type EnhancedLearnings,
		type EngagementCorrelation,
		type VisualInsight,
		type ContentTypePerformance,
		type TrendDataPoint
	} from '$lib/services/contentforge-bridge';
	import type { TweetData } from '$lib/services/x-api';

	// Input mode: 'tweet' for X/Twitter URL (default), 'text' for raw content
	let inputMode = $state<'text' | 'tweet'>('tweet');
	let inputText = $state('');
	let tweetUrl = $state('');
	let tweetData = $state<TweetData | null>(null);
	let fetchingTweet = $state(false);
	let xApiConfigured = $state(true); // assume configured until we know otherwise

	let loading = $state(false);
	let result: any = $state(null);
	let error: string | null = $state(null);
	let showWorkerSetup = $state(false);
	let copied = $state(false);

	// Worker status: 'connected' (green), 'disconnected' (yellow), 'error' (red)
	let workerStatus = $state<'connected' | 'disconnected' | 'error'>('disconnected');
	let statusMessage = $state('Checking worker status...');
	let statusCheckInterval: ReturnType<typeof setInterval> | null = null;
	let storeUnsubscribers: Array<() => void> = [];

	// Worker activity tracking (real-time progress)
	let workerBusy = $state(false);
	let workerCurrentTask = $state<string | null>(null);
	let workerProgress = $state<string[]>([]);
	let workerStartedAt = $state<string | null>(null);

	// Mind learning state
	let patterns = $state<LearnedPattern[]>([]);
	let style = $state<UserStyle | null>(null);
	let recommendations = $state<CreativeRecommendation[]>([]);
	let isMindConnected = $state(false);
	let learnings = $state<EnhancedLearnings | null>(null);
	let learningsLoading = $state(false);

	// Playbook feedback tracking
	interface PlaybookFeedback {
		stepOrder: number;
		action: string;
		status: 'pending' | 'implemented' | 'skipped';
		implementedAt?: string;
	}
	let playbookFeedback = $state<PlaybookFeedback[]>([]);
	let feedbackSaved = $state(false);

	const workerPrompt = `You are the ContentForge analysis worker. Read workers/contentforge-worker.md for full instructions.

CRITICAL: When you find pending work, STOP POLLING until you finish. Complete the entire analysis before looking for new work.

1. Register: POST to http://localhost:5175/api/contentforge/bridge/status with {"version": "claude-code"}
2. Poll: GET http://localhost:5175/api/contentforge/bridge/pending every 30 seconds
3. When pending=true:
   - STOP POLLING - don't check for new work until done
   - PATCH status {"action":"start","requestId":"...","task":"Starting..."}
   - Do the FULL analysis (all 4 agents + synthesis)
   - PATCH progress after each step (e.g., {"action":"progress","step":"Marketing Agent complete"})
4. Send result to BOTH endpoints:
   - POST to /api/contentforge/bridge/result (for polling fallback)
   - POST to /api/events (for SSE broadcast)
5. PATCH status {"action":"complete"}
6. DELETE http://localhost:5175/api/contentforge/bridge/pending
7. THEN resume polling

Skills are pre-bundled. Response needs: requestId, postId, orchestrator.agentResults (all 4), synthesis. Start now.`;

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
				statusMessage = data.busy ? 'Worker busy' : 'Worker connected';
			} else if (data.error) {
				workerStatus = 'error';
				statusMessage = data.error;
			} else {
				workerStatus = 'disconnected';
				statusMessage = 'Worker not connected';
			}

			// Update activity tracking
			workerBusy = data.busy || false;
			workerCurrentTask = data.currentTask || null;
			workerProgress = data.progress || [];
			workerStartedAt = data.startedAt || null;
		} catch (e) {
			workerStatus = 'error';
			statusMessage = 'Failed to check status';
		}
	}

	function getElapsedTime(startTime: string | null): string {
		if (!startTime) return '';
		const elapsed = Date.now() - new Date(startTime).getTime();
		const seconds = Math.floor(elapsed / 1000);
		const minutes = Math.floor(seconds / 60);
		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		}
		return `${seconds}s`;
	}

	/**
	 * Refresh learnings from Mind after an analysis completes
	 */
	async function refreshLearnings() {
		if (!isMindConnected) return;

		learningsLoading = true;
		try {
			const enhanced = await getEnhancedLearnings();
			if (enhanced) {
				learnings = enhanced;
				console.log('[ContentForge] Refreshed learnings:', enhanced.totalAnalyzed, 'analyses');
			}
		} catch (e) {
			console.warn('[ContentForge] Failed to refresh learnings:', e);
		} finally {
			learningsLoading = false;
		}
	}

	onMount(async () => {
		await initContentForgeBridge();
		// Check status immediately and then every 2 seconds (faster when tracking activity)
		await checkWorkerStatus();
		statusCheckInterval = setInterval(checkWorkerStatus, 2000);

		// Subscribe to stores as backup (in case Promise doesn't resolve)
		storeUnsubscribers.push(
			contentforgeResult.subscribe((value) => {
				if (value) {
					console.log('[ContentForge] Store received result:', value.postId);
					result = value;
					loading = false;
					initPlaybookFeedback();
					// Refresh learnings after new analysis
					refreshLearnings();
				}
			}),
			contentforgeStatus.subscribe((status) => {
				console.log('[ContentForge] Store status:', status);
				if (status === 'complete' || status === 'error') {
					loading = false;
				}
			}),
			contentforgeError.subscribe((err) => {
				if (err) {
					error = err;
					loading = false;
				}
			}),
			// Mind learning stores
			learnedPatterns.subscribe((value) => {
				patterns = value;
			}),
			userStyle.subscribe((value) => {
				style = value;
			}),
			creativeRecommendations.subscribe((value) => {
				recommendations = value;
			}),
			mindConnected.subscribe((value) => {
				isMindConnected = value;
			}),
			enhancedLearnings.subscribe((value) => {
				learnings = value;
			})
		);
	});

	onDestroy(() => {
		if (statusCheckInterval) {
			clearInterval(statusCheckInterval);
		}
		storeUnsubscribers.forEach(unsub => unsub());
	});

	/**
	 * Fetch tweet data from X API
	 */
	async function fetchTweet() {
		if (!tweetUrl.trim()) {
			error = 'Please enter a tweet URL';
			return;
		}

		fetchingTweet = true;
		error = null;
		tweetData = null;

		try {
			const response = await fetch('/api/x/tweet', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: tweetUrl })
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				if (response.status === 503) {
					xApiConfigured = false;
					throw new Error('X API not configured. Add X_BEARER_TOKEN to .env file.');
				}
				throw new Error(data.message || `Failed to fetch tweet: ${response.status}`);
			}

			const data = await response.json();
			tweetData = data.tweet;
			console.log('[ContentForge] Tweet fetched:', tweetData?.id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch tweet';
		} finally {
			fetchingTweet = false;
		}
	}

	/**
	 * Initialize playbook feedback tracking when result is received
	 */
	function initPlaybookFeedback() {
		if (!result?.synthesis?.playbook?.steps) return;

		playbookFeedback = result.synthesis.playbook.steps.map((step: { order: number; action: string }) => ({
			stepOrder: step.order,
			action: step.action,
			status: 'pending' as const
		}));
		feedbackSaved = false;
	}

	/**
	 * Mark a playbook step as implemented or skipped
	 */
	function markPlaybookStep(stepOrder: number, status: 'implemented' | 'skipped') {
		playbookFeedback = playbookFeedback.map(f =>
			f.stepOrder === stepOrder
				? { ...f, status, implementedAt: status === 'implemented' ? new Date().toISOString() : undefined }
				: f
		);
	}

	/**
	 * Save playbook feedback to Mind for learning
	 */
	async function savePlaybookFeedback() {
		if (!isMindConnected) return;

		const implementedSteps = playbookFeedback.filter(f => f.status === 'implemented');
		const skippedSteps = playbookFeedback.filter(f => f.status === 'skipped');

		if (implementedSteps.length === 0 && skippedSteps.length === 0) return;

		try {
			const feedbackContent = `
## ContentForge Playbook Feedback

**Original Virality Score:** ${result?.synthesis?.viralityScore || 'N/A'}

**Implemented Steps (${implementedSteps.length}):**
${implementedSteps.map(s => `- Step ${s.stepOrder}: ${s.action}`).join('\n') || 'None'}

**Skipped Steps (${skippedSteps.length}):**
${skippedSteps.map(s => `- Step ${s.stepOrder}: ${s.action}`).join('\n') || 'None'}

**Feedback Summary:**
- Implementation rate: ${Math.round((implementedSteps.length / playbookFeedback.length) * 100)}%
- User found ${implementedSteps.length} recommendations actionable
`.trim();

			const response = await fetch('http://localhost:8080/v1/memories/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: feedbackContent,
					temporal_level: 3,
					content_type: 'observation',
					salience: 0.8,
					metadata: {
						type: 'contentforge_playbook_feedback',
						original_score: result?.synthesis?.viralityScore,
						implemented_count: implementedSteps.length,
						skipped_count: skippedSteps.length,
						total_steps: playbookFeedback.length,
						implemented_steps: implementedSteps.map(s => s.action),
						skipped_steps: skippedSteps.map(s => s.action),
						timestamp: new Date().toISOString()
					}
				})
			});

			if (response.ok) {
				feedbackSaved = true;
				console.log('[ContentForge] Playbook feedback saved to Mind');
			}
		} catch (e) {
			console.warn('[ContentForge] Failed to save feedback:', e);
		}
	}

	/**
	 * Analyze content (text or tweet)
	 */
	async function analyze() {
		loading = true;
		error = null;
		result = null;

		try {
			let contentToAnalyze: string;

			if (inputMode === 'tweet') {
				// If we don't have tweet data yet, fetch it first
				if (!tweetData) {
					await fetchTweet();
					if (!tweetData) {
						throw new Error('Failed to load tweet data');
					}
				}

				// Build comprehensive content with tweet + metrics
				contentToAnalyze = formatTweetContent(tweetData);
			} else {
				contentToAnalyze = inputText;
			}

			if (!contentToAnalyze.trim()) {
				throw new Error('No content to analyze');
			}

			const bridgeResult = await requestContentForgeAnalysis(contentToAnalyze);
			result = bridgeResult;
			initPlaybookFeedback();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Analysis failed. Make sure the worker is running.';
		} finally {
			loading = false;
		}
	}

	/**
	 * Format tweet data for analysis
	 */
	function formatTweetContent(tweet: TweetData): string {
		const lines: string[] = [];

		lines.push('# REAL TWEET ANALYSIS (with engagement data)');
		lines.push('');
		lines.push('## Author');
		lines.push(`- **Name:** ${tweet.author.name} (@${tweet.author.username})`);
		lines.push(`- **Followers:** ${tweet.author.followers.toLocaleString()}`);
		lines.push(`- **Verified:** ${tweet.author.verified ? 'Yes' : 'No'}`);
		lines.push('');

		lines.push('## Tweet Content');
		lines.push('```');
		lines.push(tweet.text);
		lines.push('```');
		lines.push('');

		// Timing analysis
		const postedAt = new Date(tweet.createdAt);
		lines.push('## Timing');
		lines.push(`- **Posted:** ${postedAt.toLocaleString()}`);
		lines.push(`- **Day of Week:** ${postedAt.toLocaleDateString('en-US', { weekday: 'long' })}`);
		lines.push(`- **Time:** ${postedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`);
		lines.push('');

		// Real engagement metrics
		lines.push('## REAL Engagement Metrics');
		lines.push(`- **Impressions:** ${tweet.metrics.impressions.toLocaleString()}`);
		lines.push(`- **Likes:** ${tweet.metrics.likes.toLocaleString()}`);
		lines.push(`- **Retweets:** ${tweet.metrics.retweets.toLocaleString()}`);
		lines.push(`- **Replies:** ${tweet.metrics.replies.toLocaleString()}`);
		lines.push(`- **Quotes:** ${tweet.metrics.quotes.toLocaleString()}`);
		lines.push(`- **Bookmarks:** ${tweet.metrics.bookmarks.toLocaleString()}`);
		lines.push('');

		// Calculate engagement rates
		if (tweet.metrics.impressions > 0) {
			const totalEngagement = tweet.metrics.likes + tweet.metrics.retweets + tweet.metrics.replies;
			const engagementRate = (totalEngagement / tweet.metrics.impressions * 100).toFixed(2);
			const likeRate = (tweet.metrics.likes / tweet.metrics.impressions * 100).toFixed(3);
			const retweetRate = (tweet.metrics.retweets / tweet.metrics.impressions * 100).toFixed(3);
			const saveRate = (tweet.metrics.bookmarks / tweet.metrics.impressions * 100).toFixed(3);

			lines.push('## Engagement Rates');
			lines.push(`- **Total Engagement Rate:** ${engagementRate}%`);
			lines.push(`- **Like Rate:** ${likeRate}%`);
			lines.push(`- **Retweet Rate:** ${retweetRate}%`);
			lines.push(`- **Save/Bookmark Rate:** ${saveRate}%`);
			lines.push('');
		}

		// Media
		if (tweet.media.length > 0) {
			lines.push('## Media Attached');
			tweet.media.forEach((m, i) => {
				lines.push(`- ${m.type}${m.width ? ` (${m.width}x${m.height})` : ''}${m.altText ? ` - "${m.altText}"` : ''}`);
			});
			lines.push('');
		}

		// Tweet type context
		lines.push('## Context');
		if (tweet.isRetweet) lines.push('- This is a Retweet');
		else if (tweet.isQuote) lines.push('- This is a Quote Tweet');
		else if (tweet.isReply) lines.push('- This is a Reply');
		else lines.push('- This is an Original Tweet');
		lines.push(`- Language: ${tweet.language}`);
		lines.push(`- URL: ${tweet.url}`);
		lines.push('');

		lines.push('---');
		lines.push('');
		lines.push('**IMPORTANT:** This is REAL data from an actual tweet. Use the engagement metrics to:');
		lines.push('1. Validate which H70 patterns actually worked');
		lines.push('2. Learn from real performance, not theory');
		lines.push('3. Provide actionable insights based on what the numbers show');

		return lines.join('\n');
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

		<!-- Status Indicators -->
		<div class="mb-6 flex items-center gap-6 flex-wrap">
			<!-- Worker Status -->
			<div class="flex items-center gap-2">
				<span class="text-text-secondary text-sm">Worker:</span>
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

			<!-- Mind Status -->
			<div class="flex items-center gap-2">
				<span class="text-text-secondary text-sm">Mind:</span>
				<div class="flex items-center gap-2 px-3 py-1.5 border border-surface-border">
					{#if isMindConnected}
						<span class="w-2 h-2 bg-purple-500 animate-pulse"></span>
						<span class="text-sm text-purple-400">Learning enabled</span>
					{:else}
						<span class="w-2 h-2 bg-gray-500"></span>
						<span class="text-sm text-gray-400">Not connected</span>
					{/if}
				</div>
			</div>
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
			<!-- Input Mode Tabs -->
			<div class="flex items-center gap-4 mb-4">
				<h2 class="text-xl font-semibold">Content to Analyze</h2>
				<div class="flex border border-surface-border">
					<button
						onclick={() => { inputMode = 'text'; tweetData = null; }}
						class="px-4 py-1.5 text-sm transition-colors {inputMode === 'text' ? 'bg-accent-primary text-white' : 'text-text-secondary hover:text-text-primary'}"
					>
						Text
					</button>
					<button
						onclick={() => inputMode = 'tweet'}
						class="px-4 py-1.5 text-sm transition-colors {inputMode === 'tweet' ? 'bg-blue-500 text-white' : 'text-text-secondary hover:text-text-primary'}"
					>
						Tweet URL
					</button>
				</div>
			</div>

			{#if inputMode === 'text'}
				<!-- Text Input Mode -->
				<textarea
					bind:value={inputText}
					class="w-full h-48 bg-bg-primary border border-surface-border p-4 font-mono text-sm"
					placeholder="Paste your content here..."
				></textarea>
			{:else}
				<!-- Tweet URL Input Mode -->
				<div class="space-y-4">
					<div class="flex gap-2">
						<input
							type="text"
							bind:value={tweetUrl}
							placeholder="Paste tweet URL (e.g., https://x.com/user/status/123456789)"
							class="flex-1 bg-bg-primary border border-surface-border px-4 py-3 font-mono text-sm"
						/>
						<button
							onclick={fetchTweet}
							disabled={fetchingTweet || !tweetUrl.trim()}
							class="px-4 py-2 bg-blue-500 text-white font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{fetchingTweet ? 'Loading...' : 'Load Tweet'}
						</button>
					</div>

					{#if !xApiConfigured}
						<div class="bg-yellow-900/20 border border-yellow-500 p-4">
							<p class="text-yellow-400 text-sm">X API not configured. Add X_BEARER_TOKEN to your .env file.</p>
						</div>
					{/if}

					{#if tweetData}
						<!-- Tweet Preview -->
						<div class="bg-bg-primary border border-blue-500/30 p-4">
							<div class="flex items-start gap-3">
								<img src={tweetData.author.profileImageUrl} alt="" class="w-12 h-12 rounded-full" />
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<span class="font-semibold">{tweetData.author.name}</span>
										<span class="text-text-tertiary">@{tweetData.author.username}</span>
										{#if tweetData.author.verified}
											<span class="text-blue-400">✓</span>
										{/if}
									</div>
									<p class="text-sm whitespace-pre-wrap mb-3">{tweetData.text}</p>

									<!-- Metrics -->
									<div class="flex flex-wrap gap-4 text-sm text-text-secondary">
										<span title="Impressions">👁 {tweetData.metrics.impressions.toLocaleString()}</span>
										<span title="Likes">❤️ {tweetData.metrics.likes.toLocaleString()}</span>
										<span title="Retweets">🔁 {tweetData.metrics.retweets.toLocaleString()}</span>
										<span title="Replies">💬 {tweetData.metrics.replies.toLocaleString()}</span>
										<span title="Bookmarks">🔖 {tweetData.metrics.bookmarks.toLocaleString()}</span>
									</div>

									<!-- Media indicators -->
									{#if tweetData.media.length > 0}
										<div class="mt-2 flex gap-2">
											{#each tweetData.media as m}
												<span class="text-xs px-2 py-0.5 bg-surface border border-surface-border">
													{m.type === 'photo' ? '📷' : m.type === 'video' ? '🎥' : '🎞️'} {m.type}
												</span>
											{/each}
										</div>
									{/if}

									<p class="text-xs text-text-tertiary mt-2">
										{new Date(tweetData.createdAt).toLocaleString()}
									</p>
								</div>
							</div>
						</div>
					{:else if !fetchingTweet}
						<div class="bg-bg-primary border border-surface-border p-8 text-center text-text-tertiary">
							<p>Paste a tweet URL and click "Load Tweet" to fetch engagement data</p>
							<p class="text-xs mt-2">Supports: x.com, twitter.com</p>
						</div>
					{/if}
				</div>
			{/if}

			<button
				onclick={analyze}
				disabled={loading || (inputMode === 'text' && !inputText.trim()) || (inputMode === 'tweet' && !tweetData)}
				class="mt-4 px-6 py-2 bg-accent-primary text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{loading ? 'Analyzing...' : inputMode === 'tweet' ? 'Analyze Tweet' : 'Analyze Content'}
			</button>
		</div>

		{#if error}
			<div class="bg-red-900/20 border border-red-500 p-4 mb-8">
				<p class="text-red-400">{error}</p>
			</div>
		{/if}

		{#if result}
			<!-- Virality Score -->
			{#if result.synthesis?.viralityScore !== undefined}
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
			{/if}

			<!-- Key Insights -->
			{#if result.synthesis?.keyInsights?.length > 0}
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
			{/if}

			<!-- Agent Results Grid -->
			{#if result.orchestrator?.agentResults}
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
					{#if result.orchestrator.agentResults.marketing}
						<div class="bg-bg-secondary p-6 border border-surface-border">
							<h3 class="text-lg font-semibold mb-4 text-blue-400">Marketing Agent</h3>
							<div class="space-y-3 text-sm">
								<div><span class="text-text-secondary">Authority:</span> <span class="ml-2">{result.orchestrator.agentResults.marketing?.data?.positioning?.authorityLevel || 'N/A'}</span></div>
								<div><span class="text-text-secondary">Niche:</span> <span class="ml-2">{result.orchestrator.agentResults.marketing?.data?.positioning?.niche || 'N/A'}</span></div>
								<div><span class="text-text-secondary">Shareability:</span> <span class="ml-2 text-accent-primary font-bold">{result.orchestrator.agentResults.marketing?.data?.distributionFactors?.shareability || 0}/10</span></div>
							</div>
						</div>
					{/if}
					{#if result.orchestrator.agentResults.copywriting}
						<div class="bg-bg-secondary p-6 border border-surface-border">
							<h3 class="text-lg font-semibold mb-4 text-green-400">Copywriting Agent</h3>
							<div class="space-y-3 text-sm">
								<div><span class="text-text-secondary">Hook Type:</span> <span class="ml-2">{result.orchestrator.agentResults.copywriting?.data?.hook?.type || 'N/A'}</span></div>
								<div><span class="text-text-secondary">Hook Effectiveness:</span> <span class="ml-2 text-accent-primary font-bold">{result.orchestrator.agentResults.copywriting?.data?.hook?.effectiveness || 0}/10</span></div>
								<div><span class="text-text-secondary">Structure:</span> <span class="ml-2">{result.orchestrator.agentResults.copywriting?.data?.structure?.format || 'N/A'}</span></div>
							</div>
						</div>
					{/if}
					{#if result.orchestrator.agentResults.research}
						<div class="bg-bg-secondary p-6 border border-surface-border">
							<h3 class="text-lg font-semibold mb-4 text-yellow-400">Research Agent</h3>
							<div class="space-y-3 text-sm">
								<div><span class="text-text-secondary">Trends:</span> <span class="ml-2">{result.orchestrator.agentResults.research?.data?.trendContext?.currentTrends?.join(', ') || 'N/A'}</span></div>
								<div><span class="text-text-secondary">Trend Phase:</span> <span class="ml-2">{result.orchestrator.agentResults.research?.data?.trendContext?.trendPhase || 'N/A'}</span></div>
								<div><span class="text-text-secondary">Relevance:</span> <span class="ml-2 text-accent-primary font-bold">{Math.round((result.orchestrator.agentResults.research?.data?.trendContext?.relevanceScore || 0) * 100)}%</span></div>
							</div>
						</div>
					{/if}
					{#if result.orchestrator.agentResults.psychology}
						<div class="bg-bg-secondary p-6 border border-surface-border">
							<h3 class="text-lg font-semibold mb-4 text-purple-400">Psychology Agent</h3>
							<div class="space-y-3 text-sm">
								<div><span class="text-text-secondary">Primary Emotion:</span> <span class="ml-2">{result.orchestrator.agentResults.psychology?.data?.emotionalTriggers?.primary || 'N/A'}</span></div>
								<div><span class="text-text-secondary">In-Group:</span> <span class="ml-2">{result.orchestrator.agentResults.psychology?.data?.identityResonance?.inGroup || 'N/A'}</span></div>
								<div><span class="text-text-secondary">Emotion Intensity:</span> <span class="ml-2 text-accent-primary font-bold">{result.orchestrator.agentResults.psychology?.data?.emotionalTriggers?.intensity || 0}/10</span></div>
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Playbook with Feedback -->
			{#if result.synthesis?.playbook}
				<div class="mb-8 bg-bg-secondary p-6 border border-surface-border">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-semibold">{result.synthesis.playbook.title || 'Playbook'}</h2>
						{#if isMindConnected && playbookFeedback.length > 0}
							<div class="flex items-center gap-2">
								{#if feedbackSaved}
									<span class="text-green-400 text-sm">Feedback saved</span>
								{:else}
									<button
										onclick={savePlaybookFeedback}
										disabled={playbookFeedback.every(f => f.status === 'pending')}
										class="px-3 py-1 text-sm bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Save Feedback to Mind
									</button>
								{/if}
							</div>
						{/if}
					</div>
					<p class="text-text-secondary mb-4">{result.synthesis.playbook.summary || ''}</p>
					{#if result.synthesis.playbook.steps?.length > 0}
						<ol class="space-y-4">
							{#each result.synthesis.playbook.steps as step, i}
								{@const feedback = playbookFeedback.find(f => f.stepOrder === step.order)}
								<li class="flex gap-4 p-3 border border-surface-border {feedback?.status === 'implemented' ? 'bg-green-500/10 border-green-500/30' : feedback?.status === 'skipped' ? 'bg-gray-500/10 border-gray-500/30' : 'bg-bg-primary'}">
									<span class="text-accent-primary font-bold text-lg">{step.order}.</span>
									<div class="flex-1">
										<p class="font-medium {feedback?.status === 'implemented' ? 'line-through text-text-secondary' : ''}">{step.action}</p>
										<p class="text-text-secondary text-sm">{step.rationale}</p>
									</div>
									{#if isMindConnected}
										<div class="flex items-center gap-2">
											<button
												onclick={() => markPlaybookStep(step.order, 'implemented')}
												class="p-1.5 text-sm {feedback?.status === 'implemented' ? 'bg-green-500 text-white' : 'bg-green-500/20 text-green-400 hover:bg-green-500/40'}"
												title="Mark as implemented"
											>
												✓
											</button>
											<button
												onclick={() => markPlaybookStep(step.order, 'skipped')}
												class="p-1.5 text-sm {feedback?.status === 'skipped' ? 'bg-gray-500 text-white' : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/40'}"
												title="Skip this step"
											>
												✕
											</button>
										</div>
									{/if}
								</li>
							{/each}
						</ol>
						{#if isMindConnected}
							<p class="text-text-tertiary text-xs mt-4">Track which recommendations you implement to improve future suggestions</p>
						{/if}
					{/if}
				</div>
			{/if}

			<!-- Creative Recommendations (from Mind) -->
			{#if recommendations.length > 0}
				<div class="mb-8 bg-bg-secondary p-6 border border-purple-500/30">
					<h2 class="text-xl font-semibold mb-4 text-purple-400">Creative Format Recommendations</h2>
					<p class="text-text-secondary text-sm mb-4">Based on content analysis and learned patterns</p>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#each recommendations as rec}
							<div class="bg-bg-primary p-4 border border-surface-border">
								<div class="flex items-center justify-between mb-2">
									<span class="font-semibold">{rec.format}</span>
									<span class="text-sm text-accent-primary">{Math.round(rec.confidence * 100)}% match</span>
								</div>
								<p class="text-text-secondary text-sm">{rec.reason}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Processing Stats -->
			<div class="text-text-secondary text-sm">
				{#if result.orchestrator?.processingTimeMs}
					<p>Processing time: {result.orchestrator.processingTimeMs}ms</p>
				{/if}
				{#if result.postId}
					<p>Post ID: {result.postId}</p>
				{/if}
				<p class="text-green-400 mt-2">Analyzed with Claude AI Worker</p>
				{#if isMindConnected}
					<p class="text-purple-400">Learning saved to Mind</p>
				{/if}
			</div>
		{/if}

		<!-- Worker Activity Panel (shows when worker is busy or has recent activity) -->
		{#if workerBusy || workerProgress.length > 0}
			<div class="mt-8 bg-bg-secondary border border-surface-border">
				<div class="p-4 border-b border-surface-border flex items-center justify-between">
					<div class="flex items-center gap-3">
						<h3 class="font-semibold">Worker Activity</h3>
						{#if workerBusy}
							<span class="flex items-center gap-2 text-sm text-accent-primary">
								<span class="w-2 h-2 bg-accent-primary animate-pulse"></span>
								Processing...
							</span>
						{:else}
							<span class="text-sm text-green-400">Complete</span>
						{/if}
					</div>
					{#if workerStartedAt && workerBusy}
						<span class="text-sm text-text-secondary font-mono">{getElapsedTime(workerStartedAt)}</span>
					{/if}
				</div>
				<div class="p-4">
					{#if workerCurrentTask}
						<div class="mb-4">
							<span class="text-text-secondary text-sm">Current:</span>
							<span class="ml-2 text-text-primary">{workerCurrentTask}</span>
						</div>
					{/if}
					{#if workerProgress.length > 0}
						<div class="space-y-2">
							<span class="text-text-secondary text-sm">Progress:</span>
							<div class="pl-4 border-l-2 border-surface-border space-y-1">
								{#each workerProgress as step, i}
									<div class="flex items-center gap-2 text-sm">
										<span class="w-4 h-4 flex items-center justify-center text-xs border border-green-500 text-green-500">✓</span>
										<span class="text-text-secondary">{step}</span>
									</div>
								{/each}
								{#if workerBusy && workerCurrentTask && !workerProgress.includes(workerCurrentTask)}
									<div class="flex items-center gap-2 text-sm">
										<span class="w-4 h-4 flex items-center justify-center">
											<span class="w-2 h-2 bg-accent-primary animate-pulse"></span>
										</span>
										<span class="text-accent-primary">{workerCurrentTask}</span>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Mind Learning Section (shows when Mind is connected) -->
		{#if isMindConnected && (learnings || patterns.length > 0 || style)}
			<div class="mt-12 border-t border-surface-border pt-8">
				<div class="flex items-center justify-between mb-6">
					<div class="flex items-center gap-3">
						<h2 class="text-2xl font-bold text-purple-400">Mind Learning</h2>
						{#if learningsLoading}
							<span class="text-sm text-purple-400 animate-pulse">Updating...</span>
						{/if}
					</div>
					{#if learnings}
						<div class="text-sm text-text-secondary">
							{learnings.totalAnalyzed} analyses tracked
						</div>
					{/if}
				</div>

				<!-- Overview Stats Row -->
				{#if learnings && learnings.totalAnalyzed > 0}
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
						<div class="bg-bg-secondary p-4 border border-purple-500/30 text-center">
							<div class="text-3xl font-bold text-accent-primary">{style?.averageViralityScore || 0}</div>
							<div class="text-xs text-text-secondary mt-1">Avg Virality</div>
						</div>
						<div class="bg-bg-secondary p-4 border border-purple-500/30 text-center">
							<div class="text-3xl font-bold text-blue-400">{learnings.totalAnalyzed}</div>
							<div class="text-xs text-text-secondary mt-1">Posts Analyzed</div>
						</div>
						<div class="bg-bg-secondary p-4 border border-purple-500/30 text-center">
							<div class="text-3xl font-bold text-green-400">{learnings.engagementCorrelations.length}</div>
							<div class="text-xs text-text-secondary mt-1">Patterns Tracked</div>
						</div>
						<div class="bg-bg-secondary p-4 border border-purple-500/30 text-center">
							<div class="text-3xl font-bold text-yellow-400">
								{learnings.engagementCorrelations.filter(c => c.trend === 'improving').length}
							</div>
							<div class="text-xs text-text-secondary mt-1">Improving Trends</div>
						</div>
					</div>
				{/if}

				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Engagement Correlations -->
					{#if learnings && learnings.engagementCorrelations.length > 0}
						<div class="bg-bg-secondary p-6 border border-purple-500/30">
							<h3 class="text-lg font-semibold mb-4">Pattern Performance</h3>
							<p class="text-text-tertiary text-xs mb-4">How different patterns correlate with engagement</p>
							<div class="space-y-3">
								{#each learnings.engagementCorrelations.slice(0, 8) as corr}
									<div class="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
										<div class="flex items-center gap-2">
											<span class="px-1.5 py-0.5 text-xs {corr.category === 'hook' ? 'bg-green-900/30 text-green-400' : corr.category === 'emotion' ? 'bg-purple-900/30 text-purple-400' : 'bg-blue-900/30 text-blue-400'}">
												{corr.category}
											</span>
											<span class="font-medium text-sm">{corr.pattern}</span>
										</div>
										<div class="flex items-center gap-3 text-right">
											{#if corr.avgEngagementRate > 0}
												<span class="text-xs text-text-secondary" title="Engagement Rate">
													{corr.avgEngagementRate}%
												</span>
											{/if}
											<span class="text-xs {corr.trend === 'improving' ? 'text-green-400' : corr.trend === 'declining' ? 'text-red-400' : 'text-text-tertiary'}">
												{corr.trend === 'improving' ? '↑' : corr.trend === 'declining' ? '↓' : '→'}
											</span>
											<span class="text-text-tertiary text-xs">({corr.sampleSize}x)</span>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Visual Insights -->
					{#if learnings && learnings.visualInsights.length > 0}
						<div class="bg-bg-secondary p-6 border border-purple-500/30">
							<h3 class="text-lg font-semibold mb-4">Visual Performance</h3>
							<p class="text-text-tertiary text-xs mb-4">How media types affect virality</p>
							<div class="space-y-4">
								{#each learnings.visualInsights as insight}
									<div class="flex items-center justify-between">
										<div>
											<span class="font-medium">{insight.type}</span>
											<span class="text-text-tertiary text-xs ml-2">({insight.sampleSize} posts)</span>
										</div>
										<div class="flex items-center gap-4">
											<div class="text-right">
												<div class="text-accent-primary font-bold">{insight.avgViralityScore}</div>
												<div class="text-xs text-text-tertiary">avg score</div>
											</div>
											{#if insight.avgEngagement > 0}
												<div class="text-right">
													<div class="text-blue-400 font-bold">{insight.avgEngagement}%</div>
													<div class="text-xs text-text-tertiary">engagement</div>
												</div>
											{/if}
										</div>
									</div>
									<div class="h-2 bg-bg-primary border border-surface-border">
										<div
											class="h-full {insight.type === 'Video' ? 'bg-red-500' : insight.type === 'Image' ? 'bg-blue-500' : 'bg-gray-500'}"
											style="width: {insight.avgViralityScore}%"
										></div>
									</div>
								{/each}
							</div>
							<p class="text-text-tertiary text-xs mt-4">
								Best style: {learnings.visualInsights[0]?.bestPerformingStyle || 'N/A'}
							</p>
						</div>
					{/if}

					<!-- Content Type Performance -->
					{#if learnings && learnings.contentTypePerformance.length > 0}
						<div class="bg-bg-secondary p-6 border border-purple-500/30">
							<h3 class="text-lg font-semibold mb-4">Content Type Performance</h3>
							<p class="text-text-tertiary text-xs mb-4">Which formats work best for you</p>
							<div class="space-y-4">
								{#each learnings.contentTypePerformance as perf}
									<div class="p-3 bg-bg-primary border border-surface-border">
										<div class="flex items-center justify-between mb-2">
											<span class="font-semibold">{perf.contentType}</span>
											<div class="flex items-center gap-2">
												<span class="text-accent-primary font-bold">{perf.avgViralityScore}</span>
												<span class="text-text-tertiary text-xs">avg</span>
											</div>
										</div>
										<div class="text-text-secondary text-xs mb-2">{perf.count} posts analyzed</div>
										{#if perf.topPatterns.length > 0}
											<div class="flex flex-wrap gap-1">
												{#each perf.topPatterns.slice(0, 3) as pattern}
													<span class="px-1.5 py-0.5 bg-surface border border-surface-border text-xs text-text-secondary">{pattern}</span>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Trend Chart (Simple Text Visualization) -->
					{#if learnings && learnings.trendData.length >= 3}
						<div class="bg-bg-secondary p-6 border border-purple-500/30">
							<h3 class="text-lg font-semibold mb-4">Performance Trend</h3>
							<p class="text-text-tertiary text-xs mb-4">Your last {learnings.trendData.length} analyses</p>
							<div class="h-32 flex items-end gap-1">
								{#each learnings.trendData as point, i}
									{@const height = Math.max(10, point.viralityScore)}
									<div
										class="flex-1 bg-accent-primary/70 hover:bg-accent-primary transition-colors relative group"
										style="height: {height}%"
										title="{point.date}: {point.viralityScore}"
									>
										<div class="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-text-tertiary opacity-0 group-hover:opacity-100 whitespace-nowrap">
											{point.viralityScore}
										</div>
									</div>
								{/each}
							</div>
							<div class="flex justify-between text-xs text-text-tertiary mt-2">
								<span>{learnings.trendData[0]?.date || ''}</span>
								<span>{learnings.trendData[learnings.trendData.length - 1]?.date || ''}</span>
							</div>
							{#if learnings.trendData.length > 0}
								{@const avgTrend = learnings.trendData.reduce((a, b) => a + b.viralityScore, 0) / learnings.trendData.length}
								{@const recentAvg = learnings.trendData.slice(-3).reduce((a, b) => a + b.viralityScore, 0) / Math.min(3, learnings.trendData.length)}
								<div class="mt-4 text-sm">
									<span class="text-text-secondary">Trend: </span>
									{#if recentAvg > avgTrend + 3}
										<span class="text-green-400">Improving (+{Math.round(recentAvg - avgTrend)} pts)</span>
									{:else if recentAvg < avgTrend - 3}
										<span class="text-red-400">Declining ({Math.round(recentAvg - avgTrend)} pts)</span>
									{:else}
										<span class="text-text-tertiary">Stable</span>
									{/if}
								</div>
							{/if}
						</div>
					{/if}

					<!-- Legacy Style Profile (fallback when enhanced data not available) -->
					{#if style && (!learnings || learnings.totalAnalyzed === 0)}
						<div class="bg-bg-secondary p-6 border border-purple-500/30">
							<h3 class="text-lg font-semibold mb-4">Your Style Profile</h3>
							<div class="space-y-4 text-sm">
								<div>
									<span class="text-text-secondary">Average Virality Score:</span>
									<span class="ml-2 text-2xl font-bold text-accent-primary">{style.averageViralityScore}</span>
									<span class="text-text-secondary">/100</span>
								</div>
								<div>
									<span class="text-text-secondary">Content Analyzed:</span>
									<span class="ml-2 font-semibold">{style.totalAnalyzed} posts</span>
								</div>
								{#if style.preferredHookTypes.length > 0}
									<div>
										<span class="text-text-secondary block mb-1">Preferred Hooks:</span>
										<div class="flex flex-wrap gap-2">
											{#each style.preferredHookTypes as hook}
												<span class="px-2 py-1 bg-green-900/30 text-green-400 text-xs">{hook}</span>
											{/each}
										</div>
									</div>
								{/if}
								{#if style.strongEmotions.length > 0}
									<div>
										<span class="text-text-secondary block mb-1">Strong Emotions:</span>
										<div class="flex flex-wrap gap-2">
											{#each style.strongEmotions as emotion}
												<span class="px-2 py-1 bg-purple-900/30 text-purple-400 text-xs">{emotion}</span>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<!-- Learn More Footer -->
				<div class="mt-6 p-4 bg-purple-900/10 border border-purple-500/20">
					<p class="text-sm text-purple-300">
						Mind learns from each analysis. Analyze more content to improve pattern recognition and get better recommendations.
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>
