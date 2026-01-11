/**
 * ContentForge Bridge Service
 *
 * Enables Claude Code (running in terminal) to analyze content with REAL AI.
 *
 * Flow:
 * 1. User enters content in ContentForge UI
 * 2. UI writes content to .spawner/pending-contentforge.md
 * 3. UI sends event {type: "contentforge_analysis_requested"}
 * 4. Claude Code reads the content and analyzes with real AI intelligence
 * 5. Claude Code sends event {type: "contentforge_analysis_complete", data: {...}}
 * 6. UI receives the intelligent analysis
 *
 * This uses REAL Claude intelligence for:
 * - Marketing analysis (positioning, shareability, audience fit)
 * - Copywriting analysis (hooks, structure, persuasion)
 * - Research (trend context, relevance scoring)
 * - Psychology (emotional triggers, identity resonance)
 */

import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { BridgeEvent } from './event-bridge';
import {
	saveAnalysisToMind,
	queryLearnedPatterns,
	getCreativeRecommendations,
	getUserStyle,
	isMindConnected,
	type LearnedPattern,
	type UserStyle,
	type CreativeRecommendation
} from './contentforge-mind';

// =============================================================================
// TYPES
// =============================================================================

export interface ContentForgeRequest {
	requestId: string;
	content: string;
	contentPath: string;
	timestamp: string;
}

export interface ContentForgeResult {
	requestId: string;
	success: boolean;
	error?: string;
	postId: string;

	// Agent analyses - from real Claude AI
	orchestrator: {
		success: boolean;
		processingTimeMs: number;
		agentResults: {
			marketing: {
				agentId: string;
				success: boolean;
				data: {
					positioning: {
						niche: string;
						authorityLevel: string;
						targetAudience: string;
					};
					distributionFactors: {
						shareability: number;
						targetPlatforms: string[];
						viralPotential: string;
					};
				};
			};
			copywriting: {
				agentId: string;
				success: boolean;
				data: {
					hook: {
						type: string;
						effectiveness: number;
						improvement?: string;
					};
					structure: {
						format: string;
						pacing: string;
						clarity: number;
					};
				};
			};
			research: {
				agentId: string;
				success: boolean;
				data: {
					trendContext: {
						currentTrends: string[];
						trendPhase: string;
						relevanceScore: number;
					};
				};
			};
			psychology: {
				agentId: string;
				success: boolean;
				data: {
					emotionalTriggers: {
						primary: string;
						secondary: string[];
						intensity: number;
					};
					identityResonance: {
						inGroup: string;
						aspirationalGap: string;
					};
				};
			};
		};
	};

	// Synthesis from all agents
	synthesis: {
		viralityScore: number;
		keyInsights: string[];
		patternCorrelations: Array<{ pattern: string; correlation: number }>;
		playbook: {
			title: string;
			summary: string;
			steps: Array<{
				order: number;
				action: string;
				rationale: string;
			}>;
		};
	};

	// Creative outputs
	creative: {
		imageRecommendations: Array<{
			platform: string;
			style: string;
			aspectRatio: string;
			rationale: string;
		}>;
		threadExpansion: {
			estimatedReadTime: string;
			tweets: Array<{
				position: number;
				purpose: string;
				content: string;
				characterCount: number;
			}>;
		};
	};
}

// =============================================================================
// STATE
// =============================================================================

export const contentforgeStatus = writable<'idle' | 'pending' | 'analyzing' | 'complete' | 'error'>('idle');
export const contentforgeResult = writable<ContentForgeResult | null>(null);
export const contentforgeError = writable<string | null>(null);

// Mind learning stores
export const learnedPatterns = writable<LearnedPattern[]>([]);
export const userStyle = writable<UserStyle | null>(null);
export const creativeRecommendations = writable<CreativeRecommendation[]>([]);
export const mindConnected = writable<boolean>(false);

// Re-export Mind types for convenience
export type { LearnedPattern, UserStyle, CreativeRecommendation };

// Pending requests waiting for response
const pendingRequests = new Map<string, {
	resolve: (result: ContentForgeResult) => void;
	reject: (error: Error) => void;
	timeout: ReturnType<typeof setTimeout>;
}>();

// =============================================================================
// BRIDGE FUNCTIONS
// =============================================================================

let bridgeInitialized = false;

/**
 * Initialize the bridge - listen for analysis responses and connect to Mind
 */
export async function initContentForgeBridge(): Promise<void> {
	if (!browser || bridgeInitialized) return;

	try {
		const { clientEventBridge } = await import('./event-bridge');

		if (!clientEventBridge) {
			console.warn('[ContentForgeBridge] clientEventBridge not available');
			return;
		}

		clientEventBridge.subscribe((event: BridgeEvent) => {
			console.log('[ContentForgeBridge] Received event:', event.type);
			if (event.type === 'contentforge_analysis_complete') {
				handleAnalysisComplete(event);
			} else if (event.type === 'contentforge_analysis_error') {
				handleAnalysisError(event);
			} else if (event.type === 'contentforge_analysis_progress') {
				console.log('[ContentForgeBridge] Analysis progress:', event.message);
			}
		});

		bridgeInitialized = true;
		console.log('[ContentForgeBridge] Initialized, listening for analysis responses');

		// Check Mind connection and load user style
		await initMindConnection();
	} catch (e) {
		console.error('[ContentForgeBridge] Failed to initialize:', e);
	}
}

