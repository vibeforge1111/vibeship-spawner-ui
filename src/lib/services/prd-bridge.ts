/**
 * PRD Bridge Service
 *
 * Enables Claude Code (running in terminal) to analyze PRDs uploaded to Spawner UI.
 *
 * Flow:
 * 1. User uploads PRD in Spawner UI
 * 2. UI writes PRD to .spawner/pending-prd.md
 * 3. UI sends event {type: "prd_analysis_requested"}
 * 4. Claude Code reads the PRD and analyzes with real AI
 * 5. Claude Code sends event {type: "prd_analysis_complete", data: {...}}
 * 6. UI receives the intelligent analysis
 *
 * This uses REAL Claude intelligence, not regex pattern matching.
 */

import { browser } from '$app/environment';
import { writable, get } from 'svelte/store';
import type { BridgeEvent } from './event-bridge';

// =============================================================================
// TYPES
// =============================================================================

export interface PRDAnalysisRequest {
	prdPath: string;
	prdContent: string;
	projectName?: string;
	requestId: string;
	timestamp: string;
}

export interface PRDAnalysisResult {
	requestId: string;
	success: boolean;
	error?: string;

	// The intelligent analysis
	projectName: string;
	projectType: string;
	complexity: 'simple' | 'moderate' | 'complex';

	// Infrastructure decisions (by Claude, not regex)
	infrastructure: {
		needsAuth: boolean;
		authReason?: string;
		needsDatabase: boolean;
		databaseReason?: string;
		needsAPI: boolean;
		apiReason?: string;
	};

	// Tech stack recommendations
	techStack: {
		framework: string;
		language: string;
		styling?: string;
		database?: string;
		auth?: string;
		deployment?: string;
	};

	// Tasks - variable count based on actual complexity (could be 5 or 25)
	tasks: Array<{
		id: string;
		title: string;
		description: string;
		skills: string[];
		phase: number;
		dependsOn: string[];
		verification: {
			criteria: string[];
			files?: string[];
			commands?: string[];
		};
	}>;

	// H70 skills to load
	skills: string[];

	// The execution prompt (ready to copy-paste)
	executionPrompt: string;
}

// =============================================================================
// STATE
// =============================================================================

export const analysisStatus = writable<'idle' | 'pending' | 'analyzing' | 'complete' | 'error'>('idle');
export const analysisResult = writable<PRDAnalysisResult | null>(null);
export const analysisError = writable<string | null>(null);

// Pending requests waiting for response
const pendingRequests = new Map<string, {
	resolve: (result: PRDAnalysisResult) => void;
	reject: (error: Error) => void;
	timeout: ReturnType<typeof setTimeout>;
}>();

// =============================================================================
// BRIDGE FUNCTIONS
// =============================================================================

/**
 * Initialize the bridge - listen for analysis responses
 */
let bridgeInitialized = false;

export async function initPRDBridge(): Promise<void> {
	if (!browser || bridgeInitialized) return;

	try {
		// Dynamic import to get the client event bridge
		const { clientEventBridge } = await import('./event-bridge');

		if (!clientEventBridge) {
			console.warn('[PRDBridge] clientEventBridge not available');
			return;
		}

		// Subscribe to bridge events
		clientEventBridge.subscribe((event: BridgeEvent) => {
			console.log('[PRDBridge] Received event:', event.type);
			if (event.type === 'prd_analysis_complete') {
				handleAnalysisComplete(event);
			} else if (event.type === 'prd_analysis_error') {
				handleAnalysisError(event);
			} else if (event.type === 'prd_analysis_progress') {
				console.log('[PRDBridge] Analysis progress:', event.message);
			}
		});

		bridgeInitialized = true;
		console.log('[PRDBridge] Initialized, listening for analysis responses');
	} catch (e) {
		console.error('[PRDBridge] Failed to initialize:', e);
	}
}

/**
 * Request PRD analysis from Claude Code
 *
 * This sends the PRD to Claude Code (via file + event) and waits for response.
 */
