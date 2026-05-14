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
import { controlQueryApiKeysAllowed, enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';
import { providerRuntime } from '$lib/server/provider-runtime';
import { projectStoredPrdAnalysisResult } from '$lib/server/prd-analysis-result-schema';
import { spawnerStateDir } from '$lib/server/spawner-state';
import { extractTraceRef } from '$lib/server/trace-ref';
import { logger } from '$lib/utils/logger';

import { writeFile, mkdir, appendFile, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const EVENTS_AUTH_COOKIE = 'spawner_events_api_key';
const log = logger.scope('EventBridge');

function corsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get('origin');
	if (!origin) return {};
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-mcp-api-key',
		Vary: 'Origin'
	};
}

function getSpawnerDir(): string {
	return spawnerStateDir();
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

	if (controlQueryApiKeysAllowed()) {
		try {
			const queryKey = new URL(request.url).searchParams.get('apiKey');
			if (queryKey && queryKey.trim().length > 0) {
				return queryKey.trim();
			}
		} catch {
			// Ignore malformed URLs.
		}
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
		const traceRef = await traceRefForRequest(requestId, details);
		await appendFile(
			getPrdAutoTraceFile(),
			`${JSON.stringify({
				ts: new Date().toISOString(),
				requestId,
				event,
				...details,
				...(traceRef ? { traceRef, trace_ref: traceRef } : {})
			})}\n`,
			'utf-8'
		);
	} catch {
		// Trace failures are non-fatal.
	}
}

async function traceRefForRequest(requestId: string, details: Record<string, unknown>): Promise<string | null> {
	const explicit = extractTraceRef(details);
	if (explicit) return explicit;
	try {
		const pendingRequestFile = join(getSpawnerDir(), 'pending-request.json');
		if (!existsSync(pendingRequestFile)) return null;
		const pendingRaw = await readFile(pendingRequestFile, 'utf-8');
		const pending = JSON.parse(pendingRaw) as Record<string, unknown>;
		if (pending.requestId !== requestId) return null;
		return extractTraceRef(pending);
	} catch {
		return null;
	}
}

async function storePRDResult(requestId: string, result: unknown): Promise<void> {
	assertSafeId(requestId, 'requestId');
	const traceRef = await traceRefForRequest(requestId, {});
	const resultRecord = result && typeof result === 'object' && !Array.isArray(result)
		? (result as Record<string, unknown>)
		: {};
	const metadataRecord = resultRecord.metadata && typeof resultRecord.metadata === 'object' && !Array.isArray(resultRecord.metadata)
		? (resultRecord.metadata as Record<string, unknown>)
		: {};
	const storedResult = projectStoredPrdAnalysisResult(
		requestId,
		traceRef ? { ...resultRecord, traceRef, metadata: { ...metadataRecord, traceRef } } : result
	);
	const resultsDir = getResultsDir();

	if (!existsSync(resultsDir)) {
		await mkdir(resultsDir, { recursive: true });
	}
	const resultFile = resolveWithinBaseDir(resultsDir, `${requestId}.json`);
	await writeFile(resultFile, JSON.stringify(storedResult, null, 2), 'utf-8');
	log.info(`Stored PRD result for polling: ${requestId}`);
}

async function relayMetadataForMission(missionId: string): Promise<Record<string, unknown>> {
	try {
		const loadFile = join(getSpawnerDir(), 'last-canvas-load.json');
		if (!existsSync(loadFile)) return {};
		const raw = await readFile(loadFile, 'utf-8');
		const load = JSON.parse(raw) as { relay?: Record<string, unknown> };
		const relay = load.relay && typeof load.relay === 'object' ? load.relay : null;
		if (!relay || relay.missionId !== missionId) return {};
		const traceRef = extractTraceRef(load, relay);
		return {
			chatId: typeof relay.chatId === 'string' ? relay.chatId : undefined,
			userId: typeof relay.userId === 'string' ? relay.userId : undefined,
			requestId: typeof relay.requestId === 'string' ? relay.requestId : undefined,
			traceRef: traceRef || undefined,
			goal: typeof relay.goal === 'string' ? relay.goal : undefined,
			telegramRelay:
				relay.telegramRelay && typeof relay.telegramRelay === 'object'
					? relay.telegramRelay
					: undefined,
			telegramRelayPort:
				typeof relay.telegramRelayPort === 'string' || typeof relay.telegramRelayPort === 'number'
					? relay.telegramRelayPort
					: undefined,
			telegramRelayProfile:
				typeof relay.telegramRelayProfile === 'string' ? relay.telegramRelayProfile : undefined
		};
	} catch {
		return {};
	}
}


