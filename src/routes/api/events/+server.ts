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

import { writeFile, mkdir, appendFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const SPAWNER_DIR = join(process.cwd(), '.spawner');
const RESULTS_DIR = join(SPAWNER_DIR, 'results');
const PRD_AUTO_TRACE_FILE = join(SPAWNER_DIR, 'prd-auto-trace.jsonl');
const EVENTS_AUTH_COOKIE = 'spawner_events_api_key';
const PROGRESS_NOTIFICATION_WINDOW_MS = 60_000;
const PROGRESS_NOTIFICATION_MAX_ENTRIES = 300;

const execFileAsync = promisify(execFile);
const progressNotificationCache = new Map<string, number>();

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

function buildProgressNotificationText(event: Record<string, unknown>): string | null {
	const type = typeof event.type === 'string' ? event.type : '';
	const missionId = typeof event.missionId === 'string' ? event.missionId : undefined;
	const taskName =
		typeof event.taskName === 'string'
			? event.taskName
			: typeof event.taskId === 'string'
				? event.taskId
				: 'task';

	if (type === 'task_completed') {
		return `Spawner progress: completed ${taskName}${missionId ? ` (${missionId})` : ''}.`;
	}
	if (type === 'task_failed') {
		return `Spawner progress: failed ${taskName}${missionId ? ` (${missionId})` : ''}.`;
	}
	if (type === 'task_cancelled') {
		return `Spawner progress: cancelled ${taskName}${missionId ? ` (${missionId})` : ''}.`;
	}
	if (type === 'mission_completed') {
		return `Spawner mission completed${missionId ? ` (${missionId})` : ''}.`;
	}
	if (type === 'mission_failed') {
		return `Spawner mission failed${missionId ? ` (${missionId})` : ''}.`;
	}

	return null;
}

function shouldSendProgressSignal(event: Record<string, unknown>): boolean {
	const type = typeof event.type === 'string' ? event.type : '';
	if (!['task_completed', 'task_failed', 'task_cancelled', 'mission_completed', 'mission_failed'].includes(type)) {
		return false;
	}

	const missionId = typeof event.missionId === 'string' ? event.missionId : 'unknown-mission';
	const taskId = typeof event.taskId === 'string' ? event.taskId : 'mission';
	const signature = `${type}:${missionId}:${taskId}`;
	const now = Date.now();
	const previous = progressNotificationCache.get(signature);
	if (typeof previous === 'number' && now - previous < PROGRESS_NOTIFICATION_WINDOW_MS) {
		return false;
	}

	progressNotificationCache.set(signature, now);
	if (progressNotificationCache.size > PROGRESS_NOTIFICATION_MAX_ENTRIES) {
		const cutoff = now - PROGRESS_NOTIFICATION_WINDOW_MS;
		for (const [key, timestamp] of progressNotificationCache.entries()) {
			if (timestamp < cutoff) {
				progressNotificationCache.delete(key);
			}
		}
	}

	return true;
}

async function pushProgressSignal(event: Record<string, unknown>): Promise<void> {
	if (process.env.NODE_ENV === 'test') return;
	if (!shouldSendProgressSignal(event)) return;

	const source = typeof event.source === 'string' ? event.source : '';
	if (source === 'spawner-ui') return;

	const text = buildProgressNotificationText(event);
	if (!text) return;

	try {
		await execFileAsync('openclaw', ['system', 'event', '--text', text, '--mode', 'now'], {
			windowsHide: true,
			timeout: 8000
		});
	} catch (error) {
		console.warn('[EventBridge] Failed to push OpenClaw progress signal:', error);
	}
}

/**
 * Store PRD analysis result to file for polling fallback
 */
async function appendPrdTrace(requestId: string, event: string, details: Record<string, unknown> = {}): Promise<void> {
	try {
		await appendFile(
			PRD_AUTO_TRACE_FILE,
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

		// Push native progress signal to OpenClaw chat for milestone events
		void pushProgressSignal(fullEvent as Record<string, unknown>);

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
