/**
 * X (Twitter) API Service
 *
 * Fetches tweet data including content, engagement metrics, and media.
 * Uses X API v2 with Bearer Token authentication.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TweetMetrics {
	likes: number;
	retweets: number;
	replies: number;
	quotes: number;
	bookmarks: number;
	impressions: number;
}

export interface TweetAuthor {
	id: string;
	username: string;
	name: string;
	profileImageUrl: string;
	followers: number;
	following: number;
	verified: boolean;
}

export interface TweetMedia {
	type: 'photo' | 'video' | 'animated_gif';
	url: string;
	previewUrl?: string;
	width?: number;
	height?: number;
	durationMs?: number; // for videos
	altText?: string;
}

export interface TweetData {
	id: string;
	text: string;
	createdAt: string;
	url: string;
	metrics: TweetMetrics;
	author: TweetAuthor;
	media: TweetMedia[];
	isRetweet: boolean;
	isReply: boolean;
	isQuote: boolean;
	quotedTweet?: TweetData;
	conversationId?: string;
	language: string;
}

export interface FetchTweetResult {
	success: boolean;
	tweet?: TweetData;
	error?: string;
}

// =============================================================================
// URL PARSING
// =============================================================================

/**
 * Extract tweet ID from various X/Twitter URL formats
 */
export function extractTweetId(input: string): string | null {
	// Clean the input
	const url = input.trim();

	// Direct ID (just numbers)
	if (/^\d+$/.test(url)) {
		return url;
	}

	// URL patterns:
	// https://twitter.com/username/status/1234567890
	// https://x.com/username/status/1234567890
	// https://twitter.com/username/status/1234567890?s=20
	// https://x.com/i/web/status/1234567890
	const patterns = [
		/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/i,
		/(?:twitter\.com|x\.com)\/i\/web\/status\/(\d+)/i,
		/status\/(\d+)/i
	];

	for (const pattern of patterns) {
		const match = url.match(pattern);
		if (match && match[1]) {
			return match[1];
		}
	}

	return null;
}

// =============================================================================
// API FUNCTIONS (Server-side only)
// =============================================================================

/**
 * Fetch tweet data from X API
 * This should be called from a server endpoint, not client-side
 */