/**
 * POST handler - receives events from Claude Code
 * Claude can call: curl -X POST http://localhost:3333/api/events -d '{"type":"progress",...}'
 */
export const POST: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'Events',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: EVENTS_AUTH_COOKIE,
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
		let fullEvent = {
			...payload,
			timestamp: payload.timestamp || new Date().toISOString(),
			source: payload.source || 'claude-code',
			id: payload.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		};
		if (typeof fullEvent.missionId === 'string') {
			const relayMeta = await relayMetadataForMission(fullEvent.missionId);
			if (Object.keys(relayMeta).length > 0) {
				fullEvent = {
					...fullEvent,
					data: {
						...relayMeta,
						...(fullEvent.data && typeof fullEvent.data === 'object' ? fullEvent.data : {})
					}
				};
			}
		}

		// Broadcast to all connected clients
		eventBridge.emit(fullEvent);

		if (
			(fullEvent.type === 'mission_completed' || fullEvent.type === 'mission_failed' || fullEvent.type === 'mission_cancelled') &&
			typeof fullEvent.missionId === 'string'
		) {
			const data = fullEvent.data && typeof fullEvent.data === 'object' ? fullEvent.data : {};
			const providerId =
				typeof data.provider === 'string'
					? data.provider
					: typeof data.providerId === 'string'
						? data.providerId
						: typeof fullEvent.source === 'string' && fullEvent.source !== 'spawner-ui'
							? fullEvent.source
							: null;
			providerRuntime.markMissionTerminalFromLifecycleEvent({
				missionId: fullEvent.missionId,
				status:
					fullEvent.type === 'mission_completed'
						? 'completed'
						: fullEvent.type === 'mission_cancelled'
							? 'cancelled'
							: 'failed',
				providerId,
				response: typeof data.response === 'string' ? data.response : null,
				error:
					typeof fullEvent.message === 'string' && (fullEvent.type === 'mission_failed' || fullEvent.type === 'mission_cancelled')
						? fullEvent.message
						: typeof data.error === 'string'
							? data.error
							: null,
				completedAt: typeof fullEvent.timestamp === 'string' ? fullEvent.timestamp : null
			});
		}

		// Relay mission-control events into Spark Intelligence and optional webhooks.
		void relayMissionControlEvent(fullEvent as Record<string, unknown>);

		// Store PRD results for polling fallback and trace runtime receipt
		if (fullEvent.type === 'prd_analysis_complete' && fullEvent.data?.requestId && fullEvent.data?.result) {
			await appendPrdTrace(fullEvent.data.requestId, 'events_received_complete', {
				source: fullEvent.source || 'unknown'
			});
			try {
				await storePRDResult(fullEvent.data.requestId, fullEvent.data.result);
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Invalid PRD analysis result';
				await appendPrdTrace(fullEvent.data.requestId, 'events_rejected_complete', {
					source: fullEvent.source || 'unknown',
					error: message
				});
				return json({ error: message }, { status: err instanceof PathSafetyError ? err.status : 400 });
			}
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
		for (const [key, value] of Object.entries(corsHeaders(event.request))) {
			headers.set(key, value);
		}
		return json({ success: true, eventId: fullEvent.id }, { headers });
	} catch (error) {
		console.error('[EventBridge] Error processing event:', error);
		return json({ error: 'Invalid event data' }, { status: 400, headers: corsHeaders(event.request) });
	}
};

export const OPTIONS: RequestHandler = async (event) => {
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

	return new Response(null, { status: 204, headers: corsHeaders(event.request) });
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
					logger.info('[EventBridge] Client disconnected');
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
		'Connection': 'keep-alive',
		...corsHeaders(event.request)
	};
	const authCookie = createAuthCookieHeader(event.request);
	if (authCookie) {
		headers['Set-Cookie'] = authCookie;
	}

	return new Response(stream, { headers });
};
