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
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';

import { writeFile, mkdir, appendFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const EVENTS_AUTH_COOKIE = 'spawner_events_api_key';

function getSpawnerDir(): string {
	return process.env.SPAWNER_STATE_DIR || join(process.cwd(), '.spawner');
}

function getResultsDir(): string {
	return join(getSpawnerDir(), 'results');
}

function getPrdAutoTraceFile(): string {
	return join(getSpawnerDir(), 'prd-auto-trace.jsonl');
}

function extractApiKeyFromRequest(request: Request): string | null {
	const headerKey = request.headers.get('x-api-key') || request.headers.get('x-mcp-api-key');
	if (headerKey && headerKey.trim().length > 0) {
		return headerKey.trim();
	}

	const authorization = request.headers.get('authorization');
	if (authorization) {
		const match = authorization.match(/^Bearer\s+(.+)$/i);
		const bearerToken = match?.[1]?.trim() || null;
		if (bearerToken) {
			return bearerToken;
		}
	}

	try {
		const queryKey = new URL(request.url).searchParams.get('apiKey');
		if (queryKey && queryKey.trim().length > 0) {
			return queryKey.trim();
		}
	} catch {
		// Ignore malformed URLs.
	}

	return null;
}

function createAuthCookieHeader(request: Request): string | null {
	const apiKey = extractApiKeyFromRequest(request);
	if (!apiKey) {
		return null;
	}

	const isSecure = request.url.startsWith('https://');
	return `${EVENTS_AUTH_COOKIE}=${encodeURIComponent(apiKey)}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}`;
}

/**
 * Store PRD analysis result to file for polling fallback
 */
async function appendPrdTrace(requestId: string, event: string, details: Record<string, unknown> = {}): Promise<void> {
	try {
		await appendFile(
			getPrdAutoTraceFile(),
			`${JSON.stringify({ ts: new Date().toISOString(), requestId, event, ...details })}\n`,
			'utf-8'
		);
	} catch {
		// Trace failures are non-fatal.
	}
}

async function storePRDResult(requestId: string, result: unknown): Promise<void> {
	try {
		assertSafeId(requestId, 'requestId');
		const resultsDir = getResultsDir();

		if (!existsSync(resultsDir)) {
			await mkdir(resultsDir, { recursive: true });
		}
		const resultFile = resolveWithinBaseDir(resultsDir, `${requestId}.json`);
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
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: EVENTS_AUTH_COOKIE,
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

		// Relay mission-control events into Spark Intelligence and optional webhooks.
		void relayMissionControlEvent(fullEvent as Record<string, unknown>);

		// Store PRD results for polling fallback and trace runtime receipt
		if (fullEvent.type === 'prd_analysis_complete' && fullEvent.data?.requestId && fullEvent.data?.result) {
			await appendPrdTrace(fullEvent.data.requestId, 'events_received_complete', {
				source: fullEvent.source || 'unknown'
			});
			await storePRDResult(fullEvent.data.requestId, fullEvent.data.result);
		}

		if (fullEvent.type === 'prd_analysis_error' && fullEvent.data?.requestId) {
			await appendPrdTrace(fullEvent.data.requestId, 'events_received_error', {
				source: fullEvent.source || 'unknown',
				error: fullEvent.data?.error || null
			});
		}

		const headers = new Headers();
		const authCookie = createAuthCookieHeader(event.request);
		if (authCookie) {
			headers.set('Set-Cookie', authCookie);
		}
		return json({ success: true, eventId: fullEvent.id }, { headers });
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
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: EVENTS_AUTH_COOKIE,
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

			controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString(), source: 'event-bridge' })}\n\n`));

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

	const headers: Record<string, string> = {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive'
	};
	const authCookie = createAuthCookieHeader(event.request);
	if (authCookie) {
		headers['Set-Cookie'] = authCookie;
	}

	return new Response(stream, { headers });
};
