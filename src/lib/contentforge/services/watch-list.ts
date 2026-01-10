/**
 * Watch List Service
 *
 * Monitors accounts and auto-detects viral posts.
 */

import type { DbWatchList } from './database';

export interface WatchTarget {
	username: string;
	engagementThreshold: number;
	checkIntervalMs: number;
	lastCheckedAt: Date | null;
}

export interface ViralPostDetection {
	postId: string;
	username: string;
	url: string;
	metrics: {
		likes: number;
		retweets: number;
		views: number;
	};
	detectedAt: string;
	thresholdExceeded: 'likes' | 'retweets' | 'views' | 'engagement_rate';
}

export interface WatchListConfig {
	defaultCheckInterval: number; // ms
	maxConcurrentChecks: number;
	rateLimitPerMinute: number;
}

const DEFAULT_CONFIG: WatchListConfig = {
	defaultCheckInterval: 15 * 60 * 1000, // 15 minutes
	maxConcurrentChecks: 5,
	rateLimitPerMinute: 30
};

/**
 * Create a watch list manager.
 * Request-scoped to avoid SSR state issues.
 */
export function createWatchListManager(config: Partial<WatchListConfig> = {}) {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };
	const activeWatches = new Map<string, NodeJS.Timeout>();
	let isRunning = false;

	return {
		/**
		 * Start watching all active accounts.
		 */
		async startWatching(
			watchLists: DbWatchList[],
			onViralDetected: (detection: ViralPostDetection) => void
		): Promise<void> {
			if (isRunning) return;
			isRunning = true;

			for (const watchList of watchLists.filter(w => w.is_active)) {
				this.watchAccount(
					{
						username: watchList.username,
						engagementThreshold: watchList.engagement_threshold,
						checkIntervalMs: finalConfig.defaultCheckInterval,
						lastCheckedAt: watchList.last_checked_at ? new Date(watchList.last_checked_at) : null
					},
					onViralDetected
				);
			}
		},

		/**
		 * Watch a single account.
		 */
		watchAccount(
			target: WatchTarget,
			onViralDetected: (detection: ViralPostDetection) => void
		): void {
			if (activeWatches.has(target.username)) return;

			const check = async () => {
				try {
					const posts = await this.fetchRecentPosts(target.username);
					const viralPosts = posts.filter(p =>
						p.metrics.likes >= target.engagementThreshold ||
						p.metrics.retweets >= target.engagementThreshold * 0.3 ||
						p.metrics.views >= target.engagementThreshold * 50
					);

					for (const post of viralPosts) {
						const thresholdType = this.determineThresholdType(post, target.engagementThreshold);
						onViralDetected({
							postId: post.id,
							username: target.username,
							url: `https://x.com/${target.username}/status/${post.id}`,
							metrics: post.metrics,
							detectedAt: new Date().toISOString(),
							thresholdExceeded: thresholdType
						});
					}
				} catch (error) {
					console.error(`[WatchList] Error checking ${target.username}:`, error);
				}
			};

			// Initial check
			check();

			// Schedule recurring checks
			const intervalId = setInterval(check, target.checkIntervalMs);
			activeWatches.set(target.username, intervalId);
		},

		/**
		 * Stop watching an account.
		 */
		stopWatching(username: string): void {
			const intervalId = activeWatches.get(username);
			if (intervalId) {
				clearInterval(intervalId);
				activeWatches.delete(username);
			}
		},

		/**
		 * Stop all watches.
		 */
		stopAll(): void {
			isRunning = false;
			for (const [username, intervalId] of activeWatches) {
				clearInterval(intervalId);
			}
			activeWatches.clear();
		},

		/**
		 * Fetch recent posts from an account.
		 * In production, this would call the Twitter API.
		 */
		async fetchRecentPosts(username: string): Promise<Array<{
			id: string;
			metrics: { likes: number; retweets: number; views: number };
		}>> {
			// Placeholder - would integrate with Twitter API
			// For now, return empty to avoid API calls
			console.log(`[WatchList] Would fetch posts for @${username}`);
			return [];
		},

		/**
		 * Determine which threshold was exceeded.
		 */
		determineThresholdType(
			post: { metrics: { likes: number; retweets: number; views: number } },
			threshold: number
		): ViralPostDetection['thresholdExceeded'] {
			const { likes, retweets, views } = post.metrics;

			if (likes >= threshold) return 'likes';
			if (retweets >= threshold * 0.3) return 'retweets';
			if (views >= threshold * 50) return 'views';

			const engagementRate = (likes + retweets) / Math.max(views, 1) * 100;
			return 'engagement_rate';
		},

		/**
		 * Get list of currently watched accounts.
		 */
		getActiveWatches(): string[] {
			return Array.from(activeWatches.keys());
		},

		/**
		 * Check if a specific account is being watched.
		 */
		isWatching(username: string): boolean {
			return activeWatches.has(username);
		}
	};
}

export type WatchListManager = ReturnType<typeof createWatchListManager>;
