/**
 * Event Bridge API - Receives events from Claude Code and broadcasts to spawner-ui
 *
 * POST /api/events - Receive an event from Claude Code
 * GET /api/events - SSE stream for real-time event updates
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eventBridge } from '$lib/services/event-bridge';
import { assertSafeId, PathSafetyError, resolveWithinBaseDir } from '$lib/server/path-safety';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const SPAWNER_DIR = join(process.cwd(), '.spawner');
const RESULTS_DIR = join(SPAWNER_DIR, 'results');

/**
 * Store PRD analysis result to file for polling fallback
 */
async function storePRDResult(requestId: string, result: unknown): Promise<void> {
	try {
		assertSafeId(requestId, 'requestId');

		if (!existsSync(RESULTS_DIR)) {
			await mkdir(RESULTS_DIR, { recursive: true });
		}
		const resultFile = resolveWithinBaseDir(RESULTS_DIR, `${requestId}.json`);
		await writeFile(resultFile, JSON.stringify(result, null, 2), 'utf-8');
		console.log('[EventBridge] Stored PRD result for polling:', requestId);
	} catch (err) {
		if (err instanceof PathSafetyError) {
			console.warn(`[EventBridge] Skipping unsafe requestId "${requestId}": ${err.message}`);
			return;
		}
		console.error('[EventBridge] Failed to store PRD result:', err);
	}
}


/**
 * POST handler - receives events from Claude Code
 * Claude can call: curl -X POST http://localhost:5173/api/events -d '{"type":"progress",...}'
 */
export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'Events',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'events_post',
		limit: 240,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	try {
		const { request } = event;
		const payload = await request.json();

		// Validate required fields
		if (!payload.type) {
			return json({ error: 'Event type is required' }, { status: 400 });
		}

		// Add metadata
		const fullEvent = {
			...payload,
			timestamp: payload.timestamp || new Date().toISOString(),
			source: payload.source || 'claude-code',
			id: payload.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		};

		// Broadcast to all connected clients
		eventBridge.emit(fullEvent);

		// Store PRD results for polling fallback
		if (fullEvent.type === 'prd_analysis_complete' && fullEvent.data?.requestId && fullEvent.data?.result) {
			await storePRDResult(fullEvent.data.requestId, fullEvent.data.result);
		}

		return json({ success: true, eventId: fullEvent.id });
	} catch (error) {
		console.error('[EventBridge] Error processing event:', error);
		return json({ error: 'Invalid event data' }, { status: 400 });
	}
};

/**
 * GET handler - Server-Sent Events stream for real-time updates
 */
export const GET: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'Events',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	const rateLimited = enforceRateLimit(event, {
		scope: 'events_stream',
		limit: 120,
		windowMs: 60_000
	});
	if (rateLimited) return rateLimited;

	const { request } = event;
	const stream = new ReadableStream({
		start(controller) {
			// Send initial connection message
			const encoder = new TextEncoder();
			let isClosed = false;

			controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`));

			// Subscribe to events
			const unsubscribe = eventBridge.subscribe((event) => {
				if (isClosed) return;
				try {
					const data = `data: ${JSON.stringify(event)}\n\n`;
					controller.enqueue(encoder.encode(data));
				} catch (e) {
					// Client disconnected
					isClosed = true;
					console.log('[EventBridge] Client disconnected');
				}
			});

			// Handle client disconnect
			request.signal.addEventListener('abort', () => {
				unsubscribe();
				if (!isClosed) {
					isClosed = true;
					try {
						controller.close();
					} catch (e) {
						// Controller already closed, ignore
					}
				}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
};
