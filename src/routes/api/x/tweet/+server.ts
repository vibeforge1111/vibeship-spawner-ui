/**
 * X (Twitter) API - Fetch Tweet Endpoint
 *
 * GET /api/x/tweet?url=<tweet_url_or_id>
 * POST /api/x/tweet with { url: "<tweet_url_or_id>" }
 *
 * Returns tweet data with engagement metrics for ContentForge analysis.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { X_BEARER_TOKEN } from '$env/static/private';
import {
	extractTweetId,
	fetchTweetFromAPI,
	formatTweetForAnalysis
} from '$lib/services/x-api';

export const GET: RequestHandler = async ({ url }) => {
	const tweetUrl = url.searchParams.get('url');

	if (!tweetUrl) {
		throw error(400, 'Tweet URL or ID is required. Use ?url=<tweet_url_or_id>');
	}

	return fetchTweet(tweetUrl);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const tweetUrl = body.url;

	if (!tweetUrl) {
		throw error(400, 'Tweet URL or ID is required in request body');
	}

	return fetchTweet(tweetUrl);
};

async function fetchTweet(tweetUrl: string) {
	// Check if X API is configured
	if (!X_BEARER_TOKEN) {
		throw error(503, 'X API not configured. Add X_BEARER_TOKEN to .env file.');
	}

	// Extract tweet ID from URL
	const tweetId = extractTweetId(tweetUrl);
	if (!tweetId) {
		throw error(400, 'Invalid tweet URL or ID format');
	}

	console.log(`[X API] Fetching tweet: ${tweetId}`);

	// Fetch from X API
	const result = await fetchTweetFromAPI(tweetId, X_BEARER_TOKEN);

	if (!result.success || !result.tweet) {
		throw error(404, result.error || 'Failed to fetch tweet');
	}

	// Format for analysis
	const formattedContent = formatTweetForAnalysis(result.tweet);

	return json({
		success: true,
		tweet: result.tweet,
		formattedContent
	});
}