export async function fetchTweetFromAPI(
	tweetId: string,
	bearerToken: string
): Promise<FetchTweetResult> {
	const baseUrl = 'https://api.twitter.com/2/tweets';

	// Request tweet with all expansions and fields
	// NOTE: non_public_metrics and organic_metrics require user context (OAuth 1.0a)
	// and only work for the authenticated user's own tweets. We only request public fields.
	const params = new URLSearchParams({
		ids: tweetId,
		'tweet.fields': [
			'created_at',
			'public_metrics',
			'entities',
			'attachments',
			'conversation_id',
			'referenced_tweets',
			'lang',
			'source'
		].join(','),
		'user.fields': [
			'id',
			'name',
			'username',
			'profile_image_url',
			'public_metrics',
			'verified',
			'verified_type'
		].join(','),
		'media.fields': [
			'type',
			'url',
			'preview_image_url',
			'width',
			'height',
			'duration_ms',
			'alt_text'
		].join(','),
		expansions: ['author_id', 'attachments.media_keys', 'referenced_tweets.id'].join(',')
	});

	try {
		const response = await fetch(`${baseUrl}?${params.toString()}`, {
			headers: {
				Authorization: `Bearer ${bearerToken}`,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error('[X API] Error response:', response.status, errorData);

			if (response.status === 401) {
				return { success: false, error: 'Invalid or expired Bearer Token' };
			}
			if (response.status === 403) {
				return { success: false, error: 'Access forbidden - check API tier permissions' };
			}
			if (response.status === 404) {
				return { success: false, error: 'Tweet not found or deleted' };
			}
			if (response.status === 429) {
				return { success: false, error: 'Rate limit exceeded - try again later' };
			}

			return {
				success: false,
				error: `API error: ${response.status} ${response.statusText}`
			};
		}

		const data = await response.json();

		if (!data.data || data.data.length === 0) {
			// Check for specific errors in the response
			if (data.errors && data.errors.length > 0) {
				const err = data.errors[0];
				return { success: false, error: `${err.title}: ${err.detail || err.message || 'Unknown error'}` };
			}
			return { success: false, error: 'Tweet not found or deleted' };
		}

		const tweet = data.data[0];
		const includes = data.includes || {};

		// Parse author
		const authorData = includes.users?.find((u: { id: string }) => u.id === tweet.author_id);
		const author: TweetAuthor = {
			id: authorData?.id || tweet.author_id,
			username: authorData?.username || 'unknown',
			name: authorData?.name || 'Unknown',
			profileImageUrl: authorData?.profile_image_url || '',
			followers: authorData?.public_metrics?.followers_count || 0,
			following: authorData?.public_metrics?.following_count || 0,
			verified: authorData?.verified || false
		};

		// Parse metrics
		const pm = tweet.public_metrics || {};
		const metrics: TweetMetrics = {
			likes: pm.like_count || 0,
			retweets: pm.retweet_count || 0,
			replies: pm.reply_count || 0,
			quotes: pm.quote_count || 0,
			bookmarks: pm.bookmark_count || 0,
			impressions: pm.impression_count || 0
		};

		// Parse media
		const media: TweetMedia[] = [];
		if (tweet.attachments?.media_keys && includes.media) {
			for (const mediaKey of tweet.attachments.media_keys) {
				const mediaItem = includes.media.find((m: { media_key: string }) => m.media_key === mediaKey);
				if (mediaItem) {
					media.push({
						type: mediaItem.type,
						url: mediaItem.url || mediaItem.preview_image_url || '',
						previewUrl: mediaItem.preview_image_url,
						width: mediaItem.width,
						height: mediaItem.height,
						durationMs: mediaItem.duration_ms,
						altText: mediaItem.alt_text
					});
				}
			}
		}

		// Check tweet type
		const referencedTweets = tweet.referenced_tweets || [];
		const isRetweet = referencedTweets.some((r: { type: string }) => r.type === 'retweeted');
		const isReply = referencedTweets.some((r: { type: string }) => r.type === 'replied_to');
		const isQuote = referencedTweets.some((r: { type: string }) => r.type === 'quoted');

		const tweetData: TweetData = {
			id: tweet.id,
			text: tweet.text,
			createdAt: tweet.created_at,
			url: `https://x.com/${author.username}/status/${tweet.id}`,
			metrics,
			author,
			media,
			isRetweet,
			isReply,
			isQuote,
			conversationId: tweet.conversation_id,
			language: tweet.lang || 'en'
		};

		return { success: true, tweet: tweetData };
	} catch (error) {
		console.error('[X API] Fetch error:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Failed to fetch tweet'
		};
	}
}

// =============================================================================
// FORMATTING FOR ANALYSIS
// =============================================================================

/**
 * Format tweet data for ContentForge analysis
 */
export function formatTweetForAnalysis(tweet: TweetData): string {
	const lines: string[] = [];

	lines.push('# Tweet Analysis Request');
	lines.push('');

	// Author info
	lines.push('## Author');
	lines.push(`- **Name:** ${tweet.author.name} (@${tweet.author.username})`);
	lines.push(`- **Followers:** ${tweet.author.followers.toLocaleString()}`);
	lines.push(`- **Verified:** ${tweet.author.verified ? 'Yes' : 'No'}`);
	lines.push('');

	// Tweet content
	lines.push('## Content');
	lines.push('```');
	lines.push(tweet.text);
	lines.push('```');
	lines.push('');

	// Timing
	lines.push('## Timing');
	const postedAt = new Date(tweet.createdAt);
	lines.push(`- **Posted:** ${postedAt.toLocaleString()}`);
	lines.push(`- **Day:** ${postedAt.toLocaleDateString('en-US', { weekday: 'long' })}`);
	lines.push(`- **Time:** ${postedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`);
	lines.push('');

	// Engagement metrics
	lines.push('## Engagement Metrics');
	lines.push(`- **Impressions:** ${tweet.metrics.impressions.toLocaleString()}`);
	lines.push(`- **Likes:** ${tweet.metrics.likes.toLocaleString()}`);
	lines.push(`- **Retweets:** ${tweet.metrics.retweets.toLocaleString()}`);
	lines.push(`- **Replies:** ${tweet.metrics.replies.toLocaleString()}`);
	lines.push(`- **Quotes:** ${tweet.metrics.quotes.toLocaleString()}`);
	lines.push(`- **Bookmarks:** ${tweet.metrics.bookmarks.toLocaleString()}`);
	lines.push('');

	// Engagement rates
	if (tweet.metrics.impressions > 0) {
		const engagementRate = ((tweet.metrics.likes + tweet.metrics.retweets + tweet.metrics.replies) / tweet.metrics.impressions * 100).toFixed(2);
		const likeRate = (tweet.metrics.likes / tweet.metrics.impressions * 100).toFixed(2);
		const retweetRate = (tweet.metrics.retweets / tweet.metrics.impressions * 100).toFixed(2);

		lines.push('## Engagement Rates');
		lines.push(`- **Total Engagement Rate:** ${engagementRate}%`);
		lines.push(`- **Like Rate:** ${likeRate}%`);
		lines.push(`- **Retweet Rate:** ${retweetRate}%`);
		lines.push('');
	}

	// Media
	if (tweet.media.length > 0) {
		lines.push('## Media');
		tweet.media.forEach((m, i) => {
			lines.push(`- **Media ${i + 1}:** ${m.type}${m.width ? ` (${m.width}x${m.height})` : ''}`);
			if (m.altText) {
				lines.push(`  - Alt text: "${m.altText}"`);
			}
		});
		lines.push('');
	}

	// Tweet type
	lines.push('## Tweet Type');
	if (tweet.isRetweet) lines.push('- Retweet');
	else if (tweet.isQuote) lines.push('- Quote Tweet');
	else if (tweet.isReply) lines.push('- Reply');
	else lines.push('- Original Tweet');
	lines.push('');

	lines.push(`**URL:** ${tweet.url}`);

	return lines.join('\n');
}