export async function requestPRDAnalysis(
	prdContent: string,
	projectName?: string,
	timeoutMs: number = 120000 // 2 minute timeout
): Promise<PRDAnalysisResult> {
	const requestId = `prd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

	analysisStatus.set('pending');
	analysisError.set(null);

	try {
		// Step 1: Write PRD to file for Claude to read
		const prdPath = await writePRDToFile(prdContent, requestId);

		// Step 2: Send request event
		const request: PRDAnalysisRequest = {
			prdPath,
			prdContent: prdContent.slice(0, 500) + (prdContent.length > 500 ? '...' : ''), // Summary only in event
			projectName,
			requestId,
			timestamp: new Date().toISOString()
		};

		await sendAnalysisRequest(request);
		analysisStatus.set('analyzing');

		// Step 3: Wait for response
		const result = await waitForAnalysisResponse(requestId, timeoutMs);

		analysisStatus.set('complete');
		analysisResult.set(result);

		return result;

	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		analysisStatus.set('error');
		analysisError.set(message);
		throw error;
	}
}

/**
 * Write PRD to a file that Claude Code can read
 */
async function writePRDToFile(content: string, requestId: string): Promise<string> {
	// Use the API to write the file
	const response = await fetch('/api/prd-bridge/write', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ content, requestId })
	});

	if (!response.ok) {
		throw new Error('Failed to write PRD file');
	}

	const { path } = await response.json();
	return path;
}

/**
 * Send analysis request event
 */
async function sendAnalysisRequest(request: PRDAnalysisRequest): Promise<void> {
	const response = await fetch('/api/events', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			type: 'prd_analysis_requested',
			data: request,
			source: 'spawner-ui'
		})
	});

	if (!response.ok) {
		throw new Error('Failed to send analysis request');
	}

	console.log('[PRDBridge] Analysis request sent:', request.requestId);
}

/**
 * Wait for Claude Code to respond with analysis
 */
function waitForAnalysisResponse(requestId: string, timeoutMs: number): Promise<PRDAnalysisResult> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			pendingRequests.delete(requestId);
			reject(new Error('Analysis timeout - Claude Code may not be connected'));
		}, timeoutMs);

		pendingRequests.set(requestId, { resolve, reject, timeout });
	});
}

/**
 * Handle analysis complete event from Claude Code
 */
function handleAnalysisComplete(event: BridgeEvent): void {
	const data = event.data as { requestId?: string; result?: PRDAnalysisResult };

	console.log('[PRDBridge] Received analysis complete event:', data?.requestId);

	if (!data?.requestId) {
		console.warn('[PRDBridge] Received analysis without requestId');
		return;
	}

	// Always update the stores so UI can react
	if (data.result) {
		analysisResult.set(data.result);
		analysisStatus.set('complete');
		console.log('[PRDBridge] Updated stores with result:', data.result.projectName);
	}

	// Also resolve any pending promise-based requests
	const pending = pendingRequests.get(data.requestId);
	if (pending) {
		clearTimeout(pending.timeout);
		pendingRequests.delete(data.requestId);

		if (data.result) {
			pending.resolve(data.result);
		} else {
			pending.reject(new Error('No result in analysis response'));
		}
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
// CLAUDE CODE HELPER FUNCTIONS
// These are used by Claude Code to respond to analysis requests
// =============================================================================

/**
 * Format for Claude Code to send analysis result
 *
 * Claude Code should call:
 * curl -X POST http://localhost:5173/api/events \
 *   -H "Content-Type: application/json" \
 *   -d '{"type":"prd_analysis_complete","data":{"requestId":"...","result":{...}}}'
 */
export function getAnalysisResponseFormat(requestId: string, result: PRDAnalysisResult): string {
	return JSON.stringify({
		type: 'prd_analysis_complete',
		data: { requestId, result },
		source: 'claude-code'
	}, null, 2);
}