/**
 * Initialize Mind connection and load learned data
 */
async function initMindConnection(): Promise<void> {
	try {
		const connected = await isMindConnected();
		mindConnected.set(connected);

		if (connected) {
			console.log('[ContentForgeBridge] Mind connected, loading learned patterns...');

			// Load user style
			const style = await getUserStyle();
			if (style) {
				userStyle.set(style);
				console.log('[ContentForgeBridge] Loaded user style:', style.totalAnalyzed, 'past analyses');
			}

			// Load recent patterns
			const patterns = await queryLearnedPatterns();
			if (patterns.length > 0) {
				learnedPatterns.set(patterns);
				console.log('[ContentForgeBridge] Loaded', patterns.length, 'learned patterns');
			}
		} else {
			console.log('[ContentForgeBridge] Mind not connected - learning features disabled');
		}
	} catch (e) {
		console.warn('[ContentForgeBridge] Mind connection failed:', e);
		mindConnected.set(false);
	}
}

/**
 * Request content analysis from Claude Code
 */
export async function requestContentForgeAnalysis(
	content: string,
	timeoutMs: number = 300000 // 5 minute timeout for thorough analysis
): Promise<ContentForgeResult> {
	const requestId = `cf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

	// Store content for Mind learning
	lastAnalyzedContent = content;

	contentforgeStatus.set('pending');
	contentforgeError.set(null);

	try {
		// Step 1: Write content to file for Claude to read
		const contentPath = await writeContentToFile(content, requestId);

		// Step 2: Send request event
		const request: ContentForgeRequest = {
			requestId,
			content: content.slice(0, 500) + (content.length > 500 ? '...' : ''),
			contentPath,
			timestamp: new Date().toISOString()
		};

		await sendAnalysisRequest(request);
		contentforgeStatus.set('analyzing');

		// Step 3: Wait for response
		const result = await waitForAnalysisResponse(requestId, timeoutMs);

		contentforgeStatus.set('complete');
		contentforgeResult.set(result);

		return result;

	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		contentforgeStatus.set('error');
		contentforgeError.set(message);
		throw error;
	}
}

/**
 * Write content to a file that Claude Code can read
 */
async function writeContentToFile(content: string, requestId: string): Promise<string> {
	const response = await fetch('/api/contentforge/bridge/write', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ content, requestId })
	});

	if (!response.ok) {
		throw new Error('Failed to write content file');
	}

	const { path } = await response.json();
	return path;
}

/**
 * Send analysis request event
 */
async function sendAnalysisRequest(request: ContentForgeRequest): Promise<void> {
	const response = await fetch('/api/events', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			type: 'contentforge_analysis_requested',
			data: request,
			source: 'spawner-ui'
		})
	});

	if (!response.ok) {
		throw new Error('Failed to send analysis request');
	}

	console.log('[ContentForgeBridge] Analysis request sent:', request.requestId);
}

/**
 * Wait for Claude Code to respond with analysis
 * Uses both SSE events AND polling as fallback
 */
function waitForAnalysisResponse(requestId: string, timeoutMs: number): Promise<ContentForgeResult> {
	return new Promise((resolve, reject) => {
		let resolved = false;

		const timeout = setTimeout(() => {
			if (resolved) return;
			resolved = true;
			pendingRequests.delete(requestId);
			reject(new Error('Analysis timeout - Claude Code may not be connected. Try the local analysis instead.'));
		}, timeoutMs);

		// Fallback: Poll for results every 2 seconds (faster polling)
		const pollInterval = setInterval(async () => {
			if (resolved) {
				clearInterval(pollInterval);
				return;
			}

			try {
				const response = await fetch('/api/contentforge/bridge/result');
				if (!response.ok) return;

				const data = await response.json();
				if (!data.hasResult) return;

				// Check for requestId in multiple possible locations
				const storedRequestId = data.data?.requestId || data.requestId;

				// Accept result if requestId matches OR if we have any valid result (fallback)
				const hasMatchingId = storedRequestId === requestId;
				const hasValidResult = data.data?.orchestrator || data.data?.synthesis;

				if (hasMatchingId || hasValidResult) {
					console.log('[ContentForgeBridge] Got result via polling fallback, matched:', hasMatchingId, 'valid:', hasValidResult);
					resolved = true;
					clearTimeout(timeout);
					clearInterval(pollInterval);
					pendingRequests.delete(requestId);

					// Clear the stored result
					await fetch('/api/contentforge/bridge/result', { method: 'DELETE' });

					// Update stores
					const result = data.data as ContentForgeResult;
					contentforgeResult.set(result);
					contentforgeStatus.set('complete');

					resolve(result);
				}
			} catch (e) {
				console.warn('[ContentForgeBridge] Polling error:', e);
			}
		}, 2000);

		pendingRequests.set(requestId, {
			resolve: (result) => {
				if (resolved) return;
				resolved = true;
				clearTimeout(timeout);
				clearInterval(pollInterval);
				resolve(result);
			},
			reject: (error) => {
				if (resolved) return;
				resolved = true;
				clearTimeout(timeout);
				clearInterval(pollInterval);
				reject(error);
			},
			timeout
		});
	});
}

/**
 * Handle analysis complete event from Claude Code
 */
function handleAnalysisComplete(event: BridgeEvent): void {
	const eventData = event.data as Record<string, unknown>;

	// Support both formats:
	// 1. {requestId, result: {...}} - nested format
	// 2. {requestId, postId, orchestrator, synthesis, ...} - flat format (result IS the data)
	let requestId = eventData?.requestId as string | undefined;
	let result: ContentForgeResult | undefined;

	if (eventData?.result && typeof eventData.result === 'object') {
		// Nested format: data.result contains the actual result
		result = eventData.result as ContentForgeResult;
		requestId = requestId || result.requestId;
	} else if (eventData?.orchestrator || eventData?.synthesis) {
		// Flat format: data IS the result
		result = eventData as unknown as ContentForgeResult;
		requestId = requestId || result.requestId;
	}

	console.log('[ContentForgeBridge] Received analysis complete:', requestId, 'hasResult:', !!result);

	if (!requestId) {
		console.warn('[ContentForgeBridge] Received analysis without requestId');
		// Still try to use the result if we have one
		if (result) {
			contentforgeResult.set(result);
			contentforgeStatus.set('complete');
			console.log('[ContentForgeBridge] Updated stores with result (no requestId)');
		}
		return;
	}

	if (result) {
		contentforgeResult.set(result);
		contentforgeStatus.set('complete');
		console.log('[ContentForgeBridge] Updated stores with result');

		// Save to Mind for learning (async, don't block)
		saveResultToMind(result);

		// Generate creative recommendations
		generateCreativeRecs(result);
	}

	const pending = pendingRequests.get(requestId);
	if (pending) {
		clearTimeout(pending.timeout);
		pendingRequests.delete(requestId);

		if (result) {
			pending.resolve(result);
		} else {
			pending.reject(new Error('No result in analysis response'));
		}
	}
}

// Track the last analyzed content for Mind storage
let lastAnalyzedContent = '';

/**
 * Save analysis result to Mind for learning
 */
async function saveResultToMind(result: ContentForgeResult): Promise<void> {
	try {
		const hookType = result.orchestrator?.agentResults?.copywriting?.data?.hook?.type;
		const emotionalTrigger = result.orchestrator?.agentResults?.psychology?.data?.emotionalTriggers?.primary;
		const patterns = result.synthesis?.patternCorrelations?.map(p => p.pattern) || [];

		const saved = await saveAnalysisToMind(lastAnalyzedContent, {
			viralityScore: result.synthesis?.viralityScore || 0,
			keyInsights: result.synthesis?.keyInsights || [],
			hookType,
			emotionalTrigger,
			patterns
		});

		if (saved) {
			console.log('[ContentForgeBridge] Analysis saved to Mind for learning');

			// Refresh learned patterns
			const newPatterns = await queryLearnedPatterns();
			if (newPatterns.length > 0) {
				learnedPatterns.set(newPatterns);
			}
		}
	} catch (e) {
		console.warn('[ContentForgeBridge] Failed to save to Mind:', e);
	}
}

/**
 * Generate creative format recommendations
 */
async function generateCreativeRecs(result: ContentForgeResult): Promise<void> {
	try {
		const patterns = result.synthesis?.patternCorrelations?.map(p => p.pattern) || [];
		const viralityScore = result.synthesis?.viralityScore || 0;

		const recs = await getCreativeRecommendations(lastAnalyzedContent, viralityScore, patterns);
		if (recs.length > 0) {
			creativeRecommendations.set(recs);
			console.log('[ContentForgeBridge] Generated', recs.length, 'creative recommendations');
		}
	} catch (e) {
		console.warn('[ContentForgeBridge] Failed to generate creative recommendations:', e);
	}
}

/**
 * Handle analysis error event from Claude Code
 */
function handleAnalysisError(event: BridgeEvent): void {
	const data = event.data as { requestId?: string; error?: string };

	if (!data?.requestId) return;

	const pending = pendingRequests.get(data.requestId);
	if (pending) {
		clearTimeout(pending.timeout);
		pendingRequests.delete(data.requestId);
		pending.reject(new Error(data.error || 'Analysis failed'));
	}
}

// =============================================================================
// CHECK IF CLAUDE CODE IS CONNECTED
// =============================================================================

/**
 * Check if Claude Code bridge is available
 */
export async function isClaudeCodeConnected(): Promise<boolean> {
	try {
		const response = await fetch('/api/contentforge/bridge/status');
		if (!response.ok) return false;
		const data = await response.json();
		return data.connected === true;
	} catch {
		return false;
	}
}
