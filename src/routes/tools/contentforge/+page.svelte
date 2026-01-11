<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import ContentQueue from '$lib/components/contentforge/ContentQueue.svelte';
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
		type EnhancedLearnings
	} from '$lib/services/contentforge-bridge';
	import {
		addToQueue,
		queueItems,
		queueLength,
		isQueueProcessing,
		currentQueueItem,
		completedQueueItems,
		getQueueStats,
		resumeQueueProcessing,
		smartAnalyze,
		type QueueItem
	} from '$lib/services/contentforge-queue';
	import {
		type RalphConfig,
		type RalphState,
		type RalphIteration,
		DEFAULT_RALPH_CONFIG,
		queryMindForContext,
		generateRalphPrompt,
		startRalphLoop,
		getRalphState,
		updateRalphState,
		completeRalphLoop,
		cancelRalphLoop,
		recordSuccessToMind,
		recordBlockerToMind,
		checkCompletionCriteria
	} from '$lib/services/ralph-contentforge';
	import {
		extractTopicsFromContent,
		storeTopicPerformance,
		getTopicStats,
		getTopicInsights,
		getCurrentNiche,
		generateContentIdeas,
		type TopicPerformance,
		type TopicInsight
	} from '$lib/services/topic-learning';
	import {
		extractPatternsFromAnalysis,
		storePatternsInMind,
		getPatternStats,
		type PatternStats
	} from '$lib/services/viral-patterns';
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

	// Analysis history state
	interface AnalysisHistoryItem {
		id: string;
		content: string;
		viralityScore: number;
		hookType: string | null;
		emotion: string | null;
		timestamp: string;
	}
	let analysisHistory = $state<AnalysisHistoryItem[]>([]);
	let historyLoading = $state(false);
	let showHistory = $state(false);
	let selectedHistoryItem = $state<AnalysisHistoryItem | null>(null);

	// Viral pattern learning state
	let patternStats = $state<PatternStats | null>(null);
	let patternsLoading = $state(false);

	// Topic learning state (niche expertise)
	let topicInsights = $state<TopicInsight | null>(null);
	let topicStats = $state<TopicPerformance[]>([]);
	let contentIdeas = $state<string[]>([]);
	let topicsLoading = $state(false);
	let currentNiche = $state(getCurrentNiche());

	// Queue state
	let selectedQueueItem = $state<QueueItem | null>(null);
	let lastCompletedCount = $state(0); // Track completed items for history refresh
	let showQueue = $state(true);

	// Ralph Mode state (iterative self-improvement) - ON by default for quality
	let ralphMode = $state(true);

	// Track what content was analyzed (to show alongside results)
	let analyzedContent = $state<{ type: 'tweet' | 'text'; text: string; tweetData?: TweetData } | null>(null);
	let ralphConfig = $state<RalphConfig>({ ...DEFAULT_RALPH_CONFIG });
	let ralphState = $state<RalphState | null>(null);
	let ralphIterations = $state<RalphIteration[]>([]);
	let ralphMindContext = $state<string[]>([]);
	let showRalphConfig = $state(false);

	const workerPrompt = `You are the ContentForge analysis worker. Read workers/contentforge-worker.md for full instructions.

CRITICAL: When you find pending work, STOP POLLING until you finish. Complete the entire analysis before looking for new work.

1. Register: POST to http://localhost:5173/api/contentforge/bridge/status with {"version": "claude-code"}
2. Poll: GET http://localhost:5173/api/contentforge/bridge/pending every 30 seconds
3. When pending=true:
   - STOP POLLING - don't check for new work until done
   - PATCH status {"action":"start","requestId":"...","task":"Starting..."}
   - Do the FULL analysis (all 4 agents + synthesis)
   - PATCH progress after each step (e.g., {"action":"progress","step":"Marketing Agent complete"})
4. Send result to BOTH endpoints:
   - POST to /api/contentforge/bridge/result (for polling fallback)
   - POST to /api/events (for SSE broadcast)
5. PATCH status {"action":"complete"}
6. DELETE http://localhost:5173/api/contentforge/bridge/pending
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

	/**
	 * Extract and store viral patterns from analysis result
	 * This is the core learning mechanism - patterns get stored in Mind
	 * for use in future content generation
	 */
	async function learnFromAnalysis(analysisResult: any, contentAnalyzed: typeof analyzedContent) {
		if (!isMindConnected || !analysisResult?.synthesis?.viralityScore) {
			return;
		}

		const content = contentAnalyzed?.text || '';
		const source = contentAnalyzed?.type || 'text';
		const author = contentAnalyzed?.tweetData?.author?.username;
		const score = analysisResult.synthesis.viralityScore;

		console.log(`[Learning] Analysis complete (score: ${score})`);

		try {
			// 1. Extract and store PATTERNS (structure, hooks, emotions)
			const patterns = extractPatternsFromAnalysis(content, analysisResult, source, author);
			console.log(`[Patterns] Extracted: ${patterns.hooks.length} hooks, ${patterns.emotions.length} emotions, ${patterns.structures.length} structures`);
			await storePatternsInMind(content, score, patterns, source, author);
			await refreshPatternStats();

			// 2. Extract and store TOPICS (niche expertise)
			const topics = extractTopicsFromContent(content);
			if (topics.primary.length > 0) {
				console.log(`[Topics] Extracted: ${topics.primary.join(', ')} (${topics.angle})`);
				await storeTopicPerformance(topics, score, content, author);
				await refreshTopicInsights();
			}

		} catch (e) {
			console.warn('[Learning] Failed to learn from analysis:', e);
		}
	}

	/**
	 * Refresh topic insights from Mind
	 */
	async function refreshTopicInsights() {
		if (!isMindConnected) return;

		topicsLoading = true;
		try {
			const [insights, stats, ideas] = await Promise.all([
				getTopicInsights(),
				getTopicStats(),
				generateContentIdeas()
			]);
			topicInsights = insights;
			topicStats = stats;
			contentIdeas = ideas;
			console.log(`[Topics] Refreshed: ${stats.length} topics tracked`);
		} catch (e) {
			console.warn('[Topics] Failed to refresh:', e);
		} finally {
			topicsLoading = false;
		}
	}

	/**
	 * Refresh pattern statistics from Mind
	 */
	async function refreshPatternStats() {
		if (!isMindConnected) return;

		patternsLoading = true;
		try {
			const stats = await getPatternStats();
			patternStats = stats;
			console.log(`[ViralPatterns] Stats: ${stats.totalPatterns} patterns learned`);
		} catch (e) {
			console.warn('[ViralPatterns] Failed to get pattern stats:', e);
		} finally {
			patternsLoading = false;
		}
	}

	/**
	 * Load latest result from storage (persists across page refresh)
	 */
	async function loadLatestResult() {
		try {
			const response = await fetch('/api/contentforge/bridge/result');
			if (!response.ok) return;

			const data = await response.json();
			if (data.hasResult && data.data) {
				console.log('[ContentForge] Loaded persisted result:', data.data.postId);
				result = data.data;
			}
		} catch (e) {
			console.warn('[ContentForge] Failed to load persisted result:', e);
		}
	}

	/**
	 * Load analysis history from Mind
	 */
	async function loadAnalysisHistory() {
		if (!isMindConnected) return;

		historyLoading = true;
		try {
			const response = await fetch('http://localhost:8080/v1/memories/?limit=100');
			if (!response.ok) return;

			const allMemories = await response.json();
			const memories: Array<{ memory_id: string; content: string; created_at?: string }> = Array.isArray(allMemories)
				? allMemories
				: allMemories.memories || [];

			// Filter to ContentForge analyses and parse them
			const history: AnalysisHistoryItem[] = [];
			for (const m of memories) {
				// Match various ContentForge memory formats
				const isContentForge = m.content?.includes('ContentForge') ||
					m.content?.includes('Virality Score:') ||
					m.content?.includes('virality score');
				if (!isContentForge) continue;

				// Parse score from various formats
				const scoreMatch = m.content.match(/(?:Virality Score:|virality score)\s*(\d+)/i);
				const hookMatch = m.content.match(/Hook Type:\s*([^\n]+)/i);
				const emotionMatch = m.content.match(/Primary Emotion:\s*([^\n]+)/i);
				const contentMatch = m.content.match(/Content Analyzed:\*?\*?\s*\n([^]*?)(?=\n\*\*|$)/i);
				const approachMatch = m.content.match(/Winning Approach:\*?\*?\s*\n([^]*?)(?=\n\*\*|$)/i);

				if (scoreMatch) {
					history.push({
						id: m.memory_id,
						content: contentMatch ? contentMatch[1].trim().slice(0, 200) :
							(approachMatch ? approachMatch[1].trim().slice(0, 200) : 'Analysis complete'),
						viralityScore: parseInt(scoreMatch[1]),
						hookType: hookMatch ? hookMatch[1].trim() : null,
						emotion: emotionMatch ? emotionMatch[1].trim() : null,
						timestamp: m.created_at || new Date().toISOString()
					});
				}
			}

			// Sort by timestamp descending
			history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
			analysisHistory = history;
			console.log('[ContentForge] Loaded', history.length, 'analyses from history');
		} catch (e) {
			console.warn('[ContentForge] Failed to load history:', e);
		} finally {
			historyLoading = false;
		}
	}

	onMount(async () => {
		await initContentForgeBridge();
		// Check status immediately and then every 2 seconds (faster when tracking activity)
		await checkWorkerStatus();
		statusCheckInterval = setInterval(checkWorkerStatus, 2000);

		// Resume any pending queue items from previous session
		resumeQueueProcessing();

		// Load persisted result (survives page refresh)
		await loadLatestResult();

		// Load analysis history, pattern stats, and topic insights from Mind (after Mind connection is established)
		setTimeout(async () => {
			if (isMindConnected) {
				await loadAnalysisHistory();
				await refreshPatternStats();
				await refreshTopicInsights();
			}
		}, 1000);

		// Subscribe to stores as backup (in case Promise doesn't resolve)
		storeUnsubscribers.push(
			contentforgeResult.subscribe((value) => {
				if (value) {
					console.log('[ContentForge] Store received result:', value.postId);
					result = value;
					loading = false;
					// Refresh learnings after new analysis
					refreshLearnings();
					// Learn viral patterns from this analysis (the core learning loop!)
					learnFromAnalysis(value, analyzedContent);
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
				// Load history when Mind connects
				if (value && analysisHistory.length === 0) {
					loadAnalysisHistory();
				}
			}),
			enhancedLearnings.subscribe((value) => {
				learnings = value;
			}),
			// Watch for completed queue items and refresh history
			completedQueueItems.subscribe((completed) => {
				const newCount = completed.length;
				if (newCount > lastCompletedCount && lastCompletedCount > 0) {
					// New items completed - refresh history
					console.log('[ContentForge] Queue item completed, refreshing history...');
					loadAnalysisHistory();
					refreshPatternStats();
					refreshTopicInsights();
				}
				lastCompletedCount = newCount;
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
		result = null; // Clear old results when loading new tweet
		analyzedContent = null;

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
	 * Analyze content (text or tweet)
	 */
	async function analyze() {
		loading = true;
		error = null;
		result = null;
		analyzedContent = null; // Clear previous analyzed content

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

				// Track what we're analyzing
				analyzedContent = {
					type: 'tweet',
					text: tweetData.text,
					tweetData: tweetData
				};
			} else {
				contentToAnalyze = inputText;

				// Track what we're analyzing
				analyzedContent = {
					type: 'text',
					text: inputText.slice(0, 500)
				};
			}

			if (!contentToAnalyze.trim()) {
				throw new Error('No content to analyze');
			}

			// RALPH MODE: Iterative self-improvement
			if (ralphMode) {
				await analyzeWithRalph(contentToAnalyze);
			} else {
				// Standard single-pass analysis
				const bridgeResult = await requestContentForgeAnalysis(contentToAnalyze);
				result = bridgeResult;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Analysis failed. Make sure the worker is running.';
		} finally {
			loading = false;
		}
	}

	/**
	 * Run analysis with Ralph Mode (iterative self-improvement)
	 */
	async function analyzeWithRalph(content: string) {
		console.log('[Ralph] Starting iterative analysis...');

		// 1. Query Mind for context
		console.log('[Ralph] Querying Mind for relevant learnings...');
		ralphMindContext = await queryMindForContext('content analysis virality');
		console.log(`[Ralph] Loaded ${ralphMindContext.length} learnings from Mind`);

		// 2. Initialize Ralph state
		ralphState = startRalphLoop(ralphConfig, ralphMindContext);
		ralphIterations = [];

		// 3. Generate Ralph-enhanced prompt
		const ralphPrompt = generateRalphPrompt(
			content,
			ralphConfig,
			ralphMindContext,
			1, // First iteration
			undefined // No previous result yet
		);

		// 4. Send to worker with Ralph instructions
		// The worker will check for the completion promise and iterate
		try {
			// Store the Ralph prompt for the worker
			await fetch('/api/contentforge/bridge/write', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: ralphPrompt,
					ralph: true,
					iteration: 1,
					maxIterations: ralphConfig.maxIterations,
					qualityThreshold: ralphConfig.qualityThreshold
				})
			});

			// Request analysis (worker will pick up the Ralph prompt)
			const bridgeResult = await requestContentForgeAnalysis(ralphPrompt);

			// Check if Ralph criteria were met
			if (bridgeResult?.synthesis?.viralityScore) {
				const synthesis = bridgeResult.synthesis as any; // Dynamic worker response
				const score = synthesis.viralityScore;
				const recs = synthesis.recommendations || synthesis.keyInsights || [];
				const approachUsed = synthesis.approach || 'Standard analysis';

				const iteration: RalphIteration = {
					number: 1,
					score,
					agentsCompleted: Object.keys(bridgeResult.orchestrator?.agentResults || {}),
					recommendationCount: recs.length,
					weakness: score < ralphConfig.qualityThreshold ? 'Score below threshold' : undefined
				};
				ralphIterations = [iteration];
				ralphState = updateRalphState(iteration) || ralphState;

				if (score >= ralphConfig.qualityThreshold) {
					// SUCCESS! Record to Mind
					await recordSuccessToMind({
						success: true,
						iterations: 1,
						finalScore: score,
						approach: approachUsed,
						mindLearningsUsed: ralphMindContext.length,
						timeElapsed: Date.now() - new Date(ralphState.startedAt).getTime()
					});
					ralphState = completeRalphLoop(true, approachUsed) || ralphState;
					console.log('[Ralph] Success on first iteration!');
				} else {
					// Need more iterations - record blocker for now
					// In full implementation, would continue iterating
					console.log(`[Ralph] Score ${score} < ${ralphConfig.qualityThreshold}, would continue iterating`);
					await recordBlockerToMind(1, score, `Score ${score} below threshold ${ralphConfig.qualityThreshold}`);
				}
			}

			result = bridgeResult;
		} catch (e) {
			// Record failure to Mind
			await recordBlockerToMind(1, 0, e instanceof Error ? e.message : 'Unknown error');
			throw e;
		}
	}

	/**
	 * Add current content to queue (instead of direct analyze)
	 */
	/**
	 * Smart analyze - one button that does the right thing:
	 * - If queue is empty → Analyze immediately
	 * - If queue has items → Add to queue
	 */
	function handleSmartAnalyze() {
		let contentToAnalyze: string;

		if (inputMode === 'tweet') {
			if (!tweetData) {
				error = 'Load a tweet first';
				return;
			}
			contentToAnalyze = formatTweetContent(tweetData);
		} else {
			if (!inputText.trim()) {
				error = 'Enter content to analyze';
				return;
			}
			contentToAnalyze = inputText;
		}

		const { queued, item } = smartAnalyze(contentToAnalyze);

		if (queued) {
			console.log('[ContentForge] Added to queue (queue has items):', item?.id);
		} else {
			console.log('[ContentForge] Started analysis (queue was empty):', item?.id);
		}

		// Clear input after action
		if (inputMode === 'text') {
			inputText = '';
		} else {
			tweetUrl = '';
			tweetData = null;
		}
		error = null;

		// Auto-show queue when items are added
		if ($queueLength > 0) {
			showQueue = true;
		}
	}

	/**
	 * Handle queue item selection - show its result
	 */
	function handleQueueItemSelect(item: QueueItem) {
		selectedQueueItem = item;

		// If item has a result, display it
		if (item.result) {
			result = item.result;
			// Reconstruct analyzedContent from the item
			analyzedContent = {
				type: item.content.includes('REAL TWEET ANALYSIS') ? 'tweet' : 'text',
				text: item.label
			};
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
	<div class="max-w-7xl mx-auto">
		<header class="mb-8">
			<h1 class="text-3xl font-bold mb-2">ContentForge</h1>
			<p class="text-text-secondary">Viral Content Analysis Pipeline</p>
		</header>

		<!-- Main layout with optional queue sidebar -->
		<div class="flex gap-6">
			<!-- Main content area -->
			<div class="flex-1 min-w-0">

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

		<!-- Analysis History Section (always visible when there's history) -->
		{#if analysisHistory.length > 0 || historyLoading}
			<div class="mb-8 bg-bg-secondary p-6 border border-accent-primary/30">
				<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
					<span>Your Analysis History</span>
					<span class="text-sm font-normal text-accent-primary">{analysisHistory.length} posts analyzed</span>
				</h2>

				{#if historyLoading}
					<div class="text-center py-4 text-text-tertiary">
						<span class="animate-pulse">Loading history...</span>
					</div>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{#each analysisHistory.slice(0, 6) as item}
							<button
								onclick={() => selectedHistoryItem = selectedHistoryItem?.id === item.id ? null : item}
								class="text-left p-3 bg-bg-primary border border-surface-border hover:border-accent-primary transition-colors {selectedHistoryItem?.id === item.id ? 'border-accent-primary bg-accent-primary/5' : ''}"
							>
								<div class="flex items-center justify-between mb-2">
									<span class="text-xl font-bold {item.viralityScore >= 80 ? 'text-green-400' : item.viralityScore >= 60 ? 'text-yellow-400' : item.viralityScore >= 40 ? 'text-orange-400' : 'text-red-400'}">
										{item.viralityScore}
									</span>
									<span class="text-xs text-text-tertiary">
										{new Date(item.timestamp).toLocaleDateString()}
									</span>
								</div>
								<p class="text-xs text-text-secondary line-clamp-2">{item.content}</p>
								{#if item.hookType}
									<span class="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-400 mt-2 inline-block">{item.hookType}</span>
								{/if}
							</button>
						{/each}
					</div>
					{#if analysisHistory.length > 6}
						<button
							onclick={() => showHistory = !showHistory}
							class="mt-4 text-sm text-accent-primary hover:underline"
						>
							{showHistory ? 'Show less' : `View all ${analysisHistory.length} analyses`}
						</button>
						{#if showHistory}
							<div class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
								{#each analysisHistory.slice(6) as item}
									<button
										onclick={() => selectedHistoryItem = selectedHistoryItem?.id === item.id ? null : item}
										class="text-left p-3 bg-bg-primary border border-surface-border hover:border-accent-primary transition-colors"
									>
										<div class="flex items-center justify-between mb-2">
											<span class="text-xl font-bold {item.viralityScore >= 80 ? 'text-green-400' : item.viralityScore >= 60 ? 'text-yellow-400' : 'text-orange-400'}">
												{item.viralityScore}
											</span>
											<span class="text-xs text-text-tertiary">{new Date(item.timestamp).toLocaleDateString()}</span>
										</div>
										<p class="text-xs text-text-secondary line-clamp-2">{item.content}</p>
									</button>
								{/each}
							</div>
						{/if}
					{/if}
				{/if}
			</div>
		{/if}

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

			<!-- Action Buttons -->
			<div class="mt-4 flex items-center gap-4 flex-wrap">
				<!-- Smart Analyze Button (analyzes directly if queue empty, adds to queue otherwise) -->
				<button
					onclick={handleSmartAnalyze}
					disabled={loading || (inputMode === 'text' && !inputText.trim()) || (inputMode === 'tweet' && !tweetData)}
					class="px-6 py-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed bg-accent-primary hover:bg-accent-secondary text-white flex items-center gap-2"
				>
					{#if loading}
						Analyzing...
					{:else if $queueLength > 0}
						<span>+</span>
						Add to Queue
						<span class="bg-white/20 px-2 py-0.5 text-xs">{$queueLength}</span>
					{:else}
						Analyze
					{/if}
				</button>

				<!-- Queue toggle -->
				<button
					onclick={() => showQueue = !showQueue}
					class="px-3 py-2 text-sm border border-surface-border text-text-secondary hover:text-text-primary"
				>
					{showQueue ? 'Hide Queue' : 'Show Queue'}
				</button>

				<!-- Ralph toggle -->
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={ralphMode}
						class="w-4 h-4 accent-orange-500"
					/>
					<span class="text-sm {ralphMode ? 'text-orange-400' : 'text-text-tertiary'}">
						Ralph Mode
						{#if ralphMode}
							<span class="text-xs">(≥{ralphConfig.qualityThreshold})</span>
						{/if}
					</span>
				</label>
			</div>

			<!-- Queue Processing Status -->
			{#if $isQueueProcessing && $currentQueueItem}
				<div class="mt-3 p-3 bg-accent-primary/10 border border-accent-primary/30 flex items-center gap-3">
					<div class="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
					<div class="flex-1">
						<span class="text-sm text-accent-primary">Processing:</span>
						<span class="text-sm ml-2">{$currentQueueItem.label}</span>
					</div>
					<span class="text-xs text-text-tertiary">
						{$queueLength} remaining
					</span>
				</div>
			{/if}

			{#if ralphMode && ralphState}
				<div class="mt-2 text-xs text-orange-400">
					Iteration {ralphState.iteration}/{ralphState.maxIterations} | Best: {ralphState.bestScore}
					<button onclick={() => { cancelRalphLoop(); ralphState = null; }} class="ml-2 text-red-400 hover:underline">Cancel</button>
				</div>
			{/if}
		</div>

		{#if error}
			<div class="bg-red-900/20 border border-red-500 p-4 mb-8">
				<p class="text-red-400">{error}</p>
			</div>
		{/if}

		<!-- Analysis in Progress (prominent loading state) -->
		{#if loading && !result}
			<div class="mb-8 bg-accent-primary/10 border-2 border-accent-primary p-8 text-center">
				<div class="flex items-center justify-center gap-4 mb-4">
					<div class="w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
					<h2 class="text-2xl font-bold text-accent-primary">Analysis in Progress</h2>
				</div>
				<p class="text-text-secondary mb-4">
					{#if ralphMode}
						Ralph Mode: Iterating until quality score ≥ {ralphConfig.qualityThreshold}
					{:else}
						Running 4-agent viral analysis pipeline...
					{/if}
				</p>
				{#if workerCurrentTask}
					<div class="text-sm text-accent-primary font-mono">{workerCurrentTask}</div>
				{/if}
				{#if workerProgress.length > 0}
					<div class="mt-4 flex flex-wrap justify-center gap-2">
						{#each workerProgress as step}
							<span class="px-2 py-1 bg-green-500/20 text-green-400 text-xs border border-green-500/30">✓ {step}</span>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		{#if result}
			<!-- Results Header - Shows what was analyzed -->
			<div class="mb-6 p-4 bg-bg-secondary border-l-4 border-accent-primary">
				<div class="flex items-center gap-2 mb-2">
					<span class="text-xs font-mono text-accent-primary uppercase tracking-wider">Analysis Results For:</span>
					{#if analyzedContent?.type === 'tweet'}
						<span class="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400">Tweet</span>
					{:else}
						<span class="text-xs px-2 py-0.5 bg-accent-primary/20 text-accent-primary">Text</span>
					{/if}
				</div>
				{#if analyzedContent?.tweetData}
					<div class="flex items-center gap-2 text-sm text-text-secondary">
						<span class="font-semibold">@{analyzedContent.tweetData.author.username}</span>
						<span class="text-text-tertiary">·</span>
						<span class="text-text-tertiary">{new Date(analyzedContent.tweetData.createdAt).toLocaleDateString()}</span>
					</div>
					<p class="text-sm mt-1 line-clamp-2">{analyzedContent.text}</p>
				{:else if analyzedContent?.text}
					<p class="text-sm text-text-secondary line-clamp-2">"{analyzedContent.text}"</p>
				{/if}
			</div>

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

			<!-- Key Insights / Recommendations -->
			{@const insights = result.synthesis?.keyInsights || result.synthesis?.recommendations || []}
			{#if insights.length > 0}
				<div class="mb-8 bg-bg-secondary p-6 border border-surface-border">
					<h2 class="text-xl font-semibold mb-4">Key Insights</h2>
					<ul class="space-y-2">
						{#each insights as insight}
							<li class="flex items-start gap-2">
								<span class="text-accent-primary">→</span>
								<span>{insight}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Agent Analysis (shows which H70 skills ran) -->
			{#if result.agents}
				<div class="mb-8 bg-bg-secondary p-6 border border-cyan-500/30">
					<h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
						<span class="text-cyan-400">H70 Agent Analysis</span>
						<span class="text-xs text-text-tertiary font-normal">
							{Object.values(result.agents).filter((a: any) => a.complete).length}/4 agents complete
						</span>
					</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#each Object.entries(result.agents) as [agentId, agent]}
							{@const agentData = agent as { complete: boolean; insights: string[] }}
							<div class="p-4 bg-bg-primary border border-surface-border {agentData.complete ? 'border-l-2 border-l-green-500' : 'border-l-2 border-l-gray-500'}">
								<div class="flex items-center gap-2 mb-2">
									<span class="font-semibold capitalize">{agentId.replace(/([A-Z])/g, ' $1').trim()}</span>
									{#if agentData.complete}
										<span class="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400">Complete</span>
									{:else}
										<span class="text-xs px-1.5 py-0.5 bg-gray-500/20 text-gray-400">Pending</span>
									{/if}
								</div>
								{#if agentData.insights?.length > 0}
									<ul class="text-sm text-text-secondary space-y-1">
										{#each agentData.insights.slice(0, 2) as insight}
											<li class="flex items-start gap-1">
												<span class="text-cyan-400 text-xs mt-1">•</span>
												<span class="line-clamp-2">{insight}</span>
											</li>
										{/each}
										{#if agentData.insights.length > 2}
											<li class="text-text-tertiary text-xs">+{agentData.insights.length - 2} more insights</li>
										{/if}
									</ul>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Actionable Steps (simplified playbook) -->
			{#if result.synthesis?.playbook?.steps?.length > 0}
				<div class="mb-8 bg-bg-secondary p-6 border border-surface-border">
					<h2 class="text-xl font-semibold mb-4">{result.synthesis.playbook.title || 'Action Steps'}</h2>
					{#if result.synthesis.playbook.summary}
						<p class="text-text-secondary mb-4">{result.synthesis.playbook.summary}</p>
					{/if}
					<ol class="space-y-3">
						{#each result.synthesis.playbook.steps as step}
							<li class="flex gap-3 p-3 bg-bg-primary border border-surface-border">
								<span class="text-accent-primary font-bold">{step.order}.</span>
								<div>
									<p class="font-medium">{step.action}</p>
									{#if step.rationale}
										<p class="text-text-tertiary text-sm mt-1">{step.rationale}</p>
									{/if}
								</div>
							</li>
						{/each}
					</ol>
				</div>
			{/if}

			<!-- Auto-saved to Mind indicator -->
			{#if isMindConnected && result}
				{@const insightCount = (result.synthesis?.keyInsights || result.synthesis?.recommendations || []).length}
				{@const agentCount = result.agents ? Object.values(result.agents).filter((a: any) => a.complete).length : 0}
				<div class="mb-8 p-4 bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
					<div class="flex items-center gap-2">
						<svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<span class="text-purple-400 text-sm">Analysis auto-saved to Mind</span>
					</div>
					<span class="text-xs text-purple-300">Score: {result.synthesis?.viralityScore || 0} | {agentCount} agents | {insightCount} insights</span>
				</div>
			{/if}

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

		<!-- Simple Mind Stats (minimal, non-confusing) -->
		{#if isMindConnected && (learnings?.totalAnalyzed || style?.totalAnalyzed)}
			<div class="mt-8 p-4 bg-purple-900/10 border border-purple-500/20">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<span class="text-purple-400 text-sm font-medium">Mind Stats</span>
						<span class="text-text-secondary text-sm">{learnings?.totalAnalyzed || style?.totalAnalyzed || 0} posts analyzed</span>
						{#if style?.averageViralityScore}
							<span class="text-text-secondary text-sm">Avg score: {style.averageViralityScore}</span>
						{/if}
					</div>
					<a href="/mind" class="text-purple-400 hover:text-purple-300 text-sm">View all learnings →</a>
				</div>
			</div>
		{/if}

		<!-- Learned Patterns Section (Viral Content Engine) -->
		{#if isMindConnected && patternStats && patternStats.totalPatterns > 0}
			<div class="mt-8 bg-bg-secondary border border-orange-500/30 p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-semibold flex items-center gap-2">
						<span class="text-orange-400">Viral Pattern Engine</span>
						<span class="text-xs font-normal text-text-tertiary">Learning what works</span>
					</h2>
					<span class="text-sm text-orange-300">{patternStats.totalPatterns} patterns learned</span>
				</div>

				<!-- Pattern Categories -->
				{#if Object.keys(patternStats.byCategory).length > 0}
					<div class="mb-4 flex flex-wrap gap-2">
						{#each Object.entries(patternStats.byCategory) as [category, count]}
							<span class="px-2 py-1 text-xs bg-orange-500/10 border border-orange-500/30 text-orange-300">
								{category}: {count}
							</span>
						{/each}
					</div>
				{/if}

				<!-- Top Performers -->
				{#if patternStats.topPerformers.length > 0}
					<div>
						<h3 class="text-sm font-medium text-text-secondary mb-2">Top Performing Patterns:</h3>
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
							{#each patternStats.topPerformers.slice(0, 6) as pattern}
								<div class="p-3 bg-bg-primary border border-surface-border">
									<div class="flex items-center justify-between mb-1">
										<span class="font-medium text-sm capitalize">{pattern.pattern.replace(/_/g, ' ')}</span>
										<span class="text-xs text-green-400">Avg: {pattern.avgScore}</span>
									</div>
									<div class="text-xs text-text-tertiary">{pattern.category}</div>
									<div class="flex items-center gap-2 mt-1">
										<span class="text-xs text-text-secondary">n={pattern.sampleSize}</span>
										<span class="text-xs px-1 py-0.5 {pattern.confidence === 'very_high' ? 'bg-green-500/20 text-green-400' : pattern.confidence === 'high' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}">
											{pattern.confidence}
										</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<p class="mt-4 text-xs text-text-tertiary">
					Patterns are automatically extracted from each analysis and ranked by performance.
					As you analyze more content, the engine learns what makes content go viral.
				</p>
			</div>
		{:else if isMindConnected && !patternsLoading}
			<div class="mt-8 p-4 bg-orange-900/10 border border-orange-500/20">
				<div class="flex items-center gap-2">
					<span class="text-orange-400 text-sm">Viral Pattern Engine: No patterns learned yet</span>
					<span class="text-xs text-text-tertiary">Analyze content to start learning what works</span>
				</div>
			</div>
		{/if}

		<!-- Topic Learning Section (Niche Expertise) -->
		{#if isMindConnected && topicInsights && (topicInsights.hotTopics.length > 0 || topicInsights.risingTopics.length > 0 || topicInsights.gapTopics.length > 0)}
			<div class="mt-8 bg-bg-secondary border border-emerald-500/30 p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-semibold flex items-center gap-2">
						<span class="text-emerald-400">Topic Intelligence</span>
						<span class="text-xs font-normal text-text-tertiary">Learning your niche: {currentNiche.name}</span>
					</h2>
					<span class="text-sm text-emerald-300">{topicStats.length} topics tracked</span>
				</div>

				<!-- Hot Topics -->
				{#if topicInsights.hotTopics.length > 0}
					<div class="mb-6">
						<h3 class="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
							<span class="text-lg">🔥</span>
							Hot Topics (your audience loves these)
						</h3>
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
							{#each topicInsights.hotTopics as topic}
								<div class="p-3 bg-bg-primary border border-emerald-500/20 border-l-2 border-l-emerald-500">
									<div class="flex items-center justify-between mb-1">
										<span class="font-medium text-sm capitalize">{topic.topic}</span>
										<span class="text-xs text-emerald-400">Avg: {topic.avgViralityScore}</span>
									</div>
									<div class="flex items-center gap-2 text-xs text-text-tertiary">
										<span>n={topic.sampleSize}</span>
										<span class="px-1 py-0.5 {topic.confidence === 'very_high' ? 'bg-emerald-500/20 text-emerald-400' : topic.confidence === 'high' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}">
											{topic.confidence}
										</span>
										{#if topic.trend === 'rising'}
											<span class="text-green-400">↑ rising</span>
										{:else if topic.trend === 'declining'}
											<span class="text-red-400">↓ declining</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Rising Topics -->
				{#if topicInsights.risingTopics.length > 0}
					<div class="mb-6">
						<h3 class="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
							<span class="text-lg">📈</span>
							Rising Topics (trending in your niche)
						</h3>
						<div class="flex flex-wrap gap-2">
							{#each topicInsights.risingTopics as topic}
								<span class="px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-300 text-sm">
									{topic.topic}
									<span class="ml-1 text-xs opacity-70">({topic.avgViralityScore} avg)</span>
								</span>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Gap Topics (unexplored) -->
				{#if topicInsights.gapTopics.length > 0}
					<div class="mb-6">
						<h3 class="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
							<span class="text-lg">🎯</span>
							Unexplored Topics (opportunities)
						</h3>
						<div class="flex flex-wrap gap-2">
							{#each topicInsights.gapTopics.slice(0, 8) as topic}
								<span class="px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm">
									{topic}
								</span>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Hot Subtopics (specific aspects that perform well) -->
				{#if topicInsights.hotSubtopics && topicInsights.hotSubtopics.length > 0}
					<div class="mb-6">
						<h3 class="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
							<span class="text-lg">🎯</span>
							Hot Subtopics (specific angles that work)
						</h3>
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
							{#each topicInsights.hotSubtopics.slice(0, 6) as sub}
								<div class="p-3 bg-bg-primary border border-orange-500/20 border-l-2 border-l-orange-500">
									<div class="flex items-center justify-between mb-1">
										<span class="font-medium text-sm">{sub.subtopic}</span>
										<span class="text-xs text-orange-400">Avg: {sub.avgViralityScore}</span>
									</div>
									<div class="flex items-center gap-2 text-xs text-text-tertiary">
										<span class="text-text-tertiary opacity-70">in {sub.mainTopic}</span>
										<span class="text-text-tertiary">n={sub.sampleSize}</span>
										{#if sub.trend === 'rising'}
											<span class="text-green-400">↑</span>
										{:else if sub.trend === 'new'}
											<span class="text-blue-400">NEW</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Subtopics by Main Topic (deep dive into each topic) -->
				{#if topicInsights.subtopicsByTopic && Object.keys(topicInsights.subtopicsByTopic).length > 0}
					<div class="mb-6">
						<h3 class="text-sm font-medium text-text-secondary mb-2 flex items-center gap-2">
							<span class="text-lg">🔍</span>
							Deep Dive: What Works Within Each Topic
						</h3>
						<div class="space-y-3">
							{#each Object.entries(topicInsights.subtopicsByTopic).slice(0, 4) as [mainTopic, subtopics]}
								<div class="p-3 bg-bg-primary border border-surface-border">
									<div class="flex items-center justify-between mb-2">
										<span class="font-medium text-sm capitalize text-accent-primary">{mainTopic}</span>
										<span class="text-xs text-text-tertiary">{subtopics.length} aspects tracked</span>
									</div>
									<div class="flex flex-wrap gap-1">
										{#each subtopics.slice(0, 6) as sub}
											<span class="px-2 py-1 text-xs {sub.avgViralityScore >= 70 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : sub.avgViralityScore >= 50 ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'} border">
												{sub.subtopic}
												<span class="opacity-70 ml-1">{sub.avgViralityScore}</span>
											</span>
										{/each}
										{#if subtopics.length > 6}
											<span class="px-2 py-1 text-xs text-text-tertiary">+{subtopics.length - 6} more</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Content Ideas -->
				{#if contentIdeas.length > 0}
					<div class="border-t border-surface-border pt-4">
						<h3 class="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
							<span class="text-lg">💡</span>
							Content Ideas (based on your learnings)
						</h3>
						<div class="space-y-2">
							{#each contentIdeas.slice(0, 4) as idea}
								<div class="flex items-start gap-2 p-2 bg-bg-primary border border-surface-border hover:border-emerald-500/30 transition-colors">
									<span class="text-emerald-400">→</span>
									<span class="text-sm">{idea}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Recommendations -->
				{#if topicInsights.recommendations.length > 0}
					<div class="mt-4 p-3 bg-emerald-500/5 border border-emerald-500/20">
						<h4 class="text-xs font-semibold text-emerald-400 mb-2">AI Recommendations:</h4>
						<ul class="space-y-1 text-xs text-text-secondary">
							{#each topicInsights.recommendations as rec}
								<li class="flex items-start gap-1">
									<span class="text-emerald-400">•</span>
									{rec}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{:else if isMindConnected && !topicsLoading && topicStats.length === 0}
			<div class="mt-8 p-4 bg-emerald-900/10 border border-emerald-500/20">
				<div class="flex items-center gap-2">
					<span class="text-emerald-400 text-sm">Topic Intelligence: Learning your niche</span>
					<span class="text-xs text-text-tertiary">Analyze content to discover what topics resonate with your audience</span>
				</div>
				<p class="text-xs text-text-tertiary mt-2">
					Current focus: {currentNiche.name} ({currentNiche.primaryTopics.slice(0, 4).join(', ')})
				</p>
			</div>
		{/if}

			</div>
			<!-- End main content area -->

			<!-- Queue Sidebar -->
			{#if showQueue}
				<div class="w-80 flex-shrink-0">
					<div class="sticky top-8">
						<ContentQueue
							onSelectItem={handleQueueItemSelect}
							selectedItemId={selectedQueueItem?.id || null}
						/>

						<!-- Queue Stats -->
						{#if $queueItems.length > 0}
							{@const stats = getQueueStats()}
							<div class="mt-4 p-4 bg-bg-secondary border border-surface-border">
								<h3 class="text-sm font-semibold mb-3">Queue Stats</h3>
								<div class="grid grid-cols-2 gap-2 text-sm">
									<div>
										<span class="text-text-tertiary">Total:</span>
										<span class="ml-1 font-mono">{stats.total}</span>
									</div>
									<div>
										<span class="text-text-tertiary">Completed:</span>
										<span class="ml-1 font-mono text-green-400">{stats.completed}</span>
									</div>
									<div>
										<span class="text-text-tertiary">Pending:</span>
										<span class="ml-1 font-mono text-yellow-400">{stats.queued}</span>
									</div>
									{#if stats.avgScore > 0}
										<div>
											<span class="text-text-tertiary">Avg Score:</span>
											<span class="ml-1 font-mono text-accent-primary">{stats.avgScore.toFixed(0)}</span>
										</div>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
		<!-- End flex container -->
	</div>
</div>
